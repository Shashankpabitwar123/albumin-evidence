# Albumin Evidence

A password-protected workspace for maintaining evidence on scheduled outpatient albumin in adults with cirrhosis and ascites. It imports the supplied fictional workbook, screens new searchable research PDFs, proposes selected extraction, and publishes only reviewer-approved results.

## Run locally

Requires Python 3.13 and Node.js 22 (Node 20.19+ also works).

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env.local
# Edit .env.local: set OPENAI_API_KEY and a strong APP_PASSWORD.
npm ci --prefix frontend
npm run build --prefix frontend
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000. The database and uploaded PDFs are created in `runtime/`. An empty database imports the workbook once. Changing the workbook later does not silently overwrite existing records. Do not commit runtime files or credentials. `ENV_FILE` can point to a separate local credential file.

## Review workflow

1. **Evidence Library:** use the fictional/real source selector and study, outcome, and follow-up filters. Expand studies to see results, source excerpts, original extraction, and unresolved issues.
2. **Review a Paper:** upload a searchable PDF, then screen it. Check the AI recommendation against each criterion and the original PDF. Record your decision, reason, name, and treatment classification.
3. For an included study, prepare extraction. Correct study characteristics and up to two results. Check each measure, value, denominator, time window, source quote, and PDF page. Keep unresolved results pending or withhold them. Save a draft or confirm the review.
4. **Review History:** resume pending or excluded papers, inspect reviewer decisions and AI versions, and reopen results. Study inclusion does not approve any result automatically.

An identical file reopens its saved review. DOI/trial matches flag possible related reports; a reviewer chooses linkage. Linked corrections can explicitly supersede an earlier approved result. Original values remain in the audit history. Different copies with missing or inconsistent identifiers need manual identity review; there is no claim of perfect study deduplication.

## What is automated, manual, and simulated

- **Automated:** workbook import, declared source-based QC rules, PDF text extraction, file-hash duplicate checks, OpenAI screening and extraction proposals, exact source-quote matching, a second AI pass checking extraction contradictions, storage and library updates.
- **Manual reviewer work:** eligibility, combination-treatment attribution, study linkage, checking and correcting proposed fields, confirming results individually, and explaining uncertainty. Reviewer names are entered labels, not verified individual accounts.
- **Fictional:** all supplied workbook studies, values, citations, and excerpts. The real PDFs do not substantiate them. The UI never pools fictional and real numerical results.
- **Test simulation:** automated workflow tests use synthetic PDFs and clearly identified test reviewers in isolated databases. Live AI evaluation uses the four supplied PDFs in a separate local evaluation database. Those automated approvals are not human reviews and are not seeded into the hosted workspace.
- **AI-assisted development:** the application code, documentation, tests and source-quality review were developed with Codex assistance. This is distinct from runtime AI suggestions, which still need reviewer confirmation.

## Data decisions

The supplied workbook has 7 studies, 34 outcome rows, and 11 source records. Its README references older counts and absent records. Rahul confirmed that the supplied workbook should be used as-is; no missing study or screening-inbox records were invented.

The raw workbook and each original extraction are preserved. `backend/workbook.py` contains the explicit QC dispositions: conflicting reports, unsupported HRS mapping, missing comparator values, NR, matched versus enrolled denominators, interim versus final reports, and duplicate rows. Qualified results retain caveats. Baseline inclusion was accepted; the imported QC layer is not a new clinical adjudication.

Blank, NR, and explicit zero are distinct. Counts, episodes, rates, Kaplan–Meier estimates, and time-to-event measures stay separate. There is no meta-analysis, pooled treatment estimate, automatic literature search, or clinical recommendation.

The review includes outpatient continuation after initial hospitalization. Combination therapy is not automatically excluded: reviewers must label it explicitly, and its effect is not described as albumin alone.

## Architecture

- React/Vite frontend, three main tabs, locally served fonts.
- FastAPI backend; one server worker; all data and PDF routes require a shared-password session.
- SQLite transactions, WAL, optimistic review versions, audit history, persistent PDF files.
- OpenAI Responses API with structured Pydantic output and a separate extraction consistency check; `store=false`. Only extracted publication text is sent, not passwords or the fictional workbook.
- Exact quote verification checks source presence, not whether a quoted passage supports a numerical claim. Exact unique matches on another page are relocated with a warning; unmatched passages remain flagged.

