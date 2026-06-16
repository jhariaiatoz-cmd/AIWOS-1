import Link from "next/link";
import {
  Bot,
  GitBranch,
  BookOpen,
  BarChart2,
  MessageCircle,
  Code2,
  ArrowRight,
  Zap,
  Shield,
  Globe,
  Share2,
  GitMerge,
  Link2,
} from "lucide-react";

/* ── FEATURES ─────────────────────────────────────── */
const FEATURES = [
  {
    icon: Bot,
    color: { bg: "rgba(124,58,237,0.12)", text: "#a78bfa" },
    title: "Agent Management",
    desc: "Create, configure, and deploy AI employees with custom roles, capabilities, and memory.",
  },
  {
    icon: GitBranch,
    color: { bg: "rgba(6,182,212,0.12)", text: "#38bdf8" },
    title: "Workflow Orchestration",
    desc: "Build multi-agent workflows with LangGraph. Automate complex business processes with conditional logic.",
  },
  {
    icon: BookOpen,
    color: { bg: "rgba(16,185,129,0.12)", text: "#34d399" },
    title: "RAG Knowledge Base",
    desc: "Upload PDFs, DOCX, and TXT files. Agents search your knowledge base using semantic search.",
  },
  {
    icon: BarChart2,
    color: { bg: "rgba(245,158,11,0.12)", text: "#fbbf24" },
    title: "Analytics & Cost Tracking",
    desc: "Monitor agent performance, token usage, task completion rates, and operational costs.",
  },
  {
    icon: MessageCircle,
    color: { bg: "rgba(236,72,153,0.12)", text: "#f472b6" },
    title: "Communications Hub",
    desc: "Chat with any agent directly, monitor agent-to-agent communications, and set up notifications.",
  },
  {
    icon: Code2,
    color: { bg: "rgba(239,68,68,0.12)", text: "#f87171" },
    title: "Software Generation",
    desc: "Describe your application — development agents collaborate to produce requirements, designs, and code.",
  },
];

const DEPARTMENTS = [
  {
    icon: Code2,
    color: { bg: "rgba(124,58,237,0.12)", text: "#a78bfa" },
    name: "Development",
    manager: "Dev Manager Agent",
    agents: ["Business Analyst", "Backend Agent", "Frontend Agent", "QA Agent"],
  },
  {
    icon: BarChart2,
    color: { bg: "rgba(6,182,212,0.12)", text: "#38bdf8" },
    name: "Finance",
    manager: "Finance Manager Agent",
    agents: ["Budget Analyst", "Invoice Agent", "Forecasting Agent"],
  },
  {
    icon: Globe,
    color: { bg: "rgba(16,185,129,0.12)", text: "#34d399" },
    name: "Research",
    manager: "Research Manager Agent",
    agents: ["Market Analyst", "Data Scientist", "Report Agent"],
  },
  {
    icon: Shield,
    color: { bg: "rgba(245,158,11,0.12)", text: "#fbbf24" },
    name: "Operations",
    manager: "Ops Manager Agent",
    agents: ["Process Agent", "Support Agent", "Monitoring Agent"],
  },
  {
    icon: MessageCircle,
    color: { bg: "rgba(236,72,153,0.12)", text: "#f472b6" },
    name: "HR",
    manager: "HR Manager Agent",
    agents: ["Recruiter Agent", "Onboarding Agent", "Policy Agent"],
  },
  {
    icon: Zap,
    color: { bg: "rgba(239,68,68,0.12)", text: "#f87171" },
    name: "DevOps",
    manager: "DevOps Manager Agent",
    agents: ["CI/CD Agent", "Infra Agent", "Security Agent"],
  },
];

const TESTIMONIALS = [
  {
    quote:
      "AIWOS reduced our software delivery time by 60%. The dev agents handle everything from PRD to production.",
    name: "Sarah M.",
    role: "CTO, TechCorp",
    initials: "SM",
    color: "rgba(124,58,237,0.4)",
  },
  {
    quote:
      "We replaced 3 SaaS tools with AIWOS. The analytics and workflow features are genuinely best-in-class.",
    name: "James D.",
    role: "VP Engineering, Scale Inc",
    initials: "JD",
    color: "rgba(6,182,212,0.4)",
  },
  {
    quote:
      "Deploying AI across our finance and HR teams was seamless. The onboarding took under a day.",
    name: "Anita L.",
    role: "COO, Ventures Ltd",
    initials: "AL",
    color: "rgba(16,185,129,0.4)",
  },
];

const STATS = [
  { value: "128+", label: "AI Agent Templates" },
  { value: "6", label: "Built-in Departments" },
  { value: "99.9%", label: "Uptime SLA" },
  { value: "$0.25", label: "Avg. Cost per Task" },
];

