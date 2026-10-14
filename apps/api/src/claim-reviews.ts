import { BadRequestException, ConflictException } from "@nestjs/common";
import { z } from "zod";
import { draftSchema } from "../../../packages/core/ai";
import {
  claimPolicyVersion,
  evaluateClaimPolicy,
  type ClaimSignal,
} from "../../../packages/core/claim-policy";

const evidenceResolution = z
  .object({
    claimId: z.string().regex(/^[a-f0-9]{64}$/u),
    disposition: z.literal("EVIDENCE"),
    sourceUrl: z
      .string()
      .url()
      .max(2000)
      .refine((value) => new URL(value).protocol === "https:", {
        message: "Evidence links must use HTTPS.",
      }),
    sourceLabel: z.string().trim().min(3).max(200),
    checkedAt: z.string().datetime({ offset: true }),
    acknowledged: z.literal(true),
  })
  .strict();

const overrideResolution = z
  .object({
    claimId: z.string().regex(/^[a-f0-9]{64}$/u),
    disposition: z.literal("OWNER_OVERRIDE"),
    overrideReason: z.string().trim().min(20).max(1000),
    acknowledged: z.literal(true),
  })
  .strict();

export const claimResolutionSchema = z.discriminatedUnion("disposition", [
  evidenceResolution,
  overrideResolution,
]);
export const claimReviewInput = z
  .object({
    revision: z.number().int().positive(),
    policyVersion: z.literal(claimPolicyVersion),
    claimSetFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    resolutions: z.array(claimResolutionSchema).max(50),
  })
  .strict();

export type ClaimResolution = z.infer<typeof claimResolutionSchema>;

const draftFromContent = (content: unknown) =>
  draftSchema.strip().parse(content);

function validateResolutionSet(claims: ClaimSignal[], value: unknown) {
  const resolutions = z.array(claimResolutionSchema).max(50).parse(value);
  const expected = new Set(claims.map((claim) => claim.id));
  if (
    resolutions.length !== expected.size ||
    new Set(resolutions.map((resolution) => resolution.claimId)).size !==
      resolutions.length ||
    resolutions.some((resolution) => !expected.has(resolution.claimId))
  )
    throw new BadRequestException(
      "Resolve every detected claim exactly once for this content revision.",
    );
  if (
    resolutions.some(
      (resolution) =>
        resolution.disposition === "EVIDENCE" &&
        new Date(resolution.checkedAt).getTime() > Date.now() + 5 * 60_000,
    )
  )
    throw new BadRequestException(
      "Evidence review time cannot be in the future.",
    );
  return resolutions;
}

export const claimPolicyForContent = (content: unknown) =>
  evaluateClaimPolicy(draftFromContent(content));

export function validateClaimReviewSubmission(
  content: unknown,
  value: z.infer<typeof claimReviewInput>,
) {
  const policy = claimPolicyForContent(content);
  if (value.policyVersion !== policy.policyVersion)
    throw new ConflictException(
      "The claim policy changed. Reload and review again.",
    );
  if (value.claimSetFingerprint !== policy.claimSetFingerprint)
    throw new ConflictException(
      "The detected claims changed. Reload and review this revision again.",
    );
  if (!policy.claims.length)
    throw new BadRequestException(
      "This revision has no bounded claims requiring evidence review.",
    );
  return {
    policy,
    resolutions: validateResolutionSet(policy.claims, value.resolutions),
  };
}

export const claimReviewView = (review: any) =>
  review && {
    id: review.id,
    contentRevision: review.contentRevision,
    policyVersion: review.policyVersion,
    claimSetFingerprint: review.claimSetFingerprint,
    resolutions: review.resolutions,
    reviewedBy: review.reviewedBy,
    reviewedAt: review.reviewedAt,
  };

export async function currentClaimPolicy(
  tx: any,
  organizationId: string,
  content: any,
) {
  const policy = claimPolicyForContent(content);
  if (!policy.claims.length) return { ...policy, complete: true, review: null };
  const review = await tx.contentClaimReview.findUnique({
    where: {
      contentId_contentRevision: {
        contentId: content.id,
        contentRevision: content.revision,
      },
    },
  });
  let complete = false;
  if (
    review?.organizationId === organizationId &&
    review.policyVersion === policy.policyVersion &&
    review.claimSetFingerprint === policy.claimSetFingerprint
  ) {
    try {
      validateResolutionSet(policy.claims, review.resolutions);
      complete = true;
    } catch {
      complete = false;
    }
  }
  return {
    ...policy,
    complete,
    review: complete ? claimReviewView(review) : null,
  };
}

export async function requireCurrentClaimReview(
  tx: any,
  organizationId: string,
  content: any,
) {
  const current = await currentClaimPolicy(tx, organizationId, content);
  if (!current.complete)
    throw new ConflictException(
      "Link evidence for every detected claim, or have an owner document an override, before approval.",
    );
  return current;
}

export const publicationClaimReviewSnapshot = (current: any) =>
  current.review && {
    reviewId: current.review.id,
    contentRevision: current.review.contentRevision,
    policyVersion: current.review.policyVersion,
    claimSetFingerprint: current.review.claimSetFingerprint,
    reviewedBy: current.review.reviewedBy,
    reviewedAt: current.review.reviewedAt,
    dispositions: (current.review.resolutions as ClaimResolution[]).map(
      ({ claimId, disposition }) => ({ claimId, disposition }),
    ),
  };
