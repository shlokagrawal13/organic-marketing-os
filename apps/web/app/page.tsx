"use client";
import { useState, useEffect } from "react";
import { AuthUI, WorkspaceSetup } from "./auth-ui";
import { api } from "./api-client";
import Workspace from "./workspace";
export default function App() {
  const [state, setState] = useState<any>(null),
    [error, setError] = useState(""),
    [linkMessage, setLinkMessage] = useState("");
  async function load() {
    try {
      const me = await api("/auth/me");
      const memberships = await api("/organizations");
      setState({ ...me, memberships });
    } catch (e) {
      if ((e as any).status === 401) setState({ user: null });
      else setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const verify = params.get("verify"),
      invite = params.get("invite");
    if (verify) {
      history.replaceState(null, "", "/");
      api("/auth/verify-email", "POST", { token: verify })
        .then(() => {
          setLinkMessage("Your email has been verified.");
          load();
        })
        .catch((e) => setLinkMessage(e.message));
    } else if (invite && state?.user) {
      history.replaceState(null, "", "/");
      api("/organizations/accept-invitation", "POST", { token: invite })
        .then(() => {
          setLinkMessage("Workspace invitation accepted.");
          load();
        })
        .catch((e) => setLinkMessage(e.message));
    }
  }, [state?.user?.id]);
  if (error)
    return (
      <main className="setup">
        <div role="alert" className="panel">
          <h1>Workspace unavailable</h1>
          <p>{error}</p>
          <button
            className="button primary"
            onClick={() => {
              setError("");
              load();
            }}
          >
            Try again
          </button>
        </div>
      </main>
    );
  if (!state)
    return (
      <main className="loading" role="status">
        Opening your workspace…
      </main>
    );
  const resetToken =
    new URLSearchParams(location.search).get("reset") || undefined;
  if (!state.user || resetToken)
    return (
      <>
        {linkMessage && (
          <div className="link-message" role="status">
            {linkMessage}
          </div>
        )}
        <AuthUI onDone={load} resetToken={resetToken} />
      </>
    );
  if (!state.memberships.length) return <WorkspaceSetup onDone={load} />;
  return (
    <>
      {linkMessage && (
        <div className="link-message" role="status">
          {linkMessage}
          <button onClick={() => setLinkMessage("")}>Dismiss</button>
        </div>
      )}
      <Workspace session={state} onReload={load} />
    </>
  );
}
