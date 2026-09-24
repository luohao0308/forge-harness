import httpx

from app.tools.adapter_registry import AdapterRegistry
from app.tools.adapters import github_adapter
from app.tools.adapters.github_adapter import GitHubAdapter
from app.tools.registry import ToolRegistry


class FakeGitHubClient:
    def __init__(self, responses: list[httpx.Response]) -> None:
        self.responses = responses
        self.calls: list[dict] = []

    def __enter__(self) -> "FakeGitHubClient":
        return self

    def __exit__(self, *args) -> None:
        return None

    def get(self, url: str, params: dict | None = None) -> httpx.Response:
        self.calls.append({"url": url, "params": params or {}})
        return self.responses.pop(0)

    def post(self, url: str, json: dict | None = None) -> httpx.Response:
        self.calls.append({"url": url, "json": json or {}})
        return self.responses.pop(0)


class RaisingGitHubClient:
    def __init__(self, error: Exception) -> None:
        self.error = error
        self.calls = 0

    def __enter__(self) -> "RaisingGitHubClient":
        return self

    def __exit__(self, *args) -> None:
        return None

    def get(self, url: str, params: dict | None = None) -> httpx.Response:
        del url, params
        self.calls += 1
        raise self.error

    def post(self, url: str, json: dict | None = None) -> httpx.Response:
        del url, json
        self.calls += 1
        raise self.error


def _adapter(method: str) -> GitHubAdapter:
    return GitHubAdapter(
        slug=f"github.{method}",
        method=method,
        description=method,
        input_schema={},
        output_schema={},
    )


def _metadata(name: str):
    return ToolRegistry.default().tools[name]


def test_github_list_issues_parses_items_and_truncates_body(monkeypatch) -> None:
    fake = FakeGitHubClient(
        [
            httpx.Response(
                200,
                json=[
                    {
                        "number": 7,
                        "title": "Bug",
                        "state": "open",
                        "html_url": "https://github.test/acme/repo/issues/7",
                        "user": {"login": "octo"},
                        "created_at": "2026-05-28T00:00:00Z",
                        "body": "x" * 1200,
                    },
                    {"number": 8, "pull_request": {}},
                ],
            )
        ]
    )
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *args, **kwargs: fake)

    result = _adapter("list_issues").execute(
        metadata=_metadata("github.list_issues"),
        input_json={"repo": "acme/repo", "limit": 5, "labels": "bug,urgent"},
        config_json={"runtime": {"endpoint_url": "https://github.test"}},
        secret_value="ghp_test",
    )

    assert fake.calls[0]["url"] == "https://github.test/repos/acme/repo/issues"
    assert fake.calls[0]["params"]["per_page"] == 5
    assert fake.calls[0]["params"]["labels"] == "bug,urgent"
    assert result.output_json["source"] == "github-api"
    assert len(result.output_json["items"]) == 1
    assert result.output_json["items"][0]["author"] == "octo"
    assert len(result.output_json["items"][0]["body_preview"]) == 1000


def test_github_get_pull_fetches_files(monkeypatch) -> None:
    fake = FakeGitHubClient(
        [
            httpx.Response(
                200,
                json={
                    "number": 3,
                    "title": "Change",
                    "state": "open",
                    "html_url": "https://github.test/acme/repo/pull/3",
                    "base": {"ref": "main"},
                    "head": {"ref": "feature"},
                    "mergeable": True,
                    "user": {"login": "dev"},
                },
            ),
            httpx.Response(
                200,
                json=[
                    {
                        "filename": "app.py",
                        "status": "modified",
                        "additions": 2,
                        "deletions": 1,
                        "patch": "p" * 5000,
                    }
                ],
            ),
        ]
    )
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *args, **kwargs: fake)

    result = _adapter("get_pull").execute(
        metadata=_metadata("github.get_pull"),
        input_json={"repo": "acme/repo", "number": 3},
        config_json=None,
        secret_value="ghp_test",
    )

    assert result.output_json["pull"]["base"] == "main"
    assert result.output_json["files"][0]["filename"] == "app.py"
    assert len(result.output_json["files"][0]["patch_preview"]) == 4000


