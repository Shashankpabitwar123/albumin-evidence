"""HTTP routes for the review workflow. Source files are always authenticated."""

import hashlib
import json
import os
import re
import sqlite3
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal
import pymupdf as fitz
from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    UploadFile,
    BackgroundTasks,
    Request,
    Response,
)
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from . import config
from .db import connect, encode, now, audit, init_db
from .workbook import seed
from .auth import require_session, sign_in
from .ai import analyze, validate_citation
from .schemas import Decision, Approval


@asynccontextmanager
async def lifespan(app):
    init_db()
    seed()
    yield


app = FastAPI(
    title="Albumin Evidence",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


@app.middleware("http")
async def headers(request, call_next):
    if (
        request.headers.get("content-length", "").isdigit()
        and int(request.headers["content-length"]) > config.MAX_BYTES + 10000
    ):
        return JSONResponse(
            {"detail": "Upload a PDF smaller than 12 MB."}, status_code=413
        )
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Cache-Control"] = "no-store"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; frame-src 'self'; object-src 'none'; connect-src 'self'; base-uri 'self'; form-action 'self'"
    )
    return response


@app.exception_handler(sqlite3.OperationalError)
async def database_error(request, exc):
    return JSONResponse(
        {
            "detail": "The saved data is temporarily unavailable. Please try again; do not resubmit approvals repeatedly."
        },
        status_code=503,
    )


class Login(BaseModel):
    password: str = Field(max_length=512)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/login")
def login(body: Login, request: Request, response: Response):
    if request.headers.get("X-Requested-With") != "AlbuminEvidence":
        raise HTTPException(403, "Open the application to sign in.")
    sign_in(body.password, request, response)
    return {"ok": True}


@app.get("/api/session", dependencies=[Depends(require_session)])
def session():
    return {"ok": True, "criteria": config.CRITERIA, "model": config.MODEL}


@app.post("/api/logout", dependencies=[Depends(require_session)])
def logout(request: Request, response: Response):
    with connect() as db:
        db.execute(
            "DELETE FROM sessions WHERE token=?",
            (
                hashlib.sha256(
                    request.cookies.get("evidence_session", "").encode()
                ).hexdigest(),
            ),
        )
    response.delete_cookie("evidence_session")
    return {"ok": True}


def get_paper(db, pid):
    row = db.execute("SELECT * FROM papers WHERE id=?", (pid,)).fetchone()
    if not row:
        raise HTTPException(404, "This paper could not be found.")
    return row


def paper_data(row):
    p = dict(row)
    for k in ("pages", "screening", "extraction", "draft"):
        p[k] = json.loads(p[k]) if p[k] else None
    return p


@app.get("/api/library", dependencies=[Depends(require_session)])
def library(origin: Literal["mock", "real"] = "mock"):
    with connect() as db:
        studies = []
        for s in db.execute(
            "SELECT * FROM studies WHERE origin=? ORDER BY id", (origin,)
        ).fetchall():
            rows = db.execute(
                """SELECT o.* FROM outcomes o LEFT JOIN papers p ON p.id=o.paper_id
                               WHERE o.study_id=? AND (o.paper_id IS NULL OR p.decision='Include')""",
                (s["id"],),
            ).fetchall()
            publications = db.execute(
                "SELECT id,filename FROM papers WHERE study_id=? AND decision='Include'",
                (s["id"],),
            ).fetchall()
            if origin == "real" and not publications:
                continue
            outcomes = [
                dict(r) | {"data": json.loads(r["data"]), "raw": json.loads(r["raw"])}
                for r in rows
            ]
            studies.append(
                dict(s)
                | {
                    "characteristics": json.loads(s["characteristics"]),
                    "outcomes": outcomes,
                    "publications": [dict(p) for p in publications],
                }
            )
        sources = (
            [
                dict(s) | {"data": json.loads(s["data"])}
                for s in db.execute("SELECT * FROM sources").fetchall()
            ]
            if origin == "mock"
            else []
        )
        return {"studies": studies, "sources": sources}


@app.get("/api/papers", dependencies=[Depends(require_session)])
def papers():
    with connect() as db:
        result = []
        for r in db.execute("SELECT * FROM papers ORDER BY created DESC").fetchall():
            p = paper_data(r)
            p.pop("pages")
            p.pop("draft")
            p.pop("extraction")
            counts = db.execute(
                "SELECT status,COUNT(*) AS n FROM outcomes WHERE paper_id=? GROUP BY status",
                (p["id"],),
            ).fetchall()
            p["result_counts"] = {c["status"]: c["n"] for c in counts}
            result.append(p)
        return result


