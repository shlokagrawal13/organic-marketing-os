import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  UseGuards,
  Module,
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import {
  Db,
  TenantGuard,
  AuthedRequest,
  Roles,
  parse,
  idSchema,
} from "./common";
import {
  creditPolicy,
  grantCredits,
  settleCredits,
} from "../../../packages/core/credits";

export function configuredPlatformAdmin(userId: string) {
  return (process.env.PLATFORM_ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}
@Injectable()
class PlatformGuard implements CanActivate {
  constructor(private db: Db) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (
      !configuredPlatformAdmin(req.userId) ||
      !(
        await this.db.user.findUnique({
          where: { id: req.userId },
          select: { verifiedAt: true },
        })
      )?.verifiedAt
    )
      throw new ForbiddenException(
        "Verified platform administrator access is required.",
      );
    return true;
  }
}
@Controller("platform/access")
class PlatformAccessController {
  constructor(private db: Db) {}
  @Get() async access(@Req() req: AuthedRequest) {
    return {
      allowed:
        configuredPlatformAdmin(req.userId) &&
        Boolean(
          (
            await this.db.user.findUnique({
              where: { id: req.userId },
              select: { verifiedAt: true },
            })
          )?.verifiedAt,
        ),
    };
  }
}
@Controller("workspaces/:organizationId/credits")
@UseGuards(TenantGuard)
@Roles("OWNER", "ADMIN", "ANALYST")
class CreditController {
  constructor(private db: Db) {}
  @Get() async summary(@Req() req: AuthedRequest) {
    const [account, reservations] = await Promise.all([
      this.db.creditAccount.findUnique({
        where: { organizationId: req.organizationId },
      }),
      this.db.creditReservation.findMany({
        where: {
          organizationId: req.organizationId,
          state: { in: ["RESERVED", "REVIEW"] },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    return {
      ...creditPolicy(),
      available: account?.available || 0,
      reserved: account?.reserved || 0,
      reservations,
      paymentsConfigured: false,
      purchasedCreditsSupported: false,
    };
  }
  @Get("entries") async entries(
    @Req() req: AuthedRequest,
    @Query("before") before?: string,
  ) {
    const cursor =
      before === undefined
        ? undefined
        : z.coerce.number().int().min(1).parse(before);
    const rows = await this.db.creditEntry.findMany({
      where: {
        organizationId: req.organizationId,
        ...(cursor ? { sequence: { lt: cursor } } : {}),
      },
      orderBy: { sequence: "desc" },
      take: 51,
    });
    return {
      items: rows
        .slice(0, 50)
        .map(({ requestHash, operationKey, ...row }) => row),
      nextBefore: rows.length > 50 ? rows[49].sequence : null,
    };
  }
}
@Controller("platform/credits")
@UseGuards(PlatformGuard)
class PlatformCreditController {
  constructor(private db: Db) {}
  @Post(":organizationId/adjust") async adjust(
    @Req() req: AuthedRequest,
    @Param("organizationId") organizationId: string,
    @Body() body: unknown,
  ) {
    idSchema.parse(organizationId);
    const data = parse(
      z
        .object({
          requestKey: z.string().uuid(),
          amount: z
            .number()
            .int()
            .min(-1_000_000)
            .max(1_000_000)
            .refine((n) => n !== 0),
          reason: z.string().trim().min(10).max(1000),
        })
        .strict(),
      body,
    );
    return this.db.$transaction(async (tx) => {
      const entry = await grantCredits(
        tx,
        organizationId,
        data.amount,
        data.requestKey,
        data.reason,
        req.userId,
      );
      // An idempotent replay does not duplicate the financial entry or its audit.
      const audited = await tx.auditLog.findFirst({
        where: {
          organizationId,
          action: "credits.adjusted",
          entityId: entry.id,
        },
        select: { id: true },
      });
      if (!audited)
        await tx.auditLog.create({
          data: {
            organizationId,
            actorId: req.userId,
            action: "credits.adjusted",
            entityId: entry.id,
            detail: { amount: data.amount, reason: data.reason },
          },
        });
      return {
        id: entry.id,
        available: entry.availableAfter,
        reserved: entry.reservedAfter,
      };
    });
  }
  @Post("reservations/:id/resolve") async resolve(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    idSchema.parse(id);
    const data = parse(
      z
        .object({
          consumed: z.number().int().min(0).max(10000),
          reason: z.string().trim().min(10).max(1000),
        })
        .strict(),
      body,
    );
    const reservation = await this.db.creditReservation.findUnique({
      where: { id },
    });
    if (!reservation) throw new NotFoundException("Reservation not found.");
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${reservation.organizationId} FOR UPDATE`;
      const current = await tx.creditReservation.findUniqueOrThrow({
        where: { id },
        include: { job: { select: { status: true } } },
      });
      if (
        current.state === "RESERVED" ||
        current.job?.status === "QUEUED" ||
        current.job?.status === "RUNNING"
      )
        throw new ConflictException(
          "Wait for the job to finish before resolving its credits.",
        );
      const result = await settleCredits(
        tx,
        reservation.organizationId,
        id,
        data.consumed,
        data.reason,
        req.userId,
      );
      if (current.state === "REVIEW")
        await tx.auditLog.create({
          data: {
            organizationId: reservation.organizationId,
            actorId: req.userId,
            action: "credits.review_resolved",
            entityId: id,
            detail: { consumed: data.consumed, reason: data.reason },
          },
        });
      return result;
    });
  }
}
@Module({
  controllers: [
    CreditController,
    PlatformAccessController,
    PlatformCreditController,
  ],
  providers: [TenantGuard, PlatformGuard],
})
export class CreditsModule {}
