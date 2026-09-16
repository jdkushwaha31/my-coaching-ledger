import React, { useMemo, useRef, useState } from "react";
import { Award, ClipboardCheck, FileBarChart2, GraduationCap, MessageSquare, Printer, Search, UserCog } from "lucide-react";
import { AttendanceSectionTab } from "./AttendanceTabs";
import { BEHAVIOUR_TAG_META, BehaviourTab } from "./BehaviourTab";
import { ScoresSectionTab } from "./ScoresTabs";
import { Card, Field, InstituteHeader, SectionHeader, Stamp, StatCard, inputCls, inputStyle } from "../common/UI";
import { FONT_IMPORT } from "../../constants/appConstants";
import { InstituteSettingsContext } from "../../contexts/InstituteSettingsContext";
import { computeTeacherPerformance } from "../../lib/academic";
import { compareChrono, fmtDate, todayStr } from "../../lib/dates";
import { round2 } from "../../lib/money";

export const ACADEMIC_MONITORING_SUB_TABS = [
  { id: "mark-attendance", label: "Attendance", icon: ClipboardCheck },
  { id: "test-marks", label: "Scores", icon: Award },
  { id: "behaviour", label: "Behaviour & Conduct", icon: MessageSquare },
  { id: "report", label: "Performance", icon: FileBarChart2 },
];


export function AcademicMonitoringTab({
  students, classes, attendance, testScores, behaviourNotes,
  onAddBehaviour, onEditBehaviour, onRemoveBehaviour,
  subjectsList, batchSchedule, attendanceLog, batchesForMonth, onSaveAttendanceLog,
  onEditAttendanceLog, onDeleteAttendanceLog,
  tests, onSaveTest, onEditTest, onDeleteTest,
  teacherPerformanceTabProps,
}) {
  const [subTab, setSubTab] = useState("mark-attendance");

  return (
    <div>
      <SectionHeader eyebrow="Academic Tracking" title="Academic Monitoring" />
      <div className="text-sm text-[#6E6650] mb-4">Attendance, test performance, and behaviour & conduct for every student — for internal review, and to print a clean parent-facing summary.</div>

      {/* Same bordered pill-row pattern as StructureTab / StudentManagementTab / BankingTab. */}
      <div className="border rounded-sm overflow-hidden mb-5 max-w-full" style={{ borderColor: "#12312B" }}>
      <div className="flex overflow-x-auto no-scrollbar">
        {ACADEMIC_MONITORING_SUB_TABS.map((st, i) => {
          const Icon = st.icon;
          const active = subTab === st.id;
          return (
            <button key={st.id} onClick={() => setSubTab(st.id)}
              className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5 shrink-0 whitespace-nowrap"
              style={{ background: active ? "#12312B" : "white", color: active ? "#F4EFDE" : "#12312B", borderLeft: i === 0 ? "none" : "1px solid #12312B" }}>
              <Icon size={13} /> {st.label}
            </button>
          );
        })}
      </div>
      </div>

      {subTab === "mark-attendance" && (
        <AttendanceSectionTab classes={classes} subjectsList={subjectsList} batchSchedule={batchSchedule} students={students}
          attendanceLog={attendanceLog} batchesForMonth={batchesForMonth} onSave={onSaveAttendanceLog}
          onEdit={onEditAttendanceLog} onDelete={onDeleteAttendanceLog} />
      )}
      {subTab === "test-marks" && (
        <ScoresSectionTab classes={classes} subjectsList={subjectsList} batchSchedule={batchSchedule} students={students}
          tests={tests} batchesForMonth={batchesForMonth} onSave={onSaveTest}
          onEdit={onEditTest} onDelete={onDeleteTest} />
      )}
      {subTab === "behaviour" && (
        <BehaviourTab students={students} classes={classes} behaviourNotes={behaviourNotes}
          onAdd={onAddBehaviour} onEdit={onEditBehaviour} onRemove={onRemoveBehaviour} />
      )}
      {subTab === "report" && (
        // UPDATE — this used to render PerformanceReportTab directly. It now
        // renders PerformanceSectionTab, which adds its own inner pill row
        // with three panels: "Performance Report" (this exact
        // PerformanceReportTab, unchanged — individual student view),
        // "Teachers Performance" (TeacherPerformanceTab, moved here from
        // Institute Management), and "Institute Performance" (new —
        // overall/aggregate view). See PerformanceSectionTab below.
        <PerformanceSectionTab students={students} attendanceLog={attendanceLog} tests={tests} behaviourNotes={behaviourNotes}
          classes={classes} subjectsList={subjectsList} teacherPerformanceTabProps={teacherPerformanceTabProps} />
      )}
    </div>
  );
}

