import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  Module,
  UseGuards,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  HttpException,
} from "@nestjs/common";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { MediaGeneration } from "@prisma/client";
import {
  Db,
  Cache,
  TenantGuard,
  AuthedRequest,
  Roles,
  writerRoles,
  idSchema,
} from "./common";
import { AssetsModule, MediaStorage, assertSceneAssets } from "./assets";
import { generationRequestSchema } from "../../../packages/core/generated-media";
import {
  MediaPlan,
  mediaConfiguration,
  mediaOptionCatalog,
  mediaPreset,
  mediaPricing,
  validateMediaPreset,
} from "../../../packages/core/openai-media";
import {
  creditPolicy,
  reserveCredits,
  settleCredits,
} from "../../../packages/core/credits";
import { sceneSchema } from "../../../packages/core/ai";
import { sha256 } from "../../../packages/core/media";
import { stableJson } from "../../../packages/core/requests";

const createSchema = z
  .object({
    requestKey: z.string().uuid(),
    request: generationRequestSchema,
    maxCredits: z.number().int().min(0).max(10000),
  })
  .strict();
const activeStates = [
  "QUEUED",
  "SUBMITTING",
  "PENDING",
  "OUTPUT_READY",
] as const;
export function publicGeneration(row: MediaGeneration) {
  const request = generationRequestSchema.parse(row.request);
  const {
    outputKey,
    runToken,
    heartbeatAt,
    requestHash,
    configuration,
    ...safe
  } = row;
  return {
    ...safe,
    provider: "openai",
    preset: mediaPreset(request),
    costStatus: row.actualCostUsd === null ? "unknown" : "reported",
    cancellationNotice:
      row.cancellationRequestedAt && row.state !== "CANCELED"
        ? "The provider request may still complete and incur a charge. No automatic refund is assumed."
        : null,
  };
}
@Controller("workspaces/:organizationId/media-generations")
@UseGuards(TenantGuard)
export class GeneratedMediaController {
  constructor(
    private db: Db,
    private store: MediaStorage,
    private cache: Cache,
  ) {}
  private async mediaPlan(org: string): Promise<MediaPlan> {
    if (creditPolicy().mode === "self_hosted") return "self_hosted";
    const subscription = await this.db.billingSubscription.findUnique({
      where: { organizationId: org },
      select: { planId: true, status: true },
    });
    if (!subscription || !["ACTIVE", "TRIALING"].includes(subscription.status))
      return "free";
    return z
      .enum(["free", "starter", "growth"])
      .catch("free")
      .parse(subscription.planId);
  }
  private async assertSourceAssets(org: string, ids: string[]) {
    if (!ids.length) return;
    const unique = [...new Set(ids)];
    if (unique.length !== ids.length)
      throw new BadRequestException("Source assets must be unique.");
    const rows = await this.db.asset.findMany({
      where: { organizationId: org, id: { in: unique }, archivedAt: null },
      select: { id: true, kind: true },
    });
    if (rows.length !== unique.length)
      throw new BadRequestException("Source asset not found.");
    if (rows.some((asset) => asset.kind !== "IMAGE"))
      throw new BadRequestException(
        "Only active image assets can be used as generation references.",
      );
  }
  @Get("status") async status(@Req() req: AuthedRequest) {
    const plan = await this.mediaPlan(req.organizationId);
    const models = (["image", "video", "voice"] as const).flatMap((kind) => {
      try {
        const config = mediaConfiguration(kind);
        return config && config.allowedPlans.includes(plan)
          ? [
              {
                kind,
                model: config.model,
                estimatedCostUsd: config.estimatedCostUsd,
                credits: creditPolicy().mode === "credits" ? config.credits : 0,
                imageEdit: config.imageEdit
                  ? {
                      estimatedCostUsd: config.imageEdit.estimatedCostUsd,
                      credits:
                        creditPolicy().mode === "credits"
                          ? config.imageEdit.credits
                          : 0,
                      maxSourceImages: 4,
                    }
                  : null,
                allowedPlans: config.allowedPlans,
                preset: mediaPreset(kind),
                options:
                  kind === "image"
                    ? mediaOptionCatalog.image
                    : kind === "voice"
                      ? mediaOptionCatalog.voice
                      : null,
              },
            ]
          : [];
      } catch {
        return [];
      }
    });
    return {
      models,
      currentPlan: plan,
      workerOnline: Boolean(
        await this.cache.client.get("media-generation:heartbeat"),
      ),
      storageConfigured: this.store.configured,
      billingMode: creditPolicy().mode,
      costNotice:
        "USD estimates are configured by the operator and are not a provider-enforced spending cap. Actual provider cost may remain unknown.",
      sourceAssetsSupported: models.some(
        (model) => model.kind === "image" && model.imageEdit,
      ),
      sourceAssetPolicy:
        "Up to four active images in this workspace may be used as ordered references when the separately quoted image-edit preset is enabled.",
      inFlightCancellationSupported: false,
    };
  }
  @Get() async list(@Req() req: AuthedRequest, @Query() query: unknown) {
    const q = z
      .object({
        skip: z.coerce.number().int().min(0).default(0),
        take: z.coerce.number().int().min(1).max(100).default(50),
      })
      .parse(query);
    return {
      items: (
        await this.db.mediaGeneration.findMany({
          where: { organizationId: req.organizationId },
          orderBy: { createdAt: "desc" },
          ...q,
        })
      ).map(publicGeneration),
    };
  }
  private async owned(org: string, id: string) {
    const row = await this.db.mediaGeneration.findFirst({
      where: { organizationId: org, id: idSchema.parse(id) },
    });
    if (!row) throw new NotFoundException("Generation not found.");
    return row;
  }
  @Get(":id") async get(@Req() req: AuthedRequest, @Param("id") id: string) {
    return publicGeneration(await this.owned(req.organizationId, id));
  }
  @Post() @Roles(...writerRoles) async create(
    @Req() req: AuthedRequest,
    @Body() body: unknown,
  ) {
    const data = createSchema.parse(body),
      org = req.organizationId;
    const hash = sha256(
      Buffer.from(
        stableJson({ request: data.request, maxCredits: data.maxCredits }),
      ),
    );
    const where = {
      organizationId_requestKey: {
        organizationId: org,
        requestKey: data.requestKey,
      },
    };
    const replay = (row: MediaGeneration) => {
      if (row.requestHash !== hash)
        throw new ConflictException(
          "This request key belongs to a different generation.",
        );
      return publicGeneration(row);
    };
    const previous = await this.db.mediaGeneration.findUnique({ where });
    if (previous) return replay(previous);
    let config;
    try {
      config = mediaConfiguration(data.request.kind);
    } catch {
      throw new ServiceUnavailableException(
        "Media generation configuration is invalid.",
      );
    }
    if (!config)
      throw new ServiceUnavailableException(
        "This media provider is not configured.",
      );
    const plan = await this.mediaPlan(org);
    await this.assertSourceAssets(org, data.request.sourceAssetIds);
    try {
      validateMediaPreset(data.request, config, plan);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    const pricing = mediaPricing(data.request, config);
    const credits = creditPolicy().mode === "credits" ? pricing.credits : 0;
    if (credits > data.maxCredits)
      throw new ConflictException(
        "Accept the current credit quote before generation.",
      );
    try {
      await this.store.ready();
    } catch {
      throw new ServiceUnavailableException(
        "Private media storage is unavailable.",
      );
    }
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${org} FOR UPDATE`;
      const duplicate = await tx.mediaGeneration.findUnique({ where });
      if (duplicate) return replay(duplicate);
      const active = await tx.mediaGeneration.count({
        where: { organizationId: org, state: { in: [...activeStates] } },
      });
      const daily = await tx.mediaGeneration.count({
        where: {
          organizationId: org,
          createdAt: { gte: new Date(Date.now() - 86400000) },
        },
      });
      if (active >= 4 || daily >= 20)
        throw new HttpException(
          "Generation limit reached: four active jobs and twenty requests per 24 hours.",
          429,
        );
      const target = data.request.target;
      if (target) {
        const content = await tx.contentItem.findFirst({
          where: {
            id: target.contentId,
            organizationId: org,
            status: { not: "ARCHIVED" },
          },
        });
        if (!content) throw new NotFoundException("Target content not found.");
        if (content.revision !== target.revision)
          throw new ConflictException(
            "Target content changed. Refresh it before generating.",
          );
        if (
          !z
            .array(sceneSchema)
            .parse(content.scenes)
            .some((s) => s.id === target.sceneId)
        )
          throw new BadRequestException("Target scene not found.");
      }
      const id = randomUUID();
      const reservation = credits
        ? await reserveCredits(tx, org, `media:${id}`, credits, req.userId)
        : null;
      const row = await tx.mediaGeneration.create({
        data: {
          id,
          organizationId: org,
          actorId: req.userId,
          requestKey: data.requestKey,
          requestHash: hash,
          request: data.request,
          configuration: config,
          quotedCostUsd: pricing.estimatedCostUsd,
          quotedCredits: credits,
          creditReservationId: reservation?.id,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: org,
          actorId: req.userId,
          action: "media_generation.queued",
          entityId: id,
          detail: {
            kind: data.request.kind,
            model: data.request.model,
            rightsConfirmed: true,
            estimatedCostUsd: pricing.estimatedCostUsd,
            credits,
            plan,
            allowedPlans: config.allowedPlans,
            sourceAssetCount: data.request.sourceAssetIds.length,
            preset: mediaPreset(data.request),
          },
        },
      });
      return publicGeneration(row);
    });
  }
  @Post(":id/cancel") @Roles(...writerRoles) async cancel(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
  ) {
    await this.owned(req.organizationId, id);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${req.organizationId} FOR UPDATE`;
      const row = await tx.mediaGeneration.findUniqueOrThrow({ where: { id } });
      if (![...activeStates].includes(row.state as any))
        return publicGeneration(row);
      const queued = row.state === "QUEUED";
      const updated = await tx.mediaGeneration.update({
        where: { id },
        data: {
          cancellationRequestedAt: row.cancellationRequestedAt || new Date(),
          ...(queued
            ? { state: "CANCELED", actualCostUsd: 0, completedAt: new Date() }
            : {}),
        },
      });
      if (queued && row.creditReservationId)
        await settleCredits(
          tx,
          req.organizationId,
          row.creditReservationId,
          0,
          "Canceled before provider submission",
          req.userId,
        );
      await tx.auditLog.create({
        data: {
          organizationId: req.organizationId,
          actorId: req.userId,
          action: queued
            ? "media_generation.canceled"
            : "media_generation.cancel_requested",
          entityId: id,
        },
      });
      return publicGeneration(updated);
    });
  }
  @Post(":id/attach") @Roles(...writerRoles) async attach(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const { revision } = z
      .object({ revision: z.number().int().positive() })
      .strict()
      .parse(body);
    await this.owned(req.organizationId, id);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${req.organizationId} FOR UPDATE`;
      const job = await tx.mediaGeneration.findUniqueOrThrow({ where: { id } });
      const request = generationRequestSchema.parse(job.request),
        target = request.target;
      if (job.state !== "SUCCEEDED" || !job.assetId || !target)
        throw new ConflictException(
          "A completed generation with a saved scene target is required.",
        );
      if (revision !== target.revision)
        throw new ConflictException(
          "Use the generation's saved target revision. Select its asset manually if content has changed.",
        );
      if (job.attachedRevision)
        return {
          contentId: target.contentId,
          revision: job.attachedRevision,
          alreadyAttached: true,
        };
      const content = await tx.contentItem.findFirst({
        where: {
          id: target.contentId,
          organizationId: req.organizationId,
          revision,
          status: { not: "ARCHIVED" },
        },
      });
      if (!content)
        throw new ConflictException(
          "Content changed after generation. The asset remains in your library; no scene was overwritten.",
        );
      const scenes = z.array(sceneSchema).parse(content.scenes);
      const scene = scenes.find((s) => s.id === target.sceneId);
      if (!scene)
        throw new ConflictException("The target scene no longer exists.");
      if (target.component === "narration") scene.audioAssetId = job.assetId;
      else scene.visualAssetId = job.assetId;
      await assertSceneAssets(tx, req.organizationId, scenes);
      const changed = await tx.contentItem.updateMany({
        where: {
          id: content.id,
          organizationId: req.organizationId,
          revision,
          status: { not: "ARCHIVED" },
        },
        data: {
          scenes,
          revision: { increment: 1 },
          status: "DRAFT",
          approvedAt: null,
          approvedBy: null,
        },
      });
      if (!changed.count)
        throw new ConflictException(
          "Content changed. Refresh before attaching media.",
        );
      await tx.renderJob.updateMany({
        where: { contentId: content.id, organizationId: req.organizationId },
        data: { approvedAt: null, approvedBy: null },
      });
      const updated = await tx.contentItem.findUniqueOrThrow({
        where: { id: content.id },
      });
      await tx.contentVersion.create({
        data: {
          contentId: content.id,
          revision: updated.revision,
          actorId: req.userId,
          snapshot: JSON.parse(JSON.stringify(updated)),
        },
      });
      await tx.mediaGeneration.update({
        where: { id },
        data: { attachedRevision: updated.revision },
      });
      await tx.auditLog.create({
        data: {
          organizationId: req.organizationId,
          actorId: req.userId,
          action: "media_generation.attached",
          entityId: id,
          detail: {
            contentId: content.id,
            revision: updated.revision,
            sceneId: target.sceneId,
            component: target.component,
            assetId: job.assetId,
          },
        },
      });
      return {
        contentId: content.id,
        revision: updated.revision,
        alreadyAttached: false,
      };
    });
  }
}
@Module({ imports: [AssetsModule], controllers: [GeneratedMediaController] })
export class GeneratedMediaModule {}
