"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CONVERSATIONS, MESSAGES } from "@/lib/data/chat";
import type { Message, Conversation, ProjectRecommendationMetadata, ProjectPriority, ProjectComplexity } from "@/lib/data/chat";
import { ConversationSidebar, avatarGradient, agentInitials } from "@/components/chat/ConversationSidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { useAuthStore } from "@/lib/store/auth";
import { useWorkspaceStore } from "@/lib/store/workspace";
import { agentApi, type AgentApiResponse } from "@/lib/api/agents";
import { conversationApi } from "@/lib/api/conversations";
import type { ConversationResponse } from "@/lib/api/conversations";

// An agent reply is pending whenever the last message is from the user
function isAwaitingAgentReply(conv: ConversationResponse | undefined): boolean {
  if (!conv || conv.messages.length === 0) return false;
  return conv.messages[conv.messages.length - 1].sender_type === "user";
}

// ---------------------------------------------------------------------------
// Project recommendation detection
// ---------------------------------------------------------------------------

// Keywords that signal the user wants to BUILD something new
const _CREATION_INTENT_RE =
  /\b(build|create|develop|implement|design|launch|set\s+up|start|make|establish|deploy)\b/i;

// Keywords that signal explanatory/analytical intent — NOT a new project
const _NON_PROJECT_INTENT_RE =
  /\b(explain|what\s+is|what\s+are|how\s+does|how\s+do|describe|overview|audit|review|summari[sz]|tell\s+me\s+about|existing|current|already)\b/i;

const _GENERIC_HEADINGS = new Set([
  "executive summary", "analysis", "recommended plan", "risks", "next actions",
  "overview", "summary", "approach", "response", "recommendations",
  "background", "context", "conclusion", "next steps",
]);

// ── Priority ─────────────────────────────────────────────────────────────────

const _HIGH_PRIORITY_RE =
  /\b(urgent|critical|asap|high[- ]priority|immediately|top[- ]priority|p0|p1|time[- ]sensitive|blocker)\b/i;
const _LOW_PRIORITY_RE =
  /\b(nice[- ]to[- ]have|low[- ]priority|optional|eventually|backlog|p3|p4|long[- ]term|future[- ]consideration)\b/i;

function _extractPriority(content: string, userMsg: string): ProjectPriority {
  const combined = `${userMsg} ${content}`;
  if (_HIGH_PRIORITY_RE.test(combined)) return "High";
  if (_LOW_PRIORITY_RE.test(combined)) return "Low";
  return "Medium";
}

// ── Complexity ────────────────────────────────────────────────────────────────

const _HIGH_COMPLEXITY_RE =
  /\b(complex|large[- ]scale|enterprise|extensive|multiple\s+teams?|architecture|migration|integration|several\s+months?)\b/i;
const _LOW_COMPLEXITY_RE =
  /\b(simple|straightforward|basic|quick|small|minimal|prototype|proof[- ]of[- ]concept|poc|mvp|weekend)\b/i;

function _extractComplexity(content: string, taskCount: number): ProjectComplexity {
  if (taskCount >= 7 || _HIGH_COMPLEXITY_RE.test(content)) return "High";
  if (_LOW_COMPLEXITY_RE.test(content)) return "Low";
  return "Medium";
}

// ── Milestones ────────────────────────────────────────────────────────────────

// Matches ### subheadings that look like phases/milestones/sprints
const _MILESTONE_H3_RE = /^###\s+(.+)/gm;
// Matches bold inline labels like **Phase 1: Setup** or **Milestone 2 —**
const _MILESTONE_BOLD_RE =
  /\*\*((?:phase|milestone|stage|sprint|week|month|step|q[1-4])\s*[\d.:\-–—][^*\n]{0,60})\*\*/gi;

function _extractMilestones(planSection: string): string[] {
  const results: string[] = [];

  // Prefer ### subheadings within the plan section
  for (const m of planSection.matchAll(_MILESTONE_H3_RE)) {
    results.push(m[1].trim().replace(/\*\*/g, ""));
  }
  if (results.length > 0) return results.slice(0, 5);

  // Fall back to bold phase/milestone labels
  for (const m of planSection.matchAll(_MILESTONE_BOLD_RE)) {
    results.push(m[1].trim());
  }
  return results.slice(0, 5);
}

// ── Main detector ─────────────────────────────────────────────────────────────

