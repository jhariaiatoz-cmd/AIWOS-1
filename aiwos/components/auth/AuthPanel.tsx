"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  LogIn,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Check,
  Building2,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/lib/store/auth";
import { cn } from "@/lib/utils";

type Tab = "signin" | "signup" | "guest";

/* ---------- helpers ---------- */

function pwStrength(pw: string): 0 | 1 | 2 | 3 {
  if (pw.length === 0) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;
  return score as 0 | 1 | 2 | 3;
}

const PW_LABELS = ["", "Weak", "Fair", "Strong"];
const PW_COLORS = ["var(--border)", "var(--red)", "var(--amber)", "var(--green)"];

function PasswordStrength({ password }: { password: string }) {
  const level = pwStrength(password);
  if (!password) return null;
  return (
    <div className="mt-1.5">
      <div className="mb-1 flex gap-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all"
            style={{ background: i <= level ? PW_COLORS[level] : "var(--border)" }}
          />
        ))}
      </div>
      <span className="text-[11px]" style={{ color: PW_COLORS[level] }}>
        {PW_LABELS[level]}
      </span>
    </div>
  );
}

function TabBar({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "signin", label: "Sign In" },
    { id: "signup", label: "Sign Up" },
    { id: "guest", label: "Continue as Guest" },
  ];
  return (
    <div
      className="mb-7 flex rounded-lg p-0.5"
      style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "flex-1 rounded-md px-2 py-2 text-xs font-medium transition-all",
            active === t.id
              ? "text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          style={
            active === t.id
              ? { background: "var(--elevated)", color: "var(--foreground)" }
              : {}
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}


function ErrorAlert({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      className="mb-4 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm"
      style={{
        background: "rgba(239,68,68,0.08)",
        borderColor: "rgba(239,68,68,0.25)",
        color: "#f87171",
      }}
    >
      <AlertCircle size={15} className="shrink-0" />
      {message}
    </div>
  );
}

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <Label
        className="mb-1.5 block text-xs font-medium"
        style={{ color: "var(--text-secondary, #9090b0)" }}
      >
        {label}
      </Label>
      {children}
    </div>
  );
}

/* ---------- PasswordInput ---------- */
function PasswordInput({
  id,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Lock
        size={14}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
        style={{ color: "var(--faint)" }}
      />
      <Input
        id={id}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 pl-9 pr-9 text-sm"
        style={{ background: "var(--input-bg)" }}
      />
      <button
        type="button"
        className="absolute right-3 top-1/2 -translate-y-1/2"
        style={{ color: "var(--faint)" }}
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

/* ================================================================
   SIGN IN
================================================================ */
function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const { signIn, isLoading } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [remember, setRemember] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    try {
      await signIn(email, password);
      onSuccess();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 401 || status === 422) {
          setError("Incorrect email or password. Please try again.");
        } else if (status !== undefined && status >= 500) {
          setError("Server error. Please try again in a moment.");
        } else if (!err.response) {
          setError("Cannot reach the server. Check your connection and try again.");
        } else {
          setError("Sign-in failed. Please try again.");
        }
      } else {
        setError("Sign-in failed. Please try again.");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Welcome back</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary, #9090b0)" }}>
          Sign in to your AIWOS workspace
        </p>
      </div>

      <ErrorAlert message={error} />

      <FieldGroup label="Email Address">
        <div className="relative">
          <Mail
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--faint)" }}
          />
          <Input
            type="email"
            placeholder="john@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 pl-9 text-sm"
            style={{ background: "var(--input-bg)" }}
            autoComplete="email"
          />
        </div>
      </FieldGroup>

      <FieldGroup label="Password">
        <PasswordInput
          id="signin-pw"
          placeholder="Enter your password"
          value={password}
          onChange={setPassword}
        />
      </FieldGroup>

      <div className="mb-5 flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-xs" style={{ color: "var(--text-secondary, #9090b0)" }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="accent-primary"
          />
          Remember me
        </label>
        <button
          type="button"
          className="text-xs font-medium transition-colors hover:underline"
          style={{ color: "var(--purple)" }}
        >
          Forgot password?
        </button>
      </div>

      <Button
        type="submit"
        disabled={isLoading}
        className="h-10 w-full gap-2 text-sm font-semibold"
        style={{ background: "var(--purple)" }}
      >
        {isLoading ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Signing in…
          </>
        ) : (
          <>
            <LogIn size={15} />
            Sign In
          </>
        )}
      </Button>

      <div
        className="mt-5 flex items-center justify-center gap-1.5 text-xs"
        style={{ color: "var(--faint)" }}
      >
        <ShieldCheck size={13} />
        Protected by enterprise-grade encryption
      </div>
    </form>
  );
}