## Limits and failure handling

Searchable PDFs only, maximum 12 MB, 40 pages, 160,000 extracted characters, and 100 saved documents within a 750 MB upload allowance. At most two papers are analyzed concurrently. Scanned, encrypted, malformed or mostly unreadable PDFs are rejected with a reason. OCR and graph digitization are not implemented. Tables and column ordering can still be misread; the original PDF is available for checking. A matching quote does not guarantee a correct interpretation. Human checking is required even when no warning appears.

API failures keep uploaded files and saved reviews. Interrupted jobs become retryable on restart. Conflicting saves return a reload instruction instead of overwriting another review. Database errors return a controlled error. The service cannot guarantee zero downtime or correct AI results.

`AI_BUDGET_USD` defaults to $5 per database lifetime, not per month. Each screening or extraction job reserves $0.50 before it starts (extraction includes two model calls); successful requests reconcile token estimates. Failed or interrupted calls keep the reservation because their billable status may be uncertain. Rates are configured for GPT-5.4-mini ($0.75/M input, $4.50/M output as checked October 6, 2026). Do not change the model without updating and checking the pricing calculation. This application guard covers this installation only; use provider billing controls for the whole API account.

## Deploy on Render

`Dockerfile` builds the frontend and runs one Python service. `render.yaml` specifies the $7/month Starter service plus a 1 GB persistent disk ($0.25/month), on a free Hobby workspace. Set server-only `OPENAI_API_KEY` and `APP_PASSWORD`; use `COOKIE_SECURE=true` and `DATA_DIR=/var/data`. Prices exclude tax and excess usage; OpenAI is separate.

Both SQLite and PDFs must be on the attached disk. Never deploy this app's database on Render's ephemeral root filesystem. Persistent disks imply a single instance and brief interruption during deployment. SQLite suits this small reviewer workspace; a larger multi-user service would need a managed database, stronger identity management, and background job infrastructure.

Back up the database using SQLite's backup API (not by copying a live database file alone), together with its PDFs. Protect backup files like the workspace. Export or download backups before deleting the Render service or disk.

## Tests

```sh
python -m pytest -q
npm run build --prefix frontend
```

Workflow tests use temporary storage and make no paid API calls. They cover raw import/QC, missing versus zero, invalid/scanned/encrypted PDFs, duplicates, protected downloads, approval and revocation, stale saves, draft persistence, citation checks, spending limits, provider failures, and correction history.

## Code map

- `backend/main.py`: HTTP routes and review transitions.
- `backend/ai.py`: bounded model requests, citation verification, usage accounting.
- `backend/schemas.py`: typed proposals and reviewer inputs.
- `backend/workbook.py`: original workbook import and documented QC.
- `backend/db.py`: schema, transactions, audit history.
- `backend/auth.py`: shared-password login, session cookies, rate limit.
- `frontend/src/`: Library, Review, History, shared controls, styling.
- `data/evidence.xlsx`: supplied fictional evidence workbook.
- `tests/`: isolated automated verification.

The repository is intended for private assignment handoff. Supplied publications are not redistributed in the source repository; upload the four attachments supplied by Rahul through the application.

## Shared workspace reset

Help → Start fresh → Reset workspace opens a confirmation. Reset affects every visitor in the shared workspace. Type `RESET` to confirm. It restores the four supplied PDFs to Pending review, keeps their cached AI screening and original extraction suggestions, removes all reviewer decisions/drafts/results and extra uploads, and rebuilds each paper’s history with Uploaded and AI screening completed entries. The fictional workbook remains unchanged. A separate workspace reset event is retained for operations.

Download the ZIP backup before resetting to keep PDFs and JSON records for offline inspection or owner-assisted recovery. There is no in-app restore. Credentials and sessions are excluded from the backup. Reset is blocked during analysis or if an original file/screening is missing. Existing review versions are incremented so stale tabs cannot overwrite a reset. Refresh other open windows afterward. API spending history is retained. Cached screening and extraction are reused without model calls after reset. A paper that has never had extraction prepared still needs its first extraction; additional uploads also require analysis.
