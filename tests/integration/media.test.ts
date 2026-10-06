import "../support/isolated";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { probeMedia, validateRenderedProbe } from "../../packages/core/media";
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
      onScreenText: "Plan smarter · Caf\u00e9 \u03b1 \u0416",
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
    draft.scenes[0].captionCues = [
      { start: 0.25, end: 1.5, text: "Manual cue" },
    ];
    for (const captionCues of [
      [{ start: 1, end: 3, text: "Outside scene" }],
      [
        { start: 0, end: 1, text: "One" },
        { start: 0.5, end: 2, text: "Overlap" },
      ],
    ]) {
      const invalid = await a.call(root + "/content", "POST", {
        ...draft,
        scenes: [{ ...draft.scenes[0], captionCues }],
      });
      assert.equal(invalid.status, 400, "invalid cues rejected before saving");
    }
    const created = await a.call(root + "/content", "POST", draft);
    assert.equal(created.status, 201);
    assert.equal(created.body.scenes[0].visualFit, "contain");
    assert.equal(
      (
        await a.call(root + "/content", "POST", {
          ...draft,
          scenes: [{ ...draft.scenes[0], visualFit: "cover,crop=1:1" }],
        })
      ).status,
      400,
    );
    assert.deepEqual(
      created.body.scenes[0].captionCues,
      draft.scenes[0].captionCues,
    );
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
    validateRenderedProbe(
      await probeMedia(".local/render-preview.mp4"),
      rendered.width,
      rendered.height,
      rendered.duration,
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
    assert.match(captions, /00:00:00,250 --> 00:00:01,500\nManual cue/);
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
        i === 0
          ? { ...s, captionCues: [{ ...s.captionCues[0], start: 0.5 }] }
          : s,
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
      "caption timing edit invalidates only the first scene's cache",
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
          captionCues: [],
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
    await a.call(`${root}/content/${alternateContent.body.id}/review`, "POST", {
      revision: 1,
    });
    await a.call(
      `${root}/content/${alternateContent.body.id}/approve`,
      "POST",
      { revision: 1, factsAndRightsReviewed: true },
    );
    const beforePresets = (
      await a.call(`${root}/content/${alternateContent.body.id}`)
    ).body;
    assert.equal(beforePresets.item.status, "APPROVED");
    const presetPayload = {
      contentId: alternateContent.body.id,
      revision: 1,
      requestKey: randomUUID(),
      options: { preset: "vertical-social-v1" },
    };
    assert.equal(
      (
        await a.call(root + "/renders", "POST", {
          ...presetPayload,
          revision: 2,
        })
      ).status,
      409,
    );
    assert.equal(
      (await b.call(root + "/renders", "POST", presetPayload)).status,
      403,
    );
    assert.equal(
      (await b.call(other + "/renders", "POST", presetPayload)).status,
      404,
    );
    for (const options of [
      { preset: "unknown" },
      { textPlacement: "unknown" },
      { preset: "vertical-social-v1", aspect: "1:1" },
      { preset: "square-feed-v1", resolution: "720" },
    ]) {
      assert.equal(
        (
          await a.call(root + "/renders", "POST", {
            contentId: alternateContent.body.id,
            revision: 1,
            requestKey: randomUUID(),
            options,
          })
        ).status,
        400,
      );
    }
    const unsupportedText = await a.call(root + "/content", "POST", {
      ...alternate,
      title: "Unsupported render text preflight",
      scenes: [
        {
          ...alternate.scenes[0],
          onScreenText: "নমস্কার",
          caption:
            "The API must explain unsupported rendered text before queueing.",
        },
      ],
    });
    assert.equal(unsupportedText.status, 201);
    const beforeUnsupported = await db.renderJob.count({
      where: { organizationId: org },
    });
    const unsupportedRender = await a.call(root + "/renders", "POST", {
      contentId: unsupportedText.body.id,
      revision: 1,
      requestKey: randomUUID(),
      options: { preset: "square-feed-v1" },
    });
    assert.equal(unsupportedRender.status, 400);
    assert.match(JSON.stringify(unsupportedRender.body), /Bengali/);
    assert.equal(
      await db.renderJob.count({ where: { organizationId: org } }),
      beforeUnsupported,
      "unsupported render text is rejected before a job is queued",
    );
    const srtOnlyContent = await a.call(root + "/content", "POST", {
      ...alternate,
      title: "Unburned multilingual SRT",
      scenes: [
        {
          ...alternate.scenes[0],
          onScreenText: "Supported title",
          caption: "নমস্কার",
        },
      ],
    });
    assert.equal(srtOnlyContent.status, 201);
    const srtOnlyPayload = {
      contentId: srtOnlyContent.body.id,
      revision: 1,
      requestKey: randomUUID(),
      options: { captions: true },
    };
    const burnedUnsupported = await a.call(
      root + "/renders",
      "POST",
      srtOnlyPayload,
    );
    assert.equal(burnedUnsupported.status, 400);
    assert.match(
      JSON.stringify(burnedUnsupported.body),
      /caption cue 1.*Bengali/,
    );
    const srtOnlyRender = await a.call(root + "/renders", "POST", {
      ...srtOnlyPayload,
      options: { captions: false },
    });
    assert.equal(srtOnlyRender.status, 201, JSON.stringify(srtOnlyRender.body));
    const srtOnlyReady = await wait(srtOnlyRender.body.id);
    assert.equal(
      srtOnlyReady.status,
      "SUCCEEDED",
      JSON.stringify(srtOnlyReady),
    );
    assert.match(
      await (
        await a.raw(`${root}/renders/${srtOnlyReady.id}/file/captions`)
      ).text(),
      /নমস্কার/,
    );
    const rtlContent = await a.call(root + "/content", "POST", {
      ...alternate,
      title: "Configured RTL render text",
      scenes: [
        {
          ...alternate.scenes[0],
          onScreenText: "مرحبا بالعالم",
          caption: "שלום עולם",
        },
      ],
    });
    assert.equal(rtlContent.status, 201);
    const rtlRender = await a.call(root + "/renders", "POST", {
      contentId: rtlContent.body.id,
      revision: 1,
      requestKey: randomUUID(),
      options: { preset: "square-feed-v1", captions: true },
    });
    assert.equal(rtlRender.status, 201, JSON.stringify(rtlRender.body));
    const rtlReady = await wait(rtlRender.body.id);
    assert.equal(rtlReady.status, "SUCCEEDED", JSON.stringify(rtlReady));
    assert.ok(rtlReady.outputBytes > 0);
    assert.match(
      await (
        await a.raw(`${root}/renders/${rtlReady.id}/file/captions`)
      ).text(),
      /שלום עולם/,
    );
    const hindiContent = await a.call(root + "/content", "POST", {
      ...alternate,
      title: "Configured Devanagari render text",
      scenes: [
        {
          ...alternate.scenes[0],
          onScreenText: "Video 2026: हिंदी में वीडियो शिक्षा",
          caption: "Start now: प्रशिक्षण और नई शुरुआत",
        },
      ],
    });
    assert.equal(hindiContent.status, 201);
    const hindiJob = await a.call(root + "/renders", "POST", {
      contentId: hindiContent.body.id,
      revision: 1,
      requestKey: randomUUID(),
      options: { preset: "square-feed-v1", captions: true },
    });
    assert.equal(hindiJob.status, 201, JSON.stringify(hindiJob.body));
    const hindiReady = await wait(hindiJob.body.id);
    assert.equal(hindiReady.status, "SUCCEEDED", JSON.stringify(hindiReady));
    assert.ok(hindiReady.outputBytes > 0);
    assert.match(
      await (
        await a.raw(`${root}/renders/${hindiReady.id}/file/captions`)
      ).text(),
      /Start now: प्रशिक्षण और नई शुरुआत/,
    );
    const missingGlyphContent = await a.call(root + "/content", "POST", {
      ...alternate,
      title: "Configured font missing glyph",
      scenes: [
        { ...alternate.scenes[0], onScreenText: "\u{1df00}", caption: "" },
      ],
    });
    assert.equal(missingGlyphContent.status, 201);
    const beforeFontSegments = await db.renderSegment.count({
      where: { organizationId: org },
    });
    const missingGlyphJob = await a.call(root + "/renders", "POST", {
      contentId: missingGlyphContent.body.id,
      revision: 1,
      requestKey: randomUUID(),
      options: {},
    });
    assert.equal(
      missingGlyphJob.status,
      201,
      JSON.stringify(missingGlyphJob.body),
    );
    const missingGlyphResult = await wait(missingGlyphJob.body.id);
    assert.equal(missingGlyphResult.status, "FAILED");
    assert.match(
      missingGlyphResult.error,
      /on-screen text.*configured render font.*U\+1DF00/,
    );
    assert.doesNotMatch(missingGlyphResult.error, /\/usr\/|\.ttf|node_modules/);
    assert.equal(missingGlyphResult.outputBytes, null);
    assert.equal(
      await db.renderSegment.count({ where: { organizationId: org } }),
      beforeFontSegments,
    );
    const overfullContent = await a.call(root + "/content", "POST", {
      ...alternate,
      title: "Bounded caption layout",
      scenes: [
        {
          ...alternate.scenes[0],
          onScreenText: "Short title",
          caption: "W".repeat(300),
        },
      ],
    });
    assert.equal(overfullContent.status, 201);
    const overfullJob = await a.call(root + "/renders", "POST", {
      contentId: overfullContent.body.id,
      revision: 1,
      requestKey: randomUUID(),
      options: { aspect: "1:1", resolution: "720" },
    });
    assert.equal(overfullJob.status, 201);
    const overfullResult = await wait(overfullJob.body.id);
    assert.equal(overfullResult.status, "FAILED");
    assert.match(
      overfullResult.error,
      /caption cue 1.*minimum readable font size/,
    );
    assert.doesNotMatch(overfullResult.error, /\/usr\/|\.ttf|node_modules/);
    assert.equal(overfullResult.outputBytes, null);
    assert.equal(
      await db.renderSegment.count({ where: { organizationId: org } }),
      beforeFontSegments,
    );
    for (const [preset, width, height] of [
      ["vertical-social-v1", 1080, 1920],
      ["landscape-video-v1", 1920, 1080],
      ["square-feed-v1", 1080, 1080],
    ] as const) {
      const alt = await a.call(root + "/renders", "POST", {
        contentId: alternateContent.body.id,
        revision: 1,
        requestKey: randomUUID(),
        options: { preset, textPlacement: "inset-v1" },
      });
      assert.equal(alt.status, 201, JSON.stringify(alt.body));
      const ready = await wait(alt.body.id);
      assert.equal(ready.status, "SUCCEEDED");
      assert.equal(ready.width, width);
      assert.equal(ready.height, height);
      assert.equal(ready.options.preset, preset);
      assert.equal(ready.options.textPlacement, "inset-v1");
      assert.deepEqual(ready.snapshot.scenes, beforePresets.item.scenes);
      assert.equal(ready.contentRevision, beforePresets.item.revision);
      assert.equal(ready.approvedAt, null);
      const replay = await a.call(root + "/renders", "POST", {
        contentId: alternateContent.body.id,
        revision: 1,
        requestKey: alt.body.requestKey,
        options: ready.options,
      });
      assert.equal(
        replay.body.id,
        ready.id,
        "expanded options keep the same idempotency hash",
      );
      const custom = await a.call(root + "/renders", "POST", {
        contentId: alternateContent.body.id,
        revision: 1,
        requestKey: randomUUID(),
        options: {
          aspect: ready.options.aspect,
          resolution: ready.options.resolution,
          textPlacement: "inset-v1",
        },
      });
      const customReady = await wait(custom.body.id);
      assert.equal(customReady.status, "SUCCEEDED");
      assert.equal(
        customReady.reusedScenes,
        1,
        "preset labels do not invalidate identical scene geometry",
      );
      const thumbnail = await a.raw(
        `${root}/renders/${ready.id}/file/thumbnail`,
      );
      writeFileSync(
        `.local/render-${width}x${height}.jpg`,
        Buffer.from(await thumbnail.arrayBuffer()),
      );
    }

    const afterPresets = (
      await a.call(`${root}/content/${alternateContent.body.id}`)
    ).body;
    assert.deepEqual(
      afterPresets,
      beforePresets,
      "variants leave the source draft unchanged",
    );

    // Real decoded frames prove the overlay appears only in the half-open cue
    // interval, independently of the SRT and without invented speech alignment.
    const cueContent = await a.call(root + "/content", "POST", {
      ...draft,
      title: "Caption timing pixels",
      scenes: [
        {
          ...draft.scenes[0],
          visualAssetId: null,
          audioAssetId: null,
          onScreenText: "",
          caption: "Fallback must not appear",
          captionCues: [{ start: 0.5, end: 1, text: "TIMED CAPTION" }],
        },
      ],
    });
    assert.equal(cueContent.status, 201);
    for (const enabled of [true, false]) {
      const queuedCue = await a.call(root + "/renders", "POST", {
        contentId: cueContent.body.id,
        revision: 1,
        requestKey: randomUUID(),
        options: { aspect: "1:1", captions: enabled, background: "#183c2b" },
      });
      assert.equal(queuedCue.status, 201, JSON.stringify(queuedCue.body));
      const ready = await wait(queuedCue.body.id);
      assert.equal(ready.status, "SUCCEEDED", JSON.stringify(ready));
      const file = `.local/caption-timing-${enabled}.mp4`;
      writeFileSync(
        file,
        Buffer.from(
          await (
            await a.raw(`${root}/renders/${ready.id}/file/video`)
          ).arrayBuffer(),
        ),
      );
      for (const at of [0.25, 0.75, 1, 1.5]) {
        const frame = execFileSync(
          process.env.FFMPEG_PATH || "ffmpeg",
          [
            "-v",
            "error",
            "-ss",
            String(at),
            "-i",
            file,
            "-frames:v",
            "1",
            "-vf",
            "crop=720:216:0:504",
            "-pix_fmt",
            "gray",
            "-f",
            "rawvideo",
            "-",
          ],
          { maxBuffer: 2 * 1024 * 1024 },
        );
        const white = frame.reduce(
          (count, pixel) => count + (pixel > 200 ? 1 : 0),
          0,
        );
        assert.equal(
          white > 100,
          enabled && at === 0.75,
          `caption pixels at ${at}s, enabled=${enabled}`,
        );
      }
      const exported = await (
        await a.raw(`${root}/renders/${ready.id}/file/captions`)
      ).text();
      assert.match(exported, /00:00:00,500 --> 00:00:01,000\nTIMED CAPTION/);
      assert.equal(exported.includes("Fallback"), false);
    }

    const frameAssets: string[] = [];
    for (const [name, mime] of [
      ["framing-wide.png", "image/png"],
      ["framing-wide.mp4", "video/mp4"],
      ["framing-tall.png", "image/png"],
    ]) {
      const result = await a.upload(
        org,
        readFileSync(`.local/media-fixtures/${name}`),
        name,
        mime,
      );
      assert.equal(result.status, 201, JSON.stringify(result.body));
      frameAssets.push(result.body.asset.id);
    }
    const frameScene = (id: string, visualAssetId: string) => ({
      ...scene(id, visualAssetId),
      duration: 1,
      onScreenText: "",
      caption: "",
      captionCues: [],
      audioAssetId: null,
    });
    const framingDraft = {
      ...draft,
      title: "Framing pixels",
      scenes: [
        frameScene("still", frameAssets[0]),
        frameScene("clip", frameAssets[1]),
      ],
    };
    const framing = await a.call(root + "/content", "POST", framingDraft);
    assert.equal(framing.status, 201);
    const renderFraming = async (contentId: string, revision: number) => {
      const job = await a.call(root + "/renders", "POST", {
        contentId,
        revision,
        requestKey: randomUUID(),
        options: {
          aspect: "1:1",
          resolution: "720",
          captions: false,
          background: "#000000",
        },
      });
      assert.equal(job.status, 201, JSON.stringify(job.body));
      const ready = await wait(job.body.id);
      assert.equal(ready.status, "SUCCEEDED", JSON.stringify(ready));
      const file = `.local/framing-${ready.id}.mp4`;
      writeFileSync(
        file,
        Buffer.from(
          await (
            await a.raw(`${root}/renders/${ready.id}/file/video`)
          ).arrayBuffer(),
        ),
      );
      return { ...ready, file };
    };
    const checkFraming = (
      file: string,
      at: number,
      mode: string,
      tall = false,
    ) => {
      const frame = execFileSync(
        process.env.FFMPEG_PATH || "ffmpeg",
        [
          "-v",
          "error",
          "-ss",
          String(at),
          "-i",
          file,
          "-frames:v",
          "1",
          "-pix_fmt",
          "rgb24",
          "-f",
          "rawvideo",
          "-",
        ],
        { maxBuffer: 2 * 1024 * 1024 },
      );
      assert.equal(frame.length, 720 * 720 * 3);
      const pixel = (x: number, y: number, expected: number[]) => {
        if (tall) [x, y] = [y, x];
        const offset = (y * 720 + x) * 3;
        assert.ok(
          expected.every((v, i) => Math.abs(frame[offset + i] - v) < 30),
          `${mode} at ${at}s pixel ${x},${y}: ${[...frame.subarray(offset, offset + 3)]}`,
        );
      };
      pixel(360, 360, [0, 255, 0]);
      pixel(360, 50, mode === "cover" ? [0, 255, 0] : [0, 0, 0]);
      pixel(360, 670, mode === "cover" ? [0, 255, 0] : [0, 0, 0]);
      pixel(50, 360, mode === "cover" ? [0, 255, 0] : [255, 0, 0]);
      pixel(670, 360, mode === "cover" ? [0, 255, 0] : [0, 0, 255]);
    };
    const fit = await renderFraming(framing.body.id, 1);
    checkFraming(fit.file, 0.5, "contain");
    checkFraming(fit.file, 1.5, "contain");
    for (let index = 0; index < 2; index++) {
      const scenes = framingDraft.scenes.map((s, i) => ({
        ...s,
        visualFit: i <= index ? "cover" : "contain",
      }));
      const saved = await a.call(`${root}/content/${framing.body.id}`, "PUT", {
        ...framingDraft,
        scenes,
        revision: index + 1,
      });
      assert.equal(saved.status, 200);
      assert.equal(saved.body.scenes[index].visualFit, "cover");
      const changed = await renderFraming(framing.body.id, index + 2);
      assert.equal(
        changed.reusedScenes,
        1,
        "framing-only change must reuse the unchanged scene",
      );
      checkFraming(changed.file, 0.5, "cover");
      checkFraming(changed.file, 1.5, index === 0 ? "contain" : "cover");
    }
    const tall = await a.call(root + "/content", "POST", {
      ...draft,
      title: "Portrait image framing",
      scenes: [
        { ...frameScene("fit", frameAssets[2]), visualFit: "contain" },
        { ...frameScene("fill", frameAssets[2]), visualFit: "cover" },
      ],
    });
    assert.equal(tall.status, 201);
    const tallRender = await renderFraming(tall.body.id, 1);
    checkFraming(tallRender.file, 0.5, "contain", true);
    checkFraming(tallRender.file, 1.5, "cover", true);
    const motionAsset = await a.upload(
      org,
      readFileSync(".local/media-fixtures/motion-square.png"),
      "motion-square.png",
      "image/png",
    );
    assert.equal(motionAsset.status, 201);
    const motionDraft = {
      ...draft,
      title: "Bounded image motion",
      scenes: [
        { ...frameScene("fit-motion", frameAssets[0]), visualFit: "contain" },
        {
          ...frameScene("fill-motion", motionAsset.body.asset.id),
          visualFit: "cover",
        },
        frameScene("video-static", frameAssets[1]),
        { ...frameScene("card-static", frameAssets[0]), visualAssetId: null },
      ],
    };
    const motion = await a.call(root + "/content", "POST", motionDraft);
    assert.equal(motion.status, 201);
    const staticMotion = await renderFraming(motion.body.id, 1);
    const savedMotion = await a.call(
      `${root}/content/${motion.body.id}`,
      "PUT",
      {
        ...motionDraft,
        revision: 1,
        scenes: motionDraft.scenes.map((s) => ({
          ...s,
          cameraMotion: "slow-zoom",
        })),
      },
    );
    assert.equal(savedMotion.status, 200);
    assert.equal(savedMotion.body.scenes[0].cameraMotion, "slow-zoom");
    const zoomed = await renderFraming(motion.body.id, 2);
    assert.equal(
      zoomed.reusedScenes,
      2,
      "video and no-asset scenes ignore camera motion",
    );
    const decode = (file: string, at: number) =>
      execFileSync(
        process.env.FFMPEG_PATH || "ffmpeg",
        [
          "-v",
          "error",
          "-ss",
          String(at),
          "-i",
          file,
          "-frames:v",
          "1",
          "-pix_fmt",
          "rgb24",
          "-f",
          "rawvideo",
          "-",
        ],
        { maxBuffer: 2 * 1024 * 1024 },
      );
    const redWidth = (frame: Buffer) => {
      assert.equal(frame.length, 720 * 720 * 3);
      let count = 0;
      for (let x = 0; x < 720; x++) {
        const i = (360 * 720 + x) * 3;
        if (frame[i] > 180 && frame[i + 1] < 60) count++;
      }
      return count;
    };
    const early = redWidth(decode(zoomed.file, 1));
    const late = redWidth(decode(zoomed.file, 1.9));
    assert.ok(Math.abs(early - 360) < 5, `initial framing: ${early}`);
    assert.ok(
      late > early + 20 && late <= early * 1.09,
      `bounded zoom: ${early} -> ${late}`,
    );
    assert.ok(Math.abs(redWidth(decode(staticMotion.file, 1.9)) - early) < 5);
    const greenAt = (frame: Buffer, x: number, y: number) =>
      frame[(y * 720 + x) * 3 + 1];
    assert.ok(
      greenAt(decode(zoomed.file, 0), 360, 175) < 20,
      "Fit starts with original border",
    );
    assert.ok(
      greenAt(decode(zoomed.file, 0.9), 360, 175) > 200,
      "Fit canvas zooms inward",
    );
    assert.ok(
      greenAt(decode(staticMotion.file, 0.9), 360, 175) < 20,
      "Static Fit remains unchanged",
    );
    // Valid but extreme aspect ratios must not require multi-million-pixel
    // intermediate dimensions before the final center crop.
    const thinScenes = [];
    for (const name of ["framing-thin-wide.png", "framing-thin-tall.png"]) {
      const uploaded = await a.upload(
        org,
        readFileSync(`.local/media-fixtures/${name}`),
        name,
        "image/png",
      );
      assert.equal(uploaded.status, 201);
      thinScenes.push({
        ...frameScene(name, uploaded.body.asset.id),
        visualFit: "cover",
        cameraMotion: "slow-zoom",
      });
    }
    const thin = await a.call(root + "/content", "POST", {
      ...draft,
      title: "Extreme visual framing",
      scenes: thinScenes,
    });
    assert.equal(thin.status, 201);
    const thinRender = await renderFraming(thin.body.id, 1);
    checkFraming(thinRender.file, 0.5, "cover");
    checkFraming(thinRender.file, 1.5, "cover");
  },
);
