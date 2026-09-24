import { useLocation } from "react-router-dom";

import { desktopWorkspaceReturnPath } from "../../lib/desktop-navigation";
import { useWorkspaceStore } from "../../stores/workspaceStore";

export function useDesktopWorkspaceReturnPath(): string {
  const location = useLocation();
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const activeWorkspace = useWorkspaceStore((state) => state.workspaceRegistry[activeWorkspaceId]);
  const currentConversationId = useWorkspaceStore((state) => state.currentConversationId);
  const params = new URLSearchParams();
  if (currentConversationId) params.set("conversation_id", currentConversationId);
  const fallback = `/agents/${encodeURIComponent(activeWorkspace?.agentId ?? "default")}/workspace${
    params.size ? `?${params.toString()}` : ""
  }`;
  return desktopWorkspaceReturnPath(location.pathname, location.search, fallback);
}
