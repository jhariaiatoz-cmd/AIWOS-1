import { create } from "zustand";

type WorkspaceStore = {
  pendingConversationId: string | null;
  setPendingConversationId: (id: string | null) => void;
};

export const useWorkspaceStore = create<WorkspaceStore>()((set) => ({
  pendingConversationId: null,
  setPendingConversationId: (id) => set({ pendingConversationId: id }),
}));
