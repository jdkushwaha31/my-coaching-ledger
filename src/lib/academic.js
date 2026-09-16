import { todayStr } from "./dates";

export function findAutofillBatch(batchSchedule) {
  const now = new Date();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = dayNames[now.getDay()];
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const toMins = (t) => { if (!t) return null; const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
  const matches = (batchSchedule || []).filter(b => {
    if (!b.daysOfWeek || !b.daysOfWeek.includes(today)) return false;
    const start = toMins(b.startTime), end = toMins(b.endTime);
    if (start == null || end == null) return false;
    return nowMins >= start && nowMins <= end;
  });
  return matches.length === 1 ? matches[0] : null;
}
// Test Marks / Attendance roster resolution — "students active in this
// batch as of date X". Reuses the exact same batchHistory-by-month logic
// batchesForMonth() already uses for fee calculation (see closest
// precedent near expectedFeeFor), matched against the selected date's
// month. See UPDATE NOTES #23 for the flagged caveat: class itself is
// checked against the student's CURRENT class, since (unlike
// subjects/batches) class isn't tracked with its own per-date history.


export function studentsActiveInBatch(students, batch, dateStr, batchesForMonth) {
  if (!batch) return [];
  const mKey = (dateStr || todayStr()).slice(0, 7);
  return (students || []).filter(s => {
    if (s.deleted) return false;
    if (String(s.class) !== String(batch.class)) return false;
    const activeSubjects = batchesForMonth(s, mKey);
    return activeSubjects.includes(batch.subject);
  });
}
// Teacher Performance — deliberately isolated so the weighting is easy to
// adjust later without hunting through the rest of the file. FLAGGED AS A
// DECISION TO CONFIRM: attendance consistency and average test score are
// currently weighted 50/50 (attendanceWeight / testWeight below); each
// batch contributes to the teacher's average unweighted by class size.
// Returns null if the teacher has no batches, so the UI can show "No
// batches assigned yet" instead of a misleading 0.


export function computeTeacherPerformance(teacher, batches, attendanceRecords, tests) {
  const attendanceWeight = 0.5; // <-- confirm/tune this
  const testWeight = 0.5;       // <-- confirm/tune this
  const myBatches = (batches || []).filter(b => b.teacherId === teacher.id);
  if (!myBatches.length) return null;

  const batchBreakdown = myBatches.map(b => {
    const relevantAttendance = (attendanceRecords || []).filter(a => a.batchId === b.id);
    let presentCount = 0, totalMarks = 0;
    relevantAttendance.forEach(a => (a.records || []).forEach(r => { totalMarks++; if (r.status === "Present") presentCount++; }));
    const attendancePct = totalMarks > 0 ? (presentCount / totalMarks) * 100 : null;

    const relevantTests = (tests || []).filter(t => String(t.class) === String(b.class) && t.subject === b.subject);
    let scoreSum = 0, scoreCount = 0;
    relevantTests.forEach(t => (t.scores || []).forEach(sc => {
      if (sc.marks === "" || sc.marks == null || !t.maxMarks) return;
      scoreSum += (Number(sc.marks) / Number(t.maxMarks)) * 100; scoreCount++;
    }));
    const avgTestPct = scoreCount > 0 ? scoreSum / scoreCount : null;

    return { batch: b, attendancePct, avgTestPct };
  });

  const withAttendance = batchBreakdown.filter(b => b.attendancePct != null);
  const withTests = batchBreakdown.filter(b => b.avgTestPct != null);
  const avgAttendance = withAttendance.length ? withAttendance.reduce((a, b) => a + b.attendancePct, 0) / withAttendance.length : null;
  const avgTest = withTests.length ? withTests.reduce((a, b) => a + b.avgTestPct, 0) / withTests.length : null;

  let summaryScore = null;
  if (avgAttendance != null && avgTest != null) summaryScore = avgAttendance * attendanceWeight + avgTest * testWeight;
  else if (avgAttendance != null) summaryScore = avgAttendance;
  else if (avgTest != null) summaryScore = avgTest;

  return { summaryScore, avgAttendance, avgTest, batchBreakdown };
}

// Single source of truth for receipt numbering, so the Deposit Receipt,
// the WhatsApp receipt message, and the Student Statement always show
// the exact same receipt number for a given deposit.

