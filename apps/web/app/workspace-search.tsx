"use client";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { api } from "./api-client";

export type SearchResult = {
  kind: "content" | "campaign" | "asset";
  id: string;
  title: string;
  summary: string;
  status: string;
  archived: boolean;
};
type Results = {
  items: SearchResult[];
  nextSkip: number | null;
  truncated: boolean;
};
export default function WorkspaceSearch({
  base,
  onOpen,
}: {
  base: string;
  onOpen: (result: SearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [archived, setArchived] = useState(false);
  const [result, setResult] = useState<Results | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [base],
  );
  function reset() {
    generation.current++;
    setResult(null);
    setBusy(false);
    setError("");
  }
  async function search(skip = 0) {
    const current = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const next: Results = await api(
        `${base}/search?q=${encodeURIComponent(query.trim())}&kind=${kind}&includeArchived=${archived}&skip=${skip}`,
      );
      if (current !== generation.current) return;
      setResult((previous) => ({
        ...next,
        items: skip ? [...(previous?.items || []), ...next.items] : next.items,
      }));
    } catch (e) {
      if (current === generation.current) {
        setError((e as Error).message);
        if (!skip) setResult(null);
      }
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">FIND YOUR WORK</p>
          <h1>Workspace search</h1>
          <p>
            Search content, campaigns and asset names or tags in this workspace.
          </p>
        </div>
      </div>
      <section className="panel workspace-search-panel">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
        >
          <label>
            Search this workspace
            <input
              value={query}
              minLength={2}
              maxLength={200}
              required
              onChange={(e) => {
                reset();
                setQuery(e.target.value);
              }}
              placeholder="Try a title, topic or asset tag"
            />
          </label>
          <div className="form-grid">
            <label>
              Search type
              <select
                value={kind}
                onChange={(e) => {
                  reset();
                  setKind(e.target.value);
                }}
              >
                <option value="all">All types</option>
                <option value="content">Content</option>
                <option value="campaign">Campaigns</option>
                <option value="asset">Assets</option>
              </select>
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={archived}
                onChange={(e) => {
                  reset();
                  setArchived(e.target.checked);
                }}
              />
              Include archived content and assets
            </label>
          </div>
          <button
            className="button primary"
            disabled={busy || query.trim().length < 2}
          >
            <Search size={17} />
            {busy ? "Searching…" : "Search workspace"}
          </button>
        </form>
        <p className="field-help">
          Enter whole words; all entered words must match. Results show saved
          records.
        </p>
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        <div role="status" aria-live="polite">
          {busy
            ? "Searching this workspace…"
            : result
              ? result.items.length
                ? `${result.items.length} results shown`
                : "No matching records. Try different words or include archived items."
              : "Enter at least two characters to search."}
        </div>
        <ul className="workspace-search-results">
          {result?.items.map((item) => (
            <li key={`${item.kind}:${item.id}`}>
              <span className="pill">
                {item.kind}
                {item.archived ? " · archived" : ""}
              </span>
              <h2>
                <button className="text-button" onClick={() => onOpen(item)}>
                  {item.title || "Untitled record"}
                </button>
              </h2>
              <p>{item.summary}</p>
              <small>{item.status.toLowerCase().replaceAll("_", " ")}</small>
            </li>
          ))}
        </ul>
        {result?.nextSkip !== null && result?.nextSkip !== undefined && (
          <button
            className="button"
            disabled={busy}
            onClick={() => void search(result.nextSkip!)}
          >
            Load more results
          </button>
        )}
        {result?.truncated && (
          <p role="status">Narrow your search to see more specific results.</p>
        )}
      </section>
    </>
  );
}
