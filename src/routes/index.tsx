import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChatContainer } from "@/components/chat";
import { ChatSidebar } from "@/components/sidebar";
import { useChat } from "@/stores/chat";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const {
    sessions,
    activeSession,
    messages,
    isLoading,
    sendMessage,
    stopGeneration,
    createNewSession,
    selectSession,
    deleteSession,
  } = useChat();

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSession?.id ?? null}
        onSelectSession={selectSession}
        onNewSession={createNewSession}
        onDeleteSession={deleteSession}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main chat area */}
      <ChatContainer
        messages={messages}
        onSend={sendMessage}
        onStop={stopGeneration}
        isLoading={isLoading}
      />
    </div>
  );
}
