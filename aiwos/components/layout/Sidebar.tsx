"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  CheckSquare,
  GitBranch,
  Folder,
  BookOpen,
  MessageCircle,
  BarChart2,
  Plug,
  Settings,
  MoreVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  {
    section: "Main",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Agents", href: "/agents", icon: Bot, badge: 128 },
      { label: "Tasks", href: "/tasks", icon: CheckSquare, badge: 342 },
      { label: "Workflows", href: "/workflows", icon: GitBranch },
      { label: "Projects", href: "/projects", icon: Folder },
    ],
  },
  {
    section: "Intelligence",
    items: [
      { label: "Knowledge Base", href: "/knowledge", icon: BookOpen },
      { label: "Communications", href: "/chat", icon: MessageCircle },
      { label: "Analytics", href: "/analytics", icon: BarChart2 },
    ],
  },
  {
    section: "Configuration",
    items: [
      { label: "Integrations", href: "/integrations", icon: Plug },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden h-full w-[220px] min-w-[220px] flex-col overflow-hidden md:flex"
      style={{ background: "var(--surface)", borderRight: "1px solid var(--border-light)" }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-4 py-4"
        style={{ borderBottom: "1px solid var(--border-light)" }}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
          style={{ background: "var(--purple)" }}
        >
          A
        </div>
        <div>
          <div className="text-[15px] font-bold text-foreground">AIWOS</div>
          <div className="text-[10px]" style={{ color: "var(--faint)" }}>
            AI Workforce OS
          </div>
        </div>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-2" aria-label="Primary">
        {NAV.map((section) => (
          <div key={section.section} className="mb-1">
            <div
              className="mb-1 px-1.5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--faint)" }}
            >
              {section.section}
            </div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-normal transition-all",
                    isActive
                      ? "font-medium"
                      : "text-muted-foreground hover:bg-card hover:text-foreground",
                  )}
                  style={
                    isActive
                      ? {
                          background: "var(--accent-glow)",
                          color: "var(--purple)",
                        }
                      : {}
                  }
                  aria-current={isActive ? "page" : undefined}
                >
                  {isActive && (
                    <span
                      className="absolute top-1/2 left-0 h-4 w-[3px] -translate-y-1/2 rounded-r"
                      style={{ background: "var(--purple)" }}
                    />
                  )}
                  <Icon size={16} className="shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span
                      className="ml-auto rounded-full px-1.5 py-px text-[10px] font-semibold text-white"
                      style={{ background: "var(--purple)" }}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User pill */}
      <div
        className="p-3"
        style={{ borderTop: "1px solid var(--border-light)" }}
      >
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-card focus:ring-2 focus:ring-primary/25 focus:outline-none"
          aria-label="Open user menu"
        >
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
            style={{
              background: "linear-gradient(135deg, var(--purple), var(--cyan))",
            }}
          >
            JD
          </div>
          <div className="flex-1 text-left">
            <div className="text-xs font-medium text-foreground">John Doe</div>
            <div className="text-[11px]" style={{ color: "var(--faint)" }}>
              Admin
            </div>
          </div>
          <MoreVertical size={12} className="text-muted-foreground" />
        </button>
      </div>
    </aside>
  );
}