def test_github_get_issue_includes_bounded_comments(monkeypatch) -> None:
    fake = FakeGitHubClient(
        [
            httpx.Response(200, json={"number": 9, "title": "Bug", "user": {"login": "octo"}}),
            httpx.Response(
                200,
                json=[
                    {"user": {"login": "alice"}, "body": "a" * 1200, "created_at": "now"},
                    "malformed",
                ],
            ),
        ]
    )
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *args, **kwargs: fake)

    result = _adapter("get_issue").execute(
        metadata=_metadata("github.get_issue"),
        input_json={"repo": "acme/repo", "number": 9, "include_comments": True},
        config_json=None,
        secret_value="ghp_test",
    )

    assert [call["url"] for call in fake.calls] == [
        "https://api.github.com/repos/acme/repo/issues/9",
        "https://api.github.com/repos/acme/repo/issues/9/comments",
    ]
    assert result.output_json["comments"][0]["author"] == "alice"
    assert len(result.output_json["comments"][0]["body"]) == 1000


def test_github_get_issue_without_comments_returns_empty_list(monkeypatch) -> None:
    fake = FakeGitHubClient([httpx.Response(200, json={"number": 9, "title": "Bug"})])
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *args, **kwargs: fake)

    result = _adapter("get_issue").execute(
        metadata=_metadata("github.get_issue"),
        input_json={"repo": "acme/repo", "number": 9},
        config_json=None,
        secret_value="ghp_test",
    )

    assert result.output_json["comments"] == []


def test_github_list_pulls_filters_non_dict_items_and_limits(monkeypatch) -> None:
    fake = FakeGitHubClient(
        [
            httpx.Response(
                200,
                json=[
                    {"number": 1, "title": "First", "base": {"ref": "main"}},
                    {"number": 2, "title": "Second"},
                    None,
                ],
            )
        ]
    )
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *args, **kwargs: fake)

    result = _adapter("list_pulls").execute(
        metadata=_metadata("github.list_pulls"),
        input_json={"repo": "acme/repo", "state": "closed", "limit": 1},
        config_json=None,
        secret_value="ghp_test",
    )

    assert fake.calls[0]["params"] == {"state": "closed", "per_page": 1}
    assert [item["number"] for item in result.output_json["items"]] == [1]


def test_github_get_pull_normalizes_malformed_file_counts(monkeypatch) -> None:
    fake = FakeGitHubClient(
        [
            httpx.Response(200, json={"number": 4, "title": "Change"}),
            httpx.Response(
                200,
                json=[{"filename": "x.py", "additions": "bad", "deletions": -2}],
            ),
        ]
    )
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *args, **kwargs: fake)

    result = _adapter("get_pull").execute(
        metadata=_metadata("github.get_pull"),
        input_json={"repo": "acme/repo", "number": 4},
        config_json=None,
        secret_value="ghp_test",
    )

    assert result.output_json["files"][0]["additions"] == 0
    assert result.output_json["files"][0]["deletions"] == 0


def test_github_search_code_builds_query(monkeypatch) -> None:
    fake = FakeGitHubClient(
        [
            httpx.Response(
                200,
                json={
                    "items": [
                        {
                            "repository": {"full_name": "acme/repo"},
                            "path": "app.py",
                            "html_url": "https://github.test/acme/repo/blob/main/app.py",
                            "name": "app.py",
                        }
                    ]
                },
            )
        ]
    )
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *args, **kwargs: fake)

    result = _adapter("search_code").execute(
        metadata=_metadata("github.search_code"),
        input_json={"query": "ToolRunner", "repo": "acme/repo", "language": "python"},
        config_json=None,
        secret_value="ghp_test",
    )

    assert fake.calls[0]["params"]["q"] == "ToolRunner repo:acme/repo language:python"
    assert result.output_json["items"][0]["repo"] == "acme/repo"


