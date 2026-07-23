from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import get_current_user
from app.db.database import database_connection
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationItem, NotificationList, UnreadCount

router = APIRouter(
    prefix="/notifications",
    dependencies=[Depends(database_connection)],
)


def serialize_notification(notification: Notification) -> NotificationItem:
    actor = User.get_or_none(User.id == notification.actor_id) if notification.actor_id else None
    revision = notification.revision if notification.revision_id else None
    thread = notification.comment_thread if notification.comment_thread_id else None

    if notification.kind == "review_pending":
        title = "有新内容等待审核"
        message = f"{actor.username if actor else '用户'}提交了《{revision.title}》"
        target_path = f"/reviews#revision-{revision.id}"
    elif notification.kind == "submission_result":
        approved = notification.outcome == "approved"
        title = "投稿已通过" if approved else "投稿被驳回"
        message = f"《{revision.title}》已通过审核" if approved else f"《{revision.title}》需要修改"
        target_path = f"/submissions#revision-{revision.id}"
    else:
        title = "评论收到回复"
        message = f"{actor.username if actor else '用户'}回复了你的评论"
        target_path = f"/articles/{thread.symptom_id}?thread={thread.id}"

    return NotificationItem(
        id=notification.id,
        kind=notification.kind,
        outcome=notification.outcome,
        is_read=notification.is_read,
        actor_id=notification.actor_id,
        actor_name=actor.username if actor else None,
        revision_id=notification.revision_id,
        symptom_id=(
            revision.symptom_id
            if revision is not None
            else thread.symptom_id
            if thread is not None
            else None
        ),
        thread_id=notification.comment_thread_id,
        title=title,
        message=message,
        target_path=target_path,
        created_at=notification.created_at,
        read_at=notification.read_at,
    )


@router.get("", response_model=NotificationList)
def list_notifications(
    current_user: Annotated[User, Depends(get_current_user)],
    unread_only: Annotated[bool, Query()] = False,
) -> NotificationList:
    query = Notification.select().where(Notification.recipient == current_user)
    unread = query.where(Notification.is_read == False).count()  # noqa: E712
    if unread_only:
        query = query.where(Notification.is_read == False)  # noqa: E712
    notifications = list(query.order_by(Notification.created_at.desc()).limit(100))
    return NotificationList(
        items=[serialize_notification(item) for item in notifications],
        total=len(notifications),
        unread=unread,
    )


@router.get("/unread-count", response_model=UnreadCount)
def get_unread_count(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UnreadCount:
    count = (
        Notification.select()
        .where(
            (Notification.recipient == current_user) & (Notification.is_read == False)  # noqa: E712
        )
        .count()
    )
    return UnreadCount(count=count)


@router.post("/{notification_id}/read", response_model=NotificationItem)
def mark_notification_read(
    notification_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
) -> NotificationItem:
    notification = Notification.get_or_none(
        (Notification.id == notification_id) & (Notification.recipient == current_user)
    )
    if notification is None:
        raise HTTPException(status_code=404, detail="通知不存在")
    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.now()
        notification.save(only=[Notification.is_read, Notification.read_at])
    return serialize_notification(notification)


@router.post("/read-all", response_model=UnreadCount)
def mark_all_notifications_read(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UnreadCount:
    now = datetime.now()
    (
        Notification.update(is_read=True, read_at=now)
        .where(
            (Notification.recipient == current_user) & (Notification.is_read == False)  # noqa: E712
        )
        .execute()
    )
    return UnreadCount(count=0)
