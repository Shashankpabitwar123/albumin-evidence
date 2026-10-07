import { validationIssues } from "./validation";
export async function api(path, options = {}) {
  const headers = { "X-Requested-With": "AlbuminEvidence", ...options.headers };
  if (options.body && !(options.body instanceof FormData))
    headers["Content-Type"] = "application/json";
  let response;
  try {
    response = await fetch("/api" + path, { ...options, headers });
  } catch {
    throw new Error(
      "Unable to connect. Your saved work is safe. Check your connection and try again.",
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const issues = validationIssues(data.detail);
    const detail =
      typeof data.detail === "string"
        ? data.detail
        : issues.length ? issues.map((issue) => issue.message).join(" ") : "Unable to save this change. Please try again.";
    const error = new Error(detail);
    error.status = response.status;
    error.issues = issues;
    throw error;
  }
  return data;
}
export const post = (path, body) =>
  api(path, {
    method: "POST",
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
export const shown = (value) =>
  value === null || value === undefined || value === ""
    ? "Not captured"
    : String(value);
export const date = (value) =>
  value
    ? new Date(value).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
