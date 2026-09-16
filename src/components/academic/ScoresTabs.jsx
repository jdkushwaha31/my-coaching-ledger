import { useEffect, useMemo, useState } from "react";
import { Award, Plus, Search } from "lucide-react";
import { Card, Field, Modal, SectionHeader, inputCls, inputStyle } from "../common/UI";
import { StudentPickerField } from "../students/StudentModals";
import { studentsActiveInBatch } from "../../lib/academic";
import { compareChrono, fmtDate, todayStr } from "../../lib/dates";
import { generateTestId } from "../../lib/ids";
import { round2 } from "../../lib/money";

export function ScoresSectionTab({ classes, subjectsList, batchSchedule, students, tests, batchesForMonth, onSave, onEdit, onDelete }) {
  const [inner, setInner] = useState("fill");
  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="border rounded-sm overflow-hidden max-w-full" style={{ borderColor: "#12312B" }}>
        <div className="flex overflow-x-auto no-scrollbar">
          <button onClick={() => setInner("fill")} className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5 shrink-0 whitespace-nowrap"
            style={{ background: inner === "fill" ? "#12312B" : "white", color: inner === "fill" ? "#F4EFDE" : "#12312B" }}>
            <Award size={13} /> Fill Marks
          </button>
          <button onClick={() => setInner("view")} className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5 shrink-0 whitespace-nowrap"
            style={{ background: inner === "view" ? "#12312B" : "white", color: inner === "view" ? "#F4EFDE" : "#12312B", borderLeft: "1px solid #12312B" }}>
            <Search size={13} /> View & Search Scores
          </button>
        </div>
        </div>
        {/* Running total — "how many tests have been completed so far". */}
        <div className="text-xs text-[#6E6650] font-medium">
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#12312B" }}>{tests.length}</span> test{tests.length === 1 ? "" : "s"} conducted so far
        </div>
      </div>
      {inner === "fill" ? (
        <TestMarksTab classes={classes} subjectsList={subjectsList} batchSchedule={batchSchedule} students={students}
          tests={tests} batchesForMonth={batchesForMonth} onSave={onSave} />
      ) : (
        <ViewScoresTab tests={tests} students={students} classes={classes} subjectsList={subjectsList}
          onSave={onSave} onEdit={onEdit} onDelete={onDelete} />
      )}
    </div>
  );
}


