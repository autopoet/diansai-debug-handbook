import json
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from peewee import PostgresqlDatabase, fn

from app.api.dependencies import get_admin, get_current_user
from app.api.notification_helpers import (
    notify_submission_result,
    remove_pending_review_notifications,
)
from app.api.routes.articles import serialize_revision
from app.api.routes.comments import relocate_comment_threads
from app.db.database import database, database_connection
from app.models.article_revision import ArticleRevision
from app.models.governance import AuditLog, ReviewerApplication
from app.models.symptom import Symptom
from app.models.user import User
from app.schemas.article import ArticleRevisionItem
from app.schemas.governance import (
    AdminArticleItem,
    AdminArticleList,
    AdminArticleState,
    AdminRevisionList,
    AuditLogItem,
    AuditLogList,
    GovernanceDecision,
    GovernanceReason,
    ReviewerApplicationCreate,
    ReviewerApplicationItem,
    ReviewerApplicationList,
)

application_router = APIRouter(
    prefix="/reviewer-applications",
    dependencies=[Depends(database_connection)],
)
admin_router = APIRouter(
    prefix="/admin",
    dependencies=[Depends(database_connection)],
)


def lock_query(query):
    return query.for_update() if isinstance(database, PostgresqlDatabase) else query


def serialize_application(application: ReviewerApplication) -> ReviewerApplicationItem:
    reviewed_by = (
        User.get_or_none(User.id == application.reviewed_by_id)
        if application.reviewed_by_id
        else None
    )
    return ReviewerApplicationItem(
        id=application.id,
        user_id=application.user_id,
        username=application.user.username,
        statement=application.statement,
        status=application.status,
        reviewed_by_id=application.reviewed_by_id,
        reviewed_by_name=reviewed_by.username if reviewed_by else None,
        review_note=application.review_note,
        created_at=application.created_at,
        updated_at=application.updated_at,
        reviewed_at=application.reviewed_at,
    )


@application_router.post(
    "",
    response_model=ReviewerApplicationItem,
    status_code=status.HTTP_201_CREATED,
)
def apply_for_reviewer(
    payload: ReviewerApplicationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
) -> ReviewerApplicationItem:
    if current_user.can_review:
        raise HTTPException(status_code=409, detail="你已经拥有审核权限")

    now = datetime.now()
    with database.atomic():
        application = lock_query(
            ReviewerApplication.select().where(ReviewerApplication.user == current_user)
        ).first()
        if application is not None and application.status == "pending":
            raise HTTPException(status_code=409, detail="已有一份申请等待处理")
        if application is None:
            application = ReviewerApplication.create(
                user=current_user,
                statement=payload.statement,
                created_at=now,
                updated_at=now,
            )
        else:
            application.statement = payload.statement
            application.status = "pending"
            application.reviewed_by = None
            application.review_note = ""
            application.created_at = now
            application.updated_at = now
            application.reviewed_at = None
            application.save()
        AuditLog.record(
            actor=current_user,
            action="reviewer_application_submitted",
            target_type="reviewer_application",
            target_id=application.id,
        )
    application.user = current_user
    return serialize_application(application)


@application_router.get("/me", response_model=ReviewerApplicationItem | None)
def get_my_reviewer_application(
    current_user: Annotated[User, Depends(get_current_user)],
) -> ReviewerApplicationItem | None:
    application = ReviewerApplication.get_or_none(ReviewerApplication.user == current_user)
    if application is None:
        return None
    application.user = current_user
    return serialize_application(application)


@admin_router.get(
    "/reviewer-applications",
    response_model=ReviewerApplicationList,
)
def list_reviewer_applications(
    _: Annotated[User, Depends(get_admin)],
    application_status: Annotated[
        Literal["pending", "approved", "rejected", "all"],
        Query(alias="status"),
    ] = "pending",
) -> ReviewerApplicationList:
    query = (
        ReviewerApplication.select(ReviewerApplication, User)
        .join(User, on=(ReviewerApplication.user == User.id))
        .order_by(ReviewerApplication.updated_at.desc())
    )
    if application_status != "all":
        query = query.where(ReviewerApplication.status == application_status)
    items = [serialize_application(application) for application in query]
    return ReviewerApplicationList(items=items, total=len(items))