@app.get("/api/papers/{pid}", dependencies=[Depends(require_session)])
def paper(pid: str):
    with connect() as db:
        p = paper_data(get_paper(db, pid))
        p["events"] = [
            dict(r) | {"details": json.loads(r["details"])}
            for r in db.execute(
                "SELECT * FROM audit WHERE entity=? ORDER BY id DESC", (pid,)
            ).fetchall()
        ]
        p["results"] = [
            dict(r) | {"data": json.loads(r["data"])}
            for r in db.execute(
                "SELECT * FROM outcomes WHERE paper_id=?", (pid,)
            ).fetchall()
        ]
        p["related_candidates"] = []
        p["linked_results"] = (
            [
                dict(r) | {"data": json.loads(r["data"])}
                for r in db.execute(
                    "SELECT * FROM outcomes WHERE study_id=? AND paper_id<>? AND status='approved'",
                    (p["study_id"], pid),
                ).fetchall()
            ]
            if p["study_id"]
            else []
        )
        if p["screening"]:
            for r in db.execute(
                "SELECT id,study_id,screening FROM papers WHERE id<>? AND screening IS NOT NULL",
                (pid,),
            ).fetchall():
                other = json.loads(r["screening"])
                current = p["screening"]
                same = any(
                    current.get(k) and current[k] == other.get(k)
                    for k in ("doi", "trial_id")
                )
                if same:
                    p["related_candidates"].append(
                        {
                            "paper_id": r["id"],
                            "study_id": r["study_id"],
                            "title": other["title"],
                        }
                    )
        return p


@app.post("/api/upload", dependencies=[Depends(require_session)])
async def upload(file: UploadFile):
    payload = await file.read(config.MAX_BYTES + 1)
    await file.close()
    if len(payload) > config.MAX_BYTES:
        raise HTTPException(413, "Upload a PDF smaller than 12 MB.")
    if not payload.startswith(b"%PDF-"):
        raise HTTPException(
            422, "This file is not a readable PDF. Please choose a PDF document."
        )
    digest = hashlib.sha256(payload).hexdigest()
    with connect() as db:
        existing = db.execute(
            "SELECT id FROM papers WHERE sha256=?", (digest,)
        ).fetchone()
        if existing:
            audit(
                db,
                existing["id"],
                "Duplicate upload",
                None,
                {"filename": Path(file.filename or "paper.pdf").name},
            )
            return {"id": existing["id"], "duplicate": True}
    try:
        doc = fitz.open(stream=payload, filetype="pdf")
        if doc.needs_pass:
            raise ValueError(
                "This PDF is password protected. Please upload an unlocked copy."
            )
        if not 1 <= len(doc) <= config.MAX_PAGES:
            raise ValueError("Please upload a paper with 1–40 pages.")
        pages = [p.get_text(sort=False) for p in doc]
        doc.close()
        if (
            len("".join(pages).strip()) < 500
            or sum(len(p.strip()) < 80 for p in pages) > len(pages) * 0.5
        ):
            raise ValueError(
                "This PDF has too little readable text for reliable analysis. Please provide a searchable copy; scanned pages need OCR first."
            )
        if len("".join(pages)) > 160000:
            raise ValueError(
                "This document is too long to analyze in one review. Please upload the main publication separately."
            )
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    except Exception:
        raise HTTPException(
            422, "The PDF could not be read. Try an undamaged, searchable copy."
        )
    pid = str(uuid.uuid4())
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        existing = db.execute(
            "SELECT id FROM papers WHERE sha256=?", (digest,)
        ).fetchone()
        if existing:
            return {"id": existing["id"], "duplicate": True}
        if db.execute("SELECT COUNT(*) FROM papers").fetchone()[0] >= 100:
            raise HTTPException(
                409,
                "The document limit has been reached. Contact the application owner.",
            )
        path = config.DATA / (pid + ".pdf")
        path.write_bytes(payload)
        path.chmod(0o600)
        db.execute(
            "INSERT INTO papers(id,sha256,filename,pages,page_count,created) VALUES(?,?,?,?,?,?)",
            (
                pid,
                digest,
                Path(file.filename or "paper.pdf").name,
                encode(pages),
                len(pages),
                now(),
            ),
        )
        audit(
            db, pid, "Uploaded", None, {"filename": file.filename, "pages": len(pages)}
        )
    return {"id": pid, "duplicate": False}


