from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class NotificationItem(BaseModel):
    id: int
    kind: Literal["review_pending", "submission_result", "comment_reply"]
    outcome: Literal["", "approved", "rejected"]
    is_read: bool
    actor_id: int | None
    actor_name: str | None
    revision_id: int | None
    symptom_id: int | None
    thread_id: int | None
    title: str
    message: str
    target_path: str
    created_at: datetime
    read_at: datetime | None


class NotificationList(BaseModel):
    items: list[NotificationItem]
    total: int
    unread: int


class UnreadCount(BaseModel):
    count: int
