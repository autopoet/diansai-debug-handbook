from datetime import datetime

from peewee import BooleanField, CharField, DateTimeField, ForeignKeyField

from app.models.article_revision import ArticleRevision
from app.models.base import BaseModel
from app.models.comment import CommentThread
from app.models.user import User


class Notification(BaseModel):
    recipient = ForeignKeyField(User, backref="notifications", on_delete="CASCADE")
    actor = ForeignKeyField(
        User,
        backref="triggered_notifications",
        null=True,
        on_delete="SET NULL",
    )
    revision = ForeignKeyField(
        ArticleRevision,
        backref="notifications",
        null=True,
        on_delete="CASCADE",
    )
    comment_thread = ForeignKeyField(
        CommentThread,
        backref="notifications",
        null=True,
        on_delete="CASCADE",
    )
    kind = CharField(max_length=24, index=True)
    outcome = CharField(max_length=16, default="")
    dedupe_key = CharField(max_length=100, unique=True)
    is_read = BooleanField(default=False, index=True)
    created_at = DateTimeField(default=datetime.now, index=True)
    read_at = DateTimeField(null=True)

    class Meta:
        table_name = "notifications"
