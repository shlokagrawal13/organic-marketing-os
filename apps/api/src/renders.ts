import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  Module,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  Db,
  TenantGuard,
  AuthedRequest,
  Roles,
  writerRoles,
  approverRoles,
  idSchema,
} from "./common";
import {
  AssetsModule,
  MediaStorage,
  assertSceneAssets,
  streamStored,
} from "./assets";
import { draftSchema } from "../../../packages/core/ai";
import {
  renderOptions,
  validateRenderScenes,
  sha256,
} from "../../../packages/core/media";
const view = (job: any) => {
  const {
    outputKey,
    thumbnailKey,
    captionsKey,
    runToken,
    requestHash,
    ...safe
  } = job;
  return {
    ...safe,
    hasOutput: Boolean(outputKey),
    stale: job.content
      ? job.content.revision !== job.contentRevision
      : undefined,
  };
};
const relations = {
  content: { select: { title: true, revision: true, status: true } },
};
@Controller("workspaces/:organizationId/renders")
@UseGuards(TenantGuard)
export class RendersController {
  constructor(
    private db: Db,
    private store: MediaStorage,
  ) {}
  private async owned(org: string, id: string) {
    const job = await this.db.renderJob.findFirst({
      where: { id: idSchema.parse(id), organizationId: org },
      include: relations,
    });
    if (!job) throw new NotFoundException("Render not found.");
    return job;
  }
  private async limit(tx: any, org: string) {
    if (
      (await tx.renderJob.count({
        where: { organizationId: org, status: { in: ["QUEUED", "RUNNING"] } },
      })) >= 3
    )
      throw new BadRequestException(
        "This workspace already has 3 active renders. Wait for one to finish or cancel it.",
      );
    if (
      (await tx.renderJob.count({
        where: {
          organizationId: org,
          createdAt: { gte: new Date(Date.now() - 86400000) },
        },
      })) >= 60
    )
      throw new BadRequestException(
        "The workspace limit of 60 renders per 24 hours has been reached.",
      );
  }
  @Get() async list(@Req() req: AuthedRequest, @Query() query: unknown) {
    const q = z
      .object({ contentId: z.string().uuid().optional() })
      .parse(query);
    return (
      await this.db.renderJob.findMany({
        where: {
          organizationId: req.organizationId,
          ...(q.contentId ? { contentId: q.contentId } : {}),
        },
        include: relations,
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    ).map(view);
  }
  @Post() @Roles(...writerRoles) async create(
    @Req() req: AuthedRequest,
    @Body() body: unknown,
  ) {
    const data = z
      .object({
        contentId: z.string().uuid(),
        revision: z.number().int().positive(),
        requestKey: z.string().uuid(),
        options: renderOptions.default({}),
      })
      .strict()
      .parse(body);
    const requestHash = sha256(
      JSON.stringify({
        contentId: data.contentId,
        revision: data.revision,
        options: data.options,
      }),
    );
    const key = {
      organizationId_requestKey: {
        organizationId: req.organizationId,
        requestKey: data.requestKey,
      },
    };
    const existing = await this.db.renderJob.findUnique({
      where: key,
      include: relations,
    });
    if (existing) {
      if (existing.requestHash !== requestHash)
        throw new ConflictException(
          "This request key belongs to a different render.",
        );
      return view(existing);
    }
    try {
      await this.store.ready();
    } catch {
      throw new ServiceUnavailableException(
        "Media storage is unavailable. Start the storage service before rendering.",
      );
    }
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${req.organizationId} FOR UPDATE`;
      const duplicate = await tx.renderJob.findUnique({
        where: key,
        include: relations,
      });
      if (duplicate) {
        if (duplicate.requestHash !== requestHash)
          throw new ConflictException(
            "This request key belongs to a different render.",
          );
        return view(duplicate);
      }
      await this.limit(tx, req.organizationId);
      await tx.$queryRaw`SELECT id FROM "ContentItem" WHERE id=${data.contentId} AND "organizationId"=${req.organizationId} FOR UPDATE`;
      const content = await tx.contentItem.findFirst({
        where: { id: data.contentId, organizationId: req.organizationId },
      });
      if (!content) throw new NotFoundException("Content not found.");
      if (content.revision !== data.revision || content.status === "ARCHIVED")
        throw new ConflictException(
          "The content changed or was archived. Reload it before rendering.",
        );
      const snapshot = draftSchema.strip().parse(content);
      if (snapshot.format !== "Video")
        throw new BadRequestException(
          "Choose Video as the content format first.",
        );
      try {
        validateRenderScenes(snapshot.scenes, data.options);
      } catch (e) {
        throw new BadRequestException((e as Error).message);
      }
      const assets = await assertSceneAssets(
        tx,
        req.organizationId,
        snapshot.scenes,
        data.options.musicAssetId,
      );
      const job = await tx.renderJob.create({
        data: {
          organizationId: req.organizationId,
          contentId: content.id,
          contentRevision: content.revision,
          actorId: req.userId,
          requestKey: data.requestKey,
          requestHash,
          snapshot,
          options: data.options,
          totalScenes: snapshot.scenes.length,
          inputs: { create: assets.map((a: any) => ({ assetId: a.id })) },
        },
        include: relations,
      });
      await tx.auditLog.create({
        data: {
          organizationId: req.organizationId,
          actorId: req.userId,
          action: "render.queued",
          entityId: job.id,
          detail: { contentId: content.id, revision: content.revision },
        },
      });
      return view(job);
    });
  }
  @Get(":id") async get(@Req() req: AuthedRequest, @Param("id") id: string) {
    return view(await this.owned(req.organizationId, id));
  }
  @Post(":id/cancel") @Roles(...writerRoles) async cancel(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
  ) {
    await this.owned(req.organizationId, id);
    return this.db.$transaction(async (tx) => {
      const changed = await tx.renderJob.updateMany({
        where: {
          id,
          organizationId: req.organizationId,
          status: { in: ["QUEUED", "RUNNING"] },
        },
        data: {
          status: "CANCELED",
          stage: "Canceled",
          completedAt: new Date(),
        },
      });
      if (!changed.count)
        throw new ConflictException("This render has already finished.");
      await tx.auditLog.create({
        data: {
          organizationId: req.organizationId,
          actorId: req.userId,
          action: "render.canceled",
          entityId: id,
        },
      });
      return { ok: true };
    });
  }
  @Post(":id/retry") @Roles(...writerRoles) async retry(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const { requestKey } = z
        .object({ requestKey: z.string().uuid() })
        .strict()
        .parse(body),
      job = await this.owned(req.organizationId, id);
    if (!["FAILED", "CANCELED"].includes(job.status))
      throw new ConflictException(
        "Only failed or canceled renders can be retried.",
      );
    const requestHash = sha256(`retry:${id}`);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${req.organizationId} FOR UPDATE`;
      const key = {
        organizationId_requestKey: {
          organizationId: req.organizationId,
          requestKey,
        },
      };
      const existing = await tx.renderJob.findUnique({
        where: key,
        include: relations,
      });
      if (existing) {
        if (existing.requestHash !== requestHash)
          throw new ConflictException("Request key already used.");
        return view(existing);
      }
      await this.limit(tx, req.organizationId);
      const input = await tx.renderInput.findMany({
        where: { renderId: job.id },
      });
      const next = await tx.renderJob.create({
        data: {
          organizationId: req.organizationId,
          contentId: job.contentId,
          contentRevision: job.contentRevision,
          actorId: req.userId,
          requestKey,
          requestHash,
          snapshot: job.snapshot as any,
          options: job.options as any,
          totalScenes: job.totalScenes,
          inputs: { create: input.map((a) => ({ assetId: a.assetId })) },
        },
        include: relations,
      });
      await tx.auditLog.create({
        data: {
          organizationId: req.organizationId,
          actorId: req.userId,
          action: "render.retried",
          entityId: next.id,
          detail: { previousRenderId: id },
        },
      });
      return view(next);
    });
  }
  @Post(":id/approve") @Roles(...approverRoles) async approve(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    z.object({ reviewed: z.literal(true) })
      .strict()
      .parse(body);
    const job = await this.owned(req.organizationId, id);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ContentItem" WHERE id=${job.contentId} AND "organizationId"=${req.organizationId} FOR UPDATE`;
      const content = await tx.contentItem.findFirstOrThrow({
        where: { id: job.contentId, organizationId: req.organizationId },
      });
      if (
        content.revision !== job.contentRevision ||
        content.status !== "APPROVED"
      )
        throw new ConflictException(
          "Approve the matching content revision first. Changed content requires a new render.",
        );
      const changed = await tx.renderJob.updateMany({
        where: {
          id,
          organizationId: req.organizationId,
          status: "SUCCEEDED",
          outputKey: { not: null },
          approvedAt: null,
        },
        data: { approvedAt: new Date(), approvedBy: req.userId },
      });
      if (!changed.count)
        throw new ConflictException(
          "This render is not ready for approval or has already been approved.",
        );
      await tx.auditLog.create({
        data: {
          organizationId: req.organizationId,
          actorId: req.userId,
          action: "render.approved",
          entityId: id,
          detail: { revision: job.contentRevision, reviewed: true },
        },
      });
      return { ok: true };
    });
  }
  @Get(":id/file/:kind") async file(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Param("kind") kind: string,
    @Res() res: Response,
  ) {
    const job = await this.owned(req.organizationId, id);
    if (job.status !== "SUCCEEDED" || !job.outputKey)
      throw new NotFoundException("This render has no finished file.");
    const part = z.enum(["video", "thumbnail", "captions"]).parse(kind);
    if (part === "video")
      return streamStored(
        this.store,
        req,
        res,
        job.outputKey,
        "video/mp4",
        `marketing-${id.slice(0, 8)}.mp4`,
        job.outputBytes!,
      );
    const key = part === "thumbnail" ? job.thumbnailKey : job.captionsKey;
    if (!key) throw new NotFoundException("File unavailable.");
    let bytes: Buffer;
    try {
      bytes = await this.store.read(key, 5 * 1024 * 1024);
    } catch {
      throw new ServiceUnavailableException("Stored file unavailable.");
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader(
      "Content-Type",
      part === "thumbnail"
        ? "image/jpeg"
        : "application/x-subrip; charset=utf-8",
    );
    res.setHeader(
      "Content-Disposition",
      `${part === "captions" || req.query.download === "1" ? "attachment" : "inline"}; filename="${part === "thumbnail" ? "thumbnail.jpg" : "captions.srt"}"`,
    );
    res.send(bytes);
  }
}
@Module({ imports: [AssetsModule], controllers: [RendersController] })
export class RendersModule {}
