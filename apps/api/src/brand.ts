import {
  Body,
  Controller,
  Get,
  Put,
  Post,
  Param,
  Req,
  UseGuards,
  Module,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Db, TenantGuard, AuthedRequest, Roles, parse } from "./common";
import { brandInput, completeness } from "../../../packages/core/brand";
import { z } from "zod";
@Controller("workspaces/:organizationId/brand")
@UseGuards(TenantGuard)
export class BrandController {
  constructor(private db: Db) {}
  @Get() async get(@Req() req: AuthedRequest) {
    const brain = await this.db.brandBrain.findUnique({
      where: { organizationId: req.organizationId },
    });
    return {
      brain,
      progress: completeness(brain?.profile, brain?.creativeDna),
    };
  }
  @Put() @Roles("OWNER", "ADMIN", "EDITOR") async save(
    @Req() req: AuthedRequest,
    @Body() body: unknown,
  ) {
    const data = parse(brandInput, body);
    return this.db.$transaction(async (tx) => {
      if (data.revision === 0) {
        if (
          await tx.brandBrain.findUnique({
            where: { organizationId: req.organizationId },
          })
        )
          throw new ConflictException(
            "Brand details changed. Reload before saving.",
          );
        await tx.brandBrain.create({
          data: {
            organizationId: req.organizationId,
            profile: data.profile,
            creativeDna: data.creativeDna,
          },
        });
      } else {
        const updated = await tx.brandBrain.updateMany({
          where: {
            organizationId: req.organizationId,
            revision: data.revision,
          },
          data: {
            profile: data.profile,
            creativeDna: data.creativeDna,
            revision: { increment: 1 },
          },
        });
        if (!updated.count)
          throw new ConflictException(
            "Brand details changed. Reload before saving.",
          );
      }
      const brain = await tx.brandBrain.findUniqueOrThrow({
        where: { organizationId: req.organizationId },
      });
      await tx.brandVersion.create({
        data: {
          organizationId: req.organizationId,
          profile: data.profile,
          creativeDna: data.creativeDna,
          revision: brain.revision,
          actorId: req.userId,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: req.organizationId,
          actorId: req.userId,
          action: "brand.saved",
          detail: { revision: brain.revision },
        },
      });
      return {
        brain,
        progress: completeness(brain.profile, brain.creativeDna),
      };
    });
  }
  @Get("versions") versions(@Req() req: AuthedRequest) {
    return this.db.brandVersion.findMany({
      where: { organizationId: req.organizationId },
      orderBy: { revision: "desc" },
      take: 50,
    });
  }
  @Post("restore/:revision") @Roles("OWNER", "ADMIN", "EDITOR") async restore(
    @Req() req: AuthedRequest,
    @Param("revision") revision: string,
    @Body() body: unknown,
  ) {
    const n = z.coerce.number().int().positive().parse(revision);
    const input = parse(
      z.object({ revision: z.number().int().positive() }).strict(),
      body,
    );
    const previous = await this.db.brandVersion.findUnique({
      where: {
        organizationId_revision: {
          organizationId: req.organizationId,
          revision: n,
        },
      },
    });
    if (!previous) throw new NotFoundException("Brand version not found.");
    return this.save(req, {
      profile: previous.profile,
      creativeDna: previous.creativeDna,
      revision: input.revision,
    });
  }
}
@Module({ controllers: [BrandController], providers: [TenantGuard] })
export class BrandModule {}