def test_github_search_code_rejects_invalid_repo_and_empty_query() -> None:
    invalid_repo = _adapter("search_code").execute(
        metadata=_metadata("github.search_code"),
        input_json={"query": "x", "repo": "../repo"},
        config_json=None,
        secret_value="ghp_test",
    )
    empty_query = _adapter("search_code").execute(
        metadata=_metadata("github.search_code"),
        input_json={"query": "   "},
        config_json=None,
        secret_value="ghp_test",
    )

    assert invalid_repo.output_json["error"] == "invalid_input"
    assert empty_query.output_json["error"] == "invalid_input"


def test_github_search_code_preserves_qualifiers_when_query_is_long(monkeypatch) -> None:
    fake = FakeGitHubClient([httpx.Response(200, json={"items": []})])
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *args, **kwargs: fake)

    _adapter("search_code").execute(
        metadata=_metadata("github.search_code"),
        input_json={
            "query": "x" * 600,
            "repo": "acme/repo",
            "language": "python",
        },
        config_json=None,
        secret_value="ghp_test",
    )

    query = fake.calls[0]["params"]["q"]
    assert len(query) == 400
    assert query.endswith("repo:acme/repo language:python")


def test_github_search_code_rejects_oversized_qualifiers() -> None:
    result = _adapter("search_code").execute(
        metadata=_metadata("github.search_code"),
        input_json={"query": "needle", "language": "x" * 400},
        config_json=None,
        secret_value="ghp_test",
    )

    assert result.output_json == {
        "error": "invalid_input",
        "message": "search qualifiers are too long",
    }


def test_github_returns_structured_rate_limit(monkeypatch) -> None:
    fake = FakeGitHubClient(
        [
            httpx.Response(
                403,
                json={"message": "API rate limit exceeded"},
                headers={"x-ratelimit-remaining": "0", "x-ratelimit-reset": "1770000000"},
            )
        ]
    )
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *args, **kwargs: fake)

    result = _adapter("list_issues").execute(
        metadata=_metadata("github.list_issues"),
        input_json={"repo": "acme/repo"},
        config_json=None,
        secret_value="ghp_test",
    )

    assert result.output_json["error"] == "rate_limited"
    assert result.output_json["reset_at"] == "1770000000"


def test_github_invalid_input_and_missing_secret_do_not_raise() -> None:
    missing_secret = _adapter("list_issues").execute(
        metadata=_metadata("github.list_issues"),
        input_json={"repo": "acme/repo"},
        config_json=None,
        secret_value=None,
    )
    invalid = _adapter("get_issue").execute(
        metadata=_metadata("github.get_issue"),
        input_json={"repo": "missing-slash", "number": 1},
        config_json=None,
        secret_value="ghp_test",
    )

    assert missing_secret.output_json["error"] == "missing_secret"
    assert invalid.output_json["error"] == "invalid_input"


def test_github_execute_rejects_dot_path_segments_for_every_repo_operation() -> None:
    for method in (
        "list_issues",
        "get_issue",
        "list_pulls",
        "get_pull",
        "create_issue_comment",
        "create_issue",
        "create_pull_review",
    ):
        invalid = _adapter(method).execute(
            metadata=_metadata(f"github.{method}"),
            input_json={
                "repo": "acme/..",
                "number": 1,
                "body": "body",
                "title": "title",
                "event": "COMMENT",
                "idempotency_key": "key",
            },
            config_json=None,
            secret_value="ghp_test",
        )
        assert invalid.output_json["error"] == "invalid_input", method


def test_github_create_issue_comment_posts_with_required_idempotency_key(monkeypatch) -> None:
    fake = FakeGitHubClient(
        [
            httpx.Response(
                201,
                json={
                    "id": 99,
                    "html_url": "https://github.test/acme/repo/issues/7#comment-99",
                    "user": {"login": "bot"},
                    "created_at": "2026-05-29T00:00:00Z",
                    "body": "posted",
                },
            )
        ]
    )
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *args, **kwargs: fake)

    result = _adapter("create_issue_comment").execute(
        metadata=_metadata("github.create_issue_comment"),
        input_json={
            "repo": "acme/repo",
            "number": 7,
            "body": "posted",
            "idempotency_key": "comment-7",
        },
        config_json=None,
        secret_value="ghp_test",
    )

    assert fake.calls[0]["url"] == "https://api.github.com/repos/acme/repo/issues/7/comments"
    assert fake.calls[0]["json"] == {"body": "posted"}
    assert result.output_json["comment"]["id"] == 99
    assert result.output_json["tool"] == "github.create_issue_comment"


