// Versioned geometry presets shared by the browser and API. These are export
// sizes, not platform upload-policy or safe-area validation. Never remap an ID;
// introduce a new ID if a preset's dimensions change.
export const RENDER_PRESET_IDS = [
  "vertical-social-v1",
  "landscape-video-v1",
  "square-feed-v1",
] as const;
export type RenderPresetId = (typeof RENDER_PRESET_IDS)[number];
export const RENDER_PRESETS = [
  {
    id: RENDER_PRESET_IDS[0],
    label: "Reels / Shorts",
    aspect: "9:16",
    resolution: "1080",
  },
  {
    id: RENDER_PRESET_IDS[1],
    label: "Landscape video",
    aspect: "16:9",
    resolution: "1080",
  },
  {
    id: RENDER_PRESET_IDS[2],
    label: "Square feed",
    aspect: "1:1",
    resolution: "1080",
  },
] as const;
export function renderPreset(id: unknown) {
  return RENDER_PRESETS.find((preset) => preset.id === id);
}
export function renderDimensions(options: {
  aspect: string;
  resolution: string;
}) {
  const short = Number(options.resolution),
    long = options.resolution === "720" ? 1280 : 1920;
  return options.aspect === "9:16"
    ? [short, long]
    : options.aspect === "16:9"
      ? [long, short]
      : [short, short];
}
