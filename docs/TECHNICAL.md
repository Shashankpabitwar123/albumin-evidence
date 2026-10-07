# Technical notes

For developers and the workspace owner. Start with the [project README](../README.md) for the reviewer workflow.

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
node --test frontend/src/*.test.js
npm run build --prefix frontend
```

Workflow tests use temporary storage and make no paid API calls. They cover raw import/QC, missing versus zero, invalid/scanned/encrypted PDFs, duplicates, protected downloads, approval and revocation, stale saves, draft persistence, citation checks, spending limits, provider failures, and correction history.


## Reset implementation

Reset requires the four original files and their screening caches and is blocked during analysis. It retains original AI proposals and spending history, clears reviewer records, removes additional uploads, and increments review versions to reject stale saves. A paper without an extraction cache still needs its first extraction. The backup contains JSON records and PDFs, not an importable database snapshot; there is no in-app restore.

## Optional: run your own copy locally

**To evaluate the complete workflow without configuring an API key, use the hosted website above.** Local setup is for someone who wants to run or modify a separate copy.

You need Python 3.13 and Node.js 22. Unzip the source and open a terminal in its top-level folder, where this README is located.

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env.local
```

On Windows PowerShell, activate with `.venv\Scripts\Activate.ps1` and copy the template with `Copy-Item .env.example .env.local` instead.

Open `.env.local` in a text editor:

- Set `APP_PASSWORD` to your own strong password of at least 12 characters.
- Leave `OPENAI_API_KEY` blank to browse the fictional workbook without AI analysis.
- **For new PDF screening and extraction locally, provide your own OpenAI API key. No key is included, and a local copy does not use the hosted website’s connection.** Any resulting API usage belongs to that key’s account.
- Keep `COOKIE_SECURE=false` for local HTTP. Never share or commit this configuration file.

Then run:

```sh
npm ci --prefix frontend
npm run build --prefix frontend
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Open **http://127.0.0.1:8000** and sign in with the password you set. The first start imports the fictional workbook; there are no preloaded real papers or hosted reviews. The local database and uploaded PDFs are saved in `runtime/`. Upload the supplied PDFs to review them; reset becomes available only after all four originals have been uploaded and screened. Later workbook edits do not automatically overwrite imported records.