def test_github_create_issue_builds_bounded_payload(monkeypatch) -> None:
    fake = FakeGitHubClient([httpx.Response(201, json={"number": 10, "title": "Created"})])
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *args, **kwargs: fake)

    result = _adapter("create_issue").execute(
        metadata=_metadata("github.create_issue"),
        input_json={
            "repo": "acme/repo",
            "title": "T" * 300,
            "body": "B" * 70000,
            "labels": [f"label-{index}" for index in range(25)],
            "assignees": [f"user-{index}" for index in range(25)],
            "idempotency_key": "issue-10",
        },
        config_json=None,
        secret_value="ghp_test",
    )

    payload = fake.calls[0]["json"]
    assert len(payload["title"]) == 256
    assert len(payload["body"]) == 65536
    assert len(payload["labels"]) == len(payload["assignees"]) == 20
    assert result.output_json["issue"]["number"] == 10


def test_github_create_pull_review_normalizes_event_and_body(monkeypatch) -> None:
    fake = FakeGitHubClient(
        [httpx.Response(200, json={"id": 8, "state": "APPROVED", "user": {"login": "reviewer"}})]
    )
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *args, **kwargs: fake)

    result = _adapter("create_pull_review").execute(
        metadata=_metadata("github.create_pull_review"),
        input_json={
            "repo": "acme/repo",
            "number": 8,
            "event": "approve",
            "body": "Looks good",
            "idempotency_key": "review-8",
        },
        config_json=None,
        secret_value="ghp_test",
    )

    assert fake.calls[0]["json"] == {"event": "APPROVE", "body": "Looks good"}
    assert result.output_json["review"]["state"] == "APPROVED"
    assert result.output_json["review"]["author"] == "reviewer"


def test_github_execute_reports_unsupported_method() -> None:
    result = _adapter("unknown").execute(
        metadata=_metadata("github.list_issues"),
        input_json={},
        config_json=None,
        secret_value="ghp_test",
    )

    assert result.output_json == {"error": "unsupported_method", "message": "unknown"}


def test_github_health_check_reports_success_and_api_error(monkeypatch) -> None:
    success = FakeGitHubClient(
        [httpx.Response(200, json={"resources": {"core": {"remaining": 42, "limit": 60}}})]
    )
    monkeypatch.setattr("app.tools.adapters.github_adapter.httpx.Client", lambda *a, **k: success)
    healthy = _adapter("list_issues").health_check(
        config_json={"runtime": {"endpoint_url": "https://github.test"}},
        secret_value="ghp_test",
    )

    failed_client = FakeGitHubClient([httpx.Response(500, json={"message": "down"})])
    monkeypatch.setattr(
        "app.tools.adapters.github_adapter.httpx.Client", lambda *a, **k: failed_client
    )
    failed = _adapter("list_issues").health_check(config_json=None, secret_value="ghp_test")

    assert healthy["ok"] is True
    assert healthy["sample"] == {"rate_remaining": 42, "rate_limit": 60}
    assert failed["ok"] is False
    assert failed["message"] == "down"


def test_github_health_check_reports_transport_and_invalid_json(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.tools.adapters.github_adapter.httpx.Client",
        lambda *a, **k: RaisingGitHubClient(httpx.ConnectError("offline")),
    )
    transport = _adapter("list_issues").health_check(config_json=None, secret_value="ghp_test")

    malformed = FakeGitHubClient([httpx.Response(200, content=b"not-json")])
    monkeypatch.setattr("app.tools.adapters.github_adapter.httpx.Client", lambda *a, **k: malformed)
    invalid_json = _adapter("list_issues").health_check(config_json=None, secret_value="ghp_test")

    assert transport["ok"] is False
    assert "offline" in transport["message"]
    assert invalid_json["ok"] is False
    assert "Invalid JSON" in invalid_json["message"]


