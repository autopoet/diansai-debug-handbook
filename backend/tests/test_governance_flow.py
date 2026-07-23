import json

from fastapi.testclient import TestClient

from app.main import app

ARTICLE = {
    "name": "治理功能测试条目",
    "description": "用于验证首批内容、通知和回滚",
}
BODY = json.dumps(
    {
        "type": "doc",
        "content": [
            {
                "type": "heading",
                "attrs": {"level": 2},
                "content": [{"type": "text", "text": "测量条件"}],
            },
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "测量输入电压并记录结果。"}],
            },
        ],
    },
    ensure_ascii=False,
)


def register(client: TestClient, username: str) -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": "password123"},
    )
    assert response.status_code == 201
    return response.json()


def login(client: TestClient, username: str) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": "password123"},
    )
    assert response.status_code == 200


def logout(client: TestClient) -> None:
    assert client.post("/api/v1/auth/logout").status_code == 204


def draft_payload(summary: str, edit_summary: str = "补充排查内容") -> dict:
    return {
        "title": ARTICLE["name"],
        "summary": summary,
        "applicability": "适用于低压直流电路。",
        "safety": "重新接线前断电。",
        "checklist": ["确认供电", "测量输入电压"],
        "body": BODY,
        "edit_summary": edit_summary,
    }


def create_saved_article(
    client: TestClient,
    summary: str = "已经完成第一版内容",
) -> tuple[int, dict]:
    created = client.post("/api/v1/articles", json=ARTICLE)
    assert created.status_code == 201
    symptom_id = created.json()["symptom"]["id"]
    saved = client.put(
        f"/api/v1/articles/{symptom_id}/draft",
        json=draft_payload(summary),
    )
    assert saved.status_code == 200
    return symptom_id, saved.json()


def test_reviewer_application_is_admin_controlled() -> None:
    with TestClient(app) as client:
        admin = register(client, "admin")
        assert admin["role"] == "admin"
        logout(client)

        contributor = register(client, "applicant")
        assert contributor["role"] == "contributor"
        application = client.post(
            "/api/v1/reviewer-applications",
            json={"statement": "熟悉电源与单片机排障，愿意核对测量条件和修复验证。"},
        )
        assert application.status_code == 201
        assert application.json()["status"] == "pending"
        assert (
            client.post(
                f"/api/v1/admin/reviewer-applications/{application.json()['id']}/approve",
                json={"note": ""},
            ).status_code
            == 403
        )
        assert (
            client.post(
                "/api/v1/reviewer-applications",
                json={"statement": "重复提交的审核权申请不应创建第二条记录。"},
            ).status_code
            == 409
        )

        logout(client)
        login(client, "admin")
        pending = client.get("/api/v1/admin/reviewer-applications")
        assert pending.status_code == 200
        assert pending.json()["total"] == 1
        approved = client.post(
            f"/api/v1/admin/reviewer-applications/{application.json()['id']}/approve",
            json={"note": "同意参与审核"},
        )
        assert approved.status_code == 200
        assert approved.json()["status"] == "approved"

        logout(client)
        login(client, "applicant")
        assert client.get("/api/v1/auth/me").json()["role"] == "reviewer"
        assert client.get("/api/v1/reviews").status_code == 200


