import React from "react";
import { ArrowRight, FileSearch, SlidersHorizontal } from "lucide-react";
import { api, shown } from "./api";
import { Busy, Notice, Status } from "./components";

export default function Library({ onReview, refresh, initialOrigin }) {
  const [origin, setOrigin] = React.useState(initialOrigin || "mock"),
    [data, setData] = React.useState(null),
    [error, setError] = React.useState("");
  const [study, setStudy] = React.useState(""),
    [outcome, setOutcome] = React.useState(""),
    [follow, setFollow] = React.useState(""),
    [expanded, setExpanded] = React.useState(null),
    [issues, setIssues] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    api("/library?origin=" + origin)
      .then((v) => active && setData(v))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [origin, refresh]);
  function changeOrigin(value) {
    setOrigin(value);
    setStudy("");
    setOutcome("");
    setFollow("");
    setExpanded(null);
    setIssues(false);
  }
  const all = data?.studies || [],
    allResults = all.flatMap((s) => s.outcomes);
  const names = [...new Set(allResults.map((r) => r.data.name))].sort();
  const periods = [
    ...new Set(allResults.map((r) => r.data.follow_up).filter(Boolean)),
  ].sort();
  const matches = (r) =>
    (!outcome || r.data.name === outcome) &&
    (!follow || r.data.follow_up === follow) &&
    (!issues || r.status !== "approved");
  const studies = all.filter(
    (s) =>
      (!study || s.id === study) &&
      (!(outcome || follow || issues) || s.outcomes.some(matches)),
  );
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Evidence Library</h1>
          <p>Long-term albumin in adults with cirrhosis and ascites</p>
        </div>
        <button className="primary" onClick={() => onReview()}>
          Review a paper <ArrowRight size={17} />
        </button>
      </div>
      <fieldset className="source-switch">
        <legend className="sr-only">Evidence source</legend>
        {[
          ["mock", "Workbook · fictional"],
          ["real", "Publications · real"],
        ].map(([v, t]) => (
          <label key={v}>
            <input
              type="radio"
              name="origin"
              checked={origin === v}
              onChange={() => changeOrigin(v)}
            />
            {t}
          </label>
        ))}
      </fieldset>
      {origin === "mock" ? (
        <Notice type="warning">
          Fictional training data. These results are kept separate from real
          publications.
        </Notice>
      ) : (
        <p className="muted">
          Included publications and their reviewed results. Pending results
          remain visible within each study.
        </p>
      )}
      {error && (
        <Notice type="error">
          {error}{" "}
          <button
            onClick={() => changeOrigin(origin === "mock" ? "real" : "mock")}
          >
            Switch source
          </button>
        </Notice>
      )}
      {!data && !error ? (
        <Busy />
      ) : (
        data && (
          <>
            <p className="summary-line">
              {all.length} studies <span>·</span> {allResults.length} result
              rows <span>·</span>{" "}
              {
                allResults.filter((r) =>
                  ["approved", "qualified"].includes(r.status),
                ).length
              }{" "}
              approved{origin === "mock" ? " after source-based QC" : ""}
            </p>
            <div className="filters">
              {[
                [
                  "Study",
                  study,
                  setStudy,
                  all.map((s) => [s.id, s.title]),
                  "All studies",
                ],
                [
                  "Outcome",
                  outcome,
                  setOutcome,
                  names.map((n) => [n, n]),
                  "All outcomes",
                ],
                [
                  "Follow-up",
                  follow,
                  setFollow,
                  periods.map((n) => [n, n]),
                  "All periods",
                ],
              ].map(([label, value, set, options, empty]) => (
                <label className="field" key={label}>
                  <span>{label}</span>
                  <select value={value} onChange={(e) => set(e.target.value)}>
                    <option value="">{empty}</option>
                    {options.map(([v, t]) => (
                      <option key={v} value={v}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="section-head">
              <h2>Studies</h2>
              <button
                className={"text-button " + (issues ? "selected" : "")}
                onClick={() => setIssues(!issues)}
              >
                <SlidersHorizontal size={16} />
                {issues ? "Show all results" : "Review data issues"}
              </button>
            </div>
            {!studies.length ? (
              <div className="empty">
                <FileSearch size={34} />
                <h2>
                  {all.length
                    ? "No studies match these filters"
                    : "Your publication library starts here"}
                </h2>
                <p>
                  {all.length
                    ? "Try a different study, outcome or follow-up period."
                    : "Review a paper to add its study and approved results."}
                </p>
                <button
                  onClick={() =>
                    all.length
                      ? (setStudy(""),
                        setOutcome(""),
                        setFollow(""),
                        setIssues(false))
                      : onReview()
                  }
                >
                  {all.length ? "Clear filters" : "Review a paper"}
                </button>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Study</th>
                      <th>Design</th>
                      <th>Follow-up</th>
                      <th>Result review</th>
                      <th>
                        <span className="sr-only">Action</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {studies.map((s) => {
                      const c = s.characteristics,
                        visible = s.outcomes.filter(matches),
                        open = expanded === s.id;
                      return (
                        <React.Fragment key={s.id}>
                          <tr>
                            <td className="study-name">
                              <strong>{c.acronym || s.title}</strong>
                              <span>{c.author}</span>
                              {c.treatment_class === "Combination" && (
                                <span className="combination">
                                  Combination treatment
                                </span>
                              )}
                            </td>
                            <td>{shown(c.design)}</td>
                            <td>{shown(c.follow_up)}</td>
                            <td>
                              <span>
                                {
                                  s.outcomes.filter((r) =>
                                    ["approved", "qualified"].includes(
                                      r.status,
                                    ),
                                  ).length
                                }{" "}
                                approved
                              </span>
                              {s.outcomes.some(
                                (r) => !["approved"].includes(r.status),
                              ) && (
                                <span className="small amber block">
                                  {reviewSummary(s.outcomes)}
                                </span>
                              )}
                            </td>
                            <td>
                              <button
                                aria-expanded={open}
                                onClick={() => setExpanded(open ? null : s.id)}
                              >
                                {open ? "Close" : "View"}
                              </button>
                            </td>
                          </tr>
                          {open && (
                            <tr>
                              <td colSpan="5" className="study-detail">
                                <dl className="details-grid">
                                  {[
                                    ["Population", c.population],
                                    ["Treatment", c.treatment],
                                    ["Comparator", c.comparator],
                                    ["Study notes", c.notes],
                                  ].map(([k, v]) => (
                                    <div key={k}>
                                      <dt>{k}</dt>
                                      <dd>{shown(v)}</dd>
                                    </div>
                                  ))}
                                </dl>
                                {s.publications.map((p) => (
                                  <a
                                    className="source-link"
                                    key={p.id}
                                    href={`/api/papers/${p.id}/pdf`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Open {p.filename}
                                  </a>
                                ))}
                                {!visible.length && (
                                  <Notice>
                                    No approved results yet. Complete extraction
                                    review to add results.
                                  </Notice>
                                )}
                                {visible.map((r) => (
                                  <Result
                                    key={r.id}
                                    row={r}
                                    sources={data.sources}
                                  />
                                ))}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="footnote">
              {origin === "mock"
                ? "Baseline study eligibility was accepted. Result corrections and unresolved issues retain their original source records."
                : "Study inclusion and result approval are separate decisions."}{" "}
              Results are shown as reported; incompatible measures are never
              pooled.
            </p>
          </>
        )
      )}
    </>
  );
}
function Result({ row: r, sources }) {
  const d = r.data,
    source = sources.find((s) => s.id === d.source);
  return (
    <article className="result">
      <div className="section-head">
        <h3>{d.name}</h3>
        <Status value={r.status} />
      </div>
      <div className="result-values">
        <div>
          <span>Treatment</span>
          <strong>{shown(d.treatment_value)}</strong>
          <small>Denominator: {shown(d.treatment_n)}</small>
        </div>
        <div>
          <span>Control</span>
          <strong>{shown(d.control_value)}</strong>
          <small>Denominator: {shown(d.control_n)}</small>
        </div>
        <div>
          <span>Measure / units</span>
          <strong className="measure">{shown(d.measure)}</strong>
          <small>
            {shown(d.units)} · {shown(d.follow_up)}
          </small>
        </div>
      </div>
      <p>{shown(d.definition)}</p>
      {r.note && (
        <Notice type={r.status === "approved" ? "info" : "warning"}>
          {r.note}
        </Notice>
      )}
      <details>
        <summary>Source and review details</summary>
        <p>
          {d.source || "Uploaded publication"} · {shown(d.location)}
          {d.page ? ` · PDF page ${d.page}` : ""}
        </p>
        <blockquote>
          {source?.data.excerpt || d.quote || "No source excerpt available."}
        </blockquote>
        <p>Analysis population: {shown(d.analysis_population)}</p>
        <p>Uncertainty: {d.uncertainty || "None recorded"}</p>
        <p>Reviewed by: {r.reviewer || "Not yet reviewed"}</p>
        {d.workbook_row && (
          <p>
            Workbook: Outcome Extraction, row {d.workbook_row}. Original QC
            label: {d.original_qc}.
          </p>
        )}
        <details>
          <summary>Original extraction</summary>
          <pre>{JSON.stringify(r.raw, null, 2)}</pre>
        </details>
      </details>
    </article>
  );
}

function reviewSummary(rows) {
  const labels = [
    ["pending", "pending"],
    ["withheld", "withheld"],
    ["qualified", "with notes"],
    ["duplicate", "duplicate"],
    ["superseded", "superseded"],
  ];
  return labels
    .map(([status, label]) => {
      const count = rows.filter((r) => r.status === status).length;
      return count ? `${count} ${label}` : null;
    })
    .filter(Boolean)
    .join(" · ");
}