export function TestScoresTab({ students, classes, testScores, onAdd, onEdit, onRemove }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");

  const studentById = useMemo(() => Object.fromEntries((students || []).map(s => [s.id, s])), [students]);
  const sorted = useMemo(() => [...testScores].sort((a, b) => compareChrono(a, b, -1)), [testScores]);
  const subjectOptions = useMemo(() => Array.from(new Set(testScores.map(t => t.subject).filter(Boolean))).sort(), [testScores]);

  const filtered = useMemo(() => sorted.filter(t => {
    const st = studentById[t.studentId];
    if (!st) return false;
    if (classFilter !== "all" && String(st.class) !== classFilter) return false;
    if (subjectFilter !== "all" && t.subject !== subjectFilter) return false;
    if (search) {
      const q = search.trim().toLowerCase();
      if (!(st.name || "").toLowerCase().includes(q)) return false;
    }
    return true;
  }), [sorted, studentById, classFilter, subjectFilter, search]);
  const isFiltered = search || classFilter !== "all" || subjectFilter !== "all";

  // Class-wise average % — respects the Subject filter so a center can
  // check e.g. "average Mathematics score by class".
  const classAverages = useMemo(() => {
    const map = {};
    testScores.forEach(t => {
      const st = studentById[t.studentId];
      if (!st) return;
      if (subjectFilter !== "all" && t.subject !== subjectFilter) return;
      const max = Number(t.maxMarks) || 0;
      if (max <= 0) return;
      const cls = st.class;
      if (!map[cls]) map[cls] = { totalObtained: 0, totalMax: 0, count: 0 };
      map[cls].totalObtained += Number(t.marksObtained) || 0;
      map[cls].totalMax += max;
      map[cls].count += 1;
    });
    return Object.entries(map).map(([cls, v]) => ({
      class: cls, count: v.count, avgPct: v.totalMax > 0 ? round2((v.totalObtained / v.totalMax) * 100) : 0,
    })).sort((a, b) => (a.class || "").localeCompare(b.class || "", undefined, { numeric: true }));
  }, [testScores, studentById, subjectFilter]);

  return (
    <div>
      <SectionHeader eyebrow="Exams & Tests" title="Test Scores" action={
        <button onClick={onAdd} disabled={students.length === 0} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Add Test Score
        </button>
      } />
      <div className="text-sm text-[#6E6650] mb-4">Record test/exam name, subject, date, marks obtained, max marks, and remarks per student. See each student's score history and class-wise averages below.</div>

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
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Subject</div>
            <select className={inputCls} style={inputStyle} value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
              <option value="all">All Subjects</option>
              {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {isFiltered && (
            <button onClick={() => { setSearch(""); setClassFilter("all"); setSubjectFilter("all"); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
      </Card>

      <div className="mb-3" style={{ fontFamily: "'Zilla Slab', serif" }}><span className="text-lg font-semibold">Class-wise Average</span></div>
      <Card className="mb-6">
        {classAverages.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#9C8F6E]">No test scores recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Class", "Tests Recorded", "Average %"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classAverages.map(c => (
                <tr key={c.class} className="ledger-row">
                  <td className="px-4 py-2.5 font-semibold text-[#12312B]">{c.class}</td>
                  <td className="px-4 py-2.5 text-xs font-mono">{c.count}</td>
                  <td className="px-4 py-2.5 text-xs font-semibold font-mono" style={{ color: c.avgPct >= 40 ? "#3F6B52" : "#A63D2F" }}>{c.avgPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {isFiltered && (
        <div className="text-xs text-[#6E6650] mb-3">Showing {filtered.length} of {sorted.length} records</div>
      )}
      <Card>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">{sorted.length === 0 ? "No test scores logged yet." : "No test scores match these filters."}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Date", "Student", "Class", "Test", "Subject", "Marks", "%", "Remarks", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const st = studentById[t.studentId];
                const pct = Number(t.maxMarks) > 0 ? round2((Number(t.marksObtained) / Number(t.maxMarks)) * 100) : 0;
                return (
                  <tr key={t.id} className="ledger-row">
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(t.date)}</td>
                    <td className="px-4 py-2.5 font-medium">{st ? st.name : "—"}</td>
                    <td className="px-4 py-2.5 text-xs">{st ? st.class : "—"}</td>
                    <td className="px-4 py-2.5 text-xs">{t.testName}</td>
                    <td className="px-4 py-2.5 text-xs">{t.subject}</td>
                    <td className="px-4 py-2.5 text-xs font-mono">{t.marksObtained}/{t.maxMarks}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold font-mono" style={{ color: pct >= 40 ? "#3F6B52" : "#A63D2F" }}>{pct}%</td>
                    <td className="px-4 py-2.5 text-xs">{t.remarks || "—"}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onEdit(t)} className="text-xs text-[#12312B] underline mr-3">Edit</button>
                      <button onClick={() => onRemove(t.id)} className="text-xs text-[#A63D2F] underline">Delete</button>
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

// ---- Behaviour & Conduct — short dated notes/observations per student
// (discipline, participation, homework completion, etc.), each tagged
// positive / neutral / needs-attention. ----


export function TestMarksTab({ classes, subjectsList, batchSchedule, students, tests, batchesForMonth, onSave }) {
  const [cls, setCls] = useState("");
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState(todayStr());
  const [maxMarks, setMaxMarks] = useState("");
  const [description, setDescription] = useState("");
  const [marks, setMarks] = useState({}); // studentId -> marks
  const [loadedTestId, setLoadedTestId] = useState(null); // set once user picks an existing test to edit
  const [saved, setSaved] = useState(false);

  const testId = useMemo(() => {
    if (!cls || !subject) return "";
    return generateTestId(tests, cls, subject, date, loadedTestId);
  }, [tests, cls, subject, date, loadedTestId]);

  const matchedBatch = useMemo(() => batchSchedule.find(b => b.class === cls && b.subject === subject), [batchSchedule, cls, subject]);
  const roster = useMemo(() => matchedBatch ? studentsActiveInBatch(students, matchedBatch, date, batchesForMonth) : [], [matchedBatch, students, date, batchesForMonth]);

  const existingTestsForCombo = useMemo(() => tests.filter(t => String(t.class) === String(cls) && t.subject === subject), [tests, cls, subject]);

  useEffect(() => {
    setSaved(false);
    setLoadedTestId(null);
    if (!roster.length) { setMarks({}); return; }
    const map = {};
    roster.forEach(s => { map[s.id] = ""; });
    setMarks(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls, subject, roster.length]);

  function loadExistingTest(t) {
    setLoadedTestId(t.testId);
    setDate(t.date);
    setMaxMarks(t.maxMarks);
    setDescription(t.description || "");
    const map = {};
    roster.forEach(s => {
      const sc = (t.scores || []).find(x => x.studentId === s.id);
      map[s.id] = sc ? sc.marks : "";
    });
    setMarks(map);
  }

  function handleSave() {
    const scores = roster.map(s => ({ studentId: s.id, marks: marks[s.id] === "" ? "" : Number(marks[s.id]) }));
    onSave({ testId, class: cls, subject, date, maxMarks: Number(maxMarks) || 0, description, scores });
    setSaved(true);
    setLoadedTestId(testId);
  }

  return (
    <div>
      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Class</div>
            <select className={inputCls} style={inputStyle} value={cls} onChange={e => setCls(e.target.value)}>
              <option value="">— Select —</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Subject</div>
            <select className={inputCls} style={inputStyle} value={subject} onChange={e => setSubject(e.target.value)}>
              <option value="">— Select —</option>
              {subjectsList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Date</div>
            <input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Maximum Marks</div>
            <input type="number" className={inputCls} style={inputStyle} value={maxMarks} onChange={e => setMaxMarks(e.target.value)} placeholder="e.g. 50" />
          </div>
        </div>
        {cls && subject && (
          <div className="flex items-center justify-between mt-3 p-2 rounded bg-[#FAF6EC] border" style={{ borderColor: "#D8CFB8" }}>
            <span className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono">Test ID</span>
            <span className="text-sm font-bold text-[#12312B]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{testId}</span>
          </div>
        )}
        <div className="mt-3"><Field label="Description"><input className={inputCls} style={inputStyle} value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Unit Test 1 — Chapters 1-3" /></Field></div>
        {existingTestsForCombo.length > 0 && (
          <div className="text-[10px] text-[#9C8F6E]">
            Existing tests for this class/subject: {existingTestsForCombo.map(t => (
              <button key={t.testId} onClick={() => loadExistingTest(t)} className="underline text-[#12312B] mr-2">{t.testId} ({fmtDate(t.date)})</button>
            ))}
          </div>
        )}
      </Card>

      {cls && subject && (
        <Card>
          {!matchedBatch ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No Batch Schedule entry found for Class {cls} · {subject}. Add one under Teacher Management → Batch Schedule.</div>
          ) : roster.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No students active in this batch as of {fmtDate(date)}.</div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                    {["Student Name", "Student ID", "Marks"].map(h => (
                      <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roster.map(s => (
                    <tr key={s.id} className="ledger-row">
                      <td className="px-4 py-2.5 font-medium">{s.name}</td>
                      <td className="px-4 py-2.5 text-xs font-mono">{s.studentId}</td>
                      <td className="px-4 py-2.5">
                        <input type="number" className={inputCls + " w-28"} style={inputStyle} value={marks[s.id] ?? ""}
                          onChange={e => setMarks(prev => ({ ...prev, [s.id]: e.target.value }))} placeholder="0" max={maxMarks || undefined} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-3.5 flex items-center justify-between">
                <div className="text-[11px] text-[#9C8F6E]">{saved ? "Saved." : "Not yet saved."}</div>
                <button onClick={handleSave} className="px-4 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>Save Test Marks</button>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

// ---- View Attendance — browse/search previously saved attendanceLog
// sessions (one doc per date+class+subject). Clicking a row only expands a
// READ-ONLY view — nothing is editable there. A separate, dedicated "Edit"
// button opens an editable panel (date, time, remarks, per-student status),
// so a session can't be accidentally modified just by looking at it. Saves
// through editAttendanceLog (handles the date→doc-key move); a dedicated
// "Delete" button removes an accidentally created session outright. ----


export function ViewScoresTab({ tests, students, classes, subjectsList, onSave, onEdit, onDelete }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editMarks, setEditMarks] = useState({});
  const [editMeta, setEditMeta] = useState({ cls: "", subject: "", date: "", maxMarks: "", description: "" });
  const [sortTop, setSortTop] = useState(false);
  const [savedId, setSavedId] = useState(null);

  const studentById = useMemo(() => { const m = {}; students.forEach(s => { m[s.id] = s; }); return m; }, [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tests
      .filter(t => classFilter === "all" || String(t.class) === classFilter)
      .filter(t => subjectFilter === "all" || t.subject === subjectFilter)
      .filter(t => !dateFilter || t.date === dateFilter)
      .filter(t => {
        if (!q) return true;
        if ((t.testId || "").toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q) ||
          String(t.class).toLowerCase().includes(q) || (t.subject || "").toLowerCase().includes(q)) return true;
        return (t.scores || []).some(sc => { const s = studentById[sc.studentId]; return s && (s.name.toLowerCase().includes(q) || (s.studentId || "").toLowerCase().includes(q)); });
      })
      .sort((a, b) => compareChrono(a, b, -1));
  }, [tests, classFilter, subjectFilter, dateFilter, search, studentById]);

  function toggleView(t) {
    setExpandedId(prev => (prev === t.id ? null : t.id));
    setSortTop(false);
    if (editingId === t.id) setEditingId(null);
  }

  function startEdit(t) {
    setExpandedId(t.id);
    setEditingId(t.id);
    setSavedId(null);
    setSortTop(false);
    const map = {};
    (t.scores || []).forEach(sc => { map[sc.studentId] = sc.marks === "" || sc.marks == null ? "" : sc.marks; });
    setEditMarks(map);
    setEditMeta({ cls: t.class, subject: t.subject, date: t.date, maxMarks: t.maxMarks ?? "", description: t.description || "" });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function orderedScores(t) {
    const list = [...(t.scores || [])];
    if (!sortTop) return list;
    const marksFor = editingId === t.id ? editMarks : Object.fromEntries((t.scores || []).map(sc => [sc.studentId, sc.marks]));
    return list.sort((a, b) => (Number(marksFor[b.studentId]) || 0) - (Number(marksFor[a.studentId]) || 0));
  }

  function saveEdit(t) {
    const scores = (t.scores || []).map(sc => ({ studentId: sc.studentId, marks: editMarks[sc.studentId] === "" ? "" : Number(editMarks[sc.studentId]) }));
    onEdit(t, { cls: editMeta.cls, subject: editMeta.subject, date: editMeta.date, maxMarks: editMeta.maxMarks, description: editMeta.description, scores });
    setEditingId(null);
    setSavedId(t.id);
  }

  return (
    <div>
      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Search</div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" />
              <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Test ID, description, class, subject, or student..." />
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
        <Card className="p-6 text-center text-sm text-[#9C8F6E]">No saved tests match.</Card>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-[#6E6650]">Showing {filtered.length} of {tests.length} test{tests.length === 1 ? "" : "s"}</div>
          {filtered.map((t, i) => {
            const count = (t.scores || []).length;
            const avg = count ? round2((t.scores || []).reduce((sum, sc) => sum + (Number(sc.marks) || 0), 0) / count) : 0;
            const expanded = expandedId === t.id;
            const editing = editingId === t.id;
            return (
              <Card key={t.id} className="overflow-hidden">
                <div className="w-full flex items-center justify-between px-4 py-3">
                  <button onClick={() => toggleView(t)} className="flex-1 text-left">
                    <div className="text-sm font-semibold text-[#12312B]">
                      <span className="text-[10px] font-mono text-[#9C8F6E] mr-2">#{i + 1}</span>
                      {t.testId} — {t.class} · {t.subject}
                    </div>
                    <div className="text-[11px] text-[#9C8F6E]">{fmtDate(t.date)} · {t.description || "No description"} · {count} student{count === 1 ? "" : "s"} appeared · Avg {avg}/{t.maxMarks || 0}</div>
                  </button>
                  <div className="flex items-center gap-3 shrink-0 pl-3">
                    {savedId === t.id && !editing && <span className="text-[11px] text-[#3F6B52] font-medium">Saved.</span>}
                    <button onClick={() => startEdit(t)} className="text-xs text-[#12312B] underline font-medium">Edit</button>
                    <button onClick={() => onDelete(t.id)} className="text-xs text-[#A63D2F] underline font-medium">Delete</button>
                    <span className="text-xs text-[#9C8F6E]">{expanded ? "▾" : "▸"}</span>
                  </div>
                </div>
                {expanded && !editing && (
                  <div className="border-t" style={{ borderColor: "#D8CFB8" }}>
                    <div className="p-3.5 flex justify-end" style={{ background: "#FAF6EC" }}>
                      <button onClick={() => setSortTop(v => !v)} className="px-3 py-2 text-xs font-semibold rounded-sm flex items-center gap-1.5"
                        style={{ background: sortTop ? "#B8862B" : "white", color: sortTop ? "#F4EFDE" : "#12312B", border: "1px solid #12312B" }}>
                        <Award size={13} /> {sortTop ? "Sorted: Top Scorers" : "Sort: Top Scorers"}
                      </button>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                          {["#", "Student Name", "Student ID", "Marks"].map(h => (
                            <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {orderedScores(t).map((sc, i) => {
                          const s = studentById[sc.studentId];
                          return (
                            <tr key={sc.studentId} className="ledger-row">
                              <td className="px-4 py-2.5 text-xs font-mono text-[#9C8F6E]">{i + 1}</td>
                              <td className="px-4 py-2.5 font-medium">{s ? s.name : "Unknown Student"}</td>
                              <td className="px-4 py-2.5 text-xs font-mono">{s ? s.studentId : "—"}</td>
                              <td className="px-4 py-2.5 font-mono">{sc.marks === "" || sc.marks == null ? "—" : sc.marks}</td>
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
                      <Field label="Class">
                        <select className={inputCls} style={inputStyle} value={editMeta.cls} onChange={e => setEditMeta(prev => ({ ...prev, cls: e.target.value }))}>
                          {classes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </Field>
                      <Field label="Subject">
                        <select className={inputCls} style={inputStyle} value={editMeta.subject} onChange={e => setEditMeta(prev => ({ ...prev, subject: e.target.value }))}>
                          {subjectsList.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </Field>
                      <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={editMeta.date} onChange={e => setEditMeta(prev => ({ ...prev, date: e.target.value }))} /></Field>
                      <Field label="Maximum Marks"><input type="number" className={inputCls + " w-28"} style={inputStyle} value={editMeta.maxMarks} onChange={e => setEditMeta(prev => ({ ...prev, maxMarks: e.target.value }))} /></Field>
                      <div className="flex-1 min-w-[180px]"><Field label="Description"><input className={inputCls} style={inputStyle} value={editMeta.description} onChange={e => setEditMeta(prev => ({ ...prev, description: e.target.value }))} /></Field></div>
                      <button onClick={() => setSortTop(v => !v)} className="px-3 py-2 text-xs font-semibold rounded-sm flex items-center gap-1.5"
                        style={{ background: sortTop ? "#B8862B" : "white", color: sortTop ? "#F4EFDE" : "#12312B", border: "1px solid #12312B" }}>
                        <Award size={13} /> {sortTop ? "Sorted: Top Scorers" : "Sort: Top Scorers"}
                      </button>
                    </div>
                    {(editMeta.cls !== t.class || editMeta.subject !== t.subject || editMeta.date !== t.date) && (
                      <div className="px-3.5 pb-2 text-[11px] text-[#B8862B]">Class/Subject/Date changed — Test ID will be regenerated for the new combination on save.</div>
                    )}
                    <div className="px-3.5 pb-2 text-[11px] text-[#9C8F6E]">{(t.scores || []).length} student{(t.scores || []).length === 1 ? "" : "s"} on this test</div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                          {["#", "Student Name", "Student ID", "Marks"].map(h => (
                            <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {orderedScores(t).map((sc, i) => {
                          const s = studentById[sc.studentId];
                          return (
                            <tr key={sc.studentId} className="ledger-row">
                              <td className="px-4 py-2.5 text-xs font-mono text-[#9C8F6E]">{i + 1}</td>
                              <td className="px-4 py-2.5 font-medium">{s ? s.name : "Unknown Student"}</td>
                              <td className="px-4 py-2.5 text-xs font-mono">{s ? s.studentId : "—"}</td>
                              <td className="px-4 py-2.5">
                                <input type="number" className={inputCls + " w-28"} style={inputStyle} value={editMarks[sc.studentId] ?? ""}
                                  onChange={e => setEditMarks(prev => ({ ...prev, [sc.studentId]: e.target.value }))} placeholder="0" max={editMeta.maxMarks || undefined} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="p-3.5 flex items-center justify-end gap-2">
                      <button onClick={cancelEdit} className="px-4 py-2 text-sm font-medium rounded-sm border" style={{ borderColor: "#12312B", color: "#12312B" }}>Cancel</button>
                      <button onClick={() => saveEdit(t)} className="px-4 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>Save Changes</button>
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


export function TestScoreFormModal({ students, initial, onClose, onSave }) {
  const [studentId, setStudentId] = useState(initial?.studentId || students[0]?.id || "");
  const [testName, setTestName] = useState(initial?.testName || "");
  const [subject, setSubject] = useState(initial?.subject || "");
  const [date, setDate] = useState(initial?.date || todayStr());
  const [marksObtained, setMarksObtained] = useState(initial?.marksObtained ?? "");
  const [maxMarks, setMaxMarks] = useState(initial?.maxMarks ?? "");
  const [remarks, setRemarks] = useState(initial?.remarks || "");

  const canSubmit = studentId && testName.trim() && subject.trim() && date && marksObtained !== "" && maxMarks !== "";

  function submit() {
    if (!canSubmit) return;
    onSave({
      id: initial?.id, studentId, testName: testName.trim(), subject: subject.trim(), date,
      marksObtained: Number(marksObtained), maxMarks: Number(maxMarks), remarks: remarks.trim(),
    });
  }

  return (
    <Modal title={initial ? "Edit Test Score" : "Add Test Score"} onClose={onClose}>
      <StudentPickerField students={students} studentId={studentId} setStudentId={setStudentId} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Test / Exam Name"><input className={inputCls} style={inputStyle} value={testName} onChange={e => setTestName(e.target.value)} placeholder="e.g. Unit Test 1" /></Field>
        <Field label="Subject"><input className={inputCls} style={inputStyle} value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Mathematics" /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Marks Obtained"><input type="number" className={inputCls} style={inputStyle} value={marksObtained} onChange={e => setMarksObtained(e.target.value)} placeholder="0" /></Field>
        <Field label="Max Marks"><input type="number" className={inputCls} style={inputStyle} value={maxMarks} onChange={e => setMaxMarks(e.target.value)} placeholder="100" /></Field>
      </div>
      <Field label="Remarks (optional)"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g. Needs more practice in algebra" /></Field>
      <button onClick={submit} disabled={!canSubmit} className="w-full mt-3 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        {initial ? "Save Changes" : "Add Test Score"}
      </button>
    </Modal>
  );
}

