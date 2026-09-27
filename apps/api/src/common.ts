import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
  Global,
  Module,
  OnModuleDestroy,
  OnModuleInit,
  SetMetadata,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaClient, Role } from "@prisma/client";
import Redis from "ioredis";
import { Request, Response } from "express";
import { ZodError, z } from "zod";
import { randomUUID } from "node:crypto";
import { digest } from "../../../packages/core/security";
import { CreditError } from "../../../packages/core/credits";

export interface AuthedRequest extends Request {
  userId: string;
  sessionId: string;
  organizationId: string;
  role: Role;
  requestId: string;
}
export const Public = () => SetMetadata("public", true);
export const Roles = (...roles: Role[]) => SetMetadata("roles", roles);
export const parse = <S extends z.ZodTypeAny>(
  schema: S,
  body: unknown,
): z.output<S> => schema.parse(body);
export const idSchema = z.string().uuid();
export const safeUser = {
  id: true,
  name: true,
  email: true,
  verifiedAt: true,
} as const;
export const writerRoles: Role[] = ["OWNER", "ADMIN", "EDITOR", "CREATOR"];
export const approverRoles: Role[] = ["OWNER", "ADMIN", "EDITOR"];
export const origin = () => process.env.WEB_ORIGIN || "http://localhost:3000";
@Injectable()
export class Db extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
@Injectable()
export class Cache implements OnModuleDestroy {
  client = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
    maxRetriesPerRequest: 1,
  });
  constructor() {
    this.client.on("error", () => {});
  }
  async onModuleDestroy() {
    await this.client.quit();
  }
}
@Global()
@Module({ providers: [Db, Cache], exports: [Db, Cache] })
export class InfrastructureModule {}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private db: Db,
    private reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride("public", [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const raw = req.cookies?.mos_session;
    if (typeof raw !== "string" || !/^[a-f0-9]{64}$/.test(raw))
      throw new UnauthorizedException("Please sign in.");
    const session = await this.db.session.findUnique({
      where: { tokenHash: digest(raw) },
    });
    if (!session || session.expiresAt < new Date())
      throw new UnauthorizedException(
        "Your session expired. Please sign in again.",
      );
    req.userId = session.userId;
    req.sessionId = session.id;
    return true;
  }
}
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private db: Db,
    private reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const organizationId = idSchema.parse(req.params.organizationId);
    const member = await this.db.membership.findUnique({
      where: { userId_organizationId: { userId: req.userId, organizationId } },
    });
    if (!member) throw new NotFoundException("Workspace not found.");
    req.organizationId = organizationId;
    req.role = member.role;
    const allowed = this.reflector.getAllAndOverride<Role[]>("roles", [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed && !allowed.includes(member.role))
      throw new ForbiddenException("Your role does not allow this action.");
    return true;
  }
}
@Catch()
export class ApiErrors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const req = host.switchToHttp().getRequest<AuthedRequest>();
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500,
      message = "Something went wrong. Please try again.",
      issues;
    if (error instanceof ZodError) {
      status = 400;
      message = "Please check the highlighted information.";
      issues = error.flatten();
    } else if (error instanceof CreditError) {
      status = error.status;
      message = error.message;
    } else if (error instanceof HttpException) {
      status = error.getStatus();
      message = error.message;
    } else if ((error as any)?.code === "P2002") {
      status = 409;
      message = "This record already exists.";
    } else if ((error as any)?.code === "P2025") {
      status = 404;
      message = "Record not found.";
    }
    console.error(
      JSON.stringify({
        level: "error",
        requestId: req.requestId,
        status,
        type: (error as any)?.constructor?.name,
      }),
    );
    res
      .status(status)
      .json({ error: { message, issues, requestId: req.requestId } });
  }
}
export function installSecurity(app: any, cache: Cache) {
  app.use((req: AuthedRequest, res: Response, next: () => void) => {
    req.requestId = randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    const signedBillingWebhook = [
      "/api/billing/webhooks/test",
      "/api/billing/webhooks/stripe",
    ].includes(req.path);
    if (
      !signedBillingWebhook &&
      !["GET", "HEAD", "OPTIONS"].includes(req.method)
    ) {
      if (req.headers.origin && req.headers.origin !== origin())
        return res
          .status(403)
          .json({ error: { message: "Request origin is not allowed." } });
      if (req.headers["x-requested-with"] !== "MarketingOS")
        return res
          .status(403)
          .json({ error: { message: "Missing request verification header." } });
    }
    next();
  });
  app.use(async (req: Request, res: Response, next: () => void) => {
    if (req.path === "/api/health") return next();
    const auth = req.path.startsWith("/api/auth");
    const key = `rate:${auth ? "auth" : "api"}:${digest(req.ip || "unknown")}`;
    try {
      const count = Number(
        await cache.client.eval(
          "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
          1,
          key,
          60,
        ),
      );
      if (count > (auth ? 40 : 600)) {
        res.setHeader("Retry-After", "60");
        return res.status(429).json({
          error: { message: "Too many requests. Please wait a minute." },
        });
      }
      next();
    } catch {
      res.status(503).json({
        error: {
          message:
            "The service is temporarily unavailable. Please try again shortly.",
        },
      });
    }
  });
}
