import json
from datetime import datetime

from peewee import CharField, DateTimeField, ForeignKeyField, TextField

from app.models.base import BaseModel
from app.models.user import User


class ReviewerApplication(BaseModel):
    user = ForeignKeyField(
        User,
        backref="reviewer_application",
        unique=True,
        on_delete="CASCADE",
    )
    statement = TextField()
    status = CharField(max_length=16, default="pending", index=True)
    reviewed_by = ForeignKeyField(
        User,
        backref="reviewed_reviewer_applications",
        null=True,
        on_delete="SET NULL",
    )
    review_note = TextField(default="")
    created_at = DateTimeField(default=datetime.now)
    updated_at = DateTimeField(default=datetime.now)
    reviewed_at = DateTimeField(null=True)

    class Meta:
        table_name = "reviewer_applications"


class AuditLog(BaseModel):
    actor = ForeignKeyField(User, backref="audit_logs", null=True, on_delete="SET NULL")
    action = CharField(max_length=48, index=True)
    target_type = CharField(max_length=32)
    target_id = CharField(max_length=64)
    details_json = TextField(default="{}")
    created_at = DateTimeField(default=datetime.now, index=True)

    class Meta:
        table_name = "audit_logs"

    @classmethod
    def record(
        cls,
        *,
        actor: User,
        action: str,
        target_type: str,
        target_id: int | str,
        details: dict | None = None,
    ) -> "AuditLog":
        return cls.create(
            actor=actor,
            action=action,
            target_type=target_type,
            target_id=str(target_id),
            details_json=json.dumps(details or {}, ensure_ascii=False),
        )
