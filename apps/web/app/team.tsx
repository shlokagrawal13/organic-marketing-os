"use client";
import { useEffect, useState } from "react";
import { api } from "./api-client";
export default function Team({
  base,
  owner,
}: {
  base: string;
  owner: boolean;
}) {
  const [team, setTeam] = useState<any>({ members: [], invitations: [] }),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      setTeam(await api(base + "/team"));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    load();
  }, [base]);
  async function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError("");
    try {
      await api(base + "/team/invite", "POST", data);
      form.reset();
      setNotice("Invitation sent.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel team-panel">
      <h3>People in this workspace</h3>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="team-list">
        {team.members.map((m: any) => (
          <div key={m.userId}>
            <div>
              <b>{m.user.name}</b>
              <small>{m.user.email}</small>
            </div>
            <span className="pill">{m.role}</span>
            {owner && m.role !== "OWNER" && (
              <button
                className="text-button danger"
                disabled={busy}
                onClick={async () => {
                  if (!confirm(`Remove ${m.user.name} from this workspace?`))
                    return;
                  setBusy(true);
                  try {
                    await api(base + `/team/${m.userId}`, "DELETE");
                    await load();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={invite}>
        <h3>Invite a teammate</h3>
        <div className="form-grid">
          <label>
            Email address
            <input type="email" name="email" required />
          </label>
          <label>
            Workspace role
            <select name="role" defaultValue="CREATOR">
              {["ADMIN", "EDITOR", "CREATOR", "ANALYST", "CLIENT"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
        </div>
        <button className="button primary" disabled={busy}>
          {busy ? "Sending…" : "Send invitation"}
        </button>
        <p className="field-help">
          The recipient must sign in with the invited email address. Email
          delivery must be configured.
        </p>
      </form>
      {team.invitations.length > 0 && (
        <>
          <h3>Pending invitations</h3>
          {team.invitations.map((i: any) => (
            <div className="account-row" key={i.id}>
              <span>{i.email}</span>
              <b>{i.role}</b>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
