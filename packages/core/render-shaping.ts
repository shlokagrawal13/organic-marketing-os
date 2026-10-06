import {
  renderedSceneText,
  hasDevanagariText,
  runProcess,
  sha256,
  type Scene,
  type RenderOptions,
} from "./media";
import { RenderFontError } from "./render-font";

const message =
  "Devanagari rendering requires FFmpeg with the librsvg SVG decoder. Ask an administrator to configure the render runtime or disable Devanagari rendering.";

export function validateDevanagariRuntime(decoders: string) {
  if (!/^\s*V[.A-Z]{5}\s+librsvg\s/m.test(decoders))
    throw new RenderFontError(message);
}

export async function checkRenderShaping(
  scenes: Scene[],
  options: Pick<RenderOptions, "captions">,
  ffmpeg: string,
  signal: AbortSignal,
) {
  if (
    !scenes.some((scene) =>
      renderedSceneText(scene, options).some(({ text }) =>
        hasDevanagariText(text),
      ),
    )
  )
    return undefined;
  try {
    const version = await runProcess(ffmpeg, ["-decoders"], {
      signal,
      timeout: 15000,
    });
    validateDevanagariRuntime(version);
    const runtime = await runProcess(ffmpeg, ["-version"], {
      signal,
      timeout: 15000,
    });
    return sha256("fontkit-outlines-v1\n" + runtime + version);
  } catch (error) {
    if (signal.aborted) throw new Error("Render canceled.");
    if (error instanceof RenderFontError) throw error;
    throw new RenderFontError(message);
  }
}
