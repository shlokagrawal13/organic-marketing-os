import { mkdtemp, writeFile, readFile, stat, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ObjectStore } from "./object-store";
import { sceneCaptionCues } from "./captions";
import { readRenderFonts, createRenderFontPlan } from "./render-font";
import {
  RenderOptions,
  Scene,
  dimensions,
  runProcess,
  probeMedia,
  sha256,
  captionSrt,
  MAX_UPLOAD_BYTES,
  MAX_RENDER_BYTES,
  validateRenderScenes,
} from "./media";

type AssetInput = {
  id: string;
  objectKey: string;
  sha256: string;
  kind: string;
  bytes: number;
};
type CacheEntry = { objectKey: string; bytes: number };
type RenderContext = {
  organizationId: string;
  id: string;
  scenes: Scene[];
  options: RenderOptions;
  assets: AssetInput[];
  store: ObjectStore;
  signal: AbortSignal;
  progress: (progress: number, stage: string, reused: number) => Promise<void>;
  cacheGet: (key: string) => Promise<CacheEntry | null>;
  cachePut: (key: string, entry: CacheEntry) => Promise<void>;
};
const ffmpeg = () => process.env.FFMPEG_PATH || "ffmpeg";
function wrap(text: string, width: number) {
  const words = text
      .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "")
      .split(/\s+/)
      .filter(Boolean),
    lines: string[] = [];
  let line = "";
  for (const raw of words) {
    const chunks = Array.from(raw);
    while (chunks.length > width) {
      if (line) {
        lines.push(line);
        line = "";
      }
      lines.push(chunks.splice(0, width).join(""));
    }
    const word = chunks.join("");
    if (!word) continue;
    if (Array.from(line + " " + word).length > width && line) {
      lines.push(line);
      line = word;
    } else line += `${line ? " " : ""}${word}`;
  }
  if (line) lines.push(line);
  return lines.join("\n");
}
export async function renderVideo(ctx: RenderContext) {
  const { store, signal, options, scenes } = ctx;
  validateRenderScenes(scenes, options);
  const fontPlan = createRenderFontPlan(
    await readRenderFonts(),
    scenes,
    options,
  );
  const [width, height] = dimensions(options),
    duration = scenes.reduce((sum, s) => sum + s.duration, 0);
  const dir = await mkdtemp(join(tmpdir(), "mos-render-"));
  const outputKey = `${ctx.organizationId}/renders/${ctx.id}/video.mp4`,
    thumbnailKey = `${ctx.organizationId}/renders/${ctx.id}/thumbnail.jpg`,
    captionsKey = `${ctx.organizationId}/renders/${ctx.id}/captions.srt`;
  const outputKeys = [outputKey, thumbnailKey, captionsKey];
  let successful = false,
    reused = 0;
  const exec = (args: string[], timeout = 120000) =>
    runProcess(
      ffmpeg(),
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-y",
        "-filter_threads",
        "1",
        ...args,
      ],
      { cwd: dir, signal, timeout },
    );
  const abort = () => {
    if (signal.aborted) throw new Error("Render canceled.");
  };
  const inputs = new Map<string, { asset: AssetInput; path: string }>();
  try {
    await store.ready();
    // Copy only trusted server-configured fonts to controlled filter paths.
    for (const [index, font] of fontPlan.fonts.entries())
      await writeFile(join(dir, `font-${index}.ttf`), font);
    for (let i = 0; i < ctx.assets.length; i++) {
      abort();
      const asset = ctx.assets[i],
        path = join(dir, `input-${i}.media`);
      await store.download(
        asset.objectKey,
        path,
        Math.min(asset.bytes, MAX_UPLOAD_BYTES),
      );
      if (sha256(await readFile(path)) !== asset.sha256)
        throw new Error(
          "An input asset failed its integrity check. Upload it again.",
        );
      inputs.set(asset.id, { asset, path });
    }
    for (let i = 0; i < scenes.length; i++) {
      abort();
      await ctx.progress(
        5 + Math.round((i / scenes.length) * 65),
        `Rendering scene ${i + 1} of ${scenes.length}`,
        reused,
      );
      const scene = scenes[i],
        visual = scene.visualAssetId
          ? inputs.get(scene.visualAssetId)
          : undefined,
        audio = scene.audioAssetId ? inputs.get(scene.audioAssetId) : undefined;
      const segment = `segment-${i}.mp4`,
        segmentPath = join(dir, segment);
      const key = sha256(
        JSON.stringify({
          version: "mos-render-5-font-fallback",
          fonts: fontPlan.fontHashes,
          width,
          height,
          background: options.background,
          captions: options.captions ? sceneCaptionCues(scene) : [],
          text: scene.onScreenText,
          duration: scene.duration,
          transition: scene.transition.toLowerCase().trim(),
          visual: visual?.asset.sha256 || null,
          visualFit: visual ? scene.visualFit || "contain" : null,
          cameraMotion:
            visual?.asset.kind === "IMAGE"
              ? scene.cameraMotion || "static"
              : null,
          audio: audio?.asset.sha256 || null,
        }),
      );
      const cached = await ctx.cacheGet(key);
      let cacheHit = false;
      if (cached) {
        try {
          await store.download(
            cached.objectKey,
            segmentPath,
            Math.min(cached.bytes, MAX_RENDER_BYTES),
          );
          await checkOutput(segmentPath, width, height, scene.duration, signal);
          cacheHit = true;
          reused++;
        } catch {
          abort();
        }
      }
      if (!cacheHit) {
        const args: string[] = [];
        if (visual) {
          if (visual.asset.kind === "IMAGE")
            args.push("-loop", "1", "-framerate", "30");
          else args.push("-stream_loop", "-1");
          args.push("-protocol_whitelist", "file,pipe", "-i", visual.path);
        } else
          args.push(
            "-f",
            "lavfi",
            "-i",
            `color=c=${options.background}:s=${width}x${height}:r=30:d=${scene.duration}`,
          );
        if (audio)
          args.push("-protocol_whitelist", "file,pipe", "-i", audio.path);
        else
          args.push(
            "-f",
            "lavfi",
            "-i",
            "anullsrc=channel_layout=stereo:sample_rate=48000",
          );
        const filters = [
          ...(visual && scene.visualFit === "cover"
            ? [
                // Crop before scaling so extreme source aspect ratios cannot
                // create enormous intermediate frames. Final crop absorbs
                // source-pixel rounding without stretching the visual.
                `crop=w='min(iw,max(1,ih*${width}/${height}))':h='min(ih,max(1,iw*${height}/${width}))':x=(iw-ow)/2:y=(ih-oh)/2:exact=1`,
                `scale=${width}:${height}:force_original_aspect_ratio=increase:force_divisible_by=2`,
                `crop=${width}:${height}:(iw-ow)/2:(ih-oh)/2`,
              ]
            : [
                `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
                `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${options.background}`,
              ]),
          "setsar=1",
          "fps=30",
          "format=yuv420p",
        ];
        if (
          visual?.asset.kind === "IMAGE" &&
          scene.cameraMotion === "slow-zoom"
        ) {
          // Normalize Fit/Fill first to bound allocations. Zoom the framed
          // canvas by at most 8%; overlays are added afterward and stay fixed.
          const lastFrame = Math.max(1, Math.ceil(scene.duration * 30) - 1);
          filters.push(
            `zoompan=z='1+0.08*min(on/${lastFrame},1)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=${width}x${height}:fps=30`,
          );
        }
        const overlays = [
          {
            type: "title",
            text: scene.onScreenText,
            y: "h*0.10",
            baseSize: Math.round(Math.min(width, height) / 18),
            enable: "",
          },
          ...(options.captions
            ? sceneCaptionCues(scene).map((cue, cueIndex) => ({
                type: `caption-${cueIndex}`,
                text: cue.text,
                y: "h*0.91-th",
                baseSize: Math.round(Math.min(width, height) / 25),
                enable: `:enable='gte(t,${cue.start})*lt(t,${cue.end})'`,
              }))
            : []),
        ];
        for (const { type, text, y, baseSize, enable } of overlays) {
          if (!text.trim()) continue;
          const file = `${type}-${i}.txt`;
          let fontSize = Math.max(18, baseSize),
            wrapped = wrap(text, Math.floor((width * 0.84) / (fontSize * 0.6)));
          while (
            fontSize > 16 &&
            wrapped.split("\n").length * (fontSize + 6) > height * 0.28
          ) {
            fontSize--;
            wrapped = wrap(text, Math.floor((width * 0.84) / (fontSize * 0.6)));
          }
          await writeFile(join(dir, file), wrapped, "utf8");
          const fontIndex = fontPlan.selectFontIndex(text);
          filters.push(
            `drawtext=fontfile=font-${fontIndex}.ttf:textfile=${file}:expansion=none:text_shaping=1:fontsize=${fontSize}:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=12:line_spacing=6:x=(w-tw)/2:y=${y}${enable}`,
          );
        }
        if (scene.transition.toLowerCase().trim() === "fade")
          filters.push(
            "fade=t=in:st=0:d=0.2",
            `fade=t=out:st=${Math.max(0, scene.duration - 0.2)}:d=0.2`,
          );
        args.push(
          "-map",
          "0:v:0",
          "-map",
          "1:a:0",
          "-vf",
          filters.join(","),
          "-af",
          "aresample=48000,apad,alimiter=limit=0.95",
          "-t",
          String(scene.duration),
          "-c:v",
          "libx264",
          "-threads",
          "2",
          "-preset",
          "veryfast",
          "-crf",
          "22",
          "-c:a",
          "aac",
          "-b:a",
          "160k",
          "-ac",
          "2",
          "-ar",
          "48000",
          "-movflags",
          "+faststart",
          "-fs",
          String(MAX_RENDER_BYTES),
          segment,
        );
        await exec(args);
        await checkOutput(segmentPath, width, height, scene.duration, signal);
        abort();
        const objectKey = `${ctx.organizationId}/segments/${key}.mp4`,
          bytes = (await stat(segmentPath)).size;
        await store.putFile(objectKey, segmentPath, "video/mp4");
        await ctx.cachePut(key, { objectKey, bytes });
      }
      await ctx.progress(
        10 + Math.round(((i + 1) / scenes.length) * 65),
        `Scene ${i + 1} of ${scenes.length}${cacheHit ? " reused" : " rendered"}`,
        reused,
      );
    }
    abort();
    await writeFile(
      join(dir, "segments.txt"),
      scenes
        .map(
          (scene, i) => `file 'segment-${i}.mp4'\nduration ${scene.duration}`,
        )
        .join("\n"),
    );
    await ctx.progress(80, "Assembling video and audio", reused);
    await exec([
      "-protocol_whitelist",
      "file,pipe",
      "-f",
      "concat",
      "-safe",
      "1",
      "-i",
      "segments.txt",
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      "joined.mp4",
    ]);
    const music = options.musicAssetId
      ? inputs.get(options.musicAssetId)
      : undefined;
    if (music) {
      await exec([
        "-protocol_whitelist",
        "file,pipe",
        "-i",
        "joined.mp4",
        "-stream_loop",
        "-1",
        "-protocol_whitelist",
        "file,pipe",
        "-i",
        music.path,
        "-filter_complex",
        `[1:a]volume=${options.musicVolume}[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95,aresample=48000:async=1:first_pts=0,asetpts=N/SR/TB[a]`,
        "-map",
        "0:v",
        "-map",
        "[a]",
        "-t",
        String(duration),
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-ac",
        "2",
        "-ar",
        "48000",
        "-movflags",
        "+faststart",
        "video.mp4",
      ]);
    } else {
      await exec([
        "-protocol_whitelist",
        "file,pipe",
        "-i",
        "joined.mp4",
        "-t",
        String(duration),
        "-c:v",
        "copy",
        "-af",
        "aresample=48000:async=1:first_pts=0,asetpts=N/SR/TB",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-movflags",
        "+faststart",
        "video.mp4",
      ]);
    }
    const output = join(dir, "video.mp4");
    await checkOutput(output, width, height, duration, signal);
    const bytes = (await stat(output)).size;
    if (bytes > MAX_RENDER_BYTES)
      throw new Error(
        "The rendered file exceeds 100 MB. Choose 720p or a shorter video.",
      );
    await ctx.progress(90, "Checking output and creating thumbnail", reused);
    await exec([
      "-protocol_whitelist",
      "file,pipe",
      "-ss",
      String(Math.min(0.5, duration / 2)),
      "-i",
      "video.mp4",
      "-frames:v",
      "1",
      "-vf",
      "scale=480:-2",
      "-q:v",
      "3",
      "thumbnail.jpg",
    ]);
    await writeFile(join(dir, "captions.srt"), captionSrt(scenes));
    abort();
    await store.putFile(outputKey, output, "video/mp4");
    await store.putFile(thumbnailKey, join(dir, "thumbnail.jpg"), "image/jpeg");
    await store.putFile(
      captionsKey,
      join(dir, "captions.srt"),
      "application/x-subrip",
    );
    abort();
    successful = true;
    return {
      outputKey,
      thumbnailKey,
      captionsKey,
      outputBytes: bytes,
      width,
      height,
      duration,
      reusedScenes: reused,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
    if (!successful)
      for (const key of outputKeys) await store.remove(key).catch(() => {});
  }
}
async function checkOutput(
  path: string,
  width: number,
  height: number,
  duration: number,
  signal: AbortSignal,
) {
  const result = await probeMedia(path, signal),
    v = result.streams?.find((s: any) => s.codec_type === "video"),
    a = result.streams?.find((s: any) => s.codec_type === "audio");
  if (
    v?.codec_name !== "h264" ||
    v.width !== width ||
    v.height !== height ||
    a?.codec_name !== "aac" ||
    Math.abs(Number(result.format?.duration) - duration) > 0.2
  )
    throw new Error(
      "The rendered media did not pass codec, dimension or duration checks.",
    );
}
