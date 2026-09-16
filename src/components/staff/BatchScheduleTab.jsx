import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Plus, Search } from "lucide-react";
import { Card, Field, Modal, SectionHeader, inputCls, inputStyle } from "../common/UI";
import { classCodeForId } from "../../lib/ids";

export const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];


export function BatchScheduleTab({ batchSchedule, teachers, classes, subjectsList, onAdd, onEdit, onRemove }) {
  const teacherById = Object.fromEntries(teachers.map(t => [t.id, t]));
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return batchSchedule
      .filter(b => classFilter === "all" || String(b.class) === classFilter)
      .filter(b => subjectFilter === "all" || b.subject === subjectFilter)
      .filter(b => {
        if (!q) return true;
        const teacher = teacherById[b.teacherId];
        const sub = teacherById[b.substituteTeacherId];
        const haystack = [b.batchName, b.class, b.subject, b.roomNumber, teacher?.name, sub?.name, ...(b.daysOfWeek || [])].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(q);
      });
  }, [batchSchedule, classFilter, subjectFilter, search, teacherById]);
  const isFiltered = search || classFilter !== "all" || subjectFilter !== "all";

  return (
    <div>
      <SectionHeader eyebrow="Scheduling" title="Batch Schedule" action={
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Add Batch
        </button>
      } />

      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Search</div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" />
              <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Batch name, teacher, or day..." />
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
          {isFiltered && (
            <button onClick={() => { setSearch(""); setClassFilter("all"); setSubjectFilter("all"); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
      </Card>

      {batchSchedule.length > 0 && (
        <div className="text-xs text-[#6E6650] mb-3">Showing {filtered.length} of {batchSchedule.length} batch{batchSchedule.length === 1 ? "" : "es"}</div>
      )}

      <Card>
        {batchSchedule.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">No batches scheduled yet.</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">No batches match these filters.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["#", "Batch", "Class", "Subject", "Room", "Days", "Time", "Teacher", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((b, i) => (
                <tr key={b.id} className="ledger-row">
                  <td className="px-4 py-2.5 text-xs font-mono text-[#9C8F6E]">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium">{b.batchName}</td>
                  <td className="px-4 py-2.5 text-xs">{b.class}</td>
                  <td className="px-4 py-2.5 text-xs">{b.subject}</td>
                  <td className="px-4 py-2.5 text-xs">{b.roomNumber || "—"}</td>
                  <td className="px-4 py-2.5 text-xs">{(b.daysOfWeek || []).join(", ")}</td>
                  <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{b.startTime}–{b.endTime}{b.duration ? ` (${b.duration})` : ""}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {teacherById[b.teacherId]?.name || "—"}
                    {b.substituteTeacherId && teacherById[b.substituteTeacherId] && <div className="text-[10px] text-[#9C8F6E]">Sub: {teacherById[b.substituteTeacherId].name}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => onEdit(b)} className="text-xs text-[#12312B] underline mr-3">Edit</button>
                    <button onClick={() => onRemove(b.id)} className="text-xs text-[#A63D2F] underline">Delete</button>
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


export function BatchScheduleFormModal({ classes, subjectsList, teachers, infrastructure, initial, onClose, onSave }) {
  const [batchName, setBatchName] = useState(initial?.batchName || "");
  const [cls, setCls] = useState(initial?.class || classes[0] || "");
  const [subject, setSubject] = useState(initial?.subject || subjectsList[0] || "");
  const [startTime, setStartTime] = useState(initial?.startTime || "");
  const [endTime, setEndTime] = useState(initial?.endTime || "");
  const [daysOfWeek, setDaysOfWeek] = useState(initial?.daysOfWeek || []);
  const [teacherId, setTeacherId] = useState(initial?.teacherId || "");
  const [substituteTeacherId, setSubstituteTeacherId] = useState(initial?.substituteTeacherId || "");
  const [roomNumber, setRoomNumber] = useState(initial?.roomNumber || "");
  // Room Number ↔ Infrastructure Management matching — free text still
  // works (so this never blocks a batch being saved before rooms are
  // registered), but now autocompletes from Infrastructure Management's
  // registry (via the datalist below) and shows a live match/no-match
  // indicator, so a typo like "Room 10" vs the registered "Room-10" is
  // caught immediately instead of silently creating an unlinked name.
  const roomMatch = useMemo(() => {
    const q = roomNumber.trim().toLowerCase();
    if (!q) return null;
    return (infrastructure || []).find(r => (r.name || "").trim().toLowerCase() === q) || null;
  }, [roomNumber, infrastructure]);
  // Batch Name auto-fills from Class + Subject (e.g. Class "12" + Subject
  // "Physics" -> "12 Physics"; Class "JEE" + Subject "Mathematics" -> "JEE
  // Mathematics") for as long as the user hasn't typed a custom name into
  // the field themselves. Editing an existing batch used to always start
  // "already touched" (so a custom name was never silently overwritten
  // just by opening the modal) — but that also froze a wrong AUTO-
  // generated name (e.g. picked the wrong Subject when adding) in place,
  // since correcting the Subject afterwards had no way to tell "this was
  // auto-generated and is safe to regenerate" apart from "this was typed
  // by hand and must be preserved". Now we can tell: if the saved name
  // still matches exactly what auto-fill would have produced for its own
  // original Class + Subject, it's still in "auto" state and stays live;
  // only a name that was actually customized away from that template is
  // treated as touched/locked.
  const [nameTouched, setNameTouched] = useState(() => {
    if (!initial) return false;
    const autoName = `${classCodeForId(initial.class)} ${initial.subject}`;
    return (initial.batchName || "") !== autoName;
  });

  useEffect(() => {
    if (nameTouched || !cls || !subject) return;
    setBatchName(`${classCodeForId(cls)} ${subject}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls, subject, nameTouched]);

  function toggleDay(d) { setDaysOfWeek(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]); }

  function durationLabel() {
    if (!startTime || !endTime) return "";
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  function submit() {
    if (!batchName.trim() || !teacherId) return;
    onSave({
      ...initial, id: initial?.id, batchName: batchName.trim(), class: cls, subject,
      startTime, endTime, duration: durationLabel(), daysOfWeek, teacherId,
      substituteTeacherId: substituteTeacherId || null, roomNumber: roomNumber.trim(),
    });
  }

  return (
    <Modal title={initial ? "Edit Batch" : "Add Batch"} onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Class">
          <select className={inputCls} style={inputStyle} value={cls} onChange={e => setCls(e.target.value)}>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Subject">
          <select className={inputCls} style={inputStyle} value={subject} onChange={e => setSubject(e.target.value)}>
            {subjectsList.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Batch Name"><input className={inputCls} style={inputStyle} value={batchName} onChange={e => { setBatchName(e.target.value); setNameTouched(true); }} placeholder="e.g. Morning Physics Batch" /></Field>
      {!nameTouched && <div className="text-[10px] text-[#9C8F6E] -mt-2.5 mb-3">Auto-filled from Class + Subject — type here to set a custom name.</div>}
      <Field label="Room Number">
        <input className={inputCls} style={inputStyle} value={roomNumber} onChange={e => setRoomNumber(e.target.value)}
          list="infra-room-options" placeholder="e.g. Room 204, Lab 2 — matches Infrastructure Management" />
        <datalist id="infra-room-options">
          {(infrastructure || []).map(r => <option key={r.id} value={r.name} />)}
        </datalist>
      </Field>
      {roomNumber.trim() && (infrastructure || []).length > 0 && (
        roomMatch ? (
          <div className="text-[10px] text-[#3F6B52] -mt-2.5 mb-3 flex items-center gap-1"><Check size={11} /> Matches "{roomMatch.name}" ({roomMatch.category}) in Infrastructure Management</div>
        ) : (
          <div className="text-[10px] text-[#B8862B] -mt-2.5 mb-3 flex items-center gap-1"><AlertCircle size={11} /> No matching room found in Infrastructure Management — check spelling, or add it there</div>
        )
      )}
      {roomNumber.trim() && (infrastructure || []).length === 0 && (
        <div className="text-[10px] text-[#9C8F6E] -mt-2.5 mb-3">Add rooms in Institute Management → Infrastructure Management to enable matching here.</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Start Time"><input type="time" className={inputCls} style={inputStyle} value={startTime} onChange={e => setStartTime(e.target.value)} /></Field>
        <Field label="End Time"><input type="time" className={inputCls} style={inputStyle} value={endTime} onChange={e => setEndTime(e.target.value)} /></Field>
      </div>
      {startTime && endTime && <div className="text-[10px] text-[#9C8F6E] mb-3">Duration: {durationLabel()}</div>}
      <Field label="Days of Week">
        <div className="flex flex-wrap gap-2">
          {DAYS_OF_WEEK.map(d => {
            const active = daysOfWeek.includes(d);
            return (
              <button key={d} type="button" onClick={() => toggleDay(d)} className="px-2.5 py-1 text-xs rounded-sm border"
                style={{ background: active ? "#12312B" : "white", color: active ? "#F4EFDE" : "#4A4636", borderColor: active ? "#12312B" : "#D8CFB8" }}>{d}</button>
            );
          })}
        </div>
      </Field>
      <Field label="Teacher">
        <select className={inputCls} style={inputStyle} value={teacherId} onChange={e => setTeacherId(e.target.value)}>
          <option value="">— Select Teacher —</option>
          {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <Field label="Substitute Teacher (optional)">
        <select className={inputCls} style={inputStyle} value={substituteTeacherId} onChange={e => setSubstituteTeacherId(e.target.value)}>
          <option value="">— None —</option>
          {teachers.filter(t => t.id !== teacherId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <button onClick={submit} className="w-full mt-2 py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
        {initial ? "Save Changes" : "Add Batch"}
      </button>
    </Modal>
  );
}

