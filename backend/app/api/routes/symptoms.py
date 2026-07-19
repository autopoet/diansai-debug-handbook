from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from peewee import IntegrityError, fn

from app.db.database import database_connection
from app.models.symptom import Symptom
from app.schemas.symptom import SymptomCreate, SymptomItem, SymptomListResponse

router = APIRouter(dependencies=[Depends(database_connection)])


@router.post(
    "/symptoms",
    response_model=SymptomItem,
    status_code=status.HTTP_201_CREATED,
)
def create_symptom(payload: SymptomCreate) -> SymptomItem:
    try:
        symptom = Symptom.create(
            name=payload.name,
            description=payload.description,
        )
    except IntegrityError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="故障现象名称已存在",
        ) from error

    return SymptomItem.model_validate(symptom)


@router.get("/symptoms", response_model=SymptomListResponse)
def list_symptoms(
    keyword: Annotated[
        str | None,
        Query(
            min_length=2,
            max_length=20,
            description="搜索故障名称或描述",
        ),
    ] = None,
) -> SymptomListResponse:
    query = Symptom.select().order_by(Symptom.id)

    if keyword is not None:
        normalized_keyword = keyword.casefold()
        query = query.where(
            fn.LOWER(Symptom.name).contains(normalized_keyword)
            | fn.LOWER(Symptom.description).contains(normalized_keyword)
        )

    items = [SymptomItem.model_validate(symptom) for symptom in query]

    return SymptomListResponse(
        items=items,
        total=len(items),
    )


@router.get("/symptoms/{symptom_id}", response_model=SymptomItem)
def get_symptom(symptom_id: int) -> SymptomItem:
    symptom = Symptom.get_or_none(Symptom.id == symptom_id)

    if symptom is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="故障现象不存在",
        )

    return SymptomItem.model_validate(symptom)