def decide_application(
    application_id: int,
    payload: GovernanceDecision,
    admin: User,
    outcome: str,
) -> ReviewerApplicationItem:
    if outcome == "rejected" and not payload.note:
        raise HTTPException(status_code=422, detail="驳回时必须填写原因")

    with database.atomic():
        application = lock_query(
            ReviewerApplication.select().where(ReviewerApplication.id == application_id)
        ).first()
        if application is None:
            raise HTTPException(status_code=404, detail="审核权申请不存在")
        if application.status != "pending":
            raise HTTPException(status_code=409, detail="这份申请已经处理")

        now = datetime.now()
        application.status = outcome
        application.reviewed_by = admin
        application.review_note = payload.note
        application.reviewed_at = now
        application.updated_at = now
        application.save()
        applicant = User.get_by_id(application.user_id)
        if outcome == "approved":
            applicant.role = "reviewer"
            applicant.save(only=[User.role])
        AuditLog.record(
            actor=admin,
            action=f"reviewer_application_{outcome}",
            target_type="reviewer_application",
            target_id=application.id,
            details={"applicant_id": applicant.id, "note": payload.note},
        )
    application.user = applicant
    return serialize_application(application)


@admin_router.post(
    "/reviewer-applications/{application_id}/approve",
    response_model=ReviewerApplicationItem,
)
def approve_reviewer_application(
    application_id: int,
    payload: GovernanceDecision,
    admin: Annotated[User, Depends(get_admin)],
) -> ReviewerApplicationItem:
    return decide_application(application_id, payload, admin, "approved")


@admin_router.post(
    "/reviewer-applications/{application_id}/reject",
    response_model=ReviewerApplicationItem,
)
def reject_reviewer_application(
    application_id: int,
    payload: GovernanceDecision,
    admin: Annotated[User, Depends(get_admin)],
) -> ReviewerApplicationItem:
    return decide_application(application_id, payload, admin, "rejected")


def publish_revision(
    revision: ArticleRevision,
    admin: User,
    *,
    origin: str,
    note: str,
) -> None:
    current_id = (
        ArticleRevision.select(ArticleRevision.id)
        .where(
            (ArticleRevision.symptom == revision.symptom_id)
            & (ArticleRevision.status == "approved")
        )
        .order_by(ArticleRevision.published_at.desc(), ArticleRevision.id.desc())
        .scalar()
    )
    if revision.base_revision_id != current_id:
        raise HTTPException(status_code=409, detail="公开版本已变化，请重新载入")

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
    revision.origin = origin
    revision.reviewer = admin
    revision.review_note = note
    revision.submitted_at = revision.submitted_at or now
    revision.reviewed_at = now
    revision.published_at = now
    revision.updated_at = now
    revision.save()
    Symptom.update(is_published=True).where(Symptom.id == revision.symptom_id).execute()
    relocate_comment_threads(revision.symptom_id, revision)


