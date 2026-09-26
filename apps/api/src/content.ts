import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Req,
  UseGuards,
  Module,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { z } from "zod";
import {
  Db,
  TenantGuard,
  AuthedRequest,
  Roles,
  parse,
  writerRoles,
  approverRoles,
  idSchema,
} from "./common";
import { contentInput, checkContent } from "../../../packages/core/content";
import { draftSchema } from "../../../packages/core/ai";
import { assertSceneAssets } from "./assets";
const change = z.object({ revision: z.number().int().positive() }).strict();
@Controller("workspaces/:organizationId/content")
@UseGuards(TenantGuard)
export class ContentController {
  constructor(private db: Db) {}
  private async owned(org: string, id: string) {
    idSchema.parse(id);
    const row = await this.db.contentItem.findFirst({
      where: { id, organizationId: org },
    });
    if (!row) throw new NotFoundException("Content not found.");
    return row;
  }
  private async campaign(
    tx: any,
    organizationId: string,
    campaignId: string | null,
  ) {
    if (
      campaignId &&
      !(await tx.campaign.findFirst({
        where: { id: campaignId, organizationId },
      }))
    )
      throw new BadRequestException("Choose a campaign in this workspace.");
  }
  @Get() async list(@Req() req: AuthedRequest, @Query() query: unknown) {
    const q = parse(
      z.object({
        q: z.string().max(300).optional(),
        status: z.enum(["DRAFT", "REVIEW", "APPROVED", "ARCHIVED"]).optional(),
        skip: z.coerce.number().int().min(0).default(0),
        take: z.coerce.number().int().min(1).max(100).default(50),
      }),
      query,
    );
    let ids: string[] | undefined;
    if (q.q) {
      const results = await this.db.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "ContentItem" WHERE "organizationId" = ${req.organizationId} AND to_tsvector('simple',title || ' ' || body || ' ' || hook) @@ plainto_tsquery('simple',${q.q}) LIMIT 1000`;
      ids = results.map((r) => r.id);
    }
    const where = {
      organizationId: req.organizationId,
      ...(q.status
        ? { status: q.status }
        : { status: { not: "ARCHIVED" as const } }),
      ...(ids ? { id: { in: ids } } : {}),
    };
    const [items, total] = await Promise.all([
      this.db.contentItem.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: q.skip,
        take: q.take,
        include: { campaign: { select: { name: true } } },
      }),
      this.db.contentItem.count({ where }),
    ]);
    return { items, total };
  }
  @Post() @Roles(...writerRoles) async create(
    @Req() req: AuthedRequest,
    @Body() body: unknown,
  ) {
    const data = parse(contentInput, body);
    return this.db.$transaction(async (tx) => {
      await this.campaign(tx, req.organizationId, data.campaignId);
      await assertSceneAssets(tx, req.organizationId, data.scenes);
      const row = await tx.contentItem.create({
        data: {
          ...data,
          plannedAt: data.plannedAt ? new Date(data.plannedAt) : null,
          organizationId: req.organizationId,
          createdBy: req.userId,
        },
      });
      await tx.contentVersion.create({
        data: {
          contentId: row.id,
          revision: row.revision,
          actorId: req.userId,
          snapshot: data,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: req.organizationId,
          actorId: req.userId,
          action: "content.created",
          entityId: row.id,
        },
      });
      return row;
    });
  }
  @Get(":id") async get(@Req() req: AuthedRequest, @Param("id") id: string) {
    const item = await this.owned(req.organizationId, id);
    return {
      item,
      quality: checkContent(draftSchema.strip().parse(item)),
      versions: await this.db.contentVersion.findMany({
        where: { contentId: id },
        orderBy: { revision: "desc" },
        take: 50,
      }),
      comments: await this.db.contentComment.findMany({
        where: { contentId: id },
        orderBy: { createdAt: "asc" },
        take: 200,
      }),
    };
  }
  @Put(":id") @Roles(...writerRoles) async update(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    idSchema.parse(id);
    const { revision, ...data } = parse(
      contentInput.extend({ revision: z.number().int().positive() }),
      body,
    );
    return this.db.$transaction(async (tx) => {
      await this.campaign(tx, req.organizationId, data.campaignId);
      await assertSceneAssets(tx, req.organizationId, data.scenes);
      const result = await tx.contentItem.updateMany({
        where: {
          id,
          organizationId: req.organizationId,
          revision,
          status: { not: "ARCHIVED" },
        },
        data: {
          ...data,
          plannedAt: data.plannedAt ? new Date(data.plannedAt) : null,
          revision: { increment: 1 },
          status: "DRAFT",
          approvedAt: null,
          approvedBy: null,
        },
      });
      if (!result.count)
        throw new ConflictException(
          "Content changed or is archived. Reload before editing.",
        );
      await tx.renderJob.updateMany({
        where: {
          contentId: id,
          organizationId: req.organizationId,
          approvedAt: { not: null },
        },
        data: { approvedAt: null, approvedBy: null },
      });
      const row = await tx.contentItem.findFirstOrThrow({
        where: { id, organizationId: req.organizationId },
      });
      await tx.contentVersion.create({
        data: {
          contentId: id,
          revision: row.revision,
          snapshot: data,
          actorId: req.userId,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: req.organizationId,
          actorId: req.userId,
          action: "content.edited",
          entityId: id,
          detail: { revision: row.revision },
        },
      });
      return row;
    });
  }
  @Post(":id/review") @Roles(...writerRoles) async review(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const data = parse(change, body),
      row = await this.owned(req.organizationId, id);
    if (row.revision !== data.revision)
      throw new ConflictException(
        "Content changed. Reload before requesting review.",
      );
    const quality = checkContent(draftSchema.strip().parse(row));
    if (!quality.passed)
      throw new BadRequestException(
        "Resolve the blocking content checks before requesting review.",
      );
    return this.transition(
      req,
      id,
      data.revision,
      "DRAFT",
      "REVIEW",
      "content.review_requested",
    );
  }
  private async transition(
    req: AuthedRequest,
    id: string,
    revision: number,
    from: any,
    to: any,
    action: string,
    detail: any = {},
  ) {
    return this.db.$transaction(async (tx) => {
      const r = await tx.contentItem.updateMany({
        where: {
          id,
          organizationId: req.organizationId,
          revision,
          status: from,
        },
        data: {
          status: to,
          ...(to === "APPROVED"
            ? { approvedBy: req.userId, approvedAt: new Date() }
            : {}),
          ...(to !== "APPROVED" ? { approvedBy: null, approvedAt: null } : {}),
        },
      });
      if (!r.count)
        throw new ConflictException(
          "Content changed or is not in the required state. Reload and try again.",
        );
      if (to !== "APPROVED")
        await tx.renderJob.updateMany({
          where: {
            contentId: id,
            organizationId: req.organizationId,
            approvedAt: { not: null },
          },
          data: { approvedAt: null, approvedBy: null },
        });
      await tx.auditLog.create({
        data: {
          organizationId: req.organizationId,
          actorId: req.userId,
          action,
          entityId: id,
          detail: { ...detail, revision },
        },
      });
      return { ok: true };
    });
  }
  @Post(":id/approve") @Roles(...approverRoles) async approve(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const data = parse(
      z
        .object({
          revision: z.number().int().positive(),
          factsAndRightsReviewed: z.literal(true),
        })
        .strict(),
      body,
    );
    const row = await this.owned(req.organizationId, id);
    if (row.revision !== data.revision)
      throw new ConflictException("Content changed. Reload before approving.");
    if (!checkContent(draftSchema.strip().parse(row)).passed)
      throw new BadRequestException(
        "Content did not pass its structural checks.",
      );
    return this.transition(
      req,
      id,
      data.revision,
      "REVIEW",
      "APPROVED",
      "content.approved",
      { factsAndRightsReviewed: true },
    );
  }
  @Post(":id/reject") @Roles(...approverRoles) async reject(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const data = parse(
      z
        .object({
          revision: z.number().int().positive(),
          feedback: z.string().trim().min(3).max(4000),
        })
        .strict(),
      body,
    );
    await this.owned(req.organizationId, id);
    return this.transition(
      req,
      id,
      data.revision,
      "REVIEW",
      "DRAFT",
      "content.rejected",
      { feedback: data.feedback },
    );
  }
  @Post(":id/archive") @Roles(...writerRoles) async archive(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const data = parse(change, body);
    const row = await this.owned(req.organizationId, id);
    return this.transition(
      req,
      id,
      data.revision,
      row.status,
      "ARCHIVED",
      "content.archived",
    );
  }
  @Post(":id/comments") async comment(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const data = parse(
      z
        .object({
          text: z.string().trim().min(1).max(4000),
          sceneId: z.string().max(100).optional(),
        })
        .strict(),
      body,
    );
    const row = await this.owned(req.organizationId, id);
    if (
      data.sceneId &&
      !(row.scenes as any[]).some((s) => s.id === data.sceneId)
    )
      throw new BadRequestException("Scene not found.");
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: req.userId },
    });
    return this.db.contentComment.create({
      data: {
        contentId: id,
        actorId: req.userId,
        authorName: user.name,
        ...data,
      },
    });
  }
  @Post(":id/restore/:version") @Roles(...writerRoles) async restore(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Param("version") version: string,
    @Body() body: unknown,
  ) {
    await this.owned(req.organizationId, id);
    const data = parse(change, body);
    const n = z.coerce.number().int().positive().parse(version);
    const row = await this.db.contentVersion.findUnique({
      where: { contentId_revision: { contentId: id, revision: n } },
    });
    if (!row) throw new NotFoundException("Version not found.");
    return this.update(req, id, {
      ...(row.snapshot as any),
      revision: data.revision,
    });
  }
}
const campaignSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    goal: z.string().trim().min(3).max(4000),
    audience: z.string().max(4000).default(""),
    description: z.string().max(4000).default(""),
    startsAt: z.string().datetime().nullable().default(null),
    endsAt: z.string().datetime().nullable().default(null),
  })
  .strict()
  .refine(
    (d) => !d.startsAt || !d.endsAt || d.startsAt <= d.endsAt,
    "Campaign end must be after its start.",
  );
@Controller("workspaces/:organizationId/campaigns")
@UseGuards(TenantGuard)
export class CampaignsController {
  constructor(private db: Db) {}
  @Get() list(@Req() req: AuthedRequest) {
    return this.db.campaign.findMany({
      where: { organizationId: req.organizationId },
      include: { _count: { select: { content: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  @Post() @Roles(...writerRoles) async create(
    @Req() req: AuthedRequest,
    @Body() body: unknown,
  ) {
    const data = parse(campaignSchema, body);
    return this.db.$transaction(async (tx) => {
      const row = await tx.campaign.create({
        data: { ...data, organizationId: req.organizationId },
      });
      await tx.auditLog.create({
        data: {
          organizationId: req.organizationId,
          actorId: req.userId,
          action: "campaign.created",
          entityId: row.id,
        },
      });
      return row;
    });
  }
}
@Module({
  controllers: [ContentController, CampaignsController],
  providers: [TenantGuard],
})
export class ContentModule {}
