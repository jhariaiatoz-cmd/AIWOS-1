"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  CheckSquare,
  GitBranch,
  Folder,
  BookOpen,
  MessageCircle,
  BarChart2,
  TrendingUp,
  Plug,
  Settings,
  MoreVertical,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth";

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
      { label: "Executive Overview", href: "/executive", icon: TrendingUp },
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

interface SidebarProps {
  isMobile?: boolean;
  onNavClick?: () => void;
}

export function Sidebar({ isMobile, onNavClick }: SidebarProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuthStore();

  const handleSignOut = () => {
    signOut();
    router.push("/auth");
  };

  return (
    <aside
      className={
        isMobile
          ? "flex h-full w-[220px] min-w-[220px] flex-col overflow-hidden"
          : "hidden h-full w-[220px] min-w-[220px] flex-col overflow-hidden lg:flex"
      }
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
                  onClick={onNavClick}
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
        <div className="flex items-center gap-2 rounded-lg px-2 py-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
            style={{
              background: user?.isGuest
                ? "var(--faint)"
                : "linear-gradient(135deg, var(--purple), var(--cyan))",
            }}
          >
            {user?.initials ?? "?"}
          </div>
          <div className="flex-1 text-left">
            <div className="text-xs font-medium text-foreground">{user?.name ?? "—"}</div>
            <div className="text-[11px]" style={{ color: "var(--faint)" }}>
              {user?.isGuest ? "Guest" : (user?.role ?? "")}
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="ml-auto rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
