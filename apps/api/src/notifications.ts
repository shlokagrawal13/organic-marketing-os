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

export const NOTIFICATION_ROLES: Role[] = [
  "OWNER",
  "ADMIN",
  "EDITOR",
  "CREATOR",
  "ANALYST",
];

export async function createRenderNotification(
  client: PrismaClient | Prisma.TransactionClient,
  params: {
    organizationId: string;
    renderId: string;
    actorId?: string | null;
    status: "SUCCEEDED" | "FAILED" | "CANCELED";
    contentTitle?: string | null;
    error?: string | null;
  },
) {
  const eventKey = `render:${params.renderId}:${params.status}`;
  const isSuccess = params.status === "SUCCEEDED";
  const isCanceled = params.status === "CANCELED";
  const title = isSuccess
    ? "Render complete"
    : isCanceled
      ? "Render canceled"
      : "Render failed";
  const contentSnippet = params.contentTitle
    ? ` for "${params.contentTitle}"`
    : "";
  const body = isSuccess
    ? `Video render${contentSnippet} is ready for review.`
    : isCanceled
      ? `Video render${contentSnippet} was canceled.`
      : params.error
        ? `Video render${contentSnippet} failed: ${params.error}`
        : `Video render${contentSnippet} failed.`;

  return client.notification.upsert({
    where: {
      organizationId_eventKey: {
        organizationId: params.organizationId,
        eventKey,
      },
    },
    create: {
      organizationId: params.organizationId,
      userId: params.actorId ?? undefined,
      type: `RENDER_${params.status}`,
      category: "RENDER",
      title,
      body,
      link: `/workspaces/${params.organizationId}/renders/${params.renderId}`,
      entityType: "RENDER_JOB",
      entityId: params.renderId,
      eventKey,
      data: {
        renderId: params.renderId,
        status: params.status,
        ...(params.error ? { error: params.error } : {}),
      },
    },
    update: {},
  });
}

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

  @Post("read-all")
  async readAll(@Req() req: AuthedRequest) {
    const isElevated = ["OWNER", "ADMIN"].includes(req.role);
    const userScope: Prisma.NotificationWhereInput = isElevated
      ? {}
      : { OR: [{ userId: req.userId }, { userId: null }] };

    const where: Prisma.NotificationWhereInput = {
      organizationId: req.organizationId,
      readAt: null,
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
    return this.db.notification.update({
      where: { id: notification.id },
      data: {
        readAt: new Date(),
        readBy: req.userId,
      },
    });
  }
}

@Module({
  controllers: [NotificationsController],
})
export class NotificationsModule {}

