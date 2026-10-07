import React from "react";
import { Modal } from "./components";
import ResetWorkspace from "./ResetWorkspace";

// Keep reviewer guidance together, separate from login and navigation.
export default function Help({ criteria, onClose, onReset }) {
  return (
    <Modal title="Review guidance" onClose={onClose}>
      <h3>Start here</h3>
      <p>
        Explore existing evidence, review a new paper, then approve the results
        you have checked. This is a shared workspace: saved changes are visible
        to everyone with access.
      </p>
      <ol>
        <li><strong>Evidence Library:</strong> browse studies and filter by outcome
          and follow-up. Workbook records are fictional; publications are real.
          These sources stay separate.</li>
        <li><strong>Review a Paper:</strong> start a new upload. Check the suggested
          decision and its sources, then record your decision, name and reason.</li>
        <li><strong>Extraction:</strong> for an included paper, check the proposed
          study details and up to two outcomes. An outcome is something the study
          measured, such as deaths or time spent in hospital.</li>
        <li><strong>Approval:</strong> choose a decision for each result, add your
          review note, and confirm. Including a study does not approve its results.</li>
        <li><strong>Review History:</strong> use Open review to return to an existing
          paper, including pending and excluded papers. Last decision shows the
          latest saved screening or extraction review. History shows earlier events.</li>
      </ol>
      <details>
        <summary>Eligibility and treatment classification</summary>
        <p className="preserve">{criteria}</p>
        <p>Include means the paper fits the review. Exclude means it does not.
          Needs clarification keeps an uncertain decision open. The reviewer can
          override the suggestion with a reason. For combination treatment,
          confirm the classification; do not attribute a combined effect to
          albumin alone.</p>
      </details>
      <details>
        <summary>Checking sources and saving a review</summary>
        <p>Use the criterion or View source control to see its supporting passage.
          Select the passage to highlight matching page text, or open the original
          PDF. Page numbers refer to the uploaded PDF. A matching quote confirms
          where text appears; it does not prove the interpretation is correct.</p>
        <p>Correct the proposed fields before approval. Save a draft to keep
          unfinished edits before leaving the page. Confirm and save review records
          your result decisions. If a field needs attention, the page moves to the
          error message; select the listed error to reach that field.</p>
        <p>Blank means not captured, NR means not reported, and 0 means an explicit
          zero. Do not guess missing values. Keep unresolved results pending, or
          withhold them with a reason. A recorded uncertainty needs an explanation
          before approval.</p>
      </details>
      <details>
        <summary>Library results and data issues</summary>
        <p>Expand a study to see its results and review details. Approved results
          are labelled; pending and withheld results remain visible for context.
          Different measures and follow-up periods are not pooled.</p>
        <p>Review data issues filters to results that are not fully approved or
          have recorded uncertainty. Show all results removes that extra filter.
          The two views can look the same if every result has a note or still
          needs review. Approval does not erase a limitation in the source.</p>
        <p>A note saying a fictional result was checked against its supplied
          excerpt is a verification note, not by itself a data issue. Workbook
          corrections and original values remain available in the result details.</p>
      </details>
      <details>
        <summary>Duplicate papers and corrections</summary>
        <p>Uploading the identical file reopens its saved review. Matching DOI or
          trial identifiers flag possible related reports, but a reviewer confirms
          whether they belong to the same study. When including a related report,
          select the existing study instead of creating a new one.</p>
        <p>A correction can explicitly replace an approved result from that study.
          The previous result is marked superseded and its history is retained.
          Different file versions without matching identifiers need manual checking.</p>
      </details>
      <details>
        <summary>Automation, reviewer responsibilities and limits</summary>
        <p>The application reads PDF text, uses AI to suggest screening and
          extraction, checks matching source passages and possible inconsistencies,
          detects identical files, and updates the library after your review.
          Suggestions can be wrong even when no warning appears.</p>
        <p>You decide eligibility, treatment classification, study linkage and
          result approval. Reviewer names are entered labels, not verified accounts.
          The workbook and its excerpts are fictional; uploaded papers do not
          validate those mock values.</p>
        <p>Upload searchable PDFs up to 12 MB and 40 pages. Scanned files need OCR
          first. Graph-only values are not digitized. Tables and text columns may
          be misread, so check the original PDF. This workspace does not search for
          publications automatically or calculate a pooled treatment effect.</p>
        <p>If analysis fails, the uploaded paper remains available in Review
          History. Follow the displayed message before retrying. If another person
          changes a review, reload it before saving to avoid overwriting their work.</p>
      </details>
      <ResetWorkspace onReset={onReset} />
    </Modal>
  );
}
