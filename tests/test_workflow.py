"""Workflow tests use isolated storage, synthetic papers and no model calls."""

import pytest
import fitz
from fastapi.testclient import TestClient
from backend import config
from backend.main import app
from backend.db import connect, encode


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DATA", tmp_path)
    monkeypatch.setattr(config, "DB", tmp_path / "test.db")
    monkeypatch.setenv("APP_PASSWORD", "test-only-password-2026")
    monkeypatch.setenv("COOKIE_SECURE", "false")
    with TestClient(app) as c:
        c.headers["X-Requested-With"] = "AlbuminEvidence"
        assert (
            c.post(
                "/api/login", json={"password": "test-only-password-2026"}
            ).status_code
            == 200
        )
        yield c


def upload(client):
    doc = fitz.open()
    page = doc.new_page()
    page.insert_textbox(
        fitz.Rect(40, 40, 550, 800),
        (
            "Adults with cirrhosis and ascites received scheduled outpatient albumin and standard care. "
            * 12
        ),
        fontsize=12,
    )
    payload = doc.tobytes()
    doc.close()
    return (
        client.post(
            "/api/upload", files={"file": ("paper.pdf", payload, "application/pdf")}
        ),
        payload,
    )


def prepare(client):
    response, _ = upload(client)
    assert response.status_code == 200
    pid = response.json()["id"]
    quote = "Adults with cirrhosis and ascites received scheduled outpatient albumin and standard care."
    chars = {
        k: None
        for k in (
            "author",
            "acronym",
            "design",
            "country",
            "population",
            "treatment",
            "comparator",
            "treatment_n",
            "control_n",
            "follow_up",
            "notes",
        )
    }
    chars["evidence"] = []
    outcome = dict(
        name="Mortality",
        definition="All-cause death",
        measure="Patients with event",
        units="patients",
        treatment_value="0",
        control_value="2",
        treatment_n="20",
        control_n="20",
        analysis_population="Randomized",
        follow_up="12 months",
        page=1,
        location="Results",
        quote=quote,
        uncertainty=None,
    )
    with connect() as db:
        db.execute(
            "UPDATE papers SET screening=?,extraction=? WHERE id=?",
            (
                encode(
                    {
                        "title": "Test study",
                        "author_year": "Test 2026",
                        "treatment_class": "Albumin",
                    }
                ),
                encode(
                    {"characteristics": chars, "outcomes": [outcome], "warnings": []}
                ),
                pid,
            ),
        )
    body = dict(
        decision="Include",
        reason="Automated test only",
        reviewer="Test runner",
        treatment_class="Albumin",
        version=0,
    )
    r = client.post(f"/api/papers/{pid}/decision", json=body)
    assert r.status_code == 200, r.text
    approval = dict(
        characteristics=chars,
        outcomes=[dict(data=outcome, status="approved", note="Automated test")],
        reviewer="Test runner",
        reason="Automated verification only",
        version=r.json()["version"],
    )
    return pid, approval


def test_source_import_and_qc(client):
    d = client.get("/api/library").json()
    assert len(d["studies"]) == 7
    assert len(d["sources"]) == 11
    rows = {r["id"]: r for s in d["studies"] for r in s["outcomes"]}
    assert len(rows) == 34
    assert rows["EX014"]["data"]["treatment_value"] == "0"
    assert rows["EX024"]["data"]["treatment_value"] == "NR"
    assert rows["EX013"]["data"]["control_value"] is None
    assert (
        rows["EX027"]["raw"]["treatment_n"] == "64"
        and rows["EX027"]["data"]["treatment_n"] == "58"
    )
    assert rows["EX033"]["status"] == "duplicate"
    assert client.get("/api/library?origin=real").json()["studies"] == []


def test_duplicate_and_invalid_file(client):
    response, payload = upload(client)
    assert response.status_code == 200
    r = client.post(
        "/api/upload", files={"file": ("renamed.pdf", payload, "application/pdf")}
    )
    assert r.json()["duplicate"] is True and r.json()["id"] == response.json()["id"]
    assert len(client.get("/api/papers").json()) == 1
    assert (
        client.post(
            "/api/upload", files={"file": ("fake.pdf", b"not a pdf")}
        ).status_code
        == 422
    )


