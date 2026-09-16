import { todayStr } from "./dates";

export function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }


export function generateStudentId(allStudents) {
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
// Same mechanism as generateStudentId, own prefix/sequence — Teacher IDs
// never share a counter with Student IDs.


export function generateTeacherId(allTeachers) {
  const year = new Date().getFullYear();
  const prefix = `TCH${year}`;
  let max = 0;
  (allTeachers || []).forEach(t => {
    if (t && t.teacherId && t.teacherId.startsWith(prefix)) {
      const n = parseInt(t.teacherId.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
// Same mechanism again, own prefix/sequence for Other Staff.


export function generateStaffId(allStaff) {
  const year = new Date().getFullYear();
  const prefix = `STF${year}`;
  let max = 0;
  (allStaff || []).forEach(s => {
    if (s && s.staffId && s.staffId.startsWith(prefix)) {
      const n = parseInt(s.staffId.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
// Same mechanism again — Salary Slip IDs, own prefix/sequence.


export function generateSalaryId(allSalaryPayments) {
  const year = new Date().getFullYear();
  const prefix = `SAL${year}`;
  let max = 0;
  (allSalaryPayments || []).forEach(p => {
    if (p && p.slipId && p.slipId.startsWith(prefix)) {
      const n = parseInt(p.slipId.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
// Same mechanism again — Advance IDs, own prefix/sequence.


export function generateAdvanceId(allAdvances) {
  const year = new Date().getFullYear();
  const prefix = `ADV${year}`;
  let max = 0;
  (allAdvances || []).forEach(a => {
    if (a && a.advanceId && a.advanceId.startsWith(prefix)) {
      const n = parseInt(a.advanceId.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
// Same mechanism again — Advance Return IDs, own prefix/sequence. See
// UPDATE NOTES entry for the "Return Advance" feature.


export function generateAdvanceReturnId(allAdvanceReturns) {
  const year = new Date().getFullYear();
  const prefix = `ADR${year}`;
  let max = 0;
  (allAdvanceReturns || []).forEach(r => {
    if (r && r.returnId && r.returnId.startsWith(prefix)) {
      const n = parseInt(r.returnId.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
// Returns one person's OPEN advances (oldest-first), scoped by BOTH
// personId and personType — a person's advance history must never be
// matched by personId alone, since a teacher and a staff member could in
// principle share an id space collision. Shared by the Salary form's live
// outstanding-total preview, saveSalaryPayment()'s settlement loop, and
// saveAdvanceReturn()'s settlement loop, so all three can never disagree
// about which records count as "this person's open advances".


export function classCodeForId(cls) {
  return String(cls || "").trim().replace(/^class\s*/i, "");
}


export function generateTestId(allTests, cls, subject, dateStr, excludeTestId) {
  const yy = (dateStr || todayStr()).slice(2, 4);
  const prefix = `${classCodeForId(cls)}${subject || ""}${yy}`.toUpperCase();
  let max = 0;
  (allTests || []).forEach(t => {
    if (!t || !t.testId || t.testId === excludeTestId) return;
    const upperId = t.testId.toUpperCase();
    if (upperId.startsWith(prefix)) {
      const seq = parseInt(upperId.slice(prefix.length), 10);
      if (!isNaN(seq) && seq > max) max = seq;
    }
  });
  return `${prefix}${String(max + 1).padStart(2, "0")}`;
}
// Batch Schedule autofill (Attendance → Mark Attendance): only ever
// called for today's date. Compares the current real time against every
// batchSchedule record's startTime–endTime window for today's day-of-
// week; returns the single matching record, or null if zero or more than
// one match (ambiguous — leave Class/Subject for manual selection).


export function getReceiptNo(depositId) {
  return depositId ? depositId.slice(0, 8).toUpperCase() : "REC-" + Date.now().toString().slice(-4);
}

// Deterministic short code used to build a stable, readable Charge ID for
// any ledger line — ad-hoc charges get one stored at creation time, but
// recurring tuition-fee lines are computed on the fly each render, so their
// ID has to be derivable from their own (stable) raw id instead of stored.


export function shortId(str) {
  let h = 0;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
  return h.toString(36).toUpperCase().padStart(6, "0").slice(-6);
}

