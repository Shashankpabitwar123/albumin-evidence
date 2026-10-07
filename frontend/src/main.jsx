import React from "react";
import { createRoot } from "react-dom/client";
import { LockKeyhole, LogOut } from "lucide-react";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/libre-franklin/600.css";
import "@fontsource/libre-franklin/700.css";
import "./styles.css";
import { api, post } from "./api";
import { Busy, Notice, Field, Modal } from "./components";
import Library from "./Library";
import Review from "./Review";
import History from "./History";
import ResetWorkspace from "./ResetWorkspace";

class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main>
        <Notice type="error">
          This view could not be displayed. Your saved reviews are safe.
        </Notice>
        <button onClick={() => location.reload()}>Reload application</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function App() {
  const [session, setSession] = React.useState(null),
    [checking, setChecking] = React.useState(true),
    [error, setError] = React.useState(""),
    [password, setPassword] = React.useState(""),
    [busy, setBusy] = React.useState(false),
    [tab, setTab] = React.useState("library"),
    [paperId, setPaperId] = React.useState(null),
    [refresh, setRefresh] = React.useState(0),
    [help, setHelp] = React.useState(false),
    [resetNotice, setResetNotice] = React.useState(false),
    [libraryOrigin, setLibraryOrigin] = React.useState("mock");
  React.useEffect(() => {
    api("/session")
      .then(setSession)
      .catch((e) => {
        if (e.status !== 401) setError(e.message);
      })
      .finally(() => setChecking(false));
  }, []);
  async function login(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/login", { password });
      setPassword("");
      setSession(await api("/session"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await post("/logout", {});
      setSession(null);
      setPaperId(null);
    } catch (e) {
      setError(e.message);
    }
  }
  function open(id = null) {
    setPaperId(id);
    setTab("review");
  }
  if (checking)
    return (
      <main>
        <Busy>Opening your evidence workspace…</Busy>
      </main>
    );
  if (!session)
    return (
      <div className="login">
        <div className="wordmark">Albumin Evidence</div>
        <form onSubmit={login}>
          <LockKeyhole className="teal" size={30} />
          <h1>Welcome back</h1>
          <p>Enter the workspace password to review the evidence.</p>
          {error && <Notice type="error">{error}</Notice>}
          <Field
            label="Workspace password"
            value={password}
            onChange={setPassword}
            type="password"
            required
            autoComplete="current-password"
          />
          <button className="primary" disabled={busy}>
            {busy ? "Signing in…" : "Open workspace"}
          </button>
        </form>
        <p className="small muted">
          Long-term albumin in adults with cirrhosis and ascites
        </p>
      </div>
    );
  return (
    <>
      <header>
        <a
          className="wordmark"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("library");
          }}
        >
          Albumin Evidence
        </a>
        <nav aria-label="Main navigation">
          {[
            ["library", "Evidence Library"],
            ["review", "Review a Paper"],
            ["history", "Review History"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <button className="text-button" onClick={() => setHelp(true)}>
            Help
          </button>
          <button
            className="icon"
            aria-label="Sign out"
            title="Sign out"
            onClick={logout}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main>
        {resetNotice && (
          <Notice>
            The shared workspace has been reset for everyone. The four supplied
            papers are ready to review.{" "}
            <button
              className="text-button"
              onClick={() => setResetNotice(false)}
            >
              Dismiss
            </button>
          </Notice>
        )}
        {tab === "library" ? (
          <Library
            initialOrigin={libraryOrigin}
            refresh={refresh}
            onReview={open}
          />
        ) : tab === "review" ? (
          <Review
            paperId={paperId}
            onOpen={open}
            onChange={() => setRefresh((n) => n + 1)}
            onLibrary={() => {
              setLibraryOrigin("real");
              setRefresh((n) => n + 1);
              setTab("library");
            }}
          />
        ) : (
          <History onOpen={open} refresh={refresh} />
        )}
      </main>
      {help && (
        <Modal title="Review guidance" onClose={() => setHelp(false)}>
          <h3>Review scope</h3>
          <p className="preserve">{session.criteria}</p>
          <h3>How a paper becomes evidence</h3>
          <p>
            Upload a searchable PDF. AI suggests eligibility with source
            passages. You confirm or change the decision, correct the proposed
            study details, and approve each result separately.
          </p>
          <h3>What is automated</h3>
          <p>
            PDF text reading, AI screening and extraction suggestions,
            source-quote matching, duplicate-file detection and library updates.
            Suggestions can be wrong: the reviewer makes the final decisions.
          </p>
          <h3>What you review</h3>
          <p>
            Eligibility, treatment attribution, study characteristics, outcome
            values and their sources. An entered reviewer name records
            responsibility but is not an independently verified account.
          </p>
          <h3>Missing or uncertain information</h3>
          <p>
            Blank means not captured, NR means not reported, and 0 means an
            explicit zero. Keep unresolved results pending or withhold them with
            a reason. Counts, rates, survival estimates and cumulative incidence
            are different measures.
          </p>
          <h3>Sources and limits</h3>
          <p>
            Workbook records and excerpts are fictional. Uploaded publications
            are real sources; they do not validate fictional results. The
            current reader supports searchable PDFs up to 12 MB and 40 pages.
            Scanned documents require OCR before upload. Graph-only values are
            not automatically digitized.
          </p>
          <h3>Related publications</h3>
          <p>
            Identical uploads reopen the saved paper. Matching DOI or trial
            identifiers flag possible related reports. A reviewer confirms study
            linkage; uncertain matches must not be merged automatically.
            Corrections should retain previous values and an explanation in the
            decision trail.
          </p>
          <ResetWorkspace
            onReset={() => {
              setHelp(false);
              setPaperId(null);
              setRefresh((n) => n + 1);
              setTab("history");
              setResetNotice(true);
            }}
          />
        </Modal>
      )}
    </>
  );
}
createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
