import React from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  X,
} from "lucide-react";
import { shown } from "./api";
import { quoteRange } from "./sourceMatch";

export function Notice({ children, type = "info" }) {
  return (
    <div
      className={"notice " + type}
      role={type === "error" ? "alert" : "status"}
    >
      <AlertCircle size={19} />
      <div>{children}</div>
    </div>
  );
}
export function Busy({ children = "Loading…" }) {
  return (
    <div className="busy" role="status">
      <LoaderCircle size={20} className="spin" />
      {children}
    </div>
  );
}
export function Status({ value }) {
  const good = ["approved", "qualified", "Include", "Supported"].includes(
    value,
  );
  return (
    <span className={"status " + (good ? "good" : "attention")}>
      {good ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}{" "}
      {value === "approved"
        ? "Approved"
        : value === "qualified"
          ? "Approved with note"
          : value}
    </span>
  );
}
export function Field({
  label,
  value,
  onChange,
  area = false,
  required = false,
  ...props
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      {area ? (
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          {...props}
        />
      ) : (
        <input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          {...props}
        />
      )}
    </label>
  );
}
export function Modal({ title, onClose, children }) {
  React.useEffect(() => {
    const fn = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);
  return (
    <div className="overlay">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
      >
        <div className="section-head">
          <h2>{title}</h2>
          <button className="icon" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function Source({ paper, citation, referenceWarnings = [] }) {
  const [page, setPage] = React.useState(citation?.page || 1);
  const [highlight, setHighlight] = React.useState(null);
  const [matchError, setMatchError] = React.useState("");
  const detailRef = React.useRef(null),
    markRef = React.useRef(null);
  React.useEffect(() => {
    setPage(citation?.page || 1);
    setHighlight(null);
    setMatchError("");
  }, [paper.id, citation?.page, citation?.quote]);
  React.useEffect(() => {
    if (highlight) markRef.current?.scrollIntoView({ block: "nearest" });
  }, [highlight]);
  function revealQuote() {
    const target = citation?.page;
    const range = quoteRange(paper.pages[target - 1], citation?.quote);
    setPage(target || 1);
    detailRef.current.open = true;
    setHighlight(range);
    setMatchError(
      range
        ? ""
        : "Couldn’t locate a unique matching passage in the page text. Open the PDF to check.",
    );
  }
  const pageText = paper.pages[page - 1] || "";
  return (
    <aside className="source-panel">
      <div className="section-head">
        <h2>Supporting source</h2>
        <a
          href={`/api/papers/${paper.id}/pdf#page=${page}`}
          target="_blank"
          rel="noreferrer"
        >
          Open PDF <ExternalLink size={14} />
        </a>
      </div>
      {citation?.criterion && (
        <p className="evidence-label">
          Evidence for: <strong>{citation.criterion}</strong>
        </p>
      )}
      <label className="field">
        <span>PDF page</span>
        <select
          value={page}
          onChange={(e) => {
            setPage(Number(e.target.value));
            setHighlight(null);
            setMatchError("");
          }}
        >
          {paper.pages.map((_, i) => (
            <option key={i} value={i + 1}>
              {i + 1} of {paper.pages.length}
            </option>
          ))}
        </select>
      </label>
      {citation?.quote && (
        <blockquote
          className="clickable-quote"
          role="button"
          tabIndex={0}
          aria-label="Highlight this passage in page text"
          onClick={revealQuote}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              revealQuote();
            }
          }}
        >
          <strong>
            {shown(citation.location)} · PDF page{" "}
            {citation.page || "unconfirmed"}
          </strong>
          <p>{citation.quote}</p>
        </blockquote>
      )}
      {citation?.reference_check && (
        <details>
          <summary>Reference check details</summary>
          <p>
            The page reference was corrected from{" "}
            {citation.reference_check.original_page || "unconfirmed"} to{" "}
            {citation.reference_check.verified_page} after matching the quoted
            text.
          </p>
        </details>
      )}
      {!citation?.reference_check && referenceWarnings.length > 0 && (
        <details>
          <summary>Reference check details</summary>
          <p>
            Earlier screening reference checks are recorded below. These older
            records do not identify which passage was corrected; they may refer
            to a different criterion.
          </p>
          {referenceWarnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </details>
      )}
      {matchError && <Notice type="warning">{matchError}</Notice>}
      <details open ref={detailRef}>
        <summary>Page text</summary>
        <pre className="page-text">
          {highlight ? (
            <>
              {pageText.slice(0, highlight[0])}
              <mark ref={markRef}>{pageText.slice(...highlight)}</mark>
              {pageText.slice(highlight[1])}
            </>
          ) : (
            pageText
          )}
        </pre>
      </details>
      <p className="muted small">
        Page numbers refer to this PDF. Check the original page when a table or
        scanned text is unclear.
      </p>
    </aside>
  );
}
