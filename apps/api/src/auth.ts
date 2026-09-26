import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  Injectable,
  Module,
  UnauthorizedException,
  ServiceUnavailableException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { Response } from "express";
import { z } from "zod";
import nodemailer from "nodemailer";
import { AuthedRequest, Db, Public, parse, safeUser, origin } from "./common";
import {
  token,
  digest,
  hashPassword,
  verifyPassword,
} from "../../../packages/core/security";
const email = z
  .string()
  .email()
  .max(254)
  .transform((v) => v.toLowerCase().trim());
const password = z.string().min(12, "Use at least 12 characters.").max(128);
const credentials = z
  .object({ email, password: z.string().min(1).max(128) })
  .strict();
const sessionMs = 7 * 24 * 3600 * 1000;
@Injectable()
export class Mailer {
  get configured() {
    return !!process.env.SMTP_HOST;
  }
  async send(to: string, subject: string, text: string) {
    if (!this.configured)
      throw new ServiceUnavailableException(
        "Email delivery is not configured. Contact the workspace administrator.",
      );
    await nodemailer
      .createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 1025),
        secure: process.env.SMTP_SECURE === "true",
        ...(process.env.SMTP_USER
          ? {
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
              },
            }
          : {}),
      })
      .sendMail({
        from: process.env.MAIL_FROM || "Marketing OS <hello@localhost>",
        to,
        subject,
        text,
      });
  }
}
@Controller("auth")
export class AuthController {
  private dummyHash = hashPassword(token());
  constructor(
    private db: Db,
    private mail: Mailer,
  ) {}
  private cookie(res: Response, value: string, maxAge = sessionMs) {
    res.cookie("mos_session", value, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
      path: "/",
      maxAge,
    });
  }
  private async issue(userId: string, res: Response) {
    const raw = token();
    await this.db.session.create({
      data: {
        userId,
        tokenHash: digest(raw),
        expiresAt: new Date(Date.now() + sessionMs),
      },
    });
    this.cookie(res, raw);
  }
  @Public()
  @Post("register")
  async register(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = parse(
      z
        .object({ name: z.string().trim().min(2).max(100), email, password })
        .strict(),
      body,
    );
    if (await this.db.user.findUnique({ where: { email: data.email } }))
      throw new ConflictException("An account already exists for this email.");
    const user = await this.db.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: await hashPassword(data.password),
      },
      select: safeUser,
    });
    await this.issue(user.id, res);
    return { user };
  }
  @Public()
  @Post("login")
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = parse(credentials, body);
    const user = await this.db.user.findUnique({
      where: { email: data.email },
    });
    const valid = await verifyPassword(
      data.password,
      user?.passwordHash || (await this.dummyHash),
    );
    if (!user || !valid)
      throw new UnauthorizedException("Email or password is incorrect.");
    await this.issue(user.id, res);
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        verifiedAt: user.verifiedAt,
      },
    };
  }
  @Get("me")
  async me(@Req() req: AuthedRequest) {
    return {
      user: await this.db.user.findUniqueOrThrow({
        where: { id: req.userId },
        select: safeUser,
      }),
      emailDelivery: this.mail.configured,
    };
  }
  @Post("renew")
  async renew(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = token();
    await this.db.$transaction(async (tx) => {
      const consumed = await tx.session.deleteMany({
        where: { id: req.sessionId, userId: req.userId },
      });
      if (!consumed.count)
        throw new UnauthorizedException(
          "Session already renewed. Please sign in again.",
        );
      await tx.session.create({
        data: {
          userId: req.userId,
          tokenHash: digest(raw),
          expiresAt: new Date(Date.now() + sessionMs),
        },
      });
    });
    this.cookie(res, raw);
    return { ok: true };
  }
  @Post("logout")
  async logout(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.db.session.deleteMany({
      where: { id: req.sessionId, userId: req.userId },
    });
    this.cookie(res, "", 0);
    return { ok: true };
  }
  @Post("logout-all")
  async logoutAll(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.db.session.deleteMany({ where: { userId: req.userId } });
    this.cookie(res, "", 0);
    return { ok: true };
  }
  @Public()
  @Post("forgot-password")
  async forgot(@Body() body: unknown) {
    const data = parse(z.object({ email }).strict(), body);
    if (!this.mail.configured)
      throw new ServiceUnavailableException(
        "Password recovery needs email delivery. Contact the administrator.",
      );
    const user = await this.db.user.findUnique({
      where: { email: data.email },
    });
    if (user) {
      const raw = token();
      await this.db.authToken.create({
        data: {
          userId: user.id,
          purpose: "reset",
          tokenHash: digest(raw),
          expiresAt: new Date(Date.now() + 30 * 60000),
        },
      });
      await this.mail.send(
        user.email,
        "Reset your Marketing OS password",
        `Open ${origin()}/?reset=${raw}\nThis link expires in 30 minutes. If you did not request it, ignore this email.`,
      );
    }
    return { message: "If this account exists, a reset link has been sent." };
  }
  @Public()
  @Post("reset-password")
  async reset(@Body() body: unknown) {
    const data = parse(
      z
        .object({ token: z.string().regex(/^[a-f0-9]{64}$/), password })
        .strict(),
      body,
    );
    const row = await this.db.authToken.findUnique({
      where: { tokenHash: digest(data.token) },
    });
    if (!row || row.purpose !== "reset" || row.expiresAt < new Date())
      throw new BadRequestException("This reset link is invalid or expired.");
    const passwordHash = await hashPassword(data.password);
    await this.db.$transaction(async (tx) => {
      const used = await tx.authToken.deleteMany({
        where: { id: row.id, expiresAt: { gt: new Date() } },
      });
      if (!used.count)
        throw new BadRequestException("This link has already been used.");
      await tx.user.update({
        where: { id: row.userId },
        data: { passwordHash },
      });
      await tx.session.deleteMany({ where: { userId: row.userId } });
      await tx.authToken.deleteMany({
        where: { userId: row.userId, purpose: "reset" },
      });
    });
    return { ok: true };
  }
  @Post("request-verification")
  async requestVerification(@Req() req: AuthedRequest) {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: req.userId },
    });
    if (user.verifiedAt) return { ok: true };
    if (!this.mail.configured)
      throw new ServiceUnavailableException(
        "Email delivery is not configured.",
      );
    const raw = token();
    await this.db.authToken.create({
      data: {
        userId: user.id,
        purpose: "verify",
        tokenHash: digest(raw),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    await this.mail.send(
      user.email,
      "Verify your Marketing OS email",
      `Open ${origin()}/?verify=${raw}\nThis link expires in 24 hours.`,
    );
    return { ok: true };
  }
  @Public()
  @Post("verify-email")
  async verify(@Body() body: unknown) {
    const data = parse(
      z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
      body,
    );
    await this.db.$transaction(async (tx) => {
      const row = await tx.authToken.findUnique({
        where: { tokenHash: digest(data.token) },
      });
      if (!row || row.purpose !== "verify" || row.expiresAt < new Date())
        throw new BadRequestException(
          "Verification link is invalid or expired.",
        );
      const used = await tx.authToken.deleteMany({ where: { id: row.id } });
      if (!used.count)
        throw new BadRequestException("Verification link already used.");
      await tx.user.update({
        where: { id: row.userId },
        data: { verifiedAt: new Date() },
      });
    });
    return { ok: true };
  }
}
@Module({
  controllers: [AuthController],
  providers: [Mailer],
  exports: [Mailer],
})
export class AuthModule {}
