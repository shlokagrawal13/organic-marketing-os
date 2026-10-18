import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Module,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Prisma, ResearchRecord, Role } from "@prisma/client";
import { z, ZodError } from "zod";
import {
  approverRoles,
  AuthedRequest,
  Db,
  idSchema,
  Roles,
  TenantGuard,
  writerRoles,
} from "./common";
import {
  parseResearchInput,
  researchEvidenceState,
  researchInputSchema,
  researchRevisionSchema,
} from "../../../packages/core/research";

const editInput = researchInputSchema
  .extend({ expectedRevision: researchRevisionSchema })
  .strict();
const reviewInput = z
  .object({
    expectedRevision: researchRevisionSchema,
    decision: z.enum(["ACCEPTED", "REJECTED"]),
    note: z.string().trim().min(1).max(2000),
    sourcesReviewed: z.literal(true),
  })
  .strict();

@Controller("workspaces/:organizationId/research")
@UseGuards(TenantGuard)
export class ResearchController {
  constructor(private db: Db) {}

  private view(record: ResearchRecord, now = new Date()) {
    return { ...record, ...researchEvidenceState(record, now) };
  }

  private input(body: unknown, now = new Date()) {
    try {
      const data = parseResearchInput(body, now);
      return {
        ...data,
        observedAt: data.observedAt ? new Date(data.observedAt) : null,
      };
    } catch (error) {
      if (error instanceof ZodError) throw error;
      throw new BadRequestException((error as Error).message);
    }
  }

  private async lockMember(
    tx: Prisma.TransactionClient,
    req: AuthedRequest,
    roles: Role[],
  ) {
    // Keep the publication/policy ordering: organization, membership, record.
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${req.organizationId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "userId" FROM "Membership" WHERE "userId"=${req.userId} AND "organizationId"=${req.organizationId} FOR UPDATE`;
    const member = await tx.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: req.userId,
          organizationId: req.organizationId,
        },
      },
    });
    if (!member) throw new NotFoundException("Workspace not found.");
    if (!roles.includes(member.role))
      throw new ForbiddenException(
        "Your current role does not allow this action.",
      );
  }

  private async lockRecord(
    tx: Prisma.TransactionClient,
    req: AuthedRequest,
    id: string,
    revision: number,
  ) {
    await tx.$queryRaw`SELECT id FROM "ResearchRecord" WHERE id=${id} AND "organizationId"=${req.organizationId} FOR UPDATE`;
    const record = await tx.researchRecord.findFirst({
      where: { id, organizationId: req.organizationId },
    });
    if (!record) throw new NotFoundException("Research record not found.");
    if (record.revision !== revision)
      throw new ConflictException(
        "Research changed. Reload its current revision before saving or reviewing.",
      );
    return record;
  }

  private audit(
    tx: Prisma.TransactionClient,
    req: AuthedRequest,
    record: ResearchRecord,
    action: string,
  ) {
    return tx.auditLog.create({
      data: {
        organizationId: req.organizationId,
        actorId: req.userId,
        entityId: record.id,
        action,
        detail: {
          revision: record.revision,
          reviewStatus: record.reviewStatus,
        },
      },
    });
  }

  @Get() async list(@Req() req: AuthedRequest) {
    const items = await this.db.researchRecord.findMany({
      where: { organizationId: req.organizationId },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 100,
    });
    const now = new Date();
    return { items: items.map((record) => this.view(record, now)) };
  }

  @Get(":id") async detail(@Req() req: AuthedRequest, @Param("id") id: string) {
    idSchema.parse(id);
    const record = await this.db.researchRecord.findFirst({
      where: { id, organizationId: req.organizationId },
    });
    if (!record) throw new NotFoundException("Research record not found.");
    return this.view(record);
  }

  @Post() @Roles(...writerRoles) async create(
    @Req() req: AuthedRequest,
    @Body() body: unknown,
  ) {
    researchInputSchema.parse(body);
    return this.db.$transaction(async (tx) => {
      await this.lockMember(tx, req, writerRoles);
      const now = new Date();
      const record = await tx.researchRecord.create({
        data: {
          ...this.input(body, now),
          organizationId: req.organizationId,
          createdBy: req.userId,
          provenance: "MANUAL",
          collectedAt: now,
        },
      });
      await this.audit(tx, req, record, "research.created");
      return this.view(record, now);
    });
  }

  @Put(":id") @Roles(...writerRoles) async update(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    idSchema.parse(id);
    const { expectedRevision, ...input } = editInput.parse(body);
    return this.db.$transaction(async (tx) => {
      await this.lockMember(tx, req, writerRoles);
      await this.lockRecord(tx, req, id, expectedRevision);
      const now = new Date();
      const record = await tx.researchRecord.update({
        where: {
          id,
          organizationId: req.organizationId,
          revision: expectedRevision,
        },
        data: {
          ...this.input(input, now),
          revision: { increment: 1 },
          reviewStatus: "UNREVIEWED",
          reviewedAt: null,
          reviewedBy: null,
          reviewNote: null,
        },
      });
      await this.audit(tx, req, record, "research.edited");
      return this.view(record, now);
    });
  }

  @Post(":id/review") @Roles(...approverRoles) async review(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    idSchema.parse(id);
    const input = reviewInput.parse(body);
    return this.db.$transaction(async (tx) => {
      await this.lockMember(tx, req, approverRoles);
      const current = await this.lockRecord(
        tx,
        req,
        id,
        input.expectedRevision,
      );
      const now = new Date();
      if (
        input.decision === "ACCEPTED" &&
        researchEvidenceState(current, now).freshness !== "CURRENT"
      )
        throw new BadRequestException(
          "Acceptance requires a complete citation and an observation less than 30 days old, without expired classification.",
        );
      const record = await tx.researchRecord.update({
        where: {
          id,
          organizationId: req.organizationId,
          revision: input.expectedRevision,
        },
        data: {
          revision: { increment: 1 },
          reviewStatus: input.decision,
          reviewedAt: now,
          reviewedBy: req.userId,
          reviewNote: input.note,
        },
      });
      await this.audit(tx, req, record, "research.reviewed");
      return this.view(record, now);
    });
  }
}

@Module({ controllers: [ResearchController] })
export class ResearchModule {}
