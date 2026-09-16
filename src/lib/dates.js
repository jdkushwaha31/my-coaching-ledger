import { FULL_MONTH_NAMES, MONTH_NAMES } from "../constants/appConstants";

export function monthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }


export function monthLabel(key) { 
  if (!key) return "—";
  if (key === "carried-over") return "Carried Forward";
  const [y, m] = key.split("-").map(Number); 
  if (!m || m < 1 || m > 12) return key;
  return `${MONTH_NAMES[m - 1]} ${y}`; 
}


export function currentMonthKey() { return monthKey(new Date()); }


export function addMonths(key, n) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return monthKey(d);
}


export function monthsBetween(fromKey, toKey) {
  const out = [];
  let cur = fromKey;
  let guard = 0;
  while (cur <= toKey && guard < 240) { out.push(cur); cur = addMonths(cur, 1); guard++; }
  return out;
}


export function todayStr() { return new Date().toISOString().slice(0, 10); }


export function nowStamp() { return new Date().toISOString(); }
// Current local clock time as "HH:MM" (24-hour), used to auto-capture "what
// time was this attendance taken" on Mark Attendance / View Attendance —
// distinct from `createdAt` (the row's own audit/creation timestamp used
// only internally for chronoKey sort ordering, never shown).


export function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
// Formats a stored "HH:MM" (24-hour) time string as "h:mm AM/PM" for display.


export function fmtTime(t) {
  if (!t) return "";
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return t;
  let h = Number(m[1]);
  const min = m[2];
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${min} ${period}`;
}
// Converts a stored YYYY-MM-DD (or full ISO datetime) string into the
// "D Month YYYY" format (e.g. "17 August 2026") used for DISPLAY
// everywhere in the UI. Storage, form inputs (type="date"/"month"),
// filters, and every string comparison in this file keep using the
// original YYYY-MM-DD value untouched — only what actually gets printed
// on screen / receipts / statements is routed through this. Never store
// the output of this function.


export function fmtDate(d) {
  if (!d) return d;
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return d;
  const monthIdx = Number(m[2]) - 1;
  const monthName = FULL_MONTH_NAMES[monthIdx] || m[2];
  return `${Number(m[3])} ${monthName} ${m[1]}`;
}
// Combines a transaction's chosen `date` (YYYY-MM-DD, what the user picked
// on the form) with the actual time it was recorded (`createdAt`, a full
// ISO timestamp) so that multiple entries on the same date sort in true
// chronological order instead of landing in whatever order they happened
// to be read back from the database. The date itself is never overridden —
// a backdated entry still sorts under the date the user chose; only ties
// on that same date are broken by real recorded time. Nothing here is
// displayed — statements only ever show the plain date.


export function chronoKey(t) {
  const d = t && t.date ? t.date : "";
  const c = t && t.createdAt ? String(t.createdAt) : "";
  const time = c.length > 10 ? c.slice(11, 19) : "00:00:00";
  return `${d}T${time}`;
}
// Shared comparator: dir = 1 for oldest-first, -1 for newest-first.


export function compareChrono(a, b, dir = 1) {
  const av = chronoKey(a), bv = chronoKey(b);
  return av < bv ? -dir : av > bv ? dir : 0;
}
// Human-readable, unique Student ID — separate from the internal Firestore
// doc `id` (which stays exactly as-is so nothing already saved ever breaks).
// Format: STU<year><4-digit sequence>, e.g. STU20260007. Sequence is derived
// from the highest existing number for the current year across ALL students
// (including trashed ones, so a restored/undeleted student never collides),
// so it keeps counting up correctly even if students are removed.

