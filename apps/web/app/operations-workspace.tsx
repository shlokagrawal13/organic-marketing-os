"use client";
import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw, CheckCircle2, CircleAlert } from "lucide-react";
import { api } from "./api-client";
const size = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MiB`;
export default function OperationsWorkspace({ base }: { base: string }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [exporting, setExporting] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setData(await api(base + "/operations/status"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [base]);
  useEffect(() => {
    void load();
  }, [load]);
  async function exportData() {
    setExporting(true);
    setError("");
    try {
      const response = await fetch(`/api${base}/operations/export`, {
        credentials: "include",
      });
      if (!response.ok)
        throw new Error(
          (await response.json()).error?.message || "Export failed.",
        );
      const blob = await response.blob(),
        url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "workspace-data.ndjson";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow muted">KNOW WHAT IS READY</span>
          <h1>Workspace health</h1>
          <p>Check availability, review usage and keep a copy of your work.</p>
        </div>
        <button className="button" disabled={busy} onClick={load}>
          <RefreshCw size={16} />
          {busy ? "Checking…" : "Refresh status"}
        </button>
      </div>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {!data && !error && <p role="status">Checking workspace services…</p>}
      {data && (
        <>
          <section className="panel ops-services">
            <div className="section-top">
              <h2>Service availability</h2>
              <span className="small-copy">
                Checked {new Date(data.checkedAt).toLocaleTimeString()}
              </span>
            </div>
            {data.services.map((s: any) => (
              <div className="ops-service" key={s.name}>
                <span>
                  {s.ready ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <CircleAlert size={18} />
                  )}{" "}
                  {s.name}
                </span>
                <span className={`pill ${s.ready ? "connected" : ""}`}>
                  {s.ready ? "Available" : "Needs attention"}
                </span>
              </div>
            ))}
            <p className="small-copy">
              Availability shows the current service checks. It does not certify
              provider quality or production readiness.
            </p>
          </section>
          <div className="ops-grid">
            <section className="panel">
              <h2>Media storage</h2>
              <p className="small-copy">
                {data.storage.assets} uploaded or generated assets, including
                archived files.
              </p>
              <label className="ops-storage-label" htmlFor="source-usage">
                Originals: {size(data.storage.sourceBytes)} of{" "}
                {size(data.storage.sourceLimitBytes)}
              </label>
              <progress
                id="source-usage"
                max={data.storage.sourceLimitBytes}
                value={data.storage.sourceBytes}
              />
              <dl className="ops-totals">
                <div>
                  <dt>Rendered MP4s</dt>
                  <dd>{size(data.storage.renderBytes)}</dd>
                </div>
                <div>
                  <dt>Reusable scenes</dt>
                  <dd>{size(data.storage.sceneCacheBytes)}</dd>
                </div>
              </dl>
              <p className="small-copy">
                Tracked file sizes only; thumbnails, captions and orphan files
                are excluded. Automatic cleanup is not available yet.
              </p>
            </section>
            <section className="panel">
              <h2>Generation services</h2>
              {data.providers.length ? (
                data.providers.map((p: any) => (
                  <p className="ops-provider" key={p.name}>
                    <strong>
                      {p.name}: {p.model}
                    </strong>
                    <span className="small-copy">
                      {p.qualityTier || "standard"} quality · {p.state}
                      {p.health && (
                        <>
                          {" "}
                          · {p.health.attempts} attempts · {p.health.failures}{" "}
                          failures
                        </>
                      )}
                      . Live output is not verified by this check.
                    </span>
                  </p>
                ))
              ) : (
                <p>
                  No text AI provider configured. Manual drafting and
                  uploaded-media rendering remain available.
                </p>
              )}
              <p className="small-copy">
                Email:{" "}
                {data.emailConfigured
                  ? "configured; delivery requires a separate check"
                  : "not configured"}
                .
              </p>
            </section>
          </div>
          <section className="panel">
            <h2>Job history</h2>
            <p className="small-copy">
              Generated media:{" "}
              {data.jobs.media?.length
                ? data.jobs.media
                    .map(
                      (row: any) =>
                        `${row.state.toLowerCase().replaceAll("_", " ")}: ${row._count}`,
                    )
                    .join(" · ")
                : "no requests yet"}
              . Review individual jobs in Asset library → Generate with AI.
            </p>
            <div className="content-table-wrap">
              <table className="content-table">
                <thead>
                  <tr>
                    <th>Workflow</th>
                    <th>Queued</th>
                    <th>Running</th>
                    <th>Succeeded</th>
                    <th>Failed</th>
                    <th>Canceled</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Text AI", data.jobs.ai],
                    ["Video renders", data.jobs.renders],
                  ].map(([label, rows]: any) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      {[
                        "QUEUED",
                        "RUNNING",
                        "SUCCEEDED",
                        "FAILED",
                        "CANCELED",
                      ].map((state) => (
                        <td key={state}>
                          {rows.find((r: any) => r.status === state)?._count ||
                            0}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small-copy">
              Counts belong to this workspace. Open Create with AI or Video
              studio to inspect individual jobs.
            </p>
          </section>
          <div className="ops-grid">
            <section className="panel">
              <h2>Export workspace data</h2>
              <p>
                Download all workspace records, including brand versions,
                content, campaigns, comments, media metadata and job history.
              </p>
              <p className="small-copy">
                The NDJSON file includes a completion record and checksum. Media
                files use private download references. Passwords, sessions and
                credentials are excluded. This data export is not a database
                restore backup. Limit: 64 MiB, one export per minute.
              </p>
              <button
                className="button primary"
                onClick={exportData}
                disabled={exporting}
              >
                <Download size={16} />
                {exporting ? "Preparing export…" : "Export workspace data"}
              </button>
            </section>
            <section className="panel">
              <h2>Still to come</h2>
              <p className="small-copy">
                These capabilities require additional development and
                verification.
              </p>
              <ul className="ops-pending">
                {data.unavailable.map((name: string) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </>
  );
}