// ---- Attendance — mark daily / class-wise attendance (Present / Absent /
// Late) per student, with a date filter and a per-student attendance %
// summary. ----


export function PerformanceSectionTab({ students, attendanceLog, tests, behaviourNotes, classes, subjectsList, teacherPerformanceTabProps }) {
  const [inner, setInner] = useState("report");
  return (
    <div>
      <div className="border rounded-sm overflow-hidden mb-4 max-w-full" style={{ borderColor: "#12312B" }}>
      <div className="flex overflow-x-auto no-scrollbar">
        <button onClick={() => setInner("report")} className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5 shrink-0 whitespace-nowrap"
          style={{ background: inner === "report" ? "#12312B" : "white", color: inner === "report" ? "#F4EFDE" : "#12312B" }}>
          <FileBarChart2 size={13} /> Performance Report
        </button>
        <button onClick={() => setInner("teachers")} className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5 shrink-0 whitespace-nowrap"
          style={{ background: inner === "teachers" ? "#12312B" : "white", color: inner === "teachers" ? "#F4EFDE" : "#12312B", borderLeft: "1px solid #12312B" }}>
          <UserCog size={13} /> Teachers Performance
        </button>
        <button onClick={() => setInner("institute")} className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5 shrink-0 whitespace-nowrap"
          style={{ background: inner === "institute" ? "#12312B" : "white", color: inner === "institute" ? "#F4EFDE" : "#12312B", borderLeft: "1px solid #12312B" }}>
          <GraduationCap size={13} /> Institute Performance
        </button>
      </div>
      </div>
      {inner === "report" && <PerformanceReportTab students={students} attendanceLog={attendanceLog} tests={tests} behaviourNotes={behaviourNotes} />}
      {inner === "teachers" && <TeacherPerformanceTab {...teacherPerformanceTabProps} />}
      {inner === "institute" && <InstitutePerformanceTab students={students} attendanceLog={attendanceLog} tests={tests} classes={classes} subjectsList={subjectsList} />}
    </div>
  );
}

// ---- Performance Report — a printable, parent-facing summary per student
// combining attendance %, recent test scores, and behaviour notes into one
// clean A4 report. Reuses the Joining Form / Center Statement print-window
// pattern: Tailwind CDN + Google Fonts loaded into the popup, A4 layout,
// letterhead style. ----


