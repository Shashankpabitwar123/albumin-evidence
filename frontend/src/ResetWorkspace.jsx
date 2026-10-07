import React from "react";
import { post } from "./api";
import { Field, Notice } from "./components";

export default function ResetWorkspace({ onReset }) {
  const [confirming, setConfirming] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  async function reset() {
    setBusy(true);
    setError("");
    try {
      await post("/workspace/reset", { confirmation });
      sessionStorage.removeItem("reviewer");
      onReset();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="workspace-reset" aria-labelledby="reset-heading">
      <h3 id="reset-heading">Start fresh</h3>
      <p>
        Restore the four supplied papers to Pending review. This clears reviewer
        changes, extracted results and paper review history, and removes
        additional uploads. The fictional workbook and AI screening suggestions
        stay unchanged.
      </p>
      <Notice type="warning">
        <strong>This is a shared workspace.</strong> Resetting affects everyone,
        including people currently reviewing a paper. Other open windows should
        be refreshed after a reset.
      </Notice>
      {!confirming ? (
        <button onClick={() => setConfirming(true)}>Reset workspace</button>
      ) : (
        <>
          <h3>Reset for everyone?</h3>
          <p>
            This cannot be undone in the dashboard. Download a backup first if
            you want to keep the current PDFs, reviews and history. The ZIP
            supports offline inspection and owner-assisted recovery; it cannot
            be imported here.
          </p>
          <a className="text-button" href="/api/workspace/backup" download>
            Download workspace backup (.zip)
          </a>
          <p className="small muted">
            Existing API spending is not reset. Extracting results again uses
            the remaining API budget.
          </p>
          {error && <Notice type="error">{error}</Notice>}
          <Field
            label="Type RESET to confirm"
            value={confirmation}
            onChange={setConfirmation}
          />
          <div className="reset-actions">
            <button
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                setConfirmation("");
                setError("");
              }}
            >
              Cancel
            </button>
            <button
              className="primary"
              disabled={busy || confirmation !== "RESET"}
              onClick={reset}
            >
              {busy ? "Resetting…" : "Reset shared workspace"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
