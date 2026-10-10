"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api-client";

type Connection = {
  id: string; provider: string; accountLabel: string; externalAccountId: string;
  scopes: string[]; tokenExpiresAt: string | null; refreshTokenExpiresAt: string | null;
  refreshPendingAt: string | null; revokedAt: string | null;
};

export default function SocialConnectionsPanel({ base, role }: { base: string; role: string }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const canRead = ["OWNER", "ADMIN", "EDITOR", "CREATOR"].includes(role);
  const canManage = ["OWNER", "ADMIN"].includes(role);
  const load = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    try {
      setConnections(await api(base + "/social-connections"));
      setError("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [base, canRead]);
  useEffect(() => { void load(); }, [load]);

  async function authorize() {
    setBusy(true);
    setError("");
    try {
      const result = await api(base + "/social-connections/youtube/authorize", "POST");
      window.location.assign(result.authorizationUrl);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function revoke(connection: Connection) {
    if (!window.confirm(`Disconnect ${connection.accountLabel} and revoke its Google grant? Pending submissions will be blocked.`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    let failure = "";
    try {
      const result = await api(base + `/social-connections/${connection.id}/revoke-provider`, "POST");
      setNotice(result.providerRevocation === "CONFIRMED" ? "Google grant revocation confirmed." : "Local connection blocked; provider revocation remains unconfirmed.");
    } catch (err) {
      failure = (err as Error).message;
    } finally {
      await load();
      if (failure) setError(failure);
      setBusy(false);
    }
  }

  return <section className="panel social-panel" aria-label="YouTube connections">
    <div className="social-panel-heading"><div>
      <h2>YouTube channels</h2>
      <p>Connect an owned channel for review. An account connection does not publish a video.</p>
    </div>
      {canManage && <button className="button primary" disabled={busy} onClick={authorize}>Connect or reconnect YouTube</button>}
    </div>
    {notice && <div className="inline-notice" role="status">{notice}</div>}
    {error && <div className="alert error" role="alert">{error}</div>}
    {!canRead ? <p>Only workspace owners, admins, editors and creators can view connected accounts.</p>
      : loading ? <p className="page-loading">Loading channel status…</p>
      : connections.length === 0 ? <p>No YouTube channel is connected to this workspace.</p>
      : connections.map((connection) => {
        const revoked = Boolean(connection.revokedAt);
        const uncertain = Boolean(connection.refreshPendingAt);
        const expired = Boolean(connection.tokenExpiresAt && Date.parse(connection.tokenExpiresAt) <= Date.now());
        const grantExpired = Boolean(connection.refreshTokenExpiresAt && Date.parse(connection.refreshTokenExpiresAt) <= Date.now());
        const uploadScope = connection.scopes.includes("https://www.googleapis.com/auth/youtube.upload");
        const state = revoked ? "Disconnected" : uncertain ? "Refresh uncertain — reconnect required" : grantExpired ? "Grant expired — reconnect required" : expired ? "Access token expired" : uploadScope ? "Connected for review" : "Upload permission missing";
        return <div className="social-account" key={connection.id}>
          <div><b>{connection.accountLabel}</b><small>YouTube channel {connection.externalAccountId}</small><span className="pill">{state}</span>
            {uncertain && !revoked && <p>A previous token refresh has an uncertain outcome. Reconnect the same channel; the old grant will not be retried.</p>}
            {expired && !uncertain && !revoked && <p>The access token has expired. An owner or admin can reconnect the channel before a future upload.</p>}
          </div>
          {canManage && <button className="button" disabled={busy} onClick={() => void revoke(connection)}>
            {revoked ? "Confirm provider revocation" : "Disconnect and revoke"}
          </button>}
        </div>;
      })}
  </section>;
}
