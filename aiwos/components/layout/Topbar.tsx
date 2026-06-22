"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Bot,
  Check,
  CheckSquare,
  FolderKanban,
  GitBranch,
  Menu,
  Plus,
  Search,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Sidebar } from "@/components/layout/Sidebar";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth";
import { searchApi, type SearchResult } from "@/lib/api/search";
import { notificationApi, type NotificationApiResponse } from "@/lib/api/notifications";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/agents": "Agents",
  "/tasks": "Tasks",
  "/workflows": "Workflows",
  "/projects": "Projects",
  "/knowledge": "Knowledge Base",
  "/chat": "Communications",
  "/analytics": "Analytics",
  "/integrations": "Integrations",
  "/settings": "Settings",
};

const CREATE_OPTIONS = [
  { label: "Task", icon: CheckSquare, href: "/tasks" },
  { label: "Agent", icon: Bot, href: "/agents" },
  { label: "Workflow", icon: GitBranch, href: "/workflows" },
  { label: "Project", icon: FolderKanban, href: "/projects" },
] as const;

function resultUrl(r: SearchResult): string {
  if (r.type === "project") return `/projects/${r.id}`;
  if (r.type === "agent") return `/agents`;
  if (r.type === "task") return `/tasks`;
  return `/workflows`;
}

