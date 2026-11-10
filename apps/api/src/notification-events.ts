import { PrismaClient, Prisma } from "@prisma/client";
import {
  writeCreditsLowNotification,
} from "../../../packages/core/credits";

export const NOTIFICATION_ROLES = [
  "OWNER",
  "ADMIN",
  "EDITOR",
  "CREATOR",
  "ANALYST",
] as const;

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

export async function createPublishNotification(
  client: PrismaClient | Prisma.TransactionClient,
  params: {
    organizationId: string;
    attemptId: string;
    actorId?: string | null;
    status: "CONFIRMED" | "REJECTED";
    platform?: string | null;
    providerPostId?: string | null;
    error?: string | null;
    contentTitle?: string | null;
  },
) {
  const eventKey = `publish:${params.attemptId}:${params.status.toLowerCase()}`;
  const isSuccess = params.status === "CONFIRMED";
  const title = isSuccess ? "Publishing successful" : "Publishing failed";
  const target = params.platform ? ` to ${params.platform}` : "";
  const contentSnippet = params.contentTitle
    ? ` for "${params.contentTitle}"`
    : "";
  const body = isSuccess
    ? `Publication attempt${contentSnippet}${target} completed successfully.`
    : params.error
      ? `Publication attempt${contentSnippet}${target} failed: ${params.error}`
      : `Publication attempt${contentSnippet}${target} failed.`;

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
      type: isSuccess ? "PUBLISH_SUCCEEDED" : "PUBLISH_FAILED",
      category: "PUBLISH",
      title,
      body,
      link: `/workspaces/${params.organizationId}/publications`,
      entityType: "PUBLICATION_ATTEMPT",
      entityId: params.attemptId,
      eventKey,
      data: {
        attemptId: params.attemptId,
        status: params.status,
        ...(params.platform ? { platform: params.platform } : {}),
        ...(params.providerPostId ? { providerPostId: params.providerPostId } : {}),
        ...(params.error ? { error: params.error } : {}),
      },
    },
    update: {},
  });
}

export async function createAiNotification(
  client: PrismaClient | Prisma.TransactionClient,
  params: {
    organizationId: string;
    jobId: string;
    actorId?: string | null;
    status: "FAILED";
    error?: string | null;
    preset?: string | null;
  },
) {
  const eventKey = `ai:${params.jobId}:failed`;
  const title = "AI generation failed";
  const body = params.error
    ? `Media generation failed: ${params.error}`
    : "Media generation failed.";

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
      type: "AI_GENERATION_FAILED",
      category: "AI",
      title,
      body,
      link: `/workspaces/${params.organizationId}/media`,
      entityType: "MEDIA_GENERATION",
      entityId: params.jobId,
      eventKey,
      data: {
        jobId: params.jobId,
        status: params.status,
        ...(params.preset ? { preset: params.preset } : {}),
        ...(params.error ? { error: params.error } : {}),
      },
    },
    update: {},
  });
}

export async function createCreditsLowNotification(
  client: PrismaClient | Prisma.TransactionClient,
  params: {
    organizationId: string;
    actorId?: string | null;
    balance: number;
    threshold: number;
    unit?: string;
  },
) {
  const notification = await writeCreditsLowNotification(client, params);
  // Keep the optional actor argument part of the public event contract while
  // leaving low-balance alerts workspace-wide by default.
  return notification;
}

export async function createApprovalRequiredNotification(
  client: PrismaClient | Prisma.TransactionClient,
  params: {
    organizationId: string;
    reviewId: string;
    actorId?: string | null;
    contentId?: string | null;
    contentTitle?: string | null;
    platform?: string | null;
    policyName?: string | null;
  },
) {
  const eventKey = `approval:required:${params.reviewId}`;
  const title = "Approval required";
  const target = params.contentTitle ? ` for "${params.contentTitle}"` : "";
  const body = `Publication review${target} requires approval before scheduling.`;

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
      type: "APPROVAL_REQUIRED",
      category: "APPROVAL",
      title,
      body,
      link: `/workspaces/${params.organizationId}/reviews/${params.reviewId}`,
      entityType: "PUBLICATION_POLICY_REVIEW",
      entityId: params.reviewId,
      eventKey,
      data: {
        reviewId: params.reviewId,
        ...(params.contentId ? { contentId: params.contentId } : {}),
        ...(params.platform ? { platform: params.platform } : {}),
        ...(params.policyName ? { policyName: params.policyName } : {}),
      },
    },
    update: {},
  });
}
