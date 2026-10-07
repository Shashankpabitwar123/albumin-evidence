import { test } from "node:test";
import assert from "node:assert/strict";
import { quoteRange, isReferenceCorrection } from "./sourceMatch.js";
test("source matching preserves offsets across PDF line breaks", () => {
  const text = "Before. Randomly assigned\nto receive diuretics. After.";
  const range = quoteRange(text, "Randomly assigned to receive diuretics.");
  assert.equal(text.slice(...range), "Randomly assigned\nto receive diuretics");
  assert.equal(quoteRange(text, "randomly assigned to receive albumin"), null);
  assert.equal(
    quoteRange(text + text, "Randomly assigned to receive diuretics."),
    null,
  );
  assert.equal(
    isReferenceCorrection("Source text needs checking for: Population"),
    false,
  );
  assert.equal(
    isReferenceCorrection(
      "An exact source passage was located on PDF page 1 (AI proposed page 2).",
    ),
    true,
  );
});
