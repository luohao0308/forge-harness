import { describe, expect, it } from "vitest";

import type { AgentMessage, TeamAgent } from "../../../../tasks/api";
import { agentSessionMessages, normalizeTeamTimestamp, timestampMs } from "../teamState";

function message(id: string, role: AgentMessage["role"], sequence: number): AgentMessage {
  return {
    id,
    session_id: "session-1",
    agent_id: "default",
    role,
    content: id,
    metadata_json: { source: "agent_workspace_import", source_sequence: sequence },
    created_at: "2026-08-29T06:27:11.741",
  };
}

function agent(sessionMessages: AgentMessage[]): TeamAgent {
  return {
    id: "agent-1",
    team_id: "team-1",
    slot_id: "leader",
    agent_id: "default",
    role: "leader",
    agent_name: "Leader",
    status: "idle",
    model_provider: "default",
    model_name: "default",
    conversation_id: "session-1",
    session_id: "session-1",
    session_messages: sessionMessages,
    metadata_json: {},
    created_at: "2026-08-29T06:27:11.741",
    updated_at: "2026-08-29T06:27:11.741",
  };
}

describe("team message chronology", () => {
  it("treats timezone-less backend timestamps as UTC", () => {
    expect(normalizeTeamTimestamp("2026-08-29T06:27:11.741")).toBe("2026-08-29T06:27:11.741Z");
    expect(timestampMs("2026-08-29T06:27:11.741")).toBe(Date.parse("2026-08-29T06:27:11.741Z"));
  });

  it("uses imported path sequence to resolve equal timestamp ties", () => {
    const ordered = agentSessionMessages(agent([
      message("answer", "assistant", 1),
      message("question", "user", 0),
    ]));
    expect(ordered.map((item) => item.id)).toEqual(["question", "answer"]);
  });
});
