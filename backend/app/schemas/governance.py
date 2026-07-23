from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.article import ArticleRevisionItem


class ReviewerApplicationCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    statement: str = Field(min_length=10, max_length=1000)


class GovernanceDecision(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    note: str = Field(default="", max_length=1000)


class GovernanceReason(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    reason: str = Field(min_length=3, max_length=1000)


class ReviewerApplicationItem(BaseModel):
    id: int
    user_id: int
    username: str
    statement: str
    status: Literal["pending", "approved", "rejected"]
    reviewed_by_id: int | None
    reviewed_by_name: str | None
    review_note: str
    created_at: datetime
    updated_at: datetime
    reviewed_at: datetime | None


class ReviewerApplicationList(BaseModel):
    items: list[ReviewerApplicationItem]
    total: int


class AdminArticleItem(BaseModel):
    id: int
    name: str
    description: str
    is_published: bool
    is_taken_down: bool


class AdminArticleList(BaseModel):
    items: list[AdminArticleItem]
    total: int


class AdminArticleState(BaseModel):
    id: int
    is_published: bool


class AdminRevisionList(BaseModel):
    items: list[ArticleRevisionItem]
    total: int


class AuditLogItem(BaseModel):
    id: int
    actor_id: int | None
    actor_name: str | None
    action: str
    target_type: str
    target_id: str
    details: dict
    created_at: datetime


class AuditLogList(BaseModel):
    items: list[AuditLogItem]
    total: int
