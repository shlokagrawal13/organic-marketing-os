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
  const checkoutKeys = useRef<Record<string, string>>({});
  const portalKey = useRef<string | null>(null);
  const [data, setData] = useState<any>(null),
    [billing, setBilling] = useState<any>(null),
    [entries, setEntries] = useState<any[]>([]),
    [next, setNext] = useState<number | null>(null),
    [invoices, setInvoices] = useState<any[]>([]),
    [nextInvoiceBefore, setNextInvoiceBefore] = useState<string | null>(null);
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
      const [summary, billingSummary, history, invoiceHistory, access] =
        await Promise.all([
        api(base + "/credits"),
        api(base + "/billing"),
        api(base + "/credits/entries"),
        api(base + "/billing/invoices"),
        api("/platform/access"),
      ]);
      setData(summary);
      setBilling(billingSummary);
      setEntries(history.items);
      setNext(history.nextBefore);
      setInvoices(invoiceHistory.items);
      setNextInvoiceBefore(invoiceHistory.nextBefore);
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
  async function moreInvoices() {
    setBusy(true);
    setError("");
    try {
      const history = await api(
        `${base}/billing/invoices?before=${encodeURIComponent(nextInvoiceBefore || "")}`,
      );
      setInvoices((old) => [...old, ...history.items]);
      setNextInvoiceBefore(history.nextBefore);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function money(invoice: any) {
    if (!invoice.currency || invoice.amountPaid == null) return "Provider total";
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: invoice.currency.toUpperCase(),
    }).format(invoice.amountPaid / 100);
  }
  async function checkout(planId: "starter" | "growth") {
    setBusy(true);
    setError("");
    try {
      const session = await api(base + "/billing/checkout", "POST", {
        planId,
        requestKey: (checkoutKeys.current[planId] ||= crypto.randomUUID()),
      });
      checkoutKeys.current[planId] = "";
      window.location.assign(session.url);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function portal() {
    setBusy(true);
    setError("");
    try {
      const session = await api(base + "/billing/portal", "POST", {
        requestKey: (portalKey.current ||= crypto.randomUUID()),
      });
      portalKey.current = null;
      window.location.assign(session.url);
    } catch (e) {
      setError((e as Error).message);
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
            {data.paymentsConfigured
              ? " Stripe billing is configured. Plan access changes only after a verified webhook."
              : " Payments and purchased plans are not connected."}
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
          {billing && (
            <section className="panel">
              <div className="section-top">
                <div>
                  <h2>Plan & billing</h2>
                  <p className="small-copy">
                    {billing.subscription
                      ? `${billing.subscription.plan.name} · ${billing.subscription.status.toLowerCase().replaceAll("_", " ")}`
                      : "No paid subscription is active."}
                  </p>
                </div>
                {billing.portalConfigured && (
                  <button className="button" disabled={busy} onClick={portal}>
                    Manage billing
                  </button>
                )}
              </div>
              {billing.checkoutAvailable ? (
                <div className="button-row">
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => checkout("starter")}
                  >
                    Choose Starter · 100 credits/month
                  </button>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => checkout("growth")}
                  >
                    Choose Growth · 500 credits/month
                  </button>
                </div>
              ) : !billing.checkoutConfigured ? (
                <p className="small-copy">
                  Checkout is disabled until the deployment operator configures
                  Stripe prices and webhook signing.
                </p>
              ) : (
                <p className="small-copy">
                  Use Manage billing to change the active Stripe subscription.
                </p>
              )}
              <p className="small-copy">
                A Checkout success redirect never grants plan access by itself.
                Signed subscription and invoice events are the source of truth.
              </p>
              {billing.policy && (
                <div className="content-table-wrap">
                  <table className="content-table">
                    <thead>
                      <tr>
                        <th>Policy</th>
                        <th>Current behavior</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(billing.policy).map(([name, text]) => (
                        <tr key={name}>
                          <td>{name}</td>
                          <td>{text as string}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
          {billing && (
            <section className="panel">
              <h2>Invoices</h2>
              {!invoices.length ? (
                <p className="small-copy">
                  No verified billing invoices have been received yet.
                </p>
              ) : (
                <div className="content-table-wrap">
                  <table className="content-table">
                    <thead>
                      <tr>
                        <th>Period</th>
                        <th>Status</th>
                        <th>Credits</th>
                        <th>Amount paid</th>
                        <th>Provider invoice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr key={invoice.id}>
                          <td>
                            {new Date(invoice.periodStart).toLocaleDateString()}{" "}
                            – {new Date(invoice.periodEnd).toLocaleDateString()}
                          </td>
                          <td>{invoice.status}</td>
                          <td>{invoice.creditsGranted}</td>
                          <td>{money(invoice)}</td>
                          <td>
                            {invoice.hostedInvoiceUrl ? (
                              <a href={invoice.hostedInvoiceUrl}>Open invoice</a>
                            ) : invoice.invoicePdfUrl ? (
                              <a href={invoice.invoicePdfUrl}>Open PDF</a>
                            ) : (
                              <span className="small-copy">
                                {invoice.provider}:{invoice.externalInvoiceId}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {nextInvoiceBefore && (
                <button
                  className="button"
                  disabled={busy}
                  onClick={moreInvoices}
                >
                  Load older invoices
                </button>
              )}
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