function detectProjectRecommendation(
  content: string,
  userMessage: string = "",
): ProjectRecommendationMetadata | null {
  // Only surface a project card when the user explicitly asked to build/create something
  if (!_CREATION_INTENT_RE.test(userMessage)) return null;
  // Suppress if the user's intent is explanatory or analytical, not generative
  if (_NON_PROJECT_INTENT_RE.test(userMessage)) return null;

  // Response must have a plan-style heading — a mere list of bullets is not enough
  const hasPlanSection =
    /^##\s+(recommended\s+plan|implementation\s+plan|action\s+plan|plan)\b/im.test(content);
  if (!hasPlanSection) return null;

  // Isolate the plan section body (up to the next ## heading) for targeted extraction
  const planMatch = content.match(
    /^##\s+(?:recommended\s+|implementation\s+|action\s+)?plan\b[^\n]*\n([\s\S]*?)(?=^##\s+|$)/im,
  );
  const planSection = planMatch?.[1] ?? content;

  // Bullets sourced from the plan section; fall back to full doc if plan had none
  const planBullets = planSection.match(/^[-*]\s+\S[^\n]*/gm) ?? [];
  const allBullets = planBullets.length >= 3
    ? planBullets
    : (content.match(/^[-*]\s+\S[^\n]*/gm) ?? []);

  if (allBullets.length < 3) return null;

  // Project name: first ## heading that isn't a standard section name
  let name = "New Project";
  for (const match of content.matchAll(/^##\s+(.+)/gm)) {
    const title = match[1].trim();
    if (!_GENERIC_HEADINGS.has(title.toLowerCase())) {
      name = title;
      break;
    }
  }

  // Description: first non-heading, non-list prose line ≥ 20 chars
  const descMatch = content.match(/^(?!#)(?![-*\d])([A-Z][^\n]{19,})/m);
  const description = descMatch?.[1]?.trim() ?? "";

  const tasks = allBullets
    .slice(0, 6)
    .map((item) => item.replace(/^[-*]\s+/, "").replace(/\*\*/g, "").trim());

  const milestones = _extractMilestones(planSection);
  const priority = _extractPriority(content, userMessage);
  const complexity = _extractComplexity(content, tasks.length);

  return { type: "project_recommendation", name, description, milestones, tasks, priority, complexity };
}

// ---------------------------------------------------------------------------

function apiConvToFrontend(conv: ConversationResponse): Conversation {
  const agent = conv.agent;
  const name = agent?.name ?? "Agent";
  const lastMsg = conv.messages[conv.messages.length - 1];
  return {
    id: conv.id,
    agentId: conv.agent_id ?? "",
    agentName: name,
    agentRole: agent?.role ?? "",
    agentInitials: agentInitials(name),
    agentColor: avatarGradient(agent?.id ?? conv.id),
    status: "online",
    lastMessage: lastMsg?.content.slice(0, 80) ?? conv.title,
    lastMessageAt: lastMsg
      ? new Date(lastMsg.created_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
    unread: 0,
  };
}

function apiMsgsToFrontend(conv: ConversationResponse): Message[] {
  return conv.messages.map((m, index) => {
    const isAgent = m.sender_type === "agent";
    // Find the most recent user message before this agent reply to check intent
    const precedingUserMsg = isAgent
      ? conv.messages.slice(0, index).reverse().find((x) => x.sender_type === "user")
      : undefined;
    return {
      id: m.id,
      conversationId: conv.id,
      sender: isAgent ? "agent" : "user",
      content: m.content,
      timestamp: new Date(m.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      metadata: isAgent
        ? detectProjectRecommendation(m.content, precedingUserMsg?.content ?? "")
        : null,
    };
  });
}

export default function ChatPage() {
  const { user, currentOrgId } = useAuthStore();

  if (user?.isGuest) return <GuestChatPage />;
  if (!currentOrgId) return <NeedOrgState />;
  return <AuthenticatedChatPage orgId={currentOrgId} />;
}

// ── No org ──────────────────────────────────────────────────────────────────

function NeedOrgState() {
  return (
    <div
      className="flex h-full items-center justify-center rounded-xl border"
      style={{
        background: "var(--card)",
        borderColor: "var(--border-light)",
        height: "calc(100svh - 88px)",
      }}
    >
      <p className="text-sm text-muted-foreground">
        No organization found. Please sign in to an account with an organization.
      </p>
    </div>
  );
}

// ── Guest (mock data) ────────────────────────────────────────────────────────

function GuestChatPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [extraMessages, setExtraMessages] = useState<Message[]>([]);
  const [mobileView, setMobileView] = useState<"sidebar" | "chat">("sidebar");

  const allMessages = [...MESSAGES, ...extraMessages];
  const activeMessages = allMessages.filter((m) => m.conversationId === selectedId);
  const selectedConversation = CONVERSATIONS.find((c) => c.id === selectedId) ?? null;

  function handleSend(conversationId: string, content: string) {
    const timestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    setExtraMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, conversationId, sender: "user", content, timestamp },
    ]);
  }

  // Derive fake agents from mock conversations for the sidebar
  const fakeAgents: AgentApiResponse[] = CONVERSATIONS.map((c) => ({
    id: c.id,
    organization_id: "guest",
    department_id: null,
    name: c.agentName,
    role: c.agentRole,
    goal: "",
    instructions: "",
    skills: [],
    provider: null,
    model: null,
    memory_config: null,
    tools: [],
    permissions: null,
    status: "Active",
    is_manager: false,
    created_at: "",
    updated_at: "",
  }));

  // Derive fake conversations for the sidebar's last-message preview
  const fakeConvs: ConversationResponse[] = CONVERSATIONS.map((c) => {
    const msgs = MESSAGES.filter((m) => m.conversationId === c.id);
    const lastMsg = msgs[msgs.length - 1];
    return {
      id: c.id,
      organization_id: "guest",
      user_id: null,
      agent_id: c.agentId,
      title: c.agentName,
      context_type: "agent",
      context_id: null,
      created_at: "",
      updated_at: lastMsg?.timestamp ?? "",
      messages: lastMsg
        ? [{
            id: lastMsg.id,
            conversation_id: c.id,
            sender_type: lastMsg.sender === "user" ? "user" : "agent",
            sender_id: c.agentId,
            content: lastMsg.content,
            payload: null,
            execution_id: null,
            created_at: lastMsg.timestamp,
          }]
        : [],
      agent: {
        id: c.agentId,
        name: c.agentName,
        role: c.agentRole,
        status: "Active",
        provider: null,
        model: null,
      },
    };
  });

  return (
    <ChatShell
      agents={fakeAgents}
      conversations={fakeConvs}
      selectedAgentId={selectedId}
      selectedConvId={selectedId}
      messages={activeMessages}
      selectedConversation={selectedConversation}
      mobileView={mobileView}
      isCreatingConv={false}
      isExecuting={false}
      onAgentSelect={(id) => { setSelectedId(id); setMobileView("chat"); }}
      onSend={handleSend}
      onBack={() => setMobileView("sidebar")}
    />
  );
}

// ── Authenticated ────────────────────────────────────────────────────────────

function AuthenticatedChatPage({ orgId }: { orgId: string }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [isCreatingConv, setIsCreatingConv] = useState(false);
  const [mobileView, setMobileView] = useState<"sidebar" | "chat">("sidebar");
  const pendingHandled = useRef(false);

  const { pendingConversationId, setPendingConversationId } = useWorkspaceStore();

  // Load all agents for the sidebar
  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ["agents", orgId],
    queryFn: () => agentApi.list(orgId),
    enabled: !!orgId,
    staleTime: 60_000,
  });

  // Load all conversations for last-message previews
  const { data: allConversations = [] } = useQuery({
    queryKey: ["conversations", orgId],
    queryFn: () => conversationApi.list({ organization_id: orgId, limit: 100 }),
    enabled: !!orgId,
    staleTime: 30_000,
  });

  // Load the selected conversation with messages (+ polling while awaiting reply)
  const { data: selectedApiConv } = useQuery({
    queryKey: ["conversation", selectedConvId],
    queryFn: () => conversationApi.get(selectedConvId!),
    enabled: !!selectedConvId,
    staleTime: 10_000,
    refetchInterval: (query) =>
      isAwaitingAgentReply(query.state.data as ConversationResponse | undefined)
        ? 2000
        : false,
  });

  // Handle pending conversation arriving from the dashboard
  useEffect(() => {
    if (pendingConversationId && !pendingHandled.current) {
      pendingHandled.current = true;
      setPendingConversationId(null);

      // Find the agent for this conversation and select both
      conversationApi.get(pendingConversationId).then((conv) => {
        if (conv.agent_id) setSelectedAgentId(conv.agent_id);
        setSelectedConvId(pendingConversationId);
        setMobileView("chat");
        queryClient.invalidateQueries({ queryKey: ["conversations", orgId] });
      });
    }
  }, [pendingConversationId, orgId, setPendingConversationId, queryClient]);

  async function handleAgentSelect(agentId: string) {
    setSelectedAgentId(agentId);
    setMobileView("chat");

    // Find the most recent existing conversation for this agent
    const existing = allConversations
      .filter((c) => c.agent_id === agentId)
      .sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1))[0];

    if (existing) {
      setSelectedConvId(existing.id);
      return;
    }

    // No conversation yet — create one
    setIsCreatingConv(true);
    try {
      const conv = await conversationApi.create({
        organization_id: orgId,
        agent_id: agentId,
        user_id: user?.id,
      });
      setSelectedConvId(conv.id);
      queryClient.invalidateQueries({ queryKey: ["conversations", orgId] });
    } catch (e) {
      console.error("Failed to create conversation:", e);
    } finally {
      setIsCreatingConv(false);
    }
  }

  const sendMessage = useMutation({
    mutationFn: async ({ convId, content }: { convId: string; content: string }) => {
      return conversationApi.sendMessage(convId, content);
    },
    onSuccess: (_msgs, { convId }) => {
      queryClient.invalidateQueries({ queryKey: ["conversation", convId] });
      queryClient.invalidateQueries({ queryKey: ["conversations", orgId] });
    },
    onError: (_err, { convId }) => {
      queryClient.invalidateQueries({ queryKey: ["conversation", convId] });
    },
  });

  function handleSend(conversationId: string, content: string) {
    // Optimistic update — flips isAwaitingAgentReply immediately
    queryClient.setQueryData<ConversationResponse>(
      ["conversation", conversationId],
      (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [
            ...prev.messages,
            {
              id: `optimistic-${Date.now()}`,
              conversation_id: conversationId,
              sender_type: "user",
              sender_id: user?.id ?? "",
              content,
              payload: null,
              execution_id: null,
              created_at: new Date().toISOString(),
            },
          ],
        };
      },
    );
    sendMessage.mutate({ convId: conversationId, content });
  }

  const { data: agentWorkload } = useQuery({
    queryKey: ["agent-workload", selectedAgentId],
    queryFn: () => agentApi.workload(selectedAgentId!),
    enabled: !!selectedAgentId,
    staleTime: 30_000,
  });

  const activeMessages: Message[] = selectedApiConv ? apiMsgsToFrontend(selectedApiConv) : [];

  const selectedConversation: Conversation | null = selectedApiConv
    ? apiConvToFrontend(selectedApiConv)
    : null;

  if (agentsLoading) {
    return (
      <div
        className="flex h-full items-center justify-center rounded-xl border"
        style={{
          background: "var(--card)",
          borderColor: "var(--border-light)",
          height: "calc(100svh - 88px)",
        }}
      >
        <p className="text-sm text-muted-foreground">Loading agents…</p>
      </div>
    );
  }

  return (
    <ChatShell
      agents={agents}
      conversations={allConversations}
      selectedAgentId={selectedAgentId}
      selectedConvId={selectedConvId}
      messages={activeMessages}
      selectedConversation={selectedConversation}
      mobileView={mobileView}
      isCreatingConv={isCreatingConv}
      isExecuting={isAwaitingAgentReply(selectedApiConv)}
      agentWorkload={agentWorkload}
      onAgentSelect={(id) => handleAgentSelect(id)}
      onSend={handleSend}
      onBack={() => setMobileView("sidebar")}
    />
  );
}

