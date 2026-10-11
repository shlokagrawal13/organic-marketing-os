import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import {
  Db,
  AuthedRequest,
  Roles,
  TenantGuard,
  writerRoles,
  approverRoles,
  idSchema,
} from "./common";
import { digest } from "../../../packages/core/security";
import { checkContent } from "../../../packages/core/content";
import { draftSchema } from "../../../packages/core/ai";
import {
  youtubeBaseMetadata,
  youtubePolicyFingerprint,
  youtubePolicyReviewLifetimeMs,
  youtubePolicyVersion,
  youtubePolicyMaintenanceCurrent,
  youtubeReviewInput,
  youtubeUploadMetadata,
} from "../../../packages/core/youtube-policy";
import { activeConnection, currentApproval } from "./publication-attempts";
import { ObjectStore } from "../../../packages/core/object-store";
import { dispatchReviewedYoutubeVideo, reconcileUnknownYoutubeUpload } from "./youtube-dispatch";

const prepareInput = z
  .object({
    contentId: z.string().uuid(),
    revision: z.number().int().positive(),
    renderId: z.string().uuid().optional(),
    requestKey: z.string().uuid(),
  })
  .strict();

// Never expose the internal deduplication hash or confuse a preparation with a post.
const view = ({
  requestHash,
  ...intent
}: {
  requestHash: string;
  [key: string]: any;
}) => ({
  ...intent,
  externallySubmitted: false as const,
});
const policyView = ({ snapshotHash, ...review }: { snapshotHash: string; [key: string]: any }) => review;
const dispatchInput = z.object({
  connectionId: z.string().uuid(), requestKey: z.string().uuid(),
  confirmation: z.literal("PUBLISH_TO_YOUTUBE"),
}).strict();
const liveDispatch = () => process.env.YOUTUBE_LIVE_DISPATCH_ENABLED === "true" &&
  youtubePolicyMaintenanceCurrent(process.env);
const attemptView = (attempt: {
  id: string; intentId: string; status: string; outcomeCode: string | null;
  providerPostId: string | null; createdAt: Date; startedAt: Date | null;
  completedAt: Date | null; uploadSessionCiphertext: string | null;
} | null) => attempt && ({
  id: attempt.id, intentId: attempt.intentId, status: attempt.status,
  outcomeCode: attempt.outcomeCode,
  providerPostId: attempt.status === "CONFIRMED" ? attempt.providerPostId : null,
  createdAt: attempt.createdAt, startedAt: attempt.startedAt,
  completedAt: attempt.completedAt,
  canCheckStatus: attempt.status === "UNKNOWN" && Boolean(attempt.uploadSessionCiphertext),
});

@Controller("workspaces/:organizationId/publication-intents")
@UseGuards(TenantGuard)
export class PublicationIntentsController {
  private readonly media = new ObjectStore();
  constructor(private db: Db) {}

