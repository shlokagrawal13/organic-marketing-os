import { renderDimensions } from "../../../packages/core/render-presets";
import {
  renderTextAreas,
  textPlacementLabel,
} from "../../../packages/core/render-text-placement";

export function CompositionGuides({
  options,
  label,
}: {
  options: {
    aspect: string;
    resolution: string;
    textPlacement?: string;
    captions: boolean;
    background: string;
  };
  label: string;
}) {
  const [width, height] = renderDimensions(options);
  const areas = renderTextAreas(options, width, height);
  const fontSize = Math.min(width, height) / 10;
  return (
    <figure className="composition-guide" aria-label={label}>
      <figcaption>
        <strong>{label}</strong>
        <span>
          {options.aspect} · {width} × {height} px ·{" "}
          {textPlacementLabel(options.textPlacement)}
        </span>
      </figcaption>
      <div className="composition-guide-body">
        <svg
          role="img"
          aria-label={
            options.captions
              ? "Export frame with title and caption guides"
              : "Export frame with title guide; burned captions off"
          }
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
        >
          <rect width={width} height={height} fill={options.background} />
          {(["title", "caption"] as const)
            .filter((kind) => kind === "title" || options.captions)
            .map((kind) => {
              const area = areas?.[kind];
              const x = area ? (area.left + area.right) / 2 : width / 2;
              const y = area
                ? (area.top + area.bottom) / 2
                : kind === "title"
                  ? height * 0.1 + fontSize / 2
                  : height * 0.91 - fontSize / 2;
              return (
                <g key={kind} data-guide-kind={kind}>
                  {area ? (
                    <rect
                      x={area.left}
                      y={area.top}
                      width={area.right - area.left}
                      height={area.bottom - area.top}
                      fill="black"
                      fillOpacity="0.65"
                      stroke={kind === "title" ? "#c7f06b" : "#91d4ff"}
                      strokeWidth={Math.min(width, height) / 150}
                      strokeDasharray={`${fontSize / 6} ${fontSize / 8}`}
                    />
                  ) : (
                    <rect
                      x={x - fontSize * 2.2}
                      y={y - fontSize * 0.7}
                      width={fontSize * 4.4}
                      height={fontSize * 1.4}
                      rx={fontSize / 5}
                      fill="black"
                      fillOpacity="0.65"
                    />
                  )}
                  <text
                    x={x}
                    y={y}
                    fontSize={fontSize}
                    fill="white"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {kind === "title" ? "Title" : "Captions"}
                  </text>
                </g>
              );
            })}
        </svg>
        <p className="field-help">
          {areas
            ? `${textPlacementLabel(options.textPlacement)} boxes show text regions.`
            : "Standard positions are approximate; wrapping depends on your fonts."}{" "}
          Guides are not included in exports. Review the rendered video on your
          target platform.
          {!options.captions &&
            " Burned captions are off; SRT remains available."}
        </p>
      </div>
    </figure>
  );
}
