import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Module,
  Injectable,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  HttpException,
  CanActivate,
  ExecutionContext,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { pipeline } from "node:stream/promises";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  Db,
  Cache,
  TenantGuard,
  AuthedRequest,
  Roles,
  writerRoles,
  idSchema,
} from "./common";
import { ObjectStore } from "../../../packages/core/object-store";
import {
  MAX_UPLOAD_BYTES,
  sha256,
  sniffMedia,
  probeMedia,
  validateProbe,
  Scene,
} from "../../../packages/core/media";

const publicAsset = (row: any) => {
  const { objectKey, sha256, ...safe } = row;
  return safe;
};
@Injectable()
export class MediaStorage extends ObjectStore {}
@Injectable()
class UploadGuard implements CanActivate {
  constructor(private cache: Cache) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const count = Number(
      await this.cache.client.eval(
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
        1,
        `upload-rate:${req.userId}`,
      ),
    );
    if (count > 20)
      throw new HttpException(
        "Upload limit reached. Please wait a minute.",
        429,
      );
    return true;
  }
}
export async function assertSceneAssets(
  tx: any,
  org: string,
  scenes: Scene[],
  extraAudio?: string | null,
) {
  const ids = [
    ...new Set(
      scenes
        .flatMap((s) => [s.visualAssetId, s.audioAssetId])
        .concat(extraAudio || null)
        .filter(Boolean),
    ),
  ] as string[];
  const rows = await tx.asset.findMany({
    where: { id: { in: ids }, organizationId: org, archivedAt: null },
  });
  if (rows.length !== ids.length)
    throw new BadRequestException(
      "Choose active assets belonging to this workspace.",
    );
  const map = new Map<string, any>(rows.map((r: any) => [r.id, r]));
  for (const s of scenes) {
    if (
      s.visualAssetId &&
      !["IMAGE", "VIDEO"].includes(map.get(s.visualAssetId)?.kind)
    )
      throw new BadRequestException("Scene visuals must be images or videos.");
    if (s.audioAssetId && map.get(s.audioAssetId)?.kind !== "AUDIO")
      throw new BadRequestException("Scene narration must be an audio asset.");
  }
  if (extraAudio && map.get(extraAudio)?.kind !== "AUDIO")
    throw new BadRequestException("Background music must be an audio asset.");
  return rows;
}
export async function streamStored(
  store: ObjectStore,
  req: AuthedRequest,
  res: Response,
  key: string,
  mime: string,
  name: string,
  bytes: number,
) {
  let range: string | undefined;
  if (req.headers.range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    const start = m?.[1] ? Number(m[1]) : Math.max(0, bytes - Number(m?.[2]));
    const end = m?.[1] && m[2] ? Math.min(bytes - 1, Number(m[2])) : bytes - 1;
    if (
      !m ||
      (!m[1] && !m[2]) ||
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      start >= bytes ||
      end < start
    ) {
      res.setHeader("Content-Range", `bytes */${bytes}`);
      throw new HttpException("Requested range is unavailable.", 416);
    }
    range = `bytes=${start}-${end}`;
  }
  try {
    const object = await store.get(key, range);
    res.status(range ? 206 : 200);
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader(
      "Content-Disposition",
      `${req.query.download === "1" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(name).replace(/'/g, "%27")}`,
    );
    if (object.ContentLength !== undefined)
      res.setHeader("Content-Length", object.ContentLength);
    if (object.ContentRange)
      res.setHeader("Content-Range", object.ContentRange);
    await pipeline(object.Body as any, res);
  } catch (e: any) {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    if (e.$metadata?.httpStatusCode === 404)
      throw new NotFoundException("Stored file is unavailable.");
    throw new ServiceUnavailableException(
      "Media storage is unavailable. Try again shortly.",
    );
  }
}
@Controller("workspaces/:organizationId/assets")
@UseGuards(TenantGuard)
export class AssetsController {
  constructor(
    private db: Db,
    private store: MediaStorage,
    private cache: Cache,
  ) {}
  @Get("status") async status() {
    let available = false;
    try {
      await this.store.ready();
      available = true;
    } catch {}
    return {
      configured: this.store.configured,
      available,
      maxUploadBytes: MAX_UPLOAD_BYTES,
      renderWorkerOnline: Boolean(
        await this.cache.client.get("render:heartbeat"),
      ),
    };
  }
  @Get() async list(@Req() req: AuthedRequest, @Query() query: unknown) {
    const q = z
      .object({
        q: z.string().max(200).default(""),
        kind: z.enum(["IMAGE", "VIDEO", "AUDIO"]).optional(),
        archived: z.enum(["true", "false"]).default("false"),
        skip: z.coerce.number().int().min(0).default(0),
        take: z.coerce.number().int().min(1).max(100).default(50),
      })
      .parse(query);
    const where: any = {
      organizationId: req.organizationId,
      archivedAt: q.archived === "true" ? { not: null } : null,
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q, mode: "insensitive" } },
              { tags: { has: q.q.toLowerCase() } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.asset.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: q.skip,
        take: q.take,
      }),
      this.db.asset.count({ where }),
    ]);
    return { items: items.map(publicAsset), total };
  }
  @Post()
  @Roles(...writerRoles)
  @UseGuards(UploadGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: MAX_UPLOAD_BYTES,
        files: 1,
        fields: 4,
        fieldSize: 4000,
      },
    }),
  )
  async upload(
    @Req() req: AuthedRequest,
    @UploadedFile() file: { buffer: Buffer; originalname: string },
    @Body() body: unknown,
  ) {
    const data = z
      .object({
        rightsConfirmed: z.literal("true"),
        rightsNote: z.string().max(1000).default(""),
        tags: z.string().max(400).default(""),
      })
      .strict()
      .parse(body);
    if (!file?.buffer?.length)
      throw new BadRequestException("Choose a file to upload.");
    let detected;
    try {
      detected = sniffMedia(file.buffer);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    const name =
      file.originalname
        .split(/[\\/]/)
        .pop()!
        .replace(/[\x00-\x1f\x7f]/g, "")
        .slice(0, 160) || `asset.${detected.extension}`;
    const hash = sha256(file.buffer),
      unique = {
        organizationId_sha256: {
          organizationId: req.organizationId,
          sha256: hash,
        },
      };
    const existing = await this.db.asset.findUnique({ where: unique });
    if (existing) {
      return { asset: publicAsset(existing), deduplicated: true };
    }
    const temp = await mkdtemp(join(tmpdir(), "mos-upload-"));
    let metadata;
    try {
      const path = join(temp, `input.${detected.extension}`);
      await writeFile(path, file.buffer, { mode: 0o600 });
      metadata = validateProbe(await probeMedia(path), detected.kind);
    } catch (e) {
      console.error(
        JSON.stringify({
          event: "asset.validation_failed",
          requestId: req.requestId,
          message: (e as Error).message.slice(0, 1200),
        }),
      );
      throw new BadRequestException(
        (e as Error).message.startsWith("Media tool")
          ? "Media validation is unavailable. Check the FFprobe installation."
          : "Invalid or unsupported media. Use valid JPEG/PNG/WebP images, H.264 MP4 video, or MP3/WAV audio up to 180 seconds.",
      );
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
    const id = randomUUID(),
      objectKey = `${req.organizationId}/assets/${id}.${detected.extension}`;
    try {
      await this.store.ready();
      await this.store.put(objectKey, file.buffer, detected.mimeType);
    } catch {
      throw new ServiceUnavailableException(
        "Media storage is unavailable. Check its configuration and try again.",
      );
    }
    let keep = false;
    try {
      const result = await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${req.organizationId} FOR UPDATE`;
        const duplicate = await tx.asset.findUnique({ where: unique });
        if (duplicate)
          return { asset: publicAsset(duplicate), deduplicated: true };
        const used = await tx.asset.aggregate({
          where: { organizationId: req.organizationId },
          _sum: { bytes: true },
        });
        if (
          (used._sum.bytes || 0) + file.buffer.length >
          2 * 1024 * 1024 * 1024
        )
          throw new BadRequestException(
            "The workspace upload allowance of 2 GB is full. Contact your administrator.",
          );
        const row = await tx.asset.create({
          data: {
            id,
            organizationId: req.organizationId,
            name,
            kind: detected.kind,
            mimeType: detected.mimeType,
            bytes: file.buffer.length,
            sha256: hash,
            objectKey,
            ...metadata,
            tags: [
              ...new Set(
                data.tags
                  .split(",")
                  .map((t) => t.trim().toLowerCase())
                  .filter(Boolean),
              ),
            ]
              .slice(0, 10)
              .map((t) => t.slice(0, 40)),
            rightsNote: data.rightsNote,
            createdBy: req.userId,
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: req.organizationId,
            actorId: req.userId,
            action: "asset.uploaded",
            entityId: id,
            detail: { kind: row.kind, bytes: row.bytes, rightsConfirmed: true },
          },
        });
        return { asset: publicAsset(row), deduplicated: false };
      });
      keep = !result.deduplicated;
      return result;
    } finally {
      if (!keep) await this.store.remove(objectKey).catch(() => {});
    }
  }
  @Get(":id/file") async file(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const asset = await this.db.asset.findFirst({
      where: { id: idSchema.parse(id), organizationId: req.organizationId },
    });
    if (!asset) throw new NotFoundException("Asset not found.");
    return streamStored(
      this.store,
      req,
      res,
      asset.objectKey,
      asset.mimeType,
      asset.name,
      asset.bytes,
    );
  }
  @Patch(":id") @Roles(...writerRoles) async edit(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const data = z
      .object({
        name: z.string().trim().min(1).max(160).optional(),
        tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
        archived: z.boolean().optional(),
      })
      .strict()
      .parse(body);
    return this.db.$transaction(async (tx) => {
      const changed = await tx.asset.updateMany({
        where: { id: idSchema.parse(id), organizationId: req.organizationId },
        data: {
          ...(data.name ? { name: data.name } : {}),
          ...(data.tags
            ? { tags: [...new Set(data.tags.map((t) => t.toLowerCase()))] }
            : {}),
          ...(data.archived !== undefined
            ? { archivedAt: data.archived ? new Date() : null }
            : {}),
        },
      });
      if (!changed.count) throw new NotFoundException("Asset not found.");
      await tx.auditLog.create({
        data: {
          organizationId: req.organizationId,
          actorId: req.userId,
          action:
            data.archived === true
              ? "asset.archived"
              : data.archived === false
                ? "asset.restored"
                : "asset.updated",
          entityId: id,
        },
      });
      return publicAsset(await tx.asset.findUniqueOrThrow({ where: { id } }));
    });
  }
}
@Module({
  controllers: [AssetsController],
  providers: [MediaStorage, UploadGuard],
  exports: [MediaStorage],
})
export class AssetsModule {}
