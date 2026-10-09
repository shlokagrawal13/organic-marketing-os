import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sceneSchema } from "../packages/core/ai";
import { dimensions, renderOptions, runProcess } from "../packages/core/media";
import { DEFAULT_RENDER_FONT_PATH } from "../packages/core/render-font";
import { renderVideo } from "../packages/core/renderer";
import type { ObjectStore } from "../packages/core/object-store";

const root = resolve(
  process.env.MOS_READABILITY_QA_DIR || ".local/readability",
);
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const tesseract = process.env.TESSERACT_PATH || "tesseract";
const normalize = (text: string) =>
  text.trim().replace(/\s+/g, " ").toLowerCase();
const hash = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const title = "Clear video title";
const caption = "Read every caption";
const expected = normalize(`${title} ${caption}`);

async function main() {
  await mkdir(root, { recursive: true });
  const dir = await mkdtemp(join(root, "run-"));
  const samples: Record<string, unknown>[] = [];
  const report: Record<string, unknown> = {
    schemaVersion: 1,
    scope:
      "Synthetic short English text on black, rescaled decoded frames; not physical-device, platform UI, all-content or multilingual acceptance.",
    expected,
    passed: false,
    expectedSamples: 36,
    exports: 0,
    samples,
    negativeControlPassed: false,
  };
  const busySamples: Record<string, unknown>[] = [];
  report.busy = {
    scope:
      "Fixed 720p synthetic high-detail portrait asset; OCR on reviewed 320px title/caption regions for Extra margins and Device safe. Not physical-device or arbitrary content acceptance.",
    expectedSamples: 8,
    exports: 0,
    samples: busySamples,
  };
  try {
    report.ffmpeg = (await runProcess(ffmpeg, ["-version"])).split("\n")[0];
    report.tesseract = (await runProcess(tesseract, ["--version"])).split(
      "\n",
    )[0];
    report.fontSha256 = hash(await readFile(DEFAULT_RENDER_FONT_PATH));
    process.env.RENDER_FONT_PATH = DEFAULT_RENDER_FONT_PATH;
    delete process.env.RENDER_FONT_FALLBACK_PATHS;
    const ocr = (path: string) =>
      runProcess(
        tesseract,
        [path, "stdout", "-l", "eng", "--oem", "1", "--psm", "11"],
        { timeout: 30000 },
      );
    const blank = join(dir, "negative-blank.png");
    await runProcess(ffmpeg, [
      "-v",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=320x568",
      "-frames:v",
      "1",
      blank,
    ]);
    const blankText = normalize(await ocr(blank));
    assert.equal(blankText, "", "negative control contains no recognized text");
    assert.notEqual(
      blankText,
      expected,
      "blank frame cannot satisfy readability gate",
    );
    report.negativeControlPassed = true;

    for (const placement of [undefined, "inset-v1", "device-safe-v1"] as const)
      for (const aspect of ["9:16", "16:9", "1:1"] as const)
        for (const resolution of ["720", "1080"] as const) {
          const key = `${placement || "standard"}-${aspect.replace(":", "-")}-${resolution}`;
          const options = renderOptions.parse({
            aspect,
            resolution,
            textPlacement: placement,
            background: "#000000",
          });
          const [width, height] = dimensions(options);
          const video = join(dir, `${key}.mp4`);
          await renderVideo({
            organizationId: "readability-test",
            id: key,
            scenes: [
              sceneSchema.parse({
                id: "readability",
                purpose: "",
                duration: 1,
                voiceover: "",
                visual: "",
                onScreenText: title,
                caption: "",
                captionCues: [{ start: 0.3, end: 0.8, text: caption }],
                transition: "Cut",
                music: "",
                sfx: "",
                cta: "",
              }),
            ],
            options,
            assets: [],
            store: {
              ready: async () => {},
              putFile: async (key: string, path: string) => {
                if (key.endsWith("/video.mp4"))
                  await writeFile(video, await readFile(path));
              },
              remove: async () => {},
            } as unknown as ObjectStore,
            signal: new AbortController().signal,
            progress: async () => {},
            cacheGet: async () => null,
            cachePut: async () => {},
          });
          report.exports = Number(report.exports) + 1;
          for (const displayWidth of aspect === "16:9"
            ? [568, 844]
            : [320, 390]) {
            const file = `${key}-${displayWidth}.png`;
            const path = join(dir, file);
            await runProcess(
              ffmpeg,
              [
                "-v",
                "error",
                "-y",
                "-ss",
                "0.5",
                "-i",
                video,
                "-frames:v",
                "1",
                "-vf",
                `scale=${displayWidth}:-1:flags=lanczos`,
                path,
              ],
              { timeout: 15000 },
            );
            const recognized = normalize(await ocr(path));
            const passed = recognized === expected;
            samples.push({
              placement: placement || "standard",
              aspect,
              resolution,
              width,
              height,
              displayWidth,
              time: 0.5,
              file,
              sha256: hash(await readFile(path)),
              recognized,
              passed,
            });
            console.log(`${passed ? "PASS" : "FAIL"} ${file}: ${recognized}`);
          }
        }
    assert.equal(samples.length, 36, "complete fixed matrix required");
    assert.equal(
      samples.filter((sample) => !sample.passed).length,
      0,
      "OCR mismatches remain failures",
    );
    const visualAssetId = "00000000-0000-4000-8000-000000000001";
    const background = join(dir, "busy-background.png");
    await runProcess(ffmpeg, [
      "-v",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=720x1280:rate=1",
      "-frames:v",
      "1",
      background,
    ]);
    const backgroundBytes = await readFile(background);
    (report.busy as Record<string, unknown>).backgroundSha256 =
      hash(backgroundBytes);
    const busyCases = [
      { label: "short", title, caption },
      {
        label: "long",
        title: "Plan your next campaign with clear goals",
        caption: "Keep the key message easy to read on small screens",
      },
    ];
    // Fixed text-box crops are tied to this exact 720p fixture at a 320px
    // display width. Full-frame OCR also reads the test pattern's decorations.
    const crops: Record<
      string,
      Record<string, Record<string, [number, number, number, number]>>
    > = {
      "extra-margins": {
        short: { title: [72, 101, 220, 128], caption: [80, 384, 213, 412] },
        long: { title: [53, 102, 242, 177], caption: [53, 370, 242, 412] },
      },
      "device-safe": {
        short: { title: [65, 111, 215, 139], caption: [72, 349, 210, 376] },
        long: { title: [68, 110, 215, 189], caption: [61, 316, 216, 377] },
      },
    };
    for (const [placement, textPlacement] of [
      ["extra-margins", "inset-v1"],
      ["device-safe", "device-safe-v1"],
    ] as const) {
      const video = join(dir, `busy-${placement}.mp4`);
      await renderVideo({
        organizationId: "busy-readability-test",
        id: placement,
        scenes: busyCases.map(({ label, title, caption }) =>
          sceneSchema.parse({
            id: label,
            purpose: "",
            duration: 1,
            voiceover: "",
            visual: "",
            visualAssetId,
            visualFit: "cover",
            onScreenText: title,
            caption: "",
            captionCues: [{ start: 0.25, end: 0.85, text: caption }],
            transition: "Cut",
            music: "",
            sfx: "",
            cta: "",
          }),
        ),
        options: renderOptions.parse({
          aspect: "9:16",
          resolution: "720",
          textPlacement,
        }),
        assets: [
          {
            id: visualAssetId,
            objectKey: "busy-background",
            sha256: hash(backgroundBytes),
            kind: "IMAGE",
            bytes: backgroundBytes.length,
          },
        ],
        store: {
          ready: async () => {},
          download: async (_key: string, path: string) =>
            writeFile(path, backgroundBytes),
          putFile: async (key: string, path: string) => {
            if (key.endsWith("/video.mp4"))
              await writeFile(video, await readFile(path));
          },
          remove: async () => {},
        } as unknown as ObjectStore,
        signal: new AbortController().signal,
        progress: async () => {},
        cacheGet: async () => null,
        cachePut: async () => {},
      });
      (report.busy as Record<string, unknown>).exports =
        Number((report.busy as Record<string, unknown>).exports) + 1;
      for (const [index, fixture] of busyCases.entries()) {
        const frame = join(dir, `busy-${placement}-${fixture.label}-320.png`);
        await runProcess(ffmpeg, [
          "-v",
          "error",
          "-y",
          "-ss",
          String(index + 0.5),
          "-i",
          video,
          "-frames:v",
          "1",
          "-vf",
          "scale=320:-1:flags=lanczos",
          frame,
        ]);
        for (const area of ["title", "caption"] as const) {
          const [left, top, right, bottom] =
            crops[placement][fixture.label][area];
          const file = `busy-${placement}-${fixture.label}-${area}.png`;
          const path = join(dir, file);
          await runProcess(ffmpeg, [
            "-v",
            "error",
            "-y",
            "-i",
            frame,
            "-frames:v",
            "1",
            "-vf",
            `crop=${right - left}:${bottom - top}:${left}:${top},scale=iw*2:ih*2:flags=lanczos`,
            path,
          ]);
          const recognized = normalize(
            await runProcess(
              tesseract,
              [path, "stdout", "-l", "eng", "--oem", "1", "--psm", "6"],
              { timeout: 30000 },
            ),
          );
          const passed = recognized === normalize(fixture[area]);
          busySamples.push({
            placement,
            scene: fixture.label,
            area,
            file,
            frameSha256: hash(await readFile(frame)),
            sha256: hash(await readFile(path)),
            expected: normalize(fixture[area]),
            recognized,
            passed,
          });
          console.log(`${passed ? "PASS" : "FAIL"} ${file}: ${recognized}`);
        }
      }
    }
    assert.equal(
      busySamples.length,
      8,
      "complete busy-background matrix required",
    );
    assert.equal(
      busySamples.filter((sample) => !sample.passed).length,
      0,
      "busy-background text-box OCR mismatches remain failures",
    );
    report.passed = true;
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    await writeFile(
      join(dir, "report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(`Readability evidence: ${join(dir, "report.json")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