const FOOTER_LINKS = {
  Product: ["Features", "Pricing", "Changelog", "Roadmap"],
  Company: ["About", "Blog", "Careers", "Press"],
  Resources: ["Docs", "API Reference", "Community", "Status"],
  Legal: ["Privacy", "Terms", "Security", "Cookies"],
};

export default function LandingPage() {
  return (
    <div className="h-full overflow-y-auto">
      {/* ── NAVIGATION ─────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 flex h-16 items-center gap-5 px-6 sm:px-10"
        style={{
          background: "rgba(10,10,15,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border-light)",
        }}
      >
        {/* Logo */}
        <Link href="/" className="mr-5 flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-extrabold text-white"
            style={{ background: "var(--purple)" }}
          >
            A
          </div>
          <span className="text-[17px] font-bold">AIWOS</span>
        </Link>

        {/* Nav links */}
        <div className="hidden flex-1 items-center gap-1 md:flex">
          {["Platform", "Solutions", "Resources"].map((l) => (
            <button
              key={l}
              className="rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-white/4 hover:text-foreground"
              style={{ color: "var(--muted-foreground)" }}
            >
              {l} ▾
            </button>
          ))}
          <a
            href="#pricing"
            className="rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-white/4 hover:text-foreground"
            style={{ color: "var(--muted-foreground)" }}
          >
            Pricing
          </a>
        </div>

        {/* CTAs */}
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/auth"
            className="rounded-lg border px-4 py-1.5 text-sm font-medium transition-all hover:border-white/20 hover:text-foreground"
            style={{
              borderColor: "var(--border)",
              color: "var(--muted-foreground)",
            }}
          >
            Sign In
          </Link>
          <Link
            href="/auth?tab=signup"
            className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-all hover:-translate-y-px"
            style={{ background: "var(--purple)" }}
          >
            Get Started <ArrowRight size={13} />
          </Link>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────── */}
      <section className="relative flex min-h-[calc(100vh-64px)] flex-col items-center justify-center overflow-hidden px-6 pb-24 pt-28 text-center">
        {/* Glows */}
        <div
          className="pointer-events-none absolute"
          style={{
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle,rgba(124,58,237,0.12) 0%,transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
          }}
        />
        <div
          className="pointer-events-none absolute right-[15%] top-[30%]"
          style={{
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle,rgba(6,182,212,0.06) 0%,transparent 70%)",
          }}
        />

        <div className="relative z-10 max-w-4xl">
          {/* Eyebrow */}
          <div
            className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm"
            style={{
              background: "rgba(124,58,237,0.1)",
              borderColor: "rgba(124,58,237,0.25)",
              color: "#a78bfa",
            }}
          >
            ✨ The Future of Work is Autonomous
          </div>

          {/* Headline */}
          <h1 className="mb-6 text-5xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl">
            Your AI Workforce.
            <br />
            <span
              style={{
                background: "linear-gradient(135deg,#a78bfa,#38bdf8,#34d399)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Managed. Orchestrated. Empowered.
            </span>
          </h1>

          {/* Subtitle */}
          <p
            className="mx-auto mb-10 max-w-xl text-lg leading-relaxed"
            style={{ color: "var(--muted-foreground)" }}
          >
            AIWOS helps you build, manage, and scale a team of AI agents that work together to
            achieve your business goals — across every department.
          </p>

          {/* CTAs */}
          <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth"
              className="flex items-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold text-white transition-all hover:-translate-y-px"
              style={{ background: "var(--purple)" }}
            >
              🚀 Book a Demo
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-xl border px-7 py-3.5 text-base font-medium transition-all hover:border-white/20 hover:text-foreground"
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
            >
              ▶ Watch Video
            </Link>
          </div>

          {/* Social proof */}
          <div
            className="flex items-center justify-center gap-4 text-sm"
            style={{ color: "var(--faint)" }}
          >
            <div className="flex">
              {["JD", "SM", "MK", "AL"].map((i, idx) => (
                <div
                  key={i}
                  className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full border-2 text-[11px] font-semibold text-white first:ml-0"
                  style={{
                    borderColor: "var(--background)",
                    background: [
                      "rgba(124,58,237,0.5)",
                      "rgba(6,182,212,0.5)",
                      "rgba(16,185,129,0.5)",
                      "rgba(245,158,11,0.5)",
                    ][idx],
                  }}
                >
                  {i}
                </div>
              ))}
            </div>
            <span>
              Trusted by <strong style={{ color: "var(--foreground)" }}>2,400+</strong> enterprises worldwide
            </span>
          </div>

          {/* Browser preview mockup */}
          <div
            className="mx-auto mt-16 max-w-3xl overflow-hidden rounded-2xl"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-light)",
              boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
            }}
          >
            <div
              className="flex h-10 items-center gap-2 px-4"
              style={{ background: "var(--card)", borderBottom: "1px solid var(--border-light)" }}
            >
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--red)" }} />
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--amber)" }} />
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--green)" }} />
              <div
                className="ml-3 flex h-5 flex-1 max-w-48 items-center rounded-md px-2.5 text-[11px]"
                style={{ background: "var(--border-light)", color: "var(--faint)" }}
              >
                app.aiwos.io/dashboard
              </div>
            </div>
            <div
              className="flex h-64 flex-col items-center justify-center gap-3"
              style={{ color: "var(--faint)" }}
            >
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-px"
                style={{ background: "var(--purple)" }}
              >
                Open Live Dashboard Preview
              </Link>
              <span className="text-xs">Full interactive demo · all 10 screens included</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAND ────────────────────────────────── */}
      <div
        className="grid grid-cols-2 gap-px sm:grid-cols-4"
        style={{
          background: "var(--border-light)",
          borderTop: "1px solid var(--border-light)",
          borderBottom: "1px solid var(--border-light)",
        }}
      >
        {STATS.map((s) => (
          <div
            key={s.label}
            className="flex flex-col items-center justify-center py-8 text-center"
            style={{ background: "var(--surface)" }}
          >
            <div
              className="text-3xl font-extrabold"
              style={{
                background: "linear-gradient(135deg,#a78bfa,#38bdf8)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {s.value}
            </div>
            <div className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── FEATURES ──────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-24 sm:px-10">
        <div className="mb-14 text-center">
          <div
            className="mb-3 text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--purple)" }}
          >
            Platform Features
          </div>
          <h2 className="mb-4 text-4xl font-extrabold leading-tight">
            Everything you need to run
            <br />
            an AI-powered organization
          </h2>
          <p className="mx-auto max-w-lg text-base" style={{ color: "var(--muted-foreground)" }}>
            From creating individual agents to orchestrating entire departments — AIWOS handles
            the full lifecycle.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group rounded-2xl border p-7 transition-all hover:-translate-y-1"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border-light)",
                }}
              >
                <div
                  className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ background: f.color.bg }}
                >
                  <Icon size={22} style={{ color: f.color.text }} />
                </div>
                <div className="mb-2 text-base font-semibold">{f.title}</div>
                <div className="text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                  {f.desc}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── DEPARTMENTS ───────────────────────────────── */}
      <div style={{ background: "var(--surface)" }}>
        <section className="mx-auto max-w-6xl px-6 py-24 sm:px-10">
          <div
            className="mb-3 text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--purple)" }}
          >
            Workforce Structure
          </div>
          <h2 className="mb-3 text-4xl font-extrabold leading-tight">
            Six departments.
            <br />
            Infinite capability.
          </h2>
          <p className="mb-12 max-w-lg text-base" style={{ color: "var(--muted-foreground)" }}>
            Each department comes pre-loaded with a Manager agent and specialized Employee agents,
            ready to execute from day one.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DEPARTMENTS.map((d) => {
              const Icon = d.icon;
              return (
                <div
                  key={d.name}
                  className="rounded-2xl border p-5 transition-all hover:-translate-y-1"
                  style={{ background: "var(--card)", borderColor: "var(--border-light)" }}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: d.color.bg }}
                    >
                      <Icon size={18} style={{ color: d.color.text }} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{d.name}</div>
                      <div className="text-[11px]" style={{ color: "var(--faint)" }}>
                        Manager: {d.manager}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {d.agents.map((a) => (
                      <span
                        key={a}
                        className="flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px]"
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          borderColor: "var(--border-light)",
                          color: "var(--muted-foreground)",
                        }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: "var(--green)" }}
                        />
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ── TESTIMONIALS ──────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-24 sm:px-10">
        <div className="mb-12 text-center">
          <div
            className="mb-3 text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--purple)" }}
          >
            Social Proof
          </div>
          <h2 className="text-4xl font-extrabold">Loved by engineering teams</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="rounded-2xl border p-6"
              style={{ background: "var(--card)", borderColor: "var(--border-light)" }}
            >
              <p
                className="mb-5 text-sm leading-relaxed"
                style={{ color: "var(--muted-foreground)" }}
              >
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
                  style={{ background: t.color }}
                >
                  {t.initials}
                </div>
                <div>
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-[11px]" style={{ color: "var(--faint)" }}>
                    {t.role}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────── */}
      <div id="pricing" style={{ background: "var(--surface)" }}>
        <section className="mx-auto max-w-6xl px-6 py-24 sm:px-10">
          <div className="mb-14 text-center">
            <div
              className="mb-3 text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--purple)" }}
            >
              Pricing
            </div>
            <h2 className="mb-4 text-4xl font-extrabold">Simple, transparent pricing</h2>
            <p className="mx-auto max-w-md text-base" style={{ color: "var(--muted-foreground)" }}>
              Start free for 14 days. No credit card required.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              {
                name: "Starter",
                price: "$49",
                desc: "Perfect for small teams",
                features: ["10 agents", "3 departments", "5GB knowledge base", "Community support"],
              },
              {
                name: "Pro",
                price: "$199",
                desc: "Most popular for growing teams",
                features: ["50 agents", "All 6 departments", "50GB knowledge base", "Priority support", "Analytics dashboard"],
                featured: true,
              },
              {
                name: "Enterprise",
                price: "Custom",
                desc: "For large organizations",
                features: ["Unlimited agents", "Custom departments", "Unlimited storage", "Dedicated support", "SSO & audit logs"],
              },
            ].map((p) => (
              <div
                key={p.name}
                className="relative rounded-2xl border p-8"
                style={{
                  background: p.featured ? "rgba(124,58,237,0.06)" : "var(--card)",
                  borderColor: p.featured ? "var(--purple)" : "var(--border-light)",
                }}
              >
                {p.featured && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-semibold text-white"
                    style={{ background: "var(--purple)" }}
                  >
                    Most Popular
                  </div>
                )}
                <div
                  className="mb-1 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: p.featured ? "var(--purple)" : "var(--muted-foreground)" }}
                >
                  {p.name}
                </div>
                <div className="mb-1 text-4xl font-extrabold">{p.price}<span className="text-base font-normal" style={{ color: "var(--faint)" }}>{p.price !== "Custom" && "/mo"}</span></div>
                <div className="mb-6 text-sm" style={{ color: "var(--muted-foreground)" }}>{p.desc}</div>
                <ul className="mb-8 flex flex-col gap-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <span style={{ color: "var(--green)", fontWeight: 700 }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth?tab=signup"
                  className="block w-full rounded-xl py-2.5 text-center text-sm font-semibold transition-all hover:-translate-y-px"
                  style={{
                    background: p.featured ? "var(--purple)" : "var(--input-bg)",
                    color: p.featured ? "white" : "var(--foreground)",
                    border: p.featured ? "none" : "1px solid var(--border)",
                  }}
                >
                  Start Free Trial
                </Link>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── CTA BAND ──────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center sm:px-10">
        <h2 className="mb-4 text-4xl font-extrabold">
          Ready to build your{" "}
          <span
            style={{
              background: "linear-gradient(135deg,#a78bfa,#38bdf8)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            AI workforce?
          </span>
        </h2>
        <p className="mx-auto mb-10 max-w-md text-base" style={{ color: "var(--muted-foreground)" }}>
          Join 2,400+ companies already using AIWOS to automate their operations.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/auth?tab=signup"
            className="flex items-center gap-2 rounded-xl px-8 py-4 text-base font-semibold text-white transition-all hover:-translate-y-px"
            style={{ background: "var(--purple)" }}
          >
            Get Started Free <ArrowRight size={16} />
          </Link>
          <Link
            href="/auth"
            className="rounded-xl border px-8 py-4 text-base font-medium transition-all hover:border-white/20 hover:text-foreground"
            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────── */}
      <footer style={{ background: "var(--surface)", borderTop: "1px solid var(--border-light)" }}>
        <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
          <div className="mb-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <div className="mb-4 flex items-center gap-2.5">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-extrabold text-white"
                  style={{ background: "var(--purple)" }}
                >
                  A
                </div>
                <span className="text-[17px] font-bold">AIWOS</span>
              </div>
              <p className="max-w-xs text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                The AI Workforce Operating System. Build, manage, and scale your AI team across
                every department.
              </p>
            </div>
            {Object.entries(FOOTER_LINKS).map(([section, links]) => (
              <div key={section}>
                <div className="mb-4 text-sm font-semibold">{section}</div>
                <ul className="flex flex-col gap-2.5">
                  {links.map((l) => (
                    <li key={l}>
                      <span
                        className="cursor-pointer text-sm transition-colors hover:text-foreground"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {l}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div
            className="flex flex-wrap items-center justify-between gap-4 border-t pt-6 text-sm"
            style={{ borderColor: "var(--border-light)", color: "var(--faint)" }}
          >
            <span>© 2025 AIWOS Inc. All rights reserved.</span>
            <div className="flex gap-2">
              {[
                { icon: Share2, label: "Twitter" },
                { icon: GitMerge, label: "GitHub" },
                { icon: Link2, label: "LinkedIn" },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border transition-all hover:border-white/20 hover:text-foreground"
                  style={{ borderColor: "var(--border)", color: "var(--faint)" }}
                  aria-label={label}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
