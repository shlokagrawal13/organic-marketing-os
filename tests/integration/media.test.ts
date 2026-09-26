import "../support/isolated";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const db = new PrismaClient(),
  orgs: string[] = [],
  users: string[] = [];
const base = process.env.TEST_API_URL || "http://127.0.0.1:4000/api";
function client() {
  let cookie = "";
  return {
    get cookie() {
      return cookie;
    },
    async call(path: string, method = "GET", data?: unknown) {
      const r = await fetch(base + path, {
        method,
        headers: {
          cookie,
          "X-Requested-With": "MarketingOS",
          "Content-Type": "application/json",
        },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      });
      const set = r.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0];
      return { status: r.status, body: await r.json() };
    },
    async upload(
      org: string,
      bytes: Buffer,
      name: string,
      mime: string,
      rights = "true",
    ) {
      const form = new FormData();
      form.set("file", new Blob([new Uint8Array(bytes)], { type: mime }), name);
      form.set("rightsConfirmed", rights);
      form.set("tags", "product, qa");
      form.set(
        "rightsNote",
        "Synthetic test media created by the verification harness",
      );
      const r = await fetch(base + `/workspaces/${org}/assets`, {
        method: "POST",
        headers: { cookie, "X-Requested-With": "MarketingOS" },
        body: form,
      });
      return { status: r.status, body: await r.json() };
    },
    raw(path: string, headers: Record<string, string> = {}) {
      return fetch(base + path, { headers: { cookie, ...headers } });
    },
  };
}
after(async () => {
  await db.renderJob.deleteMany({ where: { organizationId: { in: orgs } } });
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});
test(
  "private uploads, real MP4/audio rendering, tenant isolation, cache reuse, cancellation and exact-version approval",
  { timeout: 120000 },
  async () => {
    const a = client(),
      b = client(),
      suffix = randomUUID();
    for (const [c, name] of [
      [a, "Media owner"],
      [b, "Media outsider"],
    ] as const) {
      const r = await c.call("/auth/register", "POST", {
        name,
        email: `${name.replaceAll(" ", "")}-${suffix}@example.test`,
        password: "A secure test password 123",
      });
      assert.equal(r.status, 201);
      users.push(r.body.user.id);
      const o = await c.call("/organizations", "POST", {
        name: name + " workspace",
        timezone: "Asia/Kolkata",
      });
      assert.equal(o.status, 201);
      orgs.push(o.body.id);
    }
    const org = orgs[0],
      root = `/workspaces/${org}`,
      other = `/workspaces/${orgs[1]}`;
    assert.equal((await a.call(root + "/assets/status")).body.available, true);
    const image = readFileSync(".local/media-fixtures/product.png"),
      audio = readFileSync(".local/media-fixtures/tone.wav"),
      clip = readFileSync(".local/media-fixtures/clip.mp4");
    assert.equal(
      (
        await a.upload(
          org,
          Buffer.from("<html>not a media file</html>"),
          "fake.png",
          "image/png",
        )
      ).status,
      400,
    );
    assert.equal(
      (await a.upload(org, image, "product.png", "image/png", "false")).status,
      400,
    );
    const up = await a.upload(org, image, "product.png", "image/png");
    assert.equal(up.status, 201, JSON.stringify(up.body));
    assert.equal(up.body.asset.width, 640);
    assert.equal(up.body.asset.kind, "IMAGE");
    assert.equal("objectKey" in up.body.asset, false);
    const imageId = up.body.asset.id;
    const dup = await a.upload(org, image, "duplicate.png", "image/png");
    assert.equal(dup.body.deduplicated, true);
    assert.equal(dup.body.asset.id, imageId);
    const au = await a.upload(org, audio, "tone.wav", "audio/wav");
    assert.equal(au.status, 201, JSON.stringify(au.body));
    const audioId = au.body.asset.id;
    const vi = await a.upload(org, clip, "clip.mp4", "video/mp4");
    assert.equal(vi.status, 201, JSON.stringify(vi.body));
    const videoId = vi.body.asset.id;
    assert.equal((await b.raw(`${root}/assets/${imageId}/file`)).status, 404);
    assert.equal((await b.raw(`${other}/assets/${imageId}/file`)).status, 404);
    assert.equal(
      (await fetch(base + `${root}/assets/${imageId}/file`)).status,
      401,
    );
    const range = await a.raw(`${root}/assets/${imageId}/file`, {
      Range: "bytes=0-7",
    });
    assert.equal(range.status, 206);
    assert.equal((await range.arrayBuffer()).byteLength, 8);
    assert.equal(
      (
        await a.raw(`${root}/assets/${imageId}/file`, {
          Range: "bytes=99999999-",
        })
      ).status,
      416,
    );
    assert.equal((await a.call(root + "/assets?q=qa")).body.total, 3);
    const scene = (id: string, visualAssetId: string) => ({
      id,
      purpose: "Test media pipeline",
      duration: 2,
      voiceover: "Test-only narration placeholder",
      visual: "Uploaded fixture",
      onScreenText: "Plan smarter · 100% your brand",
      caption: "Test-only timed caption",
      transition: "Cut",
      music: "",
      sfx: "",
      cta: "",
      visualAssetId,
      audioAssetId: audioId,
    });
    let draft: any = {
      title: "Verified media workflow",
      platform: "Instagram",
      format: "Video",
      hook: "Plan your next move",
      body: "This is an integration verification video.",
      cta: "Start with your brand",
      scenes: [scene("one", imageId), scene("two", videoId)],
      campaignId: null,
      plannedAt: null,
    };
    const forged = await b.call(other + "/content", "POST", draft);
    assert.equal(forged.status, 400);
    const created = await a.call(root + "/content", "POST", draft);
    assert.equal(created.status, 201);
    const id = created.body.id;
    await a.call(`${root}/content/${id}/review`, "POST", { revision: 1 });
    await a.call(`${root}/content/${id}/approve`, "POST", {
      revision: 1,
      factsAndRightsReviewed: true,
    });
    const requestKey = randomUUID(),
      payload = {
        contentId: id,
        revision: 1,
        requestKey,
        options: { aspect: "9:16", resolution: "720", musicAssetId: audioId },
      };
    const queued = await a.call(root + "/renders", "POST", payload);
    assert.equal(queued.status, 201, JSON.stringify(queued.body));
    assert.equal("outputKey" in queued.body, false);
    assert.equal(
      (await a.call(root + "/renders", "POST", payload)).body.id,
      queued.body.id,
    );
    assert.equal(
      (
        await a.call(root + "/renders", "POST", {
          ...payload,
          options: { aspect: "1:1" },
        })
      ).status,
      409,
    );
    const wait = async (renderId: string) => {
      for (let i = 0; i < 120; i++) {
        const row = await a.call(`${root}/renders/${renderId}`);
        if (["SUCCEEDED", "FAILED", "CANCELED"].includes(row.body.status))
          return row.body;
        await new Promise((r) => setTimeout(r, 500));
      }
      throw new Error("Render did not finish within 60 seconds");
    };
    const rendered = await wait(queued.body.id);
    assert.equal(rendered.status, "SUCCEEDED", JSON.stringify(rendered));
    assert.equal(rendered.width, 720);
    assert.equal(rendered.height, 1280);
    assert.equal(rendered.duration, 4);
    const video = await a.raw(
      `${root}/renders/${rendered.id}/file/video?download=1`,
    );
    assert.equal(video.status, 200);
    assert.match(video.headers.get("content-disposition") || "", /attachment/);
    writeFileSync(
      ".local/render-preview.mp4",
      Buffer.from(await video.arrayBuffer()),
    );
    const pcm = execFileSync(
      process.env.FFMPEG_PATH || "ffmpeg",
      [
        "-v",
        "error",
        "-i",
        ".local/render-preview.mp4",
        "-f",
        "s16le",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-",
      ],
      { maxBuffer: 2 * 1024 * 1024 },
    );
    let peak = 0;
    for (let i = 0; i < pcm.length - 1; i += 2)
      peak = Math.max(peak, Math.abs(pcm.readInt16LE(i)));
    assert.ok(
      peak > 1000,
      "uploaded narration/music must be audible, not a silent placeholder",
    );
    const thumbnail = await a.raw(
      `${root}/renders/${rendered.id}/file/thumbnail`,
    );
    assert.equal(thumbnail.status, 200);
    writeFileSync(
      ".local/render-thumbnail.jpg",
      Buffer.from(await thumbnail.arrayBuffer()),
    );
    const captions = await (
      await a.raw(`${root}/renders/${rendered.id}/file/captions`)
    ).text();
    assert.match(captions, /00:00:02,000 --> 00:00:04,000/);
    const seek = await a.raw(`${root}/renders/${rendered.id}/file/video`, {
      Range: "bytes=0-99",
    });
    assert.equal(seek.status, 206);
    assert.equal((await seek.arrayBuffer()).byteLength, 100);
    assert.equal((await b.call(`${root}/renders/${rendered.id}`)).status, 404);
    assert.equal(
      (await b.raw(`${other}/renders/${rendered.id}/file/video`)).status,
      404,
    );
    assert.equal(
      (
        await a.call(`${root}/renders/${rendered.id}/approve`, "POST", {
          reviewed: false,
        })
      ).status,
      400,
    );
    const approved = await a.call(
      `${root}/renders/${rendered.id}/approve`,
      "POST",
      { reviewed: true },
    );
    assert.equal(approved.status, 201, JSON.stringify(approved.body));
    await db.membership.create({
      data: { userId: users[1], organizationId: org, role: "ANALYST" },
    });
    assert.equal(
      (await b.upload(org, image, "no.png", "image/png")).status,
      403,
    );
    assert.equal(
      (
        await b.call(root + "/renders", "POST", {
          ...payload,
          requestKey: randomUUID(),
        })
      ).status,
      403,
    );
    draft = {
      ...draft,
      scenes: draft.scenes.map((s: any, i: number) =>
        i === 0 ? { ...s, onScreenText: "A new opening scene" } : s,
      ),
    };
    assert.equal(
      (await a.call(`${root}/content/${id}`, "PUT", { ...draft, revision: 1 }))
        .status,
      200,
    );
    const old = (await a.call(`${root}/renders/${rendered.id}`)).body;
    assert.equal(old.approvedAt, null);
    assert.equal(old.stale, true);
    assert.equal(
      (
        await a.call(`${root}/renders/${rendered.id}/approve`, "POST", {
          reviewed: true,
        })
      ).status,
      409,
    );
    const next = await a.call(root + "/renders", "POST", {
      ...payload,
      revision: 2,
      requestKey: randomUUID(),
    });
    const rerendered = await wait(next.body.id);
    assert.equal(rerendered.status, "SUCCEEDED");
    assert.equal(
      rerendered.reusedScenes,
      1,
      "unchanged second scene should be reused",
    );
    const cancel = await a.call(root + "/renders", "POST", {
      ...payload,
      revision: 2,
      requestKey: randomUUID(),
    });
    assert.equal(
      (await a.call(`${root}/renders/${cancel.body.id}/cancel`, "POST")).status,
      201,
    );
    assert.equal((await wait(cancel.body.id)).status, "CANCELED");
    const retry = await a.call(
      `${root}/renders/${cancel.body.id}/retry`,
      "POST",
      { requestKey: randomUUID() },
    );
    assert.equal(retry.status, 201);
    const retried = await wait(retry.body.id);
    assert.equal(retried.status, "SUCCEEDED");
    assert.equal(retried.reusedScenes, 2);
    assert.equal(
      (await a.call(`${root}/assets/${imageId}`, "PATCH", { archived: true }))
        .status,
      200,
    );
    assert.equal((await a.call(root + "/assets")).body.total, 2);
    assert.equal(
      (
        await a.call(root + "/renders", "POST", {
          ...payload,
          revision: 2,
          requestKey: randomUUID(),
        })
      ).status,
      400,
    );
    assert.equal(
      (await a.raw(`${root}/renders/${rendered.id}/file/video`)).status,
      200,
      "archiving inputs preserves prior renders",
    );
    await a.call(`${root}/assets/${imageId}`, "PATCH", { archived: false });
    const alternate = {
      ...draft,
      title: "Aspect and caption verification",
      scenes: [
        {
          ...draft.scenes[0],
          duration: 2,
          transition: "Fade",
          onScreenText:
            "A clear message should stay readable in every aspect ratio. This longer headline checks the available space without covering the caption below.",
          caption:
            "This deliberately longer test caption verifies automatic text wrapping in the lower safe area of both landscape and square video. It is a QA fixture, not generated marketing copy.",
        },
      ],
    };
    const alternateContent = await a.call(root + "/content", "POST", alternate);
    assert.equal(alternateContent.status, 201);
    for (const [aspect, resolution, width, height] of [
      ["16:9", "1080", 1920, 1080],
      ["1:1", "720", 720, 720],
    ] as const) {
      const alt = await a.call(root + "/renders", "POST", {
        contentId: alternateContent.body.id,
        revision: 1,
        requestKey: randomUUID(),
        options: { aspect, resolution },
      });
      assert.equal(alt.status, 201, JSON.stringify(alt.body));
      const ready = await wait(alt.body.id);
      assert.equal(ready.status, "SUCCEEDED");
      assert.equal(ready.width, width);
      assert.equal(ready.height, height);
      const thumbnail = await a.raw(
        `${root}/renders/${ready.id}/file/thumbnail`,
      );
      writeFileSync(
        `.local/render-${width}x${height}.jpg`,
        Buffer.from(await thumbnail.arrayBuffer()),
      );
    }
  },
);
