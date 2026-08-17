import React, { useState, useEffect, useMemo, useRef } from "react";
import { db } from "./firebase";
import { 
  collection, onSnapshot, doc, setDoc, deleteDoc 
} from "firebase/firestore";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid 
} from "recharts";
import { 
  LayoutGrid, Users, Wallet, Receipt, AlertCircle, Plus, Trash2, X, Check, Lock, LogOut, 
  BookOpen, Send, Printer, Award, ArrowUpRight, History, Tag, Undo2, Archive, RotateCcw, 
  ClipboardList, Percent, FileText, Search, Banknote, Landmark, CreditCard
} from "lucide-react";

// ============================================================================
// UPDATE NOTES — read this before touching anything below.
//
// IMPORTANT: every existing feature in this file (student lifecycle,
// deposits, charges, write-offs, Banking ledger, Credit/Loan ledger,
// receipts, statements, joining form, promote/exit/undo, trash/restore,
// etc.) is intact and unchanged in behavior except where explicitly noted
// below. Nothing was removed. If you (a future Claude, or anyone editing
// this file) are asked to add more on top of this, keep that same rule:
// add / fix, never silently drop something that already worked.
//
// Changes made in this update pass:
//   1. Fee & Class Structure → "Manage Streams" was floating in the
//      SectionHeader action slot, misaligned from the "Fee Matrix Pricing"
//      / "Class & Subject List" sub-tab pill row underneath it. It's now a
//      third button inside that same bordered pill row, right after
//      "Class & Subject List", styled to match (see StructureTab).
//   2. Dashboard "Net Liquidity" (Cash Balance / Online Balance) used a
//      simplified formula — deposits minus expenses only — which silently
//      ignored Cash⇄Bank transfers, Credit/Loan entries, and Interest
//      payments. It now reuses the exact same running-balance figures
//      (bankingCashBalance / bankingBankBalance) the Banking tab computes,
//      so the two screens always agree to the rupee (see the "Dashboard
//      Net Liquidity" note near the Banking Ledger block, and the
//      totalCashBalance / totalOnlineBalance assignment).
//   3. Dashboard was reorganized into clearly labeled sections (Overview →
//      Financial Health → Trends & Activity) and gained a new "Top
//      Outstanding Dues" panel for a quick at-a-glance view of who owes
//      the most, without needing to open the Dues tab (see DashboardTab).
//   4. Center Statement: the Student ID under each row was a clickable
//      button that also toggled the mini "student info" panel open. It's
//      now plain, non-clickable text — the info panel still opens, just
//      via a separate small ▸/▾ toggle next to the ID instead of the ID
//      itself being clickable. Search now also matches on mobile number,
//      not just name / Student ID (see CenterStatementTab).
//   5. Banking Statement: Student ID was already shown on every row; search
//      now also matches mobile number in addition to Student ID / name /
//      description / remarks (see BankingTab).
//
// Changes made in this second update pass:
//   6. Fee & Class Structure → "Manage Streams" is now a real third tab
//      (not a modal launched from a button) inside the same pill row as
//      "Fee Matrix Pricing" / "Class & Subject List" — clicking it swaps
//      the panel below inline, exactly like the other two. The old modal
//      component was converted to an inline panel, StreamManagerPanel
//      (see StructureTab).
//   7. Banking → Credit & Loan Ledger: interest payments now also have
//      their own separate "Interest Payments Log" section (below the
//      Credit & Loan Ledger, same pattern as the Cash ⇄ Bank Transfer
//      Logs section), so they can be deleted independently instead of
//      only from inside a credit entry's expanded history (which is now
//      view-only) (see BankingTab).
//   8. Center Statement & Banking Statement: the Student ID under each row
//      is now plain, non-clickable text with no ▸/▾ arrow at all — the
//      per-row "view student info" toggle from the previous pass has been
//      removed entirely, per request (see CenterStatementTab / BankingTab).
//   9. Every transaction list ("statement") was sorted by date only, so
//      same-day entries could appear out of the order they actually
//      happened in. Every deposit/charge/expense/bank-transfer/credit/
//      interest-payment record now also stores a `createdAt` timestamp at
//      creation time, and every statement/log sort (Center Statement,
//      Banking Statement, Student Statement, Deposits/Charges/Expenses
//      logs, Credit Ledger, Transfer logs) uses date + createdAt together
//      via the new chronoKey()/compareChrono() helpers — so same-day
//      entries now land in true chronological order. No time is ever
//      displayed anywhere; only the date still shows, exactly as before.
//  10. Students Register → "Total Due": a student who has deposited extra
//      or paid in advance now shows their Total Due as a NEGATIVE amount
//      (e.g. "-₹500 (advance)") instead of ₹0. computeStudentLedger() now
//      returns an additional `rawBalance` (unclamped, can go negative)
//      alongside the existing `balance` (still clamped at 0) — every other
//      total in the app (Dues tab, Dashboard, totalOutstanding, etc.)
//      keeps using the clamped `balance` exactly as before; only the
//      Students Register table reads the new signed figure.
//  11. Every date shown anywhere in the UI (statements, receipts, the
//      Joining Form, Trash tab, student details, etc.) now displays as
//      DD-MM-YYYY via the new fmtDate() helper. Nothing about how dates
//      are stored, filtered, or compared changed — <input type="date">/
//      "month"> fields, Firestore fields, and all string comparisons still
//      use the original YYYY-MM-DD (ISO) format; fmtDate() is purely a
//      last-mile display formatter, never used for storage or logic.
//  12. Student form gained a "Joining Date" field (type="date", optional).
//      If left blank, it's auto-filled with today's date at save time
//      (see submit() in StudentFormModal). Stored as `joiningDate` on the
//      student record and shown in the Students Register expanded row and
//      on the printed Joining Form.
//
// Changes made in this third update pass:
//  13. Add Student → "Joining Date" field now visibly defaults to TODAY'S
//      date the moment the form opens (not just silently at save time as
//      before) — office staff see it pre-filled and can change it to
//      backdate a student if needed; if they don't touch it, today's date
//      is what gets saved (see the joiningDate useState in
//      StudentFormModal).
//  14. Student Statement → Description column no longer shows the small
//      "Unpaid" stamp next to an outstanding charge line. The Debit /
//      Credit / running Balance columns already show exactly what's owed,
//      so the stamp was redundant clutter (see StudentStatementModal).
//  15. Every date shown anywhere in the app now displays as "D Month
//      YYYY" (e.g. "17 August 2026") instead of "DD-MM-YYYY" — this is a
//      one-line change to the shared fmtDate() helper, so it applies
//      everywhere at once: Students Register, Student/Center/Banking
//      Statements, all receipts & slips, the Joining Form, Trash tab,
//      credit/interest logs, everywhere. Storage format (YYYY-MM-DD),
//      <input type="date"/"month">, filtering, and sorting are completely
//      untouched — only the last-mile display formatter changed.
//  16. Printable Statement (Student Statement, Center Statement, Banking
//      Statement) — the "Print / Export" button used to clone the on-
//      screen preview's HTML into a bare popup window that never loaded
//      the app's Tailwind styling or fonts, so everything printed as
//      unstyled black text with no layout, colors, or letterhead — even
//      though the on-screen preview looked correct. Each of these three
//      print windows now loads the same Google Fonts import and the
//      Tailwind CDN the live app effectively relies on, plus a proper A4
//      @page rule, a bordered letterhead document wrapper matching the
//      Joining Form's professional look, and print-safe table rules (no
//      row splitting across pages, repeating header). The on-screen
//      preview markup itself is unchanged — only what the popup window
//      loads before printing it changed.
//
// Changes made in this fourth update pass:
//  17. NEW FEATURE — Notes: a simple internal notepad tab (sidebar, right
//      above Trash / Restore) completely separate from the financial
//      ledger. Add / edit / pin / delete free-text notes (title + body),
//      cloud-synced like everything else via a new "notes" Firestore
//      collection. Pinned notes float to the top. Nothing here touches
//      any student, deposit, charge, or balance (see NotesTab,
//      NoteFormModal, saveNote / toggleNotePin / deleteNote).
//  18. BUG FIX — Statement dates wrapping onto 3 lines (DD on one line,
//      Month on the next, YYYY on the last): fmtDate() itself always
//      produced a correct single-line "D Month YYYY" string — the actual
//      bug was that the narrow table cells showing it had no
//      `whitespace-nowrap`, so the browser wrapped the string wherever it
//      ran out of column width. Added `whitespace-nowrap` to every date
//      cell across every statement/log table (Deposits, Charges,
//      Expenses, Center Statement, Banking Statement, Cash⇄Bank Transfer
//      Logs, Credit & Loan Ledger, Interest Payments Log, Trash tab,
//      Student Statement) — dates now always render on one line.
//  19. Banking tab reorganized into four separate, professional pill-tab
//      panels — Banking Statement, Cash ⇄ Bank Transfer Logs, Credit &
//      Loan Ledger, Interest Payments Log — instead of one long stacked
//      scroll, using the same sub-tab pattern already used by Fee &
//      Class Structure (see StructureTab). Every feature that existed
//      before (search & filters on the main statement, print/export,
//      add/delete on each log, expand a credit entry's interest-payment
//      history, Pay Interest) is fully intact — this only changes how
//      the four sections are navigated, not what they do (see
//      BankingTab, BANKING_SUB_TABS).
//  20. BUG FIX — a student saved with ZERO subjects/batches selected was
//      being silently charged the 1-subject Fee Matrix rate every month,
//      because both computeStudentLedger() and the dashboard's
//      forecastForMonth() did `batches.length || 1`, and expectedFeeFor()
//      itself also forced any falsy batch count up to 1. A batch count of
//      0 is falsy in JavaScript, so "no subjects chosen" was
//      indistinguishable from "1 subject chosen" and got billed as if
//      the student had taken a single subject they were never actually
//      enrolled in. expectedFeeFor() now returns ₹0 immediately for a
//      batch count of 0 (before ever consulting the fee matrix), and
//      both call sites no longer force that fallback to 1 — a
//      subject-less student now correctly accrues ₹0 tuition instead of
//      the 1-subject rate. Students with 1+ subjects are billed exactly
//      as before.
// ============================================================================

// Admin Access Password
const APP_PASSWORD = "958906"; 

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');`;

const DEFAULT_CLASSES = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const DEFAULT_SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Science", "Hindi", "English", "Social Studies", "Computer"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
// Full month names, used only by fmtDate() for the "D Month YYYY" display format.
const FULL_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Cheque"];
const EXPENSE_CATEGORIES = ["Rent", "Electricity", "Staff Salary", "Stationery", "Maintenance", "Marketing", "Internet / Phone", "Furniture", "Miscellaneous"];

// Streams / academic tracks — shown on the Student form and used as a
// filter in the Students Directory. Kept as a flat list (not tied to
// class) since the same stream label can apply across senior classes,
// diplomas, and degree-level admissions.
const STREAMS = [
  "PCM", "PCB", "PCM+B", "PCB+M", "Commerce", "Arts", "Engineering",
  "Graduate", "Under Graduate", "Post Graduate", "Other",
];

// Reference types used whenever a bank-side transaction needs a paper
// trail — Cash ⇄ Bank transfers and the Credit / Loan ledger both reuse
// this same set so the UI and stored field names stay consistent.
const REFERENCE_TYPES = ["None", "UTR Number", "Cheque Number", "Reference Number"];

// Who the other side of a Credit / Loan entry is.
const CREDIT_PARTY_TYPES = ["Person", "Company", "Bank", "Other"];
// How the money actually moved for a Credit / Loan entry or an Interest
// Payment against one — Cash stays in the Cash Balance, Online covers
// UPI / Bank Transfer / NEFT / IMPS and stays in the Bank Balance.
const CREDIT_MODES = ["Cash", "Online"];

// Exit reasons — used whenever a student leaves an active billing cycle.
const EXIT_REASONS = [
  { value: "Passed", label: "Passed — completed this class", status: "on_break" },
  { value: "Repeat", label: "Repeating this class next session", status: "on_break" },
  { value: "Gap", label: "On Break / Gap (temporary pause)", status: "on_break" },
  { value: "Dropped", label: "Dropped Out (leaving permanently)", status: "dropped" },
];

function monthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function monthLabel(key) { 
  if (!key) return "—";
  if (key === "carried-over") return "Carried Forward";
  const [y, m] = key.split("-").map(Number); 
  if (!m || m < 1 || m > 12) return key;
  return `${MONTH_NAMES[m - 1]} ${y}`; 
}
function currentMonthKey() { return monthKey(new Date()); }
function addMonths(key, n) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return monthKey(d);
}
function monthsBetween(fromKey, toKey) {
  const out = [];
  let cur = fromKey;
  let guard = 0;
  while (cur <= toKey && guard < 240) { out.push(cur); cur = addMonths(cur, 1); guard++; }
  return out;
}
function fmtINR(n) {
  const v = Number(n) || 0;
  // Negative amounts (e.g. a student who has paid in advance / overpaid)
  // are shown as "-₹500" rather than "₹-500".
  const sign = v < 0 ? "-" : "";
  return sign + "₹" + Math.abs(v).toLocaleString("en-IN");
}
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function nowStamp() { return new Date().toISOString(); }
// Converts a stored YYYY-MM-DD (or full ISO datetime) string into the
// "D Month YYYY" format (e.g. "17 August 2026") used for DISPLAY
// everywhere in the UI. Storage, form inputs (type="date"/"month"),
// filters, and every string comparison in this file keep using the
// original YYYY-MM-DD value untouched — only what actually gets printed
// on screen / receipts / statements is routed through this. Never store
// the output of this function.
function fmtDate(d) {
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
function chronoKey(t) {
  const d = t && t.date ? t.date : "";
  const c = t && t.createdAt ? String(t.createdAt) : "";
  const time = c.length > 10 ? c.slice(11, 19) : "00:00:00";
  return `${d}T${time}`;
}
// Shared comparator: dir = 1 for oldest-first, -1 for newest-first.
function compareChrono(a, b, dir = 1) {
  const av = chronoKey(a), bv = chronoKey(b);
  return av < bv ? -dir : av > bv ? dir : 0;
}
// Human-readable, unique Student ID — separate from the internal Firestore
// doc `id` (which stays exactly as-is so nothing already saved ever breaks).
// Format: STU<year><4-digit sequence>, e.g. STU20260007. Sequence is derived
// from the highest existing number for the current year across ALL students
// (including trashed ones, so a restored/undeleted student never collides),
// so it keeps counting up correctly even if students are removed.
function generateStudentId(allStudents) {
  const year = new Date().getFullYear();
  const prefix = `STU${year}`;
  let max = 0;
  (allStudents || []).forEach(s => {
    if (s && s.studentId && s.studentId.startsWith(prefix)) {
      const n = parseInt(s.studentId.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
// Single source of truth for receipt numbering, so the Deposit Receipt,
// the WhatsApp receipt message, and the Student Statement always show
// the exact same receipt number for a given deposit.
function getReceiptNo(depositId) {
  return depositId ? depositId.slice(0, 8).toUpperCase() : "REC-" + Date.now().toString().slice(-4);
}

// Deterministic short code used to build a stable, readable Charge ID for
// any ledger line — ad-hoc charges get one stored at creation time, but
// recurring tuition-fee lines are computed on the fly each render, so their
// ID has to be derivable from their own (stable) raw id instead of stored.
function shortId(str) {
  let h = 0;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
  return h.toString(36).toUpperCase().padStart(6, "0").slice(-6);
}

const defaultFeeStructure = (classes) => {
  const fs = {};
  classes.forEach((c, i) => {
    fs[c] = { 
      1: 500 + i * 50, 
      2: 900 + i * 100, 
      3: 1300 + i * 150,
      4: 1600 + i * 180,
      5: 1900 + i * 200,
      6: 2200 + i * 220
    };
  });
  return fs;
};

function sendWhatsAppReceipt(deposit, student, totalRemainingDue) {
  if (!student || !student.phone) {
    alert("No phone number registered for this student.");
    return;
  }
  const cleanPhone = student.phone.replace(/[^0-9]/g, "");
  const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const receiptNo = getReceiptNo(deposit.id);
  const woLine = deposit.writeOffAmount > 0 ? `\n*Discount/Write-off:* ₹${deposit.writeOffAmount}` : "";
  const refLine = deposit.utr ? `\n*Reference/UTR:* ${deposit.utr}` : (deposit.chequeNumber ? `\n*Cheque No:* ${deposit.chequeNumber}` : "");
  const msg = `*FEE PAYMENT RECEIPT*\n----------------------------------------\n*Receipt No:* #${receiptNo}\n*Date:* ${fmtDate(deposit.date)}\n*Student Name:* ${student.name}\n*Class:* ${student.class}\n*Payment Mode:* ${deposit.mode || "Cash"}${refLine}\n----------------------------------------\n*Amount Paid Today:* ₹${deposit.amount}${woLine}\n*Remaining Balance:* ₹${totalRemainingDue}\n*Status:* ACKNOWLEDGED ✅\n----------------------------------------\nThank you for your payment!`;
  window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`, "_blank");
}

// ============================================================================
// LEDGER ENGINE — the single source of truth for "how much does this student
// owe". Everything (tuition accrual, ad-hoc charges, payments, write-offs)
// becomes one chronological list of debit/credit lines, credits are applied
// oldest-charge-first, and a running balance falls out naturally. This is
// what powers Dues, the Dashboard totals, and the per-student Statement.
// ============================================================================
function computeStudentLedger(student, deposits, charges, batchesForMonth, expectedFeeFor, curMonth) {
  const chargeLines = [];

  if (Number(student.previousDues) > 0) {
    chargeLines.push({
      id: `opening-${student.id}`, chargeId: `CHG-OPN${shortId(student.id)}`, type: "opening",
      date: `${student.admissionMonth || curMonth}-01`, month: null,
      label: "Opening Balance (Carried Forward)", amount: round2(student.previousDues), remarks: "", ref: "",
    });
  }

  if (student.admissionMonth && (student.status || "active") === "active" && student.admissionMonth <= curMonth) {
    monthsBetween(student.admissionMonth, curMonth).forEach(m => {
      const batches = batchesForMonth(student, m);
      // BUG FIX: no longer forces `bc` to 1 when the student has zero
      // subjects selected for this month — that used to silently bill
      // them the 1-subject fee matrix rate for a subject they were never
      // enrolled in. expectedFeeFor() now returns ₹0 for a batch count of
      // 0, so a subject-less student correctly accrues no tuition charge.
      const bc = batches.length;
      const expected = expectedFeeFor(student.class, bc, student.monthlyDiscount || 0);
      if (expected > 0) {
        const lineId = `fee-${student.id}-${m}`;
        chargeLines.push({
          id: lineId, chargeId: `CHG-${shortId(lineId)}`, type: "monthly_fee", date: `${m}-01`, month: m,
          label: `Tuition Fee — ${monthLabel(m)}${batches.length ? " (" + batches.join(", ") + ")" : ""}`,
          amount: round2(expected), remarks: "", ref: "",
        });
      }
    });
  }

  (charges || []).filter(c => c.studentId === student.id && !c.deleted).forEach(c => {
    chargeLines.push({
      id: c.id, chargeId: c.chargeId || `CHG-${shortId(c.id)}`, type: "extra_charge",
      date: c.date || `${c.month || curMonth}-01`, month: c.month || null, createdAt: c.createdAt || "",
      label: c.remarks ? `Additional Charge — ${c.remarks}` : `Additional Charge${c.month ? " (" + monthLabel(c.month) + ")" : ""}`,
      amount: round2(c.amount), remarks: c.remarks || "", ref: "",
    });
  });

  chargeLines.sort((a, b) => compareChrono(a, b, 1));

  const creditLines = [];
  (deposits || []).filter(d => d.studentId === student.id && !d.deleted).forEach(d => {
    if (Number(d.amount) > 0) {
      const ref = d.utr ? ` · Ref ${d.utr}` : (d.chequeNumber ? ` · Chq #${d.chequeNumber}` : "");
      creditLines.push({
        id: `${d.id}-pay`, depositId: d.id, type: "payment", date: d.date || todayStr(), createdAt: d.createdAt || "",
        label: `Payment Received — ${d.mode || "Cash"}${ref}`, amount: round2(d.amount),
        mode: d.mode, remarks: d.remarks, receiptNo: getReceiptNo(d.id), ref: d.utr || d.chequeNumber || "",
      });
    }
    if (Number(d.writeOffAmount) > 0) {
      creditLines.push({
        id: `${d.id}-wo`, depositId: d.id, type: "writeoff", date: d.date || todayStr(), createdAt: d.createdAt || "",
        label: d.writeOffRemarks ? `Discount / Write-off — ${d.writeOffRemarks}` : "Discount / Write-off",
        amount: round2(d.writeOffAmount), remarks: d.writeOffRemarks, receiptNo: getReceiptNo(d.id), ref: "",
      });
    }
  });
  creditLines.sort((a, b) => compareChrono(a, b, 1));

  let pool = creditLines.reduce((a, c) => a + c.amount, 0);
  const allocatedCharges = chargeLines.map(line => {
    const applied = Math.min(line.amount, pool);
    pool = round2(pool - applied);
    return { ...line, paid: round2(applied), outstanding: round2(line.amount - applied) };
  });

  const totalCharged = round2(chargeLines.reduce((a, l) => a + l.amount, 0));
  const totalCleared = round2(creditLines.reduce((a, l) => a + l.amount, 0));
  // rawBalance keeps the sign: negative means the student has paid more
  // than they've been charged (an advance / credit sitting on account).
  // `balance` stays clamped at 0 everywhere it already was, so nothing
  // downstream (Dues tab, Dashboard totals, totalOutstanding, etc.)
  // changes behavior — only the Students Register "Total Due" column
  // reads rawBalance, to actually show that advance as a negative figure.
  const rawBalance = round2(totalCharged - totalCleared);
  const balance = Math.max(0, rawBalance);

  const timeline = [
    ...allocatedCharges.map(l => ({ ...l, kind: "debit" })),
    ...creditLines.map(l => ({ ...l, kind: "credit" })),
  ].sort((a, b) => compareChrono(a, b, 1) || (a.kind === "debit" ? -1 : 1));

  let running = 0;
  const timelineWithBalance = timeline.map(l => {
    running = round2(running + (l.kind === "debit" ? l.amount : -l.amount));
    return { ...l, runningBalance: running };
  });

  return { chargeLines: allocatedCharges, creditLines, totalCharged, totalCleared, balance, rawBalance, timeline: timelineWithBalance };
}

function Stamp({ text, tone }) {
  const colors = {
    paid: { bg: "#EAF1EA", border: "#3F6B52", text: "#2E5240" },
    due: { bg: "#FBEFE3", border: "#B8862B", text: "#8A6420" },
    overdue: { bg: "#F7E7E3", border: "#A63D2F", text: "#8A3226" },
    break: { bg: "#EBF3F5", border: "#4A7B9D", text: "#2B526C" },
    carried: { bg: "#EFEAE0", border: "#6E6650", text: "#4A4636" },
  };
  const c = colors[tone] || colors.due;
  return (
    <span
      style={{
        background: c.bg, border: `1.5px solid ${c.border}`, color: c.text,
        fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.08em",
        padding: "2px 8px", borderRadius: "3px", fontWeight: 600, display: "inline-block",
        transform: "rotate(-1deg)", textTransform: "uppercase"
      }}
    >{text}</span>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white border rounded-sm ${className}`} style={{ borderColor: "#E4DCC5" }}>
      {children}
    </div>
  );
}

function SectionHeader({ eyebrow, title, action }) {
  return (
    <div className="flex items-end justify-between mb-4 pb-3" style={{ borderBottom: "1.5px solid #26231D" }}>
      <div>
        {eyebrow && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.12em", color: "#9C8F6E" }} className="uppercase mb-1">{eyebrow}</div>}
        <h2 style={{ fontFamily: "'Zilla Slab', serif" }} className="text-2xl font-semibold text-[#1B1810]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export default function CoachingLedger() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem("ledger_auth") === "true");
  const [passInput, setPassInput] = useState("");
  const [passError, setPassError] = useState(false);

  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState(DEFAULT_CLASSES);
  const [subjectsList, setSubjectsList] = useState(DEFAULT_SUBJECTS);
  const [streams, setStreams] = useState(STREAMS);
  const [feeStructure, setFeeStructure] = useState({});
  const [deposits, setDeposits] = useState([]);
  const [charges, setCharges] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [bankTransactions, setBankTransactions] = useState([]);
  const [creditTransactions, setCreditTransactions] = useState([]);
  const [interestPayments, setInterestPayments] = useState([]);
  // Internal Notes / notepad — free-form notes staff can jot down (office
  // reminders, follow-ups, things to remember) that aren't tied to any
  // student or transaction. Same live-cloud-sync pattern as everything
  // else in the app (see NotesTab / addNote / updateNote / deleteNote /
  // toggleNotePin below).
  const [notes, setNotes] = useState([]);

  const [showStudentForm, setShowStudentForm] = useState(false);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(null);
  const [showExitModal, setShowExitModal] = useState(null);
  const [showBatchChangeModal, setShowBatchChangeModal] = useState(null);
  const [showChargeModal, setShowChargeModal] = useState(null); // { student } or { student: null } for picker
  const [showStatementModal, setShowStatementModal] = useState(null);
  const [showJoiningForm, setShowJoiningForm] = useState(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showBankTxnForm, setShowBankTxnForm] = useState(false);
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [showPayInterestModal, setShowPayInterestModal] = useState(null); // credit transaction
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [expenseReceiptData, setExpenseReceiptData] = useState(null);
  const [chargeReceiptData, setChargeReceiptData] = useState(null); // { line, student }
  const [bankTxnReceiptData, setBankTxnReceiptData] = useState(null);
  const [creditReceiptData, setCreditReceiptData] = useState(null);
  const [interestReceiptData, setInterestReceiptData] = useState(null); // { payment, creditTxn }

  const handleLogin = (e) => {
    e.preventDefault();
    if (passInput === APP_PASSWORD) {
      sessionStorage.setItem("ledger_auth", "true");
      setIsAuthenticated(true);
      setPassError(false);
    } else {
      setPassError(true);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("ledger_auth");
    setIsAuthenticated(false);
    setPassInput("");
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubStudents = onSnapshot(collection(db, "students"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, status: "active", deleted: false, ...doc.data() }));
      setStudents(data);
      setLoaded(true);
    });

    const unsubDeposits = onSnapshot(collection(db, "deposits"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, deleted: false, ...doc.data() }));
      setDeposits(data);
    });

    const unsubCharges = onSnapshot(collection(db, "charges"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, deleted: false, ...doc.data() }));
      setCharges(data);
    });

    const unsubExpenses = onSnapshot(collection(db, "expenses"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, deleted: false, ...doc.data() }));
      setExpenses(data);
    });

    const unsubBankTxns = onSnapshot(collection(db, "bankTransactions"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, deleted: false, ...doc.data() }));
      setBankTransactions(data);
    });

    const unsubCreditTxns = onSnapshot(collection(db, "creditTransactions"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, deleted: false, ...doc.data() }));
      setCreditTransactions(data);
    });

    const unsubInterestPayments = onSnapshot(collection(db, "interestPayments"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, deleted: false, ...doc.data() }));
      setInterestPayments(data);
    });

    const unsubNotes = onSnapshot(collection(db, "notes"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, deleted: false, ...doc.data() }));
      setNotes(data);
    });

    const unsubFee = onSnapshot(doc(db, "settings", "feeStructure"), (docSnap) => {
      if (docSnap.exists()) {
        setFeeStructure(docSnap.data().matrix || {});
      } else {
        const init = defaultFeeStructure(DEFAULT_CLASSES);
        setDoc(doc(db, "settings", "feeStructure"), { matrix: init });
        setFeeStructure(init);
      }
    });

    const unsubClasses = onSnapshot(doc(db, "settings", "classList"), (docSnap) => {
      if (docSnap.exists()) {
        setClasses(docSnap.data().list || DEFAULT_CLASSES);
      } else {
        setDoc(doc(db, "settings", "classList"), { list: DEFAULT_CLASSES });
      }
    });

    const unsubSubjects = onSnapshot(doc(db, "settings", "subjectList"), (docSnap) => {
      if (docSnap.exists()) {
        setSubjectsList(docSnap.data().list || DEFAULT_SUBJECTS);
      } else {
        setDoc(doc(db, "settings", "subjectList"), { list: DEFAULT_SUBJECTS });
      }
    });

    // Streams / academic tracks — same pattern as Classes & Subjects above,
    // stored under settings/streamList so Add/Delete Stream (Fee & Class
    // Structure → Manage Streams) persists and immediately reflects in the
    // Add Student form's Stream dropdown for every user.
    const unsubStreams = onSnapshot(doc(db, "settings", "streamList"), (docSnap) => {
      if (docSnap.exists()) {
        setStreams(docSnap.data().list || STREAMS);
      } else {
        setDoc(doc(db, "settings", "streamList"), { list: STREAMS });
      }
    });

    return () => {
      unsubStudents(); unsubDeposits(); unsubCharges(); unsubExpenses(); unsubBankTxns();
      unsubCreditTxns(); unsubInterestPayments(); unsubNotes(); unsubFee(); unsubClasses(); unsubSubjects(); unsubStreams();
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#12312B", fontFamily: "'Inter', sans-serif" }}>
        <style>{FONT_IMPORT}</style>
        <div className="bg-[#FAF6EC] p-8 rounded-sm shadow-2xl max-w-md w-full border-2" style={{ borderColor: "#B8862B" }}>
          <div className="flex justify-center mb-3 text-[#12312B]"><Lock size={32} /></div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-2xl font-bold text-[#12312B] text-center">Batch Ledger Pro</div>
          <p className="text-xs text-[#9C8F6E] text-center uppercase tracking-wider mb-6" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Admin Authentication</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#6E6650] mb-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Enter Passcode</label>
              <input
                type="password" value={passInput} onChange={(e) => setPassInput(e.target.value)} placeholder="••••••••"
                className="w-full border rounded-sm px-3 py-2 text-sm bg-white focus:outline-none"
                style={{ borderColor: passError ? "#A63D2F" : "#D8CFB8" }} autoFocus
              />
              {passError && <p className="text-xs text-[#A63D2F] mt-1 font-medium">Incorrect passcode. Try again.</p>}
            </div>
            <button type="submit" className="w-full py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
              Unlock Ledger
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "#FAF6EC", fontFamily: "'IBM Plex Mono', monospace", color: "#8A6420" }}>Connecting to Cloud Database…</div>;
  }

  const curMonth = currentMonthKey();

  const visibleStudents = students.filter(s => !s.deleted);
  const visibleDeposits = deposits.filter(d => !d.deleted);
  const visibleCharges = charges.filter(c => !c.deleted);
  const visibleExpenses = expenses.filter(e => !e.deleted);
  const trashedStudents = students.filter(s => s.deleted);
  const trashedDeposits = deposits.filter(d => d.deleted);
  const trashedCharges = charges.filter(c => c.deleted);
  const trashedExpenses = expenses.filter(e => e.deleted);

  const studentById = Object.fromEntries(students.map(s => [s.id, s]));

  function expectedFeeFor(cls, batchCount, monthlyDiscount = 0) {
    // BUG FIX: a student with ZERO subjects/batches selected must be
    // charged ₹0 tuition — not the 1-subject fee matrix rate. The old
    // code did `batchCount || 1`, so a batchCount of 0 (falsy) silently
    // fell through to 1, and this student got billed as if they'd taken
    // a single subject they were never actually enrolled in. Now a
    // batchCount of 0 (or anything not a positive number) returns ₹0
    // straight away, before the fee matrix is ever consulted. Any real
    // subject count (1–6) still looks itself up exactly as before.
    const count = Number(batchCount) || 0;
    if (count <= 0) return 0;
    const bc = Math.max(1, Math.min(6, count));
    const baseFee = (feeStructure[cls] && feeStructure[cls][bc]) || 0;
    return Math.max(0, baseFee - (Number(monthlyDiscount) || 0));
  }

  function batchesForMonth(student, month) {
    const history = (student.batchHistory && student.batchHistory.length)
      ? student.batchHistory
      : [{ fromMonth: student.admissionMonth, batches: student.batches || [] }];
    const applicable = history.filter(h => h.fromMonth <= month).sort((a, b) => (a.fromMonth < b.fromMonth ? -1 : 1));
    if (applicable.length) return applicable[applicable.length - 1].batches || [];
    return student.batches || [];
  }

  // Per-student ledger (tuition + charges vs payments + write-offs), computed
  // fresh each render — this is the single source of truth used everywhere.
  const ledgers = {};
  visibleStudents.forEach(st => {
    ledgers[st.id] = computeStudentLedger(st, visibleDeposits, visibleCharges, batchesForMonth, expectedFeeFor, curMonth);
  });

  const studentDuesMap = {};
  visibleStudents.forEach(st => { studentDuesMap[st.id] = ledgers[st.id].balance; });
  // Signed version of the same figure — negative when a student has paid
  // in advance / overpaid. Only the Students Register "Total Due" column
  // reads this; every other total in the app keeps using the clamped
  // studentDuesMap above so nothing else changes behavior.
  const studentDuesRawMap = {};
  visibleStudents.forEach(st => { studentDuesRawMap[st.id] = ledgers[st.id].rawBalance; });

  const totalOutstanding = round2(Object.values(studentDuesMap).reduce((a, v) => a + v, 0));

  // Master charges feed — every debit line (Opening Balance, Tuition Fee
  // accruals, and Additional Charges) for every student, merged into one
  // list. Powers the consolidated "Charges" tab, which tracks all student
  // charges rather than just ad-hoc Additional Charges.
  const allChargeLines = visibleStudents.flatMap(st =>
    (ledgers[st.id]?.chargeLines || []).map(l => ({
      ...l, studentId: st.id, studentName: st.name, studentClass: st.class, studentStatus: st.status || "active",
    }))
  ).sort((a, b) => compareChrono(a, b, -1));

  // Cash vs. Online split — "Cash" is its own bucket; UPI / Bank Transfer /
  // Cheque are all treated as "Online" for the balance tracker & tiles.
  function paymentModeOf(x) { return x.mode || "Cash"; }
  const cashCollected = round2(visibleDeposits.filter(d => paymentModeOf(d) === "Cash").reduce((a, d) => a + Number(d.amount || 0), 0));
  const onlineCollected = round2(visibleDeposits.filter(d => paymentModeOf(d) !== "Cash").reduce((a, d) => a + Number(d.amount || 0), 0));
  const cashExpensesTotal = round2(visibleExpenses.filter(e => paymentModeOf(e) === "Cash").reduce((a, e) => a + Number(e.amount || 0), 0));
  const onlineExpensesTotal = round2(visibleExpenses.filter(e => paymentModeOf(e) !== "Cash").reduce((a, e) => a + Number(e.amount || 0), 0));
  const totalExpenses = round2(cashExpensesTotal + onlineExpensesTotal);

  // Center-wide statement — every ledger line (tuition, additional charges,
  // payments, write-offs) from every student, merged into one master feed.
  // NOTE: Expenses deliberately do NOT appear here any more — they live
  // exclusively in the dedicated Banking Statement below, since they are
  // money movement for the center, not a student-facing charge/payment.
  const allTransactions = visibleStudents.flatMap(st =>
    (ledgers[st.id]?.timeline || []).map(l => ({
      ...l,
      studentId: st.id, studentName: st.name, studentClass: st.class, studentStatus: st.status || "active",
    }))
  ).sort((a, b) => compareChrono(a, b, -1));

  const centerTotals = {
    charged: round2(Object.values(ledgers).reduce((a, l) => a + l.totalCharged, 0)),
    collected: round2(visibleDeposits.reduce((a, d) => a + Number(d.amount || 0), 0)),
    writtenOff: round2(visibleDeposits.reduce((a, d) => a + Number(d.writeOffAmount || 0), 0)),
    outstanding: totalOutstanding,
  };

  // ============================================================================
  // BANKING LEDGER — the dedicated feed for the Banking tab. Combines every
  // student deposit (money in), every center expense (money out), and every
  // internal Cash ⇄ Bank transfer, into one chronological statement with a
  // running Cash Balance and Bank Balance after every single line. This is
  // the only place Expenses appear now, and the only place Cash⇄Bank
  // transfers ever appear — they never touch the Center Statement because
  // no student charge/payment or center expense actually happened.
  // ============================================================================
  const visibleBankTxns = bankTransactions.filter(t => !t.deleted);
  const trashedBankTxns = bankTransactions.filter(t => t.deleted);
  const visibleCreditTxns = creditTransactions.filter(c => !c.deleted);
  const trashedCreditTxns = creditTransactions.filter(c => c.deleted);
  const visibleInterestPayments = interestPayments.filter(p => !p.deleted);
  const trashedInterestPayments = interestPayments.filter(p => p.deleted);
  const creditTxnById = Object.fromEntries(creditTransactions.map(c => [c.id, c]));

  // Notes — not part of the financial ledger at all, just a simple internal
  // notepad. Pinned notes always float to the top; everything else sorts
  // by most-recently-updated first.
  const visibleNotes = [...notes.filter(n => !n.deleted)].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || "");
  });

  const totalWithdrawals = round2(visibleBankTxns.filter(t => t.type === "withdrawal").reduce((a, t) => a + Number(t.amount || 0), 0));
  const totalBankDeposits = round2(visibleBankTxns.filter(t => t.type === "deposit").reduce((a, t) => a + Number(t.amount || 0), 0));

  const totalCreditTaken = round2(visibleCreditTxns.filter(c => c.direction === "taken").reduce((a, c) => a + Number(c.amount || 0), 0));
  const totalCreditGiven = round2(visibleCreditTxns.filter(c => c.direction === "given").reduce((a, c) => a + Number(c.amount || 0), 0));
  const totalInterestPaid = round2(visibleInterestPayments.reduce((a, p) => a + Number(p.amount || 0), 0));
  // Interest paid so far against each individual credit entry — used to
  // show a running "Interest Paid" figure on each row of the Credit Ledger.
  const interestPaidByCreditId = {};
  visibleInterestPayments.forEach(p => {
    interestPaidByCreditId[p.creditTxnId] = round2((interestPaidByCreditId[p.creditTxnId] || 0) + Number(p.amount || 0));
  });

  const bankingDepositLines = visibleDeposits.filter(d => Number(d.amount) > 0).map(d => {
    const st = studentById[d.studentId];
    const isCash = paymentModeOf(d) === "Cash";
    return {
      id: `${d.id}-bdep`, refId: getReceiptNo(d.id), source: "deposit", depositId: d.id, studentId: d.studentId,
      type: "deposit", kind: "credit", bucket: isCash ? "cash" : "bank",
      date: d.date || todayStr(), createdAt: d.createdAt || "",
      label: `Student Deposit — ${st ? st.name : "Unknown Student"}${st ? " (" + st.class + ")" : ""}`,
      remarks: d.remarks || "", amount: round2(d.amount), mode: d.mode || "Cash",
    };
  });

  const bankingExpenseLines = visibleExpenses.map(e => {
    const isCash = paymentModeOf(e) === "Cash";
    return {
      id: `${e.id}-bexp`, refId: e.expenseId || `EXP-${shortId(e.id)}`, source: "expense", expenseRowId: e.id,
      type: "expense", kind: "debit", bucket: isCash ? "cash" : "bank",
      date: e.date || todayStr(), createdAt: e.createdAt || "",
      label: (e.category ? `Expense — ${e.category}` : "Expense") + (e.paidTo ? ` (Paid to: ${e.paidTo})` : ""),
      remarks: e.remarks || "", amount: round2(e.amount), mode: e.mode || "Cash",
    };
  });

  const bankingTransferLines = visibleBankTxns.map(t => ({
    id: `${t.id}-btxn`, refId: t.txnId, source: "banktxn", bankTxnId: t.id,
    type: t.type === "withdrawal" ? "bank_withdrawal" : "bank_deposit",
    kind: "transfer", bucket: "both",
    date: t.date || todayStr(), createdAt: t.createdAt || "",
    label: t.type === "withdrawal" ? "Cash Withdrawal from Bank" : "Cash Deposited to Bank",
    remarks: t.remarks || "", amount: round2(t.amount), mode: "—",
    cashDelta: t.type === "withdrawal" ? round2(t.amount) : -round2(t.amount),
    bankDelta: t.type === "withdrawal" ? -round2(t.amount) : round2(t.amount),
  }));

  // Credit / Loan lines — "taken" (borrowed) brings money IN, "given"
  // (lent) sends money OUT, landing in Cash or Bank depending on mode.
  const bankingCreditLines = visibleCreditTxns.map(c => {
    const isCash = (c.mode || "Cash") === "Cash";
    const isTaken = c.direction === "taken";
    return {
      id: `${c.id}-credit`, refId: c.creditId, source: "credit", creditTxnId: c.id,
      type: isTaken ? "credit_taken" : "credit_given", kind: isTaken ? "credit" : "debit", bucket: isCash ? "cash" : "bank",
      date: c.date || todayStr(), createdAt: c.createdAt || "",
      label: `${isTaken ? "Credit Taken from" : "Credit Given to"} ${c.partyName || "Unknown"}`,
      remarks: c.remarks || "", amount: round2(c.amount), mode: c.mode || "Cash",
    };
  });

  // Interest we pay against a Credit Taken entry — always money OUT.
  const bankingInterestLines = visibleInterestPayments.map(p => {
    const isCash = (p.mode || "Cash") === "Cash";
    const creditTxn = creditTxnById[p.creditTxnId];
    return {
      id: `${p.id}-interest`, refId: p.paymentId, source: "interest", interestPaymentId: p.id, creditTxnId: p.creditTxnId,
      type: "interest_payment", kind: "debit", bucket: isCash ? "cash" : "bank",
      date: p.date || todayStr(), createdAt: p.createdAt || "",
      label: `Interest Paid — ${creditTxn ? creditTxn.partyName : "Unknown"}`,
      remarks: p.remarks || "", amount: round2(p.amount), mode: p.mode || "Cash",
    };
  });

  // Ascending pass (oldest first) to compute the running Cash / Bank balance
  // at each line — this is what makes "two balances with every transaction"
  // work correctly regardless of what order the statement is displayed in.
  const bankingFeedAsc = [...bankingDepositLines, ...bankingExpenseLines, ...bankingTransferLines, ...bankingCreditLines, ...bankingInterestLines]
    .sort((a, b) => compareChrono(a, b, 1) || (a.kind === "credit" ? -1 : 1));

  let runningCash = 0, runningBank = 0;
  const bankingFeed = bankingFeedAsc.map(t => {
    if (t.kind === "transfer") {
      runningCash = round2(runningCash + t.cashDelta);
      runningBank = round2(runningBank + t.bankDelta);
    } else if (t.bucket === "cash") {
      runningCash = round2(runningCash + (t.kind === "credit" ? t.amount : -t.amount));
    } else {
      runningBank = round2(runningBank + (t.kind === "credit" ? t.amount : -t.amount));
    }
    return { ...t, cashBalance: runningCash, bankBalance: runningBank };
  }).sort((a, b) => compareChrono(a, b, -1)); // newest first for display

  const bankingCashBalance = runningCash;
  const bankingBankBalance = runningBank;

  // Dashboard "Net Liquidity" balances — FIX: previously computed as just
  // (deposits collected − expenses), which silently ignored money moved by
  // Cash⇄Bank transfers, Credit/Loan entries, and Interest payments, so the
  // Dashboard could show a different (wrong) number than the Banking tab.
  // Now sourced from the exact same running balance the Banking Statement
  // uses, so both screens always agree.
  const totalCashBalance = bankingCashBalance;
  const totalOnlineBalance = bankingBankBalance;

  const bankingTotals = {
    cashBalance: bankingCashBalance,
    bankBalance: bankingBankBalance,
    totalDeposits: round2(cashCollected + onlineCollected),
    totalExpenses: totalExpenses,
    totalWithdrawals, totalBankDeposits,
    totalCreditTaken, totalCreditGiven, totalInterestPaid,
  };

  function depositMonthOf(d) { return d.date ? d.date.slice(0, 7) : null; }
  const thisMonthCollected = visibleDeposits.filter(d => depositMonthOf(d) === curMonth).reduce((a, d) => a + Number(d.amount || 0), 0);
  const thisMonthWriteOffs = visibleDeposits.filter(d => depositMonthOf(d) === curMonth).reduce((a, d) => a + Number(d.writeOffAmount || 0), 0);
  const thisMonthExpected = visibleStudents.reduce((a, st) => a + ledgers[st.id].chargeLines.filter(l => l.month === curMonth).reduce((s, l) => s + l.amount, 0), 0);

  const start = addMonths(curMonth, -5);
  const trendMonths = monthsBetween(start, curMonth);
  const trend = trendMonths.map(m => ({
    month: monthLabel(m).split(" ")[0],
    collected: visibleDeposits.filter(d => depositMonthOf(d) === m).reduce((a, d) => a + Number(d.amount || 0), 0),
  }));

  const activeStudents = visibleStudents.filter(s => (s.status || "active") === "active");
  const classStrength = Object.fromEntries(classes.map(c => [c, 0]));
  activeStudents.forEach(s => { if (classStrength[s.class] !== undefined) classStrength[s.class]++; });

  const recentDeposits = [...visibleDeposits].sort((a, b) => compareChrono(a, b, -1)).slice(0, 8);

  // Fee forecast — "how much will be charged in month X" across active
  // students (tuition) plus any additional charges already logged for X.
  function forecastForMonth(month) {
    const rows = [];
    activeStudents.forEach(st => {
      if (!st.admissionMonth || st.admissionMonth > month) return;
      const batches = batchesForMonth(st, month);
      // Same fix as computeStudentLedger() above — a subject-less student
      // must forecast ₹0, not the 1-subject rate.
      const bc = batches.length;
      const expected = expectedFeeFor(st.class, bc, st.monthlyDiscount || 0);
      if (expected > 0) rows.push({ student: st, batches, expected });
    });
    const extra = visibleCharges.filter(c => c.month === month);
    const tuitionTotal = round2(rows.reduce((a, r) => a + r.expected, 0));
    const extraTotal = round2(extra.reduce((a, c) => a + Number(c.amount || 0), 0));
    return { rows, extra, tuitionTotal, extraTotal, total: round2(tuitionTotal + extraTotal) };
  }

  // ---- Student lifecycle actions ----
  async function saveStudent(data) {
    const id = data.id || uid();
    // Every student gets a permanent, human-readable Student ID. If this is
    // an existing record that already has one (or the form already computed
    // one), it's preserved as-is; only a genuinely missing one is generated
    // — this also quietly backfills any older student saved before this
    // feature existed, the first time that record is edited.
    const studentId = data.studentId || generateStudentId(students);
    // Advance Payment is captured on the Student form but is a transaction,
    // not a student field — split it off before writing the student record.
    const { advancePayment, advancePaymentMode, advancePaymentRef, ...studentData } = data;
    const savedStudent = { ...studentData, id, studentId, deleted: false };
    await setDoc(doc(db, "students", id), savedStudent);
    setShowStudentForm(false);
    setEditingStudent(null);

    const advAmt = Number(advancePayment) || 0;
    if (advAmt > 0) {
      const depId = uid();
      const mode = advancePaymentMode || "Cash";
      const newDep = {
        id: depId, studentId: id, amount: advAmt, date: todayStr(), mode,
        utr: (mode === "UPI" || mode === "Bank Transfer") ? (advancePaymentRef || "") : "",
        chequeNumber: mode === "Cheque" ? (advancePaymentRef || "") : "",
        remarks: "Advance Payment at Admission", writeOffAmount: 0, writeOffRemarks: "", deleted: false,
      };
      await setDoc(doc(db, "deposits", depId), newDep);
      setReceiptData({ deposit: newDep, student: savedStudent });
    }
  }

  async function exitStudent(student, resultStatus, exitDateInput) {
    const reason = EXIT_REASONS.find(r => r.value === resultStatus) || EXIT_REASONS[2];
    const ledger = ledgers[student.id] || computeStudentLedger(student, visibleDeposits, visibleCharges, batchesForMonth, expectedFeeFor, curMonth);
    const openingLine = ledger.chargeLines.find(l => l.type === "opening");
    const tuitionOutstanding = ledger.chargeLines.filter(l => l.type === "monthly_fee").reduce((a, l) => a + l.outstanding, 0);
    const openingOutstanding = openingLine ? openingLine.outstanding : 0;
    const newPreviousDues = round2(openingOutstanding + tuitionOutstanding);

    const historyItem = {
      class: student.class, batches: student.batches || [], admissionMonth: student.admissionMonth,
      completionDate: exitDateInput || todayStr(), resultStatus, unpaidBalanceAtEnd: tuitionOutstanding,
    };

    const snapshot = {
      class: student.class, batches: student.batches || [],
      batchHistory: student.batchHistory || [{ fromMonth: student.admissionMonth, batches: student.batches || [] }],
      admissionMonth: student.admissionMonth, previousDues: Number(student.previousDues) || 0,
      academicHistory: student.academicHistory || [], status: student.status || "active",
      resultStatus: student.resultStatus || null, exitDate: student.exitDate || null,
    };

    const updatedStudent = {
      ...student, status: reason.status, resultStatus, previousDues: newPreviousDues,
      academicHistory: [...(student.academicHistory || []), historyItem],
      exitDate: exitDateInput || todayStr(), lastSnapshot: snapshot,
    };

    await setDoc(doc(db, "students", student.id), updatedStudent);
    setShowExitModal(null);
  }

  async function undoExit(student) {
    if (!student.lastSnapshot) { alert("Nothing to undo for this student."); return; }
    if (!window.confirm(`Undo the last status change for ${student.name}? This restores ${student.lastSnapshot.class} as Active and removes the most recent history entry.`)) return;
    const snap = student.lastSnapshot;
    const restoredHistory = (student.academicHistory || []).slice(0, -1);
    const restored = {
      ...student, class: snap.class, batches: snap.batches, batchHistory: snap.batchHistory,
      admissionMonth: snap.admissionMonth, previousDues: snap.previousDues,
      academicHistory: restoredHistory.length ? restoredHistory : snap.academicHistory,
      status: "active", resultStatus: null, exitDate: null, lastSnapshot: null,
    };
    await setDoc(doc(db, "students", student.id), restored);
  }

  async function promoteStudent(student, newClass, newBatches, newStartMonth, monthlyDiscount) {
    const history = [...(student.batchHistory || [{ fromMonth: student.admissionMonth, batches: student.batches || [] }])];
    const idx = history.findIndex(h => h.fromMonth === newStartMonth);
    const entry = { fromMonth: newStartMonth, batches: newBatches };
    if (idx >= 0) history[idx] = entry; else history.push(entry);
    history.sort((a, b) => (a.fromMonth < b.fromMonth ? -1 : 1));

    const updatedStudent = {
      ...student, class: newClass, batches: newBatches, batchHistory: history, admissionMonth: newStartMonth,
      monthlyDiscount: Number(monthlyDiscount) || 0, status: "active", resultStatus: null, exitDate: null, lastSnapshot: null,
    };
    await setDoc(doc(db, "students", student.id), updatedStudent);
    setShowPromoteModal(null);
  }

  async function changeStudentBatches(student, fromMonth, newBatches) {
    const history = [...(student.batchHistory || [{ fromMonth: student.admissionMonth, batches: student.batches || [] }])];
    const idx = history.findIndex(h => h.fromMonth === fromMonth);
    const entry = { fromMonth, batches: newBatches };
    if (idx >= 0) history[idx] = entry; else history.push(entry);
    history.sort((a, b) => (a.fromMonth < b.fromMonth ? -1 : 1));
    const latest = history[history.length - 1];
    await setDoc(doc(db, "students", student.id), { ...student, batchHistory: history, batches: latest.batches });
    setShowBatchChangeModal(null);
  }

  // ---- Soft delete / restore (Trash) ----
  async function softDeleteStudent(id) {
    const s = studentById[id];
    if (!s) return;
    if (!window.confirm("Move this student to Trash? All their data (fees, payments, history) is kept and can be restored.")) return;
    await setDoc(doc(db, "students", id), { ...s, deleted: true, deletedAt: todayStr() });
  }
  async function restoreStudent(id) {
    const s = studentById[id];
    if (!s) return;
    await setDoc(doc(db, "students", id), { ...s, deleted: false, deletedAt: null });
  }
  async function permanentlyDeleteStudent(id) {
    if (!window.confirm("Permanently delete this student and all associated records? This cannot be undone.")) return;
    await deleteDoc(doc(db, "students", id));
  }

  async function softDeleteDeposit(id) {
    const d = deposits.find(x => x.id === id);
    if (!d) return;
    if (!window.confirm("Move this receipt to Trash? It can be restored later.")) return;
    await setDoc(doc(db, "deposits", id), { ...d, deleted: true, deletedAt: todayStr() });
  }
  async function restoreDeposit(id) {
    const d = deposits.find(x => x.id === id);
    if (!d) return;
    await setDoc(doc(db, "deposits", id), { ...d, deleted: false, deletedAt: null });
  }
  async function permanentlyDeleteDeposit(id) {
    if (!window.confirm("Permanently delete this receipt? This cannot be undone.")) return;
    await deleteDoc(doc(db, "deposits", id));
  }

  async function addCharge(data) {
    const id = uid();
    const chargeId = `CHG-${shortId(id)}`;
    await setDoc(doc(db, "charges", id), { ...data, id, chargeId, deleted: false, createdAt: nowStamp() });
    setShowChargeModal(null);
  }
  async function softDeleteCharge(id) {
    const c = charges.find(x => x.id === id);
    if (!c) return;
    if (!window.confirm("Remove this charge? It can be restored later from Trash.")) return;
    await setDoc(doc(db, "charges", id), { ...c, deleted: true, deletedAt: todayStr() });
  }
  async function restoreCharge(id) {
    const c = charges.find(x => x.id === id);
    if (!c) return;
    await setDoc(doc(db, "charges", id), { ...c, deleted: false, deletedAt: null });
  }
  async function permanentlyDeleteCharge(id) {
    if (!window.confirm("Permanently delete this charge? This cannot be undone.")) return;
    await deleteDoc(doc(db, "charges", id));
  }

  async function addExpense(data) {
    const id = uid();
    const expenseId = `EXP-${shortId(id)}`;
    const newExp = { ...data, id, expenseId, deleted: false, createdAt: nowStamp() };
    await setDoc(doc(db, "expenses", id), newExp);
    setShowExpenseForm(false);
    setExpenseReceiptData(newExp);
  }
  async function softDeleteExpense(id) {
    const e = expenses.find(x => x.id === id);
    if (!e) return;
    if (!window.confirm("Remove this expense? It can be restored later from Trash.")) return;
    await setDoc(doc(db, "expenses", id), { ...e, deleted: true, deletedAt: todayStr() });
  }
  async function restoreExpense(id) {
    const e = expenses.find(x => x.id === id);
    if (!e) return;
    await setDoc(doc(db, "expenses", id), { ...e, deleted: false, deletedAt: null });
  }
  async function permanentlyDeleteExpense(id) {
    if (!window.confirm("Permanently delete this expense? This cannot be undone.")) return;
    await deleteDoc(doc(db, "expenses", id));
  }

  // ---- Notes — simple internal notepad, independent of the financial ledger ----
  async function saveNote(data) {
    if (data.id) {
      const existing = notes.find(n => n.id === data.id);
      await setDoc(doc(db, "notes", data.id), {
        ...existing, title: data.title, body: data.body, pinned: !!(existing && existing.pinned),
        updatedAt: nowStamp(),
      });
    } else {
      const id = uid();
      await setDoc(doc(db, "notes", id), {
        id, title: data.title, body: data.body, pinned: false, deleted: false,
        createdAt: nowStamp(), updatedAt: nowStamp(),
      });
    }
    setShowNoteForm(false);
    setEditingNote(null);
  }
  async function toggleNotePin(id) {
    const n = notes.find(x => x.id === id);
    if (!n) return;
    await setDoc(doc(db, "notes", id), { ...n, pinned: !n.pinned, updatedAt: nowStamp() });
  }
  async function deleteNote(id) {
    if (!window.confirm("Delete this note? This cannot be undone.")) return;
    await deleteDoc(doc(db, "notes", id));
  }

  // ---- Banking — internal Cash ↔ Bank transfer transactions ----
  // These move money between the two balances the center actually holds
  // (physical Cash and the Bank/Online account) without creating any
  // student charge, payment, or center expense. Each one gets its own
  // unique, trackable Transaction ID and only ever appears in the Banking
  // Statement — never in the Center Statement — because no real income or
  // expenditure has happened, just a transfer between two of our own pockets.
  async function addBankTransaction(data) {
    const id = uid();
    const txnId = `BTX-${shortId(id)}`;
    const newTxn = { ...data, id, txnId, deleted: false, createdAt: nowStamp() };
    await setDoc(doc(db, "bankTransactions", id), newTxn);
    setShowBankTxnForm(false);
    setBankTxnReceiptData(newTxn);
  }
  async function softDeleteBankTransaction(id) {
    const t = bankTransactions.find(x => x.id === id);
    if (!t) return;
    if (!window.confirm("Remove this bank transaction? It can be restored later from Trash.")) return;
    await setDoc(doc(db, "bankTransactions", id), { ...t, deleted: true, deletedAt: todayStr() });
  }
  async function restoreBankTransaction(id) {
    const t = bankTransactions.find(x => x.id === id);
    if (!t) return;
    await setDoc(doc(db, "bankTransactions", id), { ...t, deleted: false, deletedAt: null });
  }
  async function permanentlyDeleteBankTransaction(id) {
    if (!window.confirm("Permanently delete this bank transaction? This cannot be undone.")) return;
    await deleteDoc(doc(db, "bankTransactions", id));
  }

  // ---- Banking — Credit / Loan ledger (money we borrow from someone, or
  // money we lend to someone). Each entry gets its own unique Credit ID
  // and feeds the Cash Balance / Bank Balance the same way a deposit or
  // expense does, based on whether it moved as Cash or Online. ----
  async function addCreditTransaction(data) {
    const id = uid();
    const creditId = `CR-${shortId(id)}`;
    const newTxn = { ...data, id, creditId, deleted: false, createdAt: nowStamp() };
    await setDoc(doc(db, "creditTransactions", id), newTxn);
    setShowCreditForm(false);
    setCreditReceiptData(newTxn);
  }
  async function softDeleteCreditTransaction(id) {
    const c = creditTransactions.find(x => x.id === id);
    if (!c) return;
    if (!window.confirm("Remove this credit / loan entry? It can be restored later from Trash.")) return;
    await setDoc(doc(db, "creditTransactions", id), { ...c, deleted: true, deletedAt: todayStr() });
  }
  async function restoreCreditTransaction(id) {
    const c = creditTransactions.find(x => x.id === id);
    if (!c) return;
    await setDoc(doc(db, "creditTransactions", id), { ...c, deleted: false, deletedAt: null });
  }
  async function permanentlyDeleteCreditTransaction(id) {
    if (!window.confirm("Permanently delete this credit / loan entry? This cannot be undone.")) return;
    await deleteDoc(doc(db, "creditTransactions", id));
  }

  // Interest paid against a specific Credit Taken (borrowed) entry. Gets
  // its own unique, clickable/printable Interest Payment ID and is always
  // money moving out (Cash or Online) from the center.
  async function addInterestPayment(data) {
    const id = uid();
    const paymentId = `INT-${shortId(id)}`;
    const newPayment = { ...data, id, paymentId, deleted: false, createdAt: nowStamp() };
    await setDoc(doc(db, "interestPayments", id), newPayment);
    setShowPayInterestModal(null);
    const creditTxn = creditTransactions.find(c => c.id === data.creditTxnId);
    setInterestReceiptData({ payment: newPayment, creditTxn });
  }
  async function softDeleteInterestPayment(id) {
    const p = interestPayments.find(x => x.id === id);
    if (!p) return;
    if (!window.confirm("Remove this interest payment? It can be restored later from Trash.")) return;
    await setDoc(doc(db, "interestPayments", id), { ...p, deleted: true, deletedAt: todayStr() });
  }
  async function restoreInterestPayment(id) {
    const p = interestPayments.find(x => x.id === id);
    if (!p) return;
    await setDoc(doc(db, "interestPayments", id), { ...p, deleted: false, deletedAt: null });
  }
  async function permanentlyDeleteInterestPayment(id) {
    if (!window.confirm("Permanently delete this interest payment? This cannot be undone.")) return;
    await deleteDoc(doc(db, "interestPayments", id));
  }

  async function saveFeeStructure(updatedMatrix) {
    setFeeStructure(updatedMatrix);
    await setDoc(doc(db, "settings", "feeStructure"), { matrix: updatedMatrix });
  }
  async function saveClasses(updatedList) {
    setClasses(updatedList);
    await setDoc(doc(db, "settings", "classList"), { list: updatedList });
  }
  async function saveSubjects(updatedList) {
    setSubjectsList(updatedList);
    await setDoc(doc(db, "settings", "subjectList"), { list: updatedList });
  }
  async function saveStreams(updatedList) {
    setStreams(updatedList);
    await setDoc(doc(db, "settings", "streamList"), { list: updatedList });
  }

  async function saveDeposit(data) {
    const id = uid();
    const newDep = { ...data, id, deleted: false, createdAt: nowStamp() };
    await setDoc(doc(db, "deposits", id), newDep);
    setShowDepositForm(false);
    const st = studentById[data.studentId];
    setReceiptData({ deposit: newDep, student: st });
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { id: "students", label: "Students Register", icon: Users },
    { id: "structure", label: "Fee & Class Structure", icon: Wallet },
    { id: "deposits", label: "Deposits Log", icon: Receipt },
    { id: "expenses", label: "Expenses Log", icon: CreditCard },
    { id: "charges", label: "Charges", icon: ClipboardList },
    { id: "dues", label: "Pending Dues", icon: AlertCircle },
    { id: "statement", label: "Center Statement", icon: FileText },
    { id: "banking", label: "Banking", icon: Landmark },
    { id: "notes", label: "Notes", icon: BookOpen },
    { id: "trash", label: "Trash / Restore", icon: Archive },
  ];

  const trashCount = trashedStudents.length + trashedDeposits.length + trashedCharges.length + trashedExpenses.length + trashedBankTxns.length + trashedCreditTxns.length + trashedInterestPayments.length;

  return (
    <div className="min-h-screen flex" style={{ background: "#FAF6EC", fontFamily: "'Inter', sans-serif", color: "#26231D" }}>
      <style>{`${FONT_IMPORT}
        .ledger-row:nth-child(even) { background: #F5F0E1; }
        input, select { font-family: 'Inter', sans-serif; }
        ::selection { background: #B8862B33; }

        /* Joining Form — same class names the print stylesheet uses, so the
           on-screen preview matches the printed A4 form instead of showing
           up as plain unstyled text. */
        .joining-form-doc { position: relative; }
        .joining-form-doc .header { text-align: center; border-bottom: 2px dashed #12312B; padding-bottom: 14px; margin-bottom: 20px; }
        .joining-form-doc .section-title { font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #8A6420; border-bottom: 1px solid #D8CFB8; padding-bottom: 5px; margin: 22px 0 12px; }
        .joining-form-doc .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 28px; }
        .joining-form-doc .row { font-size: 13px; padding: 8px 2px; border-bottom: 1px dotted #E4DCC5; display: flex; justify-content: space-between; gap: 14px; }
        .joining-form-doc .label { color: #6E6650; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; letter-spacing: 0.02em; }
        .joining-form-doc .value { font-weight: 600; color: #12312B; text-align: right; }
        .joining-form-doc .footer { border-top: 1.5px solid #12312B; padding-top: 12px; margin-top: 30px; text-align: center; font-size: 10px; color: #6E6650; letter-spacing: 0.05em; }
        .joining-form-doc .sign-row { display: flex; justify-content: space-between; margin-top: 68px; font-size: 12px; }
        .joining-form-doc .sign-line { border-top: 1px solid #12312B; padding-top: 6px; width: 200px; text-align: center; color: #4A4636; }
      `}</style>

      <aside className="w-60 shrink-0 flex flex-col justify-between" style={{ background: "#12312B" }}>
        <div>
          <div className="px-5 pt-6 pb-5" style={{ borderBottom: "1px solid #24473F" }}>
            <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#F4EFDE] leading-tight">Batch<br/>Ledger Pro</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#8FAE9F" }} className="mt-1 uppercase tracking-wider">Coaching Register</div>
          </div>
          <nav className="px-3 py-4 space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button key={item.id} onClick={() => setTab(item.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-sm text-sm transition-colors relative"
                  style={{ background: active ? "#F4EFDE" : "transparent", color: active ? "#12312B" : "#C9D9CF", fontWeight: active ? 600 : 500 }}>
                  <Icon size={16} />
                  {item.label}
                  {item.id === "trash" && trashCount > 0 && (
                    <span className="ml-auto text-[10px] font-mono px-1.5 rounded-full" style={{ background: "#A63D2F", color: "white" }}>{trashCount}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
        <div style={{ borderTop: "1px solid #24473F" }}>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-5 py-3 text-xs font-medium text-[#8FAE9F] hover:text-[#F4EFDE] transition-colors" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            <LogOut size={14} /> Lock Portal
          </button>
          <div className="px-5 pb-4 text-[10px]" style={{ color: "#6E9384", fontFamily: "'IBM Plex Mono', monospace" }}>
            {monthLabel(curMonth)} · <span style={{ color: "#8FAE9F" }}>live cloud sync</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 px-8 py-7 max-w-6xl">
        {tab === "dashboard" && (
          <DashboardTab
            students={activeStudents} thisMonthCollected={thisMonthCollected} thisMonthWriteOffs={thisMonthWriteOffs}
            thisMonthExpected={thisMonthExpected} totalOutstanding={totalOutstanding} trend={trend} classStrength={classStrength}
            recentDeposits={recentDeposits} studentById={studentById} curMonth={curMonth} classes={classes}
            studentDues={studentDuesMap} forecastForMonth={forecastForMonth}
            totalCashBalance={totalCashBalance} totalOnlineBalance={totalOnlineBalance}
            cashExpensesTotal={cashExpensesTotal} onlineExpensesTotal={onlineExpensesTotal} totalExpenses={totalExpenses}
            onOpenReceipt={(dep) => setReceiptData({ deposit: dep, student: studentById[dep.studentId] })}
            onStatement={(s) => setShowStatementModal(s)}
          />
        )}
        {tab === "students" && (
          <StudentsTab
            students={visibleStudents} studentDues={studentDuesMap} studentDuesRaw={studentDuesRawMap} classes={classes} streams={streams}
            batchesForMonth={batchesForMonth} curMonth={curMonth}
            onAdd={() => { setEditingStudent(null); setShowStudentForm(true); }}
            onEdit={(s) => { setEditingStudent(s); setShowStudentForm(true); }}
            onExit={(s) => setShowExitModal(s)} onPromote={(s) => setShowPromoteModal(s)}
            onViewHistory={(s) => setShowHistoryModal(s)} onBatchChange={(s) => setShowBatchChangeModal(s)}
            onUndo={undoExit} onStatement={(s) => setShowStatementModal(s)}
            onAddCharge={(s) => setShowChargeModal({ student: s })}
            onJoiningForm={(s) => setShowJoiningForm(s)}
            onRemove={softDeleteStudent}
          />
        )}
        {tab === "structure" && (
          <StructureTab
            feeStructure={feeStructure} setFeeStructure={saveFeeStructure} classes={classes}
            subjectsList={subjectsList} onSaveClasses={saveClasses} onSaveSubjects={saveSubjects}
            streams={streams} onSaveStreams={saveStreams}
          />
        )}
        {tab === "deposits" && (
          <DepositsTab
            deposits={visibleDeposits} students={visibleStudents} classes={classes} studentDues={studentDuesMap}
            onAdd={() => setShowDepositForm(true)} onRemove={softDeleteDeposit}
            onOpenReceipt={(dep) => setReceiptData({ deposit: dep, student: studentById[dep.studentId] })}
          />
        )}
        {tab === "expenses" && (
          <ExpensesTab
            expenses={visibleExpenses}
            onAdd={() => setShowExpenseForm(true)} onRemove={softDeleteExpense}
            onOpenReceipt={(exp) => setExpenseReceiptData(exp)}
          />
        )}
        {tab === "charges" && (
          <ChargesTab
            chargeLines={allChargeLines} students={visibleStudents} classes={classes}
            onAdd={() => setShowChargeModal({ student: null })} onRemove={softDeleteCharge}
            onOpenReceipt={(line) => setChargeReceiptData({ line, student: studentById[line.studentId] })}
          />
        )}
        {tab === "dues" && (
          <DuesTab
            students={visibleStudents} ledgers={ledgers} totalOutstanding={totalOutstanding} classes={classes}
            onStatement={(s) => setShowStatementModal(s)}
          />
        )}
        {tab === "statement" && (
          <CenterStatementTab
            transactions={allTransactions} totals={centerTotals} students={visibleStudents} classes={classes}
            onViewReceipt={(depositId) => {
              const dep = visibleDeposits.find(d => d.id === depositId);
              if (dep) setReceiptData({ deposit: dep, student: studentById[dep.studentId] });
            }}
            onViewCharge={(t) => setChargeReceiptData({
              line: { chargeId: t.chargeId, type: t.type, date: t.date, month: t.month, label: t.label, amount: t.amount, remarks: t.remarks },
              student: studentById[t.studentId],
            })}
          />
        )}
        {tab === "banking" && (
          <BankingTab
            feed={bankingFeed} totals={bankingTotals}
            bankTxns={visibleBankTxns} creditTxns={visibleCreditTxns} interestPayments={visibleInterestPayments}
            interestPaidByCreditId={interestPaidByCreditId} students={visibleStudents}
            onAdd={() => setShowBankTxnForm(true)}
            onAddCredit={() => setShowCreditForm(true)}
            onPayInterest={(creditTxn) => setShowPayInterestModal(creditTxn)}
            onViewReceipt={(depositId) => {
              const dep = visibleDeposits.find(d => d.id === depositId);
              if (dep) setReceiptData({ deposit: dep, student: studentById[dep.studentId] });
            }}
            onViewExpense={(expenseRowId) => {
              const exp = visibleExpenses.find(e => e.id === expenseRowId);
              if (exp) setExpenseReceiptData(exp);
            }}
            onViewBankTxn={(bankTxnId) => {
              const t = visibleBankTxns.find(x => x.id === bankTxnId);
              if (t) setBankTxnReceiptData(t);
            }}
            onViewCredit={(creditTxnId) => {
              const c = visibleCreditTxns.find(x => x.id === creditTxnId);
              if (c) setCreditReceiptData(c);
            }}
            onViewInterest={(interestPaymentId) => {
              const p = visibleInterestPayments.find(x => x.id === interestPaymentId);
              if (p) setInterestReceiptData({ payment: p, creditTxn: creditTxnById[p.creditTxnId] });
            }}
            onRemoveBankTxn={softDeleteBankTransaction}
            onRemoveCredit={softDeleteCreditTransaction}
            onRemoveInterest={softDeleteInterestPayment}
          />
        )}
        {tab === "notes" && (
          <NotesTab
            notes={visibleNotes}
            onAdd={() => { setEditingNote(null); setShowNoteForm(true); }}
            onEdit={(n) => { setEditingNote(n); setShowNoteForm(true); }}
            onTogglePin={toggleNotePin}
            onDelete={deleteNote}
          />
        )}
        {tab === "trash" && (
          <TrashTab
            trashedStudents={trashedStudents} trashedDeposits={trashedDeposits} trashedCharges={trashedCharges} trashedExpenses={trashedExpenses}
            trashedBankTxns={trashedBankTxns} trashedCreditTxns={trashedCreditTxns} trashedInterestPayments={trashedInterestPayments}
            studentById={studentById}
            onRestoreStudent={restoreStudent} onDeleteStudent={permanentlyDeleteStudent}
            onRestoreDeposit={restoreDeposit} onDeleteDeposit={permanentlyDeleteDeposit}
            onRestoreCharge={restoreCharge} onDeleteCharge={permanentlyDeleteCharge}
            onRestoreExpense={restoreExpense} onDeleteExpense={permanentlyDeleteExpense}
            onRestoreBankTxn={restoreBankTransaction} onDeleteBankTxn={permanentlyDeleteBankTransaction}
            onRestoreCredit={restoreCreditTransaction} onDeleteCredit={permanentlyDeleteCreditTransaction}
            onRestoreInterest={restoreInterestPayment} onDeleteInterest={permanentlyDeleteInterestPayment}
          />
        )}
      </main>

      {showStudentForm && (
        <StudentFormModal classes={classes} subjectsList={subjectsList} streams={streams} initial={editingStudent} students={visibleStudents}
          onClose={() => { setShowStudentForm(false); setEditingStudent(null); }} onSave={saveStudent} />
      )}
      {showDepositForm && (
        <DepositFormModal students={visibleStudents} studentDues={studentDuesMap} onClose={() => setShowDepositForm(false)} onSave={saveDeposit} />
      )}
      {showPromoteModal && (
        <PromoteModal student={showPromoteModal} classes={classes} subjectsList={subjectsList} curMonth={curMonth} onClose={() => setShowPromoteModal(null)} onPromote={promoteStudent} />
      )}
      {showExitModal && (
        <ExitStudentModal student={showExitModal} currentDue={studentDuesMap[showExitModal.id] || 0} onClose={() => setShowExitModal(null)} onConfirm={(reason, exitDate) => exitStudent(showExitModal, reason, exitDate)} />
      )}
      {showBatchChangeModal && (
        <BatchChangeModal student={showBatchChangeModal} subjectsList={subjectsList} curMonth={curMonth} onClose={() => setShowBatchChangeModal(null)} onSave={changeStudentBatches} />
      )}
      {showHistoryModal && <AcademicHistoryModal student={showHistoryModal} onClose={() => setShowHistoryModal(null)} />}
      {showJoiningForm && <JoiningFormModal student={showJoiningForm} deposits={visibleDeposits} onClose={() => setShowJoiningForm(null)} />}
      {showChargeModal && (
        <AddChargeModal students={visibleStudents} charges={visibleCharges} initialStudent={showChargeModal.student} curMonth={curMonth} onClose={() => setShowChargeModal(null)} onSave={addCharge} />
      )}
      {showStatementModal && (
        <StudentStatementModal
          student={showStatementModal}
          ledger={ledgers[showStatementModal.id]}
          onClose={() => setShowStatementModal(null)}
          onViewReceipt={(depositId) => {
            const dep = visibleDeposits.find(d => d.id === depositId);
            if (dep) setReceiptData({ deposit: dep, student: showStatementModal });
          }}
          onViewCharge={(line) => setChargeReceiptData({ line, student: showStatementModal })}
        />
      )}
      {receiptData && (
        <ReceiptModal deposit={receiptData.deposit} student={receiptData.student} totalRemainingDue={studentDuesMap[receiptData.student?.id] || 0} onClose={() => setReceiptData(null)} />
      )}
      {showExpenseForm && (
        <ExpenseFormModal onClose={() => setShowExpenseForm(false)} onSave={addExpense} />
      )}
      {showNoteForm && (
        <NoteFormModal initial={editingNote} onClose={() => { setShowNoteForm(false); setEditingNote(null); }} onSave={saveNote} />
      )}
      {expenseReceiptData && (
        <ExpenseReceiptModal expense={expenseReceiptData} onClose={() => setExpenseReceiptData(null)} />
      )}
      {chargeReceiptData && (
        <ChargeReceiptModal line={chargeReceiptData.line} student={chargeReceiptData.student} onClose={() => setChargeReceiptData(null)} />
      )}
      {showBankTxnForm && (
        <BankTxnFormModal onClose={() => setShowBankTxnForm(false)} onSave={addBankTransaction} />
      )}
      {bankTxnReceiptData && (
        <BankTxnReceiptModal txn={bankTxnReceiptData} onClose={() => setBankTxnReceiptData(null)} />
      )}
      {showCreditForm && (
        <CreditFormModal onClose={() => setShowCreditForm(false)} onSave={addCreditTransaction} />
      )}
      {creditReceiptData && (
        <CreditReceiptModal txn={creditReceiptData} onClose={() => setCreditReceiptData(null)} />
      )}
      {showPayInterestModal && (
        <PayInterestModal creditTxn={showPayInterestModal} interestPaidSoFar={interestPaidByCreditId[showPayInterestModal.id] || 0}
          onClose={() => setShowPayInterestModal(null)} onSave={addInterestPayment} />
      )}
      {interestReceiptData && (
        <InterestReceiptModal payment={interestReceiptData.payment} creditTxn={interestReceiptData.creditTxn} onClose={() => setInterestReceiptData(null)} />
      )}
    </div>
  );
}

function StatCard({ label, value, sub, tone }) {
  const toneColor = { good: "#3F6B52", warn: "#B8862B", bad: "#A63D2F", neutral: "#1B1810" }[tone || "neutral"];
  return (
    <Card className="p-4">
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.1em" }} className="uppercase text-[#9C8F6E] mb-2">{label}</div>
      <div style={{ fontFamily: "'Zilla Slab', serif", color: toneColor }} className="text-3xl font-bold">{value}</div>
      {sub && <div className="text-xs text-[#9C8F6E] mt-1">{sub}</div>}
    </Card>
  );
}

// ============================================================================
// FINANCIAL SUMMARY CARD — a professional, multi-metric tile for the
// Dashboard that groups Cash + Online figures together with a combined
// headline total (e.g. "Total Operating Balance" / "Total Cumulative
// Expenses"), instead of scattering them across separate single-number
// tiles.
// ============================================================================
function FinancialSummaryCard({ title, icon: TitleIcon, tone, total, metrics }) {
  const toneColor = { good: "#3F6B52", bad: "#A63D2F" }[tone] || "#12312B";
  const toneBg = { good: "#EAF1EA", bad: "#F7E7E3" }[tone] || "#FAF6EC";
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          {TitleIcon && <TitleIcon size={14} style={{ color: toneColor }} />}
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.1em" }} className="uppercase text-[#9C8F6E]">{title}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        {metrics.map(m => (
          <div key={m.label} className="p-3 rounded bg-[#FAF6EC] border" style={{ borderColor: "#D8CFB8" }}>
            <div className="flex items-center gap-1 text-[10px] uppercase text-[#9C8F6E] font-mono mb-1">
              {m.icon && <m.icon size={11} />} {m.label}
            </div>
            <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-bold text-[#12312B]">{fmtINR(m.value)}</div>
          </div>
        ))}
      </div>
      <div className="p-3 rounded border" style={{ background: toneBg, borderColor: toneColor }}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: toneColor, fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }}>{total.label}</span>
          <span style={{ fontFamily: "'Zilla Slab', serif", color: toneColor }} className="text-xl font-bold">{fmtINR(total.value)}</span>
        </div>
      </div>
    </Card>
  );
}

function FeeForecastCard({ curMonth, forecastForMonth }) {
  const [month, setMonth] = useState(curMonth);
  const result = forecastForMonth(month);
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold">Fee Forecast</div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="border rounded-sm px-2.5 py-1.5 text-xs bg-white" style={{ borderColor: "#D8CFB8" }} />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="p-2.5 rounded bg-[#FAF6EC] border" style={{ borderColor: "#D8CFB8" }}>
          <div className="text-[10px] uppercase text-[#9C8F6E] font-mono">Tuition</div>
          <div className="text-lg font-bold text-[#12312B]" style={{ fontFamily: "'Zilla Slab', serif" }}>{fmtINR(result.tuitionTotal)}</div>
        </div>
        <div className="p-2.5 rounded bg-[#FAF6EC] border" style={{ borderColor: "#D8CFB8" }}>
          <div className="text-[10px] uppercase text-[#9C8F6E] font-mono">Additional Charges</div>
          <div className="text-lg font-bold text-[#B8862B]" style={{ fontFamily: "'Zilla Slab', serif" }}>{fmtINR(result.extraTotal)}</div>
        </div>
        <div className="p-2.5 rounded bg-[#EAF1EA] border" style={{ borderColor: "#3F6B52" }}>
          <div className="text-[10px] uppercase text-[#3F6B52] font-mono">Total for {monthLabel(month)}</div>
          <div className="text-lg font-bold text-[#3F6B52]" style={{ fontFamily: "'Zilla Slab', serif" }}>{fmtINR(result.total)}</div>
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {result.rows.length === 0 ? (
          <div className="text-xs text-[#9C8F6E] p-2 text-center">No students will be billed for {monthLabel(month)}.</div>
        ) : (
          <table className="w-full text-xs">
            <tbody>
              {result.rows.map(r => (
                <tr key={r.student.id} className="ledger-row">
                  <td className="px-2 py-1.5 font-medium">{r.student.name}</td>
                  <td className="px-2 py-1.5 text-[#6E6650]">{r.student.class}</td>
                  <td className="px-2 py-1.5 text-[#6E6650]">{r.batches.join(", ") || "—"}</td>
                  <td className="px-2 py-1.5 text-right font-mono font-semibold">{fmtINR(r.expected)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}

// Small uppercase divider label used to break the Dashboard into clearly
// named sections (Overview / Financial Health / Trends & Activity /
// Outstanding Dues) — purely visual grouping, changes nothing functional.
function DashSectionLabel({ children }) {
  return (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.12em" }} className="uppercase text-[#9C8F6E] mb-2.5 mt-7 first:mt-0">
      {children}
    </div>
  );
}

function DashboardTab({ students, thisMonthCollected, thisMonthWriteOffs, thisMonthExpected, totalOutstanding, trend, classStrength, recentDeposits, studentById, curMonth, classes, studentDues, forecastForMonth, totalCashBalance, totalOnlineBalance, cashExpensesTotal, onlineExpensesTotal, totalExpenses, onOpenReceipt, onStatement }) {
  const collectionRate = thisMonthExpected > 0 ? Math.round((thisMonthCollected / thisMonthExpected) * 100) : 0;
  // Net Liquidity = Cash Balance + Online/Bank Balance, both now sourced
  // straight from the Banking ledger's running totals (see the "Dashboard
  // Net Liquidity" fix note where totalCashBalance / totalOnlineBalance are
  // computed), so this figure always matches the Banking tab exactly.
  const netLiquidity = round2(totalCashBalance + totalOnlineBalance);

  // NEW: Top Outstanding Dues — quick at-a-glance list of whoever owes the
  // most right now, without leaving the Dashboard to open the Dues tab.
  // Built from studentDues (id → balance) + studentById, both already
  // available to this component; purely additive, touches no other data.
  const topDues = Object.entries(studentDues || {})
    .map(([id, bal]) => ({ student: studentById[id], balance: round2(bal) }))
    .filter(x => x.student && x.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 6);

  return (
    <div>
      <SectionHeader eyebrow={monthLabel(curMonth)} title="Summary" />

      {/* ===== OVERVIEW ===== */}
      <DashSectionLabel>Overview</DashSectionLabel>
      <div className="grid grid-cols-4 gap-4 mb-4">
        <StatCard label="Active Students" value={students.length} sub={`${classes.filter(c => students.some(s => s.class === c)).length} active classes`} />
        <StatCard label="Collected this month" value={fmtINR(thisMonthCollected)} sub={`of ${fmtINR(thisMonthExpected)} expected`} tone="good" />
        <StatCard label="Collection rate" value={`${collectionRate}%`} tone={collectionRate >= 80 ? "good" : collectionRate >= 50 ? "warn" : "bad"} />
        <StatCard label="Total Dues Balance" value={fmtINR(totalOutstanding)} sub={thisMonthWriteOffs > 0 ? `${fmtINR(thisMonthWriteOffs)} written off this month` : "includes carried-over dues"} tone={totalOutstanding > 0 ? "bad" : "good"} />
      </div>

      {/* ===== FINANCIAL HEALTH ===== */}
      <DashSectionLabel>Financial Health — Cash &amp; Bank</DashSectionLabel>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <FinancialSummaryCard
          title="Net Liquidity"
          icon={Landmark}
          tone="good"
          total={{ label: "Total Operating Balance", value: netLiquidity }}
          metrics={[
            { label: "Cash Balance", value: totalCashBalance, icon: Banknote },
            { label: "Online Balance", value: totalOnlineBalance, icon: CreditCard },
          ]}
        />
        <FinancialSummaryCard
          title="Cumulative Outflows"
          icon={Receipt}
          tone="bad"
          total={{ label: "Total Cumulative Expenses", value: totalExpenses }}
          metrics={[
            { label: "Cash Expenses", value: cashExpensesTotal, icon: Banknote },
            { label: "Online Expenses", value: onlineExpensesTotal, icon: CreditCard },
          ]}
        />
      </div>
      <div className="text-[11px] text-[#9C8F6E] mb-2 flex items-center gap-1.5"><Landmark size={11} /> These balances include every deposit, expense, Cash⇄Bank transfer, and Credit/Loan movement — always in sync with the Banking tab.</div>

      {/* ===== TRENDS & ACTIVITY ===== */}
      <DashSectionLabel>Trends &amp; Activity</DashSectionLabel>
      <div className="grid grid-cols-3 gap-5 mb-6">
        <Card className="col-span-2 p-5">
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold mb-3">Collections — last 6 months</div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4DCC5" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#8A7F5F" }} axisLine={{ stroke: "#D8CFB8" }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#8A7F5F" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
                <Tooltip formatter={(v) => fmtINR(v)} contentStyle={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, border: "1px solid #D8CFB8" }} />
                <Bar dataKey="collected" fill="#3F6B52" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5 overflow-y-auto max-h-72">
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold mb-3">Class Strength</div>
          <div className="space-y-2">
            {classes.map(c => (
              <div key={c} className="flex items-center gap-2">
                <span className="text-xs w-20 text-[#6E6650] truncate">{c}</span>
                <div className="flex-1 bg-[#F0EAD6] rounded-sm h-3 overflow-hidden">
                  <div style={{ width: `${students.length ? ((classStrength[c] || 0) / Math.max(...Object.values(classStrength), 1)) * 100 : 0}%`, background: "#12312B" }} className="h-full" />
                </div>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs w-6 text-right">{classStrength[c] || 0}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-5 mb-6">
        <FeeForecastCard curMonth={curMonth} forecastForMonth={forecastForMonth} />
        <Card className="p-5">
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold mb-3">Recent Deposits Logged</div>
          {recentDeposits.length === 0 ? (
            <div className="text-sm text-[#9C8F6E]">No deposits recorded yet.</div>
          ) : (
            <div className="space-y-0 max-h-64 overflow-y-auto">
              {recentDeposits.map(d => {
                const st = studentById[d.studentId];
                return (
                  <div key={d.id} className="flex items-center justify-between py-2 text-sm ledger-row px-2 -mx-2" style={{ borderBottom: "1px solid #EEE7D2" }}>
                    <div>
                      <span className="font-medium">{st ? st.name : "Unknown"}</span>
                      <span className="text-[#9C8F6E] ml-2 text-xs">{st ? st.class : "—"} · {fmtDate(d.date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="font-semibold text-[#3F6B52]">{fmtINR(d.amount)}</span>
                      <button onClick={() => onOpenReceipt(d)} className="p-1 text-[#12312B] hover:bg-[#E4DCC5] rounded" title="View / Print Receipt">
                        <Printer size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ===== OUTSTANDING DUES (NEW) ===== */}
      <DashSectionLabel>Outstanding Dues</DashSectionLabel>
      <Card className="p-5 mb-2">
        <div className="flex items-center justify-between mb-3">
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold">Top Outstanding Dues</div>
          <span className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono">Highest balance first</span>
        </div>
        {topDues.length === 0 ? (
          <div className="text-sm text-[#9C8F6E]">No outstanding dues — everyone is fully paid up. 🎉</div>
        ) : (
          <div className="space-y-0">
            {topDues.map(({ student: st, balance }) => (
              <div key={st.id} className="flex items-center justify-between py-2 text-sm ledger-row px-2 -mx-2" style={{ borderBottom: "1px solid #EEE7D2" }}>
                <div>
                  <span className="font-medium">{st.name}</span>
                  <span className="text-[#9C8F6E] ml-2 text-xs font-mono">{st.studentId || "—"} · {st.class}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="font-semibold text-[#A63D2F]">{fmtINR(balance)}</span>
                  {onStatement && (
                    <button onClick={() => onStatement(st)} className="p-1 text-[#12312B] hover:bg-[#E4DCC5] rounded" title="Open Student Statement">
                      <FileText size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function LifecycleActions({ s, onExit, onPromote, onBatchChange, onViewHistory, onUndo, onStatement, onAddCharge, onJoiningForm, compact }) {
  const status = s.status || "active";
  return (
    <>
      {status === "active" ? (
        <button onClick={() => onExit(s)} className={compact ? "text-xs text-[#26231D] font-semibold underline" : "px-2 py-1 bg-[#26231D] text-[#FAF6EC] rounded text-[11px] font-medium hover:bg-black inline-flex items-center gap-1"}>
          {compact ? "End / Pause" : (<><Award size={11} /> End / Pause</>)}
        </button>
      ) : (
        <button onClick={() => onPromote(s)} className={compact ? "text-xs text-[#3F6B52] font-semibold underline" : "px-2 py-1 bg-[#3F6B52] text-white rounded text-[11px] font-medium hover:bg-[#2E5240] inline-flex items-center gap-1"}>
          {compact ? (status === "dropped" ? "Reactivate" : "Promote") : (<><ArrowUpRight size={11} /> {status === "dropped" ? "Reactivate" : "Promote / Resume"}</>)}
        </button>
      )}
      {s.lastSnapshot && (
        <button onClick={() => onUndo(s)} className="text-xs text-[#B8862B] font-semibold underline inline-flex items-center gap-0.5" title="Undo the last status change">
          <Undo2 size={11} /> Undo
        </button>
      )}
      <button onClick={() => onBatchChange(s)} className="text-[#12312B] underline inline-flex items-center gap-0.5 text-xs"><Tag size={11} /> Batches</button>
      <button onClick={() => onAddCharge(s)} className="text-[#12312B] underline inline-flex items-center gap-0.5 text-xs"><Plus size={11} /> Charge</button>
      <button onClick={() => onStatement(s)} className="text-[#12312B] underline inline-flex items-center gap-0.5 text-xs"><Receipt size={11} /> Statement</button>
      {onJoiningForm && <button onClick={() => onJoiningForm(s)} className="text-[#12312B] underline inline-flex items-center gap-0.5 text-xs"><FileText size={11} /> Joining Form</button>}
      <button onClick={() => onViewHistory(s)} className="text-[#12312B] underline inline-flex items-center gap-0.5 text-xs"><History size={11} /> Log</button>
    </>
  );
}

function StudentsTab({ students, studentDues, studentDuesRaw, classes, streams, batchesForMonth, curMonth, onAdd, onEdit, onExit, onPromote, onViewHistory, onBatchChange, onUndo, onStatement, onAddCharge, onJoiningForm, onRemove }) {
  const [search, setSearch] = useState("");
  const [streamFilter, setStreamFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [expanded, setExpanded] = useState({});

  const streamList = streams || STREAMS;
  const streamsInUse = useMemo(() => {
    const set = new Set();
    students.forEach(s => { if (s.stream) set.add(s.stream); });
    return streamList.filter(s => set.has(s));
  }, [students, streamList]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter(s => {
      if (streamFilter !== "all" && (s.stream || "") !== streamFilter) return false;
      if (classFilter !== "all" && String(s.class) !== classFilter) return false;
      if (statusFilter !== "all" && (s.status || "active") !== statusFilter) return false;
      if (genderFilter !== "all" && (s.gender || "") !== genderFilter) return false;
      if (!q) return true;
      const haystack = [s.name, s.studentId, s.fatherName, s.phone, s.guardianPhone, s.address, s.aadharNumber, ...(s.batches || [])].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [students, search, streamFilter, classFilter, statusFilter, genderFilter]);

  const isFiltered = search || streamFilter !== "all" || classFilter !== "all" || statusFilter !== "all" || genderFilter !== "all";

  return (
    <div>
      <SectionHeader eyebrow="Register" title="Students Directory" action={
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Add student
        </button>
      } />

      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Search</div>
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" style={{ marginTop: "9px" }} />
            <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, Student ID, subject, father's name, phone, guardian phone, Aadhar, or address…" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Class</div>
            <select className={inputCls} style={inputStyle} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
              <option value="all">All Classes</option>
              {(classes || []).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Stream</div>
            <select className={inputCls} style={inputStyle} value={streamFilter} onChange={e => setStreamFilter(e.target.value)}>
              <option value="all">All Streams</option>
              {streamsInUse.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Student Status</div>
            <select className={inputCls} style={inputStyle} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="on_break">On Break / Gap</option>
              <option value="dropped">Dropped Out</option>
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Gender</div>
            <select className={inputCls} style={inputStyle} value={genderFilter} onChange={e => setGenderFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          {isFiltered && (
            <button onClick={() => { setSearch(""); setStreamFilter("all"); setClassFilter("all"); setStatusFilter("all"); setGenderFilter("all"); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
        <div className="text-[10px] text-[#9C8F6E] mt-2.5 font-mono">{filtered.length} of {students.length} student{students.length === 1 ? "" : "s"} shown</div>
      </Card>

      <Card>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">{students.length === 0 ? "No students registered yet." : "No students match this search."}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["#", "", "Name", "Class", "Subjects (this month)", "Total Due", "Status", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, idx) => {
                const dueAmount = studentDues[s.id] || 0;
                // Total Due shown here uses the signed (unclamped) balance,
                // so a student who has deposited extra / paid in advance
                // shows their Total Due as a negative amount instead of ₹0.
                const displayDue = studentDuesRaw ? (studentDuesRaw[s.id] || 0) : dueAmount;
                const status = s.status || "active";
                const badgeText = status === "active" ? "Active" : status === "dropped" ? "Dropped Out" : (s.resultStatus || "On Break");
                const badgeTone = status === "active" ? "paid" : status === "dropped" ? "overdue" : "break";
                const isOpen = !!expanded[s.id];
                const hasDetails = s.fatherName || s.guardianPhone || s.address || s.dob || s.currentSchool || s.aadharNumber || s.stream || s.gender || s.studentId || s.joiningDate;
                return (
                  <React.Fragment key={s.id}>
                    <tr className="ledger-row">
                      <td className="pl-4 py-2.5 text-xs text-[#9C8F6E] font-mono">{idx + 1}</td>
                      <td className="pl-1 py-2.5">
                        {hasDetails && (
                          <button onClick={() => setExpanded(prev => ({ ...prev, [s.id]: !prev[s.id] }))} className="text-[#9C8F6E] hover:text-[#12312B] text-xs w-4">
                            {isOpen ? "▾" : "▸"}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-medium">
                        <div>{s.name}</div>
                        <div className="text-[10px] text-[#9C8F6E] flex gap-1.5">
                          {s.studentId && <span className="font-mono">{s.studentId}</span>}
                          {s.phone && <span>{s.studentId ? "· " : ""}{s.phone}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-[#12312B]">
                        {s.class}
                        {s.stream && <div className="text-[10px] font-normal text-[#9C8F6E]">{s.stream}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#6E6650]">{batchesForMonth(s, curMonth).join(", ") || "—"}</td>
                      <td className="px-4 py-2.5 text-xs font-semibold" style={{ fontFamily: "'IBM Plex Mono', monospace", color: displayDue > 0 ? "#A63D2F" : displayDue < 0 ? "#3F6B52" : "#3F6B52" }}>{fmtINR(displayDue)}{displayDue < 0 && <span className="ml-1 text-[9px] font-normal text-[#9C8F6E]">(advance)</span>}</td>
                      <td className="px-4 py-2.5 text-xs"><Stamp text={badgeText} tone={badgeTone} /></td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex flex-wrap gap-2 justify-end">
                          <LifecycleActions s={s} onExit={onExit} onPromote={onPromote} onBatchChange={onBatchChange} onViewHistory={onViewHistory} onUndo={onUndo} onStatement={onStatement} onAddCharge={onAddCharge} onJoiningForm={onJoiningForm} compact />
                          <button onClick={() => onEdit(s)} className="text-xs text-[#12312B] underline">Edit</button>
                          <button onClick={() => onRemove(s.id)} className="text-xs text-[#A63D2F] underline">Remove</button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && hasDetails && (
                      <tr>
                        <td></td>
                        <td></td>
                        <td colSpan={6} className="px-4 pb-3 pt-0">
                          <div className="grid grid-cols-3 gap-3 p-3 rounded bg-[#FAF6EC] border text-xs" style={{ borderColor: "#D8CFB8" }}>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Student ID</span>{s.studentId || "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Gender</span>{s.gender || "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Father's Name</span>{s.fatherName || "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Guardian Phone</span>{s.guardianPhone || "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Address</span>{s.address || "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Date of Birth</span>{s.dob ? fmtDate(s.dob) : "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Joining Date</span>{s.joiningDate ? fmtDate(s.joiningDate) : "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Current School / Institution</span>{s.currentSchool || "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Aadhar Number</span>{s.aadharNumber || "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Stream</span>{s.stream || "—"}</div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ============================================================================
// FEE & CLASS STRUCTURE — the consolidated academic-setup tab. Merges what
// used to be a separate "Manage Classes & Subjects" modal (reached from the
// old Class & Dues Hub) directly into the Fee Matrix, as two clean sub-tabs:
// the Class & Subject List on one side, Fee Matrix pricing (1–6 subjects)
// on the other.
// ============================================================================
function StructureTab({ feeStructure, setFeeStructure, classes, subjectsList, onSaveClasses, onSaveSubjects, streams, onSaveStreams }) {
  const [subTab, setSubTab] = useState("fees");

  function update(cls, count, val) {
    const updated = { ...feeStructure, [cls]: { ...feeStructure[cls], [count]: Number(val) || 0 } };
    setFeeStructure(updated);
  }

  return (
    <div>
      <SectionHeader eyebrow="Academic Setup" title="Fee & Class Structure" />
      {/* All three controls live in one aligned pill row as real tabs —
          "Manage Streams" used to open as a separate modal from here; it's
          now a third sub-tab with its own inline panel, exactly like
          "Fee Matrix Pricing" and "Class & Subject List" (see
          StreamManagerPanel below). */}
      <div className="flex border rounded-sm overflow-hidden mb-5 w-fit" style={{ borderColor: "#12312B" }}>
        <button onClick={() => setSubTab("fees")} className="px-4 py-2 text-xs font-semibold" style={{ background: subTab === "fees" ? "#12312B" : "white", color: subTab === "fees" ? "#F4EFDE" : "#12312B" }}>
          Fee Matrix Pricing
        </button>
        <button onClick={() => setSubTab("classes")} className="px-4 py-2 text-xs font-semibold" style={{ background: subTab === "classes" ? "#12312B" : "white", color: subTab === "classes" ? "#F4EFDE" : "#12312B", borderLeft: "1px solid #12312B" }}>
          Class & Subject List
        </button>
        <button onClick={() => setSubTab("streams")} className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5" style={{ background: subTab === "streams" ? "#12312B" : "white", color: subTab === "streams" ? "#F4EFDE" : "#12312B", borderLeft: "1px solid #12312B" }}>
          <Tag size={13} /> Manage Streams
        </button>
      </div>

      {subTab === "fees" ? (
        <div>
          <div className="text-sm text-[#6E6650] mb-4">Configure monthly fees based on class and total subjects taken (up to 6 subjects).</div>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                  <th style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">Class Name</th>
                  {[1, 2, 3, 4, 5, 6].map(num => (
                    <th key={num} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-3 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{num} Subj Fee</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classes.map(c => (
                  <tr key={c} className="ledger-row">
                    <td className="px-4 py-2.5 font-semibold text-[#12312B]">{c}</td>
                    {[1, 2, 3, 4, 5, 6].map(count => (
                      <td key={count} className="px-2 py-2">
                        <div className="flex items-center gap-0.5">
                          <span className="text-[#9C8F6E] text-xs">₹</span>
                          <input type="number" value={feeStructure[c] ? feeStructure[c][count] || 0 : 0} onChange={(e) => update(c, count, e.target.value)}
                            style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="w-20 border rounded-sm px-1.5 py-1 text-xs bg-white" />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      ) : subTab === "classes" ? (
        <ClassSubjectManager classes={classes} subjectsList={subjectsList} onSaveClasses={onSaveClasses} onSaveSubjects={onSaveSubjects} />
      ) : (
        <StreamManagerPanel streams={streams} onSave={onSaveStreams} />
      )}
    </div>
  );
}

// Inline (non-modal) Class & Subject manager — folded into the Fee & Class
// Structure tab. Same add/remove behavior the old standalone "Manage
// Classes & Subjects" modal had, just embedded as a sub-tab instead.
function ClassSubjectManager({ classes, subjectsList, onSaveClasses, onSaveSubjects }) {
  const [classList, setClassList] = useState([...classes]);
  const [subjList, setSubjList] = useState([...subjectsList]);
  const [newClassName, setNewClassName] = useState("");
  const [newSubjName, setNewSubjName] = useState("");
  const [saved, setSaved] = useState(false);

  const addClass = () => { if (newClassName.trim() && !classList.includes(newClassName.trim())) { setClassList([...classList, newClassName.trim()]); setNewClassName(""); } };
  const addSubject = () => { if (newSubjName.trim() && !subjList.includes(newSubjName.trim())) { setSubjList([...subjList, newSubjName.trim()]); setNewSubjName(""); } };
  const handleSave = () => {
    onSaveClasses(classList); onSaveSubjects(subjList);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="grid grid-cols-2 gap-5">
      <Card className="p-5">
        <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold mb-3">Class List</div>
        <div className="text-[11px] text-[#6E6650] mb-2 -mt-1">Whatever you type here is stored and shown exactly as-is, everywhere in the system — no automatic "Class" prefix is added. Type <strong>12</strong> to keep it as 12, <strong>JEE</strong> to keep it as JEE, or <strong>Class 12</strong> yourself if that's what you want displayed.</div>
        <Field label="Add Custom Class (typed exactly as you want it stored)">
          <div className="flex gap-2">
            <input className={inputCls} style={inputStyle} value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="e.g. 12, JEE, Class 12, NEET-A" />
            <button onClick={addClass} className="px-3 py-2 bg-[#12312B] text-white text-xs rounded font-semibold whitespace-nowrap">Add Class</button>
          </div>
        </Field>
        <div className="mt-2 flex flex-wrap gap-1.5 max-h-56 overflow-y-auto p-2 border bg-white rounded" style={{ borderColor: "#D8CFB8" }}>
          {classList.map(c => (
            <span key={c} className="px-2 py-0.5 text-xs bg-[#FAF6EC] border rounded font-medium flex items-center gap-1" style={{ borderColor: "#D8CFB8" }}>
              {c}
              <button onClick={() => setClassList(classList.filter(x => x !== c))} className="text-[#A63D2F]"><X size={10} /></button>
            </span>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold mb-3">Master Subject List</div>
        <Field label="Add Master Subject (e.g., Hindi, Computer, Biology)">
          <div className="flex gap-2">
            <input className={inputCls} style={inputStyle} value={newSubjName} onChange={e => setNewSubjName(e.target.value)} placeholder="Subject name" />
            <button onClick={addSubject} className="px-3 py-2 bg-[#12312B] text-white text-xs rounded font-semibold whitespace-nowrap">Add Subject</button>
          </div>
        </Field>
        <div className="mt-2 flex flex-wrap gap-1.5 max-h-56 overflow-y-auto p-2 border bg-white rounded" style={{ borderColor: "#D8CFB8" }}>
          {subjList.map(s => (
            <span key={s} className="px-2 py-0.5 text-xs bg-[#FAF6EC] border rounded font-medium flex items-center gap-1" style={{ borderColor: "#D8CFB8" }}>
              {s}
              <button onClick={() => setSubjList(subjList.filter(x => x !== s))} className="text-[#A63D2F]"><X size={10} /></button>
            </span>
          ))}
        </div>
      </Card>

      <div className="col-span-2">
        <button onClick={handleSave} className="w-full py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
          {saved ? "Saved ✓" : "Save Class & Subject Changes"}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// STREAM MANAGER — an inline panel, folded into the Fee & Class Structure
// tab as its own "Manage Streams" sub-tab (previously a separate modal
// launched from a floating button). Same add/remove/save behavior as
// before, just embedded like the other two sub-tabs instead of overlaying
// the screen. Saves to the same settings/streamList doc the app loads on
// startup, so whatever is added or removed here immediately shows up in
// the Stream dropdown on the Add / Edit Student form — no separate step
// needed anywhere else.
// ============================================================================
function StreamManagerPanel({ streams, onSave }) {
  const [streamList, setStreamList] = useState([...(streams || STREAMS)]);
  const [newStreamName, setNewStreamName] = useState("");
  const [saved, setSaved] = useState(false);

  const addStream = () => {
    const name = newStreamName.trim();
    if (name && !streamList.includes(name)) { setStreamList([...streamList, name]); setNewStreamName(""); }
  };
  const removeStream = (s) => setStreamList(streamList.filter(x => x !== s));
  const handleSave = () => {
    onSave(streamList);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <Card className="p-5 max-w-xl">
      <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold mb-3">Manage Streams</div>
      <div className="text-xs text-[#6E6650] mb-3">
        Add or delete Stream / academic-track options here. These are exactly what shows up in the <strong>Stream</strong> dropdown on the Add / Edit Student form — nothing else needs to change.
      </div>
      <Field label="Add New Stream">
        <div className="flex gap-2">
          <input
            className={inputCls} style={inputStyle} value={newStreamName}
            onChange={e => setNewStreamName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addStream(); } }}
            placeholder="e.g. PCMB, Vocational, Diploma"
          />
          <button onClick={addStream} className="px-3 py-2 bg-[#12312B] text-white text-xs rounded font-semibold whitespace-nowrap">Add Stream</button>
        </div>
      </Field>
      <div className="mt-1 flex flex-wrap gap-1.5 max-h-64 overflow-y-auto p-2 border bg-white rounded" style={{ borderColor: "#D8CFB8" }}>
        {streamList.length === 0 ? (
          <div className="text-xs text-[#9C8F6E] p-2">No streams yet — add one above.</div>
        ) : streamList.map(s => (
          <span key={s} className="px-2 py-0.5 text-xs bg-[#FAF6EC] border rounded font-medium flex items-center gap-1" style={{ borderColor: "#D8CFB8" }}>
            {s}
            <button onClick={() => removeStream(s)} className="text-[#A63D2F]" title="Delete stream"><X size={10} /></button>
          </span>
        ))}
      </div>
      <button onClick={handleSave} className="w-full mt-4 py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
        {saved ? "Saved ✓" : "Save Stream Changes"}
      </button>
    </Card>
  );
}

function DepositsTab({ deposits, students, classes, studentDues, onAdd, onRemove, onOpenReceipt }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [receiptSearch, setReceiptSearch] = useState("");

  const byId = Object.fromEntries(students.map(s => [s.id, s]));

  const sorted = [...deposits].sort((a, b) => compareChrono(a, b, -1));
  const filtered = sorted.filter(d => {
    const st = byId[d.studentId];
    const q = search.trim().toLowerCase();
    if (q && !(st && st.name.toLowerCase().includes(q))) return false;
    if (classFilter !== "all" && !(st && String(st.class) === classFilter)) return false;
    if (modeFilter !== "all" && d.mode !== modeFilter) return false;
    if (fromDate && d.date < fromDate) return false;
    if (toDate && d.date > toDate) return false;
    if (receiptSearch.trim() && !getReceiptNo(d.id).toLowerCase().includes(receiptSearch.trim().toLowerCase())) return false;
    return true;
  });
  const isFiltered = search || classFilter !== "all" || modeFilter !== "all" || fromDate || toDate || receiptSearch;

  return (
    <div>
      <SectionHeader eyebrow="Fee Deposits" title="Deposits Log" action={
        <button onClick={onAdd} disabled={students.length === 0} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Record deposit
        </button>
      } />

      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[150px]">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Student Name</div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" />
              <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Type a name…" />
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Class</div>
            <select className={inputCls} style={inputStyle} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
              <option value="all">All Classes</option>
              {(classes || []).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Mode</div>
            <select className={inputCls} style={inputStyle} value={modeFilter} onChange={e => setModeFilter(e.target.value)}>
              <option value="all">All Modes</option>
              {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">From</div>
            <input type="date" className={inputCls} style={inputStyle} value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">To</div>
            <input type="date" className={inputCls} style={inputStyle} value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <div className="min-w-[130px]">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Receipt No.</div>
            <input className={inputCls} style={inputStyle} value={receiptSearch} onChange={e => setReceiptSearch(e.target.value)} placeholder="e.g. A1B2C3" />
          </div>
          {isFiltered && (
            <button onClick={() => { setSearch(""); setClassFilter("all"); setModeFilter("all"); setFromDate(""); setToDate(""); setReceiptSearch(""); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
      </Card>

      <Card>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">{sorted.length === 0 ? "No fee deposits recorded yet." : "No deposits match these filters."}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Receipt No", "Date", "Student", "Class", "Amount Paid", "Write-off", "Mode", "Reference", "Remarks", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const st = byId[d.studentId];
                const ref = d.utr || d.chequeNumber || "—";
                return (
                  <tr key={d.id} className="ledger-row">
                    <td className="px-4 py-2.5 text-[10px] font-mono text-[#9C8F6E]">#{getReceiptNo(d.id)}</td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(d.date)}</td>
                    <td className="px-4 py-2.5 font-medium">{st ? st.name : "—"}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#12312B]">{st ? st.class : "—"}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#3F6B52]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(d.amount)}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace", color: d.writeOffAmount > 0 ? "#B8862B" : "#9C8F6E" }}>{d.writeOffAmount > 0 ? fmtINR(d.writeOffAmount) : "—"}</td>
                    <td className="px-4 py-2.5 text-xs">{d.mode}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6E6650]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{ref}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6E6650]">{d.remarks || "—"}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onOpenReceipt(d)} className="flex items-center gap-1 text-xs text-[#12312B] underline mr-3 inline-flex"><Printer size={12} /> Receipt</button>
                      <button onClick={() => sendWhatsAppReceipt(d, st, studentDues[st?.id] || 0)} className="text-xs text-[#25D366] font-semibold underline mr-3 inline-flex items-center gap-1"><Send size={11} /> WhatsApp</button>
                      <button onClick={() => onRemove(d.id)} className="text-xs text-[#A63D2F] underline">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ============================================================================
// CHARGES — the consolidated master view of every charge raised against a
// student: Opening Balance carry-forwards, monthly Tuition Fee accruals, AND
// ad-hoc Additional Charges, all in one ledger-style feed. "Add Charge"
// still only creates ad-hoc Additional Charges (tuition accrues on its own
// via the fee matrix); this tab is where you come to see and track all of it.
// ============================================================================
const CHARGE_TYPE_META = {
  opening: { label: "Opening Balance", tone: "carried" },
  monthly_fee: { label: "Tuition Fee", tone: "due" },
  extra_charge: { label: "Additional Charge", tone: "due" },
};

function ChargesTab({ chargeLines, students, classes, onAdd, onRemove, onOpenReceipt }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("");

  const sorted = [...chargeLines].sort((a, b) => compareChrono(a, b, -1));
  const filtered = sorted.filter(c => {
    const q = search.trim().toLowerCase();
    if (q && !c.studentName.toLowerCase().includes(q)) return false;
    if (classFilter !== "all" && String(c.studentClass) !== classFilter) return false;
    if (typeFilter !== "all" && c.type !== typeFilter) return false;
    if (monthFilter && c.month !== monthFilter) return false;
    return true;
  });
  const isFiltered = search || classFilter !== "all" || typeFilter !== "all" || monthFilter;
  const filteredTotal = round2(filtered.reduce((a, c) => a + Number(c.amount || 0), 0));

  return (
    <div>
      <SectionHeader eyebrow="Master Charges Ledger" title="Charges" action={
        <button onClick={onAdd} disabled={students.length === 0} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Add Charge
        </button>
      } />
      <div className="text-sm text-[#6E6650] mb-4">Every charge raised against a student — Opening Balances, monthly Tuition Fee accruals, and ad-hoc Additional Charges (exam fee, material cost, late fee, etc.) — tracked together in one master ledger. Use "Add Charge" for anything outside regular tuition.</div>

      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[150px]">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Student Name</div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" />
              <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Type a name…" />
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Class</div>
            <select className={inputCls} style={inputStyle} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
              <option value="all">All Classes</option>
              {(classes || []).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Charge Type</div>
            <select className={inputCls} style={inputStyle} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="all">All Types</option>
              {Object.entries(CHARGE_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Month</div>
            <input type="month" className={inputCls} style={inputStyle} value={monthFilter} onChange={e => setMonthFilter(e.target.value)} />
          </div>
          {isFiltered && (
            <button onClick={() => { setSearch(""); setClassFilter("all"); setTypeFilter("all"); setMonthFilter(""); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
      </Card>

      {isFiltered && (
        <div className="text-xs text-[#6E6650] mb-3">Showing {filtered.length} of {sorted.length} charges · Total: <strong className="text-[#B8862B]">{fmtINR(filteredTotal)}</strong></div>
      )}

      <Card>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">{sorted.length === 0 ? "No charges logged yet." : "No charges match these filters."}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Charge ID", "Date", "Student", "Class", "Type", "Description", "For Month", "Amount", "Paid", "Outstanding", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const meta = CHARGE_TYPE_META[c.type] || { label: c.type, tone: "due" };
                const isAdhoc = c.type === "extra_charge";
                return (
                  <tr key={c.id + "-" + i} className="ledger-row">
                    <td className="px-4 py-2.5 text-[10px] font-mono">
                      <button onClick={() => onOpenReceipt(c)} className="text-[#12312B] underline hover:text-[#3F6B52]" title="Open printable receipt">{c.chargeId}</button>
                    </td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(c.date)}</td>
                    <td className="px-4 py-2.5 font-medium">{c.studentName}{c.studentStatus !== "active" && <span className="ml-1.5 text-[10px] text-[#4A7B9D]">({c.studentStatus === "dropped" ? "dropped" : "on break"})</span>}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#12312B]">{c.studentClass}</td>
                    <td className="px-4 py-2.5"><Stamp text={meta.label} tone={meta.tone} /></td>
                    <td className="px-4 py-2.5 text-xs">{c.label}{c.remarks ? <div className="text-[10px] text-[#9C8F6E]">{c.remarks}</div> : null}</td>
                    <td className="px-4 py-2.5 text-xs">{monthLabel(c.month)}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#B8862B]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(c.amount)}</td>
                    <td className="px-4 py-2.5 text-xs text-[#3F6B52]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(c.paid)}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold" style={{ fontFamily: "'IBM Plex Mono', monospace", color: c.outstanding > 0 ? "#A63D2F" : "#3F6B52" }}>{fmtINR(c.outstanding)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onOpenReceipt(c)} className="flex items-center gap-1 text-xs text-[#12312B] underline mr-3 inline-flex"><Printer size={12} /> Receipt</button>
                      {isAdhoc ? (
                        <button onClick={() => onRemove(c.id)} className="text-xs text-[#A63D2F] underline">Delete</button>
                      ) : (
                        <span className="text-xs text-[#D8CFB8]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ============================================================================
// EXPENSES — a dedicated log of money going OUT of the center (rent, salary,
// materials, etc). Each expense gets a unique EXP-XXXXXX id and a printable
// receipt, mirroring how deposits and charges work. Feeds the Cash/Online
// balance tiles on the Dashboard and the master Center Statement.
// ============================================================================
function ExpensesTab({ expenses, onAdd, onRemove, onOpenReceipt }) {
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("");

  const sorted = [...expenses].sort((a, b) => compareChrono(a, b, -1));
  const filtered = sorted.filter(e => {
    const q = search.trim().toLowerCase();
    if (q) {
      const haystack = [e.category, e.expenseId, e.paidTo, e.remarks].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (modeFilter !== "all" && (e.mode || "Cash") !== modeFilter) return false;
    if (monthFilter && (e.date || "").slice(0, 7) !== monthFilter) return false;
    return true;
  });
  const isFiltered = search || modeFilter !== "all" || monthFilter;
  const totalFiltered = round2(filtered.reduce((a, e) => a + Number(e.amount || 0), 0));

  return (
    <div>
      <SectionHeader eyebrow="Money Out" title="Expenses Log" action={
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Add Expense
        </button>
      } />
      <div className="text-sm text-[#6E6650] mb-4">Every expense the center pays out — rent, salaries, materials, maintenance, anything — logged here with its own Expense ID and a printable receipt. Feeds directly into the Cash / Online balance tiles on the Dashboard.</div>

      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Search</div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" />
              <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Category, Expense ID, or remarks…" />
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Payment Mode</div>
            <select className={inputCls} style={inputStyle} value={modeFilter} onChange={e => setModeFilter(e.target.value)}>
              <option value="all">All Modes</option>
              {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Month</div>
            <input type="month" className={inputCls} style={inputStyle} value={monthFilter} onChange={e => setMonthFilter(e.target.value)} />
          </div>
          {isFiltered && (
            <button onClick={() => { setSearch(""); setModeFilter("all"); setMonthFilter(""); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
      </Card>

      {isFiltered && (
        <div className="text-xs text-[#6E6650] mb-3">Showing {filtered.length} of {expenses.length} expenses · Total: <strong className="text-[#A63D2F]">{fmtINR(totalFiltered)}</strong></div>
      )}

      <Card>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">{sorted.length === 0 ? "No expenses logged yet." : "No expenses match these filters."}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Expense ID", "Date", "Category", "Paid To", "Amount", "Mode", "Reference / UTR", "Remarks", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} className="ledger-row">
                  <td className="px-4 py-2.5 text-[10px] font-mono">
                    <button onClick={() => onOpenReceipt(e)} className="text-[#12312B] underline hover:text-[#3F6B52]" title="Open printable receipt">{e.expenseId || `EXP-${shortId(e.id)}`}</button>
                  </td>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(e.date)}</td>
                  <td className="px-4 py-2.5 font-medium">{e.category || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-[#6E6650]">{e.paidTo || "—"}</td>
                  <td className="px-4 py-2.5 font-semibold text-[#A63D2F]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(e.amount)}</td>
                  <td className="px-4 py-2.5 text-xs">{e.mode || "Cash"}</td>
                  <td className="px-4 py-2.5 text-xs text-[#6E6650]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{e.refNumber || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-[#6E6650]">{e.remarks || "—"}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => onOpenReceipt(e)} className="flex items-center gap-1 text-xs text-[#12312B] underline mr-3 inline-flex"><Printer size={12} /> Receipt</button>
                    <button onClick={() => onRemove(e.id)} className="text-xs text-[#A63D2F] underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ============================================================================
// NOTES — a simple internal notepad for the office/staff. Completely
// separate from the financial ledger: nothing here touches students,
// deposits, charges, or balances. Just a place to jot things down (a
// reminder to call a parent back, a to-do for the front desk, a note
// about next month's schedule) that everyone using this cloud-synced
// portal can see. Notes can be pinned so important ones stay at the top,
// edited in place, and deleted permanently (no Trash step — notes are
// deliberately lightweight, unlike financial records).
// ============================================================================
function NotesTab({ notes, onAdd, onEdit, onTogglePin, onDelete }) {
  const [search, setSearch] = useState("");

  const filtered = notes.filter(n => {
    if (!search) return true;
    const q = search.trim().toLowerCase();
    return [n.title, n.body].filter(Boolean).join(" ").toLowerCase().includes(q);
  });

  return (
    <div>
      <SectionHeader eyebrow="Office Notepad" title="Notes" action={
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Add Note
        </button>
      } />
      <div className="text-sm text-[#6E6650] mb-4">A shared notepad for anything worth writing down — reminders, follow-ups, things to tell the next shift. Nothing here affects fees, dues, or balances. Pin a note to keep it at the top.</div>

      {notes.length > 0 && (
        <Card className="p-3.5 mb-4">
          <div className="relative max-w-sm">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" />
            <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes…" />
          </div>
        </Card>
      )}

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[#9C8F6E]">
          {notes.length === 0 ? "No notes yet — add one to keep track of anything worth remembering." : "No notes match this search."}
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-3.5">
          {filtered.map(n => (
            <Card key={n.id} className="p-4 flex flex-col" style={{ borderTop: n.pinned ? "3px solid #B8862B" : undefined }}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-base font-semibold text-[#1B1810] leading-snug break-words">{n.title || "Untitled Note"}</div>
                <button onClick={() => onTogglePin(n.id)} title={n.pinned ? "Unpin" : "Pin to top"}
                  className="shrink-0 text-xs mt-0.5" style={{ color: n.pinned ? "#B8862B" : "#D8CFB8" }}>
                  <Tag size={14} style={{ transform: n.pinned ? "none" : "rotate(45deg)" }} />
                </button>
              </div>
              <div className="text-xs text-[#4A4636] whitespace-pre-wrap break-words flex-1 mb-3">{n.body || "—"}</div>
              <div className="flex items-center justify-between pt-2.5" style={{ borderTop: "1px solid #E4DCC5" }}>
                <span className="text-[10px] text-[#9C8F6E] font-mono">{fmtDate(n.updatedAt || n.createdAt || todayStr())}</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => onEdit(n)} className="text-[10px] text-[#12312B] underline font-semibold">Edit</button>
                  <button onClick={() => onDelete(n.id)} className="text-[10px] text-[#A63D2F] underline">Delete</button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


// Previously this tab showed two overlapping views (a card grid AND a
// separate per-charge-line table) which duplicated the same information in
// two different shapes. This is now consolidated into one clean, sortable,
// filterable list: one row per student, with Name, Class, Total Paid,
// Outstanding, a Statement link, and Status — plus Search (name / mobile /
// Aadhar) and a Class / Status filter.
// ============================================================================
function DuesTab({ students, ledgers, totalOutstanding, classes, onStatement }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState("with_dues"); // with_dues | all

  const summaries = useMemo(() => {
    return students.map(s => {
      const ledger = ledgers[s.id] || { totalCleared: 0, balance: 0 };
      return {
        student: s,
        totalPaid: round2(ledger.totalCleared || 0),
        outstanding: round2(ledger.balance || 0),
        status: s.status || "active",
      };
    });
  }, [students, ledgers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return summaries.filter(row => {
      const s = row.student;
      if (dueFilter === "with_dues" && row.outstanding <= 0) return false;
      if (classFilter !== "all" && String(s.class) !== classFilter) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (q) {
        const haystack = [s.name, s.studentId, s.phone, s.guardianPhone, s.aadharNumber].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => b.outstanding - a.outstanding);
  }, [summaries, search, classFilter, statusFilter, dueFilter]);

  const isFiltered = search || classFilter !== "all" || statusFilter !== "all" || dueFilter !== "with_dues";

  return (
    <div>
      <SectionHeader eyebrow="Outstanding Dues" title="Pending Dues Ledger" />
      <Card className="p-5 mb-5 flex items-center justify-between" style={{ borderLeft: "4px solid #A63D2F" }}>
        <div>
          <div className="text-sm text-[#6E6650]">Total pending balance across every student — active, on break, or dropped</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-3xl font-bold text-[#A63D2F]">{fmtINR(totalOutstanding)}</div>
        </div>
        <Stamp text={totalOutstanding > 0 ? "Outstanding Dues Present" : "all clear"} tone={totalOutstanding > 0 ? "overdue" : "paid"} />
      </Card>

      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Search — Name, Student ID, Mobile, or Aadhar</div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" />
              <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Type a name, Student ID, mobile number, or Aadhar…" />
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Class</div>
            <select className={inputCls} style={inputStyle} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
              <option value="all">All Classes</option>
              {(classes || []).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Student Status</div>
            <select className={inputCls} style={inputStyle} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="on_break">On Break / Gap</option>
              <option value="dropped">Dropped Out</option>
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Show</div>
            <select className={inputCls} style={inputStyle} value={dueFilter} onChange={e => setDueFilter(e.target.value)}>
              <option value="with_dues">With Dues Only</option>
              <option value="all">All Students</option>
            </select>
          </div>
          {isFiltered && (
            <button onClick={() => { setSearch(""); setClassFilter("all"); setStatusFilter("all"); setDueFilter("with_dues"); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
      </Card>

      <Card>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">{summaries.length === 0 ? "No students registered yet." : "No students match these filters."}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Student", "Class", "Total Paid", "Outstanding", "Status", "Statement"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const s = row.student;
                const badgeText = row.status === "active" ? "Active" : row.status === "dropped" ? "Dropped Out" : (s.resultStatus || "On Break");
                const badgeTone = row.status === "active" ? "paid" : row.status === "dropped" ? "overdue" : "break";
                return (
                  <tr key={s.id} className="ledger-row">
                    <td className="px-4 py-2.5 font-medium">
                      <div>{s.name}</div>
                      {(s.studentId || s.phone || s.aadharNumber) && (
                        <div className="text-[10px] text-[#9C8F6E]">{[s.studentId, s.phone, s.aadharNumber].filter(Boolean).join(" · ")}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-[#12312B]">{s.class}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-[#3F6B52]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(row.totalPaid)}</td>
                    <td className="px-4 py-2.5 text-xs font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace", color: row.outstanding > 0 ? "#A63D2F" : "#3F6B52" }}>{fmtINR(row.outstanding)}</td>
                    <td className="px-4 py-2.5"><Stamp text={badgeText} tone={badgeTone} /></td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => onStatement(s)} className="flex items-center gap-1 text-xs text-[#12312B] underline hover:text-[#3F6B52]"><FileText size={12} /> View Statement</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// Type metadata for the center-wide statement — one place that maps a
// ledger line's raw `type` to a display label and a Stamp tone. Expenses
// are intentionally not part of this map — they live only in the Banking
// Statement now (see BANKING_TXN_TYPE_META below), never in the Center
// Statement, since they aren't a student charge or payment.
const TXN_TYPE_META = {
  opening: { label: "Opening Balance", tone: "carried" },
  monthly_fee: { label: "Tuition Fee", tone: "due" },
  extra_charge: { label: "Additional Charge", tone: "due" },
  payment: { label: "Payment Received", tone: "paid" },
  writeoff: { label: "Write-off / Discount", tone: "break" },
};

// Type metadata for the dedicated Banking Statement — student deposits,
// center expenses, and internal Cash ⇄ Bank transfers all in one feed.
const BANKING_TXN_TYPE_META = {
  deposit: { label: "Student Deposit", tone: "paid" },
  expense: { label: "Expense", tone: "overdue" },
  bank_withdrawal: { label: "Bank Withdrawal (→ Cash)", tone: "break" },
  bank_deposit: { label: "Cash Deposit (→ Bank)", tone: "carried" },
  credit_taken: { label: "Credit Taken (Borrowed)", tone: "carried" },
  credit_given: { label: "Credit Given (Lent)", tone: "overdue" },
  interest_payment: { label: "Interest Paid", tone: "break" },
};

// The four Banking sub-tabs — Banking Statement, Cash ⇄ Bank Transfer
// Logs, Credit & Loan Ledger, and Interest Payments Log — rendered as a
// pill-row inside BankingTab, same pattern as StructureTab's sub-tabs.
const BANKING_SUB_TABS = [
  { id: "statement", label: "Banking Statement", icon: FileText },
  { id: "transfers", label: "Cash ⇄ Bank Transfer Logs", icon: ArrowUpRight },
  { id: "credit", label: "Credit & Loan Ledger", icon: CreditCard },
  { id: "interest", label: "Interest Payments Log", icon: Percent },
];

function CenterStatementTab({ transactions, totals, students, classes, onViewReceipt, onViewCharge }) {
  const statementRef = useRef();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Map of internal student doc id → full student record, so each row can
  // show the human-readable Student ID alongside the student's name.
  const studentById = useMemo(() => Object.fromEntries((students || []).map(s => [s.id, s])), [students]);

  const filtered = transactions.filter(t => {
    if (search) {
      const q = search.trim().toLowerCase();
      const st = studentById[t.studentId];
      // Search now matches Name, Student ID, AND mobile number (both the
      // student's own phone and guardian phone), so front-desk staff can
      // look a student up by whichever detail they have on hand.
      const haystack = [t.studentName, st?.studentId, st?.phone, st?.guardianPhone].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (classFilter !== "all" && String(t.studentClass) !== classFilter) return false;
    if (fromDate && t.date < fromDate) return false;
    if (toDate && t.date > toDate) return false;
    return true;
  });

  const filteredTotals = {
    debit: round2(filtered.filter(t => t.kind === "debit").reduce((a, t) => a + t.amount, 0)),
    credit: round2(filtered.filter(t => t.kind === "credit").reduce((a, t) => a + t.amount, 0)),
  };

  const generatedOn = fmtDate(todayStr());
  const isFiltered = search || typeFilter !== "all" || classFilter !== "all" || fromDate || toDate;

  const handlePrint = () => {
    const printContent = statementRef.current.innerHTML;
    const win = window.open("", "", "width=1100,height=900");
    // Loads the same Tailwind utility classes + Google Fonts the live app
    // uses, so the printed page renders exactly like the on-screen preview
    // instead of the plain unstyled text a bare popup window would produce.
    // Landscape A4, since this statement's table has many columns.
    win.document.write(`
      <html>
        <head>
          <title>Center Statement - Coaching Classes</title>
          <script src="https://cdn.tailwindcss.com"><\/script>
          <style>
            ${FONT_IMPORT}
            @page { size: A4 landscape; margin: 12mm; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { font-family: 'Inter', sans-serif; color: #12312B; background: #fff; margin: 0; }
            .stmt-doc { border: 1.5px solid #B8862B; border-radius: 4px; padding: 18px; }
            .stmt-doc::before { content: ""; display: block; height: 3px; background: #12312B; margin: -18px -18px 14px -18px; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
          </style>
        </head>
        <body>
          <div class="stmt-doc">${printContent}</div>
        </body>
      </html>
    `);
    win.document.close(); win.focus(); setTimeout(() => { win.print(); win.close(); }, 300);
  };

  return (
    <div>
      <SectionHeader eyebrow="Center-Wide Ledger" title="Master Transaction Statement" action={
        <button onClick={handlePrint} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Printer size={15} /> Print / Export
        </button>
      } />
      <div className="text-sm text-[#6E6650] mb-4">Every transaction recorded across the entire coaching center — tuition charges, additional charges, payments, and write-offs — for every student, in one place.</div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        <Card className="p-3.5">
          <div className="text-[10px] uppercase text-[#9C8F6E] font-mono">Total Charged</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#1B1810]">{fmtINR(totals.charged)}</div>
        </Card>
        <Card className="p-3.5" style={{ borderLeft: "3px solid #3F6B52" }}>
          <div className="text-[10px] uppercase text-[#3F6B52] font-mono">Total Collected</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#3F6B52]">{fmtINR(totals.collected)}</div>
        </Card>
        <Card className="p-3.5" style={{ borderLeft: "3px solid #B8862B" }}>
          <div className="text-[10px] uppercase text-[#B8862B] font-mono">Total Written Off</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#8A6420]">{fmtINR(totals.writtenOff)}</div>
        </Card>
        <Card className="p-3.5" style={{ borderLeft: "3px solid #A63D2F" }}>
          <div className="text-[10px] uppercase text-[#A63D2F] font-mono">Outstanding</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#A63D2F]">{fmtINR(totals.outstanding)}</div>
        </Card>
      </div>

      <div className="text-xs text-[#9C8F6E] mb-5 flex items-center gap-1.5"><Landmark size={12} /> Expenses and Cash / Bank balances now live in the dedicated <strong className="text-[#12312B]">Banking</strong> tab, since this statement is purely the student tuition & payments ledger.</div>

      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Search Student</div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" />
              <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, Student ID, or Mobile Number…" />
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Type</div>
            <select className={inputCls} style={inputStyle} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="all">All Transactions</option>
              {Object.entries(TXN_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Class</div>
            <select className={inputCls} style={inputStyle} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
              <option value="all">All Classes</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">From</div>
            <input type="date" className={inputCls} style={inputStyle} value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">To</div>
            <input type="date" className={inputCls} style={inputStyle} value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          {isFiltered && (
            <button onClick={() => { setSearch(""); setTypeFilter("all"); setClassFilter("all"); setFromDate(""); setToDate(""); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
      </Card>

      <Card>
        <div ref={statementRef}>
          <div className="stmt-header text-center pb-3 mb-1 px-4 pt-4 border-b-2 border-dashed border-[#12312B]">
            <h2 style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#12312B]">COACHING CLASSES</h2>
            <p className="text-[10px] uppercase tracking-wider text-[#9C8F6E]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Center-Wide Master Statement — Generated {generatedOn}</p>
          </div>
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#9C8F6E]">No transactions match these filters.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                  {["Charge / Receipt No", "Date", "Charges Month", "Student", "Class", "Description", "Remarks", "Type", "Reference / UTR", "Debit", "Credit"].map(h => (
                    <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  const meta = TXN_TYPE_META[t.type] || { label: t.type, tone: "due" };
                  const hasReceipt = t.kind === "credit" && (t.type === "payment" || t.type === "writeoff");
                  const isChargeLine = t.kind === "debit" && (t.type === "opening" || t.type === "monthly_fee" || t.type === "extra_charge") && onViewCharge;
                  const rowKey = t.id + "-" + i;
                  const st = studentById[t.studentId];
                  return (
                    <React.Fragment key={rowKey}>
                      <tr className="ledger-row">
                        <td className="px-4 py-2.5 text-[10px] font-mono">
                          {hasReceipt ? (
                            <button onClick={() => onViewReceipt(t.depositId)} className="underline text-[#12312B] font-semibold inline-flex items-center gap-1 hover:text-[#3F6B52]" title="Open official receipt">
                              <Receipt size={10} /> #{t.receiptNo}
                            </button>
                          ) : isChargeLine ? (
                            <button onClick={() => onViewCharge(t)} className="text-[#12312B] underline hover:text-[#3F6B52]" title="Open printable receipt">{t.chargeId || "—"}</button>
                          ) : (
                            <span className="text-[#9C8F6E]">{t.chargeId || "—"}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(t.date)}</td>
                        <td className="px-4 py-2.5 text-xs font-mono">{t.month ? monthLabel(t.month) : "—"}</td>
                        <td className="px-4 py-2.5 font-medium">
                          <div>{t.studentName}{t.studentStatus !== "active" && <span className="ml-1.5 text-[10px] text-[#4A7B9D]">({t.studentStatus === "dropped" ? "dropped" : "on break"})</span>}</div>
                          {/* Student ID is plain, non-clickable text — no toggle/arrow,
                              no expand panel. Just the ID, as requested. */}
                          {st?.studentId && (
                            <div className="text-[10px] font-mono text-[#9C8F6E]">{st.studentId}</div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-[#12312B]">{t.studentClass}</td>
                        <td className="px-4 py-2.5 text-xs">{t.label}</td>
                        <td className="px-4 py-2.5 text-xs text-[#6E6650]">{t.remarks || "—"}</td>
                        <td className="px-4 py-2.5"><Stamp text={meta.label} tone={meta.tone} /></td>
                        <td className="px-4 py-2.5 text-xs text-[#6E6650]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{t.ref || "—"}</td>
                        <td className="px-4 py-2.5 font-mono text-[#A63D2F]">{t.kind === "debit" ? fmtINR(t.amount) : ""}</td>
                        <td className="px-4 py-2.5 font-mono text-[#3F6B52]">{t.kind === "credit" ? fmtINR(t.amount) : ""}</td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "1.5px solid #26231D" }}>
                  <td colSpan={9} className="px-4 py-2.5 text-right text-xs font-semibold text-[#6E6650]">Filtered Totals:</td>
                  <td className="px-4 py-2.5 font-mono font-bold text-[#A63D2F]">{fmtINR(filteredTotals.debit)}</td>
                  <td className="px-4 py-2.5 font-mono font-bold text-[#3F6B52]">{fmtINR(filteredTotals.credit)}</td>
                </tr>
              </tfoot>
            </table>
          )}
          <div className="footer text-center pt-3 pb-4 mt-2 border-t border-dashed border-[#12312B] text-[10px] text-[#9C8F6E]">
            Computer Generated Statement · Reflects every deposit, tuition charge, additional charge, and write-off recorded center-wide
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// BANKING TAB — dedicated internal Cash / Bank ledger for the coaching
// center. Tracks every rupee that moves in (student deposits), out
// (expenses), or between the center's own Cash-in-hand and Bank/Online
// account (internal transfers) — completely separate from the
// student-facing Center Statement. Every line carries its own unique,
// clickable reference and shows the resulting Cash Balance + Bank Balance
// side by side, so the two balances are always auditable transaction-by-
// transaction.
// ============================================================================
function BankingTab({ feed, totals, bankTxns, creditTxns, interestPayments, interestPaidByCreditId, students, onAdd, onAddCredit, onPayInterest, onViewReceipt, onViewExpense, onViewBankTxn, onViewCredit, onViewInterest, onRemoveBankTxn, onRemoveCredit, onRemoveInterest }) {
  const statementRef = useRef();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expandedCredit, setExpandedCredit] = useState({});
  // Banking is now split into four separate, professionally organized
  // sub-tabs — Banking Statement, Cash ⇄ Bank Transfer Logs, Credit &
  // Loan Ledger, and Interest Payments Log — instead of one long stacked
  // scroll. Every piece of functionality that existed before (search,
  // filters, print/export, add/delete, expand credit history, pay
  // interest, etc.) is unchanged; this state just controls which one of
  // the four panels is visible at a time, exactly like the pill-tab
  // pattern already used in Fee & Class Structure (see StructureTab).
  const [subTab, setSubTab] = useState("statement");

  // Map of internal student doc id → full student record, so deposit rows
  // can show the human-readable Student ID alongside the description.
  const studentById = useMemo(() => Object.fromEntries((students || []).map(s => [s.id, s])), [students]);

  const filtered = feed.filter(t => {
    if (search) {
      const q = search.trim().toLowerCase();
      const st = t.studentId ? studentById[t.studentId] : null;
      const haystack = [t.label, t.refId, t.remarks, st?.studentId, st?.name, st?.phone, st?.guardianPhone].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (fromDate && t.date < fromDate) return false;
    if (toDate && t.date > toDate) return false;
    return true;
  });

  const isFiltered = search || typeFilter !== "all" || fromDate || toDate;
  const generatedOn = fmtDate(todayStr());

  const handlePrint = () => {
    const printContent = statementRef.current.innerHTML;
    const win = window.open("", "", "width=1100,height=900");
    // Loads the same Tailwind utility classes + Google Fonts the live app
    // uses, so the printed page renders exactly like the on-screen preview
    // instead of the plain unstyled text a bare popup window would produce.
    // Landscape A4, since this statement's table has many columns.
    win.document.write(`
      <html>
        <head>
          <title>Banking Statement - Coaching Classes</title>
          <script src="https://cdn.tailwindcss.com"><\/script>
          <style>
            ${FONT_IMPORT}
            @page { size: A4 landscape; margin: 12mm; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { font-family: 'Inter', sans-serif; color: #12312B; background: #fff; margin: 0; }
            .stmt-doc { border: 1.5px solid #B8862B; border-radius: 4px; padding: 18px; }
            .stmt-doc::before { content: ""; display: block; height: 3px; background: #12312B; margin: -18px -18px 14px -18px; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
          </style>
        </head>
        <body>
          <div class="stmt-doc">${printContent}</div>
        </body>
      </html>
    `);
    win.document.close(); win.focus(); setTimeout(() => { win.print(); win.close(); }, 300);
  };

  return (
    <div>
      <SectionHeader eyebrow="Internal Ledger" title="Banking" action={
        <div className="flex gap-2 flex-wrap justify-end">
          <button onClick={handlePrint} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm border" style={{ borderColor: "#12312B", color: "#12312B" }}>
            <Printer size={15} /> Print / Export
          </button>
        </div>
      } />
      <div className="text-sm text-[#6E6650] mb-4">Every student deposit, every center expense, every internal Cash ⇄ Bank transfer, and every Credit / Loan entry, in one auditable feed — with a running Cash Balance and Bank Balance shown on every line. Nothing here appears on the Center Statement.</div>

      {/* Four separate, professionally organized sub-tabs — same pill-row
          pattern as Fee & Class Structure. Only one panel renders at a
          time; nothing below was removed, just regrouped. */}
      <div className="flex border rounded-sm overflow-hidden mb-5 w-fit flex-wrap" style={{ borderColor: "#12312B" }}>
        {BANKING_SUB_TABS.map((st, i) => {
          const Icon = st.icon;
          const active = subTab === st.id;
          return (
            <button key={st.id} onClick={() => setSubTab(st.id)}
              className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
              style={{ background: active ? "#12312B" : "white", color: active ? "#F4EFDE" : "#12312B", borderLeft: i === 0 ? "none" : "1px solid #12312B" }}>
              <Icon size={13} /> {st.label}
            </button>
          );
        })}
      </div>

      {subTab === "statement" && (
      <>
      <div className="grid grid-cols-2 gap-4 mb-5">
        <Card className="p-5" style={{ borderLeft: "4px solid #3F6B52" }}>
          <div className="text-[10px] uppercase text-[#3F6B52] font-mono flex items-center gap-1 mb-1"><Banknote size={13} /> Cash Balance (in hand)</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-3xl font-bold text-[#3F6B52]">{fmtINR(totals.cashBalance)}</div>
        </Card>
        <Card className="p-5" style={{ borderLeft: "4px solid #4A7B9D" }}>
          <div className="text-[10px] uppercase text-[#2B526C] font-mono flex items-center gap-1 mb-1"><Landmark size={13} /> Bank Balance</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-3xl font-bold text-[#2B526C]">{fmtINR(totals.bankBalance)}</div>
        </Card>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-3">
        <Card className="p-3.5">
          <div className="text-[10px] uppercase text-[#9C8F6E] font-mono">Total Deposits Collected</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-bold text-[#3F6B52]">{fmtINR(totals.totalDeposits)}</div>
        </Card>
        <Card className="p-3.5">
          <div className="text-[10px] uppercase text-[#9C8F6E] font-mono">Total Expenses</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-bold text-[#A63D2F]">{fmtINR(totals.totalExpenses)}</div>
        </Card>
        <Card className="p-3.5">
          <div className="text-[10px] uppercase text-[#9C8F6E] font-mono">Withdrawn from Bank</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-bold text-[#8A6420]">{fmtINR(totals.totalWithdrawals)}</div>
        </Card>
        <Card className="p-3.5">
          <div className="text-[10px] uppercase text-[#9C8F6E] font-mono">Deposited to Bank</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-bold text-[#8A6420]">{fmtINR(totals.totalBankDeposits)}</div>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <Card className="p-3.5">
          <div className="text-[10px] uppercase text-[#9C8F6E] font-mono">Total Credit Taken (Borrowed)</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-bold text-[#8A6420]">{fmtINR(totals.totalCreditTaken)}</div>
        </Card>
        <Card className="p-3.5">
          <div className="text-[10px] uppercase text-[#9C8F6E] font-mono">Total Credit Given (Lent)</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-bold text-[#A63D2F]">{fmtINR(totals.totalCreditGiven)}</div>
        </Card>
        <Card className="p-3.5">
          <div className="text-[10px] uppercase text-[#9C8F6E] font-mono">Total Interest Paid</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-bold text-[#A63D2F]">{fmtINR(totals.totalInterestPaid)}</div>
        </Card>
      </div>

      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Search</div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" />
              <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Description, Student ID, Mobile Number, or remarks…" />
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Type</div>
            <select className={inputCls} style={inputStyle} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="all">All Transactions</option>
              {Object.entries(BANKING_TXN_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">From</div>
            <input type="date" className={inputCls} style={inputStyle} value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">To</div>
            <input type="date" className={inputCls} style={inputStyle} value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          {isFiltered && (
            <button onClick={() => { setSearch(""); setTypeFilter("all"); setFromDate(""); setToDate(""); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
      </Card>

      <Card>
        <div ref={statementRef}>
          <div className="stmt-header text-center pb-3 mb-1 px-4 pt-4 border-b-2 border-dashed border-[#12312B]">
            <h2 style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#12312B]">COACHING CLASSES</h2>
            <p className="text-[10px] uppercase tracking-wider text-[#9C8F6E]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Banking Statement — Generated {generatedOn}</p>
          </div>
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#9C8F6E]">No banking transactions match these filters.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                  {["Reference / Txn ID", "Date", "Description", "Student", "Remarks", "Type", "Debit", "Credit", "Cash Balance", "Bank Balance"].map(h => (
                    <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  const meta = BANKING_TXN_TYPE_META[t.type] || { label: t.type, tone: "due" };
                  const debitAmt = t.kind === "debit" ? t.amount : (t.kind === "transfer" && t.type === "bank_deposit" ? t.amount : null);
                  const creditAmt = t.kind === "credit" ? t.amount : (t.kind === "transfer" && t.type === "bank_withdrawal" ? t.amount : null);
                  const rowKey = t.id + "-" + i;
                  const st = t.studentId ? studentById[t.studentId] : null;
                  return (
                    <React.Fragment key={rowKey}>
                      <tr className="ledger-row">
                        <td className="px-4 py-2.5 text-[10px] font-mono">
                          {t.source === "deposit" ? (
                            <button onClick={() => onViewReceipt(t.depositId)} className="underline text-[#12312B] font-semibold inline-flex items-center gap-1 hover:text-[#3F6B52]" title="Open official receipt">
                              <Receipt size={10} /> #{t.refId}
                            </button>
                          ) : t.source === "expense" ? (
                            <button onClick={() => onViewExpense(t.expenseRowId)} className="text-[#12312B] underline hover:text-[#3F6B52]" title="Open printable receipt">{t.refId}</button>
                          ) : t.source === "credit" ? (
                            <button onClick={() => onViewCredit(t.creditTxnId)} className="text-[#12312B] underline hover:text-[#3F6B52]" title="Open credit slip">{t.refId}</button>
                          ) : t.source === "interest" ? (
                            <button onClick={() => onViewInterest(t.interestPaymentId)} className="text-[#12312B] underline hover:text-[#3F6B52]" title="Open interest payment slip">{t.refId}</button>
                          ) : (
                            <button onClick={() => onViewBankTxn(t.bankTxnId)} className="text-[#12312B] underline hover:text-[#3F6B52]" title="Open transaction slip">{t.refId}</button>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(t.date)}</td>
                        <td className="px-4 py-2.5 text-xs">{t.label}</td>
                        <td className="px-4 py-2.5">
                          {/* Student ID is plain, non-clickable text — no toggle/arrow,
                              no expand panel. Just the ID, as requested. */}
                          {st?.studentId ? (
                            <span className="text-[10px] font-mono text-[#9C8F6E]">{st.studentId}</span>
                          ) : <span className="text-[10px] text-[#D8CFB8]">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-[#6E6650]">{t.remarks || "—"}</td>
                        <td className="px-4 py-2.5"><Stamp text={meta.label} tone={meta.tone} /></td>
                        <td className="px-4 py-2.5 font-mono text-[#A63D2F]">{debitAmt != null ? fmtINR(debitAmt) : ""}</td>
                        <td className="px-4 py-2.5 font-mono text-[#3F6B52]">{creditAmt != null ? fmtINR(creditAmt) : ""}</td>
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-[#3F6B52]">{fmtINR(t.cashBalance)}</td>
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-[#2B526C]">{fmtINR(t.bankBalance)}</td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
          <div className="footer text-center pt-3 pb-4 mt-2 border-t border-dashed border-[#12312B] text-[10px] text-[#9C8F6E]">
            Computer Generated Statement · Cash Balance and Bank Balance reflect every deposit, expense, internal transfer, and credit/loan entry up to this line
          </div>
        </div>
      </Card>
      </>
      )}

      {subTab === "transfers" && (
      <>
      {/* ===================================================================
          CASH ⇄ BANK TRANSFER LOGS — a dedicated sub-tab for internal
          transfers, kept separate from the main statement above (which is
          read-only / no delete button). Delete lives here instead.
      =================================================================== */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.1em" }} className="uppercase text-[#9C8F6E] mb-0.5">Internal Transfers</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-semibold text-[#1B1810]">Cash ⇄ Bank Transfer Logs</div>
        </div>
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Record Cash ⇄ Bank Transfer
        </button>
      </div>
      <Card className="mb-8">
        {(!bankTxns || bankTxns.length === 0) ? (
          <div className="p-6 text-center text-sm text-[#9C8F6E]">No Cash ⇄ Bank transfers recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Txn ID", "Date", "Type", "Bank / Account", "Reference", "Remarks", "Amount", ""].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...bankTxns].sort((a, b) => compareChrono(a, b, -1)).map(t => (
                <tr key={t.id} className="ledger-row">
                  <td className="px-4 py-2.5 text-[10px] font-mono">
                    <button onClick={() => onViewBankTxn(t.id)} className="text-[#12312B] underline hover:text-[#3F6B52]">{t.txnId}</button>
                  </td>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(t.date)}</td>
                  <td className="px-4 py-2.5"><Stamp text={t.type === "withdrawal" ? "Bank → Cash" : "Cash → Bank"} tone={t.type === "withdrawal" ? "break" : "carried"} /></td>
                  <td className="px-4 py-2.5 text-xs text-[#6E6650]">{t.bankName || t.accountNumber ? `${t.bankName || "—"}${t.accountNumber ? " · " + t.accountNumber : ""}` : "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-[#6E6650]">{t.refType && t.refNumber ? `${t.refType}: ${t.refNumber}` : "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-[#6E6650]">{t.remarks || "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-[#8A6420]">{fmtINR(t.amount)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => onRemoveBankTxn(t.id)} className="text-[10px] text-[#A63D2F] underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      </>
      )}

      {subTab === "credit" && (
      <>
      {/* ===================================================================
          CREDIT & LOAN LEDGER — money borrowed (Credit Taken) or lent
          (Credit Given), each with a unique Credit ID, full party details,
          and a "Pay Interest" action (for money we've borrowed) that logs
          its own unique, clickable Interest Payment.
      =================================================================== */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.1em" }} className="uppercase text-[#9C8F6E] mb-0.5">Borrowed & Lent</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-semibold text-[#1B1810]">Credit &amp; Loan Ledger</div>
        </div>
        <button onClick={onAddCredit} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#8A6420", color: "#FAF6EC" }}>
          <Plus size={15} /> Record Credit / Loan
        </button>
      </div>
      <Card>
        {(!creditTxns || creditTxns.length === 0) ? (
          <div className="p-6 text-center text-sm text-[#9C8F6E]">No credit / loan entries recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["", "Credit ID", "Date", "Direction", "Party", "Contact", "Amount", "Interest Paid", ""].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...creditTxns].sort((a, b) => compareChrono(a, b, -1)).map(c => {
                const isOpen = !!expandedCredit[c.id];
                const paidSoFar = (interestPaidByCreditId && interestPaidByCreditId[c.id]) || 0;
                const history = (interestPayments || []).filter(p => p.creditTxnId === c.id).sort((a, b) => compareChrono(a, b, -1));
                return (
                  <React.Fragment key={c.id}>
                    <tr className="ledger-row">
                      <td className="pl-3 py-2.5">
                        {history.length > 0 && (
                          <button onClick={() => setExpandedCredit(prev => ({ ...prev, [c.id]: !prev[c.id] }))} className="text-[#9C8F6E] hover:text-[#12312B] text-xs w-4">
                            {isOpen ? "▾" : "▸"}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[10px] font-mono">
                        <button onClick={() => onViewCredit(c.id)} className="text-[#12312B] underline hover:text-[#3F6B52]">{c.creditId}</button>
                      </td>
                      <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(c.date)}</td>
                      <td className="px-4 py-2.5"><Stamp text={c.direction === "taken" ? "Credit Taken" : "Credit Given"} tone={c.direction === "taken" ? "carried" : "overdue"} /></td>
                      <td className="px-4 py-2.5 text-xs">
                        <div className="font-medium">{c.partyName}</div>
                        <div className="text-[10px] text-[#9C8F6E]">{c.partyType}{c.mode ? " · " + c.mode : ""}</div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#6E6650]">{c.mobile || "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold" style={{ color: c.direction === "taken" ? "#8A6420" : "#A63D2F" }}>{fmtINR(c.amount)}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-[#6E6650]">{paidSoFar > 0 ? fmtINR(paidSoFar) : "—"}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <div className="flex flex-wrap gap-2 justify-end items-center">
                          {c.direction === "taken" && (
                            <button onClick={() => onPayInterest(c)} className="text-[10px] text-[#8A6420] underline font-semibold">Pay Interest</button>
                          )}
                          <button onClick={() => onRemoveCredit(c.id)} className="text-[10px] text-[#A63D2F] underline">Delete</button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && history.length > 0 && (
                      <tr>
                        <td></td>
                        <td colSpan={8} className="px-4 pb-3 pt-0">
                          <div className="p-3 rounded bg-[#FAF6EC] border text-xs" style={{ borderColor: "#D8CFB8" }}>
                            <div className="text-[10px] uppercase font-mono text-[#9C8F6E] mb-2">Interest Payment History</div>
                            <div className="space-y-1.5">
                              {history.map(p => (
                                <div key={p.id} className="flex items-center justify-between">
                                  <span>
                                    <button onClick={() => onViewInterest(p.id)} className="underline text-[#12312B] font-mono mr-2">{p.paymentId}</button>
                                    <span className="text-[#6E6650]">{fmtDate(p.date)} · {p.mode}</span>
                                  </span>
                                  <strong className="font-mono text-[#8A6420]">{fmtINR(p.amount)}</strong>
                                </div>
                              ))}
                            </div>
                            <div className="text-[10px] text-[#9C8F6E] mt-2">To delete an interest payment, switch to the <strong className="text-[#12312B]">Interest Payments Log</strong> tab above.</div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      </>
      )}

      {subTab === "interest" && (
      <>
      {/* ===================================================================
          INTEREST PAYMENTS LOG — a dedicated sub-tab for interest payments
          against Credit Taken entries, kept separate from the Credit &
          Loan Ledger tab (which is read-only / no delete button for
          interest). Delete lives here instead, exactly like the Cash ⇄
          Bank Transfer Logs tab does for transfers.
      =================================================================== */}
      <div className="mb-3">
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.1em" }} className="uppercase text-[#9C8F6E] mb-0.5">Interest Paid Against Credit Taken</div>
        <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-semibold text-[#1B1810]">Interest Payments Log</div>
      </div>
      <Card className="mb-8">
        {(!interestPayments || interestPayments.length === 0) ? (
          <div className="p-6 text-center text-sm text-[#9C8F6E]">No interest payments recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Payment ID", "Date", "Against Credit ID", "Party", "Mode", "Remarks", "Amount", ""].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...interestPayments].sort((a, b) => compareChrono(a, b, -1)).map(p => {
                const creditTxn = (creditTxns || []).find(c => c.id === p.creditTxnId);
                return (
                  <tr key={p.id} className="ledger-row">
                    <td className="px-4 py-2.5 text-[10px] font-mono">
                      <button onClick={() => onViewInterest(p.id)} className="text-[#12312B] underline hover:text-[#3F6B52]">{p.paymentId}</button>
                    </td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(p.date)}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-[#6E6650]">{creditTxn ? creditTxn.creditId : "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6E6650]">{creditTxn ? creditTxn.partyName : "Unknown"}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6E6650]">{p.mode || "Cash"}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6E6650]">{p.remarks || "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-[#8A6420]">{fmtINR(p.amount)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onRemoveInterest(p.id)} className="text-[10px] text-[#A63D2F] underline">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      </>
      )}
    </div>
  );
}

function TrashTab({ trashedStudents, trashedDeposits, trashedCharges, trashedExpenses, trashedBankTxns, trashedCreditTxns, trashedInterestPayments, studentById, onRestoreStudent, onDeleteStudent, onRestoreDeposit, onDeleteDeposit, onRestoreCharge, onDeleteCharge, onRestoreExpense, onDeleteExpense, onRestoreBankTxn, onDeleteBankTxn, onRestoreCredit, onDeleteCredit, onRestoreInterest, onDeleteInterest }) {
  return (
    <div>
      <SectionHeader eyebrow="Recycle Bin" title="Trash / Restore" />
      <div className="text-sm text-[#6E6650] mb-5">Deleted students, receipts, and charges land here first — nothing is gone for good until you permanently delete it. Restoring brings back the exact record with no data lost.</div>

      <div className="mb-3" style={{ fontFamily: "'Zilla Slab', serif" }}><span className="text-lg font-semibold">Deleted Students</span></div>
      <Card className="mb-6">
        {trashedStudents.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted students.</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {trashedStudents.map(s => (
                <tr key={s.id} className="ledger-row">
                  <td className="px-4 py-2.5 font-medium">{s.name}</td>
                  <td className="px-4 py-2.5 text-xs text-[#6E6650]">{s.class}</td>
                  <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono whitespace-nowrap">Deleted {s.deletedAt ? fmtDate(s.deletedAt) : ""}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => onRestoreStudent(s.id)} className="text-xs text-[#3F6B52] font-semibold underline mr-3 inline-flex items-center gap-1"><RotateCcw size={11} /> Restore</button>
                    <button onClick={() => onDeleteStudent(s.id)} className="text-xs text-[#A63D2F] underline">Delete Permanently</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="mb-3" style={{ fontFamily: "'Zilla Slab', serif" }}><span className="text-lg font-semibold">Deleted Receipts</span></div>
      <Card className="mb-6">
        {trashedDeposits.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted receipts.</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {trashedDeposits.map(d => {
                const st = studentById[d.studentId];
                return (
                  <tr key={d.id} className="ledger-row">
                    <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{fmtDate(d.date)}</td>
                    <td className="px-4 py-2.5 font-medium">{st ? st.name : "—"}</td>
                    <td className="px-4 py-2.5 text-xs font-mono font-semibold text-[#3F6B52]">{fmtINR(d.amount)}</td>
                    <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono whitespace-nowrap">Deleted {d.deletedAt ? fmtDate(d.deletedAt) : ""}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onRestoreDeposit(d.id)} className="text-xs text-[#3F6B52] font-semibold underline mr-3 inline-flex items-center gap-1"><RotateCcw size={11} /> Restore</button>
                      <button onClick={() => onDeleteDeposit(d.id)} className="text-xs text-[#A63D2F] underline">Delete Permanently</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <div className="mb-3" style={{ fontFamily: "'Zilla Slab', serif" }}><span className="text-lg font-semibold">Deleted Charges</span></div>
      <Card className="mb-6">
        {trashedCharges.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted charges.</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {trashedCharges.map(c => {
                const st = studentById[c.studentId];
                return (
                  <tr key={c.id} className="ledger-row">
                    <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{fmtDate(c.date)}</td>
                    <td className="px-4 py-2.5 font-medium">{st ? st.name : "—"}</td>
                    <td className="px-4 py-2.5 text-xs font-mono font-semibold text-[#B8862B]">{fmtINR(c.amount)}</td>
                    <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono whitespace-nowrap">Deleted {c.deletedAt ? fmtDate(c.deletedAt) : ""}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onRestoreCharge(c.id)} className="text-xs text-[#3F6B52] font-semibold underline mr-3 inline-flex items-center gap-1"><RotateCcw size={11} /> Restore</button>
                      <button onClick={() => onDeleteCharge(c.id)} className="text-xs text-[#A63D2F] underline">Delete Permanently</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <div className="mb-3" style={{ fontFamily: "'Zilla Slab', serif" }}><span className="text-lg font-semibold">Deleted Expenses</span></div>
      <Card>
        {trashedExpenses.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted expenses.</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {trashedExpenses.map(e => (
                <tr key={e.id} className="ledger-row">
                  <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{fmtDate(e.date)}</td>
                  <td className="px-4 py-2.5 font-medium">{e.category || "—"}</td>
                  <td className="px-4 py-2.5 text-xs font-mono font-semibold text-[#A63D2F]">{fmtINR(e.amount)}</td>
                  <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono whitespace-nowrap">Deleted {e.deletedAt ? fmtDate(e.deletedAt) : ""}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => onRestoreExpense(e.id)} className="text-xs text-[#3F6B52] font-semibold underline mr-3 inline-flex items-center gap-1"><RotateCcw size={11} /> Restore</button>
                    <button onClick={() => onDeleteExpense(e.id)} className="text-xs text-[#A63D2F] underline">Delete Permanently</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="mb-3 mt-6" style={{ fontFamily: "'Zilla Slab', serif" }}><span className="text-lg font-semibold">Deleted Bank Transactions</span></div>
      <Card>
        {(!trashedBankTxns || trashedBankTxns.length === 0) ? (
          <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted bank transactions.</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {trashedBankTxns.map(t => (
                <tr key={t.id} className="ledger-row">
                  <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{fmtDate(t.date)}</td>
                  <td className="px-4 py-2.5 font-medium">{t.type === "withdrawal" ? "Bank Withdrawal" : "Cash Deposit to Bank"} <span className="text-[10px] text-[#9C8F6E] font-mono">({t.txnId})</span></td>
                  <td className="px-4 py-2.5 text-xs font-mono font-semibold text-[#8A6420]">{fmtINR(t.amount)}</td>
                  <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono whitespace-nowrap">Deleted {t.deletedAt ? fmtDate(t.deletedAt) : ""}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => onRestoreBankTxn(t.id)} className="text-xs text-[#3F6B52] font-semibold underline mr-3 inline-flex items-center gap-1"><RotateCcw size={11} /> Restore</button>
                    <button onClick={() => onDeleteBankTxn(t.id)} className="text-xs text-[#A63D2F] underline">Delete Permanently</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="mb-3 mt-6" style={{ fontFamily: "'Zilla Slab', serif" }}><span className="text-lg font-semibold">Deleted Credit / Loan Entries</span></div>
      <Card className="mb-6">
        {(!trashedCreditTxns || trashedCreditTxns.length === 0) ? (
          <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted credit / loan entries.</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {trashedCreditTxns.map(c => (
                <tr key={c.id} className="ledger-row">
                  <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{fmtDate(c.date)}</td>
                  <td className="px-4 py-2.5 font-medium">{c.partyName} <span className="text-[10px] text-[#9C8F6E] font-mono">({c.creditId})</span></td>
                  <td className="px-4 py-2.5 text-xs font-mono font-semibold text-[#8A6420]">{fmtINR(c.amount)}</td>
                  <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono whitespace-nowrap">Deleted {c.deletedAt ? fmtDate(c.deletedAt) : ""}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => onRestoreCredit(c.id)} className="text-xs text-[#3F6B52] font-semibold underline mr-3 inline-flex items-center gap-1"><RotateCcw size={11} /> Restore</button>
                    <button onClick={() => onDeleteCredit(c.id)} className="text-xs text-[#A63D2F] underline">Delete Permanently</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="mb-3 mt-6" style={{ fontFamily: "'Zilla Slab', serif" }}><span className="text-lg font-semibold">Deleted Interest Payments</span></div>
      <Card>
        {(!trashedInterestPayments || trashedInterestPayments.length === 0) ? (
          <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted interest payments.</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {trashedInterestPayments.map(p => (
                <tr key={p.id} className="ledger-row">
                  <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{fmtDate(p.date)}</td>
                  <td className="px-4 py-2.5 font-medium">{p.paymentId}</td>
                  <td className="px-4 py-2.5 text-xs font-mono font-semibold text-[#8A6420]">{fmtINR(p.amount)}</td>
                  <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono whitespace-nowrap">Deleted {p.deletedAt ? fmtDate(p.deletedAt) : ""}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => onRestoreInterest(p.id)} className="text-xs text-[#3F6B52] font-semibold underline mr-3 inline-flex items-center gap-1"><RotateCcw size={11} /> Restore</button>
                    <button onClick={() => onDeleteInterest(p.id)} className="text-xs text-[#A63D2F] underline">Delete Permanently</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#12312Bcc" }}>
      <div className="w-full max-w-lg bg-[#FAF6EC] rounded-sm" style={{ border: "2px dashed #B8862B" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1.5px solid #26231D" }}>
          <h3 style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-[#6E6650]"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function WideModal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#12312Bcc" }}>
      <div className="w-full max-w-2xl bg-[#FAF6EC] rounded-sm" style={{ border: "2px dashed #B8862B" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1.5px solid #26231D" }}>
          <h3 style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-[#6E6650]"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-3">
      <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.08em" }} className="block uppercase text-[#9C8F6E] mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full border rounded-sm px-3 py-2 text-sm bg-white";
const inputStyle = { borderColor: "#D8CFB8" };

function StudentFormModal({ classes, subjectsList, streams, initial, onClose, onSave, students }) {
  const streamList = streams || STREAMS;
  const [name, setName] = useState(initial?.name || "");
  const [cls, setCls] = useState(initial?.class || classes[0] || "10");
  const [gender, setGender] = useState(initial?.gender || "");
  const [stream, setStream] = useState(initial?.stream || "");
  const [batches, setBatches] = useState(initial?.batches || []);
  const [phone, setPhone] = useState(initial?.phone || "");
  const [fatherName, setFatherName] = useState(initial?.fatherName || "");
  const [guardianPhone, setGuardianPhone] = useState(initial?.guardianPhone || "");
  const [address, setAddress] = useState(initial?.address || "");
  const [dob, setDob] = useState(initial?.dob || "");
  const [currentSchool, setCurrentSchool] = useState(initial?.currentSchool || "");
  const [aadharNumber, setAadharNumber] = useState(initial?.aadharNumber || "");
  const [admissionMonth, setAdmissionMonth] = useState(initial?.admissionMonth || currentMonthKey());
  // Joining Date — visibly defaults to TODAY'S date the moment the form
  // opens (for a new student), so office staff see it pre-filled instead
  // of blank. It stays editable — pick a different date to backdate a
  // student — and whatever's in the field at save time is what's stored.
  const [joiningDate, setJoiningDate] = useState(initial?.joiningDate || todayStr());
  const [monthlyDiscount, setMonthlyDiscount] = useState(initial?.monthlyDiscount || 0);
  const [previousDues, setPreviousDues] = useState(initial?.previousDues || 0);
  const [status] = useState(initial?.status || "active");

  // Student ID — shown read-only on the form. For an existing student it's
  // whatever was already assigned (never changes). For a new student it's
  // computed here purely for display, using the same rule saveStudent()
  // uses, so what the user sees on the form is exactly what gets saved.
  const displayStudentId = initial?.studentId || useMemo(() => generateStudentId(students), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Duplicate Aadhar detector — checks the live student list as the user
  // types and flags an existing match with a pop-up. It never blocks
  // saving; it just surfaces the possible duplicate so a human can decide
  // whether to continue (e.g. genuine case) or fix the number.
  const [dupStudent, setDupStudent] = useState(null);
  const [dismissedDupId, setDismissedDupId] = useState(null);
  useEffect(() => {
    const digits = aadharNumber.replace(/\D/g, "");
    if (digits.length < 4) { setDupStudent(null); return; }
    const match = (students || []).find(s => s.id !== initial?.id && (s.aadharNumber || "").replace(/\D/g, "") === digits);
    setDupStudent(match || null);
  }, [aadharNumber, students, initial]);
  const showDupPopup = !!dupStudent && dupStudent.id !== dismissedDupId;

  // Advance Payment — a one-time transaction captured right on the
  // registration/edit form. It is never stored as a field on the student
  // record itself; on save the parent hands it off to become a real
  // Deposit (so it counts toward the student's balance the same as any
  // other payment), and a Receipt is generated right after the student
  // is saved successfully.
  const [advancePayment, setAdvancePayment] = useState("");
  const [advancePaymentMode, setAdvancePaymentMode] = useState("Cash");
  const [advancePaymentRef, setAdvancePaymentRef] = useState("");

  function toggleSubject(sub) {
    setBatches(prev => prev.includes(sub) ? prev.filter(x => x !== sub) : (prev.length >= 6 ? prev : [...prev, sub]));
  }

  function submit() {
    if (!name.trim()) return;
    const baseHistory = initial?.batchHistory && initial.batchHistory.length ? [...initial.batchHistory] : [{ fromMonth: admissionMonth, batches }];
    if (initial?.batchHistory && initial.batchHistory.length) baseHistory[0] = { ...baseHistory[0], batches };
    onSave({
      ...initial, id: initial?.id, studentId: initial?.studentId || displayStudentId,
      name: name.trim(), class: cls, gender, stream, batches, batchHistory: baseHistory,
      phone: phone.trim(), fatherName: fatherName.trim(), guardianPhone: guardianPhone.trim(), address: address.trim(),
      dob: dob || "", currentSchool: currentSchool.trim(), aadharNumber: aadharNumber.trim(),
      admissionMonth, monthlyDiscount: Number(monthlyDiscount) || 0,
      // Joining Date — whatever was manually entered; if left blank, auto-
      // fills to today's date at save time.
      joiningDate: joiningDate || todayStr(),
      previousDues: Number(previousDues) || 0, status,
      advancePayment: Number(advancePayment) || 0,
      advancePaymentMode,
      advancePaymentRef: advancePaymentRef.trim(),
    });
  }

  return (
    <Modal title={initial ? "Edit Student Details" : "Add New Student"} onClose={onClose}>
      <div className="p-2.5 border rounded-sm mb-3 flex items-center justify-between bg-[#FAF6EC]" style={{ borderColor: "#D8CFB8" }}>
        <span className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono">Student ID</span>
        <span className="text-sm font-bold text-[#12312B]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{displayStudentId}{!initial && " (auto-assigned on save)"}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Full Name"><input className={inputCls} style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rahul Sharma" /></Field>
        <Field label="Father's Name"><input className={inputCls} style={inputStyle} value={fatherName} onChange={e => setFatherName(e.target.value)} placeholder="e.g. Suresh Sharma" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Class">
          <select className={inputCls} style={inputStyle} value={cls} onChange={e => setCls(e.target.value)}>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Gender">
          <select className={inputCls} style={inputStyle} value={gender} onChange={e => setGender(e.target.value)}>
            <option value="">— Select —</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fee Start Month"><input type="month" className={inputCls} style={inputStyle} value={admissionMonth} onChange={e => setAdmissionMonth(e.target.value)} /></Field>
        <Field label="Joining Date">
          <input type="date" className={inputCls} style={inputStyle} value={joiningDate} onChange={e => setJoiningDate(e.target.value)} />
          <div className="text-[10px] text-[#9C8F6E] mt-1">Defaults to today's date — change it to backdate a student.</div>
        </Field>
      </div>
      <Field label="Stream (optional)">
        <select className={inputCls} style={inputStyle} value={stream} onChange={e => setStream(e.target.value)}>
          <option value="">— Not Applicable —</option>
          {streamList.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone / WhatsApp Number"><input className={inputCls} style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit phone number" /></Field>
        <Field label="Guardian Phone Number"><input className={inputCls} style={inputStyle} value={guardianPhone} onChange={e => setGuardianPhone(e.target.value)} placeholder="Alternate contact (optional)" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date of Birth"><input type="date" className={inputCls} style={inputStyle} value={dob} onChange={e => setDob(e.target.value)} /></Field>
        <Field label="Current School / Institution"><input className={inputCls} style={inputStyle} value={currentSchool} onChange={e => setCurrentSchool(e.target.value)} placeholder="e.g. Delhi Public School" /></Field>
      </div>
      <Field label="Aadhar Number">
        <input className={inputCls} style={inputStyle} value={aadharNumber} onChange={e => setAadharNumber(e.target.value)} placeholder="12-digit Aadhar number" maxLength={14} />
        {dupStudent && (
          <div className="text-[10px] text-[#A63D2F] mt-1 font-medium">
            ⚠ Matches existing record: {dupStudent.name}{dupStudent.studentId ? ` (${dupStudent.studentId})` : ""} — {dupStudent.class}{dupStudent.phone ? ` · ${dupStudent.phone}` : ""}
          </div>
        )}
      </Field>
      <Field label="Address"><input className={inputCls} style={inputStyle} value={address} onChange={e => setAddress(e.target.value)} placeholder="House / street / area / city" /></Field>
      <Field label="Monthly Concession / Discount (₹)"><input type="number" className={inputCls} style={inputStyle} value={monthlyDiscount} onChange={e => setMonthlyDiscount(e.target.value)} placeholder="0" /></Field>
      <Field label="Opening Balance / Legacy Carried Dues (₹)">
        <input type="number" className={inputCls} style={inputStyle} value={previousDues} onChange={e => setPreviousDues(e.target.value)} placeholder="0" />
        <div className="text-[10px] text-[#9C8F6E] mt-1">Only for a one-time starting balance (e.g. migrating from a paper register). For anything ongoing, use "Add Charge" instead — it keeps a dated log.</div>
      </Field>

      <div className="p-3 border rounded-sm mb-3 bg-white" style={{ borderColor: "#3F6B52" }}>
        <div className="text-xs font-semibold text-[#3F6B52] mb-2 flex items-center gap-1.5"><Banknote size={13} /> Advance Payment (optional)</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount Received Now (₹)"><input type="number" className={inputCls} style={inputStyle} value={advancePayment} onChange={e => setAdvancePayment(e.target.value)} placeholder="0" /></Field>
          <Field label="Payment Mode">
            <select className={inputCls} style={inputStyle} value={advancePaymentMode} onChange={e => setAdvancePaymentMode(e.target.value)}>
              {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
        </div>
        {(advancePaymentMode === "UPI" || advancePaymentMode === "Bank Transfer") && (
          <Field label="UTR / Reference Number"><input className={inputCls} style={inputStyle} value={advancePaymentRef} onChange={e => setAdvancePaymentRef(e.target.value)} placeholder="e.g. 402913827461" /></Field>
        )}
        {advancePaymentMode === "Cheque" && (
          <Field label="Cheque Number"><input className={inputCls} style={inputStyle} value={advancePaymentRef} onChange={e => setAdvancePaymentRef(e.target.value)} placeholder="e.g. 004521" /></Field>
        )}
        <div className="text-[10px] text-[#9C8F6E]">If an amount is entered here, it's recorded as a Deposit against this student's balance, and a printable Receipt opens right after you save.</div>
      </div>

      <Field label={`Select Subjects / Batches at admission (${batches.length}/6 max)`}>
        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 border bg-white rounded-sm">
          {subjectsList.map(sub => {
            const active = batches.includes(sub);
            return (
              <button key={sub} type="button" onClick={() => toggleSubject(sub)} className="px-2.5 py-1 text-xs rounded-sm border flex items-center gap-1"
                style={{ background: active ? "#12312B" : "white", color: active ? "#F4EFDE" : "#4A4636", borderColor: active ? "#12312B" : "#D8CFB8" }}>
                {active && <Check size={12} />}{sub}
              </button>
            );
          })}
        </div>
        {initial && <div className="text-[10px] text-[#9C8F6E] mt-1">To change subjects from a later month (e.g. add one in September), close this and use "Batches" on the student's row instead.</div>}
      </Field>
      <button onClick={submit} className="w-full mt-3 py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
        {initial ? "Save Changes" : "Register Student"}
      </button>

      {showDupPopup && (
        <Modal title="⚠ Possible Duplicate Registration" onClose={() => setDismissedDupId(dupStudent.id)}>
          <div className="text-sm mb-3 text-[#4A4636]">This Aadhar Number is already registered against an existing student:</div>
          <div className="p-3 rounded-sm border bg-[#FAF6EC] text-sm mb-4 space-y-0.5" style={{ borderColor: "#D8CFB8" }}>
            <div className="font-semibold text-[#12312B]">{dupStudent.name} {dupStudent.studentId ? <span className="font-mono text-xs text-[#9C8F6E]">({dupStudent.studentId})</span> : null}</div>
            <div className="text-xs text-[#6E6650]">Class {dupStudent.class}{dupStudent.stream ? ` · ${dupStudent.stream}` : ""}</div>
            <div className="text-xs text-[#6E6650]">{dupStudent.phone || "No phone on record"}</div>
            <div className="text-xs text-[#6E6650]">Status: <span className="capitalize">{(dupStudent.status || "active").replace("_", " ")}</span></div>
          </div>
          <div className="text-[11px] text-[#9C8F6E] mb-3">This is just a check — nothing is blocked. Confirm whether this is a genuine new admission (e.g. a sibling sharing a guardian's Aadhar) or a duplicate entry, then decide whether to continue, edit the number, or cancel.</div>
          <button onClick={() => setDismissedDupId(dupStudent.id)} className="w-full py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
            Okay, I'll Review This
          </button>
        </Modal>
      )}
    </Modal>
  );
}

function ExitStudentModal({ student, currentDue, onClose, onConfirm }) {
  const [reason, setReason] = useState("Passed");
  const [exitDate, setExitDate] = useState(todayStr());
  return (
    <Modal title={`End / Pause Enrollment — ${student.name}`} onClose={onClose}>
      <div className="p-3 bg-[#F7E7E3] border border-[#A63D2F] rounded text-xs mb-4">
        This stops monthly fee generation for this student. Their current outstanding balance (<strong>{fmtINR(currentDue)}</strong>) is carried forward and stays visible on the Dues tab.
        Made a mistake? You can undo this in one click from the student's row right after confirming.
      </div>
      <Field label="Reason">
        <div className="space-y-1.5">
          {EXIT_REASONS.map(r => (
            <label key={r.value} className="flex items-center gap-2 text-sm p-2 border rounded-sm cursor-pointer" style={{ borderColor: reason === r.value ? "#12312B" : "#D8CFB8", background: reason === r.value ? "#F5F0E1" : "white" }}>
              <input type="radio" name="exitReason" checked={reason === r.value} onChange={() => setReason(r.value)} />
              {r.label}
            </label>
          ))}
        </div>
      </Field>
      <Field label="Effective Date"><input type="date" className={inputCls} style={inputStyle} value={exitDate} onChange={e => setExitDate(e.target.value)} /></Field>
      <button onClick={() => onConfirm(reason, exitDate)} className="w-full mt-3 py-2.5 rounded-sm text-sm font-semibold text-white" style={{ background: "#A63D2F" }}>Confirm</button>
    </Modal>
  );
}

function BatchChangeModal({ student, subjectsList, curMonth, onClose, onSave }) {
  const [fromMonth, setFromMonth] = useState(curMonth);
  const [batches, setBatches] = useState(student.batches || []);
  const minMonth = student.admissionMonth || curMonth;
  const sortedHistory = [...(student.batchHistory || [])].sort((a, b) => (a.fromMonth < b.fromMonth ? -1 : 1));

  function toggleSubject(sub) {
    setBatches(prev => prev.includes(sub) ? prev.filter(x => x !== sub) : (prev.length >= 6 ? prev : [...prev, sub]));
  }
  function submit() {
    if (fromMonth < minMonth) { alert(`Effective month can't be before this student's start month (${monthLabel(minMonth)}).`); return; }
    onSave(student, fromMonth, batches);
  }

  return (
    <Modal title={`Change Batches — ${student.name}`} onClose={onClose}>
      <div className="text-xs text-[#6E6650] mb-3">Pick the month this change should start from. Months before it keep using whatever subjects applied back then — nothing already billed gets recalculated.</div>
      <Field label="Effective From Month"><input type="month" min={minMonth} className={inputCls} style={inputStyle} value={fromMonth} onChange={e => setFromMonth(e.target.value)} /></Field>
      <Field label={`Subjects from ${monthLabel(fromMonth)} onward (${batches.length}/6)`}>
        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 border bg-white rounded-sm">
          {subjectsList.map(sub => {
            const active = batches.includes(sub);
            return (
              <button key={sub} type="button" onClick={() => toggleSubject(sub)} className="px-2.5 py-1 text-xs rounded-sm border flex items-center gap-1"
                style={{ background: active ? "#12312B" : "white", color: active ? "#F4EFDE" : "#4A4636", borderColor: active ? "#12312B" : "#D8CFB8" }}>
                {active && <Check size={12} />}{sub}
              </button>
            );
          })}
        </div>
      </Field>
      {sortedHistory.length > 0 && (
        <div className="mt-3 p-3 border rounded bg-white" style={{ borderColor: "#D8CFB8" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="uppercase tracking-wide text-[#9C8F6E] mb-1.5">Existing timeline</div>
          <div className="space-y-1">
            {sortedHistory.map((h, i) => (
              <div key={i} className="text-xs flex justify-between gap-3">
                <span className="font-mono text-[#6E6650] shrink-0">{monthLabel(h.fromMonth)} →</span>
                <span className="text-[#4A4636] text-right">{(h.batches || []).join(", ") || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <button onClick={submit} className="w-full mt-3 py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>Save Batch Change</button>
    </Modal>
  );
}

function PromoteModal({ student, classes, subjectsList, curMonth, onClose, onPromote }) {
  const [newClass, setNewClass] = useState(student.class);
  const [newBatches, setNewBatches] = useState(student.batches || []);
  const [newStartMonth, setNewStartMonth] = useState(curMonth);
  const [monthlyDiscount, setMonthlyDiscount] = useState(student.monthlyDiscount || 0);

  function toggleSubject(sub) {
    setNewBatches(prev => prev.includes(sub) ? prev.filter(x => x !== sub) : (prev.length >= 6 ? prev : [...prev, sub]));
  }
  function submit() { onPromote(student, newClass, newBatches, newStartMonth, monthlyDiscount); }

  return (
    <Modal title={`${(student.status || "active") === "dropped" ? "Reactivate" : "Promote / Re-Enroll"}: ${student.name}`} onClose={onClose}>
      <div className="p-3 bg-[#EAF1EA] border border-[#3F6B52] rounded text-xs mb-3">
        Carried Dues from previous sessions: <strong>{fmtINR(student.previousDues || 0)}</strong>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="New Class">
          <select className={inputCls} style={inputStyle} value={newClass} onChange={e => setNewClass(e.target.value)}>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Fee Resume Start Month"><input type="month" className={inputCls} style={inputStyle} value={newStartMonth} onChange={e => setNewStartMonth(e.target.value)} /></Field>
      </div>
      <Field label="Monthly Concession (₹)"><input type="number" className={inputCls} style={inputStyle} value={monthlyDiscount} onChange={e => setMonthlyDiscount(e.target.value)} /></Field>
      <Field label={`Select Subjects (${newBatches.length}/6)`}>
        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 border bg-white rounded-sm">
          {subjectsList.map(sub => {
            const active = newBatches.includes(sub);
            return (
              <button key={sub} type="button" onClick={() => toggleSubject(sub)} className="px-2.5 py-1 text-xs rounded-sm border flex items-center gap-1"
                style={{ background: active ? "#12312B" : "white", color: active ? "#F4EFDE" : "#4A4636", borderColor: active ? "#12312B" : "#D8CFB8" }}>
                {active && <Check size={12} />}{sub}
              </button>
            );
          })}
        </div>
      </Field>
      <button onClick={submit} className="w-full mt-3 py-2.5 rounded-sm text-sm font-semibold bg-[#3F6B52] text-white">
        {(student.status || "active") === "dropped" ? "Reactivate Student & Resume Fee Counter" : "Promote Student & Resume Fee Counter"}
      </button>
    </Modal>
  );
}

function AcademicHistoryModal({ student, onClose }) {
  const history = student.academicHistory || [];
  const batchTimeline = [...(student.batchHistory || [])].sort((a, b) => (a.fromMonth < b.fromMonth ? -1 : 1));
  return (
    <Modal title={`Academic Audit Log — ${student.name}`} onClose={onClose}>
      <div className="space-y-3">
        {history.length === 0 ? (
          <div className="text-sm text-[#9C8F6E] p-4 text-center">No past academic cycles recorded yet.</div>
        ) : (
          history.map((h, i) => (
            <div key={i} className="p-3 border rounded bg-white" style={{ borderColor: "#D8CFB8" }}>
              <div className="flex justify-between items-center text-sm font-semibold text-[#12312B]">
                <span>{h.class}</span>
                <Stamp text={h.resultStatus || "Completed"} tone={h.resultStatus === "Dropped" ? "overdue" : "paid"} />
              </div>
              <div className="text-xs text-[#6E6650] mt-1">Subjects: {(h.batches || []).join(", ") || "General"}</div>
              <div className="text-[11px] text-[#9C8F6E] mt-1 flex justify-between" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                <span>Joined: {monthLabel(h.admissionMonth)}</span>
                <span>Ended: {h.completionDate ? fmtDate(h.completionDate) : "—"}</span>
              </div>
              {h.unpaidBalanceAtEnd > 0 && (
                <div className="text-[11px] text-[#A63D2F] mt-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Balance carried forward: {fmtINR(h.unpaidBalanceAtEnd)}</div>
              )}
            </div>
          ))
        )}
      </div>
      {batchTimeline.length > 0 && (
        <div className="mt-4 pt-4" style={{ borderTop: "1.5px solid #26231D" }}>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-sm font-semibold mb-2">Batch change timeline</div>
          <div className="space-y-1">
            {batchTimeline.map((h, i) => (
              <div key={i} className="text-xs flex justify-between gap-3 p-2 rounded bg-[#FAF6EC]">
                <span className="font-mono text-[#6E6650] shrink-0">{monthLabel(h.fromMonth)} →</span>
                <span className="text-[#4A4636] text-right">{(h.batches || []).join(", ") || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

function AddChargeModal({ students, charges, initialStudent, curMonth, onClose, onSave }) {
  const [studentId, setStudentId] = useState(initialStudent?.id || students[0]?.id || "");
  const [studentSearch, setStudentSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [month, setMonth] = useState(curMonth);
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [date, setDate] = useState(todayStr());

  const student = students.find(s => s.id === studentId);
  const classOptions = useMemo(() => Array.from(new Set(students.map(s => s.class))).sort(), [students]);
  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return students.filter(s => {
      if (classFilter !== "all" && String(s.class) !== classFilter) return false;
      if (q && !((s.name || "").toLowerCase().includes(q) || (s.phone || "").toLowerCase().includes(q))) return false;
      return true;
    });
  }, [students, studentSearch, classFilter]);

  const recentChargesForStudent = useMemo(() => {
    if (!studentId || !charges) return [];
    return charges.filter(c => c.studentId === studentId).sort((a, b) => compareChrono(a, b, -1)).slice(0, 5);
  }, [charges, studentId]);

  function submit() {
    if (!studentId || !amount) return;
    onSave({ studentId, month, amount: Number(amount), remarks: remarks.trim(), date });
  }

  return (
    <Modal title="Add Additional Charge" onClose={onClose}>
      <div className="text-xs text-[#6E6650] mb-3">Use this for anything outside regular tuition — exam fee, study material, late fee, damaged equipment, etc. It's logged permanently with a date and remark, and adds straight to the student's balance.</div>

      <Field label="Student">
        <div className="relative">
          <div className="flex items-center border rounded-sm bg-white px-3 py-2 cursor-pointer" style={inputStyle} onClick={() => setPickerOpen(o => !o)}>
            <Search size={13} className="text-[#9C8F6E] mr-2 shrink-0" />
            <span className="text-sm flex-1 truncate">{student ? `${student.name} — ${student.class}${student.phone ? " · " + student.phone : ""}` : "Search by name, class, or phone…"}</span>
          </div>
          {pickerOpen && (
            <div className="absolute z-10 mt-1 w-full bg-white border rounded-sm shadow-lg max-h-72 overflow-y-auto" style={{ borderColor: "#D8CFB8" }}>
              <div className="p-2 sticky top-0 bg-white border-b flex gap-2" style={{ borderColor: "#EEE7D2" }}>
                <input autoFocus className={inputCls} style={inputStyle} value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="Type name or phone…" />
                <select className={inputCls} style={{ ...inputStyle, width: "auto" }} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                  <option value="all">All Classes</option>
                  {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {filteredStudents.length === 0 ? (
                <div className="p-3 text-xs text-[#9C8F6E] text-center">No students match.</div>
              ) : (
                filteredStudents.map(s => (
                  <button key={s.id} type="button" onClick={() => { setStudentId(s.id); setPickerOpen(false); setStudentSearch(""); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#F5F0E1] flex items-center justify-between"
                    style={{ background: s.id === studentId ? "#F5F0E1" : "white" }}>
                    <span>{s.name} <span className="text-xs text-[#9C8F6E]">— {s.class}</span></span>
                    <span className="text-xs text-[#9C8F6E] font-mono">{s.phone || ""}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </Field>

      {student && recentChargesForStudent.length > 0 && (
        <div className="mb-3 p-2.5 rounded-sm border bg-white text-xs" style={{ borderColor: "#D8CFB8" }}>
          <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1.5">Existing charges for {student.name}</div>
          <div className="space-y-1">
            {recentChargesForStudent.map(c => (
              <div key={c.id} className="flex items-center justify-between">
                <span className="text-[#6E6650]">{c.chargeId || `CHG-${shortId(c.id)}`} · {fmtDate(c.date)} · {c.remarks || monthLabel(c.month)}</span>
                <span className="font-mono font-semibold text-[#B8862B]">{fmtINR(c.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="For Month"><input type="month" className={inputCls} style={inputStyle} value={month} onChange={e => setMonth(e.target.value)} /></Field>
        <Field label="Date Added"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
      </div>
      <Field label="Amount (₹)"><input type="number" className={inputCls} style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></Field>
      <Field label="Remarks — what is this charge for?"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g. Annual exam fee" /></Field>
      <button onClick={submit} disabled={!studentId || !amount} className="w-full mt-3 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Add Charge
      </button>
    </Modal>
  );
}

// ============================================================================
// STUDENT STATEMENT — a bank-style "account statement" of every transaction
// (tuition accrual, ad-hoc charges, deposits, write-offs) for one student,
// each row carrying a running balance like the ledger engine produces.
// Payment rows show a Receipt No that links straight to that deposit's
// official receipt (via onViewReceipt), so nothing has to be looked up by hand.
// ============================================================================
function StudentStatementModal({ student, ledger, onClose, onViewReceipt, onViewCharge }) {
  const statementRef = useRef();
  if (!ledger) return null;

  const generatedOn = fmtDate(todayStr());

  const handlePrintStatement = () => {
    const printContent = statementRef.current.innerHTML;
    const win = window.open("", "", "width=850,height=900");
    // Loads the same Tailwind utility classes + Google Fonts the live app
    // uses, so the printed page renders exactly like the on-screen preview
    // instead of the plain unstyled text a bare popup window would produce.
    win.document.write(`
      <html>
        <head>
          <title>Account Statement - ${student.name}</title>
          <script src="https://cdn.tailwindcss.com"><\/script>
          <style>
            ${FONT_IMPORT}
            @page { size: A4; margin: 14mm; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { font-family: 'Inter', sans-serif; color: #12312B; background: #fff; margin: 0; }
            .stmt-doc { border: 1.5px solid #B8862B; border-radius: 4px; padding: 22px; }
            .stmt-doc::before { content: ""; display: block; height: 3px; background: #12312B; margin: -22px -22px 18px -22px; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
          </style>
        </head>
        <body>
          <div class="stmt-doc">${printContent}</div>
        </body>
      </html>
    `);
    win.document.close(); win.focus(); setTimeout(() => { win.print(); win.close(); }, 300);
  };

  return (
    <WideModal title={`Statement — ${student.name}${student.studentId ? ` (${student.studentId})` : ""}`} onClose={onClose}>
      <div ref={statementRef}>
        {/* Letterhead — mirrors the official receipt so the statement reads as one professional record system */}
        <div className="text-center pb-3 mb-4 border-b-2 border-dashed border-[#12312B]">
          <h2 style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#12312B]">COACHING CLASSES</h2>
          <p className="text-[10px] uppercase tracking-wider text-[#9C8F6E]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Official Account Statement — All Recorded Transactions</p>
        </div>

        {/* Student / account details */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-4 text-xs">
          <div className="flex justify-between border-b border-dotted pb-1" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Student Name:</span><strong className="text-[#12312B]">{student.name}</strong></div>
          <div className="flex justify-between border-b border-dotted pb-1" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Student ID:</span><strong className="text-[#12312B]">{student.studentId || "—"}</strong></div>
          <div className="flex justify-between border-b border-dotted pb-1" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Statement Date:</span><strong className="text-[#12312B]">{generatedOn}</strong></div>
          <div className="flex justify-between border-b border-dotted pb-1" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Class:</span><strong className="text-[#12312B]">{student.class}</strong></div>
          <div className="flex justify-between border-b border-dotted pb-1" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Phone:</span><strong className="text-[#12312B]">{student.phone || "—"}</strong></div>
          <div className="flex justify-between border-b border-dotted pb-1" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Fee Start Month:</span><strong className="text-[#12312B]">{monthLabel(student.admissionMonth)}</strong></div>
          <div className="flex justify-between border-b border-dotted pb-1" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Status:</span><strong className="text-[#12312B] capitalize">{(student.status || "active").replace("_", " ")}</strong></div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-2.5 rounded bg-[#FAF6EC] border" style={{ borderColor: "#D8CFB8" }}>
            <div className="text-[10px] uppercase text-[#9C8F6E] font-mono">Total Charged</div>
            <div className="text-lg font-bold" style={{ fontFamily: "'Zilla Slab', serif" }}>{fmtINR(ledger.totalCharged)}</div>
          </div>
          <div className="p-2.5 rounded bg-[#EAF1EA] border" style={{ borderColor: "#3F6B52" }}>
            <div className="text-[10px] uppercase text-[#3F6B52] font-mono">Total Cleared</div>
            <div className="text-lg font-bold text-[#3F6B52]" style={{ fontFamily: "'Zilla Slab', serif" }}>{fmtINR(ledger.totalCleared)}</div>
          </div>
          <div className="p-2.5 rounded bg-[#F7E7E3] border" style={{ borderColor: "#A63D2F" }}>
            <div className="text-[10px] uppercase text-[#A63D2F] font-mono">Current Balance</div>
            <div className="text-lg font-bold text-[#A63D2F]" style={{ fontFamily: "'Zilla Slab', serif" }}>{fmtINR(ledger.balance)}</div>
          </div>
        </div>

        {ledger.timeline.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">No transactions recorded yet for this student.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Charge / Receipt No", "Date", "Charges Month", "Description", "Remarks", "Debit", "Credit", "Balance"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-3 py-2 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.timeline.map((l, i) => (
                <tr key={i} className="ledger-row">
                  <td className="px-3 py-2 font-mono">
                    {l.kind === "credit" && (l.type === "payment" || l.type === "writeoff") ? (
                      onViewReceipt ? (
                        <button
                          onClick={() => onViewReceipt(l.depositId)}
                          className="underline text-[#12312B] font-semibold inline-flex items-center gap-1 hover:text-[#3F6B52]"
                          title={l.type === "writeoff" ? "Open the receipt this write-off was recorded against" : "Open official receipt for this payment"}
                        >
                          <Receipt size={10} /> #{l.receiptNo}
                        </button>
                      ) : (
                        <span className="text-[#6E6650]">#{l.receiptNo}</span>
                      )
                    ) : l.kind === "debit" && onViewCharge && l.chargeId ? (
                      <button onClick={() => onViewCharge(l)} className="text-[#12312B] underline hover:text-[#3F6B52]" title="Open printable receipt">{l.chargeId}</button>
                    ) : (
                      <span className="text-[#9C8F6E]">{l.chargeId || "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{fmtDate(l.date)}</td>
                  <td className="px-3 py-2 font-mono">{l.month ? monthLabel(l.month) : "—"}</td>
                  <td className="px-3 py-2">{l.label}</td>
                  <td className="px-3 py-2 text-[#6E6650]">{l.remarks || "—"}</td>
                  <td className="px-3 py-2 font-mono text-[#A63D2F]">{l.kind === "debit" ? fmtINR(l.amount) : ""}</td>
                  <td className="px-3 py-2 font-mono text-[#3F6B52]">{l.kind === "credit" ? fmtINR(l.amount) : ""}</td>
                  <td className="px-3 py-2 font-mono font-semibold">{fmtINR(l.runningBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="text-center pt-3 mt-4 border-t border-dashed border-[#12312B] text-[10px] text-[#9C8F6E]">
          This statement reflects every deposit, tuition charge, additional charge, and write-off recorded for this student · Computer Generated Statement
        </div>
      </div>

      <button onClick={handlePrintStatement} className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]">
        <Printer size={15} /> Print / Export Statement
      </button>
    </WideModal>
  );
}

function DepositFormModal({ students, studentDues, onClose, onSave }) {
  const [studentId, setStudentId] = useState(students[0]?.id || "");
  const [studentSearch, setStudentSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const student = students.find(s => s.id === studentId);
  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s => (s.name || "").toLowerCase().includes(q) || String(s.class || "").toLowerCase().includes(q) || (s.phone || "").toLowerCase().includes(q));
  }, [students, studentSearch]);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [mode, setMode] = useState("Cash");
  const [utr, setUtr] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [showWriteOff, setShowWriteOff] = useState(false);
  const [writeOffAmount, setWriteOffAmount] = useState("");
  const [writeOffRemarks, setWriteOffRemarks] = useState("");

  const currentBalance = student ? (studentDues[student.id] || 0) : 0;

  function submit() {
    if (!studentId || (!amount && !writeOffAmount)) return;
    onSave({
      studentId, amount: Number(amount) || 0, date, mode,
      utr: (mode === "UPI" || mode === "Bank Transfer") ? utr.trim() : "",
      chequeNumber: mode === "Cheque" ? chequeNumber.trim() : "",
      remarks: remarks.trim(),
      writeOffAmount: showWriteOff ? (Number(writeOffAmount) || 0) : 0,
      writeOffRemarks: showWriteOff ? writeOffRemarks.trim() : "",
    });
  }

  return (
    <Modal title="Record Payment / Receipt" onClose={onClose}>
      <Field label="Select Student">
        <div className="relative">
          <div className="flex items-center border rounded-sm bg-white px-3 py-2 cursor-pointer" style={inputStyle} onClick={() => setPickerOpen(o => !o)}>
            <Search size={13} className="text-[#9C8F6E] mr-2 shrink-0" />
            <span className="text-sm flex-1 truncate">{student ? `${student.name} — ${student.class}${student.phone ? " · " + student.phone : ""}` : "Search by name, class, or phone…"}</span>
          </div>
          {pickerOpen && (
            <div className="absolute z-10 mt-1 w-full bg-white border rounded-sm shadow-lg max-h-64 overflow-y-auto" style={{ borderColor: "#D8CFB8" }}>
              <div className="p-2 sticky top-0 bg-white border-b" style={{ borderColor: "#EEE7D2" }}>
                <input autoFocus className={inputCls} style={inputStyle} value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="Type name, class, or phone…" />
              </div>
              {filteredStudents.length === 0 ? (
                <div className="p-3 text-xs text-[#9C8F6E] text-center">No students match.</div>
              ) : (
                filteredStudents.map(s => (
                  <button key={s.id} type="button" onClick={() => { setStudentId(s.id); setPickerOpen(false); setStudentSearch(""); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#F5F0E1] flex items-center justify-between"
                    style={{ background: s.id === studentId ? "#F5F0E1" : "white" }}>
                    <span>{s.name} <span className="text-xs text-[#9C8F6E]">— {s.class}</span></span>
                    <span className="text-xs text-[#9C8F6E] font-mono">{s.phone || ""}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </Field>
      <div className="text-xs text-[#6E6650] mb-3">
        Current outstanding balance: <strong className={currentBalance > 0 ? "text-[#A63D2F]" : "text-[#3F6B52]"}>{fmtINR(currentBalance)}</strong>
        <div className="text-[10px] text-[#9C8F6E] mt-0.5">Any amount you enter here clears the oldest pending charges first — no need to pick which month it's for.</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount Received (₹)"><input type="number" className={inputCls} style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></Field>
        <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
      </div>

      <Field label="Payment Mode">
        <div className="flex gap-2 flex-wrap">
          {PAYMENT_MODES.map(m => (
            <button key={m} type="button" onClick={() => setMode(m)} className="px-3 py-1.5 text-xs rounded-sm border font-semibold"
              style={{ background: mode === m ? "#12312B" : "white", color: mode === m ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
              {m}
            </button>
          ))}
        </div>
      </Field>

      {(mode === "UPI" || mode === "Bank Transfer") && (
        <Field label="UTR / Reference Number"><input className={inputCls} style={inputStyle} value={utr} onChange={e => setUtr(e.target.value)} placeholder="e.g. 402913827461" /></Field>
      )}
      {mode === "Cheque" && (
        <Field label="Cheque Number"><input className={inputCls} style={inputStyle} value={chequeNumber} onChange={e => setChequeNumber(e.target.value)} placeholder="e.g. 004521" /></Field>
      )}

      <Field label="Remarks (optional)"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any note for this payment" /></Field>

      {!showWriteOff ? (
        <button type="button" onClick={() => setShowWriteOff(true)} className="text-xs text-[#B8862B] font-semibold underline mb-3 inline-flex items-center gap-1">
          <Percent size={12} /> Add a discount / write-off to this receipt
        </button>
      ) : (
        <div className="p-3 border rounded-sm mb-3 bg-white" style={{ borderColor: "#B8862B" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#8A6420]">Discount / Write-off</span>
            <button type="button" onClick={() => { setShowWriteOff(false); setWriteOffAmount(""); setWriteOffRemarks(""); }} className="text-xs text-[#A63D2F] underline">Remove</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount to Forgive (₹)"><input type="number" className={inputCls} style={inputStyle} value={writeOffAmount} onChange={e => setWriteOffAmount(e.target.value)} placeholder="0" /></Field>
            <Field label="Reason"><input className={inputCls} style={inputStyle} value={writeOffRemarks} onChange={e => setWriteOffRemarks(e.target.value)} placeholder="e.g. Sibling discount" /></Field>
          </div>
          <div className="text-[10px] text-[#9C8F6E]">This clears the balance the same way a payment does, but isn't counted as cash collected.</div>
        </div>
      )}

      <button onClick={submit} disabled={!studentId || (!amount && !writeOffAmount)} className="w-full mt-1 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Record & Generate Receipt
      </button>
    </Modal>
  );
}

// ============================================================================
// EXPENSE FORM — captures a single outgoing payment (rent, salary, materials,
// etc). Mirrors the Deposit form's payment-mode + reference/UTR pattern so
// the two logs feel consistent, then hands off to addExpense() which stamps
// a unique EXP-XXXXXX id and opens the printable receipt.
// ============================================================================
function ExpenseFormModal({ onClose, onSave }) {
  const [category, setCategory] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [mode, setMode] = useState("Cash");
  const [refNumber, setRefNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  function submit() {
    if (!category.trim() || !amount) return;
    onSave({
      category: category.trim(), paidTo: paidTo.trim(), amount: Number(amount) || 0, date, mode,
      refNumber: mode !== "Cash" ? refNumber.trim() : "",
      remarks: remarks.trim(),
    });
  }

  return (
    <Modal title="Add Expense" onClose={onClose}>
      <div className="text-xs text-[#6E6650] mb-3">Log any money paid out by the center — rent, salaries, materials, maintenance, marketing, anything. It gets its own Expense ID and a printable receipt, and feeds the Cash / Online balance tiles on the Dashboard.</div>

      <Field label="Category / Title">
        <input list="expense-categories" className={inputCls} style={inputStyle} value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Rent, Staff Salary, Stationery" />
        <datalist id="expense-categories">
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c} />)}
        </datalist>
      </Field>

      <Field label="Paid To (vendor, staff, landlord, or recipient)">
        <input className={inputCls} style={inputStyle} value={paidTo} onChange={e => setPaidTo(e.target.value)} placeholder="e.g. Rahul Sharma, XYZ Stationers" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₹)"><input type="number" className={inputCls} style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></Field>
        <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
      </div>

      <Field label="Payment Mode">
        <div className="flex gap-2 flex-wrap">
          {PAYMENT_MODES.map(m => (
            <button key={m} type="button" onClick={() => setMode(m)} className="px-3 py-1.5 text-xs rounded-sm border font-semibold"
              style={{ background: mode === m ? "#12312B" : "white", color: mode === m ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
              {m}
            </button>
          ))}
        </div>
      </Field>

      {mode !== "Cash" && (
        <Field label="Reference Number / UTR"><input className={inputCls} style={inputStyle} value={refNumber} onChange={e => setRefNumber(e.target.value)} placeholder="e.g. 402913827461 or cheque no." /></Field>
      )}

      <Field label="Remarks (optional)"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any note for this expense" /></Field>

      <button onClick={submit} disabled={!category.trim() || !amount} className="w-full mt-1 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Add Expense & Generate Receipt
      </button>
    </Modal>
  );
}

function NoteFormModal({ initial, onClose, onSave }) {
  const [title, setTitle] = useState(initial ? initial.title || "" : "");
  const [body, setBody] = useState(initial ? initial.body || "" : "");

  function submit() {
    if (!title.trim() && !body.trim()) return;
    onSave({ id: initial ? initial.id : null, title: title.trim(), body: body.trim() });
  }

  return (
    <Modal title={initial ? "Edit Note" : "Add Note"} onClose={onClose}>
      <div className="text-xs text-[#6E6650] mb-3">A quick note for the office — a reminder, a follow-up, anything worth writing down. This does not affect any student's fees or dues.</div>

      <Field label="Title"><input className={inputCls} style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Call Priya's parent about fee date" autoFocus /></Field>

      <Field label="Note">
        <textarea className={inputCls} style={{ ...inputStyle, minHeight: "120px", resize: "vertical" }} value={body} onChange={e => setBody(e.target.value)} placeholder="Write as much detail as you need…" />
      </Field>

      <button onClick={submit} disabled={!title.trim() && !body.trim()} className="w-full mt-1 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        {initial ? "Save Changes" : "Add Note"}
      </button>
    </Modal>
  );
}

function ReceiptModal({ deposit, student, totalRemainingDue, onClose }) {
  const receiptRef = useRef();

  const handlePrint = () => {
    const printContent = receiptRef.current.innerHTML;
    const win = window.open("", "", "width=600,height=700");
    win.document.write(`
      <html>
        <head>
          <title>Fee Receipt - Coaching Ledger</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 20px; color: #12312B; }
            .receipt-box { border: 2px solid #12312B; padding: 20px; border-radius: 4px; max-w: 400px; margin: auto; }
            .header { text-align: center; border-bottom: 2px dashed #12312B; padding-bottom: 10px; margin-bottom: 15px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
            .bold { font-weight: bold; }
            .footer { border-top: 1.5px solid #12312B; padding-top: 10px; margin-top: 15px; text-align: center; font-size: 11px; }
          </style>
        </head>
        <body><div class="receipt-box">${printContent}</div></body>
      </html>
    `);
    win.document.close(); win.focus(); win.print(); win.close();
  };

  const receiptNo = getReceiptNo(deposit.id);
  const totalCleared = Number(deposit.amount || 0) + Number(deposit.writeOffAmount || 0);
  const ref = deposit.utr || deposit.chequeNumber;

  return (
    <Modal title="Official Fee Receipt" onClose={onClose}>
      <div className="p-4 border bg-white rounded-sm mb-4" ref={receiptRef} style={{ borderColor: "#12312B" }}>
        <div className="text-center pb-3 mb-3 border-b-2 border-dashed border-[#12312B]">
          <h2 style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#12312B]">COACHING CLASSES</h2>
          <p className="text-[10px] uppercase tracking-wider text-[#9C8F6E]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Official Payment Receipt</p>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-[#6E6650]">
            <span>Receipt No: <strong className="text-[#12312B]">#{receiptNo}</strong></span>
            <span>Date: <strong className="text-[#12312B]">{fmtDate(deposit.date)}</strong></span>
          </div>
          <div className="flex justify-between text-[#6E6650]"><span>Student Name:</span><strong className="text-[#12312B]">{student ? student.name : "N/A"}</strong></div>
          <div className="flex justify-between text-[#6E6650]"><span>Class:</span><strong className="text-[#12312B]">{student ? student.class : "N/A"}</strong></div>
          <div className="flex justify-between text-[#6E6650]"><span>Payment Mode:</span><strong className="text-[#12312B]">{deposit.mode || "Cash"}</strong></div>
          {ref && <div className="flex justify-between text-[#6E6650]"><span>{deposit.utr ? "UTR / Reference:" : "Cheque No:"}</span><strong className="text-[#12312B]">{ref}</strong></div>}
          {deposit.remarks && <div className="flex justify-between text-[#6E6650]"><span>Remarks:</span><strong className="text-[#12312B]">{deposit.remarks}</strong></div>}

          <div className="pt-3 mt-3 border-t-2 border-[#12312B]">
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="font-bold">Amount Paid Today:</span>
              <span className="font-bold text-[#3F6B52] text-lg" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(deposit.amount)}</span>
            </div>
            {deposit.writeOffAmount > 0 && (
              <div className="flex justify-between items-center text-xs mb-1 text-[#8A6420]">
                <span>Discount / Write-off{deposit.writeOffRemarks ? ` (${deposit.writeOffRemarks})` : ""}:</span>
                <span className="font-semibold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(deposit.writeOffAmount)}</span>
              </div>
            )}
            {deposit.writeOffAmount > 0 && (
              <div className="flex justify-between items-center text-xs mb-1 font-semibold text-[#12312B]">
                <span>Total Cleared:</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(totalCleared)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-xs text-[#A63D2F]">
              <span>Remaining Total Balance:</span>
              <span className="font-semibold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(totalRemainingDue)}</span>
            </div>
          </div>
        </div>
        <div className="text-center pt-3 mt-3 border-t border-dashed border-[#12312B] text-[10px] text-[#9C8F6E]">
          Status: PAYMENT ACKNOWLEDGED ✅ · Computer Generated Receipt
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={handlePrint} className="flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]"><Printer size={15} /> Print Receipt</button>
        <button onClick={() => sendWhatsAppReceipt(deposit, student, totalRemainingDue)} className="flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#25D366] hover:bg-[#1DA851]"><Send size={15} /> Send to WhatsApp</button>
      </div>
    </Modal>
  );
}

// ============================================================================
// EXPENSE RECEIPT — a dedicated printable receipt for a single expense, in
// the same visual language as the fee Receipt/Statement so every printed
// document from this app reads as one consistent record system.
// ============================================================================
// ============================================================================
// BANK TRANSACTION FORM — records an internal Cash ⇄ Bank transfer. This is
// NOT money coming into or leaving the coaching center — it's moving money
// the center already has between physical Cash and the Bank/Online account.
// Withdraw from Bank: Bank Balance goes down, Cash Balance goes up.
// Deposit Cash to Bank: Cash Balance goes down, Bank Balance goes up.
// ============================================================================
function BankTxnFormModal({ onClose, onSave }) {
  const [type, setType] = useState("withdrawal");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [refType, setRefType] = useState("None");
  const [refNumber, setRefNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  function submit() {
    if (!amount || Number(amount) <= 0) return;
    onSave({
      type, amount: Number(amount) || 0, date,
      bankName: bankName.trim(), accountNumber: accountNumber.trim(),
      refType: refType !== "None" ? refType : "", refNumber: refType !== "None" ? refNumber.trim() : "",
      remarks: remarks.trim(),
    });
  }

  return (
    <Modal title="Record Cash ⇄ Bank Transfer" onClose={onClose}>
      <div className="text-xs text-[#6E6650] mb-3">Move money between physical Cash and your Bank/Online account. This does not affect student dues or center expenses — it only shifts where the center's own money is held. It gets a unique Transaction ID and only appears in the Banking tab.</div>

      <Field label="Transaction Type">
        <div className="grid grid-cols-1 gap-2">
          <button type="button" onClick={() => setType("withdrawal")} className="px-3 py-2.5 text-xs rounded-sm border font-semibold text-left flex items-center gap-2"
            style={{ background: type === "withdrawal" ? "#12312B" : "white", color: type === "withdrawal" ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
            <Banknote size={14} /> Withdraw from Bank → Cash in Hand
          </button>
          <button type="button" onClick={() => setType("deposit")} className="px-3 py-2.5 text-xs rounded-sm border font-semibold text-left flex items-center gap-2"
            style={{ background: type === "deposit" ? "#12312B" : "white", color: type === "deposit" ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
            <Landmark size={14} /> Deposit Cash → Bank Account
          </button>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₹)"><input type="number" className={inputCls} style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></Field>
        <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Bank Name"><input className={inputCls} style={inputStyle} value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. State Bank of India" /></Field>
        <Field label="Account Number"><input className={inputCls} style={inputStyle} value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="e.g. 3849201XXXXX" /></Field>
      </div>

      <Field label="Reference Type (optional)">
        <div className="flex gap-2 flex-wrap">
          {REFERENCE_TYPES.map(rt => (
            <button key={rt} type="button" onClick={() => setRefType(rt)} className="px-3 py-1.5 text-xs rounded-sm border font-semibold"
              style={{ background: refType === rt ? "#12312B" : "white", color: refType === rt ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
              {rt}
            </button>
          ))}
        </div>
      </Field>
      {refType !== "None" && (
        <Field label={refType}><input className={inputCls} style={inputStyle} value={refNumber} onChange={e => setRefNumber(e.target.value)} placeholder={`Enter ${refType.toLowerCase()}`} /></Field>
      )}

      <Field label="Remarks (optional)"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any note for this transfer" /></Field>

      <div className="p-3 rounded bg-[#FAF6EC] border text-xs mb-1" style={{ borderColor: "#D8CFB8" }}>
        {type === "withdrawal"
          ? "Bank Balance will decrease and Cash Balance will increase by this amount."
          : "Cash Balance will decrease and Bank Balance will increase by this amount."}
      </div>

      <button onClick={submit} disabled={!amount || Number(amount) <= 0} className="w-full mt-1 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Record Transfer & Generate Transaction Slip
      </button>
    </Modal>
  );
}

// ============================================================================
// BANK TRANSACTION SLIP — printable record for a single Cash ⇄ Bank transfer.
// ============================================================================
function BankTxnReceiptModal({ txn, onClose }) {
  const receiptRef = useRef();
  if (!txn) return null;
  const txnId = txn.txnId || `BTX-${shortId(txn.id)}`;
  const typeLabel = txn.type === "withdrawal" ? "Bank Withdrawal (Bank → Cash)" : "Cash Deposit to Bank (Cash → Bank)";

  const handlePrint = () => {
    const printContent = receiptRef.current.innerHTML;
    const win = window.open("", "", "width=600,height=700");
    win.document.write(`
      <html>
        <head>
          <title>Bank Transaction Slip - ${txnId}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 20px; color: #12312B; }
            .receipt-box { border: 2px solid #12312B; padding: 20px; border-radius: 4px; max-w: 400px; margin: auto; }
            .header { text-align: center; border-bottom: 2px dashed #12312B; padding-bottom: 10px; margin-bottom: 15px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
            .bold { font-weight: bold; }
            .footer { border-top: 1.5px solid #12312B; padding-top: 10px; margin-top: 15px; text-align: center; font-size: 11px; }
          </style>
        </head>
        <body><div class="receipt-box">${printContent}</div></body>
      </html>
    `);
    win.document.close(); win.focus(); win.print(); win.close();
  };

  return (
    <Modal title="Bank Transaction Slip" onClose={onClose}>
      <div className="p-4 border bg-white rounded-sm mb-4" ref={receiptRef} style={{ borderColor: "#12312B" }}>
        <div className="text-center pb-3 mb-3 border-b-2 border-dashed border-[#12312B]">
          <h2 style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#12312B]">COACHING CLASSES</h2>
          <p className="text-[10px] uppercase tracking-wider text-[#9C8F6E]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Internal Banking Transaction Slip</p>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-[#6E6650]">
            <span>Transaction ID: <strong className="text-[#12312B]">{txnId}</strong></span>
            <span>Date: <strong className="text-[#12312B]">{fmtDate(txn.date)}</strong></span>
          </div>
          <div className="flex justify-between text-[#6E6650]"><span>Type:</span><strong className="text-[#12312B]">{typeLabel}</strong></div>
          {txn.bankName && <div className="flex justify-between text-[#6E6650]"><span>Bank Name:</span><strong className="text-[#12312B]">{txn.bankName}</strong></div>}
          {txn.accountNumber && <div className="flex justify-between text-[#6E6650]"><span>Account Number:</span><strong className="text-[#12312B]">{txn.accountNumber}</strong></div>}
          {txn.refType && txn.refNumber && <div className="flex justify-between text-[#6E6650]"><span>{txn.refType}:</span><strong className="text-[#12312B]">{txn.refNumber}</strong></div>}
          {txn.remarks && <div className="flex justify-between text-[#6E6650]"><span>Remarks:</span><strong className="text-[#12312B]">{txn.remarks}</strong></div>}

          <div className="pt-3 mt-3 border-t-2 border-[#12312B]">
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="font-bold">Amount Transferred:</span>
              <span className="font-bold text-[#B8862B] text-lg" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(txn.amount)}</span>
            </div>
          </div>
        </div>
        <div className="text-center pt-3 mt-3 border-t border-dashed border-[#12312B] text-[10px] text-[#9C8F6E]">
          Internal Transfer Only — Not a Student Charge, Payment, or Center Expense · Computer Generated Slip
        </div>
      </div>
      <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]"><Printer size={15} /> Print Slip</button>
    </Modal>
  );
}

// ============================================================================
// CREDIT / LOAN LEDGER — money the center borrows from someone (Credit
// Taken) or lends to someone (Credit Given). Each entry gets a unique,
// clickable/printable Credit ID and feeds the Cash Balance / Bank Balance
// the same way a deposit or expense does. A "Pay Interest" action against
// any Credit Taken entry logs a separate, also-unique Interest Payment.
// ============================================================================
function CreditFormModal({ onClose, onSave }) {
  const [direction, setDirection] = useState("taken");
  const [partyName, setPartyName] = useState("");
  const [partyType, setPartyType] = useState("Person");
  const [address, setAddress] = useState("");
  const [mobile, setMobile] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [mode, setMode] = useState("Cash");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [refType, setRefType] = useState("None");
  const [refNumber, setRefNumber] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [remarks, setRemarks] = useState("");

  function submit() {
    if (!partyName.trim() || !amount || Number(amount) <= 0) return;
    onSave({
      direction, partyName: partyName.trim(), partyType, address: address.trim(), mobile: mobile.trim(),
      amount: Number(amount) || 0, date, mode,
      bankName: mode === "Online" ? bankName.trim() : "", accountNumber: mode === "Online" ? accountNumber.trim() : "",
      refType: mode === "Online" && refType !== "None" ? refType : "", refNumber: mode === "Online" && refType !== "None" ? refNumber.trim() : "",
      interestRate: Number(interestRate) || 0, remarks: remarks.trim(),
    });
  }

  return (
    <Modal title="Record Credit / Loan" onClose={onClose}>
      <div className="text-xs text-[#6E6650] mb-3">Log money borrowed from someone, or money lent out to someone. Gets its own unique Credit ID and shows up in the Banking Cash/Bank Balance and the Credit &amp; Loan Ledger below.</div>

      <Field label="Direction">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setDirection("taken")} className="px-3 py-2.5 text-xs rounded-sm border font-semibold text-left flex items-center gap-2"
            style={{ background: direction === "taken" ? "#12312B" : "white", color: direction === "taken" ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
            <ArrowUpRight size={14} className="rotate-180" /> Credit Taken (we borrow)
          </button>
          <button type="button" onClick={() => setDirection("given")} className="px-3 py-2.5 text-xs rounded-sm border font-semibold text-left flex items-center gap-2"
            style={{ background: direction === "given" ? "#12312B" : "white", color: direction === "given" ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
            <ArrowUpRight size={14} /> Credit Given (we lend)
          </button>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={direction === "taken" ? "Received From" : "Given To"}><input className={inputCls} style={inputStyle} value={partyName} onChange={e => setPartyName(e.target.value)} placeholder="Name of person / company / bank" /></Field>
        <Field label="Party Type">
          <select className={inputCls} style={inputStyle} value={partyType} onChange={e => setPartyType(e.target.value)}>
            {CREDIT_PARTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mobile Number"><input className={inputCls} style={inputStyle} value={mobile} onChange={e => setMobile(e.target.value)} placeholder="10-digit mobile number" /></Field>
        <Field label="Amount (₹)"><input type="number" className={inputCls} style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></Field>
      </div>
      <Field label="Address"><input className={inputCls} style={inputStyle} value={address} onChange={e => setAddress(e.target.value)} placeholder="Address of the other party" /></Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Annual Interest Rate % (optional)"><input type="number" className={inputCls} style={inputStyle} value={interestRate} onChange={e => setInterestRate(e.target.value)} placeholder="0" /></Field>
      </div>

      <Field label="Mode">
        <div className="flex gap-2 flex-wrap">
          {CREDIT_MODES.map(m => (
            <button key={m} type="button" onClick={() => setMode(m)} className="px-3 py-1.5 text-xs rounded-sm border font-semibold"
              style={{ background: mode === m ? "#12312B" : "white", color: mode === m ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
              {m}
            </button>
          ))}
        </div>
      </Field>

      {mode === "Online" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bank Name"><input className={inputCls} style={inputStyle} value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. HDFC Bank" /></Field>
            <Field label="Account Number"><input className={inputCls} style={inputStyle} value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="e.g. 5021XXXXXX" /></Field>
          </div>
          <Field label="Reference Type">
            <div className="flex gap-2 flex-wrap">
              {REFERENCE_TYPES.map(rt => (
                <button key={rt} type="button" onClick={() => setRefType(rt)} className="px-3 py-1.5 text-xs rounded-sm border font-semibold"
                  style={{ background: refType === rt ? "#12312B" : "white", color: refType === rt ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
                  {rt}
                </button>
              ))}
            </div>
          </Field>
          {refType !== "None" && (
            <Field label={refType}><input className={inputCls} style={inputStyle} value={refNumber} onChange={e => setRefNumber(e.target.value)} placeholder={`Enter ${refType.toLowerCase()}`} /></Field>
          )}
        </>
      )}

      <Field label="Remarks (optional)"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any note for this entry" /></Field>

      <div className="p-3 rounded bg-[#FAF6EC] border text-xs mb-1" style={{ borderColor: "#D8CFB8" }}>
        {direction === "taken"
          ? `${mode} Balance will increase by this amount — this is money coming in.`
          : `${mode} Balance will decrease by this amount — this is money going out.`}
      </div>

      <button onClick={submit} disabled={!partyName.trim() || !amount || Number(amount) <= 0} className="w-full mt-1 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Record Credit &amp; Generate Slip
      </button>
    </Modal>
  );
}

function CreditReceiptModal({ txn, onClose }) {
  const receiptRef = useRef();
  if (!txn) return null;
  const typeLabel = txn.direction === "taken" ? "Credit Taken (Borrowed)" : "Credit Given (Lent)";

  const handlePrint = () => {
    const printContent = receiptRef.current.innerHTML;
    const win = window.open("", "", "width=600,height=750");
    win.document.write(`
      <html>
        <head>
          <title>Credit Slip - ${txn.creditId}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 20px; color: #12312B; }
            .receipt-box { border: 2px solid #12312B; padding: 20px; border-radius: 4px; max-w: 400px; margin: auto; }
            .header { text-align: center; border-bottom: 2px dashed #12312B; padding-bottom: 10px; margin-bottom: 15px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
            .bold { font-weight: bold; }
            .footer { border-top: 1.5px solid #12312B; padding-top: 10px; margin-top: 15px; text-align: center; font-size: 11px; }
          </style>
        </head>
        <body><div class="receipt-box">${printContent}</div></body>
      </html>
    `);
    win.document.close(); win.focus(); win.print(); win.close();
  };

  return (
    <Modal title="Credit / Loan Slip" onClose={onClose}>
      <div className="p-4 border bg-white rounded-sm mb-4" ref={receiptRef} style={{ borderColor: "#12312B" }}>
        <div className="text-center pb-3 mb-3 border-b-2 border-dashed border-[#12312B]">
          <h2 style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#12312B]">COACHING CLASSES</h2>
          <p className="text-[10px] uppercase tracking-wider text-[#9C8F6E]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Credit / Loan Ledger Slip</p>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-[#6E6650]">
            <span>Credit ID: <strong className="text-[#12312B]">{txn.creditId}</strong></span>
            <span>Date: <strong className="text-[#12312B]">{fmtDate(txn.date)}</strong></span>
          </div>
          <div className="flex justify-between text-[#6E6650]"><span>Type:</span><strong className="text-[#12312B]">{typeLabel}</strong></div>
          <div className="flex justify-between text-[#6E6650]"><span>{txn.direction === "taken" ? "Received From" : "Given To"}:</span><strong className="text-[#12312B]">{txn.partyName}</strong></div>
          <div className="flex justify-between text-[#6E6650]"><span>Party Type:</span><strong className="text-[#12312B]">{txn.partyType}</strong></div>
          {txn.mobile && <div className="flex justify-between text-[#6E6650]"><span>Mobile:</span><strong className="text-[#12312B]">{txn.mobile}</strong></div>}
          {txn.address && <div className="flex justify-between text-[#6E6650]"><span>Address:</span><strong className="text-[#12312B]">{txn.address}</strong></div>}
          <div className="flex justify-between text-[#6E6650]"><span>Mode:</span><strong className="text-[#12312B]">{txn.mode}</strong></div>
          {txn.bankName && <div className="flex justify-between text-[#6E6650]"><span>Bank Name:</span><strong className="text-[#12312B]">{txn.bankName}</strong></div>}
          {txn.accountNumber && <div className="flex justify-between text-[#6E6650]"><span>Account Number:</span><strong className="text-[#12312B]">{txn.accountNumber}</strong></div>}
          {txn.refType && txn.refNumber && <div className="flex justify-between text-[#6E6650]"><span>{txn.refType}:</span><strong className="text-[#12312B]">{txn.refNumber}</strong></div>}
          {Number(txn.interestRate) > 0 && <div className="flex justify-between text-[#6E6650]"><span>Annual Interest Rate:</span><strong className="text-[#12312B]">{txn.interestRate}%</strong></div>}
          {txn.remarks && <div className="flex justify-between text-[#6E6650]"><span>Remarks:</span><strong className="text-[#12312B]">{txn.remarks}</strong></div>}

          <div className="pt-3 mt-3 border-t-2 border-[#12312B]">
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="font-bold">Amount:</span>
              <span className="font-bold text-[#B8862B] text-lg" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(txn.amount)}</span>
            </div>
          </div>
        </div>
        <div className="text-center pt-3 mt-3 border-t border-dashed border-[#12312B] text-[10px] text-[#9C8F6E]">
          Internal Credit / Loan Record · Computer Generated Slip
        </div>
      </div>
      <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]"><Printer size={15} /> Print Slip</button>
    </Modal>
  );
}

function PayInterestModal({ creditTxn, interestPaidSoFar, onClose, onSave }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [mode, setMode] = useState("Cash");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [refType, setRefType] = useState("None");
  const [refNumber, setRefNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  function submit() {
    if (!amount || Number(amount) <= 0) return;
    onSave({
      creditTxnId: creditTxn.id, amount: Number(amount) || 0, date, mode,
      bankName: mode === "Online" ? bankName.trim() : "", accountNumber: mode === "Online" ? accountNumber.trim() : "",
      refType: mode === "Online" && refType !== "None" ? refType : "", refNumber: mode === "Online" && refType !== "None" ? refNumber.trim() : "",
      remarks: remarks.trim(),
    });
  }

  return (
    <Modal title={`Pay Interest — ${creditTxn.creditId}`} onClose={onClose}>
      <div className="p-3 rounded bg-[#FAF6EC] border text-xs mb-3" style={{ borderColor: "#D8CFB8" }}>
        Against credit taken from <strong>{creditTxn.partyName}</strong> ({fmtINR(creditTxn.amount)}{Number(creditTxn.interestRate) > 0 ? ` @ ${creditTxn.interestRate}% p.a.` : ""}).
        {interestPaidSoFar > 0 && <> Interest paid so far: <strong>{fmtINR(interestPaidSoFar)}</strong>.</>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Interest Amount (₹)"><input type="number" className={inputCls} style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></Field>
        <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
      </div>

      <Field label="Mode">
        <div className="flex gap-2 flex-wrap">
          {CREDIT_MODES.map(m => (
            <button key={m} type="button" onClick={() => setMode(m)} className="px-3 py-1.5 text-xs rounded-sm border font-semibold"
              style={{ background: mode === m ? "#12312B" : "white", color: mode === m ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
              {m}
            </button>
          ))}
        </div>
      </Field>

      {mode === "Online" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bank Name"><input className={inputCls} style={inputStyle} value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. HDFC Bank" /></Field>
            <Field label="Account Number"><input className={inputCls} style={inputStyle} value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="e.g. 5021XXXXXX" /></Field>
          </div>
          <Field label="Reference Type">
            <div className="flex gap-2 flex-wrap">
              {REFERENCE_TYPES.map(rt => (
                <button key={rt} type="button" onClick={() => setRefType(rt)} className="px-3 py-1.5 text-xs rounded-sm border font-semibold"
                  style={{ background: refType === rt ? "#12312B" : "white", color: refType === rt ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
                  {rt}
                </button>
              ))}
            </div>
          </Field>
          {refType !== "None" && (
            <Field label={refType}><input className={inputCls} style={inputStyle} value={refNumber} onChange={e => setRefNumber(e.target.value)} placeholder={`Enter ${refType.toLowerCase()}`} /></Field>
          )}
        </>
      )}

      <Field label="Remarks (optional)"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any note for this interest payment" /></Field>

      <button onClick={submit} disabled={!amount || Number(amount) <= 0} className="w-full mt-1 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Pay Interest &amp; Generate Slip
      </button>
    </Modal>
  );
}

function InterestReceiptModal({ payment, creditTxn, onClose }) {
  const receiptRef = useRef();
  if (!payment) return null;

  const handlePrint = () => {
    const printContent = receiptRef.current.innerHTML;
    const win = window.open("", "", "width=600,height=700");
    win.document.write(`
      <html>
        <head>
          <title>Interest Payment Slip - ${payment.paymentId}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 20px; color: #12312B; }
            .receipt-box { border: 2px solid #12312B; padding: 20px; border-radius: 4px; max-w: 400px; margin: auto; }
            .header { text-align: center; border-bottom: 2px dashed #12312B; padding-bottom: 10px; margin-bottom: 15px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
            .bold { font-weight: bold; }
            .footer { border-top: 1.5px solid #12312B; padding-top: 10px; margin-top: 15px; text-align: center; font-size: 11px; }
          </style>
        </head>
        <body><div class="receipt-box">${printContent}</div></body>
      </html>
    `);
    win.document.close(); win.focus(); win.print(); win.close();
  };

  return (
    <Modal title="Interest Payment Slip" onClose={onClose}>
      <div className="p-4 border bg-white rounded-sm mb-4" ref={receiptRef} style={{ borderColor: "#12312B" }}>
        <div className="text-center pb-3 mb-3 border-b-2 border-dashed border-[#12312B]">
          <h2 style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#12312B]">COACHING CLASSES</h2>
          <p className="text-[10px] uppercase tracking-wider text-[#9C8F6E]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Interest Payment Slip</p>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-[#6E6650]">
            <span>Payment ID: <strong className="text-[#12312B]">{payment.paymentId}</strong></span>
            <span>Date: <strong className="text-[#12312B]">{fmtDate(payment.date)}</strong></span>
          </div>
          {creditTxn && <div className="flex justify-between text-[#6E6650]"><span>Against Credit ID:</span><strong className="text-[#12312B]">{creditTxn.creditId}</strong></div>}
          {creditTxn && <div className="flex justify-between text-[#6E6650]"><span>Paid To:</span><strong className="text-[#12312B]">{creditTxn.partyName}</strong></div>}
          <div className="flex justify-between text-[#6E6650]"><span>Mode:</span><strong className="text-[#12312B]">{payment.mode}</strong></div>
          {payment.bankName && <div className="flex justify-between text-[#6E6650]"><span>Bank Name:</span><strong className="text-[#12312B]">{payment.bankName}</strong></div>}
          {payment.accountNumber && <div className="flex justify-between text-[#6E6650]"><span>Account Number:</span><strong className="text-[#12312B]">{payment.accountNumber}</strong></div>}
          {payment.refType && payment.refNumber && <div className="flex justify-between text-[#6E6650]"><span>{payment.refType}:</span><strong className="text-[#12312B]">{payment.refNumber}</strong></div>}
          {payment.remarks && <div className="flex justify-between text-[#6E6650]"><span>Remarks:</span><strong className="text-[#12312B]">{payment.remarks}</strong></div>}

          <div className="pt-3 mt-3 border-t-2 border-[#12312B]">
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="font-bold">Interest Paid:</span>
              <span className="font-bold text-[#B8862B] text-lg" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(payment.amount)}</span>
            </div>
          </div>
        </div>
        <div className="text-center pt-3 mt-3 border-t border-dashed border-[#12312B] text-[10px] text-[#9C8F6E]">
          Computer Generated Slip
        </div>
      </div>
      <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]"><Printer size={15} /> Print Slip</button>
    </Modal>
  );
}

function ExpenseReceiptModal({ expense, onClose }) {
  const receiptRef = useRef();
  const expenseId = expense.expenseId || `EXP-${shortId(expense.id)}`;

  const handlePrint = () => {
    const printContent = receiptRef.current.innerHTML;
    const win = window.open("", "", "width=600,height=700");
    win.document.write(`
      <html>
        <head>
          <title>Expense Receipt - ${expenseId}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 20px; color: #12312B; }
            .receipt-box { border: 2px solid #12312B; padding: 20px; border-radius: 4px; max-w: 400px; margin: auto; }
            .header { text-align: center; border-bottom: 2px dashed #12312B; padding-bottom: 10px; margin-bottom: 15px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
            .bold { font-weight: bold; }
            .footer { border-top: 1.5px solid #12312B; padding-top: 10px; margin-top: 15px; text-align: center; font-size: 11px; }
          </style>
        </head>
        <body><div class="receipt-box">${printContent}</div></body>
      </html>
    `);
    win.document.close(); win.focus(); win.print(); win.close();
  };

  return (
    <Modal title="Expense Receipt" onClose={onClose}>
      <div className="p-4 border bg-white rounded-sm mb-4" ref={receiptRef} style={{ borderColor: "#12312B" }}>
        <div className="text-center pb-3 mb-3 border-b-2 border-dashed border-[#12312B]">
          <h2 style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#12312B]">COACHING CLASSES</h2>
          <p className="text-[10px] uppercase tracking-wider text-[#9C8F6E]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Official Expense Receipt</p>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-[#6E6650]">
            <span>Expense ID: <strong className="text-[#12312B]">{expenseId}</strong></span>
            <span>Date: <strong className="text-[#12312B]">{fmtDate(expense.date)}</strong></span>
          </div>
          <div className="flex justify-between text-[#6E6650]"><span>Category:</span><strong className="text-[#12312B]">{expense.category || "—"}</strong></div>
          {expense.paidTo && <div className="flex justify-between text-[#6E6650]"><span>Paid To:</span><strong className="text-[#12312B]">{expense.paidTo}</strong></div>}
          <div className="flex justify-between text-[#6E6650]"><span>Payment Mode:</span><strong className="text-[#12312B]">{expense.mode || "Cash"}</strong></div>
          {expense.refNumber && <div className="flex justify-between text-[#6E6650]"><span>Reference / UTR:</span><strong className="text-[#12312B]">{expense.refNumber}</strong></div>}
          {expense.remarks && <div className="flex justify-between text-[#6E6650]"><span>Remarks:</span><strong className="text-[#12312B]">{expense.remarks}</strong></div>}

          <div className="pt-3 mt-3 border-t-2 border-[#12312B]">
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="font-bold">Amount Paid:</span>
              <span className="font-bold text-[#A63D2F] text-lg" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(expense.amount)}</span>
            </div>
          </div>
        </div>
        <div className="text-center pt-3 mt-3 border-t border-dashed border-[#12312B] text-[10px] text-[#9C8F6E]">
          Status: EXPENSE RECORDED ✅ · Computer Generated Receipt
        </div>
      </div>
      <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]"><Printer size={15} /> Print Receipt</button>
    </Modal>
  );
}

// ============================================================================
// CHARGE RECEIPT — a printable receipt for any single debit line on a
// student's ledger (opening balance, a month's tuition, or an ad-hoc
// additional charge). Works straight off the ledger-line shape shared by
// the Additional Charges log, the Student Statement, and the Center
// Statement, so one receipt design covers all three entry points.
// ============================================================================
// ============================================================================
// JOINING FORM — a full-detail, printable (A4) record of a student's
// registration, generated on demand from the student's row. Pulls every
// field captured on the Student Register form so the center always has a
// complete, printable admission record to keep on file.
// ============================================================================
function JoiningFormModal({ student, deposits, onClose }) {
  const formRef = useRef();
  if (!student) return null;

  // The one-time Advance Payment captured on the Student form (if any) is
  // stored as a regular Deposit tagged with this exact remark — look it up
  // so the Joining Form can show what was actually collected at admission.
  const advanceDeposit = (deposits || []).find(d => d.studentId === student.id && !d.deleted && d.remarks === "Advance Payment at Admission");
  const advanceAmount = advanceDeposit ? Number(advanceDeposit.amount) || 0 : 0;
  const admissionNo = `ADM-${shortId(student.id)}`;

  const handlePrint = () => {
    const printContent = formRef.current.innerHTML;
    const win = window.open("", "", "width=900,height=1000");
    win.document.write(`
      <html>
        <head>
          <title>Joining Form - ${student.name}</title>
          <style>
            @page { size: A4; margin: 16mm; }
            body { font-family: 'Inter', sans-serif; padding: 0; color: #12312B; }
            .form-box { max-width: 100%; margin: auto; border: 1.5px solid #B8862B; padding: 22px; border-radius: 4px; }
            .form-box::before { content: ""; display: block; height: 3px; background: #12312B; margin: -22px -22px 18px -22px; }
            .admission-no { text-align: right; font-family: monospace; font-size: 11px; color: #8A6420; letter-spacing: 0.06em; margin-bottom: 4px; }
            .header { text-align: center; border-bottom: 2px dashed #12312B; padding-bottom: 12px; margin-bottom: 18px; }
            .section-title { font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #8A6420; border-bottom: 1px solid #D8CFB8; padding-bottom: 4px; margin: 18px 0 10px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; }
            .row { font-size: 13px; padding: 6px 0; border-bottom: 1px dotted #D8CFB8; display: flex; justify-content: space-between; }
            .label { color: #6E6650; }
            .value { font-weight: 600; color: #12312B; }
            .footer { border-top: 1.5px solid #12312B; padding-top: 10px; margin-top: 24px; text-align: center; font-size: 10px; color: #6E6650; }
            .sign-row { display: flex; justify-content: space-between; margin-top: 60px; font-size: 12px; }
            .sign-line { border-top: 1px solid #12312B; padding-top: 4px; width: 200px; text-align: center; }
          </style>
        </head>
        <body><div class="form-box">${printContent}</div></body>
      </html>
    `);
    win.document.close(); win.focus(); win.print(); win.close();
  };

  const statusLabel = (student.status || "active") === "active" ? "Active" : (student.status === "dropped" ? "Dropped Out" : (student.resultStatus || "On Break"));
  const statusTone = (student.status || "active") === "active" ? "paid" : student.status === "dropped" ? "overdue" : "break";

  return (
    <WideModal title="Student Joining Form" onClose={onClose}>
      <div
        className="joining-form-doc p-6 bg-white rounded-sm mb-4"
        ref={formRef}
        style={{ border: "1.5px solid #B8862B", borderRadius: "4px", boxShadow: "0 1px 3px rgba(18,49,43,0.08)" }}
      >
        <div className="text-right font-mono text-[11px] mb-1" style={{ color: "#8A6420", letterSpacing: "0.06em" }}>{admissionNo}</div>
        <div className="header">
          <h2 style={{ fontFamily: "'Zilla Slab', serif" }} className="text-2xl font-bold text-[#12312B]">COACHING CLASSES</h2>
          <p className="text-[11px] uppercase tracking-wider text-[#9C8F6E]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Student Joining / Admission Form</p>
        </div>

        <div className="section-title">Student Details</div>
        <div className="grid">
          <div className="row"><span className="label">Full Name</span><span className="value">{student.name || "—"}</span></div>
          <div className="row"><span className="label">Student ID</span><span className="value">{student.studentId || "—"}</span></div>
          <div className="row"><span className="label">Father's Name</span><span className="value">{student.fatherName || "—"}</span></div>
          <div className="row"><span className="label">Gender</span><span className="value">{student.gender || "—"}</span></div>
          <div className="row"><span className="label">Aadhar Number</span><span className="value">{student.aadharNumber || "—"}</span></div>
          <div className="row"><span className="label">Date of Birth</span><span className="value">{student.dob ? fmtDate(student.dob) : "—"}</span></div>
          <div className="row"><span className="label">Joining Date</span><span className="value">{student.joiningDate ? fmtDate(student.joiningDate) : "—"}</span></div>
          <div className="row"><span className="label">Status</span><span className="value"><Stamp text={statusLabel} tone={statusTone} /></span></div>
          <div className="row"><span className="label">Current School / Institution</span><span className="value">{student.currentSchool || "—"}</span></div>
        </div>

        <div className="section-title">Contact Details</div>
        <div className="grid">
          <div className="row"><span className="label">Phone / WhatsApp Number</span><span className="value">{student.phone || "—"}</span></div>
          <div className="row"><span className="label">Guardian Phone Number</span><span className="value">{student.guardianPhone || "—"}</span></div>
        </div>
        <div className="row"><span className="label">Address</span><span className="value">{student.address || "—"}</span></div>

        <div className="section-title">Academic Details</div>
        <div className="grid">
          <div className="row"><span className="label">Class</span><span className="value">{student.class || "—"}</span></div>
          <div className="row"><span className="label">Stream</span><span className="value">{student.stream || "—"}</span></div>
          <div className="row"><span className="label">Fee Start Month</span><span className="value">{monthLabel(student.admissionMonth)}</span></div>
          <div className="row"><span className="label">Subjects / Batches</span><span className="value">{(student.batches || []).join(", ") || "—"}</span></div>
          <div className="row"><span className="label">Monthly Concession / Discount</span><span className="value">{fmtINR(student.monthlyDiscount || 0)}</span></div>
        </div>

        <div className="section-title">Fee Details</div>
        <div className="grid">
          <div className="row"><span className="label">Opening Balance / Legacy Carried Dues</span><span className="value">{fmtINR(student.previousDues || 0)}</span></div>
          <div className="row">
            <span className="label">Advance Amount Paid at Admission</span>
            <span className="value" style={{ color: advanceAmount > 0 ? "#3F6B52" : undefined }}>
              {fmtINR(advanceAmount)}{advanceDeposit ? ` (${advanceDeposit.mode || "Cash"})` : ""}
            </span>
          </div>
          <div className="row"><span className="label">Form Generated On</span><span className="value">{fmtDate(todayStr())}</span></div>
        </div>

        <div className="sign-row">
          <div className="sign-line">Parent / Guardian Signature</div>
          <div className="sign-line">Authorized Signatory</div>
        </div>

        <div className="footer">
          Computer Generated Joining Form · Coaching Classes Admission Record · {admissionNo}
        </div>
      </div>
      <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]"><Printer size={15} /> Print Joining Form (A4)</button>
    </WideModal>
  );
}

function ChargeReceiptModal({ line, student, onClose }) {
  const receiptRef = useRef();
  if (!line) return null;

  const typeLabel = { opening: "Opening Balance (Carried Forward)", monthly_fee: "Tuition Fee", extra_charge: "Additional Charge" }[line.type] || "Charge";

  const handlePrint = () => {
    const printContent = receiptRef.current.innerHTML;
    const win = window.open("", "", "width=600,height=700");
    win.document.write(`
      <html>
        <head>
          <title>Charge Receipt - ${line.chargeId || ""}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 20px; color: #12312B; }
            .receipt-box { border: 2px solid #12312B; padding: 20px; border-radius: 4px; max-w: 400px; margin: auto; }
            .header { text-align: center; border-bottom: 2px dashed #12312B; padding-bottom: 10px; margin-bottom: 15px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
            .bold { font-weight: bold; }
            .footer { border-top: 1.5px solid #12312B; padding-top: 10px; margin-top: 15px; text-align: center; font-size: 11px; }
          </style>
        </head>
        <body><div class="receipt-box">${printContent}</div></body>
      </html>
    `);
    win.document.close(); win.focus(); win.print(); win.close();
  };

  return (
    <Modal title="Charge Receipt" onClose={onClose}>
      <div className="p-4 border bg-white rounded-sm mb-4" ref={receiptRef} style={{ borderColor: "#12312B" }}>
        <div className="text-center pb-3 mb-3 border-b-2 border-dashed border-[#12312B]">
          <h2 style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#12312B]">COACHING CLASSES</h2>
          <p className="text-[10px] uppercase tracking-wider text-[#9C8F6E]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Official Charge Receipt — {typeLabel}</p>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-[#6E6650]">
            <span>Charge ID: <strong className="text-[#12312B]">{line.chargeId}</strong></span>
            <span>Date: <strong className="text-[#12312B]">{fmtDate(line.date)}</strong></span>
          </div>
          <div className="flex justify-between text-[#6E6650]"><span>Student Name:</span><strong className="text-[#12312B]">{student ? student.name : "N/A"}</strong></div>
          <div className="flex justify-between text-[#6E6650]"><span>Class:</span><strong className="text-[#12312B]">{student ? `${student.class}` : "N/A"}</strong></div>
          {line.month && <div className="flex justify-between text-[#6E6650]"><span>For Month:</span><strong className="text-[#12312B]">{monthLabel(line.month)}</strong></div>}
          <div className="flex justify-between text-[#6E6650]"><span>Description:</span><strong className="text-[#12312B]">{line.label}</strong></div>
          {line.remarks && <div className="flex justify-between text-[#6E6650]"><span>Remarks:</span><strong className="text-[#12312B]">{line.remarks}</strong></div>}

          <div className="pt-3 mt-3 border-t-2 border-[#12312B]">
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="font-bold">Charge Amount:</span>
              <span className="font-bold text-[#B8862B] text-lg" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(line.amount)}</span>
            </div>
          </div>
        </div>
        <div className="text-center pt-3 mt-3 border-t border-dashed border-[#12312B] text-[10px] text-[#9C8F6E]">
          Computer Generated Receipt
        </div>
      </div>
      <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]"><Printer size={15} /> Print Receipt</button>
    </Modal>
  );
}
