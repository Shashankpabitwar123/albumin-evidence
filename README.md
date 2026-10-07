# Albumin Evidence

A shared workspace for reviewing research on long-term outpatient albumin in adults with cirrhosis and ascites. It brings existing evidence and new publications into one review process, while keeping fictional workbook data separate from real research.

## Open the website

**[Use Albumin Evidence](https://albumin-evidence.onrender.com)** and enter the workspace password supplied separately.

**No installation, OpenAI account or API key is needed to use the hosted website.** Its analysis connection is already configured on the server. The code ZIP is provided so you can inspect the implementation or run your own copy; running locally is optional.

This is a shared workspace. Saved reviews and resets affect everyone with access. The in-app **Help** explains the controls and review steps.

## How the review works

1. **Explore existing evidence.** In Evidence Library, choose Workbook · fictional or Publications · real. Filter by study, outcome and follow-up, then expand a study to see its results and sources.
2. **Upload and screen a paper.** Review a Paper accepts a searchable PDF. The app suggests Include, Exclude or Needs clarification, with reasons and supporting passages. The reviewer confirms or changes the decision and records a name and reason.
3. **Check the proposed information.** For an included paper, the app prefills study details and up to two outcomes. An outcome is something the study measured, such as deaths or hospital admissions. Check the values, units, denominators, follow-up and source references; correct mistakes and leave missing information missing.
4. **Approve each result.** Keep unresolved results pending or withhold them with a reason. Confirming the review saves individual result decisions and updates the library. Including a paper does not automatically approve its results.
5. **Return to earlier work.** Review History keeps pending, excluded and included papers accessible. Open review reopens a saved paper; History shows previous decisions. Last decision shows the latest screening or extraction review. The main Review a Paper tab starts a fresh upload.

Save a draft before leaving unfinished edits. Field errors move into view and can be selected to reach the affected field. Source passages can be selected to highlight matching page text; the original PDF is also available.

## How data quality is handled

The supplied workbook contains **7 studies, 34 outcome rows and 11 fictional source records**. Its README describes older counts and absent records; the supplied file was used as-is following the assignment clarification. Baseline study eligibility was accepted, while extracted results were checked against the supplied fictional excerpts.

- Supported corrections, such as a wrong outcome label or analysis denominator, are recorded alongside the original extraction.
- Conflicting or unsupported results are withheld; missing information stays unresolved. Duplicate and superseded records remain traceable.
- Blank means not captured, **NR** means not reported, and **0** is an explicit zero.
- **Review data issues** shows results that are not fully approved or have recorded uncertainty. Approval does not remove a source limitation. **Show all results** removes that extra filter.
- Fictional and real results are never combined in numerical summaries. Counts, episodes, rates and survival estimates are not pooled as if they were the same measure.

Result cards contain the handling notes, source details and original values. The raw workbook is preserved in `data/evidence.xlsx`; explicit workbook quality-control rules are in `backend/workbook.py`.

## Important design choices

**Human decisions remain separate from suggestions.** The app assists with reading and organizing evidence; reviewers decide eligibility and approve individual results. Reviewer names are entered labels, not verified individual accounts.

**The review has a defined scope.** It covers adults with cirrhosis and ascites receiving scheduled outpatient albumin, with a concurrent comparator, in randomized or comparative observational studies. Initial hospitalization is allowed if maintenance continues after discharge; acute inpatient treatment alone is outside scope. No extra country, year, dose or duration cutoff is imposed. Combination treatments require explicit classification so their effects are not attributed to albumin alone.

**Repeated uploads do not create another copy.** An identical file reopens its existing review. Matching DOI or trial identifiers flag possible related reports; a reviewer confirms study linkage. A correction can explicitly replace an earlier approved result while retaining its history. Different file versions without matching identifiers require manual checking.

## What is automated and what is manual

| Part | Responsibility |
| --- | --- |
| Workbook import and predefined source-based quality checks | Application code |
| PDF text reading, duplicate-file detection and source-quote matching | Application code |
| Screening, extraction suggestions and a second consistency check | OpenAI-assisted analysis |
| Eligibility, treatment classification, study linkage, corrections and result approval | Human reviewer |
| Saving decisions, audit history and library updates | Application code |

Workbook studies, values and source excerpts are fictional. Real PDFs do not validate them. Automated tests use synthetic papers and isolated databases; test approvals are not human reviews. Code, documentation and tests were developed with Codex assistance.

## Limits to keep in mind

- Searchable PDFs only, up to **12 MB and 40 pages**. Scanned documents need OCR before upload; OCR and graph digitization are not included.
- Tables and text columns can be misread. A matching source quote confirms text presence, not correct interpretation. AI suggestions and consistency notes require checking even when no warning appears.
- The app does not perform automatic literature searches, comprehensive extraction or meta-analysis, and does not provide clinical recommendations.
- Saved reviews are retained on handled analysis failures. Concurrent changes require reloading rather than overwriting another review. Availability and AI accuracy cannot be guaranteed.

## Reset and backup

In **Help → Start fresh**, reset returns the four supplied papers to Pending review, retains their saved analysis suggestions and removes reviewer decisions, drafts, results and additional uploads. The fictional workbook stays unchanged. **Reset affects everyone in the shared workspace.** It requires typing RESET and is blocked during analysis or if the original files/screening are missing.

Download the workspace ZIP backup before resetting if you need the current PDFs, records and history. It supports offline inspection or owner-assisted recovery; **it cannot be imported through the website**. Refresh other open windows after a reset.

## What is in the source ZIP?

| Location | Purpose |
| --- | --- |
| `backend/main.py` | API routes and screening/approval workflow |
| `backend/ai.py`, `schemas.py` | Model requests, source checks and structured data validation |
| `backend/workbook.py` | Workbook import and documented data-quality handling |
| `backend/db.py`, `auth.py`, `workspace.py` | Storage, login, history, reset and backup |
| `frontend/src/` | Library, Review, History, Help and shared interface controls |
| `data/evidence.xlsx` | Original fictional workbook |
| `tests/`, frontend `*.test.js` files | Isolated automated checks |
| `Dockerfile`, `render.yaml` | Hosting configuration |
| `.env.example` | Configuration template with no real credentials |

The ZIP contains source code and the workbook, **not the hosted database, uploaded PDFs, workspace password or OpenAI key**. The four supplied publications must be uploaded separately for a new local installation.

For implementation details, deployment and test commands, see [Technical notes](docs/TECHNICAL.md). For the requirement checklist, verification results and demonstration steps, see [Submission verification](docs/VERIFICATION.md).

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