@admin_router.post(
    "/revisions/{revision_id}/publish-official",
    response_model=ArticleRevisionItem,
)
def publish_official_seed(
    revision_id: int,
    payload: GovernanceDecision,
    admin: Annotated[User, Depends(get_admin)],
) -> ArticleRevisionItem:
    candidate = ArticleRevision.get_or_none(ArticleRevision.id == revision_id)
    if candidate is None:
        raise HTTPException(status_code=404, detail="草稿不存在")

    with database.atomic():
        symptom = lock_query(Symptom.select().where(Symptom.id == candidate.symptom_id)).first()
        revision = lock_query(
            ArticleRevision.select().where(ArticleRevision.id == revision_id)
        ).first()
        if revision is None or symptom is None:
            raise HTTPException(status_code=404, detail="草稿不存在")
        if revision.status != "draft":
            raise HTTPException(status_code=409, detail="只有草稿能作为官方种子发布")
        if revision.author_id != admin.id:
            raise HTTPException(status_code=403, detail="只能发布自己维护的官方种子草稿")
        if (
            symptom.is_published
            or ArticleRevision.select()
            .where(
                (ArticleRevision.symptom == symptom)
                & (ArticleRevision.status.in_(("approved", "superseded")))
            )
            .exists()
        ):
            raise HTTPException(
                status_code=409,
                detail="官方种子入口只用于首次发布",
            )
        publish_revision(
            revision,
            admin,
            origin="official_seed",
            note=payload.note or "维护者发布官方种子内容",
        )
        AuditLog.record(
            actor=admin,
            action="official_seed_published",
            target_type="article_revision",
            target_id=revision.id,
            details={"symptom_id": revision.symptom_id, "note": payload.note},
        )
    revision.author = admin
    revision.reviewer = admin
    return serialize_revision(revision)


@admin_router.post(
    "/articles/{symptom_id}/unpublish",
    response_model=AdminArticleState,
)
def unpublish_article(
    symptom_id: int,
    payload: GovernanceReason,
    admin: Annotated[User, Depends(get_admin)],
) -> AdminArticleState:
    with database.atomic():
        symptom = lock_query(Symptom.select().where(Symptom.id == symptom_id)).first()
        if symptom is None:
            raise HTTPException(status_code=404, detail="文章不存在")
        if not symptom.is_published:
            raise HTTPException(status_code=409, detail="文章已经撤下")
        current_revision_id = (
            ArticleRevision.select(ArticleRevision.id)
            .where((ArticleRevision.symptom == symptom) & (ArticleRevision.status == "approved"))
            .order_by(
                ArticleRevision.published_at.desc(),
                ArticleRevision.id.desc(),
            )
            .scalar()
        )
        symptom.is_published = False
        symptom.save(only=[Symptom.is_published])
        AuditLog.record(
            actor=admin,
            action="article_unpublished",
            target_type="symptom",
            target_id=symptom.id,
            details={
                "reason": payload.reason,
                "current_revision_id": current_revision_id,
            },
        )
    return AdminArticleState(id=symptom.id, is_published=False)


