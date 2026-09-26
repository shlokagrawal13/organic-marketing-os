import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Req,
  UseGuards,
  Module,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import {
  AuthedRequest,
  Db,
  TenantGuard,
  Roles,
  parse,
  idSchema,
} from "./common";
import { token, digest } from "../../../packages/core/security";
import { AuthModule, Mailer } from "./auth";
const timezone = z.string().refine((v) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}, "Select a valid timezone.");
const workspace = z
  .object({
    name: z.string().trim().min(2).max(100),
    timezone: timezone.default("Asia/Kolkata"),
  })
  .strict();
@Controller("organizations")
export class OrganizationsController {
  constructor(private db: Db) {}
  @Get() list(@Req() req: AuthedRequest) {
    return this.db.membership.findMany({
      where: { userId: req.userId },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });
  }
  @Post() async create(@Req() req: AuthedRequest, @Body() body: unknown) {
    const data = parse(workspace, body);
    return this.db.organization.create({
      data: {
        ...data,
        memberships: { create: { userId: req.userId, role: "OWNER" } },
        audits: {
          create: { actorId: req.userId, action: "workspace.created" },
        },
      },
    });
  }
  @Post("accept-invitation") async accept(
    @Req() req: AuthedRequest,
    @Body() body: unknown,
  ) {
    const data = parse(
      z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
      body,
    );
    return this.db.$transaction(async (tx) => {
      const invite = await tx.invitation.findUnique({
        where: { tokenHash: digest(data.token) },
      });
      const user = await tx.user.findUniqueOrThrow({
        where: { id: req.userId },
      });
      if (
        !invite ||
        invite.expiresAt < new Date() ||
        user.email !== invite.email
      )
        throw new BadRequestException(
          "This invitation is invalid or belongs to another email.",
        );
      const removed = await tx.invitation.deleteMany({
        where: { id: invite.id },
      });
      if (!removed.count)
        throw new BadRequestException("Invitation already accepted.");
      await tx.membership.upsert({
        where: {
          userId_organizationId: {
            userId: req.userId,
            organizationId: invite.organizationId,
          },
        },
        create: {
          userId: req.userId,
          organizationId: invite.organizationId,
          role: invite.role,
        },
        update: {},
      });
      await tx.auditLog.create({
        data: {
          organizationId: invite.organizationId,
          actorId: req.userId,
          action: "team.joined",
        },
      });
      return { organizationId: invite.organizationId };
    });
  }
}
@Controller("workspaces/:organizationId")
@UseGuards(TenantGuard)
export class WorkspaceController {
  constructor(
    private db: Db,
    private mail: Mailer,
  ) {}
  @Get() get(@Req() req: AuthedRequest) {
    return this.db.organization.findUniqueOrThrow({
      where: { id: req.organizationId },
    });
  }
  @Patch() @Roles("OWNER", "ADMIN") async update(
    @Req() req: AuthedRequest,
    @Body() body: unknown,
  ) {
    const data = parse(workspace, body);
    return this.db.$transaction(async (tx) => {
      const org = await tx.organization.update({
        where: { id: req.organizationId },
        data,
      });
      await tx.auditLog.create({
        data: {
          organizationId: req.organizationId,
          actorId: req.userId,
          action: "workspace.updated",
        },
      });
      return org;
    });
  }
  @Get("team") @Roles("OWNER", "ADMIN") async team(@Req() req: AuthedRequest) {
    return {
      members: await this.db.membership.findMany({
        where: { organizationId: req.organizationId },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      invitations: await this.db.invitation.findMany({
        where: { organizationId: req.organizationId },
        select: { id: true, email: true, role: true, expiresAt: true },
      }),
    };
  }
  @Post("team/invite") @Roles("OWNER", "ADMIN") async invite(
    @Req() req: AuthedRequest,
    @Body() body: unknown,
  ) {
    const data = parse(
      z
        .object({
          email: z
            .string()
            .email()
            .transform((v) => v.toLowerCase()),
          role: z.enum(["ADMIN", "EDITOR", "CREATOR", "ANALYST", "CLIENT"]),
        })
        .strict(),
      body,
    );
    const raw = token(),
      expiresAt = new Date(Date.now() + 7 * 86400000);
    if (!this.mail.configured)
      throw new BadRequestException(
        "Configure email delivery before inviting teammates.",
      );
    const org = await this.db.organization.findUniqueOrThrow({
      where: { id: req.organizationId },
    });
    const row = await this.db.invitation.upsert({
      where: {
        organizationId_email: {
          organizationId: req.organizationId,
          email: data.email,
        },
      },
      create: {
        organizationId: req.organizationId,
        ...data,
        tokenHash: digest(raw),
        expiresAt,
      },
      update: { role: data.role, tokenHash: digest(raw), expiresAt },
    });
    await this.mail.send(
      data.email,
      `Join ${org.name} on Marketing OS`,
      `You have been invited as ${data.role}. Sign in with this email and open ${process.env.WEB_ORIGIN || "http://localhost:3000"}/?invite=${raw}`,
    );
    await this.db.auditLog.create({
      data: {
        organizationId: req.organizationId,
        actorId: req.userId,
        action: "team.invited",
        entityId: row.id,
      },
    });
    return { id: row.id, email: row.email, role: row.role };
  }
  @Delete("team/:userId") @Roles("OWNER") async remove(
    @Req() req: AuthedRequest,
    @Param("userId") userId: string,
  ) {
    idSchema.parse(userId);
    if (userId === req.userId)
      throw new BadRequestException(
        "You cannot remove your own owner membership.",
      );
    const deleted = await this.db.membership.deleteMany({
      where: {
        organizationId: req.organizationId,
        userId,
        role: { not: "OWNER" },
      },
    });
    if (!deleted.count)
      throw new NotFoundException("Non-owner member not found.");
    await this.db.auditLog.create({
      data: {
        organizationId: req.organizationId,
        actorId: req.userId,
        action: "team.removed",
        entityId: userId,
      },
    });
    return { ok: true };
  }
  @Get("activity") async activity(@Req() req: AuthedRequest) {
    return this.db.auditLog.findMany({
      where: { organizationId: req.organizationId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
}
@Module({
  imports: [AuthModule],
  controllers: [OrganizationsController, WorkspaceController],
  providers: [TenantGuard],
})
export class OrganizationsModule {}
