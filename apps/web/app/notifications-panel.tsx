"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
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
import { notificationStreamRetryDelay } from "./notifications-stream";

type Notification = {
  id: string;
  type: string;
  category: string;
  title: string;
  body: string;
  link?: string | null;
  data?: Record<string, unknown> | null;
  readAt?: string | null;
  createdAt: string;
};

type NotificationCategory =
  "RENDER" | "PUBLISH" | "AI" | "BILLING" | "APPROVAL" | "CONTENT";

type NotificationCategoryFilter = "ALL" | NotificationCategory;

const NOTIFICATION_PAGE_SIZE = 20;

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
  onOpenNotification,
}: {
  base: string;
  disabled?: boolean;
  onOpenNotification?: (notification: Notification) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categoryFilter, setCategoryFilter] =
    useState<NotificationCategoryFilter>("ALL");
  const [hasMore, setHasMore] = useState(false);
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
  const [streamState, setStreamState] = useState<
    "connecting" | "live" | "reconnecting" | "fallback"
  >(disabled ? "fallback" : "connecting");
  const generation = useRef(0);
  const preferencesGeneration = useRef(0);
  const streamRef = useRef<EventSource | null>(null);
  const streamRetryRef = useRef<number | null>(null);
  const streamAttemptRef = useRef(0);
  const categoryFilterRef = useRef<NotificationCategoryFilter>("ALL");
  const loadingMoreRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogId = useId();
  const dialogTitleId = useId();

  const preferencesDirty =
    mutedCategories.join("\u0000") !== savedMutedCategories.join("\u0000");

  const load = useCallback(
    async (
      signal?: AbortSignal,
      options: {
        category?: NotificationCategoryFilter;
        skip?: number;
        append?: boolean;
      } = {},
    ) => {
      const generationId = ++generation.current;
      const category = options.category ?? categoryFilterRef.current;
      const skip = options.skip ?? 0;
      const query = new URLSearchParams({
        take: String(NOTIFICATION_PAGE_SIZE),
        skip: String(skip),
      });
      if (category !== "ALL") query.set("category", category);
      try {
        const [result, summary] = await Promise.all([
          api(
            `${base}/notifications?${query.toString()}`,
            "GET",
            undefined,
            signal,
          ),
          api(`${base}/notifications/summary`, "GET", undefined, signal),
        ]);
        if (generationId !== generation.current) return;
        const nextItems = Array.isArray(result.items) ? result.items : [];
        setItems((current) =>
          options.append ? [...current, ...nextItems] : nextItems,
        );
        setUnreadCount(summary.totalUnread || 0);
        setHasMore(skip + nextItems.length < (result.total || 0));
        setError("");
      } catch (cause) {
        if ((cause as Error).name === "AbortError") return;
        if (generationId === generation.current)
          setError((cause as Error).message);
      } finally {
        if (generationId === generation.current) setLoading(false);
        if (options.append) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
      }
    },
    [base],
  );

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    void load(undefined, {
      category: categoryFilterRef.current,
      skip: items.length,
      append: true,
    });
  }, [hasMore, items.length, load, loading, loadingMore]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setItems([]);
    setUnreadCount(0);
    setCategoryFilter("ALL");
    categoryFilterRef.current = "ALL";
    setHasMore(false);
    setPreferencesOpen(false);
    setMutedCategories([]);
    setSavedMutedCategories([]);
    setPreferencesError("");
    setPreferencesNotice("");
    setStreamState(disabled ? "fallback" : "connecting");
    streamAttemptRef.current = 0;
    void load(controller.signal, { category: "ALL" });
    const timer = window.setInterval(() => {
      if (!loadingMoreRef.current) void load();
    }, 60000);
    let disposed = false;
    const clearRetry = () => {
      if (streamRetryRef.current !== null) {
        window.clearTimeout(streamRetryRef.current);
        streamRetryRef.current = null;
      }
    };
    const closeStream = () => {
      streamRef.current?.close();
      streamRef.current = null;
    };
    const connectStream = () => {
      if (disposed || disabled || typeof window.EventSource !== "function") {
        setStreamState("fallback");
        return;
      }
      setStreamState(streamAttemptRef.current ? "reconnecting" : "connecting");
      const source = new window.EventSource(
        `/api${base}/notifications/stream`,
        { withCredentials: true },
      );
      streamRef.current = source;
      source.onopen = () => {
        streamAttemptRef.current = 0;
        setStreamState("live");
      };
      source.addEventListener("notification", (event) => {
        try {
          JSON.parse((event as MessageEvent).data);
          if (!loadingMoreRef.current)
            void load(undefined, { category: categoryFilterRef.current });
        } catch {
          setStreamState("fallback");
        }
      });
      source.onerror = () => {
        source.close();
        if (streamRef.current === source) streamRef.current = null;
        if (disposed) return;
        const attempt = streamAttemptRef.current++;
        setStreamState("reconnecting");
        clearRetry();
        streamRetryRef.current = window.setTimeout(
          connectStream,
          notificationStreamRetryDelay(attempt),
        );
      };
    };
    connectStream();
    return () => {
      disposed = true;
      controller.abort();
      generation.current++;
      loadingMoreRef.current = false;
      preferencesGeneration.current++;
      window.clearInterval(timer);
      clearRetry();
      closeStream();
    };
  }, [base, disabled, load]);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setPreferencesOpen(false);
      setOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function changeCategoryFilter(next: NotificationCategoryFilter) {
    categoryFilterRef.current = next;
    setCategoryFilter(next);
    setItems([]);
    setHasMore(false);
    setLoading(true);
    void load(undefined, { category: next });
  }

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
    const next = NOTIFICATION_CATEGORIES.map(
      (category) => category.value,
    ).filter((category) => mutedCategories.includes(category));
    try {
      const result = await api(`${base}/notifications/preferences`, "PUT", {
        mutedCategories: next,
      });
      const saved = Array.isArray(result.mutedCategories)
        ? result.mutedCategories
        : next;
      setMutedCategories(saved);
      setSavedMutedCategories(saved);
      setPreferencesNotice("Notification preferences saved.");
      setLoading(true);
      await load(undefined, { category: categoryFilterRef.current });
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
      setLoading(true);
      await load(undefined, { category: categoryFilterRef.current });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function openNotification(notification: Notification) {
    if (!notification.readAt) await setRead(notification, true);
    setOpen(false);
    setPreferencesOpen(false);
    onOpenNotification?.(notification);
  }

  return (
    <div className="notification-center">
      <button
        ref={triggerRef}
        className="icon-button notification-trigger"
        type="button"
        aria-label={
          unreadCount
            ? `Notifications (${unreadCount} unread)`
            : "Notifications"
        }
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
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
          id={dialogId}
          className="notification-popover"
          role="dialog"
          aria-label="Notifications"
          aria-labelledby={dialogTitleId}
          aria-modal="true"
        >
          <div className="notification-popover-head">
            <div>
              <span className="eyebrow muted">WORKSPACE UPDATES</span>
              <h2 id={dialogTitleId}>
                {preferencesOpen ? "Notification preferences" : "Notifications"}
              </h2>
              {!preferencesOpen && (
                <span className="notification-stream-status" role="status">
                  {streamState === "live"
                    ? "Live updates"
                    : streamState === "connecting"
                      ? "Connecting..."
                      : streamState === "reconnecting"
                        ? "Reconnecting..."
                        : "Auto-refresh enabled"}
                </span>
              )}
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
                ref={closeButtonRef}
                className="icon-button"
                type="button"
                aria-label="Close notifications"
                onClick={() => {
                  if (preferencesOpen) closePreferences();
                  setOpen(false);
                  window.requestAnimationFrame(() =>
                    triggerRef.current?.focus(),
                  );
                }}
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
                  <LoaderCircle className="spin" size={18} /> Loading
                  preferences…
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
              <div className="notification-filter-row">
                <label htmlFor="notification-category-filter">Show</label>
                <select
                  id="notification-category-filter"
                  className="notification-filter"
                  value={categoryFilter}
                  disabled={loading || loadingMore || busyId !== null}
                  onChange={(event) =>
                    changeCategoryFilter(
                      event.target.value as NotificationCategoryFilter,
                    )
                  }
                >
                  <option value="ALL">All categories</option>
                  {NOTIFICATION_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="notification-list" aria-live="polite">
                {loading ? (
                  <div className="notification-empty">
                    <LoaderCircle className="spin" size={18} /> Loading updates…
                  </div>
                ) : items.length === 0 ? (
                  <div className="notification-empty">
                    You’re all caught up.
                  </div>
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
                          onClick={() => void openNotification(notification)}
                          aria-label={`${notification.title}${unread ? ", unread" : ""}${notification.link ? ", open notification" : ""}`}
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
              {hasMore && !loading && (
                <button
                  className="text-button notification-load-more"
                  type="button"
                  disabled={loadingMore || busyId !== null}
                  onClick={loadMore}
                >
                  {loadingMore ? "Loading more…" : "Load more"}
                </button>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
