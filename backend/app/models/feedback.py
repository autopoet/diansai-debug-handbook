from datetime import datetime

from peewee import CharField, DateTimeField, ForeignKeyField

from app.models.article_revision import ArticleRevision
from app.models.base import BaseModel
from app.models.user import User


class ArticleFeedback(BaseModel):
    user = ForeignKeyField(User, backref="article_feedback", on_delete="CASCADE")
    revision = ForeignKeyField(
        ArticleRevision,
        backref="feedback",
        on_delete="CASCADE",
    )
    vote = CharField(max_length=16)
    created_at = DateTimeField(default=datetime.now)
    updated_at = DateTimeField(default=datetime.now)

    class Meta:
        table_name = "article_feedback"
        indexes = ((("user", "revision"), True),)