export function PerformanceReportTab({ students, attendanceLog, tests, behaviourNotes }) {
  const instituteSettings = React.useContext(InstituteSettingsContext);
  const [studentId, setStudentId] = useState(students[0]?.id || "");
  const [studentSearch, setStudentSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const reportRef = useRef();

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

  // BUGFIX — this used to read the old per-student `attendance` collection,
  // which nothing writes to anymore (Mark Attendance saves to the batch-wise
  // `attendanceLog` collection instead — see UPDATE NOTES). That made this
  // report permanently show "No data" / stale numbers regardless of new
  // attendance actually being marked. Now derived directly from
  // attendanceLog: for every saved session, pull out this student's own
  // record (if they were on that session's roster) into a flat list.
  const studentAttendanceLog = useMemo(() => {
    const rows = [];
    (attendanceLog || []).forEach(a => {
      const rec = (a.records || []).find(r => r.studentId === studentId);
      if (rec) rows.push({ id: a.id, date: a.date, createdAt: a.createdAt, status: rec.status, subject: a.subject });
    });
    return rows.sort((a, b) => compareChrono(a, b, -1));
  }, [attendanceLog, studentId]);
  const attendancePct = useMemo(() => {
    const total = studentAttendanceLog.length;
    if (!total) return null;
    const present = studentAttendanceLog.filter(a => a.status === "Present").length;
    return round2((present / total) * 100);
  }, [studentAttendanceLog]);

  // BUGFIX — same issue as attendance above: this used to read the old
  // per-student `testScores` collection, which nothing writes to anymore
  // (Fill Marks saves to the batch-wise `tests` collection instead). Now
  // derived directly from `tests`: for every saved test, pull out this
  // student's own score (if they were marked) into a flat list.
  const studentTestScores = useMemo(() => {
    const rows = [];
    (tests || []).forEach(t => {
      const sc = (t.scores || []).find(x => x.studentId === studentId);
      if (sc && sc.marks !== "" && sc.marks != null) {
        rows.push({ id: t.id, date: t.date, createdAt: t.createdAt, testId: t.testId, subject: t.subject, marksObtained: Number(sc.marks) || 0, maxMarks: Number(t.maxMarks) || 0, description: t.description });
      }
    });
    return rows.sort((a, b) => compareChrono(a, b, -1)).slice(0, 10);
  }, [tests, studentId]);
  const avgScorePct = useMemo(() => {
    if (!studentTestScores.length) return null;
    const totalObtained = studentTestScores.reduce((a, t) => a + (Number(t.marksObtained) || 0), 0);
    const totalMax = studentTestScores.reduce((a, t) => a + (Number(t.maxMarks) || 0), 0);
    return totalMax > 0 ? round2((totalObtained / totalMax) * 100) : null;
  }, [studentTestScores]);

  const studentBehaviourNotes = useMemo(() =>
    (behaviourNotes || []).filter(b => b.studentId === studentId).sort((a, b) => compareChrono(a, b, -1)).slice(0, 10),
    [behaviourNotes, studentId]
  );

  const generatedOn = fmtDate(todayStr());

  const handlePrint = () => {
    if (!student || !reportRef.current) return;
    const printContent = reportRef.current.innerHTML;
    const win = window.open("", "", "width=900,height=1000");
    // Same Tailwind CDN + Google Fonts print-popup pattern used by the
    // Joining Form and every printable statement in this app, so this
    // prints exactly like the on-screen preview instead of unstyled text.
    win.document.write(`
      <html>
        <head>
          <title>Performance Report - ${student.name}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            ${FONT_IMPORT}
            @page { size: A4; margin: 16mm; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { font-family: 'Inter', sans-serif; color: #12312B; background: #fff; margin: 0; }
            .report-doc { border: 1.5px solid #B8862B; border-radius: 4px; padding: 22px; }
            .report-doc::before { content: ""; display: block; height: 3px; background: #12312B; margin: -22px -22px 18px -22px; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
          </style>
        </head>
        <body>
          <div class="report-doc">${printContent}</div>
        </body>
      </html>
    `);
    win.document.close(); win.focus(); setTimeout(() => { win.print(); win.close(); }, 300);
  };

  return (
    <div>
      <SectionHeader eyebrow="Parent-Facing Summary" title="Performance Report" action={
        <button onClick={handlePrint} disabled={!student} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Printer size={15} /> Print / Export
        </button>
      } />
      <div className="text-sm text-[#6E6650] mb-4">A single printable A4 summary combining attendance %, recent test scores, and behaviour notes — for internal review or to hand to a parent.</div>

      <Card className="p-3.5 mb-5">
        <Field label="Select Student">
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
      </Card>

      {!student ? (
        <Card className="p-8 text-center text-sm text-[#9C8F6E]">Select a student to view their performance report.</Card>
      ) : (
        <div
          className="p-6 bg-white rounded-sm mb-4"
          ref={reportRef}
          style={{ border: "1.5px solid #B8862B", borderRadius: "4px", boxShadow: "0 1px 3px rgba(18,49,43,0.08)" }}
        >
          <div className="text-center pb-3 mb-4" style={{ borderBottom: "2px dashed #12312B" }}>
            <InstituteHeader subtitle={`Student Performance Report`} large={true} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm mb-5">
            <div className="flex justify-between border-b border-dotted py-1.5" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Student Name</span><span className="font-semibold text-[#12312B]">{student.name}</span></div>
            <div className="flex justify-between border-b border-dotted py-1.5" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Student ID</span><span className="font-semibold text-[#12312B]">{student.studentId || "—"}</span></div>
            <div className="flex justify-between border-b border-dotted py-1.5" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Class</span><span className="font-semibold text-[#12312B]">{student.class}</span></div>
            <div className="flex justify-between border-b border-dotted py-1.5" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Report Generated</span><span className="font-semibold text-[#12312B]">{generatedOn}</span></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            <div className="p-3 rounded-sm border" style={{ borderColor: "#D8CFB8" }}>
              <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Attendance</div>
              <div style={{ fontFamily: "'Zilla Slab', serif", color: attendancePct === null ? "#9C8F6E" : (attendancePct >= 75 ? "#3F6B52" : "#A63D2F") }} className="text-xl font-bold">
                {attendancePct === null ? "No data" : `${attendancePct}%`}
              </div>
              <div className="text-[11px] text-[#9C8F6E]">{studentAttendanceLog.length} session(s) recorded</div>
            </div>
            <div className="p-3 rounded-sm border" style={{ borderColor: "#D8CFB8" }}>
              <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Average Test Score</div>
              <div style={{ fontFamily: "'Zilla Slab', serif", color: avgScorePct === null ? "#9C8F6E" : (avgScorePct >= 40 ? "#3F6B52" : "#A63D2F") }} className="text-xl font-bold">
                {avgScorePct === null ? "No data" : `${avgScorePct}%`}
              </div>
              <div className="text-[11px] text-[#9C8F6E]">Based on last {studentTestScores.length} test(s)</div>
            </div>
          </div>

          <div className="font-bold text-[11px] uppercase tracking-wider mb-2" style={{ color: "#8A6420", borderBottom: "1px solid #D8CFB8", paddingBottom: "4px" }}>Recent Test Scores</div>
          {studentTestScores.length === 0 ? (
            <div className="text-xs text-[#9C8F6E] mb-4">No test scores recorded yet.</div>
          ) : (
            <table className="w-full text-xs mb-4">
              <thead>
                <tr>
                  {["Date", "Test", "Subject", "Marks", "%", "Remarks"].map(h => (
                    <th key={h} className="text-left py-1.5 uppercase tracking-wider text-[#9C8F6E]" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {studentTestScores.map(t => {
                  const pct = Number(t.maxMarks) > 0 ? round2((Number(t.marksObtained) / Number(t.maxMarks)) * 100) : 0;
                  return (
                    <tr key={t.id} style={{ borderTop: "1px dotted #E4DCC5" }}>
                      <td className="py-1.5 whitespace-nowrap">{fmtDate(t.date)}</td>
                      <td className="py-1.5 font-mono">{t.testId}</td>
                      <td className="py-1.5">{t.subject}</td>
                      <td className="py-1.5 font-mono">{t.marksObtained}/{t.maxMarks}</td>
                      <td className="py-1.5 font-mono font-semibold" style={{ color: pct >= 40 ? "#3F6B52" : "#A63D2F" }}>{pct}%</td>
                      <td className="py-1.5">{t.description || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="font-bold text-[11px] uppercase tracking-wider mb-2" style={{ color: "#8A6420", borderBottom: "1px solid #D8CFB8", paddingBottom: "4px" }}>Behaviour & Conduct Notes</div>
          {studentBehaviourNotes.length === 0 ? (
            <div className="text-xs text-[#9C8F6E] mb-4">No behaviour notes recorded yet.</div>
          ) : (
            <div className="space-y-1.5 mb-4">
              {studentBehaviourNotes.map(b => {
                const meta = BEHAVIOUR_TAG_META[b.tag] || { label: b.tag, tone: "due" };
                return (
                  <div key={b.id} className="text-xs flex items-start justify-between gap-3 py-1" style={{ borderBottom: "1px dotted #E4DCC5" }}>
                    <div><span className="font-mono text-[#9C8F6E] mr-2 whitespace-nowrap">{fmtDate(b.date)}</span>{b.note}</div>
                    <Stamp text={meta.label} tone={meta.tone} />
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-between mt-10 text-xs">
            <div style={{ borderTop: "1px solid #12312B", paddingTop: "6px", width: "200px", textAlign: "center", color: "#4A4636" }}>Parent / Guardian Signature</div>
            <div style={{ borderTop: "1px solid #12312B", paddingTop: "6px", width: "200px", textAlign: "center", color: "#4A4636" }}>Authorized Signatory</div>
          </div>

          <div className="text-center text-[10px] text-[#9C8F6E] mt-6 pt-3" style={{ borderTop: "1.5px solid #12312B" }}>
            Computer Generated Report · {instituteSettings.instituteName || "COACHING CLASSES"} Academic Monitoring
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Institute Performance — new aggregate view: overall attendance % and
// average test score % across the whole institute for a selected
// month/year, plus a By Class and By Subject breakdown. Derived directly
// from attendanceLog/tests (the same batch-wise collections everything
// else in Academic Monitoring already uses), same calculation approach as
// the Dashboard's "Institute Snapshot" tiles but with its own period
// control (not tied to the Dashboard's curMonth) and per-class/per-subject
// detail those tiles don't have room for. ----


export function InstitutePerformanceTab({ students, attendanceLog, tests, classes, subjectsList }) {
  const [periodType, setPeriodType] = useState("month");
  const [selectedMonth, setSelectedMonth] = useState(todayStr().slice(0, 7));
  const selectedYear = selectedMonth.slice(0, 4);

  const inPeriod = (dateStr) => {
    if (!dateStr) return false;
    return periodType === "month" ? dateStr.slice(0, 7) === selectedMonth : dateStr.slice(0, 4) === selectedYear;
  };

  const periodAttendance = useMemo(() => (attendanceLog || []).filter(a => inPeriod(a.date)), [attendanceLog, periodType, selectedMonth]);
  const periodTests = useMemo(() => (tests || []).filter(t => inPeriod(t.date)), [tests, periodType, selectedMonth]);

  const totalRecords = periodAttendance.reduce((n, a) => n + (a.records || []).length, 0);
  const presentRecords = periodAttendance.reduce((n, a) => n + (a.records || []).filter(r => r.status === "Present").length, 0);
  const overallAttendancePct = totalRecords > 0 ? round2((presentRecords / totalRecords) * 100) : null;

  const scoreTotals = periodTests.reduce((acc, t) => {
    (t.scores || []).forEach(sc => {
      if (sc.marks === "" || sc.marks == null) return;
      acc.obtained += Number(sc.marks) || 0;
      acc.max += Number(t.maxMarks) || 0;
    });
    return acc;
  }, { obtained: 0, max: 0 });
  const overallScorePct = scoreTotals.max > 0 ? round2((scoreTotals.obtained / scoreTotals.max) * 100) : null;

  // By Class / By Subject breakdowns — same attendance%/score% math, just
  // grouped. Only classes/subjects that actually appear in this period's
  // data are shown, so the tables don't pad out with empty rows.
  function breakdownBy(key) {
    const groups = {};
    periodAttendance.forEach(a => {
      const k = a[key];
      if (!k) return;
      if (!groups[k]) groups[k] = { total: 0, present: 0, scoreObtained: 0, scoreMax: 0, testCount: 0, sessionCount: 0 };
      groups[k].sessionCount += 1;
      groups[k].total += (a.records || []).length;
      groups[k].present += (a.records || []).filter(r => r.status === "Present").length;
    });
    periodTests.forEach(t => {
      const k = t[key];
      if (!k) return;
      if (!groups[k]) groups[k] = { total: 0, present: 0, scoreObtained: 0, scoreMax: 0, testCount: 0, sessionCount: 0 };
      groups[k].testCount += 1;
      (t.scores || []).forEach(sc => {
        if (sc.marks === "" || sc.marks == null) return;
        groups[k].scoreObtained += Number(sc.marks) || 0;
        groups[k].scoreMax += Number(t.maxMarks) || 0;
      });
    });
    return Object.entries(groups)
      .map(([k, g]) => ({
        key: k,
        attendancePct: g.total > 0 ? round2((g.present / g.total) * 100) : null,
        scorePct: g.scoreMax > 0 ? round2((g.scoreObtained / g.scoreMax) * 100) : null,
        sessionCount: g.sessionCount, testCount: g.testCount,
      }))
      .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
  }
  const byClass = useMemo(() => breakdownBy("class"), [periodAttendance, periodTests]);
  const bySubject = useMemo(() => breakdownBy("subject"), [periodAttendance, periodTests]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="text-sm text-[#6E6650]">Institute-wide attendance and test performance, aggregated across every batch.</div>
        <div className="flex items-center gap-2">
          {periodType === "month" ? (
            <input type="month" className={inputCls} style={inputStyle} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
          ) : (
            <input type="number" className={inputCls + " w-24"} style={inputStyle} value={selectedYear}
              onChange={e => setSelectedMonth(`${e.target.value.padStart(4, "0")}-${selectedMonth.slice(5, 7)}`)} />
          )}
          <div className="flex gap-1.5">
            {["month", "year"].map(p => (
              <button key={p} onClick={() => setPeriodType(p)}
                className="px-3 py-1.5 text-xs font-semibold rounded-sm border"
                style={{ background: periodType === p ? "#12312B" : "white", color: periodType === p ? "#F4EFDE" : "#12312B", borderColor: "#12312B" }}>
                {p === "month" ? "Month" : "Year"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <StatCard label="Institute Attendance" value={overallAttendancePct == null ? "—" : `${overallAttendancePct}%`}
          sub={totalRecords > 0 ? `${presentRecords}/${totalRecords} present` : "No attendance marked"}
          tone={overallAttendancePct == null ? undefined : overallAttendancePct >= 80 ? "good" : overallAttendancePct >= 60 ? "warn" : "bad"} />
        <StatCard label="Institute Avg Score" value={overallScorePct == null ? "—" : `${overallScorePct}%`}
          sub={periodTests.length > 0 ? `${periodTests.length} test${periodTests.length === 1 ? "" : "s"}` : "No tests conducted"}
          tone={overallScorePct == null ? undefined : overallScorePct >= 60 ? "good" : overallScorePct >= 40 ? "warn" : "bad"} />
        <StatCard label="Sessions Held" value={periodAttendance.length} sub="Attendance sessions this period" />
        <StatCard label="Tests Conducted" value={periodTests.length} sub="Tests this period" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <div className="px-4 py-2.5 text-sm font-semibold border-b" style={{ borderColor: "#E4DCC5" }}>By Class</div>
          {byClass.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No data for this period.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                  {["Class", "Attendance", "Avg Score", "Sessions", "Tests"].map(h => (
                    <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byClass.map(row => (
                  <tr key={row.key} className="ledger-row">
                    <td className="px-4 py-2 font-medium">{row.key}</td>
                    <td className="px-4 py-2 font-mono">{row.attendancePct == null ? "—" : `${row.attendancePct}%`}</td>
                    <td className="px-4 py-2 font-mono">{row.scorePct == null ? "—" : `${row.scorePct}%`}</td>
                    <td className="px-4 py-2 font-mono text-xs text-[#9C8F6E]">{row.sessionCount}</td>
                    <td className="px-4 py-2 font-mono text-xs text-[#9C8F6E]">{row.testCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card>
          <div className="px-4 py-2.5 text-sm font-semibold border-b" style={{ borderColor: "#E4DCC5" }}>By Subject</div>
          {bySubject.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No data for this period.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                  {["Subject", "Attendance", "Avg Score", "Sessions", "Tests"].map(h => (
                    <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bySubject.map(row => (
                  <tr key={row.key} className="ledger-row">
                    <td className="px-4 py-2 font-medium">{row.key}</td>
                    <td className="px-4 py-2 font-mono">{row.attendancePct == null ? "—" : `${row.attendancePct}%`}</td>
                    <td className="px-4 py-2 font-mono">{row.scorePct == null ? "—" : `${row.scorePct}%`}</td>
                    <td className="px-4 py-2 font-mono text-xs text-[#9C8F6E]">{row.sessionCount}</td>
                    <td className="px-4 py-2 font-mono text-xs text-[#9C8F6E]">{row.testCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// EXPENSES — a dedicated log of money going OUT of the center (rent, salary,
// materials, etc). Each expense gets a unique EXP-XXXXXX id and a printable
// receipt, mirroring how deposits and charges work. Feeds the Cash/Online
// balance tiles on the Dashboard and the master Center Statement.
// ============================================================================


export function TeacherPerformanceTab({ teachers, batches, attendanceRecords, tests }) {
  return (
    <div>
      <SectionHeader eyebrow="Staffing" title="Teacher Performance" />
      <div className="text-sm text-[#6E6650] mb-4">
        Computed from each teacher's allotted batches — attendance consistency of enrolled students and their average test scores.
        The weighting is a placeholder pending confirmation (see computeTeacherPerformance in code) — every underlying number is shown below so it's auditable, not a black box.
      </div>
      {teachers.length === 0 ? (
        <Card><div className="p-8 text-center text-sm text-[#9C8F6E]">No teachers registered yet.</div></Card>
      ) : (
        <div className="space-y-4">
          {teachers.map(t => {
            const perf = computeTeacherPerformance(t, batches, attendanceRecords, tests);
            return (
              <Card key={t.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-semibold text-[#12312B]">{t.name}</div>
                    <div className="text-[10px] text-[#9C8F6E] font-mono">{t.teacherId}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono">Summary Score</div>
                    <div className="text-xl font-bold text-[#12312B]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                      {perf && perf.summaryScore != null ? `${perf.summaryScore.toFixed(1)}%` : "—"}
                    </div>
                  </div>
                </div>
                {!perf ? (
                  <div className="text-xs text-[#9C8F6E]">No batches assigned yet.</div>
                ) : (
                  <>
                    <div className="text-xs text-[#6E6650] mb-2">Avg. Attendance: {perf.avgAttendance != null ? `${perf.avgAttendance.toFixed(1)}%` : "—"} · Avg. Test Score: {perf.avgTest != null ? `${perf.avgTest.toFixed(1)}%` : "—"}</div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ borderBottom: "1px solid #D8CFB8" }}>
                          <th className="text-left py-1.5 text-[#9C8F6E] font-mono uppercase text-[10px]">Batch</th>
                          <th className="text-left py-1.5 text-[#9C8F6E] font-mono uppercase text-[10px]">Attendance %</th>
                          <th className="text-left py-1.5 text-[#9C8F6E] font-mono uppercase text-[10px]">Avg Test %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {perf.batchBreakdown.map(bb => (
                          <tr key={bb.batch.id} className="ledger-row">
                            <td className="py-1.5">{bb.batch.batchName} (Class {bb.batch.class} · {bb.batch.subject})</td>
                            <td className="py-1.5">{bb.attendancePct != null ? `${bb.attendancePct.toFixed(1)}%` : "—"}</td>
                            <td className="py-1.5">{bb.avgTestPct != null ? `${bb.avgTestPct.toFixed(1)}%` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