// ── Shared shell ─────────────────────────────────────────────────────────────

interface ChatShellProps {
  agents: AgentApiResponse[];
  conversations: ConversationResponse[];
  selectedAgentId: string | null;
  selectedConvId: string | null;
  messages: Message[];
  selectedConversation: Conversation | null;
  mobileView: "sidebar" | "chat";
  isCreatingConv: boolean;
  isExecuting: boolean;
  agentWorkload?: { projects_owned: number; tasks_assigned: number };
  onAgentSelect: (agentId: string) => void;
  onSend: (conversationId: string, content: string) => void;
  onBack: () => void;
}

function ChatShell({
  agents,
  conversations,
  selectedAgentId,
  selectedConvId,
  messages,
  selectedConversation,
  mobileView,
  isCreatingConv,
  isExecuting,
  agentWorkload,
  onAgentSelect,
  onSend,
  onBack,
}: ChatShellProps) {
  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{
        background: "var(--card)",
        borderColor: "var(--border-light)",
        height: "calc(100svh - 88px)",
      }}
    >
      <div className="flex h-full">
        {/* Agent sidebar */}
        <div
          className={`h-full w-full shrink-0 md:block md:w-72 lg:w-80 ${
            mobileView === "chat" ? "hidden" : "block"
          }`}
          style={{ background: "var(--surface)" }}
        >
          <ConversationSidebar
            agents={agents}
            conversations={conversations}
            selectedAgentId={selectedAgentId}
            isCreating={isCreatingConv}
            onSelect={onAgentSelect}
          />
        </div>

        {/* Chat area */}
        <div
          className={`h-full min-w-0 flex-1 ${
            mobileView === "sidebar" ? "hidden md:flex md:flex-col" : "flex flex-col"
          }`}
        >
          {isCreatingConv && !selectedConvId ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground animate-pulse">
                Opening conversation…
              </p>
            </div>
          ) : (
            <ChatArea
              conversation={selectedConversation}
              messages={messages}
              onBack={onBack}
              onSend={onSend}
              isExecuting={isExecuting}
              agentWorkload={agentWorkload}
            />
          )}
        </div>
      </div>
    </div>
  );
}