@app.get("/api/papers/{pid}/pdf", dependencies=[Depends(require_session)])
def pdf(pid: str):
    with connect() as db:
        p = get_paper(db, pid)
    path = config.DATA / (p["id"] + ".pdf")
    if not path.exists():
        raise HTTPException(
            404, "The source file is unavailable. Contact the application owner."
        )
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=p["filename"],
        content_disposition_type="inline",
    )


@app.post("/api/papers/{pid}/analyze/{task}", dependencies=[Depends(require_session)])
def start_analysis(
    pid: str, task: Literal["screen", "extract"], background: BackgroundTasks
):
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        p = get_paper(db, pid)
        if p["job"]:
            raise HTTPException(409, "This paper is already being analyzed.")
        if task == "extract" and p["decision"] != "Include":
            raise HTTPException(409, "Confirm inclusion before extracting results.")
        if p["screening" if task == "screen" else "extraction"]:
            return {"cached": True}
        if not os.getenv("OPENAI_API_KEY"):
            raise HTTPException(
                503, "Analysis is not configured. Please contact the application owner."
            )
        db.execute("UPDATE papers SET job=?,error=NULL WHERE id=?", (task, pid))
    background.add_task(analyze, pid, task)
    return {"started": True}


@app.post("/api/papers/{pid}/decision", dependencies=[Depends(require_session)])
def decide(pid: str, body: Decision):
    if not body.reviewer.strip() or not body.reason.strip():
        raise HTTPException(422, "Enter your name and decision reason.")
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        p = get_paper(db, pid)
        if p["version"] != body.version:
            raise HTTPException(
                409, "This review changed in another window. Reload it before saving."
            )
        if p["job"]:
            raise HTTPException(
                409, "Wait for analysis to finish before changing the decision."
            )
        if not p["screening"]:
            raise HTTPException(409, "Complete screening before recording a decision.")
        if body.decision == "Include" and body.treatment_class == "Unclear":
            raise HTTPException(
                422, "Confirm the treatment classification before inclusion."
            )
        sid = p["study_id"]
        if body.linked_study_id:
            target = db.execute(
                "SELECT * FROM studies WHERE id=? AND origin='real'",
                (body.linked_study_id,),
            ).fetchone()
            if not target:
                raise HTTPException(422, "Choose an existing real-publication study.")
            if sid and sid != body.linked_study_id:
                raise HTTPException(
                    409,
                    "This paper already has a study link. Contact the owner to review linkage changes.",
                )
            sid = body.linked_study_id
        if body.decision == "Include" and not sid:
            sid = "ST-" + uuid.uuid4().hex[:10]
            screen = json.loads(p["screening"])
            db.execute(
                "INSERT INTO studies VALUES(?,?,?,?)",
                (
                    sid,
                    "real",
                    screen["title"],
                    encode(
                        {
                            "author": screen["author_year"],
                            "treatment_class": body.treatment_class,
                        }
                    ),
                ),
            )
        if sid:
            chars = json.loads(
                db.execute(
                    "SELECT characteristics FROM studies WHERE id=?", (sid,)
                ).fetchone()[0]
            )
            chars["treatment_class"] = body.treatment_class
            db.execute(
                "UPDATE studies SET characteristics=? WHERE id=?", (encode(chars), sid)
            )
        # Changing screening invalidates earlier approvals, which remain in audit.
        if p["decision"] != body.decision:
            db.execute(
                "UPDATE outcomes SET status='pending',note='Screening decision changed; result approval needs review.' WHERE paper_id=?",
                (pid,),
            )
        db.execute(
            "UPDATE papers SET decision=?,reason=?,reviewer=?,reviewed_at=?,study_id=?,version=version+1 WHERE id=?",
            (
                body.decision,
                body.reason.strip(),
                body.reviewer.strip(),
                now(),
                sid,
                pid,
            ),
        )
        audit(db, pid, "Screening decision", body.reviewer, body.model_dump())
    return paper(pid)


@app.post("/api/papers/{pid}/draft", dependencies=[Depends(require_session)])
def save_draft(pid: str, body: Approval):
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        p = get_paper(db, pid)
        if p["version"] != body.version:
            raise HTTPException(409, "This review changed. Reload it before saving.")
        if p["decision"] != "Include":
            raise HTTPException(409, "Only included papers can have extraction drafts.")
        db.execute(
            "UPDATE papers SET draft=?,version=version+1 WHERE id=?",
            (encode(body.model_dump()), pid),
        )
        audit(db, pid, "Extraction draft saved", body.reviewer, body.model_dump())
    return paper(pid)


