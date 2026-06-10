"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { commandSuggestions } from "@/lib/data/dashboard";

export function CommandHero() {
  const [command, setCommand] = useState("");

  return (
    <div className="mb-6 px-4 pt-8 pb-6 text-center">
      <h1 className="mb-1.5 text-2xl font-bold text-foreground">
        Good Morning, John 👋
      </h1>
      <p className="mb-7 text-sm text-muted-foreground">
        Here&apos;s what your AI workforce is doing today.
      </p>

      {/* Command input */}
      <div className="relative mx-auto mb-4 max-w-[640px]">
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setCommand("")}
          className="w-full rounded-2xl border px-4 py-3.5 pr-14 text-sm outline-none transition-all focus:shadow-[0_0_0_3px_var(--accent-glow)] focus:border-primary"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
            color: "var(--foreground)",
          }}
          placeholder="What would you like your workforce to do today?"
        />
        <button
          onClick={() => setCommand("")}
          className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-white transition-colors"
          style={{ background: "var(--purple)" }}
          aria-label="Send command"
        >
          <Send size={16} />
        </button>
      </div>

      {/* Suggestion chips */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {commandSuggestions.map((s) => (
          <button
            key={s.text}
            onClick={() => setCommand(s.text)}
            className="rounded-full border px-3.5 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary hover:text-primary"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--accent-glow)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--card)";
            }}
          >
            {s.emoji} {s.text}
          </button>
        ))}
      </div>
    </div>
  );
}