def test_approval_and_revocation(client):
    pid, body = prepare(client)
    r = client.post(f"/api/papers/{pid}/approve", json=body)
    assert r.status_code == 200, r.text
    assert (
        client.get("/api/library?origin=real").json()["studies"][0]["outcomes"][0][
            "status"
        ]
        == "approved"
    )
    assert client.post(f"/api/papers/{pid}/approve", json=body).status_code == 409
    decision = dict(
        decision="Exclude",
        reason="Changed after source review",
        reviewer="Test runner",
        treatment_class="Albumin",
        version=r.json()["version"],
    )
    assert client.post(f"/api/papers/{pid}/decision", json=decision).status_code == 200
    assert client.get("/api/library?origin=real").json()["studies"] == []
    assert len(client.get("/api/papers/" + pid).json()["events"]) >= 4
    assert client.post(f"/api/papers/{pid}/approve", json=body).status_code == 409


def test_unsupported_source_blocks_approval(client):
    pid, body = prepare(client)
    body["outcomes"][0]["data"][
        "quote"
    ] = "This sentence is invented and not in the publication."
    assert client.post(f"/api/papers/{pid}/approve", json=body).status_code == 422
    assert client.get("/api/library?origin=real").json()["studies"][0]["outcomes"] == []


def test_protected_files_and_mutations(client):
    response, _ = upload(client)
    pid = response.json()["id"]
    assert client.get(f"/api/papers/{pid}/pdf").status_code == 200
    del client.headers["X-Requested-With"]
    assert client.post(f"/api/papers/{pid}/analyze/screen", json={}).status_code == 403
    client.cookies.clear()
    for url in ["/api/papers", "/api/library", f"/api/papers/{pid}/pdf"]:
        assert client.get(url).status_code == 401


def test_unreadable_and_encrypted_pdfs(client):
    doc = fitz.open()
    doc.new_page()
    blank = doc.tobytes()
    encrypted = doc.tobytes(
        encryption=fitz.PDF_ENCRYPT_AES_256, owner_pw="owner", user_pw="secret"
    )
    doc.close()
    for name, payload in [("scan.pdf", blank), ("locked.pdf", encrypted)]:
        response = client.post(
            "/api/upload", files={"file": (name, payload, "application/pdf")}
        )
        assert response.status_code == 422
    assert client.get("/api/papers").json() == []


def test_missing_results_pending_and_draft_persistence(client):
    pid, body = prepare(client)
    body["outcomes"][0]["data"]["treatment_value"] = None
    body["outcomes"][0]["data"]["control_value"] = None
    assert client.post(f"/api/papers/{pid}/approve", json=body).status_code == 422
    body["outcomes"][0]["status"] = "pending"
    saved = client.post(f"/api/papers/{pid}/draft", json=body)
    assert saved.status_code == 200
    body["version"] = saved.json()["version"]
    assert (
        client.get("/api/papers/" + pid).json()["draft"]["outcomes"][0]["data"][
            "control_value"
        ]
        is None
    )
    assert client.post(f"/api/papers/{pid}/approve", json=body).status_code == 200
    result = client.get("/api/library?origin=real").json()["studies"][0]["outcomes"][0]
    assert result["status"] == "pending" and result["data"]["treatment_value"] is None


def test_budget_guard_does_not_call_model(client, monkeypatch):
    from backend import ai

    pid, _ = prepare(client)
    monkeypatch.setattr(config, "BUDGET", 0)
    monkeypatch.setattr(
        ai, "OpenAI", lambda **kw: pytest.fail("Budget must block the model call")
    )
    ai.analyze(pid, "screen")
    p = client.get("/api/papers/" + pid).json()
    assert "spending limit" in p["error"] and p["job"] is None


def test_model_failure_keeps_saved_paper_and_reservation(client, monkeypatch):
    from backend import ai

    pid, _ = prepare(client)

    def unavailable(**kwargs):
        raise RuntimeError("private upstream details must not be exposed")

    monkeypatch.setattr(ai, "OpenAI", unavailable)
    ai.analyze(pid, "extract")
    p = client.get("/api/papers/" + pid).json()
    assert "unavailable" in p["error"] and "private" not in p["error"]
    with connect() as db:
        row = db.execute("SELECT * FROM model_runs").fetchone()
        assert row["status"] == "failed" and row["reserved"] == 0.5


