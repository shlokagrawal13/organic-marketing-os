import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  Req,
  Sse,
  MessageEvent,
  UseGuards,
  Module,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { Prisma, PrismaClient, Role } from "@prisma/client";
import { z } from "zod";
import { Observable, defer, of, timer } from "rxjs";
import {
  catchError,
  distinctUntilChanged,
  map,
  switchMap,
  takeUntil,
} from "rxjs/operators";
import {
  Db,
  TenantGuard,
  AuthedRequest,
  Roles,
  idSchema,
  parse,
} from "./common";
import { NOTIFICATION_ROLES } from "./notification-events";

export * from "./notification-events";

const listQuerySchema = z.object({
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().min(1).max(100).default(50),
  unreadOnly: z.enum(["true", "false"]).optional(),
  category: z.string().max(50).optional(),
  mine: z.enum(["true", "false"]).optional(),
  includeMuted: z.enum(["true", "false"]).optional(),
});

const notificationPreferencesSchema = z.object({
  mutedCategories: z.array(z.string().max(50)).max(20),
});

const NOTIFICATION_STREAM_POLL_MS = 2000;
const NOTIFICATION_STREAM_MAX_MS = 60000;

export type NotificationStreamSnapshot = {
  cursor: string | null;
  total: number;
  unreadCount: number;
};

export function notificationStreamCursor(
  latest: { id: string; createdAt: Date } | null,
) {
  return latest ? `${latest.createdAt.toISOString()}:${latest.id}` : null;
}

@Controller("workspaces/:organizationId/notifications")
@UseGuards(TenantGuard)
@Roles(...NOTIFICATION_ROLES)
export class NotificationsController {
  constructor(private db: Db) {}

  private userScope(req: AuthedRequest): Prisma.NotificationWhereInput {
    const isElevated = ["OWNER", "ADMIN"].includes(req.role);
    return isElevated
      ? {}
      : { OR: [{ userId: req.userId }, { userId: null }] };
  }