function typeLabel(type: SearchResult["type"]): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const title = PAGE_TITLES[pathname] ?? "Dashboard";
  const searchId = useId();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { currentOrgId } = useAuthStore();

  // ─── Search ───────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value;
      setSearchQuery(q);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (!q.trim() || !currentOrgId) {
        setSearchResults([]);
        setSearchOpen(false);
        return;
      }
      searchTimerRef.current = setTimeout(async () => {
        try {
          const data = await searchApi.search(currentOrgId, q);
          setSearchResults(data.results);
          setSearchOpen(data.results.length > 0);
        } catch {
          setSearchResults([]);
          setSearchOpen(false);
        }
      }, 300);
    },
    [currentOrgId]
  );

  const handleResultClick = (r: SearchResult) => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    router.push(resultUrl(r));
  };

  // ─── Notifications ────────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationApiResponse[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const fetchNotifications = useCallback(async () => {
    if (!currentOrgId) return;
    try {
      const data = await notificationApi.list(currentOrgId);
      setNotifications(data);
    } catch {
      // ignore
    }
  }, [currentOrgId]);

  // Load unread count on mount
  useEffect(() => {
    if (currentOrgId) fetchNotifications();
  }, [currentOrgId, fetchNotifications]);

  const handleNotifToggle = () => {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) fetchNotifications();
  };

  const handleMarkRead = async (id: string) => {
    try {
      const updated = await notificationApi.markRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? updated : n)));
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    if (!currentOrgId) return;
    try {
      await notificationApi.markAllRead(currentOrgId);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // ignore
    }
  };

  // ─── Create dropdown ──────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);

  // ─── Click-outside handler ────────────────────────────────
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (createRef.current && !createRef.current.contains(e.target as Node)) {
        setCreateOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <>
      <header
        className="z-10 flex h-14 min-h-14 items-center gap-3 px-4 sm:px-5"
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border-light)",
        }}
      >
        {/* Hamburger button — mobile only */}
        <button
          type="button"
          className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus:ring-2 focus:ring-primary/25 focus:outline-none"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>

        {/* Page title */}
        <div className="flex-1">
          <span className="line-clamp-1 text-[15px] font-semibold text-foreground">
            {title}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative hidden items-center sm:flex" ref={searchRef}>
            <label className="sr-only" htmlFor={searchId}>
              Search workspace
            </label>
            <Search
              size={14}
              className="absolute left-2.5 pointer-events-none"
              style={{ color: "var(--faint)" }}
            />
            <input
              id={searchId}
              type="search"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => {
                if (searchResults.length > 0) setSearchOpen(true);
              }}
              className="h-8 rounded-lg border pl-8 pr-3 text-[13px] outline-none transition-colors focus:border-primary"
              style={{
                background: "var(--input-bg)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
                width: "200px",
              }}
              placeholder="Search anything..."
              autoComplete="off"
            />

            {/* Search results dropdown */}
            {searchOpen && searchResults.length > 0 && (
              <div
                className="absolute top-full left-0 z-50 mt-1 w-72 rounded-lg border py-1 shadow-lg"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                }}
              >
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors hover:bg-card"
                    onClick={() => handleResultClick(r)}
                  >
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                      style={{
                        background: "var(--purple-subtle, rgba(124,58,237,0.12))",
                        color: "var(--purple)",
                      }}
                    >
                      {typeLabel(r.type)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-foreground">{r.title}</span>
                    {r.subtitle && (
                      <span className="shrink-0 truncate text-[11px] text-muted-foreground">
                        {r.subtitle}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus:ring-2 focus:ring-primary/25 focus:outline-none"
              aria-label="Notifications"
              onClick={handleNotifToggle}
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span
                  className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full border border-[var(--surface)] text-[9px] font-bold text-white"
                  style={{ background: "var(--red)" }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
              {unreadCount === 0 && notifications.length === 0 && (
                <span
                  className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full border border-[var(--surface)] opacity-0"
                  style={{ background: "var(--red)" }}
                />
              )}
            </button>

            {/* Notifications dropdown */}
            {notifOpen && (
              <div
                className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border shadow-lg"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                }}
              >
                <div
                  className="flex items-center justify-between border-b px-3 py-2"
                  style={{ borderColor: "var(--border-light)" }}
                >
                  <span className="text-[13px] font-semibold text-foreground">
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      onClick={handleMarkAllRead}
                    >
                      <Check size={11} />
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                      No notifications
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          "flex items-start gap-2.5 px-3 py-2.5 border-b last:border-b-0 transition-colors",
                          !n.is_read ? "bg-[var(--purple-subtle,rgba(124,58,237,0.06))]" : ""
                        )}
                        style={{ borderColor: "var(--border-light)" }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-medium text-foreground leading-snug">
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                              {n.body}
                            </p>
                          )}
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {timeAgo(n.created_at)}
                          </p>
                        </div>
                        {!n.is_read && (
                          <button
                            type="button"
                            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Mark as read"
                            onClick={() => handleMarkRead(n.id)}
                          >
                            <Check size={12} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Settings */}
          <Link
            href="/settings"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus:ring-2 focus:ring-primary/25 focus:outline-none"
            aria-label="Settings"
          >
            <Settings size={16} />
          </Link>

          {/* Create */}
          <div className="relative hidden sm:block" ref={createRef}>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-white transition-all hover:-translate-y-px focus:ring-2 focus:ring-primary/25 focus:outline-none"
              style={{ background: "var(--purple)" }}
              onClick={() => setCreateOpen((v) => !v)}
            >
              <Plus size={14} />
              Create
            </button>

            {createOpen && (
              <div
                className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border py-1 shadow-lg"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                }}
              >
                {CREATE_OPTIONS.map(({ label, icon: Icon, href }) => (
                  <Link
                    key={label}
                    href={href}
                    className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-foreground transition-colors hover:bg-card"
                    onClick={() => setCreateOpen(false)}
                  >
                    <Icon size={14} className="text-muted-foreground" />
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile drawer — only rendered on small screens */}
      <div className="lg:hidden">
        {/* Backdrop */}
        <div
          className={cn(
            "fixed inset-0 z-40 bg-black/50 transition-opacity duration-200",
            drawerOpen
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          )}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
        {/* Slide-in drawer */}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out",
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="relative h-full">
            <Sidebar isMobile onNavClick={() => setDrawerOpen(false)} />
            <button
              type="button"
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus:outline-none"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
