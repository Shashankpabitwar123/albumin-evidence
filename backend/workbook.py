"""Preserve the original workbook and record a separate, traceable QC layer."""

from openpyxl import load_workbook
from .config import ROOT
from .db import connect, encode, audit

# These are documented source-based dispositions, not changes to raw cells.
ISSUES = {
    "EX006": (
        "withheld",
        "Conflicting slide values; S02 provides the located supplement. Keep S10 visible but out of summaries.",
    ),
    "EX008": (
        "qualified",
        "Corrected endpoint label using S03: emergency admission, not ascites recurrence.",
    ),
    "EX013": (
        "pending",
        "Comparator HE count is illegible in S04. It remains missing.",
    ),
    "EX016": (
        "qualified",
        "S05 reports AKI, not HRS. Retained as AKI with its original definition.",
    ),
    "EX017": (
        "withheld",
        "Unsupported HRS label duplicates the AKI values in EX016; S11 contains no clinical review.",
    ),
    "EX020": (
        "qualified",
        "Death before transplant; follow-up ends at transplant. Not interchangeable with fixed-period all-cause mortality.",
    ),
    "EX024": (
        "pending",
        "Arm counts were not reported. NR is preserved, not converted to zero.",
    ),
    "EX027": (
        "qualified",
        "S07 Table 3 is the matched cohort: corrected denominators from 64/71 to 58/58.",
    ),
    "EX028": (
        "pending",
        "Outcome time window and source locator are absent. General study follow-up is not substituted.",
    ),
    "EX029": (
        "superseded",
        "Interim report S08; final report S09/EX030 represents the same study.",
    ),
    "EX031": (
        "qualified",
        "Rounded percentages; do not reconstruct event counts from baseline denominators.",
    ),
    "EX033": (
        "duplicate",
        "Exact copied result of EX032, same study, source, measure and follow-up.",
    ),
}


def seed():
    with connect() as db:
        if db.execute("SELECT 1 FROM studies WHERE origin='mock'").fetchone():
            return
        book = load_workbook(ROOT / "data/evidence.xlsx", data_only=True)
        for row in list(book["Study Characteristics"].values)[1:]:
            if not row[0]:
                continue
            (
                sid,
                author,
                acronym,
                design,
                country,
                population,
                regimen,
                comparator,
                n1,
                n0,
                follow,
                sources,
                notes,
            ) = row[:13]
            data = dict(
                author=author,
                acronym=acronym,
                design=design,
                country=country,
                population=population,
                treatment=regimen,
                comparator=comparator,
                treatment_n=str(n1),
                control_n=str(n0),
                follow_up=follow,
                notes=notes,
            )
            db.execute(
                "INSERT INTO studies VALUES(?,?,?,?)",
                (sid, "mock", acronym, encode(data)),
            )
        for row in list(book["Mock Sources & Notes"].values)[1:]:
            if not row[0]:
                continue
            data = dict(
                kind=row[2],
                citation=row[3],
                location=row[5],
                excerpt=row[6],
                notes=row[7],
            )
            db.execute(
                "INSERT INTO sources VALUES(?,?,?)", (row[0], row[1], encode(data))
            )
        for i, row in enumerate(list(book["Outcome Extraction"].values)[1:], 2):
            if not row[0]:
                continue
            (
                rid,
                sid,
                name,
                v1,
                n1,
                v0,
                n0,
                follow,
                measure,
                definition,
                source,
                location,
                qc,
                comment,
                batch,
            ) = row[:15]
            text = lambda v: None if v is None else str(v)
            data = dict(
                name=name,
                treatment_value=text(v1),
                control_value=text(v0),
                treatment_n=text(n1),
                control_n=text(n0),
                follow_up=follow,
                measure=measure,
                units=measure,
                definition=definition,
                analysis_population="As reported",
                source=source,
                location=location,
                page=None,
                quote="",
                uncertainty=comment or "",
                workbook_row=i,
                original_qc=qc,
            )
            raw = dict(data)
            status, note = ISSUES.get(
                rid,
                ("approved", "Checked against the supplied fictional source excerpt."),
            )
            if rid == "EX008":
                data["name"] = "Emergency cirrhosis admission"
            if rid == "EX016":
                data["name"] = "Acute kidney injury"
            if rid == "EX027":
                data.update(treatment_n="58", control_n="58")
            db.execute(
                "INSERT INTO outcomes(id,study_id,data,raw,status,note,reviewer) VALUES(?,?,?,?,?,?,?)",
                (
                    rid,
                    sid,
                    encode(data),
                    encode(raw),
                    status,
                    note,
                    "Source-based import QC",
                ),
            )
            if rid in ISSUES:
                audit(
                    db,
                    rid,
                    "Workbook QC",
                    "Source-based import QC",
                    dict(before=raw, after=data, status=status, reason=note),
                )
        book.close()