  private async streamSnapshot(
    req: AuthedRequest,
  ): Promise<NotificationStreamSnapshot> {
    const muted = await this.getUserMutedCategories(
      req.organizationId,
      req.userId,
    );
    const where: Prisma.NotificationWhereInput = {
      organizationId: req.organizationId,
      ...this.userScope(req),
      ...(muted.length > 0 ? { category: { notIn: muted } } : {}),
    };
    const [latest, total, unreadCount] = await Promise.all([
      this.db.notification.findFirst({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true, createdAt: true },
      }),
      this.db.notification.count({ where }),
      this.db.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return {
      cursor: notificationStreamCursor(latest),
      total,
      unreadCount,
    };
  }

  private async owned(org: string, id: string, req: AuthedRequest) {
    const notification = await this.db.notification.findFirst({
      where: { id: idSchema.parse(id), organizationId: org },
    });
    if (!notification) {
      throw new NotFoundException("Notification not found.");
    }
    const isElevated = ["OWNER", "ADMIN"].includes(req.role);
    if (
      !isElevated &&
      notification.userId &&
      notification.userId !== req.userId
    ) {
      throw new ForbiddenException("You cannot access this notification.");
    }
    return notification;
  }

  private async getUserMutedCategories(
    org: string,
    userId: string,
  ): Promise<string[]> {
    const latest = await this.db.auditLog.findFirst({
      where: {
        organizationId: org,
        actorId: userId,
        action: "notifications.preferences.updated",
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (latest && latest.detail && typeof latest.detail === "object") {
      const muted = (latest.detail as any).mutedCategories;
      if (Array.isArray(muted)) {
        return muted;
      }
    }
    return [];
  }

  @Get()
  async list(@Req() req: AuthedRequest, @Query() query: unknown) {
    const q = parse(listQuerySchema, query);
    const isElevated = ["OWNER", "ADMIN"].includes(req.role);

    const userScope: Prisma.NotificationWhereInput = isElevated
      ? q.mine === "true"
        ? { userId: req.userId }
        : {}
      : { OR: [{ userId: req.userId }, { userId: null }] };

    let categoryFilter: Prisma.NotificationWhereInput = {};
    if (q.category) {
      categoryFilter = { category: q.category };
    } else if (q.includeMuted !== "true") {
      const muted = await this.getUserMutedCategories(
        req.organizationId,
        req.userId,
      );
      if (muted.length > 0) {
        categoryFilter = { category: { notIn: muted } };
      }
    }

    const where: Prisma.NotificationWhereInput = {
      organizationId: req.organizationId,
      ...(q.unreadOnly === "true" ? { readAt: null } : {}),
      ...categoryFilter,
      ...userScope,
    };

    const items = await this.db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: q.skip,
      take: q.take,
    });
    const total = await this.db.notification.count({ where });
    const unreadCount = await this.db.notification.count({
      where: { ...where, readAt: null },
    });

    return {
      items,
      total,
      unreadCount,
      skip: q.skip,
      take: q.take,
    };
  }

  @Sse("stream")
  stream(@Req() req: AuthedRequest): Observable<MessageEvent> {
    return timer(0, NOTIFICATION_STREAM_POLL_MS).pipe(
      switchMap(() => defer(() => this.streamSnapshot(req))),
      distinctUntilChanged(
        (left, right) =>
          left.cursor === right.cursor &&
          left.total === right.total &&
          left.unreadCount === right.unreadCount,
      ),
      map((data) => ({ type: "notification", data })),
      takeUntil(timer(NOTIFICATION_STREAM_MAX_MS)),
      catchError(() =>
        of({
          type: "notification-error",
          data: { retryAfterMs: NOTIFICATION_STREAM_POLL_MS },
        }),
      ),
    );
  }

  @Get("summary")
  async summary(
    @Req() req: AuthedRequest,
    @Query("includeMuted") includeMutedQuery?: string,
  ) {
    const isElevated = ["OWNER", "ADMIN"].includes(req.role);
    const userScope: Prisma.NotificationWhereInput = isElevated
      ? {}
      : { OR: [{ userId: req.userId }, { userId: null }] };

    const mutedCategories = await this.getUserMutedCategories(
      req.organizationId,
      req.userId,
    );
    let categoryFilter: Prisma.NotificationWhereInput = {};
    if (includeMutedQuery !== "true" && mutedCategories.length > 0) {
      categoryFilter = { category: { notIn: mutedCategories } };
    }

    const whereUnread: Prisma.NotificationWhereInput = {
      organizationId: req.organizationId,
      readAt: null,
      ...categoryFilter,
      ...userScope,
    };

    const [totalUnread, grouped] = await Promise.all([
      this.db.notification.count({ where: whereUnread }),
      this.db.notification.groupBy({
        by: ["category"],
        where: whereUnread,
        _count: { id: true },
      }),
    ]);

    const byCategory: Record<string, number> = {};
    for (const g of grouped) {
      byCategory[g.category] = g._count.id;
    }

    return {
      organizationId: req.organizationId,
      totalUnread,
      byCategory,
      mutedCategories,
    };
  }

  @Get("preferences")
  async getPreferences(@Req() req: AuthedRequest) {
    const latest = await this.db.auditLog.findFirst({
      where: {
        organizationId: req.organizationId,
        actorId: req.userId,
        action: "notifications.preferences.updated",
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const mutedCategories =
      latest && Array.isArray((latest.detail as any)?.mutedCategories)
        ? (latest.detail as any).mutedCategories
        : [];
    return {
      organizationId: req.organizationId,
      userId: req.userId,
      mutedCategories,
      updatedAt: latest?.createdAt ?? null,
    };
  }

  @Put("preferences")
  async updatePreferencesPut(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.savePreferences(req, body);
  }

  @Patch("preferences")
  async updatePreferencesPatch(
    @Req() req: AuthedRequest,
    @Body() body: unknown,
  ) {
    return this.savePreferences(req, body);
  }

  private async savePreferences(req: AuthedRequest, body: unknown) {
    const input = parse(notificationPreferencesSchema, body ?? {});
    const now = new Date();
    await this.db.auditLog.create({
      data: {
        organizationId: req.organizationId,
        actorId: req.userId,
        action: "notifications.preferences.updated",
        entityId: req.userId,
        detail: {
          mutedCategories: input.mutedCategories,
          updatedAt: now.toISOString(),
        },
      },
    });
    return {
      organizationId: req.organizationId,
      userId: req.userId,
      mutedCategories: input.mutedCategories,
      updatedAt: now,
    };
  }

  @Get(":id")
  async get(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.owned(req.organizationId, id, req);
  }

  @Post(":id/read")
  async markReadPost(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.acknowledge(req, id);
  }

  @Patch(":id/read")
  async markReadPatch(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.acknowledge(req, id);
  }

  @Post(":id/unread")
  async markUnreadPost(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.markUnread(req, id);
  }

  @Patch(":id/unread")
  async markUnreadPatch(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.markUnread(req, id);
  }

  @Post("read-all")
  async readAll(
    @Req() req: AuthedRequest,
    @Query("category") category?: string,
  ) {
    const isElevated = ["OWNER", "ADMIN"].includes(req.role);
    const userScope: Prisma.NotificationWhereInput = isElevated
      ? {}
      : { OR: [{ userId: req.userId }, { userId: null }] };

    const where: Prisma.NotificationWhereInput = {
      organizationId: req.organizationId,
      readAt: null,
      ...(category ? { category } : {}),
      ...userScope,
    };

    const result = await this.db.notification.updateMany({
      where,
      data: {
        readAt: new Date(),
        readBy: req.userId,
      },
    });

    return { acknowledged: result.count };
  }

  private async acknowledge(req: AuthedRequest, id: string) {
    const notification = await this.owned(req.organizationId, id, req);
    if (notification.readAt) {
      return notification;
    }
    await this.db.notification.updateMany({
      where: {
        id: notification.id,
        organizationId: req.organizationId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
        readBy: req.userId,
      },
    });
    return this.owned(req.organizationId, id, req);
  }

  private async markUnread(req: AuthedRequest, id: string) {
    const notification = await this.owned(req.organizationId, id, req);
    if (!notification.readAt) {
      return notification;
    }
    await this.db.notification.updateMany({
      where: {
        id: notification.id,
        organizationId: req.organizationId,
        readAt: { not: null },
      },
      data: {
        readAt: null,
        readBy: null,
      },
    });
    return this.owned(req.organizationId, id, req);
  }
}

@Module({
  controllers: [NotificationsController],
})
export class NotificationsModule {}