def test_exact_quote_page_relocation():
    from backend.ai import relocate_citation, validate_citation

    citation = {"page": 1, "quote": "A sufficiently long exact source passage."}
    warnings = []
    pages = ["Different page", citation["quote"]]
    relocate_citation(citation, pages, warnings)
    assert citation["page"] == 2 and warnings and validate_citation(citation, pages)
    assert citation["reference_check"] == {"original_page": 1, "verified_page": 2}
    citation["quote"] = "A fabricated claim absent from either page."
    assert not validate_citation(citation, pages)


def test_related_correction_supersedes_previous_result(client):
    pid, body = prepare(client)
    first = client.post(f"/api/papers/{pid}/approve", json=body).json()
    second_id, second_body = prepare(client)
    # Fixture PDFs may be byte-identical within one clock tick, so create a distinct correction record.
    if second_id == pid:
        import uuid

        second_id = str(uuid.uuid4())
        with connect() as db:
            db.execute(
                "INSERT INTO papers(id,sha256,filename,pages,screening,extraction,decision,study_id,created) SELECT ?,?,'correction.pdf',pages,screening,extraction,'Include',study_id,created FROM papers WHERE id=?",
                (second_id, second_id, pid),
            )
    with connect() as db:
        db.execute(
            "UPDATE papers SET study_id=? WHERE id=?", (first["study_id"], second_id)
        )
    second = client.get("/api/papers/" + second_id).json()
    second_body["version"] = second["version"]
    second_body["outcomes"][0]["supersedes_id"] = first["results"][0]["id"]
    second_body["outcomes"][0][
        "note"
    ] = "Correction replaces the original result; automated test only."
    assert (
        client.post(f"/api/papers/{second_id}/approve", json=second_body).status_code
        == 200
    )
    assert (
        client.get("/api/papers/" + pid).json()["results"][0]["status"] == "superseded"
    )

    body["version"] = client.get("/api/papers/" + pid).json()["version"]
    assert client.post(f"/api/papers/{pid}/approve", json=body).status_code == 409


def test_consistency_check_blocks_conflicting_values(client, monkeypatch):
    from backend import ai
    from backend.schemas import Extraction, ExtractionCheck
    from types import SimpleNamespace

    pid, body = prepare(client)
    proposal = Extraction(
        characteristics=body["characteristics"],
        outcomes=[body["outcomes"][0]["data"]],
        warnings=[],
    )
    check = ExtractionCheck(
        outcomes=[
            dict(
                index=0,
                issues=["Body and figure report conflicting arm values."],
                conflicting_values=True,
                unsupported_denominators=True,
            )
        ],
        warnings=[],
    )
    outputs = iter([proposal, check])
    fake = SimpleNamespace(
        responses=SimpleNamespace(
            parse=lambda **kw: SimpleNamespace(
                output_parsed=next(outputs),
                usage=SimpleNamespace(input_tokens=100, output_tokens=100),
            )
        )
    )
    monkeypatch.setattr(ai, "OpenAI", lambda **kw: fake)
    ai.analyze(pid, "extract")
    paper = client.get("/api/papers/" + pid).json()
    result = paper["extraction"]["outcomes"][0]
    assert result["treatment_value"] is None and result["control_value"] is None
    assert result["treatment_n"] is None and "conflicting" in result["uncertainty"]
    assert (
        paper["events"][0]["details"]["consistency_check"]["outcomes"][0][
            "conflicting_values"
        ]
        is True
    )


def test_reviewer_treatment_override_is_preserved(client):
    pid, _ = prepare(client)
    paper = client.get("/api/papers/" + pid).json()
    response = client.post(
        f"/api/papers/{pid}/decision",
        json=dict(
            decision="Include",
            reason="Reviewer confirmed a differing co-intervention.",
            reviewer="Test reviewer",
            treatment_class="Combination",
            version=paper["version"],
        ),
    )
    assert response.status_code == 200
    assert client.get("/api/papers/" + pid).json()["treatment_class"] == "Combination"
    assert (
        client.get("/api/library?origin=real").json()["studies"][0]["characteristics"][
            "treatment_class"
        ]
        == "Combination"
    )


