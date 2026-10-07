# Submission verification — October 7, 2026

This maps the supplied assignment and Rahul’s clarification to the implementation.
It is a software verification record, not clinical adjudication of the publications.

## Requirements

| Requirement | Implementation / evidence |
| --- | --- |
| Import the supplied workbook as-is | Original XLSX retained; 7 studies, 34 outcome rows, 11 fictional sources. Older README counts are not treated as missing data. |
| Study, outcome and follow-up exploration | Evidence Library filters and expandable result cards. |
| Identify material data-quality issues | Explicit source-based dispositions in `backend/workbook.py`; raw values, source excerpts, revised values and unresolved notes retained. |
| Keep fictional and real evidence separate | Separate origin selector, records and library queries; no mixed numeric synthesis. |
| Screen uploaded PDFs beyond the supplied four | Generic searchable-PDF text extraction and structured screening against the same criteria. No filename-based screening answers. |
| Explain recommendations with sources | Criteria, suggested decision, treatment classification and source passages with PDF page references. |
| Human decision and audit trail | Include / Exclude / Needs clarification; required name and reason; server timestamp and versioned history. Names are not verified accounts. |
| Propose characteristics and up to two outcomes | Structured extraction, editable fields, units, denominators, follow-up, source quote and location. Missing data is not fabricated. |
| Separate study inclusion from result approval | Individual pending / approved / withheld decisions; inclusion alone does not approve results. |
| Update evidence while retaining pending/excluded records | Library shows included studies with labelled result states; History retains all papers. |
| Avoid incompatible numerical pooling | Results remain as reported; no pooled treatment-effect calculation. |
| Repeated upload and related reports | SHA-256 reopens identical files; identifier candidates and explicit study linkage; explicit correction replacement with retained history. |
| Manual/simulated work disclosed | README and Help distinguish automation, human review, fictional workbook records and isolated test simulations. |
| Runnable code and documentation | Locked frontend dependencies, pinned Python requirements, Dockerfile, Render configuration, setup steps and this checklist. |

## Current automated verification

- 21 backend tests pass in temporary databases, without paid model calls.
- 4 frontend unit tests pass: issue filtering, quote matching and field-error navigation mapping.
- Production frontend build passes.
- Browser checks at 1440px and 390px: Help sections, reset warning, no horizontal page overflow, and no uncaught JavaScript errors.
- Browser navigation check: an existing extraction can be reopened from History; the main Review a Paper tab returns to fresh upload; History can reopen the saved paper again.
- Screening-change regression: approval choices in saved drafts return to Pending; superseded results cannot be revived by changing the screening decision.
- Production frontend dependency audit: npm reported zero known vulnerabilities (this is not a complete security assessment).
- Correction regression: a reopened correction saves without repeating its completed replacement action; the original stays superseded and retains one replacement event.
- Authenticated read-only hosted checks confirm workbook counts and accessible paper/library routes. No live decisions were changed by this audit.

Backend coverage includes missing versus zero, duplicate uploads, unreadable and encrypted files, protected downloads, approval/revocation, stale saves, drafts, quote checks, model failure and spending guard, reviewer treatment overrides, reset/backup safeguards and latest-decision summaries.

The browser navigation/Help checks use mocked API responses. The backend tests use synthetic PDFs. They do not establish numerical accuracy on every possible PDF. Earlier real-paper evaluation and the reviewer’s checks remain distinct from these regression tests. No new paid model evaluation was performed in this final documentation pass.

## Before sending

1. Complete and demonstrate the review of all four supplied PDFs. For eligible papers, show corrections, individual result approval and incorporation into the library. Human decisions are not replaced by automated tests.
2. Demonstrate re-uploading one identical PDF and opening its existing record.
3. Record a short walkthrough or write the requested email description. A video is optional under the assignment; a description is an alternative.
4. Share the hosted URL, workspace password separately, and source ZIP (or private repository access). A repository URL alone does not grant access.
5. Review any test decisions still in the shared workspace. In the read-only snapshot during this audit, three original papers were Pending and MACHT needed clarification. The additional ATTIRE test paper was manually included with two approved results; its acute-inpatient setting needs reconsideration against the outpatient-maintenance scope before presenting it as included evidence. These are reviewer tasks, not silently changed by the application audit.

## Known boundaries

- Searchable PDFs only; no OCR, graph digitization, automatic literature search or meta-analysis.
- Exact quote matching establishes text presence, not interpretation. AI explanations and consistency notes can also be wrong; verify them against the PDF.
- Identical-file deduplication is reliable for the same bytes; different versions still require identity review.
- A shared password and entered reviewer names do not provide individual identity verification.
- Save unfinished drafts before navigating away. Shared edits are protected by version checks, not collaborative live editing.
- Backups contain PDFs and JSON records; no in-app restore. Reset affects everyone and is blocked until all four original papers and screening caches are present.
- Service availability and arbitrary-PDF accuracy cannot be guaranteed. The app preserves saved work on handled failures and requires human approval.
