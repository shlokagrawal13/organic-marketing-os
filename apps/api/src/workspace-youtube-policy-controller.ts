import { BadRequestException, Body, ConflictException, Controller, ForbiddenException,
  Get, Module, Put, Req, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { AuthedRequest, Db, Roles, TenantGuard } from "./common";
import { createWorkspaceYoutubeMetadataPolicy, youtubeMetadataPolicy, youtubeRulesSchema } from "../../../packages/core/youtube-rules";
import { effectiveWorkspaceYoutubePolicy } from "./workspace-youtube-policy";

const updateInput = z.object({
  expectedRevision: z.number().int().min(0).max(2147483646),
  rules: youtubeRulesSchema,
}).strict();

@Controller("workspaces/:organizationId/youtube-policy")
@UseGuards(TenantGuard)
@Roles("OWNER", "ADMIN")
export class WorkspaceYoutubePolicyController {
  constructor(private db: Db) {}

  @Get() async get(@Req() req: AuthedRequest) {
    try { return this.view(await effectiveWorkspaceYoutubePolicy(this.db, req.organizationId)); }
    catch (error) {
      if (!(error instanceof ConflictException)) throw error;
      // Let an operator recover a policy invalidated by tighter deployment rules.
      const saved = await this.db.workspaceYoutubePolicy.findUniqueOrThrow({
        where: { organizationId: req.organizationId },
      });
      return { revision: saved.revision, rules: saved.rules, policyVersion: null,
        updatedAt: saved.updatedAt, needsReview: true, deploymentRules: youtubeMetadataPolicy.rules };
    }
  }

  private view(current: Awaited<ReturnType<typeof effectiveWorkspaceYoutubePolicy>>) {
    return { revision: current.revision, rules: current.policy.rules,
      policyVersion: current.policyVersion, updatedAt: current.updatedAt,
      needsReview: false, deploymentRules: youtubeMetadataPolicy.rules };
  }

  @Put() async update(@Req() req: AuthedRequest, @Body() body: unknown) {
    const input = updateInput.parse(body);
    let policy;
    try { policy = createWorkspaceYoutubeMetadataPolicy(input.rules); }
    catch (error) { throw new BadRequestException((error as Error).message); }
    const rules = JSON.parse(JSON.stringify(policy.rules)) as Prisma.InputJsonValue;
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${req.organizationId} FOR UPDATE`;
      // Recheck membership under the same workspace lock used by publication.
      await tx.$queryRaw`SELECT "userId" FROM "Membership" WHERE "userId"=${req.userId} AND "organizationId"=${req.organizationId} FOR UPDATE`;
      const member = await tx.membership.findUnique({ where: { userId_organizationId: {
        userId: req.userId, organizationId: req.organizationId,
      } } });
      if (!member || !["OWNER", "ADMIN"].includes(member.role))
        throw new ForbiddenException("Only a current workspace owner or admin can change policy.");
      const saved = await tx.workspaceYoutubePolicy.findUnique({ where: { organizationId: req.organizationId } });
      if ((saved?.revision ?? 0) !== input.expectedRevision)
        throw new ConflictException("Workspace policy changed. Reload its current revision before saving.");
      const revision = input.expectedRevision + 1;
      await tx.workspaceYoutubePolicy.upsert({ where: { organizationId: req.organizationId },
        create: { organizationId: req.organizationId, revision, rules, updatedBy: req.userId },
        update: { revision, rules, updatedBy: req.userId } });
      const current = await effectiveWorkspaceYoutubePolicy(tx, req.organizationId);
      await tx.auditLog.create({ data: { organizationId: req.organizationId, actorId: req.userId,
        action: "policy.youtube_updated", entityId: req.organizationId,
        detail: { revision, fingerprint: policy.fingerprint, policyVersion: current.policyVersion },
      } });
      return this.view(current);
    });
  }
}

@Module({ controllers: [WorkspaceYoutubePolicyController] })
export class WorkspaceYoutubePolicyModule {}
