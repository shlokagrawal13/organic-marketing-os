import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Req,
  UseGuards,
  Module,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { Prisma, PrismaClient, Role } from "@prisma/client";
import { z } from "zod";
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
});

@Controller("workspaces/:organizationId/notifications")
@UseGuards(TenantGuard)
@Roles(...NOTIFICATION_ROLES)
export class NotificationsController {
  constructor(private db: Db) {}

  private async owned(org: string, id: string, req: AuthedRequest) {
    const notification = await this.db.notification.findFirst({
      where: { id: idSchema.parse(id), organizationId: org },
    });
    if (!notification) {
      throw new NotFoundException("Notification not found.");
    }
    const isElevated = ["OWNER", "ADMIN"].includes(req.role);
    if (!isElevated && notification.userId && notification.userId !== req.userId) {
      throw new ForbiddenException("You cannot access this notification.");
    }
    return notification;
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

    const where: Prisma.NotificationWhereInput = {
      organizationId: req.organizationId,
      ...(q.unreadOnly === "true" ? { readAt: null } : {}),
      ...(q.category ? { category: q.category } : {}),
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

