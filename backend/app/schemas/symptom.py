from pydantic import BaseModel, ConfigDict, Field


class SymptomCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=100)
    description: str = Field(min_length=5, max_length=1000)


class SymptomItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str


class SymptomListResponse(BaseModel):
    items: list[SymptomItem]
    total: int
