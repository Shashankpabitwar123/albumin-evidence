"""Explicit shared-workspace reset. Billing history is never reset."""

import hashlib
import json
import tempfile
import zipfile
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from . import config
from .auth import require_session
from .db import connect, audit, now

router = APIRouter(prefix="/api/workspace", dependencies=[Depends(require_session)])


def originals():
    return json.loads((config.ROOT / "data/reset-papers.json").read_text())


def baseline(db):
    expected = originals()
    rows = db.execute("SELECT * FROM papers").fetchall()
    keep = [p for p in rows if p["sha256"] in expected]
    if len(keep) != len(expected) or not keep:
        raise HTTPException(
            409,
            "Reset is unavailable: the supplied papers are missing. Contact the workspace owner.",
        )
    for p in keep:
        path = config.DATA / (p["id"] + ".pdf")
        if (
            not p["screening"]
            or not path.exists()
            or hashlib.sha256(path.read_bytes()).hexdigest() != p["sha256"]
        ):
            raise HTTPException(
                409,
                "Reset is unavailable: a supplied paper or its screening is incomplete.",
            )
    return keep


@router.get("/backup")
def backup():
    # A consistent, portable export, excluding login sessions and credentials.
    archive = tempfile.TemporaryFile()
    try:
        with connect() as db:
            db.execute("BEGIN IMMEDIATE")
            tables = ["studies", "papers", "outcomes", "sources", "audit", "model_runs"]
            records = {
                table: [dict(r) for r in db.execute(f"SELECT * FROM {table}")]
                for table in tables
            }
            with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as z:
                z.writestr(
                    "workspace.json",
                    json.dumps(
                        {"exported_at": now(), "tables": records},
                        ensure_ascii=False,
                        indent=2,
                    ),
                )
                z.writestr(
                    "README.txt",
                    "Workspace backup: workspace.json contains saved reviews and history; PDFs are in papers/. Credentials and login sessions are excluded. This archive is for offline inspection and owner-assisted recovery; there is no in-app import.\n",
                )
                for p in records["papers"]:
                    path = config.DATA / (p["id"] + ".pdf")
                    if not path.exists():
                        raise HTTPException(
                            409,
                            "A source PDF is unavailable. Contact the owner before resetting.",
                        )
                    z.write(path, "papers/" + p["id"] + ".pdf")
        archive.seek(0)
    except Exception:
        archive.close()
        raise

    def chunks():
        try:
            while block := archive.read(65536):
                yield block
        finally:
            archive.close()

    return StreamingResponse(
        chunks(),
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="albumin-workspace-backup.zip"'
        },
    )


class ResetRequest(BaseModel):
    confirmation: str


@router.post("/reset")
def reset(body: ResetRequest):
    if body.confirmation != "RESET":
        raise HTTPException(
            422, "Type RESET to confirm this affects everyone in the shared workspace."
        )
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        if db.execute("SELECT 1 FROM papers WHERE job IS NOT NULL").fetchone():
            raise HTTPException(
                409,
                "A paper is being analyzed. Wait for it to finish before resetting.",
            )
        keep = baseline(db)
        keep_ids = {p["id"] for p in keep}
        removed = [
            p["id"]
            for p in db.execute("SELECT id FROM papers")
            if p["id"] not in keep_ids
        ]
        db.execute(
            "DELETE FROM outcomes WHERE paper_id IS NOT NULL OR study_id IN (SELECT id FROM studies WHERE origin='real')"
        )
        db.execute(
            "DELETE FROM audit WHERE entity IN (SELECT id FROM papers) OR entity IN (SELECT id FROM studies WHERE origin='real')"
        )
        db.execute("UPDATE papers SET study_id=NULL")
        for pid in removed:
            db.execute("DELETE FROM papers WHERE id=?", (pid,))
        db.execute("DELETE FROM studies WHERE origin='real'")
        for p in keep:
            # Original AI proposals are immutable; reviewer edits live in draft/outcomes.
            # Clear extraction so the next reviewer explicitly requests it again.
            db.execute(
                """UPDATE papers SET decision='Pending',reason=NULL,reviewer=NULL,
                reviewed_at=NULL,treatment_class=NULL,extraction=NULL,draft=NULL,job=NULL,error=NULL,
                version=version+1 WHERE id=?""",
                (p["id"],),
            )
            audit(
                db,
                p["id"],
                "Uploaded",
                None,
                {"filename": p["filename"], "restored_by_reset": True},
            )
            audit(
                db,
                p["id"],
                "AI screening completed",
                None,
                {"cached": True, "restored_by_reset": True},
            )
        audit(
            db,
            "workspace",
            "Workspace reset",
            None,
            {"supplied_papers": len(keep), "extra_uploads_removed": len(removed)},
        )
    for pid in removed:
        # After commit these files are inaccessible; cleanup failure must not undo a successful reset.
        try:
            (config.DATA / (pid + ".pdf")).unlink(missing_ok=True)
        except OSError:
            pass
    return {"ok": True, "papers": len(keep)}
