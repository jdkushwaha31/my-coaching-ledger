import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Plus, Search } from "lucide-react";
import { Card, Field, Modal, SectionHeader, Stamp, inputCls, inputStyle } from "../common/UI";
import { StudentPickerField } from "../students/StudentModals";
import { findAutofillBatch, studentsActiveInBatch } from "../../lib/academic";
import { compareChrono, fmtDate, fmtTime, nowTimeStr, todayStr } from "../../lib/dates";
import { round2 } from "../../lib/money";

export function AttendanceSectionTab({ classes, subjectsList, batchSchedule, students, attendanceLog, batchesForMonth, onSave, onEdit, onDelete }) {
  const [inner, setInner] = useState("mark");
  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="border rounded-sm overflow-hidden max-w-full" style={{ borderColor: "#12312B" }}>
        <div className="flex overflow-x-auto no-scrollbar">
          <button onClick={() => setInner("mark")} className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5 shrink-0 whitespace-nowrap"
            style={{ background: inner === "mark" ? "#12312B" : "white", color: inner === "mark" ? "#F4EFDE" : "#12312B" }}>
            <ClipboardCheck size={13} /> Mark Attendance
          </button>
          <button onClick={() => setInner("view")} className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5 shrink-0 whitespace-nowrap"
            style={{ background: inner === "view" ? "#12312B" : "white", color: inner === "view" ? "#F4EFDE" : "#12312B", borderLeft: "1px solid #12312B" }}>
            <Search size={13} /> View Attendance
          </button>
        </div>
        </div>
        {/* Running total — "how many classes' attendance has been filled so far". */}
        <div className="text-xs text-[#6E6650] font-medium">
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#12312B" }}>{attendanceLog.length}</span> attendance session{attendanceLog.length === 1 ? "" : "s"} recorded so far
        </div>
      </div>
      {inner === "mark" ? (
        <MarkAttendanceTab classes={classes} subjectsList={subjectsList} batchSchedule={batchSchedule} students={students}
          attendanceLog={attendanceLog} batchesForMonth={batchesForMonth} onSave={onSave} />
      ) : (
        <ViewAttendanceTab attendanceLog={attendanceLog} students={students} classes={classes} subjectsList={subjectsList}
          onSave={onSave} onEdit={onEdit} onDelete={onDelete} />
      )}
    </div>
  );
}

// ---- "Scores" sub-tab wrapper — same pattern as AttendanceSectionTab:
// "Fill Marks" (the existing TestMarksTab, untouched) and "View & Search
// Scores" (new — search/filter saved tests by class, subject, date, test ID,
// description, or student, sort by top scorers, and edit marks in place, see
// ViewScoresTab below). Both read/write the same "tests" collection via the
// same onSave (saveTest). ----


