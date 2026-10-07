// Match formatting differences only; never guess a similar passage.
export function quoteRange(text, quote) {
  function fold(value) {
    let normalized = "",
      positions = [];
    for (let i = 0; i < value.length; i++) {
      const char = value[i].normalize("NFKC").toLowerCase();
      for (const c of char)
        if (/[a-z0-9]/.test(c)) {
          normalized += c;
          positions.push(i);
        }
    }
    return { normalized, positions };
  }
  const source = fold(text || ""),
    needle = fold(quote || "").normalized;
  if (needle.length < 12) return null;
  const start = source.normalized.indexOf(needle);
  if (start < 0 || source.normalized.indexOf(needle, start + 1) !== -1)
    return null;
  return [
    source.positions[start],
    source.positions[start + needle.length - 1] + 1,
  ];
}
export const isReferenceCorrection = (warning) =>
  /^An exact source passage was located on PDF page \d+ \(AI proposed page .*\)\.$/.test(
    warning,
  );
