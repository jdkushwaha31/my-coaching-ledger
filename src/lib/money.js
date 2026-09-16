export function fmtINR(n) {
  const v = Number(n) || 0;
  // Negative amounts (e.g. a student who has paid in advance / overpaid)
  // are shown as "-₹500" rather than "₹-500".
  const sign = v < 0 ? "-" : "";
  return sign + "₹" + Math.abs(v).toLocaleString("en-IN");
}


export function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