  @Get() async list(@Req() req: AuthedRequest, @Query() query: unknown) {
    const q = z
      .object({ contentId: z.string().uuid().optional() })
      .strict()
      .parse(query);
    return (
      await this.db.publicationIntent.findMany({
        where: {
          organizationId: req.organizationId,
          ...(q.contentId ? { contentId: q.contentId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    ).map(view);
  }

  @Get(":id") async get(@Req() req: AuthedRequest, @Param("id") id: string) {
    const intent = await this.db.publicationIntent.findFirst({
      where: { id: idSchema.parse(id), organizationId: req.organizationId },
    });
    if (!intent)
      throw new NotFoundException("Publication preparation not found.");
    return view(intent);
  }

  @Get(":id/youtube-policy-preview") @Roles(...approverRoles) async previewYoutube(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
  ) {
    const intentId = idSchema.parse(id);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${req.organizationId} FOR UPDATE`;
      const intent = await currentApproval(tx, req.organizationId, intentId);
      try {
        return {
          intentId,
          contentRevision: intent.contentRevision,
          renderId: intent.renderId,
          snippet: youtubeBaseMetadata(intent.snapshot),
          requiredChoices: ["connectionId", "privacyStatus", "selfDeclaredMadeForKids", "containsSyntheticMedia"],
          policyVersion: youtubePolicyVersion,
          externallySubmitted: false as const,
        };
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : "Invalid YouTube metadata.");
      }
    });
  }

  @Get(":id/youtube-policy-review") @Roles(...approverRoles) async getYoutubeReview(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
  ) {
    const intentId = idSchema.parse(id);
    const intent = await this.db.publicationIntent.findFirst({
      where: { id: intentId, organizationId: req.organizationId },
      select: { id: true },
    });
    if (!intent) throw new NotFoundException("Publication preparation not found.");
    const review = await this.db.publicationPolicyReview.findFirst({
      where: { intentId, organizationId: req.organizationId },
    });
    if (!review) throw new NotFoundException("YouTube policy review not found.");
    return policyView(review);
  }

  @Post(":id/youtube-policy-review") @Roles(...approverRoles) async reviewYoutube(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const intentId = idSchema.parse(id);
    const reviewInput = youtubeReviewInput.parse(body);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${req.organizationId} FOR UPDATE`;
      const intent = await currentApproval(tx, req.organizationId, intentId);
      const connection = await tx.socialConnection.findFirst({
        where: { id: reviewInput.connectionId, organizationId: req.organizationId },
      });
      if (!connection) throw new NotFoundException("Social connection not found.");
      activeConnection(connection, req.organizationId);
      let metadata;
      try {
        metadata = youtubeUploadMetadata(intent.snapshot, reviewInput);
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : "Invalid YouTube metadata.");
      }
      const fingerprint = youtubePolicyFingerprint({
        intentId, connectionId: connection.id,
        contentRevision: intent.contentRevision,
        renderId: intent.renderId, metadata,
      });
      const existing = await tx.publicationPolicyReview.findUnique({ where: { intentId } });
      if (existing) {
        if (existing.snapshotHash !== fingerprint || existing.expiresAt <= new Date())
          throw new ConflictException("The policy review is immutable or expired. Prepare a new publication.");
        return policyView(existing);
      }
      const now = new Date();
      const review = await tx.publicationPolicyReview.create({
        data: {
          organizationId: req.organizationId,
          intentId, connectionId: connection.id,
          contentRevision: intent.contentRevision,
          policyVersion: youtubePolicyVersion,
          metadata,
          snapshotHash: fingerprint,
          reviewedBy: req.userId,
          reviewedAt: now,
          expiresAt: new Date(now.getTime() + youtubePolicyReviewLifetimeMs),
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: req.organizationId, actorId: req.userId,
          action: "publication.youtube_policy_reviewed", entityId: intentId,
          detail: { reviewId: review.id, connectionId: connection.id,
            policyVersion: youtubePolicyVersion,
            privacyStatus: reviewInput.privacyStatus,
            selfDeclaredMadeForKids: reviewInput.selfDeclaredMadeForKids,
            containsSyntheticMedia: reviewInput.containsSyntheticMedia },
        },
      });
      return policyView(review);
    });
  }

  // Read-only status. Never expose ciphertext, upload URI, token or request key.
  @Get(":id/youtube-attempt") @Roles(...approverRoles) async youtubeAttempt(
    @Req() req: AuthedRequest, @Param("id") id: string,
  ) {
    const intentId = idSchema.parse(id);
    const intent = await this.db.publicationIntent.findFirst({
      where: { id: intentId, organizationId: req.organizationId }, select: { id: true },
    });
    if (!intent) throw new NotFoundException("Publication preparation not found.");
    const attempt = await this.db.publicationAttempt.findFirst({
      where: { intentId, organizationId: req.organizationId },
    });
    return { attempt: attemptView(attempt),
      canPublish: liveDispatch() && ["OWNER", "ADMIN"].includes(req.role),
      canReconcile: process.env.YOUTUBE_LIVE_DISPATCH_ENABLED === "true" &&
        ["OWNER", "ADMIN"].includes(req.role) &&
        attempt?.status === "UNKNOWN" && Boolean(attempt.uploadSessionCiphertext) };
  }

  // Off by default; explicit confirmation and a current signed-in owner/admin
  // are required before any provider request. The ledger blocks duplicate sends.
  @Post(":id/youtube-dispatch") @Roles("OWNER", "ADMIN") async youtubeDispatch(
    @Req() req: AuthedRequest, @Param("id") id: string, @Body() body: unknown,
  ) {
    const intentId = idSchema.parse(id);
    const input = dispatchInput.parse(body);
    if (!liveDispatch()) throw new ServiceUnavailableException("YouTube dispatch requires an enabled deployment and current platform policy review.");
    if (!this.media.configured)
      throw new ServiceUnavailableException("Private video storage is not configured.");
    const attempt = await dispatchReviewedYoutubeVideo(this.db, this.media, {
      organizationId: req.organizationId, actorId: req.userId,
      intentId, connectionId: input.connectionId, requestKey: input.requestKey,
    });
    return attemptView(attempt);
  }

  // Status-only empty PUT to the saved session; never sends media or starts a
  // second upload. An expired/ambiguous session remains UNKNOWN.
  @Post(":id/youtube-attempt/:attemptId/check-status") @Roles("OWNER", "ADMIN") async checkYoutubeAttempt(
    @Req() req: AuthedRequest, @Param("id") id: string,
    @Param("attemptId") attemptId: string,
  ) {
    const intentId = idSchema.parse(id), ownedAttemptId = idSchema.parse(attemptId);
    if (process.env.YOUTUBE_LIVE_DISPATCH_ENABLED !== "true")
      throw new ServiceUnavailableException("YouTube status checks are not enabled.");
    const owned = await this.db.publicationAttempt.findFirst({
      where: { id: ownedAttemptId, intentId, organizationId: req.organizationId },
      select: { id: true },
    });
    if (!owned) throw new NotFoundException("Publication attempt not found.");
    const outcome = await reconcileUnknownYoutubeUpload(this.db, {
      organizationId: req.organizationId, actorId: req.userId, attemptId: ownedAttemptId,
    });
    if (outcome.status === "UNKNOWN") return { attempt: attemptView(
      await this.db.publicationAttempt.findUnique({ where: { id: ownedAttemptId } })),
    };
    return { attempt: attemptView(outcome) };
  }

  @Post() @Roles(...approverRoles) async prepare(
    @Req() req: AuthedRequest,
    @Body() body: unknown,
  ) {
    const data = prepareInput.parse(body);
    const requestHash = digest(
      JSON.stringify({
        contentId: data.contentId,
        revision: data.revision,
        renderId: data.renderId ?? null,
      }),
    );
    return this.db.$transaction(async (tx) => {
      // Serializes concurrent uses of a request key within one workspace.
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${req.organizationId} FOR UPDATE`;
      const existing = await tx.publicationIntent.findUnique({
        where: {
          organizationId_requestKey: {
            organizationId: req.organizationId,
            requestKey: data.requestKey,
          },
        },
      });
      if (existing) {
        if (existing.requestHash !== requestHash)
          throw new ConflictException(
            "This request key belongs to another preparation.",
          );
        return view(existing);
      }
      // Serializes against edit/archive and render approval on this content.
      await tx.$queryRaw`SELECT id FROM "ContentItem" WHERE id=${data.contentId} AND "organizationId"=${req.organizationId} FOR UPDATE`;
      const content = await tx.contentItem.findFirst({
        where: { id: data.contentId, organizationId: req.organizationId },
      });
      if (!content) throw new NotFoundException("Content not found.");
      if (
        content.status !== "APPROVED" ||
        content.revision !== data.revision ||
        !content.approvedAt
      )
        throw new ConflictException(
          "Approve the current content revision before preparing publication.",
        );
      const draft = draftSchema.strip().parse(content);
      if (!checkContent(draft).passed)
        throw new BadRequestException(
          "Content did not pass structural checks.",
        );
      if (draft.format === "Video" && !data.renderId)
        throw new BadRequestException(
          "Choose an approved render of this content revision.",
        );
      if (draft.format !== "Video" && data.renderId)
        throw new BadRequestException(
          "A render can only accompany video content.",
        );
      if (data.renderId) {
        const render = await tx.renderJob.findFirst({
          where: {
            id: data.renderId,
            organizationId: req.organizationId,
            contentId: data.contentId,
            contentRevision: data.revision,
            status: "SUCCEEDED",
            approvedAt: { not: null },
            outputKey: { not: null },
          },
        });
        if (!render)
          throw new ConflictException(
            "Choose an approved, finished render for this content revision.",
          );
      }
      const intent = await tx.publicationIntent.create({
        data: {
          organizationId: req.organizationId,
          contentId: data.contentId,
          contentRevision: data.revision,
          renderId: data.renderId ?? null,
          platform: content.platform,
          snapshot: {
            ...draft,
            revision: data.revision,
            renderId: data.renderId ?? null,
          },
          requestKey: data.requestKey,
          requestHash,
          createdBy: req.userId,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: req.organizationId,
          actorId: req.userId,
          action: "publication.prepared",
          entityId: intent.id,
          detail: {
            contentId: data.contentId,
            revision: data.revision,
            renderId: data.renderId ?? null,
          },
        },
      });
      return view(intent);
    });
  }

  @Post(":id/cancel") @Roles(...writerRoles) async cancel(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
  ) {
    idSchema.parse(id);
    return this.db.$transaction(async (tx) => {
      const changed = await tx.publicationIntent.updateMany({
        where: { id, organizationId: req.organizationId, status: "PREPARED" },
        data: { status: "CANCELED", canceledAt: new Date() },
      });
      if (!changed.count)
        throw new ConflictException("No active preparation to cancel.");
      await tx.auditLog.create({
        data: {
          organizationId: req.organizationId,
          actorId: req.userId,
          action: "publication.canceled",
          entityId: id,
        },
      });
      return { ok: true };
    });
  }
}

@Module({ controllers: [PublicationIntentsController] })
export class PublicationsModule {}
