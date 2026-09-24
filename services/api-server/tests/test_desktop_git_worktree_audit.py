import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.models import AdminAuditEvent, Base
from app.db.session import get_db_session
from app.events.event_types import EventType
from app.main import app
from app.security.auth import AuthenticatedPrincipal, get_current_principal


@pytest.fixture
def audit_context():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    principal_state = {"value": AuthenticatedPrincipal(
        user_id="user-a",
        organization_id="org-a",
        roles={"admin"},
        role="admin",
        permissions=set(),
        auth_type="jwt",
        api_key_id=None,
    )}

    def override_get_db():
        yield session

    def override_principal():
        return principal_state["value"]

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_principal] = override_principal
    yield session, principal_state
    session.close()
    app.dependency_overrides.clear()


def payload(**overrides):
    value = {
        "operation_id": "worktree-operation-1",
        "phase": "requested",
        "action": "create",
        "path": ".",
        "target_path": ".worktrees/review",
        "preview_sha256": "a" * 64,
    }
    value.update(overrides)
    return value


def test_git_worktree_audit_is_organization_scoped_and_idempotent(audit_context):
    session, _principal_state = audit_context
    client = TestClient(app)
    first = client.post("/api/desktop/git-worktree/audit", json=payload())
    duplicate = client.post("/api/desktop/git-worktree/audit", json=payload())
    completed = client.post("/api/desktop/git-worktree/audit", json=payload(phase="completed"))

    assert first.status_code == duplicate.status_code == completed.status_code == 200
    assert duplicate.json() == first.json()
    assert completed.json()["audit_id"] != first.json()["audit_id"]
    audits = list(session.scalars(select(AdminAuditEvent)))
    assert len(audits) == 2
    assert audits[0].event_type == EventType.DESKTOP_GIT_WORKTREE_AUDITED.value
    assert audits[0].resource_type == "desktop_git_worktree"


def test_git_worktree_audit_rejects_member_and_path_escape(audit_context):
    _session, principal_state = audit_context
    principal_state["value"] = AuthenticatedPrincipal(
        user_id="user-a",
        organization_id="org-a",
        roles={"member"},
        role="member",
        permissions=set(),
        auth_type="jwt",
        api_key_id=None,
    )
    client = TestClient(app)
    assert client.post("/api/desktop/git-worktree/audit", json=payload()).status_code == 403
    principal_state["value"] = AuthenticatedPrincipal(
        user_id="user-a",
        organization_id="org-a",
        roles={"admin"},
        role="admin",
        permissions=set(),
        auth_type="jwt",
        api_key_id=None,
    )
    assert (
        client.post(
            "/api/desktop/git-worktree/audit",
            json=payload(target_path="../outside"),
        ).status_code
        == 422
    )
