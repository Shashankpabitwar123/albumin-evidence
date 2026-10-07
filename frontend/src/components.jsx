import React from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  X,
} from "lucide-react";
import { shown } from "./api";

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
export function Source({ paper, citation }) {
  const [page, setPage] = React.useState(citation?.page || 1);
  React.useEffect(() => setPage(citation?.page || 1), [citation?.page]);
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
      <label className="field">
        <span>PDF page</span>
        <select value={page} onChange={(e) => setPage(Number(e.target.value))}>
          {paper.pages.map((_, i) => (
            <option key={i} value={i + 1}>
              {i + 1} of {paper.pages.length}
            </option>
          ))}
        </select>
      </label>
      {citation?.quote && (
        <blockquote>
          <strong>
            {shown(citation.location)} · PDF page{" "}
            {citation.page || "unconfirmed"}
          </strong>
          <p>{citation.quote}</p>
        </blockquote>
      )}
      <details open>
        <summary>Page text</summary>
        <pre className="page-text">{paper.pages[page - 1]}</pre>
      </details>
      <p className="muted small">
        Page numbers refer to this PDF. Check the original page when a table or
        scanned text is unclear.
      </p>
    </aside>
  );
}