def test_shared_reset_backup_and_stale_review(client, monkeypatch):
    import io
    import json
    import zipfile
    from backend import workspace

    pid, approval = prepare(client)
    assert client.post(f"/api/papers/{pid}/approve", json=approval).status_code == 200
    before = client.get(f"/api/papers/{pid}").json()
    mock = client.get("/api/library").json()
    monkeypatch.setattr(workspace, "originals", lambda: {before["sha256"]: "paper.pdf"})
    with connect() as db:
        db.execute(
            "INSERT INTO model_runs VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            ("cost", pid, "screen", "test", "test", "complete", 0.5, 0.1, 1, 1, "now"),
        )
        db.execute(
            "INSERT INTO papers(id,sha256,filename,pages,page_count,created) VALUES('extra','extra','extra.pdf','[]',1,'now')"
        )
    (config.DATA / "extra.pdf").write_bytes(b"extra test document")
    backup = client.get("/api/workspace/backup")
    assert backup.status_code == 200
    with zipfile.ZipFile(io.BytesIO(backup.content)) as z:
        saved = json.loads(z.read("workspace.json"))["tables"]
        assert len(saved["papers"]) == 2
        assert "sessions" not in saved
        assert "papers/extra.pdf" in z.namelist()
        assert any(
            o["paper_id"] == pid and o["status"] == "approved"
            for o in saved["outcomes"]
        )
    assert (
        client.post("/api/workspace/reset", json={"confirmation": "reset"}).status_code
        == 422
    )
    with connect() as db:
        db.execute("UPDATE papers SET job='screen' WHERE id=?", (pid,))
    assert (
        client.post("/api/workspace/reset", json={"confirmation": "RESET"}).status_code
        == 409
    )
    with connect() as db:
        db.execute("UPDATE papers SET job=NULL WHERE id=?", (pid,))
    assert (
        client.post("/api/workspace/reset", json={"confirmation": "RESET"}).status_code
        == 200
    )
    after = client.get(f"/api/papers/{pid}").json()
    assert after["decision"] == "Pending"
    assert after["screening"] == before["screening"]
    assert after["draft"] is None
    assert after["extraction"] == before["extraction"]
    assert after["reviewer"] is None and after["study_id"] is None
    assert after["version"] > before["version"]
    assert {e["action"] for e in after["events"]} == {
        "Uploaded",
        "AI screening completed",
        "AI extraction available",
    }
    assert len(client.get("/api/papers").json()) == 1
    assert not (config.DATA / "extra.pdf").exists()
    assert client.get("/api/library?origin=real").json()["studies"] == []
    assert client.get("/api/library").json() == mock
    assert client.post(f"/api/papers/{pid}/approve", json=approval).status_code == 409
    with connect() as db:
        assert (
            db.execute("SELECT actual FROM model_runs WHERE id='cost'").fetchone()[0]
            == 0.1
        )
    assert (
        client.post("/api/workspace/reset", json={"confirmation": "RESET"}).status_code
        == 200
    )
    # Even an exhausted budget must not cause a model call for cached proposals.
    import backend.main as routes

    def unexpected_model_call(*args, **kwargs):
        raise AssertionError("Cached extraction must not call the model")

    monkeypatch.setattr(routes, "analyze", unexpected_model_call)
    monkeypatch.setattr(config, "BUDGET", 0)
    assert client.post(f"/api/papers/{pid}/analyze/screen").json() == {"cached": True}
    latest = client.get(f"/api/papers/{pid}").json()
    decision = dict(
        decision="Include",
        reason="Fresh review",
        reviewer="Test reviewer",
        treatment_class="Albumin",
        version=latest["version"],
    )
    assert client.post(f"/api/papers/{pid}/decision", json=decision).status_code == 200
    assert client.post(f"/api/papers/{pid}/analyze/extract").json() == {"cached": True}
    assert client.get(f"/api/papers/{pid}").json()["extraction"] == before["extraction"]
    client.cookies.clear()
    assert client.get("/api/workspace/backup").status_code == 401
    assert (
        client.post("/api/workspace/reset", json={"confirmation": "RESET"}).status_code
        == 401
    )


def test_reset_requires_all_originals(client):
    response, _ = upload(client)
    assert (
        client.post("/api/workspace/reset", json={"confirmation": "RESET"}).status_code
        == 409
    )
    assert client.get("/api/papers/" + response.json()["id"]).status_code == 200
