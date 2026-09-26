import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Req,
  UseGuards,
  Module,
  BadRequestException,
  ServiceUnavailableException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { z } from "zod";
import {
  Db,
  Cache,
  TenantGuard,
  AuthedRequest,
  Roles,
  parse,
  writerRoles,
  idSchema,
} from "./common";
import { providersFromEnv, sceneSchema } from "../../../packages/core/ai";
import { stableJson } from "../../../packages/core/requests";
import { randomUUID } from "node:crypto";
import {
  creditPolicy,
  reserveCredits,
  settleCredits,
} from "../../../packages/core/credits";
const jobInput = z
  .object({
    requestKey: z.string().uuid(),
    task: z.enum(["strategy", "content", "scene"]),
    prompt: z.string().trim().min(10).max(4000),
    scene: sceneSchema.optional(),
    maxCredits: z.number().int().min(0).max(10000).optional(),
  })
  .strict();
const publicJob = (job: any) => {
  const { runToken, brandContext, ...safe } = job;
  return { ...safe, brandRevision: brandContext?.revision ?? null };
};
@Controller("workspaces/:organizationId/ai")
@UseGuards(TenantGuard)
export class AIController {
  constructor(
    private db: Db,
    private cache: Cache,
  ) {}
  @Get("status") async status(@Req() req: AuthedRequest) {
    const providers = providersFromEnv();
    const heartbeat = await this.cache.client.get("worker:heartbeat");
    const policy = creditPolicy();
    const account = await this.db.creditAccount.findUnique({
      where: { organizationId: req.organizationId },
    });
    return {
      configured: providers.length > 0,
      providers: providers.map(({ name, model }) => ({ name, model })),
      workerActive: !!heartbeat && Date.now() - Number(heartbeat) < 30000,
      limits: { dailyJobs: Number(process.env.AI_DAILY_JOB_LIMIT || 50) },
      credits: {
        ...policy,
        available: account?.available || 0,
        reserved: account?.reserved || 0,
      },
      usage: await this.db.aIUsage.findMany({
        where: { organizationId: req.organizationId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    };
  }
  @Get("jobs") async list(@Req() req: AuthedRequest) {
    return (
      await this.db.aIJob.findMany({
        where: { organizationId: req.organizationId },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    ).map(publicJob);
  }
  @Post("jobs") @Roles(...writerRoles) async create(
    @Req() req: AuthedRequest,
    @Body() body: unknown,
  ) {
    const data = parse(jobInput, body);
    if ((data.task === "scene") !== Boolean(data.scene))
      throw new BadRequestException(
        "A scene rewrite requires a valid scene; other tasks do not accept a scene.",
      );
    const input = {
      prompt: data.prompt,
      ...(data.scene ? { scene: data.scene } : {}),
    };
    const replay = (job: any) => {
      if (job.task !== data.task || stableJson(job.input) !== stableJson(input))
        throw new ConflictException(
          "This request key belongs to different AI input. Use a new key for a new request.",
        );
      return publicJob(job);
    };
    const existing = await this.db.aIJob.findUnique({
      where: {
        organizationId_requestKey: {
          organizationId: req.organizationId,
          requestKey: data.requestKey,
        },
      },
    });
    if (existing) return replay(existing);
    if (!providersFromEnv().length)
      throw new ServiceUnavailableException(
        "AI generation is not configured. Ask your administrator to configure a provider and model. No generation was started.",
      );
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${req.organizationId} FOR UPDATE`;
      const duplicate = await tx.aIJob.findUnique({
        where: {
          organizationId_requestKey: {
            organizationId: req.organizationId,
            requestKey: data.requestKey,
          },
        },
      });
      if (duplicate) return replay(duplicate);
      const policy = creditPolicy(),
        quotedCredits = policy.prices[data.task];
      if (
        policy.mode === "credits" &&
        (data.maxCredits === undefined || data.maxCredits < quotedCredits)
      )
        throw new ConflictException(
          "The credit quote changed or was not accepted. Refresh the price before generating.",
        );
      const brand = await tx.brandBrain.findUnique({
        where: { organizationId: req.organizationId },
      });
      if (!brand)
        throw new BadRequestException(
          "Save your Brand Brain before creating with AI.",
        );
      const count = await tx.aIJob.count({
        where: {
          organizationId: req.organizationId,
          createdAt: { gte: today },
        },
      });
      if (count >= Number(process.env.AI_DAILY_JOB_LIMIT || 50))
        throw new BadRequestException(
          "This workspace reached its daily AI job limit.",
        );
      const pending = await tx.aIJob.count({
        where: {
          organizationId: req.organizationId,
          status: { in: ["QUEUED", "RUNNING"] },
        },
      });
      if (pending >= 5)
        throw new BadRequestException(
          "Five jobs are already pending. Wait for them to finish.",
        );
      const jobId = randomUUID();
      const reservation =
        policy.mode === "credits"
          ? await reserveCredits(
              tx,
              req.organizationId,
              `ai:${jobId}`,
              quotedCredits,
              req.userId,
            )
          : null;
      const job = await tx.aIJob.create({
        data: {
          id: jobId,
          organizationId: req.organizationId,
          actorId: req.userId,
          requestKey: data.requestKey,
          task: data.task,
          input,
          creditReservationId: reservation?.id,
          brandContext: {
            revision: brand.revision,
            profile: brand.profile,
            creativeDna: brand.creativeDna,
          },
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: req.organizationId,
          actorId: req.userId,
          action: "ai.queued",
          entityId: job.id,
          detail: { task: data.task },
        },
      });
      return publicJob(job);
    });
  }
  @Post("jobs/:id/cancel") @Roles(...writerRoles) async cancel(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
  ) {
    idSchema.parse(id);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${req.organizationId} FOR UPDATE`;
      const job = await tx.aIJob.findFirst({
        where: { id, organizationId: req.organizationId },
      });
      const r = await tx.aIJob.updateMany({
        where: { id, organizationId: req.organizationId, status: "QUEUED" },
        data: { status: "CANCELED", completedAt: new Date() },
      });
      if (!r.count)
        throw new ConflictException(
          "Only queued jobs can be canceled. It may have already started.",
        );
      if (job?.creditReservationId)
        await settleCredits(
          tx,
          req.organizationId,
          job.creditReservationId,
          0,
          "Queued generation canceled before provider execution",
          req.userId,
        );
      return { ok: true };
    });
  }
}
@Module({ controllers: [AIController], providers: [TenantGuard] })
export class AIModule {}
