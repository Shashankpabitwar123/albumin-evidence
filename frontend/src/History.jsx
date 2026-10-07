import React from "react";
import { api, date } from "./api";
import { Busy, Notice, Status } from "./components";
export default function History({ onOpen, refresh }) {
  const [rows, setRows] = React.useState(null),
    [error, setError] = React.useState(""),
    [query, setQuery] = React.useState(""),
    [status, setStatus] = React.useState(""),
    [detail, setDetail] = React.useState(null);
  React.useEffect(() => {
    let active = true;
    api("/papers")
      .then((r) => active && setRows(r))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [refresh]);
  const filtered = (rows || []).filter(
    (p) =>
      (!status || p.decision === status) &&
      ((p.screening?.title || "") + " " + p.filename)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  async function events(id) {
    try {
      setDetail(await api("/papers/" + id));
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Review History</h1>
          <p>Resume a review or inspect earlier decisions and corrections.</p>
        </div>
      </div>
      {error && <Notice type="error">{error}</Notice>}
      <div className="filters history-filters">
        <label className="field">
          <span>Find a paper</span>
          <input
            placeholder="Search title or filename"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Screening decision</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All decisions</option>
            {["Pending", "Include", "Exclude", "Needs clarification"].map(
              (x) => (
                <option key={x}>{x}</option>
              ),
            )}
          </select>
        </label>
      </div>
      {!rows && !error ? (
        <Busy />
      ) : !filtered.length ? (
        <div className="empty">
          <h2>No reviews to show</h2>
          <p>Uploaded papers and their decisions will appear here.</p>
          <button onClick={() => onOpen(null)}>Review a paper</button>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Paper</th>
                <th>Screening</th>
                <th>Results</th>
                <th>Last decision</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td className="study-name">
                    <strong>{p.screening?.title || p.filename}</strong>
                    <span>{p.filename}</span>
                    {p.job && (
                      <span className="teal">Analysis in progress</span>
                    )}
                    {p.error && (
                      <span className="amber">Analysis needs attention</span>
                    )}
                  </td>
                  <td>
                    <Status value={p.decision} />
                  </td>
                  <td>
                    {p.result_counts.approved || 0} approved
                    <br />
                    <small>
                      {p.result_counts.pending || 0} pending ·{" "}
                      {p.result_counts.withheld || 0} withheld
                    </small>
                  </td>
                  <td>
                    {p.last_decision_reviewer || "Not reviewed"}
                    <br />
                    <small>{date(p.last_decision_at)}</small>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button onClick={() => onOpen(p.id)}>Open review</button>
                      <button
                        className="text-button"
                        onClick={() => events(p.id)}
                      >
                        History
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {detail && (
        <section className="history-detail">
          <div className="section-head">
            <h2>Decision trail</h2>
            <button onClick={() => setDetail(null)}>Close</button>
          </div>
          <p>{detail.screening?.title || detail.filename}</p>
          {detail.events.map((e) => (
            <details key={e.id}>
              <summary>
                {e.action} · {e.reviewer || "System"} · {date(e.created)}
              </summary>
              <pre>{JSON.stringify(e.details, null, 2)}</pre>
            </details>
          ))}
        </section>
      )}
    </>
  );
}
