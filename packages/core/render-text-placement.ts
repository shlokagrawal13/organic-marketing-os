// Versioned composition margins, not official platform UI guarantees.
export const INSET_TEXT_PLACEMENT = "inset-v1" as const;
export type RenderTextArea = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};
export function textPlacementLabel(value: unknown) {
  return value === INSET_TEXT_PLACEMENT
    ? "Extra margins"
    : "Standard placement";
}
export function renderTextAreas(
  options: { aspect: string; textPlacement?: string },
  width: number,
  height: number,
) {
  if (options.textPlacement !== INSET_TEXT_PLACEMENT) return undefined;
  const [left, right, titleTop, titleBottom, captionTop, captionBottom] =
    options.aspect === "9:16"
      ? [0.12, 0.8, 0.18, 0.38, 0.52, 0.72]
      : options.aspect === "16:9"
        ? [0.1, 0.9, 0.14, 0.36, 0.6, 0.82]
        : [0.12, 0.88, 0.16, 0.38, 0.58, 0.8];
  const area = (top: number, bottom: number): RenderTextArea => ({
    left: width * left,
    right: width * right,
    top: height * top,
    bottom: height * bottom,
  });
  return {
    title: area(titleTop, titleBottom),
    caption: area(captionTop, captionBottom),
  };
}