def test_github_health_check_requires_secret() -> None:
    result = _adapter("list_issues").health_check(config_json=None, secret_value=" ")

    assert result == {
        "ok": False,
        "latency_ms": 0,
        "message": "GitHub token is not configured",
        "sample": {},
    }


def test_github_client_uses_configured_timeout_and_security_headers(monkeypatch) -> None:
    seen: dict[str, object] = {}

    class CapturingClient:
        def __init__(self, **kwargs) -> None:
            seen.update(kwargs)

    monkeypatch.setattr(github_adapter.httpx, "Client", CapturingClient)
    github_adapter._client(
        "https://github.test", "ghp_test", {"runtime": {"timeout_seconds": 7}}
    )

    assert seen["timeout"] == 7.0
    assert seen["headers"] == {
        "Authorization": "Bearer ghp_test",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "AgentHarness/0.1",
    }


def test_github_request_errors_are_structured_and_writes_are_not_retried(monkeypatch) -> None:
    timeout_client = RaisingGitHubClient(httpx.ReadTimeout("slow"))
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *a, **k: timeout_client)
    read_timeout = _adapter("list_issues").execute(
        metadata=_metadata("github.list_issues"),
        input_json={"repo": "acme/repo"},
        config_json=None,
        secret_value="ghp_test",
    )
    write_timeout = _adapter("create_issue").execute(
        metadata=_metadata("github.create_issue"),
        input_json={"repo": "acme/repo", "title": "title", "idempotency_key": "key"},
        config_json=None,
        secret_value="ghp_test",
    )

    assert read_timeout.output_json["error"] == "timeout"
    assert write_timeout.output_json["error"] == "timeout"
    assert timeout_client.calls == 2


def test_github_request_errors_include_transport_failures(monkeypatch) -> None:
    error_client = RaisingGitHubClient(httpx.ConnectError("offline"))
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *a, **k: error_client)

    read_error = _adapter("list_issues").execute(
        metadata=_metadata("github.list_issues"),
        input_json={"repo": "acme/repo"},
        config_json=None,
        secret_value="ghp_test",
    )
    write_error = _adapter("create_issue").execute(
        metadata=_metadata("github.create_issue"),
        input_json={"repo": "acme/repo", "title": "title", "idempotency_key": "key"},
        config_json=None,
        secret_value="ghp_test",
    )

    assert read_error.output_json == {"error": "github_request_error", "message": "offline"}
    assert write_error.output_json == {"error": "github_request_error", "message": "offline"}


def test_github_request_passes_runtime_timeout_to_client(monkeypatch) -> None:
    fake = FakeGitHubClient([httpx.Response(200, json=[])])
    seen: dict[str, object] = {}

    def client_factory(endpoint, token, config_json=None):
        seen["endpoint"] = endpoint
        seen["token"] = token
        seen["config_json"] = config_json
        return fake

    monkeypatch.setattr(github_adapter, "_client", client_factory)
    _adapter("list_issues").execute(
        metadata=_metadata("github.list_issues"),
        input_json={"repo": "acme/repo"},
        config_json={"runtime": {"timeout_seconds": 3}},
        secret_value="ghp_test",
    )

    assert seen["config_json"] == {"runtime": {"timeout_seconds": 3}}


