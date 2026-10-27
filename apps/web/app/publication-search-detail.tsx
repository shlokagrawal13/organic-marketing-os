"use client";
import { useEffect, useState } from "react";
import { api } from "./api-client";
import type { SearchResult } from "./workspace-search";

type Preparation = {
  id: string;
  contentId: string;
  contentRevision: number;
  platform: string;
  status: string;
  snapshot: { title?: unknown };
};

export default function PublicationSearchDetail({
  base,
  id,
  onBack,
  onOpenContent,
}: {
  base: string;
  id: string;
  onBack: () => void;
  onOpenContent: (result: SearchResult) => void;
}) {
  const [preparation, setPreparation] = useState<Preparation | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api(`${base}/publication-intents/${id}`)
      .then((data) => {
        if (active) setPreparation(data);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [base, id]);
  const title =
    typeof preparation?.snapshot?.title === "string"
      ? preparation.snapshot.title
      : "Untitled preparation";
  return (
    <section
      className="panel workspace-search-panel"
      aria-label="Publication preparation details"
    >
      <button className="text-button" onClick={onBack}>
        Back to search results
      </button>
      <h1>Publication preparation</h1>
      <p>
        This saved preparation is not evidence of a successful external post.
        Upload attempts and schedules require their separate review.
      </p>
      {error ? (
        <div className="alert error" role="alert">
          {error}
        </div>
      ) : !preparation ? (
        <p role="status">Loading publication preparation…</p>
      ) : (
        <>
          <h2>{title}</h2>
          <dl>
            <dt>Preparation ID</dt>
            <dd>{preparation.id}</dd>
            <dt>Preparation status</dt>
            <dd>{preparation.status}</dd>
            <dt>Saved content revision</dt>
            <dd>{preparation.contentRevision}</dd>
            <dt>Platform</dt>
            <dd>{preparation.platform}</dd>
          </dl>
          <p>
            The linked content may have changed since this preparation was
            saved.
          </p>
          <button
            className="button"
            onClick={() =>
              onOpenContent({
                kind: "content",
                id: preparation.contentId,
                title,
                summary: "",
                status: preparation.status,
                archived: false,
              })
            }
          >
            Open current content
          </button>
        </>
      )}
    </section>
  );
}
