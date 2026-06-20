"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Search, Bell, Settings, Plus, Menu, X } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Sidebar } from "@/components/layout/Sidebar";
import { cn } from "@/lib/utils";

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

export function Topbar() {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "Dashboard";
  const searchId = useId();
  const [drawerOpen, setDrawerOpen] = useState(false);

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
        <div className="relative hidden items-center sm:flex">
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
            className="h-8 rounded-lg border pl-8 pr-3 text-[13px] outline-none transition-colors focus:border-primary"
            style={{
              background: "var(--input-bg)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
              width: "200px",
            }}
            placeholder="Search anything..."
          />
        </div>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <button
          type="button"
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus:ring-2 focus:ring-primary/25 focus:outline-none"
          aria-label="Notifications"
        >
          <Bell size={16} />
          <span
            className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full border border-[var(--surface)]"
            style={{ background: "var(--red)" }}
          />
        </button>

        {/* Settings */}
        <Link
          href="/settings"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus:ring-2 focus:ring-primary/25 focus:outline-none"
          aria-label="Settings"
        >
          <Settings size={16} />
        </Link>

        {/* Create */}
        <button
          type="button"
          className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-white transition-all hover:-translate-y-px focus:ring-2 focus:ring-primary/25 focus:outline-none sm:flex"
          style={{ background: "var(--purple)" }}
        >
          <Plus size={14} />
          Create
        </button>
      </div>
    </header>

    {/* Mobile drawer — only rendered on small screens */}
    <div className="lg:hidden">
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-200",
          drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />
      {/* Slide-in drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
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