def test_github_malformed_json_and_generic_errors_are_structured(monkeypatch) -> None:
    malformed = FakeGitHubClient([httpx.Response(200, content=b"not-json")])
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *a, **k: malformed)
    invalid_json = _adapter("list_pulls").execute(
        metadata=_metadata("github.list_pulls"),
        input_json={"repo": "acme/repo"},
        config_json=None,
        secret_value="ghp_test",
    )

    generic = FakeGitHubClient([httpx.Response(404, text="not found")])
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *a, **k: generic)
    not_found = _adapter("list_issues").execute(
        metadata=_metadata("github.list_issues"),
        input_json={"repo": "acme/repo"},
        config_json=None,
        secret_value="ghp_test",
    )

    assert invalid_json.output_json == {
        "error": "github_api_error",
        "status": 200,
        "message": "Invalid JSON",
    }
    assert not_found.output_json == {
        "error": "github_api_error",
        "status": 404,
        "message": "not found",
    }

    quota_remaining = FakeGitHubClient(
        [
            httpx.Response(
                403,
                json={"message": "forbidden"},
                headers={"x-ratelimit-remaining": "1"},
            )
        ]
    )
    monkeypatch.setattr(
        "app.tools.adapters.github_adapter._client", lambda *a, **k: quota_remaining
    )
    forbidden = _adapter("list_issues").execute(
        metadata=_metadata("github.list_issues"),
        input_json={"repo": "acme/repo"},
        config_json=None,
        secret_value="ghp_test",
    )
    assert forbidden.output_json == {
        "error": "github_api_error",
        "status": 403,
        "message": "forbidden",
    }

    no_message = FakeGitHubClient([httpx.Response(403, json={})])
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *a, **k: no_message)
    no_message_result = _adapter("list_issues").execute(
        metadata=_metadata("github.list_issues"),
        input_json={"repo": "acme/repo"},
        config_json=None,
        secret_value="ghp_test",
    )
    assert no_message_result.output_json == {
        "error": "github_api_error",
        "status": 403,
        "message": "{}",
    }


def test_github_write_http_and_json_errors_are_structured(monkeypatch) -> None:
    rate_limited = FakeGitHubClient(
        [
            httpx.Response(
                403,
                json={"message": "rate limit"},
                headers={"x-ratelimit-remaining": "0", "x-ratelimit-reset": "123"},
            )
        ]
    )
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *a, **k: rate_limited)
    rate_result = _adapter("create_issue").execute(
        metadata=_metadata("github.create_issue"),
        input_json={"repo": "acme/repo", "title": "title", "idempotency_key": "key"},
        config_json=None,
        secret_value="ghp_test",
    )

    malformed = FakeGitHubClient([httpx.Response(201, content=b"not-json")])
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *a, **k: malformed)
    json_result = _adapter("create_issue_comment").execute(
        metadata=_metadata("github.create_issue_comment"),
        input_json={
            "repo": "acme/repo",
            "number": 1,
            "body": "comment",
            "idempotency_key": "key",
        },
        config_json=None,
        secret_value="ghp_test",
    )

    assert rate_result.output_json["error"] == "rate_limited"
    assert json_result.output_json == {
        "error": "github_api_error",
        "status": 201,
        "message": "Invalid JSON",
    }

    review_error = FakeGitHubClient([httpx.Response(422, json={"message": "review rejected"})])
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *a, **k: review_error)
    review_result = _adapter("create_pull_review").execute(
        metadata=_metadata("github.create_pull_review"),
        input_json={
            "repo": "acme/repo",
            "number": 1,
            "event": "COMMENT",
            "idempotency_key": "review-1",
        },
        config_json=None,
        secret_value="ghp_test",
    )
    assert review_result.output_json["message"] == "review rejected"


def test_github_get_issue_and_pull_propagate_secondary_request_errors(monkeypatch) -> None:
    issue_fake = FakeGitHubClient(
        [
            httpx.Response(200, json={"number": 1}),
            httpx.Response(404, json={"message": "comments unavailable"}),
        ]
    )
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *a, **k: issue_fake)
    issue_result = _adapter("get_issue").execute(
        metadata=_metadata("github.get_issue"),
        input_json={"repo": "acme/repo", "number": 1, "include_comments": True},
        config_json=None,
        secret_value="ghp_test",
    )

    pull_fake = FakeGitHubClient(
        [
            httpx.Response(200, json={"number": 1}),
            httpx.Response(500, json={"message": "files unavailable"}),
        ]
    )
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *a, **k: pull_fake)
    pull_result = _adapter("get_pull").execute(
        metadata=_metadata("github.get_pull"),
        input_json={"repo": "acme/repo", "number": 1},
        config_json=None,
        secret_value="ghp_test",
    )

    assert issue_result.output_json["message"] == "comments unavailable"
    assert pull_result.output_json["message"] == "files unavailable"

    initial_issue = FakeGitHubClient([httpx.Response(404, json={"message": "issue missing"})])
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *a, **k: initial_issue)
    initial_result = _adapter("get_issue").execute(
        metadata=_metadata("github.get_issue"),
        input_json={"repo": "acme/repo", "number": 1},
        config_json=None,
        secret_value="ghp_test",
    )
    assert initial_result.output_json["message"] == "issue missing"


