import pytest
from pydantic import ValidationError

from app.api.schemas import AgentChatStreamRequest, LocalAgentSendMessageRequest


def test_workspace_request_defaults_preserve_legacy_clients() -> None:
    cloud = AgentChatStreamRequest()
    local = LocalAgentSendMessageRequest(content="hello", client_message_id="client-1")

    assert cloud.reasoning_effort == "high"
    assert cloud.permission_mode == "confirm"
    assert local.reasoning_effort == "high"
    assert local.permission_mode == "confirm"


@pytest.mark.parametrize("field", ["reasoning_effort", "permission_mode"])
def test_workspace_request_rejects_unknown_selection(field: str) -> None:
    with pytest.raises(ValidationError):
        AgentChatStreamRequest(**{field: "invalid"})
