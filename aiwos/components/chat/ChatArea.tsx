"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, MessageCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ProjectRecommendationCard } from "@/components/chat/ProjectRecommendationCard";
import type { AgentStatus, Conversation, Message } from "@/lib/data/chat";

interface ChatAreaProps {
  conversation: Conversation | null;
  messages: Message[];
  onBack?: () => void;
  onSend: (conversationId: string, content: string) => void;
  isExecuting?: boolean;
  agentWorkload?: { projects_owned: number; tasks_assigned: number };
}

function StatusLabel({ status }: { status: AgentStatus }) {
  const label =
    status === "online" ? "Online" : status === "busy" ? "Busy" : "Offline";
  const color =
    status === "online"
      ? "var(--green)"
      : status === "busy"
        ? "var(--amber)"
        : "var(--faint)";

  return (
    <span className="flex items-center gap-1 text-[11px]" style={{ color }}>
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

function EmptyConversation() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: "var(--accent-glow)" }}
      >
        <MessageCircle size={28} style={{ color: "var(--purple)" }} />
      </div>
      <p className="text-sm font-medium text-foreground">
        Select a conversation
      </p>
      <p className="text-xs text-muted-foreground">
        Choose an agent from the list to start chatting.
      </p>
    </div>
  );
}

export function ChatArea({
  conversation,
  messages,
  onBack,
  onSend,
  isExecuting = false,
  agentWorkload,
}: ChatAreaProps) {
  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on conversation change or new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Reset draft when conversation changes
  useEffect(() => {
    setDraft("");
  }, [conversation?.id]);

  function handleSend() {
    const content = draft.trim();
    if (!content || !conversation) return;
    onSend(conversation.id, content);
    setDraft("");
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!conversation) {
    return (
      <div className="flex h-full flex-col" style={{ background: "var(--card)" }}>
        <EmptyConversation />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--card)" }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--border-light)" }}
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--border)] hover:text-foreground md:hidden"
            aria-label="Back to conversations"
          >
            <ArrowLeft size={16} />
          </button>
        )}

        {/* Avatar */}
        <div className="relative shrink-0">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold text-white"
            style={{ background: conversation.agentColor }}
          >
            {conversation.agentInitials}
          </div>
          <span
            className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full border-2"
            style={{
              background:
                conversation.status === "online"
                  ? "var(--green)"
                  : conversation.status === "busy"
                    ? "var(--amber)"
                    : "var(--faint)",
              borderColor: "var(--card)",
            }}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">
            {conversation.agentName}
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-[11px]"
              style={{ color: "var(--faint)" }}
            >
              {conversation.agentRole}
            </span>
            <span style={{ color: "var(--border-light)" }}>·</span>
            <StatusLabel status={conversation.status} />
          </div>
          {agentWorkload && (agentWorkload.projects_owned > 0 || agentWorkload.tasks_assigned > 0) && (
            <div className="mt-0.5 flex items-center gap-2.5 text-[10px]" style={{ color: "var(--faint)" }}>
              {agentWorkload.projects_owned > 0 && (
                <span>{agentWorkload.projects_owned} project{agentWorkload.projects_owned !== 1 ? "s" : ""} owned</span>
              )}
              {agentWorkload.projects_owned > 0 && agentWorkload.tasks_assigned > 0 && (
                <span style={{ color: "var(--border-light)" }}>·</span>
              )}
              {agentWorkload.tasks_assigned > 0 && (
                <span>{agentWorkload.tasks_assigned} task{agentWorkload.tasks_assigned !== 1 ? "s" : ""} assigned</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-3">
          {messages.map((msg) => {
            const isUser = msg.sender === "user";
            const hasRecommendation =
              !isUser && msg.metadata?.type === "project_recommendation";

            return (
              <div key={msg.id} className="flex flex-col gap-2">
                {/* Message row */}
                <div
                  className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                >
                  {/* Agent avatar (only for agent messages) */}
                  {!isUser && (
                    <div
                      className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                      style={{ background: conversation.agentColor }}
                    >
                      {conversation.agentInitials}
                    </div>
                  )}

                  <div
                    className={`flex max-w-[75%] flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}
                  >
                    <div
                      className="rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed"
                      style={
                        isUser
                          ? {
                              background: "var(--purple)",
                              color: "#fff",
                              borderBottomRightRadius: "4px",
                            }
                          : {
                              background: "var(--elevated)",
                              color: "var(--foreground)",
                              borderBottomLeftRadius: "4px",
                            }
                      }
                    >
                      {isUser ? (
                        msg.content
                      ) : (
                        <div className="aiwos-markdown">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                    <span
                      className="px-1 text-[10px]"
                      style={{ color: "var(--faint)" }}
                    >
                      {msg.timestamp}
                    </span>
                  </div>
                </div>

                {/* Project recommendation card — aligned with bubble (past the avatar) */}
                {hasRecommendation && msg.metadata && (
                  <div className="pl-9">
                    <ProjectRecommendationCard
                      metadata={msg.metadata}
                      agentId={conversation.agentId}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {isExecuting && conversation && (
            <div className="flex items-end gap-2">
              <div
                className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                style={{ background: conversation.agentColor }}
              >
                {conversation.agentInitials}
              </div>
              <div
                className="flex items-center gap-1 rounded-2xl px-3.5 py-3"
                style={{
                  background: "var(--elevated)",
                  borderBottomLeftRadius: "4px",
                }}
              >
                <span
                  className="h-1.5 w-1.5 animate-bounce rounded-full"
                  style={{ background: "var(--faint)", animationDelay: "0ms" }}
                />
                <span
                  className="h-1.5 w-1.5 animate-bounce rounded-full"
                  style={{ background: "var(--faint)", animationDelay: "150ms" }}
                />
                <span
                  className="h-1.5 w-1.5 animate-bounce rounded-full"
                  style={{ background: "var(--faint)", animationDelay: "300ms" }}
                />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer */}
      <div
        className="shrink-0 px-4 py-3"
        style={{ borderTop: "1px solid var(--border-light)" }}
      >
        <div
          className="flex items-end gap-2 rounded-xl border px-3 py-2 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25"
          style={{
            background: "var(--input-bg)",
            borderColor: "var(--border)",
          }}
        >
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isExecuting
                ? "Agent is thinking…"
                : "Type a message… (Enter to send, Shift+Enter for newline)"
            }
            rows={1}
            disabled={isExecuting}
            className="max-h-32 flex-1 resize-none bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
            style={{ lineHeight: "1.5" }}
            aria-label="Message input"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim() || isExecuting}
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition-all hover:-translate-y-px disabled:opacity-30 disabled:hover:translate-y-0"
            style={{ background: "var(--purple)" }}
            aria-label="Send message"
          >
            <Send size={14} />
          </button>
        </div>
        {isExecuting && (
          <p className="mt-1.5 text-center text-[10px]" style={{ color: "var(--faint)" }}>
            Agent is processing your request…
          </p>
        )}
      </div>
    </div>
  );
}
