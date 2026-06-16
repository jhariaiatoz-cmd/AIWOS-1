import { Suspense } from "react";
import { Bot, GitBranch, ShieldCheck } from "lucide-react";
import { AuthPanel } from "@/components/auth/AuthPanel";

const FEATURES = [
  {
    icon: Bot,
    color: { bg: "rgba(124,58,237,0.12)", text: "#a78bfa" },
    title: "128+ Agent Templates",
    desc: "Pre-built agents for development, research, sales, HR, finance, and support.",
  },
  {
    icon: GitBranch,
    color: { bg: "rgba(6,182,212,0.12)", text: "#38bdf8" },
    title: "LangGraph Orchestration",
    desc: "Multi-agent workflows with conditional logic, state management, and real-time monitoring.",
  },
  {
    icon: ShieldCheck,
    color: { bg: "rgba(16,185,129,0.12)", text: "#34d399" },
    title: "Enterprise Security",
    desc: "SSO, role-based access, audit logs, and SOC 2 compliant infrastructure.",
  },
];

const STATS = [
  { value: "2,400+", label: "Companies" },
  { value: "1.2M+", label: "Tasks/Day" },
  { value: "99.9%", label: "Uptime" },
];

export default function AuthPage() {
  return (
    <div className="flex h-full">
      {/* ── LEFT PANEL ─────────────────────────────────── */}
      <div
        className="relative hidden flex-1 flex-col items-center justify-center overflow-hidden p-10 lg:flex"
        style={{ background: "var(--surface)" }}
      >
        {/* Ambient glows */}
        <div
          className="pointer-events-none absolute"
          style={{
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124,58,237,0.14) 0%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
        <div
          className="pointer-events-none absolute"
          style={{
            width: 300,
            height: 300,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 70%)",
            bottom: "20%",
            right: "10%",
          }}
        />

        <div className="relative z-10 w-full max-w-md">
          {/* Logo */}
          <div className="mb-10 flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white"
              style={{ background: "var(--purple)" }}
            >
              A
            </div>
            <div>
              <div className="text-[17px] font-bold">AIWOS</div>
              <div className="text-[11px]" style={{ color: "var(--faint)" }}>
                AI Workforce Operating System
              </div>
            </div>
          </div>

          {/* Headline */}
          <h1 className="mb-3 text-[28px] font-extrabold leading-tight">
            Your AI Workforce,{" "}
            <span
              style={{
                background: "linear-gradient(135deg,#a78bfa,#38bdf8)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Ready to Work.
            </span>
          </h1>
          <p className="mb-9 text-sm leading-relaxed" style={{ color: "var(--muted-foreground)", maxWidth: 380 }}>
            Deploy AI agents across every department. Automate workflows, generate software,
            and scale your operations — all from one platform.
          </p>

          {/* Feature list */}
          <div className="mb-9 flex flex-col gap-5">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="flex items-start gap-3.5">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: f.color.bg }}
                  >
                    <Icon size={18} style={{ color: f.color.text }} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{f.title}</div>
                    <div className="mt-0.5 text-[13px] leading-snug" style={{ color: "var(--muted-foreground)" }}>
                      {f.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stat chips */}
          <div className="flex gap-2.5 flex-wrap">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border px-4 py-2.5 text-center"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  borderColor: "var(--border)",
                }}
              >
                <div className="text-lg font-extrabold">{s.value}</div>
                <div className="text-[11px]" style={{ color: "var(--faint)" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────── */}
      <div
        className="flex w-full flex-col justify-center overflow-y-auto px-6 py-10 sm:px-10 lg:w-[520px] lg:min-w-[480px]"
        style={{
          background: "var(--card)",
          borderLeft: "1px solid var(--border-light)",
        }}
      >
        {/* Mobile logo */}
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ background: "var(--purple)" }}
          >
            A
          </div>
          <span className="text-[15px] font-bold">AIWOS</span>
        </div>

        <div className="w-full max-w-sm mx-auto lg:max-w-none">
          <Suspense fallback={null}>
            <AuthPanel />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
