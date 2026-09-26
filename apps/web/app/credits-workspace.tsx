"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "./api-client";

export default function CreditsWorkspace({
  base,
  organizationId,
}: {
  base: string;
  organizationId: string;
}) {
  const adjustmentKey = useRef<string | null>(null);
  const [data, setData] = useState<any>(null),
    [entries, setEntries] = useState<any[]>([]),
    [next, setNext] = useState<number | null>(null);
  const [admin, setAdmin] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [amount, setAmount] = useState(""),
    [reason, setReason] = useState("");
  const [resolution, setResolution] = useState<
    Record<string, { consumed: string; reason: string }>
  >({});
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [summary, history, access] = await Promise.all([
        api(base + "/credits"),
        api(base + "/credits/entries"),
        api("/platform/access"),
      ]);
      setData(summary);
      setEntries(history.items);
      setNext(history.nextBefore);
      setAdmin(access.allowed);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [base]);
  useEffect(() => {
    void load();
  }, [load]);
  async function adjust(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/platform/credits/${organizationId}/adjust`, "POST", {
        requestKey: (adjustmentKey.current ||= crypto.randomUUID()),
        amount: Number(amount),
        reason,
      });
      adjustmentKey.current = null;
      setAmount("");
      setReason("");
      await load();
    } catch (e) {
      setError(
        (e as Error).message +
          " Refresh the credit history before making another adjustment. Retrying this form keeps the same operation key.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function resolve(id: string) {
    setBusy(true);
    setError("");
    try {
      const r = resolution[id];
      await api(`/platform/credits/reservations/${id}/resolve`, "POST", {
        consumed: Number(r?.consumed),
        reason: r?.reason,
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function more() {
    setBusy(true);
    setError("");
    try {
      const history = await api(`${base}/credits/entries?before=${next}`);
      setEntries((old) => [...old, ...history.items]);
      setNext(history.nextBefore);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow muted">FOLLOW EVERY CREDIT</span>
          <h1>Credits & usage</h1>
          <p>Review reservations, completed work and account adjustments.</p>
        </div>
        <button className="button" onClick={load} disabled={busy}>
          <RefreshCw size={16} />
          Refresh credits
        </button>
      </div>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {!data && !error && <p role="status">Loading credits…</p>}
      {data && (
        <>
          <div className="alert">
            {data.mode === "credits"
              ? "AI jobs reserve the displayed credits before starting. Successful saved results consume that quote. Interrupted or failed provider calls stay reserved for review."
              : "Self-hosted mode: AI requests use your configured provider account directly. Product credits are not required; the provider may charge for usage."}{" "}
            Payments and purchased plans are not connected.
          </div>
          <div className="ops-grid">
            <section className="panel">
              <h2>Available credits</h2>
              <p className="credits-total">{data.available.toLocaleString()}</p>
              <p className="small-copy">Granted credits ready to use.</p>
            </section>
            <section className="panel">
              <h2>Reserved credits</h2>
              <p className="credits-total">{data.reserved.toLocaleString()}</p>
              <p className="small-copy">
                Held for running jobs or provider-usage review.
              </p>
            </section>
          </div>
          {data.mode === "credits" && (
            <section className="panel">
              <h2>AI credit prices</h2>
              <p>
                Strategy: {data.prices.strategy} · Content & script:{" "}
                {data.prices.content} · Scene rewrite: {data.prices.scene}
              </p>
              <p className="small-copy">
                One quoted charge per saved result, including its configured
                fallback attempt. Credits are product units, not provider
                invoices or currency.
              </p>
            </section>
          )}
          <section className="panel">
            <h2>Open reservations</h2>
            {!data.reservations.length ? (
              <p className="small-copy">No credits are currently reserved.</p>
            ) : (
              data.reservations.map((r: any) => (
                <div className="panel" key={r.id}>
                  <div className="section-top">
                    <strong>{r.credits} credits</strong>
                    <span className="pill">
                      {r.state === "REVIEW" ? "Needs review" : "Reserved"}
                    </span>
                  </div>
                  <p className="small-copy">
                    {new Date(r.createdAt).toLocaleString()} · {r.reference}
                  </p>
                  {r.state === "REVIEW" && (
                    <p>
                      Provider usage is unresolved. An administrator must review
                      the provider record before releasing or consuming these
                      credits.
                    </p>
                  )}
                  {admin && r.state === "REVIEW" && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void resolve(r.id);
                      }}
                    >
                      <label>
                        Credits to consume
                        <input
                          type="number"
                          required
                          min="0"
                          max={r.credits}
                          value={resolution[r.id]?.consumed ?? ""}
                          onChange={(e) =>
                            setResolution((old) => ({
                              ...old,
                              [r.id]: {
                                reason: old[r.id]?.reason || "",
                                consumed: e.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Provider review evidence
                        <textarea
                          required
                          minLength={10}
                          maxLength={1000}
                          value={resolution[r.id]?.reason ?? ""}
                          onChange={(e) =>
                            setResolution((old) => ({
                              ...old,
                              [r.id]: {
                                consumed: old[r.id]?.consumed || "",
                                reason: e.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <button className="button" disabled={busy}>
                        Resolve reservation
                      </button>
                    </form>
                  )}
                </div>
              ))
            )}
          </section>
          <section className="panel">
            <h2>Credit history</h2>
            {!entries.length ? (
              <p className="small-copy">
                No credit transactions have been recorded.
              </p>
            ) : (
              <div className="content-table-wrap">
                <table className="content-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Action</th>
                      <th>Available change</th>
                      <th>Reserved change</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id}>
                        <td>{new Date(e.createdAt).toLocaleString()}</td>
                        <td>{e.kind.toLowerCase()}</td>
                        <td>
                          {e.availableDelta > 0 ? "+" : ""}
                          {e.availableDelta}
                        </td>
                        <td>
                          {e.reservedDelta > 0 ? "+" : ""}
                          {e.reservedDelta}
                        </td>
                        <td>{e.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {next && (
              <button className="button" disabled={busy} onClick={more}>
                Load older entries
              </button>
            )}
          </section>
          {admin && (
            <section className="panel">
              <h2>Platform credit adjustment</h2>
              <p className="small-copy">
                Available only to verified platform administrators. Every
                adjustment is permanent in the ledger; corrections require
                another entry. This does not transfer money.
              </p>
              <form onSubmit={adjust}>
                <label>
                  Credits to add or remove
                  <input
                    type="number"
                    required
                    min="-1000000"
                    max="1000000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <label>
                  Adjustment reason
                  <textarea
                    required
                    minLength={10}
                    maxLength={1000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <button className="button" disabled={busy || !Number(amount)}>
                  Record adjustment
                </button>
              </form>
            </section>
          )}
        </>
      )}
    </>
  );
}
