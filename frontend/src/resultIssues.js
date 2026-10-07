// Approval and recorded extraction caveats are independent.
export function hasRecordedIssue(result) {
  return (
    result.status !== "approved" || Boolean(result.data?.uncertainty?.trim())
  );
}
