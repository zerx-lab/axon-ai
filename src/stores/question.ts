import { create } from "zustand";
import type { QuestionRequest } from "@/types/chat";

interface QuestionState {
  pendingRequests: Record<string, QuestionRequest[]>;
  respondedIds: Set<string>;
}

interface QuestionActions {
  addRequest: (request: QuestionRequest) => void;
  removeRequest: (requestId: string, sessionId: string) => void;
  clearSessionRequests: (sessionId: string) => void;
  getSessionRequests: (sessionId: string) => QuestionRequest[];
  getFirstPending: (sessionId: string) => QuestionRequest | undefined;
  markResponded: (requestId: string) => void;
  clearResponded: (requestId: string) => void;
  hasResponded: (requestId: string) => boolean;
  reset: () => void;
}

type QuestionStore = QuestionState & QuestionActions;

const initialState: QuestionState = {
  pendingRequests: {},
  respondedIds: new Set(),
};

export const useQuestionStore = create<QuestionStore>()((set, get) => ({
  ...initialState,

  addRequest: (request) => {
    set((state) => {
      const sessionRequests = state.pendingRequests[request.sessionID] || [];
      if (sessionRequests.some((r) => r.id === request.id)) {
        return state;
      }
      return {
        pendingRequests: {
          ...state.pendingRequests,
          [request.sessionID]: [...sessionRequests, request],
        },
      };
    });
  },

  removeRequest: (requestId, sessionId) => {
    set((state) => {
      const sessionRequests = state.pendingRequests[sessionId] || [];
      const filtered = sessionRequests.filter((r) => r.id !== requestId);
      if (filtered.length === sessionRequests.length) {
        return state;
      }
      return {
        pendingRequests: {
          ...state.pendingRequests,
          [sessionId]: filtered,
        },
      };
    });
  },

  clearSessionRequests: (sessionId) => {
    set((state) => {
      const { [sessionId]: _, ...rest } = state.pendingRequests;
      return { pendingRequests: rest };
    });
  },

  getSessionRequests: (sessionId) => {
    return get().pendingRequests[sessionId] || [];
  },

  getFirstPending: (sessionId) => {
    const requests = get().pendingRequests[sessionId] || [];
    return requests[0];
  },

  markResponded: (requestId) => {
    set((state) => {
      const newSet = new Set(state.respondedIds);
      newSet.add(requestId);
      return { respondedIds: newSet };
    });
  },

  clearResponded: (requestId) => {
    set((state) => {
      const newSet = new Set(state.respondedIds);
      newSet.delete(requestId);
      return { respondedIds: newSet };
    });
  },

  hasResponded: (requestId) => {
    return get().respondedIds.has(requestId);
  },

  reset: () => {
    set(initialState);
  },
}));
