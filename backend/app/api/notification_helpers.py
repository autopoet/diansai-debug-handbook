from app.models.article_revision import ArticleRevision
from app.models.comment import Comment, CommentThread
from app.models.notification import Notification
from app.models.user import User


def notify_reviewers(revision: ArticleRevision) -> None:
    reviewers = User.select().where(User.role.in_(("admin", "reviewer")))
    for reviewer in reviewers:
        Notification.get_or_create(
            dedupe_key=f"review-pending:{revision.id}:{reviewer.id}",
            defaults={
                "recipient": reviewer,
                "actor": revision.author,
                "revision": revision,
                "kind": "review_pending",
            },
        )


def remove_pending_review_notifications(revision: ArticleRevision) -> None:
    (
        Notification.delete()
        .where((Notification.revision == revision) & (Notification.kind == "review_pending"))
        .execute()
    )


def notify_submission_result(
    revision: ArticleRevision,
    reviewer: User,
    outcome: str,
) -> None:
    Notification.get_or_create(
        dedupe_key=f"submission-result:{revision.id}:{outcome}",
        defaults={
            "recipient": revision.author,
            "actor": reviewer,
            "revision": revision,
            "kind": "submission_result",
            "outcome": outcome,
        },
    )


def notify_comment_participants(
    thread: CommentThread,
    reply: Comment,
    actor: User,
) -> None:
    recipient_ids = {
        thread.author_id,
        *Comment.select(Comment.author_id).where(Comment.thread == thread).tuples().iterator(),
    }
    normalized_ids = {value[0] if isinstance(value, tuple) else value for value in recipient_ids}
    for recipient_id in normalized_ids - {actor.id}:
        Notification.get_or_create(
            dedupe_key=f"comment-reply:{reply.id}:{recipient_id}",
            defaults={
                "recipient": recipient_id,
                "actor": actor,
                "comment_thread": thread,
                "kind": "comment_reply",
            },
        )
