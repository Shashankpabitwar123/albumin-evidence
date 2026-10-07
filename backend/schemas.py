"""Typed AI output and reviewer input keep missingness explicit."""

from typing import Literal
from pydantic import BaseModel, Field, ConfigDict


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Citation(StrictModel):
    page: int | None
    quote: str | None
    location: str | None


class Criterion(StrictModel):
    name: str
    status: Literal["Supported", "Not supported", "Unclear"]
    reason: str
    evidence: Citation


class Screening(StrictModel):
    title: str
    author_year: str | None
    doi: str | None
    trial_id: str | None
    recommendation: Literal["Include", "Exclude", "Needs clarification"]
    reason: str
    criteria: list[Criterion]
    treatment_class: Literal["Albumin", "Combination", "Unclear"]
    attribution_note: str
    warnings: list[str]


class Characteristics(StrictModel):
    author: str | None
    acronym: str | None
    design: str | None
    country: str | None
    population: str | None
    treatment: str | None
    comparator: str | None
    treatment_n: str | None
    control_n: str | None
    follow_up: str | None
    notes: str | None
    evidence: list[Citation]


class Outcome(StrictModel):
    name: str
    definition: str | None
    measure: str | None
    units: str | None
    treatment_value: str | None
    control_value: str | None
    treatment_n: str | None
    control_n: str | None
    analysis_population: str | None
    follow_up: str | None
    page: int | None
    location: str | None
    quote: str | None
    uncertainty: str | None


class Extraction(StrictModel):
    characteristics: Characteristics
    outcomes: list[Outcome] = Field(max_length=2)
    warnings: list[str]


class Decision(StrictModel):
    decision: Literal["Include", "Exclude", "Needs clarification"]
    reason: str = Field(min_length=3, max_length=4000)
    reviewer: str = Field(min_length=2, max_length=100)
    treatment_class: Literal["Albumin", "Combination", "Unclear"]
    version: int
    linked_study_id: str | None = None


class ReviewedOutcome(StrictModel):
    supersedes_id: str | None = None
    data: Outcome
    status: Literal["approved", "pending", "withheld"]
    note: str = Field(max_length=4000)


class Approval(StrictModel):
    characteristics: Characteristics
    outcomes: list[ReviewedOutcome] = Field(max_length=2)
    reviewer: str = Field(min_length=2, max_length=100)
    reason: str = Field(min_length=3, max_length=4000)
    version: int


class OutcomeCheck(StrictModel):
    index: int
    issues: list[str]
    conflicting_values: bool
    unsupported_denominators: bool


class ExtractionCheck(StrictModel):
    outcomes: list[OutcomeCheck]
    warnings: list[str]