/* ================================================================
   SIGN UP — 3-step
================================================================ */
type SignUpData = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  orgName: string;
  orgType: string;
  plan: string;
};

const ORG_TYPES = [
  { id: "enterprise", icon: "🏢", label: "Enterprise" },
  { id: "agency", icon: "💻", label: "Dev Agency" },
  { id: "consulting", icon: "📊", label: "Consulting" },
  { id: "startup", icon: "🚀", label: "Startup" },
];

const PLANS = [
  { id: "starter", name: "Starter", price: "$49", sub: "/mo", note: "10 agents" },
  { id: "pro", name: "Pro", price: "$199", sub: "/mo", note: "50 agents", featured: true },
  { id: "enterprise", name: "Enterprise", price: "Custom", sub: "", note: "Unlimited" },
];

const SETUP_STEPS = [
  "Creating your organization",
  "Setting up 6 departments",
  "Deploying 24 agent templates",
  "Configuring knowledge base",
  "Initializing LangGraph engine",
  "Workspace ready!",
];

function StepDots({ current }: { current: number }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-1.5">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-2 rounded-full transition-all"
          style={{
            width: i === current ? 20 : 8,
            background:
              i < current
                ? "var(--green)"
                : i === current
                  ? "var(--purple)"
                  : "var(--border)",
          }}
        />
      ))}
    </div>
  );
}

