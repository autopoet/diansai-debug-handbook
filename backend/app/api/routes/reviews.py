from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from peewee import PostgresqlDatabase

from app.api.dependencies import get_reviewer
from app.api.notification_helpers import (
    notify_submission_result,
    remove_pending_review_notifications,
)
from app.api.routes.articles import get_locked_symptom_or_404, serialize_revision
from app.api.routes.comments import relocate_comment_threads
from app.db.database import database, database_connection
from app.models.article_revision import ArticleRevision
from app.models.symptom import Symptom
from app.models.user import User
from app.schemas.article import (
    ArticleRevisionItem,
    ReviewDecision,
    ReviewQueueItem,
    ReviewQueueResponse,
)

router = APIRouter(
    prefix="/reviews",
    dependencies=[Depends(database_connection)],
)


def get_locked_revision(revision_id: int) -> ArticleRevision:
    query = ArticleRevision.select().where(ArticleRevision.id == revision_id)
    if isinstance(database, PostgresqlDatabase):
        query = query.for_update()
    revision = query.first()
    if revision is None:
        raise HTTPException(status_code=404, detail="待审核版本不存在")
    if revision.status != "pending":
        raise HTTPException(status_code=409, detail="该版本已被其他审核员处理")
    return revision


def serialize_review_item(revision: ArticleRevision) -> ReviewQueueItem:
    base_revision = (
        ArticleRevision.select(ArticleRevision, User)
        .join(User, on=(ArticleRevision.author == User.id))
        .where(ArticleRevision.id == revision.base_revision_id)
        .first()
        if revision.base_revision_id
        else None
    )
    return ReviewQueueItem(
        revision=serialize_revision(revision),
        base_revision=serialize_revision(base_revision) if base_revision else None,
    )


@router.get("", response_model=ReviewQueueResponse)
def list_pending_reviews(
    _: Annotated[User, Depends(get_reviewer)],
) -> ReviewQueueResponse:
    revisions = (
        ArticleRevision.select(ArticleRevision, User)
        .join(User, on=(ArticleRevision.author == User.id))
        .where(ArticleRevision.status == "pending")
        .order_by(ArticleRevision.submitted_at, ArticleRevision.id)
    )
    items = [serialize_review_item(revision) for revision in revisions]
    return ReviewQueueResponse(items=items, total=len(items))


@router.post("/{revision_id}/approve", response_model=ArticleRevisionItem)
def approve_revision(
    revision_id: int,
    payload: ReviewDecision,
    reviewer: Annotated[User, Depends(get_reviewer)],
) -> ArticleRevisionItem:
    candidate = ArticleRevision.get_or_none(ArticleRevision.id == revision_id)
    if candidate is None:
        raise HTTPException(status_code=404, detail="待审核版本不存在")

    with database.atomic():
        get_locked_symptom_or_404(candidate.symptom_id)
        revision = get_locked_revision(revision_id)
        current_revision_id = (
            ArticleRevision.select(ArticleRevision.id)
            .where(
                (ArticleRevision.symptom == revision.symptom_id)
                & (ArticleRevision.status == "approved")
            )
            .order_by(ArticleRevision.published_at.desc(), ArticleRevision.id.desc())
            .scalar()
        )
        if revision.base_revision_id != current_revision_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="公开版本已变化，不能再批准这个旧提交",
            )

        now = datetime.now()
        (
            ArticleRevision.update(status="superseded")
            .where(
                (ArticleRevision.symptom == revision.symptom_id)
                & (ArticleRevision.status == "approved")
            )
            .execute()
        )
        revision.status = "approved"
        revision.reviewer = reviewer
        revision.review_note = payload.note
        revision.reviewed_at = now
        revision.published_at = now
        revision.updated_at = now
        revision.save()
        Symptom.update(is_published=True).where(Symptom.id == revision.symptom_id).execute()
        relocate_comment_threads(revision.symptom_id, revision)
        remove_pending_review_notifications(revision)
        notify_submission_result(revision, reviewer, "approved")

    revision.author = User.get_by_id(revision.author_id)
    revision.reviewer = reviewer
    return serialize_revision(revision)


@router.post("/{revision_id}/reject", response_model=ArticleRevisionItem)
def reject_revision(
    revision_id: int,
    payload: ReviewDecision,
    reviewer: Annotated[User, Depends(get_reviewer)],
) -> ArticleRevisionItem:
    if not payload.note:
        raise HTTPException(status_code=422, detail="驳回时必须填写原因")

    with database.atomic():
        revision = get_locked_revision(revision_id)
        now = datetime.now()
        revision.status = "rejected"
        revision.reviewer = reviewer
        revision.review_note = payload.note
        revision.reviewed_at = now
        revision.updated_at = now
        revision.save()
        remove_pending_review_notifications(revision)
        notify_submission_result(revision, reviewer, "rejected")

    revision.author = User.get_by_id(revision.author_id)
    revision.reviewer = reviewer
    return serialize_revision(revision)
