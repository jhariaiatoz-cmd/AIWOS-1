"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CONVERSATIONS, MESSAGES } from "@/lib/data/chat";
import type { Message, Conversation } from "@/lib/data/chat";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { useAuthStore } from "@/lib/store/auth";
import { useWorkspaceStore } from "@/lib/store/workspace";
import { conversationApi } from "@/lib/api/conversations";
import type { ConversationResponse } from "@/lib/api/conversations";

const AGENT_COLORS = [
  "linear-gradient(135deg, #7c3aed, #4f46e5)",
  "linear-gradient(135deg, #06b6d4, #0891b2)",
  "linear-gradient(135deg, #10b981, #059669)",
  "linear-gradient(135deg, #ec4899, #db2777)",
  "linear-gradient(135deg, #f59e0b, #d97706)",
  "linear-gradient(135deg, #8b5cf6, #6d28d9)",
];

// ── Color assigned consistently by conversation index in org
const convColorIndex = new Map<string, number>();
function getConvColor(convId: string, index: number): string {
  if (!convColorIndex.has(convId)) convColorIndex.set(convId, index);
  return AGENT_COLORS[(convColorIndex.get(convId) ?? index) % AGENT_COLORS.length];
}

function apiConvToFrontend(conv: ConversationResponse, index: number): Conversation {
  const agent = conv.agent;
  const name = agent?.name ?? "Agent";
  const lastMsg = conv.messages[conv.messages.length - 1];
  return {
    id: conv.id,
    agentName: name,
    agentRole: agent?.role ?? "",
    agentInitials: name.slice(0, 2).toUpperCase(),
    agentColor: getConvColor(conv.id, index),
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
  return conv.messages.map((m) => ({
    id: m.id,
    conversationId: conv.id,
    sender: m.sender_type === "user" ? "user" : "agent",
    content: m.content,
    timestamp: new Date(m.created_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));
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
  const [selectedId, setSelectedId] = useState<string | null>("conv-1");
  const [extraMessages, setExtraMessages] = useState<Message[]>([]);
  const [mobileView, setMobileView] = useState<"sidebar" | "chat">("sidebar");

  const allMessages = useMemo(() => [...MESSAGES, ...extraMessages], [extraMessages]);
  const activeMessages = useMemo(
    () => allMessages.filter((m) => m.conversationId === selectedId),
    [allMessages, selectedId],
  );
  const selectedConversation = useMemo(
    () => CONVERSATIONS.find((c) => c.id === selectedId) ?? null,
    [selectedId],
  );

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

  return (
    <ChatShell
      conversations={CONVERSATIONS}
      selectedId={selectedId}
      messages={activeMessages}
      selectedConversation={selectedConversation}
      mobileView={mobileView}
      onSelect={(id) => { setSelectedId(id); setMobileView("chat"); }}
      onSend={handleSend}
      onBack={() => setMobileView("sidebar")}
    />
  );
}

// ── Authenticated ────────────────────────────────────────────────────────────

function AuthenticatedChatPage({ orgId }: { orgId: string }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [sendingForConv, setSendingForConv] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "chat">("sidebar");
  const pendingHandled = useRef(false);

  const { pendingConversationId, setPendingConversationId } = useWorkspaceStore();

  const { data: apiConversations = [], isLoading } = useQuery({
    queryKey: ["conversations", orgId],
    queryFn: () =>
      conversationApi.list({ organization_id: orgId, limit: 50 }),
    enabled: !!orgId,
    staleTime: 30_000,
  });

  // On first load or when a pending conversation arrives from the dashboard,
  // select it and clear the store.
  useEffect(() => {
    if (pendingConversationId && !pendingHandled.current) {
      pendingHandled.current = true;
      setPendingConversationId(null);
      setSelectedConvId(pendingConversationId);
      setMobileView("chat");
      // Invalidate so the new conversation appears in the list
      queryClient.invalidateQueries({ queryKey: ["conversations", orgId] });
    }
  }, [pendingConversationId, orgId, setPendingConversationId, queryClient]);

  // Auto-select first conversation once loaded if none is selected
  useEffect(() => {
    if (!selectedConvId && apiConversations.length > 0 && !pendingConversationId) {
      setSelectedConvId(apiConversations[0].id);
    }
  }, [apiConversations, selectedConvId, pendingConversationId]);

  const { data: selectedApiConv } = useQuery({
    queryKey: ["conversation", selectedConvId],
    queryFn: () => conversationApi.get(selectedConvId!),
    enabled: !!selectedConvId,
    staleTime: 10_000,
  });

  const conversations: Conversation[] = useMemo(
    () => apiConversations.map((c, i) => apiConvToFrontend(c, i)),
    [apiConversations],
  );

  const activeMessages: Message[] = useMemo(() => {
    if (!selectedApiConv) return [];
    return apiMsgsToFrontend(selectedApiConv);
  }, [selectedApiConv]);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConvId) ?? null,
    [conversations, selectedConvId],
  );

  const sendMessage = useMutation({
    mutationFn: async ({ convId, content }: { convId: string; content: string }) => {
      return conversationApi.sendMessage(convId, content);
    },
    onSuccess: (_msgs, { convId }) => {
      queryClient.invalidateQueries({ queryKey: ["conversation", convId] });
      queryClient.invalidateQueries({ queryKey: ["conversations", orgId] });
      setSendingForConv(null);
    },
    onError: (_err, { convId }) => {
      setSendingForConv(null);
      queryClient.invalidateQueries({ queryKey: ["conversation", convId] });
    },
  });

  function handleSelect(id: string) {
    setSelectedConvId(id);
    setMobileView("chat");
  }

  function handleSend(conversationId: string, content: string) {
    setSendingForConv(conversationId);
    // Optimistic user message so the UI feels instant
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

  if (isLoading && conversations.length === 0) {
    return (
      <div
        className="flex h-full items-center justify-center rounded-xl border"
        style={{
          background: "var(--card)",
          borderColor: "var(--border-light)",
          height: "calc(100svh - 88px)",
        }}
      >
        <p className="text-sm text-muted-foreground">Loading conversations…</p>
      </div>
    );
  }

  return (
    <ChatShell
      conversations={conversations}
      selectedId={selectedConvId}
      messages={activeMessages}
      selectedConversation={selectedConversation}
      mobileView={mobileView}
      onSelect={handleSelect}
      onSend={handleSend}
      onBack={() => setMobileView("sidebar")}
      isExecuting={sendingForConv === selectedConvId}
    />
  );
}

// ── Shared layout ────────────────────────────────────────────────────────────

interface ChatShellProps {
  conversations: Conversation[];
  selectedId: string | null;
  messages: Message[];
  selectedConversation: Conversation | null;
  mobileView: "sidebar" | "chat";
  onSelect: (id: string) => void;
  onSend: (conversationId: string, content: string) => void;
  onBack: () => void;
  isExecuting?: boolean;
}

function ChatShell({
  conversations,
  selectedId,
  messages,
  selectedConversation,
  mobileView,
  onSelect,
  onSend,
  onBack,
  isExecuting = false,
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
        <div
          className={`h-full w-full shrink-0 md:block md:w-72 lg:w-80 ${
            mobileView === "chat" ? "hidden" : "block"
          }`}
          style={{ background: "var(--surface)" }}
        >
          <ConversationSidebar
            conversations={conversations}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        </div>
        <div
          className={`h-full min-w-0 flex-1 ${
            mobileView === "sidebar" ? "hidden md:flex md:flex-col" : "flex flex-col"
          }`}
        >
          <ChatArea
            conversation={selectedConversation}
            messages={messages}
            onBack={onBack}
            onSend={onSend}
            isExecuting={isExecuting}
          />
        </div>
      </div>
    </div>
  );
}
