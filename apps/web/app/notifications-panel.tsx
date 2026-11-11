"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Check,
  LoaderCircle,
  RotateCcw,
  Settings2,
  X,
} from "lucide-react";
import { api } from "./api-client";

type Notification = {
  id: string;
  type: string;
  category: string;
  title: string;
  body: string;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
};

const NOTIFICATION_CATEGORIES = [
  {
    value: "RENDER",
    label: "Render updates",
    description: "Completed, failed, or canceled video renders.",
  },
  {
    value: "PUBLISH",
    label: "Publishing updates",
    description: "Successful and failed publication attempts.",
  },
  {
    value: "AI",
    label: "AI generation updates",
    description: "Failures from asynchronous AI generation jobs.",
  },
  {
    value: "BILLING",
    label: "Billing updates",
    description: "Low credits, payment failures, and subscription changes.",
  },
  {
    value: "APPROVAL",
    label: "Approval updates",
    description: "Policy and scheduling approvals that need attention.",
  },
  {
    value: "CONTENT",
    label: "Content updates",
    description: "Content revisions ready for review.",
  },
] as const;

function relativeTime(value: string) {
  const age = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(age / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function NotificationsPanel({
  base,
  disabled = false,
}: {
  base: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [mutedCategories, setMutedCategories] = useState<string[]>([]);
  const [savedMutedCategories, setSavedMutedCategories] = useState<string[]>(
    [],
  );
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [preferencesBusy, setPreferencesBusy] = useState(false);
  const [preferencesError, setPreferencesError] = useState("");
  const [preferencesNotice, setPreferencesNotice] = useState("");
  const generation = useRef(0);
  const preferencesGeneration = useRef(0);

  const preferencesDirty =
    mutedCategories.join("\u0000") !== savedMutedCategories.join("\u0000");

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const generationId = ++generation.current;
      try {
        const result = await api(
          `${base}/notifications?take=20`,
          "GET",
          undefined,
          signal,
        );
        if (generationId !== generation.current) return;
        setItems(result.items || []);
        setUnreadCount(result.unreadCount || 0);
        setError("");
      } catch (cause) {
        if ((cause as Error).name === "AbortError") return;
        if (generationId === generation.current)
          setError((cause as Error).message);
      } finally {
        if (generationId === generation.current) setLoading(false);
      }
    },
    [base],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setItems([]);
    setUnreadCount(0);
    setPreferencesOpen(false);
    setMutedCategories([]);
    setSavedMutedCategories([]);
    setPreferencesError("");
    setPreferencesNotice("");
    void load(controller.signal);
    const timer = window.setInterval(() => void load(), 60000);
    return () => {
      controller.abort();
      generation.current++;
      preferencesGeneration.current++;
      window.clearInterval(timer);
    };
  }, [load]);

  const loadPreferences = useCallback(
    async (signal?: AbortSignal) => {
      const generationId = ++preferencesGeneration.current;
      setPreferencesLoading(true);
      setPreferencesError("");
      try {
        const result = await api(
          `${base}/notifications/preferences`,
          "GET",
          undefined,
          signal,
        );
        if (generationId !== preferencesGeneration.current) return;
        const next = Array.isArray(result.mutedCategories)
          ? NOTIFICATION_CATEGORIES.map((category) => category.value).filter(
              (category) => result.mutedCategories.includes(category),
            )
          : [];
        setMutedCategories(next);
        setSavedMutedCategories(next);
      } catch (cause) {
        if ((cause as Error).name === "AbortError") return;
        if (generationId === preferencesGeneration.current) {
          setPreferencesError((cause as Error).message);
        }
      } finally {
        if (generationId === preferencesGeneration.current) {
          setPreferencesLoading(false);
        }
      }
    },
    [base],
  );

  function openPreferences() {
    setPreferencesOpen(true);
    setPreferencesNotice("");
    void loadPreferences();
  }

  function closePreferences() {
    setMutedCategories(savedMutedCategories);
    setPreferencesError("");
    setPreferencesNotice("");
    setPreferencesOpen(false);
  }

  function toggleCategory(category: string) {
    setPreferencesNotice("");
    setMutedCategories((current) =>
      current.includes(category)
        ? current.filter((value) => value !== category)
        : [...current, category],
    );
  }

  async function savePreferences() {
    setPreferencesBusy(true);
    setPreferencesError("");
    setPreferencesNotice("");
    const next = NOTIFICATION_CATEGORIES.map((category) => category.value).filter(
      (category) => mutedCategories.includes(category),
    );
    try {
      const result = await api(`${base}/notifications/preferences`, "PUT", {
        mutedCategories: next,
      });
      const saved = Array.isArray(result.mutedCategories) ? result.mutedCategories : next;
      setMutedCategories(saved);
      setSavedMutedCategories(saved);
      setPreferencesNotice("Notification preferences saved.");
      setLoading(true);
      await load();
    } catch (cause) {
      setPreferencesError((cause as Error).message);
    } finally {
      setPreferencesBusy(false);
    }
  }

  async function setRead(notification: Notification, read: boolean) {
    setBusyId(notification.id);
    setError("");
    try {
      const updated = await api(
        `${base}/notifications/${notification.id}/${read ? "read" : "unread"}`,
        "POST",
      );
      setItems((current) =>
        current.map((item) =>
          item.id === notification.id
            ? { ...item, readAt: updated.readAt }
            : item,
        ),
      );
      setUnreadCount((count) => Math.max(0, count + (read ? -1 : 1)));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function readAll() {
    setBusyId("all");
    setError("");
    try {
      await api(`${base}/notifications/read-all`, "POST");
      setItems((current) =>
        current.map((item) => ({ ...item, readAt: new Date().toISOString() })),
      );
      setUnreadCount(0);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="notification-center">
      <button
        className="icon-button notification-trigger"
        type="button"
        aria-label={
          unreadCount
            ? `Notifications (${unreadCount} unread)`
            : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span
            className="notification-count"
            aria-label={`${unreadCount} unread`}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <section
          className="notification-popover"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="notification-popover-head">
            <div>
              <span className="eyebrow muted">WORKSPACE UPDATES</span>
              <h2>{preferencesOpen ? "Notification preferences" : "Notifications"}</h2>
            </div>
            <div className="notification-popover-actions">
              {preferencesOpen ? (
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Back to notifications"
                  title="Back to notifications"
                  disabled={preferencesBusy}
                  onClick={closePreferences}
                >
                  <ArrowLeft size={16} />
                </button>
              ) : (
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Notification preferences"
                  title="Notification preferences"
                  disabled={loading || busyId !== null}
                  onClick={openPreferences}
                >
                  <Settings2 size={16} />
                </button>
              )}
              <button
                className="icon-button"
                type="button"
                aria-label="Refresh notifications"
                title="Refresh notifications"
                disabled={preferencesOpen || loading || busyId !== null}
                onClick={() => {
                  setLoading(true);
                  void load();
                }}
              >
                <RotateCcw size={16} />
              </button>
              <button
                className="icon-button"
                type="button"
                aria-label="Close notifications"
                onClick={() => setOpen(false)}
              >
                <X size={17} />
              </button>
            </div>
          </div>
          {preferencesOpen ? (
            <div className="notification-preferences">
              <p className="notification-preferences-copy">
                Choose which in-app categories appear in your feed and unread
                count. Changes apply only to your account in this workspace.
              </p>
              {preferencesError && (
                <p className="notification-error" role="alert">
                  {preferencesError}
                </p>
              )}
              {preferencesNotice && (
                <p className="notification-success" role="status">
                  {preferencesNotice}
                </p>
              )}
              {preferencesLoading ? (
                <div className="notification-empty">
                  <LoaderCircle className="spin" size={18} /> Loading preferences…
                </div>
              ) : (
                <div className="notification-preference-list">
                  {NOTIFICATION_CATEGORIES.map((category) => (
                    <label
                      className="notification-preference-row"
                      key={category.value}
                    >
                      <input
                        type="checkbox"
                        checked={mutedCategories.includes(category.value)}
                        disabled={preferencesBusy}
                        onChange={() => toggleCategory(category.value)}
                      />
                      <span className="notification-preference-copy">
                        <strong>{category.label}</strong>
                        <small>{category.description}</small>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <div className="notification-preferences-actions">
                <button
                  className="text-button"
                  type="button"
                  disabled={preferencesBusy}
                  onClick={closePreferences}
                >
                  Cancel
                </button>
                <button
                  className="button primary"
                  type="button"
                  disabled={
                    preferencesBusy || preferencesLoading || !preferencesDirty
                  }
                  onClick={() => void savePreferences()}
                >
                  {preferencesBusy ? "Saving…" : "Save preferences"}
                </button>
              </div>
            </div>
          ) : (
            <>
          {error && (
            <p className="notification-error" role="alert">
              {error}
            </p>
          )}
          {unreadCount > 0 && (
            <button
              className="text-button notification-read-all"
              type="button"
              disabled={busyId !== null}
              onClick={() => void readAll()}
            >
              <Check size={15} /> Mark all as read
            </button>
          )}
          <div className="notification-list" aria-live="polite">
            {loading ? (
              <div className="notification-empty">
                <LoaderCircle className="spin" size={18} /> Loading updates…
              </div>
            ) : items.length === 0 ? (
              <div className="notification-empty">You’re all caught up.</div>
            ) : (
              items.map((notification) => {
                const unread = !notification.readAt;
                return (
                  <article
                    className={`notification-row ${unread ? "unread" : ""}`}
                    key={notification.id}
                  >
                    <button
                      className="notification-content"
                      type="button"
                      onClick={() => unread && void setRead(notification, true)}
                      aria-label={`${notification.title}${unread ? ", unread" : ""}`}
                    >
                      <span className="notification-category">
                        {notification.category}
                      </span>
                      <strong>{notification.title}</strong>
                      <span>{notification.body}</span>
                      <small>{relativeTime(notification.createdAt)}</small>
                    </button>
                    <button
                      className="notification-toggle"
                      type="button"
                      aria-label={
                        unread
                          ? "Mark notification as read"
                          : "Mark notification as unread"
                      }
                      disabled={busyId !== null}
                      onClick={() => void setRead(notification, unread)}
                    >
                      {unread ? <Check size={15} /> : <Bell size={15} />}
                    </button>
                  </article>
                );
              })
            )}
          </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
