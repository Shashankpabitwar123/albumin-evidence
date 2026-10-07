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
