import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Card, Field, Modal, SectionHeader, Stamp, inputCls, inputStyle } from "../common/UI";
import { StudentPickerField } from "../students/StudentModals";
import { compareChrono, fmtDate, todayStr } from "../../lib/dates";

export const BEHAVIOUR_TAG_META = {
  positive: { label: "Positive", tone: "paid" },
  neutral: { label: "Neutral", tone: "break" },
  "needs-attention": { label: "Needs Attention", tone: "overdue" },
};


export function BehaviourTab({ students, classes, behaviourNotes, onAdd, onEdit, onRemove }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");

  const studentById = useMemo(() => Object.fromEntries((students || []).map(s => [s.id, s])), [students]);
  const sorted = useMemo(() => [...behaviourNotes].sort((a, b) => compareChrono(a, b, -1)), [behaviourNotes]);

  const filtered = useMemo(() => sorted.filter(b => {
    const st = studentById[b.studentId];
    if (!st) return false;
    if (classFilter !== "all" && String(st.class) !== classFilter) return false;
    if (tagFilter !== "all" && b.tag !== tagFilter) return false;
    if (search) {
      const q = search.trim().toLowerCase();
      if (!(st.name || "").toLowerCase().includes(q)) return false;
    }
    return true;
  }), [sorted, studentById, classFilter, tagFilter, search]);
  const isFiltered = search || classFilter !== "all" || tagFilter !== "all";

  return (
    <div>
      <SectionHeader eyebrow="Discipline · Participation · Homework" title="Behaviour & Conduct" action={
        <button onClick={onAdd} disabled={students.length === 0} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Add Note
        </button>
      } />
      <div className="text-sm text-[#6E6650] mb-4">Short dated observations per student — discipline, participation, homework completion, etc. — each tagged Positive, Neutral, or Needs Attention.</div>

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
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Tag</div>
            <select className={inputCls} style={inputStyle} value={tagFilter} onChange={e => setTagFilter(e.target.value)}>
              <option value="all">All Tags</option>
              {Object.entries(BEHAVIOUR_TAG_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          {isFiltered && (
            <button onClick={() => { setSearch(""); setClassFilter("all"); setTagFilter("all"); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
      </Card>

      {isFiltered && (
        <div className="text-xs text-[#6E6650] mb-3">Showing {filtered.length} of {sorted.length} notes</div>
      )}
      <Card>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">{sorted.length === 0 ? "No behaviour notes logged yet." : "No notes match these filters."}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Date", "Student", "Class", "Tag", "Note", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const st = studentById[b.studentId];
                const meta = BEHAVIOUR_TAG_META[b.tag] || { label: b.tag, tone: "due" };
                return (
                  <tr key={b.id} className="ledger-row">
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(b.date)}</td>
                    <td className="px-4 py-2.5 font-medium">{st ? st.name : "—"}</td>
                    <td className="px-4 py-2.5 text-xs">{st ? st.class : "—"}</td>
                    <td className="px-4 py-2.5"><Stamp text={meta.label} tone={meta.tone} /></td>
                    <td className="px-4 py-2.5 text-xs">{b.note}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onEdit(b)} className="text-xs text-[#12312B] underline mr-3">Edit</button>
                      <button onClick={() => onRemove(b.id)} className="text-xs text-[#A63D2F] underline">Delete</button>
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

// ---- "Performance" sub-tab wrapper — same inner-pill-row pattern as
// AttendanceSectionTab / ScoresSectionTab: three panels — "Performance
// Report" (PerformanceReportTab, unchanged, individual student view),
// "Teachers Performance" (TeacherPerformanceTab, moved here from Institute
// Management — same component/props, just relocated), and "Institute
// Performance" (new — aggregate/overall view, see InstitutePerformanceTab
// below). ----


export function BehaviourFormModal({ students, initial, onClose, onSave }) {
  const [studentId, setStudentId] = useState(initial?.studentId || students[0]?.id || "");
  const [date, setDate] = useState(initial?.date || todayStr());
  const [tag, setTag] = useState(initial?.tag || "neutral");
  const [note, setNote] = useState(initial?.note || "");

  function submit() {
    if (!studentId || !date || !note.trim()) return;
    onSave({ id: initial?.id, studentId, date, tag, note: note.trim() });
  }

  return (
    <Modal title={initial ? "Edit Behaviour Note" : "Add Behaviour Note"} onClose={onClose}>
      <StudentPickerField students={students} studentId={studentId} setStudentId={setStudentId} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Tag">
          <select className={inputCls} style={inputStyle} value={tag} onChange={e => setTag(e.target.value)}>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="needs-attention">Needs Attention</option>
          </select>
        </Field>
      </div>
      <Field label="Note — discipline, participation, homework completion, etc.">
        <textarea className={inputCls} style={{ ...inputStyle, minHeight: "80px" }} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Completed homework consistently this week" />
      </Field>
      <button onClick={submit} disabled={!studentId || !date || !note.trim()} className="w-full mt-3 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        {initial ? "Save Changes" : "Add Note"}
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