def test_github_get_pull_propagates_pull_request_error(monkeypatch) -> None:
    fake = FakeGitHubClient([httpx.Response(404, json={"message": "pull missing"})])
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *a, **k: fake)

    result = _adapter("get_pull").execute(
        metadata=_metadata("github.get_pull"),
        input_json={"repo": "acme/repo", "number": 1},
        config_json=None,
        secret_value="ghp_test",
    )

    assert result.output_json["message"] == "pull missing"


def test_github_search_code_propagates_error_and_skips_malformed_items(monkeypatch) -> None:
    malformed = FakeGitHubClient(
        [
            httpx.Response(
                200,
                json={"items": [None, {"path": "fallback.py", "repository": "wrong-shape"}]},
            )
        ]
    )
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *a, **k: malformed)
    result = _adapter("search_code").execute(
        metadata=_metadata("github.search_code"),
        input_json={"query": "needle"},
        config_json=None,
        secret_value="ghp_test",
    )

    assert result.output_json["items"] == [
        {"repo": None, "path": "fallback.py", "html_url": None, "snippet": "fallback.py"}
    ]

    error = FakeGitHubClient([httpx.Response(422, json={"message": "search unavailable"})])
    monkeypatch.setattr("app.tools.adapters.github_adapter._client", lambda *a, **k: error)
    error_result = _adapter("search_code").execute(
        metadata=_metadata("github.search_code"),
        input_json={"query": "needle"},
        config_json=None,
        secret_value="ghp_test",
    )
    assert error_result.output_json["message"] == "search unavailable"


def test_github_registers_all_read_and_write_adapters() -> None:
    registry = AdapterRegistry()
    github_adapter.register_github_adapters(registry)

    assert [adapter.slug for adapter in registry.list_all()] == [
        "github.create_issue",
        "github.create_issue_comment",
        "github.create_pull_review",
        "github.get_issue",
        "github.get_pull",
        "github.list_issues",
        "github.list_pulls",
        "github.search_code",
    ]
    assert registry.get("github.create_pull_review").risk_level == "high"


def test_github_helper_bounds_and_repo_encoding() -> None:
    assert github_adapter._endpoint_url({"runtime": {"endpoint_url": " https://gh.test/ "}}) == "https://gh.test"
    assert github_adapter._endpoint_url({}) == github_adapter.DEFAULT_GITHUB_API
    assert github_adapter._timeout({"runtime": {"timeout_seconds": 0}}) == 1.0
    assert github_adapter._timeout({"runtime": {"timeout_seconds": 100}}) == 30.0
    assert github_adapter._timeout({"runtime": {"timeout_seconds": "bad"}}) == 15
    assert github_adapter._limit(0) == 1
    assert github_adapter._limit(1000) == 100
    assert github_adapter._limit("bad") == 20
    assert github_adapter._positive_int("3") == 3
    assert github_adapter._positive_int(0) is None
    assert github_adapter._positive_int("bad") is None
    assert github_adapter._string_list([" one ", "", 2]) == ["one", "2"]
    assert github_adapter._string_list("one") == []
    assert github_adapter.encode_repo_path("acme/repo name") == "acme/repo%20name"


def test_github_write_adapter_risk_is_high() -> None:
    registry_metadata = ToolRegistry.default().tools["github.create_issue"]
    assert registry_metadata.risk_level == "high"
    assert registry_metadata.idempotent is False
