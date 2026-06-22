"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { agentApi, type AgentApiResponse } from "@/lib/api/agents";
import { useAuthStore } from "@/lib/store/auth";

const PROVIDERS = [
  { value: "", label: "No preference (fallback)" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI (GPT)" },
  { value: "google", label: "Google (Gemini)" },
];

const MODELS_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
  anthropic: [
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (recommended)" },
    { value: "claude-opus-4-8", label: "Claude Opus 4.8 (powerful)" },
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (fast)" },
  ],
  openai: [
    { value: "gpt-4o", label: "GPT-4o (recommended)" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini (fast)" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  ],
  google: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (recommended)" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (powerful)" },
  ],
};

function apiError(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const detail = (err as { response?: { data?: { detail?: string } } })
      .response?.data?.detail;
    if (detail) return String(detail);
  }
  return "Something went wrong. Please try again.";
}

interface Props {
  agent: AgentApiResponse | null;
  onClose: () => void;
}

export function EditAgentDialog({ agent, onClose }: Props) {
  const { currentOrgId } = useAuthStore();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [goal, setGoal] = useState("");
  const [instructions, setInstructions] = useState("");
  const [skillsInput, setSkillsInput] = useState("");
  const [skillTags, setSkillTags] = useState<string[]>([]);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [agentStatus, setAgentStatus] = useState("Active");
  const [isManager, setIsManager] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    role?: string;
    goal?: string;
    instructions?: string;
  }>({});
  const [apiErr, setApiErr] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setRole(agent.role);
      setGoal(agent.goal);
      setInstructions(agent.instructions);
      setSkillTags(agent.skills ?? []);
      setSkillsInput("");
      setProvider(agent.provider ?? "");
      setModel(agent.model ?? "");
      setAgentStatus(agent.status);
      setIsManager(agent.is_manager);
      setErrors({});
      setApiErr("");
      setSuccess(false);
    }
  }, [agent]);

  function addSkill(raw: string) {
    const tags = raw
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !skillTags.includes(s));
    if (tags.length) {
      setSkillTags((prev) => [...prev, ...tags]);
      setSkillsInput("");
    }
  }

  function removeSkill(skill: string) {
    setSkillTags((prev) => prev.filter((s) => s !== skill));
  }

  function handleSkillKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkill(skillsInput);
    }
  }

  function handleProviderChange(p: string) {
    setProvider(p);
    setModel("");
  }

  const availableModels = MODELS_BY_PROVIDER[provider] ?? [];

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      agentApi.update(agent!.id, {
        name: name.trim(),
        role: role.trim(),
        goal: goal.trim(),
        instructions: instructions.trim(),
        skills: skillTags,
        provider: provider || null,
        model: model || null,
        status: agentStatus,
        is_manager: isManager,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", currentOrgId] });
      setSuccess(true);
      setTimeout(handleClose, 900);
    },
    onError: (err) => setApiErr(apiError(err)),
  });

  const handleClose = () => {
    if (isPending) return;
    setErrors({});
    setApiErr("");
    setSuccess(false);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setApiErr("");
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = "Name is required.";
    if (!role.trim()) errs.role = "Role is required.";
    if (!goal.trim()) errs.goal = "Goal is required.";
    if (!instructions.trim()) errs.instructions = "Instructions are required.";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    mutate();
  };

  const field = "h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors";
  const fieldStyle = (err?: string) => ({
    background: "var(--input-bg)",
    borderColor: err ? "var(--red)" : "var(--border)",
    color: "var(--foreground)",
  });
  const selectStyle = {
    background: "var(--input-bg)",
    borderColor: "var(--border)",
    color: "var(--foreground)",
  };

  return (
    <Dialog open={!!agent} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Agent</DialogTitle>
          <DialogDescription>
            Update the agent&apos;s identity, skills, and LLM configuration.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center py-8 gap-2">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: "rgba(16,185,129,0.12)" }}
            >
              <Check size={22} style={{ color: "var(--green)" }} />
            </div>
            <p className="text-sm font-medium text-foreground">Agent updated!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            {apiErr && (
              <p className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(239,68,68,0.08)", color: "var(--red)" }}>
                {apiErr}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Name <span style={{ color: "var(--red)" }}>*</span>
                </label>
                <input
                  className={field}
                  style={fieldStyle(errors.name)}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {errors.name && <p className="text-xs" style={{ color: "var(--red)" }}>{errors.name}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Role <span style={{ color: "var(--red)" }}>*</span>
                </label>
                <input
                  className={field}
                  style={fieldStyle(errors.role)}
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
                {errors.role && <p className="text-xs" style={{ color: "var(--red)" }}>{errors.role}</p>}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Purpose / Goal <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <textarea
                rows={2}
                className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
                style={fieldStyle(errors.goal)}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
              {errors.goal && <p className="text-xs" style={{ color: "var(--red)" }}>{errors.goal}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Instructions <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <textarea
                rows={3}
                className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
                style={fieldStyle(errors.instructions)}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
              {errors.instructions && <p className="text-xs" style={{ color: "var(--red)" }}>{errors.instructions}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Skills & Expertise
                <span className="ml-1 font-normal text-muted-foreground/60">(press Enter or comma to add)</span>
              </label>
              <input
                className={field}
                style={fieldStyle()}
                placeholder="React, Next.js, FastAPI…"
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
                onKeyDown={handleSkillKeyDown}
                onBlur={() => skillsInput.trim() && addSkill(skillsInput)}
              />
              {skillTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {skillTags.map((skill) => (
                    <span
                      key={skill}
                      className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      style={{ background: "var(--accent-glow)", color: "var(--purple)" }}
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        className="opacity-60 hover:opacity-100"
                        aria-label={`Remove ${skill}`}
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">LLM Provider</label>
                <select
                  className={field}
                  style={selectStyle}
                  value={provider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Model</label>
                {availableModels.length > 0 ? (
                  <select
                    className={field}
                    style={selectStyle}
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  >
                    <option value="">Select model…</option>
                    {availableModels.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={field}
                    style={fieldStyle()}
                    placeholder="e.g. gemini-2.5-flash"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <select
                  className={field}
                  style={selectStyle}
                  value={agentStatus}
                  onChange={(e) => setAgentStatus(e.target.value)}
                >
                  <option value="Active">Active</option>
                  <option value="Created">Created (not yet active)</option>
                  <option value="Paused">Paused</option>
                  <option value="Retired">Retired</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5 justify-end pb-1">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
                  <input
                    type="checkbox"
                    checked={isManager}
                    onChange={(e) => setIsManager(e.target.checked)}
                    className="accent-[var(--purple)] h-3.5 w-3.5"
                  />
                  Manager agent
                </label>
              </div>
            </div>

            <div
              className="-mx-4 -mb-4 flex flex-row-reverse gap-2 rounded-b-xl border-t px-4 py-3"
              style={{ borderColor: "var(--border-light)", background: "var(--surface)" }}
            >
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                style={{ background: "var(--purple)" }}
              >
                {isPending && <Loader2 size={13} className="animate-spin" />}
                {isPending ? "Saving…" : "Save Changes"}
              </button>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