@app.post("/api/papers/{pid}/approve", dependencies=[Depends(require_session)])
def approve(pid: str, body: Approval):
    if not body.reviewer.strip() or not body.reason.strip():
        raise HTTPException(422, "Enter a reviewer name and review note.")
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        p = get_paper(db, pid)
        if p["version"] != body.version:
            raise HTTPException(
                409, "This review changed in another window. Reload it before saving."
            )
        if p["decision"] != "Include" or not p["extraction"]:
            raise HTTPException(409, "Confirm inclusion and prepare extraction first.")
        pages = json.loads(p["pages"])
        for result in body.outcomes:
            data = result.data.model_dump()
            if result.status == "approved":
                required = (
                    "name",
                    "measure",
                    "units",
                    "definition",
                    "follow_up",
                    "analysis_population",
                    "location",
                )
                if any(not data.get(k) for k in required):
                    raise HTTPException(
                        422,
                        "Approved results need a definition, measure, units, analysis population, follow-up and source location.",
                    )
                if not validate_citation(data, pages):
                    raise HTTPException(
                        422,
                        "The source quote must match the selected PDF page before approval.",
                    )
                if not data["treatment_value"] and not data["control_value"]:
                    raise HTTPException(
                        422,
                        "A result with no reported values must stay pending or withheld.",
                    )
                if data["uncertainty"] and not result.note.strip():
                    raise HTTPException(
                        422,
                        "Explain how the uncertainty was handled before approving this result.",
                    )
            if result.status == "withheld" and not result.note.strip():
                raise HTTPException(422, "Give a reason for withholding the result.")
        # A correction replaces an explicitly selected result, never another study.
        targets = [r.supersedes_id for r in body.outcomes if r.supersedes_id]
        if len(targets) != len(set(targets)):
            raise HTTPException(
                422, "Select a different previous result for each correction."
            )
        for result in body.outcomes:
            if result.supersedes_id:
                old_result = db.execute(
                    "SELECT * FROM outcomes WHERE id=? AND study_id=? AND paper_id<>? AND status='approved'",
                    (result.supersedes_id, p["study_id"], pid),
                ).fetchone()
                if (
                    not old_result
                    or result.status != "approved"
                    or not result.note.strip()
                ):
                    raise HTTPException(
                        422,
                        "Replacing a result requires an approved result from the same study, approval of this correction, and a review note.",
                    )
                audit(
                    db,
                    old_result["paper_id"],
                    "Result superseded",
                    body.reviewer,
                    {
                        "previous": dict(old_result),
                        "replacement_paper": pid,
                        "reason": result.note,
                    },
                )
                db.execute(
                    "UPDATE outcomes SET status='superseded',note=? WHERE id=?",
                    (
                        "Replaced by a reviewer-approved result in "
                        + pid
                        + ". "
                        + result.note,
                        result.supersedes_id,
                    ),
                )
        previous = [
            dict(r)
            for r in db.execute(
                "SELECT * FROM outcomes WHERE paper_id=?", (pid,)
            ).fetchall()
        ]
        audit(
            db,
            pid,
            "Extraction reviewed",
            body.reviewer,
            {"previous": previous, "review": body.model_dump()},
        )
        db.execute("DELETE FROM outcomes WHERE paper_id=?", (pid,))
        proposed = json.loads(p["extraction"])["outcomes"]
        for i, result in enumerate(body.outcomes):
            db.execute(
                "INSERT INTO outcomes VALUES(?,?,?,?,?,?,?,?,?)",
                (
                    pid + ":" + str(i),
                    p["study_id"],
                    pid,
                    encode(result.data.model_dump()),
                    encode(proposed[i] if i < len(proposed) else {}),
                    result.status,
                    result.note,
                    body.reviewer,
                    now(),
                ),
            )
        chars = body.characteristics.model_dump()
        old = json.loads(
            db.execute(
                "SELECT characteristics FROM studies WHERE id=?", (p["study_id"],)
            ).fetchone()[0]
        )
        chars["treatment_class"] = old.get("treatment_class", "Unclear")
        db.execute(
            "UPDATE studies SET characteristics=? WHERE id=?",
            (encode(chars), p["study_id"]),
        )
        db.execute(
            "UPDATE papers SET draft=?,version=version+1 WHERE id=?",
            (encode(body.model_dump()), pid),
        )
    return paper(pid)


# The public shell contains no research data. Every data/source route requires a session.
DIST = config.ROOT / "frontend/dist"
if DIST.exists():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="frontend")
