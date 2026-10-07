const labels = {
  reviewer: "Reviewer name", reason: "Review note / decision reason",
  treatment_n: "Treatment sample size / denominator", control_n: "Control sample size / denominator",
  name: "Outcome", measure: "Measure", units: "Units", definition: "Definition",
  follow_up: "Follow-up", analysis_population: "Analysis population", location: "Table / section",
  quote: "Source quote", page: "PDF page", treatment_value: "Treatment result", control_value: "Control result",
  note: "Result review note",
};
export function validationIssues(detail) {
  if (!Array.isArray(detail)) return [];
  return detail.map((item) => {
    const path = (item.loc || []).filter((part) => part !== "body");
    const field = path.join(".");
    const prefix = path[0] === "outcomes" ? `Outcome ${Number(path[1]) + 1} — ` : path[0] === "characteristics" ? "Study details — " : "";
    return { field, message: `${prefix}${labels[path.at(-1)] || "Review field"}: ${(item.msg || "Check this value.").replace(/^Value error, /, "")}` };
  });
}