@admin_router.post(
    "/articles/{symptom_id}/rollback/{revision_id}",
    response_model=ArticleRevisionItem,
)
def rollback_article(
    symptom_id: int,
    revision_id: int,
    payload: GovernanceReason,
    admin: Annotated[User, Depends(get_admin)],
) -> ArticleRevisionItem:
    with database.atomic():
        symptom = lock_query(Symptom.select().where(Symptom.id == symptom_id)).first()
        if symptom is None:
            raise HTTPException(status_code=404, detail="文章不存在")
        source = ArticleRevision.get_or_none(
            (ArticleRevision.id == revision_id)
            & (ArticleRevision.symptom == symptom)
            & (ArticleRevision.status.in_(("approved", "superseded")))
        )
        if source is None:
            raise HTTPException(status_code=404, detail="可回滚的历史版本不存在")

        current = (
            ArticleRevision.select()
            .where((ArticleRevision.symptom == symptom) & (ArticleRevision.status == "approved"))
            .order_by(ArticleRevision.published_at.desc(), ArticleRevision.id.desc())
            .first()
        )
        next_version = (
            ArticleRevision.select(fn.COALESCE(fn.MAX(ArticleRevision.version_number), 0) + 1)
            .where(ArticleRevision.symptom == symptom)
            .scalar()
        )
        now = datetime.now()
        rollback = ArticleRevision.create(
            symptom=symptom,
            author=admin,
            reviewer=admin,
            base_revision=current,
            source_revision=source,
            version_number=next_version,
            status="approved",
            origin="rollback",
            title=source.title,
            summary=source.summary,
            applicability=source.applicability,
            safety=source.safety,
            checklist_json=source.checklist_json,
            body=source.body,
            edit_summary=f"回滚至版本 v{source.version_number}：{payload.reason}",
            review_note=payload.reason,
            submitted_at=now,
            reviewed_at=now,
            published_at=now,
            created_at=now,
            updated_at=now,
        )
        if current is not None:
            current.status = "superseded"
            current.save(only=[ArticleRevision.status])
        symptom.is_published = True
        symptom.save(only=[Symptom.is_published])
        relocate_comment_threads(symptom.id, rollback)

        pending_revisions = list(
            ArticleRevision.select().where(
                (ArticleRevision.symptom == symptom) & (ArticleRevision.status == "pending")
            )
        )
        for pending in pending_revisions:
            pending.status = "rejected"
            pending.reviewer = admin
            pending.review_note = "文章已由管理员回滚，请基于新版本重新编辑"
            pending.reviewed_at = now
            pending.updated_at = now
            pending.save()
            remove_pending_review_notifications(pending)
            notify_submission_result(pending, admin, "rejected")

        AuditLog.record(
            actor=admin,
            action="article_rolled_back",
            target_type="article_revision",
            target_id=rollback.id,
            details={
                "symptom_id": symptom.id,
                "source_revision_id": source.id,
                "reason": payload.reason,
            },
        )
    rollback.author = admin
    rollback.reviewer = admin
    return serialize_revision(rollback)


@admin_router.get("/articles", response_model=AdminArticleList)
def list_admin_articles(
    _: Annotated[User, Depends(get_admin)],
) -> AdminArticleList:
    articles = list(Symptom.select().order_by(Symptom.id))
    return AdminArticleList(
        items=[
            AdminArticleItem(
                id=item.id,
                name=item.name,
                description=item.description,
                is_published=item.is_published,
                is_taken_down=(
                    not item.is_published
                    and ArticleRevision.select()
                    .where(
                        (ArticleRevision.symptom == item)
                        & (ArticleRevision.status.in_(("approved", "superseded")))
                    )
                    .exists()
                ),
            )
            for item in articles
        ],
        total=len(articles),
    )


@admin_router.get(
    "/articles/{symptom_id}/revisions",
    response_model=AdminRevisionList,
)
def list_admin_revisions(
    symptom_id: int,
    _: Annotated[User, Depends(get_admin)],
) -> AdminRevisionList:
    if not Symptom.select().where(Symptom.id == symptom_id).exists():
        raise HTTPException(status_code=404, detail="文章不存在")
    revisions = list(
        ArticleRevision.select(ArticleRevision, User)
        .join(User, on=(ArticleRevision.author == User.id))
        .where(ArticleRevision.symptom == symptom_id)
        .order_by(ArticleRevision.version_number.desc(), ArticleRevision.id.desc())
    )
    return AdminRevisionList(
        items=[serialize_revision(revision) for revision in revisions],
        total=len(revisions),
    )


@admin_router.get("/audit-logs", response_model=AuditLogList)
def list_audit_logs(
    _: Annotated[User, Depends(get_admin)],
) -> AuditLogList:
    logs = list(AuditLog.select().order_by(AuditLog.created_at.desc()).limit(200))
    items = []
    for log in logs:
        actor = User.get_or_none(User.id == log.actor_id) if log.actor_id else None
        items.append(
            AuditLogItem(
                id=log.id,
                actor_id=log.actor_id,
                actor_name=actor.username if actor else None,
                action=log.action,
                target_type=log.target_type,
                target_id=log.target_id,
                details=json.loads(log.details_json),
                created_at=log.created_at,
            )
        )
    return AuditLogList(items=items, total=len(items))
