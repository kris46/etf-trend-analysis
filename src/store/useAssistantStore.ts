import { create } from "zustand";
import type { ChatMessage } from "../lib/assistant/claudeClient";

interface AssistantState {
  apiKey: string;
  messages: ChatMessage[];
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
}

/**
 * No persist middleware here on purpose: the API key lives only in this
 * tab's memory for this session. Refreshing the page clears it. This is the
 * only safe option for a "bring your own key" pattern on a static site with
 * no backend -- there's nowhere to store it that wouldn't risk exposing it
 * (committing it into the deployed site's source is never an option), and
 * it's consistent with the no-built-in-storage decision made in Phase 1.
 */
export const useAssistantStore = create<AssistantState>((set) => ({
  apiKey: "",
  messages: [],
  setApiKey: (key) => set({ apiKey: key }),
  clearApiKey: () => set({ apiKey: "" }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  clearMessages: () => set({ messages: [] }),
}));
