import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { readFile, writeFile } from "node:fs/promises";

export class ObjectStore {
  readonly bucket = process.env.S3_BUCKET || "marketing-assets";
  readonly configured = Boolean(
    process.env.S3_BUCKET &&
    (process.env.S3_ACCESS_KEY || process.env.AWS_REGION),
  );
  readonly client = new S3Client({
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION || "us-east-1",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    ...(process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY
      ? {
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY,
            secretAccessKey: process.env.S3_SECRET_KEY,
          },
        }
      : {}),
    maxAttempts: 2,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    requestHandler: { connectionTimeout: 4000, requestTimeout: 30000 },
  });
  async ready() {
    if (!this.configured) throw new Error("Media storage is not configured.");
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (e: any) {
      if (
        e.$metadata?.httpStatusCode !== 404 ||
        process.env.S3_AUTO_CREATE_BUCKET !== "true"
      )
        throw e;
      try {
        await this.client.send(
          new CreateBucketCommand({
            Bucket: this.bucket,
            ...((process.env.S3_REGION || "us-east-1") !== "us-east-1"
              ? {
                  CreateBucketConfiguration: {
                    LocationConstraint: process.env.S3_REGION as any,
                  },
                }
              : {}),
          }),
        );
      } catch (create: any) {
        if (
          !["BucketAlreadyOwnedByYou", "BucketAlreadyExists"].includes(
            create.name,
          )
        )
          throw create;
      }
    }
  }
  async put(key: string, body: Buffer, mime: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentLength: body.length,
        ContentType: mime,
        CacheControl: "private, no-store",
      }),
    );
  }
  async putFile(key: string, path: string, mime: string) {
    await this.put(key, await readFile(path), mime);
  }
  async get(key: string, range?: string) {
    return this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ...(range ? { Range: range } : {}),
      }),
    );
  }
  async read(key: string, maxBytes: number) {
    const r = await this.get(key),
      chunks: Buffer[] = [];
    let bytes = 0;
    if (!r.Body) throw new Error("Stored media is unavailable.");
    try {
      for await (const chunk of r.Body as any) {
        const b = Buffer.from(chunk);
        bytes += b.length;
        if (bytes > maxBytes)
          throw new Error("Stored media exceeds its size limit.");
        chunks.push(b);
      }
    } finally {
      (r.Body as any).destroy?.();
    }
    return Buffer.concat(chunks);
  }
  async download(key: string, path: string, maxBytes: number) {
    await writeFile(path, await this.read(key, maxBytes), { mode: 0o600 });
  }
  async remove(key: string) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