function SignUpForm({
  onSuccess,
  onSwitchToSignIn,
}: {
  onSuccess: () => void;
  onSwitchToSignIn: () => void;
}) {
  const { signUp, isLoading } = useAuthStore();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<SignUpData>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    orgName: "",
    orgType: "enterprise",
    plan: "pro",
  });
  const [error, setError] = useState("");
  const [terms, setTerms] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [setupIndex, setSetupIndex] = useState(-1);

  const update = (key: keyof SignUpData, val: string) =>
    setData((d) => ({ ...d, [key]: val }));

  const next1 = () => {
    setError("");
    if (!data.firstName || !data.email || !data.password) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!data.email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (data.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!terms) {
      setError("Please accept the Terms of Service.");
      return;
    }
    setStep(2);
  };

  const next2 = () => {
    setError("");
    if (!data.orgName) {
      setError("Please enter your organization name.");
      return;
    }
    setStep(3);
  };

  const finish = async () => {
    setShowSuccess(true);
    let i = 0;
    const tick = () => {
      setSetupIndex(i);
      i++;
      if (i <= SETUP_STEPS.length) setTimeout(tick, 600);
      else {
        setTimeout(async () => {
          try {
            await signUp(
              data.firstName,
              data.lastName,
              data.email,
              data.password,
              data.orgName
            );
            onSuccess();
          } catch (err) {
            setShowSuccess(false);
            if (
              err instanceof Error &&
              (err as Error & { redirectToSignIn?: boolean }).redirectToSignIn
            ) {
              onSwitchToSignIn();
            } else {
              setStep(1);
              setError("Registration failed. The email may already be in use.");
            }
          }
        }, 400);
      }
    };
    tick();
  };

  if (showSuccess) {
    return (
      <div className="text-center">
        <div
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: "rgba(16,185,129,0.12)" }}
        >
          <Check size={28} style={{ color: "var(--green)" }} />
        </div>
        <h2 className="mb-2 text-xl font-bold">You&apos;re all set!</h2>
        <p className="mb-6 text-sm" style={{ color: "var(--text-secondary, #9090b0)" }}>
          Your AI workforce is being initialized.
        </p>
        <div
          className="rounded-xl border p-4 text-left"
          style={{ background: "var(--input-bg)", borderColor: "var(--border)" }}
        >
          <div className="mb-3 text-xs font-semibold">Setting up your workspace</div>
          {SETUP_STEPS.map((s, idx) => (
            <div key={s} className="mb-2 flex items-center gap-2 text-xs">
              {idx < setupIndex ? (
                <Check size={13} style={{ color: "var(--green)", flexShrink: 0 }} />
              ) : idx === setupIndex ? (
                <Loader2 size={13} className="animate-spin shrink-0" style={{ color: "var(--purple)" }} />
              ) : (
                <div className="h-3 w-3 shrink-0 rounded-full" style={{ background: "var(--border)" }} />
              )}
              <span style={{ color: idx < setupIndex ? "var(--foreground)" : "var(--faint)" }}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <StepDots current={step} />

      {step === 1 && (
        <>
          <div className="mb-5">
            <h2 className="text-2xl font-bold">Create your account</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary, #9090b0)" }}>
              Start your 14-day free trial — no credit card required.
            </p>
          </div>

          <ErrorAlert message={error} />

          <div className="mb-4 grid grid-cols-2 gap-3">
            <FieldGroup label="First Name">
              <Input
                placeholder="John"
                value={data.firstName}
                onChange={(e) => update("firstName", e.target.value)}
                className="h-10 text-sm"
                style={{ background: "var(--input-bg)" }}
              />
            </FieldGroup>
            <FieldGroup label="Last Name">
              <Input
                placeholder="Doe"
                value={data.lastName}
                onChange={(e) => update("lastName", e.target.value)}
                className="h-10 text-sm"
                style={{ background: "var(--input-bg)" }}
              />
            </FieldGroup>
          </div>

          <FieldGroup label="Work Email">
            <div className="relative">
              <Mail size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--faint)" }} />
              <Input
                type="email"
                placeholder="john@company.com"
                value={data.email}
                onChange={(e) => update("email", e.target.value)}
                className="h-10 pl-9 text-sm"
                style={{ background: "var(--input-bg)" }}
              />
            </div>
          </FieldGroup>

          <FieldGroup label="Password">
            <PasswordInput
              id="signup-pw"
              placeholder="Min. 8 characters"
              value={data.password}
              onChange={(v) => update("password", v)}
            />
            <PasswordStrength password={data.password} />
          </FieldGroup>

          <label className="mb-5 flex cursor-pointer items-start gap-2 text-xs" style={{ color: "var(--text-secondary, #9090b0)" }}>
            <input
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            <span>
              I agree to the{" "}
              <span className="cursor-pointer hover:underline" style={{ color: "var(--purple)" }}>
                Terms of Service
              </span>{" "}
              and{" "}
              <span className="cursor-pointer hover:underline" style={{ color: "var(--purple)" }}>
                Privacy Policy
              </span>
            </span>
          </label>

          <Button
            type="button"
            onClick={next1}
            className="h-10 w-full gap-2 text-sm font-semibold"
            style={{ background: "var(--purple)" }}
          >
            Continue <ArrowRight size={15} />
          </Button>
        </>
      )}

      {step === 2 && (
        <>
          <button
            type="button"
            onClick={() => { setError(""); setStep(1); }}
            className="mb-4 flex items-center gap-1.5 text-xs transition-colors hover:text-foreground"
            style={{ color: "var(--text-secondary, #9090b0)" }}
          >
            <ArrowLeft size={13} /> Back
          </button>

          <div className="mb-5">
            <h2 className="text-2xl font-bold">Set up your organization</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary, #9090b0)" }}>
              Tell us about your company.
            </p>
          </div>

          <ErrorAlert message={error} />

          <FieldGroup label="Organization Name">
            <div className="relative">
              <Building2 size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--faint)" }} />
              <Input
                placeholder="Acme Corporation"
                value={data.orgName}
                onChange={(e) => update("orgName", e.target.value)}
                className="h-10 pl-9 text-sm"
                style={{ background: "var(--input-bg)" }}
              />
            </div>
          </FieldGroup>

          <div className="mb-5">
            <Label className="mb-2 block text-xs font-medium" style={{ color: "var(--text-secondary, #9090b0)" }}>
              Organization Type
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {ORG_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => update("orgType", t.id)}
                  className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all hover:border-purple-500/40"
                  style={{
                    background: data.orgType === t.id ? "var(--accent-glow)" : "var(--input-bg)",
                    borderColor: data.orgType === t.id ? "var(--purple)" : "var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  <span>{t.icon}</span> {t.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            type="button"
            onClick={next2}
            className="h-10 w-full gap-2 text-sm font-semibold"
            style={{ background: "var(--purple)" }}
          >
            Continue <ArrowRight size={15} />
          </Button>
        </>
      )}

      {step === 3 && (
        <>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="mb-4 flex items-center gap-1.5 text-xs transition-colors hover:text-foreground"
            style={{ color: "var(--text-secondary, #9090b0)" }}
          >
            <ArrowLeft size={13} /> Back
          </button>

          <div className="mb-5">
            <h2 className="text-2xl font-bold">Choose your plan</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary, #9090b0)" }}>
              All plans include a 14-day free trial.
            </p>
          </div>

          <div className="mb-4 flex gap-2">
            {PLANS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => update("plan", p.id)}
                className="flex flex-1 flex-col items-center rounded-xl border px-3 py-4 transition-all hover:border-purple-500/40"
                style={{
                  background: data.plan === p.id ? "var(--accent-glow)" : "var(--input-bg)",
                  borderColor: data.plan === p.id ? "var(--purple)" : "var(--border)",
                }}
              >
                <span
                  className="text-xs font-semibold"
                  style={{ color: data.plan === p.id ? "var(--purple)" : "var(--foreground)" }}
                >
                  {p.name}
                </span>
                <span
                  className="mt-1 text-xl font-bold"
                  style={{ color: data.plan === p.id ? "var(--purple)" : "var(--foreground)" }}
                >
                  {p.price}
                  <span className="text-[11px] font-normal" style={{ color: "var(--faint)" }}>
                    {p.sub}
                  </span>
                </span>
                <span className="mt-0.5 text-[11px]" style={{ color: "var(--faint)" }}>
                  {p.note}
                </span>
              </button>
            ))}
          </div>

          <div
            className="mb-5 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs"
            style={{
              background: "rgba(124,58,237,0.06)",
              borderColor: "rgba(124,58,237,0.2)",
              color: "var(--text-secondary, #9090b0)",
            }}
          >
            <span className="shrink-0 text-base">✨</span>
            <span>
              <strong style={{ color: "var(--foreground)" }}>14-day free trial</strong> — No credit card
              required. Full access to all Pro features. Cancel anytime.
            </span>
          </div>

          <Button
            type="button"
            onClick={finish}
            disabled={isLoading}
            className="h-10 w-full gap-2 text-sm font-semibold"
            style={{ background: "var(--purple)" }}
          >
            {isLoading ? (
              <><Loader2 size={15} className="animate-spin" /> Creating workspace…</>
            ) : (
              <>🚀 Start Free Trial</>
            )}
          </Button>

          <p className="mt-3 text-center text-[11px]" style={{ color: "var(--faint)" }}>
            <ShieldCheck size={11} className="mr-1 inline" />
            No credit card required · Cancel anytime
          </p>
        </>
      )}
    </div>
  );
}

