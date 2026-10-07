# Albumin Evidence

A website for maintaining a review of research on long-term outpatient albumin in adults with cirrhosis and ascites. Reviewers can explore existing evidence, screen new PDFs, check extracted information and approve results for the evidence library.

## Open the website

**Website:** https://albumin-evidence.onrender.com

**Password:** supplied in the private handoff README.

No installation, OpenAI account or API key is needed to use the website. Open the link and enter the shared workspace password.

## What you can do

- **Evidence Library:** explore studies and filter results by study, outcome and follow-up. See source references, original values and data-quality notes.
- **Review a Paper:** upload a searchable PDF, check the suggested eligibility decision and record your decision with a name and reason.
- **Extraction and approval:** review the proposed study details and up to two outcomes, such as deaths or hospital admissions. Correct fields and approve each result separately. Approved results appear in the library; unresolved results remain labelled.
- **Review History:** reopen papers and inspect earlier decisions. Uploading the identical file opens its existing review rather than creating a duplicate.

The website’s **Help** explains the controls. Save a draft before leaving unfinished work.

## Design choices and assumptions

The original fictional workbook is preserved: 7 studies, 34 outcome rows and 11 source records. Its baseline study eligibility is accepted, but extracted results are checked against its fictional source excerpts. Supported errors are corrected with explanations; missing or conflicting information stays flagged. Blank, “not reported” and zero remain distinct.

Fictional workbook evidence and real publications are kept separate. Different outcome measures are not pooled. Study inclusion and approval of individual results are separate decisions. Related reports and corrections require reviewer confirmation.

The app uses React for the interface, Python/FastAPI for the workflow and SQLite for saved records. AI proposes screening and extraction; application code handles source matching, duplicate checks and storage. **A human reviewer checks the sources and makes the final decisions.** Code and documentation were developed with Codex assistance; automated tests use isolated synthetic records.

## Limitations

- Searchable PDFs only, up to 12 MB and 40 pages. OCR and graph digitization are not included.
- AI can misread text or tables. Matching a quote does not prove its interpretation is correct.
- No automatic literature search, comprehensive extraction or meta-analysis.
- This is a shared workspace, not separate user accounts. Reset affects everyone. Download a backup first if needed; backups cannot be restored through the website.

## Code and data

**Repository:** https://github.com/Shashankpabitwar123/albumin-evidence

The source ZIP includes the application code, original fictional workbook and tests. Real PDFs and hosted review records are not bundled with the code. The private repository requires access; the ZIP can be inspected without GitHub access.

Developer setup, local-run instructions and test commands are in [Technical notes](docs/TECHNICAL.md). Local AI analysis requires your own API key; no OpenAI key is included. The hosted website is ready to use without that setup.
