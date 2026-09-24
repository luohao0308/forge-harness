const WORKSPACE_PATH_PATTERN = /^\/agents\/[^/]+\/workspace$/;

export type DesktopWorkspacePanel = "files" | "approvals";

export function desktopWorkspaceReturnPath(
  pathname: string,
  search: string,
  fallback: string,
): string {
  if (WORKSPACE_PATH_PATTERN.test(pathname)) {
    return normalizeWorkspacePath(`${pathname}${search}`) ?? fallback;
  }

  const candidate = new URLSearchParams(search).get("return_to");
  return normalizeWorkspacePath(candidate) ?? fallback;
}

export function desktopOperationPath(target: string, returnTo: string): string {
  const [pathAndSearch, hash = ""] = target.split("#", 2);
  const [pathname, search = ""] = pathAndSearch.split("?", 2);
  const params = new URLSearchParams(search);
  params.set("return_to", normalizeWorkspacePath(returnTo) ?? "/agents/default/workspace");
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}

export function desktopWorkspacePanelPath(
  returnTo: string,
  panel: DesktopWorkspacePanel,
): string {
  const normalized = normalizeWorkspacePath(returnTo) ?? "/agents/default/workspace";
  const url = new URL(normalized, "http://harness.local");
  url.searchParams.set("desktop_panel", panel);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

export function normalizeWorkspacePath(value: string | null | undefined): string | null {
  if (!value || value.startsWith("//")) return null;

  try {
    const url = new URL(value, "http://harness.local");
    if (url.origin !== "http://harness.local" || !WORKSPACE_PATH_PATTERN.test(url.pathname)) {
      return null;
    }

    const params = new URLSearchParams();
    const conversationId = url.searchParams.get("conversation_id")?.trim();
    if (conversationId) params.set("conversation_id", conversationId);
    const query = params.toString();
    return `${url.pathname}${query ? `?${query}` : ""}`;
  } catch {
    return null;
  }
}
