import React from "react";
import { isReferenceCorrection } from "./sourceMatch";
import {
  Upload,
  FileText,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { api, post } from "./api";
import { Busy, Notice, Field, Source, Status } from "./components";

export default function Review({ paperId, onOpen, onLibrary, onChange }) {
  const [paper, setPaper] = React.useState(null),
    [error, setError] = React.useState(""),
    [busy, setBusy] = React.useState(false),
    [message, setMessage] = React.useState(""),
    [stage, setStage] = React.useState(1),
    [citation, setCitation] = React.useState(null);
  const [decision, setDecision] = React.useState("Needs clarification"),
    [reason, setReason] = React.useState(""),
    [reviewer, setReviewer] = React.useState(
      sessionStorage.getItem("reviewer") || "",
    ),
    [classification, setClassification] = React.useState("Unclear"),
    [link, setLink] = React.useState(""),
    [existingStudies, setExistingStudies] = React.useState([]);
  const [edit, setEdit] = React.useState(null),
    [confirm, setConfirm] = React.useState(false);
  const load = React.useCallback(async () => {
    const p = await api("/papers/" + paperId);
    setPaper(p);
    return p;
  }, [paperId]);
  React.useEffect(() => {
    setError("");
    setMessage("");
    setPaper(null);
    setCitation(null);
    setConfirm(false);
    if (!paperId) {
      setStage(1);
      return;
    }
    let active = true;
    api("/library?origin=real")
      .then((data) => {
        if (active) setExistingStudies(data.studies);
      })
      .catch((e) => active && setError(e.message));
    api("/papers/" + paperId)
      .then((p) => {
        if (!active) return;
        setPaper(p);
        setStage(p.decision === "Include" ? 3 : 2);
        setDecision(
          p.decision === "Pending"
            ? p.screening?.recommendation || "Needs clarification"
            : p.decision,
        );
        setReason(p.reason || "");
        setClassification(
          p.treatment_class || p.screening?.treatment_class || "Unclear",
        );
        setLink(p.study_id || "");
        setEdit(p.draft || (p.extraction ? makeDraft(p) : null));
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [paperId]);
  React.useEffect(() => {
    if (!paper?.job) return;
    const timer = setInterval(
      () => load().catch((e) => setError(e.message)),
      2500,
    );
    return () => clearInterval(timer);
  }, [paper?.job, load]);
  React.useEffect(() => {
    if (paper?.extraction && !edit) setEdit(makeDraft(paper));
  }, [paper?.extraction, edit]);
  React.useEffect(() => {
    if (paper?.screening && paper.decision === "Pending") {
      setDecision(paper.screening.recommendation);
      setClassification(paper.screening.treatment_class);
    }
  }, [paper?.screening]);
  async function run(fn) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file) {
    if (!file) return;
    await run(async () => {
      const f = new FormData();
      f.append("file", file);
      const r = await post("/upload", f);
      onOpen(r.id);
      if (r.duplicate)
        setMessage(
          "This paper is already saved. Its existing review has been opened.",
        );
    });
  }
  async function analyze(task) {
    await run(async () => {
      await post(`/papers/${paper.id}/analyze/${task}`, {});
      await load();
    });
  }
  async function saveDecision() {
    await run(async () => {
      sessionStorage.setItem("reviewer", reviewer);
      const p = await post(`/papers/${paper.id}/decision`, {
        decision,
        reason,
        reviewer,
        treatment_class: classification,
        version: paper.version,
        linked_study_id: link || null,
      });
      setPaper(p);
      onChange();
      if (decision === "Include") setStage(3);
      else
        setMessage(
          "Decision saved. This paper remains accessible in Review History.",
        );
    });
  }
  async function saveExtraction(approve) {
    await run(async () => {
      const body = { ...edit, reviewer, version: paper.version };
      const p = await post(
        `/papers/${paper.id}/${approve ? "approve" : "draft"}`,
        body,
      );
      setPaper(p);
      onChange();
      setConfirm(false);
      if (approve) {
        setStage(4);
        setMessage(
          "Review saved. Approved results are now available in the Evidence Library.",
        );
      } else setMessage("Draft saved. Results have not been published.");
    });
  }
  function updateResult(i, key, value) {
    setEdit((e) => ({
      ...e,
      outcomes: e.outcomes.map((r, n) =>
        n === i
          ? { ...r, data: { ...r.data, [key]: value === "" ? null : value } }
          : r,
      ),
    }));
  }
  const screen = paper?.screening;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Review a Paper</h1>
          <p>
            Check the evidence, record your decision, and approve the results.
          </p>
        </div>
        {paperId && (
          <button onClick={() => onOpen(null)}>
            <Upload size={16} /> Upload another paper
          </button>
        )}
      </div>
      <ol className="steps">
        {["Upload", "Screening", "Extraction", "Approval"].map((s, i) => (
          <li
            key={s}
            className={stage === i + 1 ? "active" : stage > i + 1 ? "done" : ""}
          >
            <span>{stage > i + 1 ? <CheckCircle2 size={17} /> : i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      {error && <Notice type="error">{error}</Notice>}
      {message && <Notice type="success">{message}</Notice>}
      {!paperId ? (
        <>
          <label
            className={"upload-zone " + (busy ? "disabled" : "")}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy) upload(e.dataTransfer.files[0]);
            }}
          >
            <Upload size={34} />
            <h2>Choose a research paper</h2>
            <p>Drop a PDF here or browse your files.</p>
            <span className="primary">Browse files</span>
            <input
              disabled={busy}
              type="file"
              accept="application/pdf,.pdf"
              aria-label="Upload PDF"
              onChange={(e) => upload(e.target.files[0])}
            />
            <small>Searchable PDF · Up to 12 MB · Up to 40 pages</small>
          </label>
          <Notice>
            We’ll check the paper against the review criteria. You confirm the
            screening decision and approve any extracted results.
          </Notice>
          {busy && <Busy>Reading your document…</Busy>}
        </>
      ) : !paper ? (
        <Busy />
      ) : (
        <>
          <div className="file-row">
            <FileText size={28} />
            <div>
              <strong>{screen?.title || paper.filename}</strong>
              <span>
                {screen?.author_year || paper.filename} · Real publication ·{" "}
                {paper.page_count} pages
              </span>
            </div>
          </div>
          {paper.error && <Notice type="error">{paper.error}</Notice>}
          {paper.job && (
            <Busy>
              {paper.job === "screen"
                ? "Checking eligibility and supporting evidence…"
                : "Preparing study details and selected results…"}{" "}
              You can return from Review History.
            </Busy>
          )}
          {stage === 2 &&
            (!screen ? (
              <div className="empty">
                <h2>Ready to screen</h2>
                <p>
                  Read this paper against the population, treatment, comparator
                  and study-design criteria.
                </p>
                <button
                  className="primary"
                  disabled={busy || !!paper.job}
                  onClick={() => analyze("screen")}
                >
                  {paper.error ? "Retry screening" : "Screen paper"}
                </button>
              </div>
            ) : (
              <div className="review-grid">
                <section className="review-panel">
                  <span className="screening-label">
                    Suggested decision · your review required
                  </span>
                  <h2
                    className={
                      "recommendation " +
                      (screen.recommendation === "Include" ? "teal" : "amber")
                    }
                  >
                    {screen.recommendation}
                  </h2>
                  <p>{screen.reason}</p>
                  {screen.warnings
                    .filter((w) => !isReferenceCorrection(w))
                    .map((w, i) => (
                      <Notice key={i} type="warning">
                        {w}
                      </Notice>
                    ))}
                  <h3>Criteria review</h3>
                  <div className="criteria">
                    {screen.criteria.map((c, i) => (
                      <button
                        className="criterion"
                        key={i}
                        onClick={() =>
                          setCitation({ ...c.evidence, criterion: c.name })
                        }
                      >
                        <div>
                          <strong>{c.name}</strong>
                          <span>{c.reason}</span>
                        </div>
                        <Status value={c.status} />
                      </button>
                    ))}
                  </div>
                  <h3>Treatment attribution</h3>
                  <p>{screen.attribution_note}</p>
                  {paper.related_candidates.length > 0 && (
                    <Notice type="warning">
                      A matching publication or trial identifier was found.
                      Check the existing study before creating another one.
                      {paper.related_candidates.map((c) => (
                        <p key={c.paper_id}>
                          {c.title}
                          {c.study_id && (
                            <button onClick={() => setLink(c.study_id)}>
                              Link this study
                            </button>
                          )}
                        </p>
                      ))}
                    </Notice>
                  )}
                  <h3>Your decision</h3>
                  <fieldset className="radios">
                    <legend className="sr-only">
                      Final screening decision
                    </legend>
                    {["Include", "Exclude", "Needs clarification"].map((v) => (
                      <label key={v}>
                        <input
                          name="decision"
                          type="radio"
                          value={v}
                          checked={decision === v}
                          onChange={() => setDecision(v)}
                        />
                        {v}
                      </label>
                    ))}
                  </fieldset>
                  <label className="field">
                    <span>Treatment classification</span>
                    <select
                      value={classification}
                      onChange={(e) => setClassification(e.target.value)}
                    >
                      <option>Unclear</option>
                      <option>Albumin</option>
                      <option>Combination</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Which study does this paper belong to?</span>
                    <select
                      value={link}
                      disabled={!!paper.study_id}
                      onChange={(e) => setLink(e.target.value)}
                    >
                      <option value="">New study</option>
                      {existingStudies.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                    <small>
                      {paper.study_id
                        ? "This paper is already linked to a study. The link cannot be changed here."
                        : "If this paper updates or corrects a study already in your library, select that study. Otherwise, leave ‘New study’ selected."}
                    </small>
                  </label>
                  <Field
                    label="Reviewer name"
                    value={reviewer}
                    onChange={setReviewer}
                    required
                    placeholder="Enter your name"
                    maxLength={100}
                  />
                  <Field
                    label="Reason for your decision"
                    value={reason}
                    onChange={setReason}
                    required
                    area
                    placeholder="Explain your decision, including any uncertainty"
                    maxLength={4000}
                  />
                  <button
                    className="primary"
                    disabled={busy || !!paper.job}
                    onClick={saveDecision}
                  >
                    Save decision{" "}
                    {decision === "Include" && <ArrowRight size={16} />}
                  </button>
                </section>
                <Source
                  paper={paper}
                  referenceWarnings={screen.warnings.filter(
                    isReferenceCorrection,
                  )}
                  citation={
                    citation ||
                    (() => {
                      const first = screen.criteria.find(
                        (c) => c.evidence?.quote,
                      );
                      return first
                        ? { ...first.evidence, criterion: first.name }
                        : null;
                    })()
                  }
                />
              </div>
            ))}
          {stage === 3 &&
            (!paper.extraction ? (
              <div className="empty">
                <h2>Study included</h2>
                <p>
                  Prepare study characteristics and up to two relevant outcomes
                  for your review.
                </p>
                <button
                  className="primary"
                  disabled={busy || !!paper.job}
                  onClick={() => analyze("extract")}
                >
                  {paper.error ? "Retry extraction" : "Prepare extraction"}
                </button>
                <button className="text-button" onClick={() => setStage(2)}>
                  Review screening decision
                </button>
              </div>
            ) : (
              edit && (
                <div className="review-grid extraction-grid">
                  <section className="review-panel">
                    <Notice>
                      These are AI-proposed fields. Check the source, make
                      corrections, and approve each result separately.
                    </Notice>
                    {paper.extraction.warnings.length > 0 && (
                      <details className="review-notes">
                        <summary>
                          Review {paper.extraction.warnings.length} source and
                          consistency notes
                        </summary>
                        <ul>
                          {paper.extraction.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                    <h2>Study details</h2>
                    <div className="form-grid">
                      {[
                        ["author", "Author / year"],
                        ["acronym", "Study name"],
                        ["design", "Study design"],
                        ["country", "Country"],
                        ["population", "Population"],
                        ["treatment", "Treatment"],
                        ["comparator", "Comparator"],
                        ["treatment_n", "Treatment sample size"],
                        ["control_n", "Control sample size"],
                        ["follow_up", "Study follow-up"],
                        ["notes", "Notes"],
                      ].map(([k, label]) => (
                        <Field
                          key={k}
                          label={label}
                          value={edit.characteristics[k]}
                          onChange={(v) =>
                            setEdit((e) => ({
                              ...e,
                              characteristics: {
                                ...e.characteristics,
                                [k]: v || null,
                              },
                            }))
                          }
                          area={["population", "treatment", "notes"].includes(
                            k,
                          )}
                        />
                      ))}
                    </div>
                    <div className="study-source-links">
                      {edit.characteristics.evidence?.map((c, i) => (
                        <button
                          className="text-button"
                          key={i}
                          onClick={() => setCitation(c)}
                        >
                          View study source {i + 1} · page {c.page}
                        </button>
                      ))}
                    </div>
                    <h2>Selected outcomes</h2>
                    <p className="muted">
                      Blank means not captured. NR means not reported. Zero is
                      an explicit reported value.
                    </p>
                    {!edit.outcomes.length && (
                      <Notice>
                        No sufficiently supported outcomes were found. You can
                        save the study details without adding numerical results.
                      </Notice>
                    )}
                    {edit.outcomes.map((r, i) => (
                      <article className="result-editor" key={i}>
                        <div className="section-head">
                          <h3>Outcome {i + 1}</h3>
                          <button onClick={() => setCitation(r.data)}>
                            View source
                          </button>
                        </div>
                        {r.data.uncertainty && (
                          <Notice type="warning">{r.data.uncertainty}</Notice>
                        )}
                        <div className="form-grid">
                          {[
                            ["name", "Outcome"],
                            ["definition", "Definition"],
                            ["measure", "Measure"],
                            ["units", "Units"],
                            ["treatment_value", "Treatment result"],
                            ["control_value", "Control result"],
                            ["treatment_n", "Treatment denominator"],
                            ["control_n", "Control denominator"],
                            ["analysis_population", "Analysis population"],
                            ["follow_up", "Outcome follow-up"],
                            ["page", "PDF page"],
                            ["location", "Table / section"],
                            ["quote", "Source quote"],
                            ["uncertainty", "Uncertainty"],
                          ].map(([k, label]) => (
                            <Field
                              key={k}
                              label={label}
                              value={r.data[k]}
                              onChange={(v) =>
                                updateResult(
                                  i,
                                  k,
                                  k === "page" ? (v ? Number(v) : null) : v,
                                )
                              }
                              type={k === "page" ? "number" : "text"}
                              min={k === "page" ? 1 : undefined}
                              max={k === "page" ? paper.page_count : undefined}
                              area={[
                                "quote",
                                "uncertainty",
                                "definition",
                              ].includes(k)}
                            />
                          ))}
                        </div>
                        <label className="field">
                          <span>Result decision</span>
                          <select
                            value={r.status}
                            onChange={(e) =>
                              setEdit((x) => ({
                                ...x,
                                outcomes: x.outcomes.map((v, n) =>
                                  n === i
                                    ? { ...v, status: e.target.value }
                                    : v,
                                ),
                              }))
                            }
                          >
                            <option value="pending">Keep pending</option>
                            <option value="approved">Approve result</option>
                            <option value="withheld">Withhold result</option>
                          </select>
                        </label>
                        {paper.linked_results?.length > 0 && (
                          <label className="field">
                            <span>
                              Replaces an earlier result from this study
                            </span>
                            <select
                              value={r.supersedes_id || ""}
                              onChange={(e) =>
                                setEdit((x) => ({
                                  ...x,
                                  outcomes: x.outcomes.map((v, n) =>
                                    n === i
                                      ? {
                                          ...v,
                                          supersedes_id: e.target.value || null,
                                        }
                                      : v,
                                  ),
                                }))
                              }
                            >
                              <option value="">
                                No replacement — distinct result
                              </option>
                              {paper.linked_results.map((old) => (
                                <option key={old.id} value={old.id}>
                                  {old.data.name} · {old.data.measure} ·{" "}
                                  {old.data.follow_up}
                                </option>
                              ))}
                            </select>
                            <small>
                              Check for overlapping results. Replaced results
                              remain in the record as superseded.
                            </small>
                          </label>
                        )}
                        <Field
                          label="Result review note"
                          value={r.note}
                          onChange={(v) =>
                            setEdit((x) => ({
                              ...x,
                              outcomes: x.outcomes.map((r, n) =>
                                n === i ? { ...r, note: v } : r,
                              ),
                            }))
                          }
                          area
                          placeholder="Explain any correction, uncertainty or withheld result"
                        />
                      </article>
                    ))}
                    <Field
                      label="Reviewer name"
                      value={reviewer}
                      onChange={setReviewer}
                      required
                    />
                    <Field
                      label="Review note"
                      value={edit.reason}
                      onChange={(v) => setEdit((e) => ({ ...e, reason: v }))}
                      required
                      area
                      placeholder="Summarize what you checked or corrected"
                    />
                    {confirm ? (
                      <div className="confirmation">
                        <h3>Confirm this review</h3>
                        <p>
                          {
                            edit.outcomes.filter((r) => r.status === "approved")
                              .length
                          }{" "}
                          approved results will appear in the library. Other
                          results remain pending or withheld.
                        </p>
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() => saveExtraction(true)}
                        >
                          Confirm and save review
                        </button>
                        <button onClick={() => setConfirm(false)}>
                          Keep editing
                        </button>
                      </div>
                    ) : (
                      <div className="actions">
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() => setConfirm(true)}
                        >
                          Review and publish
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => saveExtraction(false)}
                        >
                          Save draft
                        </button>
                        <button
                          className="text-button"
                          onClick={() => setStage(2)}
                        >
                          Screening decision
                        </button>
                      </div>
                    )}
                  </section>
                  <Source
                    paper={paper}
                    citation={citation || edit.outcomes[0]?.data}
                  />
                </div>
              )
            ))}
          {stage === 4 && (
            <div className="empty success-state">
              <CheckCircle2 size={42} />
              <h2>Review saved</h2>
              <p>
                {paper.results.filter((r) => r.status === "approved").length}{" "}
                approved results. Pending and withheld results remain available
                in this review.
              </p>
              <button className="primary" onClick={onLibrary}>
                View Evidence Library <ArrowRight size={16} />
              </button>
              <button onClick={() => setStage(3)}>Review extraction</button>
            </div>
          )}
        </>
      )}
    </>
  );
}
function makeDraft(p) {
  return {
    characteristics: p.extraction.characteristics,
    outcomes: p.extraction.outcomes.map((data) => ({
      data,
      status: "pending",
      note: "",
    })),
    reviewer: "",
    reason: "",
    version: p.version,
  };
}
