import { compareChrono, monthLabel, monthsBetween, todayStr } from "./dates";
import { getReceiptNo, shortId } from "./ids";
import { round2 } from "./money";

export function openAdvancesFor(advances, personId, personType) {
  return (advances || [])
    .filter(a => !a.deleted && a.personId === personId && a.personType === personType && (a.status || "open") === "open" && Number(a.outstandingAmount) > 0)
    .sort((a, b) => compareChrono(a, b, 1));
}
// Walks a person's open advances oldest-first, applying `amount` across
// them — a deduction taken from a salary payment, or a direct cash return
// via the "Return Advance" form — and returns the per-advance breakdown
// (which advance, how much of it was applied, its new outstanding/status)
// plus how much of the requested amount actually got applied (in case more
// was requested than was actually outstanding). This does NOT write
// anything to Firestore itself — callers apply `applied[].newOutstanding` /
// `newStatus` via their own setDoc calls, and use the same breakdown to
// build their own settlement record (settledAdvances on a salary payment,
// or on an advance return). Used by both saveSalaryPayment() and
// saveAdvanceReturn() so the two settlement paths can never drift apart.


export function allocateAdvancePayoff(advances, personId, personType, amount) {
  let remaining = round2(Number(amount) || 0);
  const applied = [];
  const openAdvances = openAdvancesFor(advances, personId, personType);
  for (const adv of openAdvances) {
    if (remaining <= 0) break;
    const amt = Math.min(remaining, Number(adv.outstandingAmount) || 0);
    if (amt <= 0) continue;
    const newOutstanding = round2((Number(adv.outstandingAmount) || 0) - amt);
    applied.push({
      advanceId: adv.id, advanceRefId: adv.advanceId, date: adv.date, amount: round2(amt),
      newOutstanding, newStatus: newOutstanding <= 0 ? "settled" : "open",
    });
    remaining = round2(remaining - amt);
  }
  return { applied, actualApplied: round2((Number(amount) || 0) - remaining), remaining };
}
// Merges Teachers and Staff — two separate Firestore collections today —
// into one flat, selectable list for the Salary/Advance pickers, tagging
// each entry with personType so it can be written back onto the
// salaryPayments/advances record and used to look the person back up in
// either collection later (see SalaryFormModal, AdvanceFormModal,
// PersonStatementModal).


export function mergeStaffAndTeachers(teachers, staff) {
  return [
    ...(teachers || []).map(t => ({
      personId: t.id, personType: "teacher", name: t.name, displayId: t.teacherId || "",
      role: (t.expertiseSubjects || []).join(", ") || "Teacher",
      salaryAmount: t.salaryAmount || 0, paymentMode: t.paymentMode || "Cash", phone: t.phone || "",
    })),
    ...(staff || []).map(s => ({
      personId: s.id, personType: "staff", name: s.name, displayId: s.staffId || "",
      role: s.title || "Staff",
      salaryAmount: s.salaryAmount || 0, paymentMode: s.paymentMode || "Cash", phone: s.phone || "",
    })),
  ];
}
// Test ID pattern: {class}{subject}{YY}{seq} — YY is the year of the
// selected TEST DATE (not system date, so backdating into a prior year
// produces that year's sequence correctly), seq is 2-digit, scoped to
// class+subject+year, computed the same way generateStudentId scans for
// the current max and adds one. Recomputed reactively while the Test
// Marks form is open (see TestMarksTab), same "computed live, finalized
// on save" behavior as displayStudentId in StudentFormModal.
// Strips a leading "Class" word (any casing, optional space) off a class
// value before it goes into a generated Test ID — e.g. class "Class 12"
// becomes "12" for ID purposes only. The actual `class` field stored on the
// student/test record, and everywhere else it's displayed or filtered, is
// completely untouched; this only changes what generateTestId() below
// concatenates into the ID string.


export const defaultFeeStructure = (classes) => {
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


export function computeStudentLedger(student, deposits, charges, batchesForMonth, expectedFeeFor, curMonth) {
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