def test_official_seed_feedback_unpublish_and_traceable_rollback() -> None:
    with TestClient(app) as client:
        register(client, "admin")
        symptom_id, first_draft = create_saved_article(client)

        official = client.post(
            f"/api/v1/admin/revisions/{first_draft['id']}/publish-official",
            json={"note": "首批官方内容"},
        )
        assert official.status_code == 200
        first_revision = official.json()
        assert first_revision["origin"] == "official_seed"
        assert first_revision["author_id"] == first_revision["reviewer_id"]

        voted = client.put(
            f"/api/v1/articles/{symptom_id}/feedback",
            json={"vote": "solved"},
        )
        assert voted.status_code == 200
        assert voted.json()["solved"] == 1

        second_draft = client.put(
            f"/api/v1/articles/{symptom_id}/draft",
            json=draft_payload("已经完成第二版内容", "发布第二版"),
        ).json()
        assert client.post(f"/api/v1/articles/{symptom_id}/submit").status_code == 200
        second = client.post(
            f"/api/v1/reviews/{second_draft['id']}/approve",
            json={"note": "自审发布"},
        )
        assert second.status_code == 200
        assert second.json()["version_number"] == 2

        taken_down = client.post(
            f"/api/v1/admin/articles/{symptom_id}/unpublish",
            json={"reason": "发现可能误导的排查步骤"},
        )
        assert taken_down.status_code == 200
        assert client.get(f"/api/v1/articles/{symptom_id}").status_code == 404

        rollback = client.post(
            f"/api/v1/admin/articles/{symptom_id}/rollback/{first_revision['id']}",
            json={"reason": "恢复已经验证的首版"},
        )
        assert rollback.status_code == 200
        rolled_back = rollback.json()
        assert rolled_back["origin"] == "rollback"
        assert rolled_back["source_revision_id"] == first_revision["id"]
        assert rolled_back["version_number"] == 3
        assert client.get(f"/api/v1/articles/{symptom_id}").status_code == 200
        assert client.get(f"/api/v1/articles/{symptom_id}/feedback").json()["solved"] == 0

        audit_items = client.get("/api/v1/admin/audit-logs").json()["items"]
        actions = {item["action"] for item in audit_items}
        assert {
            "official_seed_published",
            "article_unpublished",
            "article_rolled_back",
        } <= actions
        unpublish_log = next(
            item for item in audit_items if item["action"] == "article_unpublished"
        )
        assert unpublish_log["details"]["current_revision_id"] == second_draft["id"]


def test_pending_revision_can_be_withdrawn_and_new_draft_deleted() -> None:
    with TestClient(app) as client:
        register(client, "admin")
        symptom_id, draft = create_saved_article(client)
        submitted = client.post(f"/api/v1/articles/{symptom_id}/submit")
        assert submitted.status_code == 200

        withdrawn = client.post(f"/api/v1/articles/{symptom_id}/withdraw")
        assert withdrawn.status_code == 200
        editable = withdrawn.json()
        assert editable["status"] == "draft"
        assert editable["origin"] == "withdrawal"
        assert editable["source_revision_id"] == draft["id"]

        revisions = client.get("/api/v1/articles/mine").json()["items"]
        assert {item["status"] for item in revisions} == {"withdrawn", "draft"}
        assert client.delete(f"/api/v1/articles/{symptom_id}/draft").status_code == 204
        assert client.get(f"/api/v1/articles/{symptom_id}/draft").status_code == 404


def test_review_and_comment_notifications_are_deduplicated_and_readable() -> None:
    with TestClient(app) as client:
        register(client, "admin")
        logout(client)
        register(client, "author")
        symptom_id, draft = create_saved_article(client)
        assert client.post(f"/api/v1/articles/{symptom_id}/submit").status_code == 200

        logout(client)
        login(client, "admin")
        review_notice = client.get("/api/v1/notifications").json()
        assert review_notice["unread"] == 1
        assert review_notice["items"][0]["kind"] == "review_pending"
        assert review_notice["items"][0]["target_path"] == (f"/reviews#revision-{draft['id']}")
        assert (
            client.post(
                f"/api/v1/reviews/{draft['id']}/approve",
                json={"note": "可以发布"},
            ).status_code
            == 200
        )
        assert client.get("/api/v1/notifications/unread-count").json()["count"] == 0

        logout(client)
        login(client, "author")
        result_notice = client.get("/api/v1/notifications").json()
        assert result_notice["unread"] == 1
        assert result_notice["items"][0]["kind"] == "submission_result"
        assert result_notice["items"][0]["target_path"] == (f"/submissions#revision-{draft['id']}")
        assert client.post("/api/v1/notifications/read-all").json() == {"count": 0}

        quote = "测量输入电压并记录结果"
        thread = client.post(
            f"/api/v1/articles/{symptom_id}/comments",
            json={
                "revision_id": draft["id"],
                "quote": quote,
                "start_offset": 4,
                "end_offset": 4 + len(quote),
                "body": "这里需要注明万用表量程吗？",
            },
        )
        assert thread.status_code == 201

        logout(client)
        login(client, "admin")
        assert (
            client.post(
                f"/api/v1/comments/{thread.json()['id']}/replies",
                json={"body": "需要，同时记录参考地。"},
            ).status_code
            == 201
        )

        logout(client)
        login(client, "author")
        notices = client.get("/api/v1/notifications").json()["items"]
        comment_notices = [item for item in notices if item["kind"] == "comment_reply"]
        assert len(comment_notices) == 1
        assert comment_notices[0]["target_path"] == (
            f"/articles/{symptom_id}?thread={thread.json()['id']}"
        )
