import { test } from "node:test";
import assert from "node:assert/strict";
import { hasRecordedIssue } from "./resultIssues.js";
test("approved results retain caveats without treating routine approval notes as issues", () => {
  assert.equal(
    hasRecordedIssue({
      status: "approved",
      data: { uncertainty: "Denominator unclear" },
    }),
    true,
  );
  assert.equal(
    hasRecordedIssue({
      status: "approved",
      note: "Checked and approved",
      data: { uncertainty: "  " },
    }),
    false,
  );
  for (const status of [
    "pending",
    "qualified",
    "withheld",
    "duplicate",
    "superseded",
  ]) {
    assert.equal(hasRecordedIssue({ status, data: {} }), true);
  }
});