export function AttendanceTab({ students, classes, attendance, onAdd, onEdit, onRemove }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  const studentById = useMemo(() => Object.fromEntries((students || []).map(s => [s.id, s])), [students]);
  const sorted = useMemo(() => [...attendance].sort((a, b) => compareChrono(a, b, -1)), [attendance]);

  const matchesFilters = (a, includeDate) => {
    const st = studentById[a.studentId];
    if (!st) return false;
    if (classFilter !== "all" && String(st.class) !== classFilter) return false;
    if (includeDate && dateFilter && a.date !== dateFilter) return false;
    if (search) {
      const q = search.trim().toLowerCase();
      if (!(st.name || "").toLowerCase().includes(q)) return false;
    }
    return true;
  };

  const filtered = useMemo(() => sorted.filter(a => matchesFilters(a, true)), [sorted, studentById, classFilter, dateFilter, search]); // eslint-disable-line react-hooks/exhaustive-deps
  const isFiltered = search || classFilter !== "all" || dateFilter;

  // Per-student attendance % summary — respects the Name / Class filters,
  // but deliberately ignores the Date filter so it always reflects the
  // student's full attendance history, not just one day.
  const summary = useMemo(() => {
    const map = {};
    attendance.forEach(a => {
      if (!matchesFilters(a, false)) return;
      if (!map[a.studentId]) map[a.studentId] = { student: studentById[a.studentId], present: 0, absent: 0, late: 0, total: 0 };
      map[a.studentId].total += 1;
      if (a.status === "Present") map[a.studentId].present += 1;
      else if (a.status === "Late") map[a.studentId].late += 1;
      else map[a.studentId].absent += 1;
    });
    return Object.values(map).sort((a, b) => (a.student.name || "").localeCompare(b.student.name || ""));
  }, [attendance, studentById, classFilter, search]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <SectionHeader eyebrow="Daily / Class-wise" title="Attendance" action={
        <button onClick={onAdd} disabled={students.length === 0} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Mark Attendance
        </button>
      } />
      <div className="text-sm text-[#6E6650] mb-4">Mark Present / Absent / Late per student. Filter by date to review a single day — the attendance % summary below always reflects each student's full history.</div>

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
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Date</div>
            <input type="date" className={inputCls} style={inputStyle} value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
          </div>
          {isFiltered && (
            <button onClick={() => { setSearch(""); setClassFilter("all"); setDateFilter(""); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
      </Card>

      <div className="mb-3" style={{ fontFamily: "'Zilla Slab', serif" }}><span className="text-lg font-semibold">Attendance % Summary</span></div>
      <Card className="mb-6">
        {summary.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#9C8F6E]">No attendance recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Student", "Class", "Present", "Absent", "Late", "Total Days", "Attendance %"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.map(s => {
                const pct = s.total > 0 ? round2(((s.present + s.late) / s.total) * 100) : 0;
                return (
                  <tr key={s.student.id} className="ledger-row">
                    <td className="px-4 py-2.5 font-medium">{s.student.name}</td>
                    <td className="px-4 py-2.5 text-xs">{s.student.class}</td>
                    <td className="px-4 py-2.5 text-xs text-[#3F6B52] font-mono">{s.present}</td>
                    <td className="px-4 py-2.5 text-xs text-[#A63D2F] font-mono">{s.absent}</td>
                    <td className="px-4 py-2.5 text-xs text-[#B8862B] font-mono">{s.late}</td>
                    <td className="px-4 py-2.5 text-xs font-mono">{s.total}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold font-mono" style={{ color: pct >= 75 ? "#3F6B52" : "#A63D2F" }}>{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {isFiltered && (
        <div className="text-xs text-[#6E6650] mb-3">Showing {filtered.length} of {sorted.length} records</div>
      )}
      <Card>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">{sorted.length === 0 ? "No attendance records yet." : "No attendance records match these filters."}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Date", "Student", "Class", "Status", "Remarks", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const st = studentById[a.studentId];
                const tone = a.status === "Present" ? "paid" : a.status === "Late" ? "due" : "overdue";
                return (
                  <tr key={a.id} className="ledger-row">
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(a.date)}</td>
                    <td className="px-4 py-2.5 font-medium">{st ? st.name : "—"}</td>
                    <td className="px-4 py-2.5 text-xs">{st ? st.class : "—"}</td>
                    <td className="px-4 py-2.5"><Stamp text={a.status} tone={tone} /></td>
                    <td className="px-4 py-2.5 text-xs">{a.remarks || "—"}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onEdit(a)} className="text-xs text-[#12312B] underline mr-3">Edit</button>
                      <button onClick={() => onRemove(a.id)} className="text-xs text-[#A63D2F] underline">Delete</button>
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

// ---- Test Scores — test/exam name, subject, date, marks, remarks per
// student, with a per-student score history and class-wise average. ----


export function MarkAttendanceTab({ classes, subjectsList, batchSchedule, students, attendanceLog, batchesForMonth, onSave }) {
  const [date, setDate] = useState(todayStr());
  const [cls, setCls] = useState("");
  const [subject, setSubject] = useState("");
  const [userOverrode, setUserOverrode] = useState(false);
  const [statuses, setStatuses] = useState({}); // studentId -> "Present" | "Absent"
  const [remarks, setRemarks] = useState("");
  const [saved, setSaved] = useState(false);

  // Autofill — only for today's date, only if exactly one Batch Schedule
  // window matches right now, and only until the user manually overrides
  // Class/Subject themselves.
  useEffect(() => {
    if (date !== todayStr() || userOverrode) return;
    const match = findAutofillBatch(batchSchedule);
    if (match) { setCls(match.class); setSubject(match.subject); }
  }, [date, batchSchedule, userOverrode]);

  const matchedBatch = useMemo(() => batchSchedule.find(b => b.class === cls && b.subject === subject), [batchSchedule, cls, subject]);
  const roster = useMemo(() => matchedBatch ? studentsActiveInBatch(students, matchedBatch, date, batchesForMonth) : [], [matchedBatch, students, date, batchesForMonth]);

  const docKey = `${date}_${cls}_${subject}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  const existingDoc = attendanceLog.find(a => a.id === docKey);

  useEffect(() => {
    setSaved(false);
    setRemarks(existingDoc?.remarks || "");
    if (!roster.length) { setStatuses({}); return; }
    const map = {};
    roster.forEach(s => {
      const existingRecord = existingDoc?.records?.find(r => r.studentId === s.id);
      map[s.id] = existingRecord ? existingRecord.status : "Absent"; // defaults to Absent
    });
    setStatuses(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey, roster.length]);

  function toggle(studentId) {
    setStatuses(prev => ({ ...prev, [studentId]: prev[studentId] === "Present" ? "Absent" : "Present" }));
  }

  function handleSave() {
    const records = roster.map(s => ({ studentId: s.id, status: statuses[s.id] || "Absent" }));
    // Time is captured once, at the moment attendance is first saved for
    // this session — re-saving (e.g. after fixing a status) keeps the
    // originally recorded time (see saveAttendanceLog); it's only ever
    // changed afterward through View Attendance's dedicated Edit.
    onSave(date, cls, subject, matchedBatch?.id || null, records, existingDoc?.time || nowTimeStr(), remarks);
    setSaved(true);
  }

  return (
    <div>
      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Date</div>
            <input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => { setDate(e.target.value); setUserOverrode(false); }} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Class</div>
            <select className={inputCls} style={inputStyle} value={cls} onChange={e => { setCls(e.target.value); setUserOverrode(true); }}>
              <option value="">— Select —</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Subject</div>
            <select className={inputCls} style={inputStyle} value={subject} onChange={e => { setSubject(e.target.value); setUserOverrode(true); }}>
              <option value="">— Select —</option>
              {subjectsList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {cls && subject && (
            <div className="min-w-[200px] flex-1">
              <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Remarks (optional)</div>
              <input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g. Half-day, exam prep session…" />
            </div>
          )}
        </div>
        {date === todayStr() && matchedBatch && !userOverrode && (
          <div className="text-[10px] text-[#3F6B52] mt-2 font-medium">Auto-filled from Batch Schedule: {matchedBatch.batchName}</div>
        )}
      </Card>

      {cls && subject && (
        <Card>
          {!matchedBatch ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No Batch Schedule entry found for Class {cls} · {subject}. Add one under Teacher Management → Batch Schedule.</div>
          ) : roster.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No students enrolled in this batch for {fmtDate(date)}.</div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                    {["Student Name", "Student ID", "Status"].map(h => (
                      <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roster.map(s => {
                    const present = statuses[s.id] === "Present";
                    return (
                      <tr key={s.id} className="ledger-row">
                        <td className="px-4 py-2.5 font-medium">{s.name}</td>
                        <td className="px-4 py-2.5 text-xs font-mono">{s.studentId}</td>
                        <td className="px-4 py-2.5">
                          <button onClick={() => toggle(s.id)} className="px-3 py-1 text-xs font-semibold rounded-sm"
                            style={{ background: present ? "#3F6B52" : "#A63D2F", color: "#F4EFDE" }}>
                            {present ? "Present" : "Absent"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="p-3.5 flex items-center justify-between">
                <div className="text-[11px] text-[#9C8F6E]">
                  {saved ? "Saved." : existingDoc ? "Editing a previously saved record." : "Not yet saved."}
                  {existingDoc?.time && <span> · Recorded at {fmtTime(existingDoc.time)}</span>}
                </div>
                <button onClick={handleSave} className="px-4 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>Save Attendance</button>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}


export function ViewAttendanceTab({ attendanceLog, students, classes, subjectsList, onSave, onEdit, onDelete }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editRemarks, setEditRemarks] = useState("");
  const [editStatuses, setEditStatuses] = useState({});
  const [savedId, setSavedId] = useState(null);

  const studentById = useMemo(() => { const m = {}; students.forEach(s => { m[s.id] = s; }); return m; }, [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return attendanceLog
      .filter(a => classFilter === "all" || a.class === classFilter)
      .filter(a => subjectFilter === "all" || a.subject === subjectFilter)
      .filter(a => !dateFilter || a.date === dateFilter)
      .filter(a => {
        if (!q) return true;
        if (String(a.class).toLowerCase().includes(q) || String(a.subject).toLowerCase().includes(q) || (a.remarks || "").toLowerCase().includes(q)) return true;
        return (a.records || []).some(r => { const s = studentById[r.studentId]; return s && (s.name.toLowerCase().includes(q) || (s.studentId || "").toLowerCase().includes(q)); });
      })
      .sort((a, b) => compareChrono(a, b, -1));
  }, [attendanceLog, classFilter, subjectFilter, dateFilter, search, studentById]);

  function toggleView(a) {
    setExpandedId(prev => (prev === a.id ? null : a.id));
    if (editingId === a.id) setEditingId(null);
  }

  function startEdit(a) {
    setExpandedId(a.id);
    setEditingId(a.id);
    setSavedId(null);
    setEditDate(a.date);
    setEditTime(a.time || nowTimeStr());
    setEditRemarks(a.remarks || "");
    const map = {};
    (a.records || []).forEach(r => { map[r.studentId] = r.status; });
    setEditStatuses(map);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function toggleStatus(studentId) {
    setEditStatuses(prev => ({ ...prev, [studentId]: prev[studentId] === "Present" ? "Absent" : "Present" }));
  }

  function saveEdit(a) {
    const records = (a.records || []).map(r => ({ studentId: r.studentId, status: editStatuses[r.studentId] || "Absent" }));
    onEdit(a, { date: editDate, time: editTime, remarks: editRemarks, records });
    setEditingId(null);
    setExpandedId(editDate === a.date ? a.id : `${editDate}_${a.class}_${a.subject}`.replace(/[^a-zA-Z0-9_-]/g, "-"));
    setSavedId(a.id);
  }

  return (
    <div>
      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Search</div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" />
              <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Class, subject, remarks, or student..." />
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Class</div>
            <select className={inputCls} style={inputStyle} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
              <option value="all">All Classes</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Subject</div>
            <select className={inputCls} style={inputStyle} value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
              <option value="all">All Subjects</option>
              {subjectsList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Date</div>
            <input type="date" className={inputCls} style={inputStyle} value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-[#9C8F6E]">No saved attendance sessions match.</Card>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-[#6E6650]">Showing {filtered.length} of {attendanceLog.length} attendance session{attendanceLog.length === 1 ? "" : "s"}</div>
          {filtered.map((a, i) => {
            const total = (a.records || []).length;
            const present = (a.records || []).filter(r => r.status === "Present").length;
            const expanded = expandedId === a.id;
            const editing = editingId === a.id;
            return (
              <Card key={a.id} className="overflow-hidden">
                <div className="w-full flex items-center justify-between px-4 py-3">
                  <button onClick={() => toggleView(a)} className="flex-1 text-left">
                    <div className="text-sm font-semibold text-[#12312B]">
                      <span className="text-[10px] font-mono text-[#9C8F6E] mr-2">#{i + 1}</span>
                      {a.class} · {a.subject}
                    </div>
                    <div className="text-[11px] text-[#9C8F6E]">
                      {fmtDate(a.date)}{a.time && ` · ${fmtTime(a.time)}`} · {present}/{total} present{a.remarks && ` · ${a.remarks}`}
                    </div>
                  </button>
                  <div className="flex items-center gap-3 shrink-0 pl-3">
                    {savedId === a.id && !editing && <span className="text-[11px] text-[#3F6B52] font-medium">Saved.</span>}
                    <button onClick={() => startEdit(a)} className="text-xs text-[#12312B] underline font-medium">Edit</button>
                    <button onClick={() => onDelete(a.id)} className="text-xs text-[#A63D2F] underline font-medium">Delete</button>
                    <span className="text-xs text-[#9C8F6E]">{expanded ? "▾" : "▸"}</span>
                  </div>
                </div>
                {expanded && !editing && (
                  <div className="border-t" style={{ borderColor: "#D8CFB8" }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                          {["Student Name", "Student ID", "Status"].map(h => (
                            <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(a.records || []).map(r => {
                          const s = studentById[r.studentId];
                          const isPresent = r.status === "Present";
                          return (
                            <tr key={r.studentId} className="ledger-row">
                              <td className="px-4 py-2.5 font-medium">{s ? s.name : "Unknown Student"}</td>
                              <td className="px-4 py-2.5 text-xs font-mono">{s ? s.studentId : "—"}</td>
                              <td className="px-4 py-2.5">
                                <span className="px-3 py-1 text-xs font-semibold rounded-sm inline-block"
                                  style={{ background: isPresent ? "#3F6B52" : "#A63D2F", color: "#F4EFDE" }}>
                                  {r.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="px-4 py-2.5 text-[11px] text-[#9C8F6E]">Read-only — click Edit above to make changes.</div>
                  </div>
                )}
                {editing && (
                  <div className="border-t" style={{ borderColor: "#D8CFB8" }}>
                    <div className="p-3.5 flex flex-wrap items-end gap-3" style={{ background: "#FAF6EC" }}>
                      <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={editDate} onChange={e => setEditDate(e.target.value)} /></Field>
                      <Field label="Time"><input type="time" className={inputCls} style={inputStyle} value={editTime} onChange={e => setEditTime(e.target.value)} /></Field>
                      <div className="flex-1 min-w-[200px]"><Field label="Remarks"><input className={inputCls} style={inputStyle} value={editRemarks} onChange={e => setEditRemarks(e.target.value)} placeholder="Optional remarks…" /></Field></div>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                          {["Student Name", "Student ID", "Status"].map(h => (
                            <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(a.records || []).map(r => {
                          const s = studentById[r.studentId];
                          const isPresent = editStatuses[r.studentId] === "Present";
                          return (
                            <tr key={r.studentId} className="ledger-row">
                              <td className="px-4 py-2.5 font-medium">{s ? s.name : "Unknown Student"}</td>
                              <td className="px-4 py-2.5 text-xs font-mono">{s ? s.studentId : "—"}</td>
                              <td className="px-4 py-2.5">
                                <button onClick={() => toggleStatus(r.studentId)} className="px-3 py-1 text-xs font-semibold rounded-sm"
                                  style={{ background: isPresent ? "#3F6B52" : "#A63D2F", color: "#F4EFDE" }}>
                                  {isPresent ? "Present" : "Absent"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="p-3.5 flex items-center justify-end gap-2">
                      <button onClick={cancelEdit} className="px-4 py-2 text-sm font-medium rounded-sm border" style={{ borderColor: "#12312B", color: "#12312B" }}>Cancel</button>
                      <button onClick={() => saveEdit(a)} className="px-4 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>Save Changes</button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- View & Search Scores — browse saved tests (the "tests" collection
// TestMarksTab writes to) with search across test ID / description / class /
// subject / student, plus class/subject/date filters, and a "Top Scorers"
// sort. Clicking a row only expands a READ-ONLY view. A separate, dedicated
// "Edit" button opens an editable panel (class, subject, date, max marks,
// description, and every student's marks) so a test can't be accidentally
// modified just by looking at it. Saves through editTest (renames the
// generated testId in place if class/subject/date changed, without leaving
// a duplicate); a dedicated "Delete" button removes an accidentally created
// test outright.


export function AttendanceFormModal({ students, initial, onClose, onSave }) {
  const [studentId, setStudentId] = useState(initial?.studentId || students[0]?.id || "");
  const [date, setDate] = useState(initial?.date || todayStr());
  const [status, setStatus] = useState(initial?.status || "Present");
  const [remarks, setRemarks] = useState(initial?.remarks || "");

  function submit() {
    if (!studentId || !date) return;
    onSave({ id: initial?.id, studentId, date, status, remarks: remarks.trim() });
  }

  return (
    <Modal title={initial ? "Edit Attendance" : "Mark Attendance"} onClose={onClose}>
      <StudentPickerField students={students} studentId={studentId} setStudentId={setStudentId} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Status">
          <select className={inputCls} style={inputStyle} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="Present">Present</option>
            <option value="Absent">Absent</option>
            <option value="Late">Late</option>
          </select>
        </Field>
      </div>
      <Field label="Remarks (optional)"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g. Left early, informed in advance" /></Field>
      <button onClick={submit} disabled={!studentId || !date} className="w-full mt-3 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        {initial ? "Save Changes" : "Mark Attendance"}
      </button>
    </Modal>
  );
}

