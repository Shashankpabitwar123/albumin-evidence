import test from "node:test";
import assert from "node:assert/strict";
import { validationIssues } from "./validation.js";
test("validation paths identify the exact second outcome field", () => {
  const [issue] = validationIssues([{loc:["body","outcomes",1,"data","quote"],msg:"Check the PDF page."}]);
  assert.equal(issue.field, "outcomes.1.data.quote");
  assert.equal(issue.message, "Outcome 2 — Source quote: Check the PDF page.");
});
test("missing reviewer and bad counts are understandable and navigable", () => {
  const issues = validationIssues([{loc:["body","reviewer"],msg:"String should have at least 2 characters"},{loc:["body","characteristics","treatment_n"],msg:"Value error, Enter a whole number."}]);
  assert.equal(issues[0].field, "reviewer");
  assert.equal(issues[1].message, "Study details — Treatment sample size / denominator: Enter a whole number.");
  assert.deepEqual(validationIssues("Connection unavailable"), []);
});
