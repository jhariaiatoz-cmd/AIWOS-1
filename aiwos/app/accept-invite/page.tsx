"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, Loader2, XCircle, Users } from "lucide-react";
import { invitationApi, type InvitationPublicApiResponse } from "@/lib/api/organizations";
import { useAuthStore } from "@/lib/store/auth";

function AcceptInviteContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  const { user, token: authToken } = useAuthStore();

  const [invitation, setInvitation] = useState<InvitationPublicApiResponse | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "invalid">("loading");
  const [loadError, setLoadError] = useState("");

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [submitState, setSubmitState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!token) {
      setLoadState("invalid");
      setLoadError("No invitation token found in the URL.");
      return;
    }
    invitationApi
      .get(token)
      .then((data) => {
        setInvitation(data);
        setLoadState("ready");
      })
      .catch((err: unknown) => {
        const detail =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          "This invitation is invalid or has expired.";
        setLoadError(detail);
        setLoadState("invalid");
      });
  }, [token]);

  const isLoggedInWithMatchingEmail =
    authToken && user && invitation && user.email === invitation.email;

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();

    if (!isLoggedInWithMatchingEmail) {
      if (password !== confirmPassword) {
        setSubmitError("Passwords do not match.");
        return;
      }
      if (password.length < 8) {
        setSubmitError("Password must be at least 8 characters.");
        return;
      }
    }

    setSubmitState("loading");
    setSubmitError("");

    try {
      const result = await invitationApi.accept(token, {
        full_name: fullName || undefined,
        password: isLoggedInWithMatchingEmail ? undefined : password,
      });

      localStorage.setItem("aiwos-token", result.access_token);

      const { signIn } = useAuthStore.getState();
      if (!isLoggedInWithMatchingEmail && invitation) {
        try {
          await signIn(invitation.email, password);
        } catch {
          // Token is already set; redirect anyway
        }
      } else {
        useAuthStore.setState({ currentOrgId: result.organization_id });
      }

      setSubmitState("success");
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Something went wrong. Please try again.";
      setSubmitError(detail);
      setSubmitState("error");
    }
  }

  if (loadState === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
        <Loader2 size={28} className="animate-spin" />
        <p className="text-sm">Validating your invitation…</p>
      </div>
    );
  }

  if (loadState === "invalid") {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <XCircle size={40} className="text-red-500" />
        <p className="text-base font-semibold text-foreground">Invitation unavailable</p>
        <p className="max-w-xs text-sm text-muted-foreground">{loadError}</p>
        <a
          href="/auth"
          className="mt-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all hover:-translate-y-px"
          style={{ background: "var(--purple)" }}
        >
          Go to sign in
        </a>
      </div>
    );
  }

  if (submitState === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <CheckCircle size={40} className="text-green-500" />
        <p className="text-base font-semibold text-foreground">You&apos;re in!</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          You have joined <strong>{invitation?.organization_name}</strong> as{" "}
          <strong>{invitation?.role}</strong>.
        </p>
        <button
          onClick={() => router.push("/")}
          className="mt-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all hover:-translate-y-px"
          style={{ background: "var(--purple)" }}
        >
          Go to dashboard
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleAccept} className="space-y-4">
      <div className="mb-5 flex items-start gap-3 rounded-xl border p-4" style={{ borderColor: "var(--border-light)", background: "var(--input-bg)" }}>
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(124,58,237,0.12)" }}>
          <Users size={16} className="text-purple-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{invitation!.organization_name}</p>
          <p className="text-xs text-muted-foreground">
            You&apos;ve been invited as <span className="font-medium">{invitation!.role}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">For: {invitation!.email}</p>
        </div>
      </div>

      {!isLoggedInWithMatchingEmail && (
        <>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Full name</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              className="h-10 w-full rounded-lg border px-3 text-sm outline-none"
              style={{ background: "var(--input-bg)", borderColor: "var(--border)", color: "var(--foreground)" }}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              className="h-10 w-full rounded-lg border px-3 text-sm outline-none"
              style={{ background: "var(--input-bg)", borderColor: "var(--border)", color: "var(--foreground)" }}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Confirm password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              required
              className="h-10 w-full rounded-lg border px-3 text-sm outline-none"
              style={{ background: "var(--input-bg)", borderColor: "var(--border)", color: "var(--foreground)" }}
            />
          </label>
        </>
      )}

      {submitError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950">
          <XCircle size={14} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-xs text-red-600 dark:text-red-400">{submitError}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={submitState === "loading"}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium text-white transition-all hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: "var(--purple)" }}
      >
        {submitState === "loading" ? (
          <Loader2 size={16} className="animate-spin" />
        ) : null}
        {isLoggedInWithMatchingEmail ? "Accept invitation" : "Create account & join"}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <a href="/auth" className="underline hover:text-foreground transition-colors">
          Sign in
        </a>
      </p>
    </form>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ background: "var(--background)" }}>
      <div
        className="w-full max-w-md rounded-2xl border p-8 shadow-lg"
        style={{ background: "var(--card)", borderColor: "var(--border-light)" }}
      >
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">Join your team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You have been invited to join an organization on AIWOS.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="flex justify-center py-10">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          }
        >
          <AcceptInviteContent />
        </Suspense>
      </div>
    </div>
  );
}
