import { ConflictException } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { createWorkspaceYoutubeMetadataPolicy, youtubeMetadataPolicy } from "../../../packages/core/youtube-rules";
import { youtubePolicyVersion } from "../../../packages/core/youtube-policy";
import { digest } from "../../../packages/core/security";

type Reader = PrismaClient | Prisma.TransactionClient;

export async function effectiveWorkspaceYoutubePolicy(db: Reader, organizationId: string) {
  const saved = await db.workspaceYoutubePolicy.findUnique({ where: { organizationId } });
  let policy = youtubeMetadataPolicy;
  if (saved) {
    try { policy = createWorkspaceYoutubeMetadataPolicy(saved.rules); }
    catch { throw new ConflictException("Workspace YouTube policy needs review against the current deployment rules."); }
  }
  const revision = saved?.revision ?? 0;
  const policyVersion = saved ? `${youtubePolicyVersion}.workspace.${digest(JSON.stringify({
    organizationId, revision, fingerprint: policy.fingerprint,
  }))}` : youtubePolicyVersion;
  return { policy, revision, policyVersion, updatedAt: saved?.updatedAt ?? null };
}

export async function workspaceYoutubeReviewCurrent(db: Reader, organizationId: string,
  review: { organizationId: string; policyVersion: string }) {
  if (review.organizationId !== organizationId) return false;
  return review.policyVersion === (await effectiveWorkspaceYoutubePolicy(db, organizationId)).policyVersion;
}
