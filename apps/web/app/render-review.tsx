"use client";

import { useRef, useState } from "react";
import {
  sceneCaptionCues,
  sceneTimeline,
  timelineTime,
  type CaptionCue,
} from "../../../packages/core/captions";

type SavedScene = {
  duration: number;
  purpose: string;
  caption: string;
  captionCues?: CaptionCue[];
};

// The parent keys this component by job ID: player readiness and position never
// carry over to another render. Only the immutable snapshot supplies timings.
export function RenderReview({
  base,
  jobId,
  scenes,
  captions,
}: {
  base: string;
  jobId: string;
  scenes: SavedScene[];
  captions: boolean;
}) {
  const player = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [position, setPosition] = useState(0);
  const timeline = sceneTimeline(scenes);
  const current = timeline.find(
    ({ start, end }) => position >= start && position < end,
  );
  function readPosition() {
    const video = player.current;
    if (video) setPosition(video.currentTime);
  }
  function seek(seconds: number) {
    const video = player.current;
    if (!ready || failed || !video || !Number.isFinite(video.duration)) return;
    // Setting currentTime preserves the user's playing/paused state.
    video.currentTime = Math.min(Math.max(0, seconds), video.duration);
    readPosition();
  }
  return (
    <>
      <video
        ref={player}
        aria-label="Rendered video preview"
        className="render-player"
        controls
        preload="metadata"
        poster={`/api${base}/renders/${jobId}/file/thumbnail`}
        src={`/api${base}/renders/${jobId}/file/video`}
        onLoadedMetadata={() => {
          setReady(Number.isFinite(player.current?.duration));
          setFailed(false);
          readPosition();
        }}
        onTimeUpdate={readPosition}
        onSeeked={readPosition}
        onEnded={readPosition}
        onError={() => {
          setFailed(true);
          setReady(false);
        }}
      />
      <section className="render-review" aria-label="Saved render navigation">
        <div className="section-top">
          <h3>Review scenes and captions</h3>
          <span className="muted" aria-label="Playback position">
            {timelineTime(position)}
            {current ? ` · Scene ${current.index + 1}` : ""}
          </span>
        </div>
        <p className="field-help">
          Jump to a scene or caption in this saved render. Playback keeps its
          current playing or paused state.
          {!captions &&
            " Captions are in the SRT only; they are not burned into this video."}
        </p>
        {failed ? (
          <p role="alert">
            Video could not load. Reload the preview to try again.
          </p>
        ) : !ready ? (
          <p className="field-help" role="status">
            Loading video timings…
          </p>
        ) : null}
        <ol className="render-review-scenes">
          {timeline.map(({ index, scene, start, end }) => (
            <li key={index}>
              <button
                className="button review-scene"
                disabled={!ready || failed}
                aria-label={`Jump to scene ${index + 1}`}
                aria-current={current?.index === index ? "true" : undefined}
                onClick={() => seek(start)}
              >
                <b>
                  Scene {index + 1} · {scene.purpose || "Untitled scene"}
                </b>
                <small>
                  {timelineTime(start)}–{timelineTime(end)}
                </small>
              </button>
              <ul className="render-review-captions">
                {sceneCaptionCues(scene).map((cue, cueIndex) => {
                  const cueStart = start + cue.start;
                  const cueEnd = start + cue.end;
                  return (
                    <li key={cueIndex}>
                      <button
                        className="button review-caption"
                        disabled={!ready || failed}
                        aria-label={`Jump to scene ${index + 1} caption ${cueIndex + 1}`}
                        aria-current={
                          position >= cueStart && position < cueEnd
                            ? "true"
                            : undefined
                        }
                        onClick={() => seek(cueStart)}
                      >
                        <span>{cue.text}</span>
                        <small>
                          {timelineTime(cueStart)}–{timelineTime(cueEnd)}
                        </small>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