/* ================================================================
   CONTINUE AS GUEST
================================================================ */
function GuestPanel({ onSuccess }: { onSuccess: () => void }) {
  const { continueAsGuest } = useAuthStore();

  const handleGuest = () => {
    continueAsGuest();
    onSuccess();
  };

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: "var(--accent-glow)", border: "1px solid rgba(124,58,237,0.25)" }}
      >
        <UserCheck size={28} style={{ color: "var(--purple)" }} />
      </div>
      <h2 className="mb-2 text-2xl font-bold">Try AIWOS instantly</h2>
      <p className="mb-2 text-sm" style={{ color: "var(--text-secondary, #9090b0)" }}>
        Explore the full dashboard with demo data — no account needed.
      </p>
      <p className="mb-8 text-xs" style={{ color: "var(--faint)" }}>
        Your session won&apos;t be saved after you close the tab.
      </p>

      <div
        className="mb-8 w-full rounded-xl border p-4 text-left"
        style={{ background: "var(--input-bg)", borderColor: "var(--border)" }}
      >
        {[
          "Full dashboard access",
          "All 10 screens unlocked",
          "128+ demo agents pre-loaded",
          "Sample workflows & analytics",
        ].map((item) => (
          <div key={item} className="mb-2 flex items-center gap-2 text-xs last:mb-0">
            <Check size={13} style={{ color: "var(--green)", flexShrink: 0 }} />
            <span>{item}</span>
          </div>
        ))}
      </div>

      <Button
        type="button"
        onClick={handleGuest}
        className="h-10 w-full gap-2 text-sm font-semibold"
        style={{ background: "var(--purple)" }}
      >
        Continue as Guest <ArrowRight size={15} />
      </Button>

      <p className="mt-4 text-xs" style={{ color: "var(--faint)" }}>
        Want to save your work?{" "}
        <span
          className="cursor-pointer hover:underline"
          style={{ color: "var(--purple)" }}
          onClick={() => {
            /* parent will handle tab switch via TabBar */
          }}
        >
          Create a free account
        </span>
      </p>
    </div>
  );
}

/* ================================================================
   MAIN EXPORT
================================================================ */
export function AuthPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);

  const initialTab = (searchParams.get("tab") as Tab) ?? "signin";
  const [tab, setTab] = useState<Tab>(
    ["signin", "signup", "guest"].includes(initialTab) ? initialTab : "signin",
  );

  useEffect(() => {
    if (user) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  const onSuccess = () => {
    router.replace("/dashboard");
  };

  return (
    <div>
      <TabBar active={tab} onChange={setTab} />
      {tab === "signin" && <SignInForm onSuccess={onSuccess} />}
      {tab === "signup" && (
        <SignUpForm onSuccess={onSuccess} onSwitchToSignIn={() => setTab("signin")} />
      )}
      {tab === "guest" && <GuestPanel onSuccess={onSuccess} />}
    </div>
  );
}
