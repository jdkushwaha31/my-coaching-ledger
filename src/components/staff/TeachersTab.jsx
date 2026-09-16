import React, { useMemo, useState } from "react";
import { Banknote, CalendarCheck, Check, FileText, Landmark, Plus, Search, UserCog, Users, Wallet, X } from "lucide-react";
import { Card, Field, Modal, SectionHeader, Stamp, WideModal, inputCls, inputStyle } from "../common/UI";
import { BatchScheduleTab } from "./BatchScheduleTab";
import { InfrastructureTab } from "./InfrastructureTab";
import { AdvanceTab, SalaryTab } from "./SalaryAdvanceTab";
import { StaffTab } from "./StaffTab";
import { PAYMENT_MODES } from "../../constants/appConstants";
import { compareChrono, fmtDate, todayStr } from "../../lib/dates";
import { generateTeacherId } from "../../lib/ids";
import { fmtINR } from "../../lib/money";

export const TEACHER_MANAGEMENT_SUB_TABS = [
  { id: "teachers", label: "Teachers", icon: UserCog },
  { id: "batch-schedule", label: "Batch Schedule", icon: CalendarCheck },
  { id: "staff", label: "Staff", icon: Users },
  { id: "salary", label: "Salary", icon: Wallet },
  { id: "advance", label: "Advance", icon: Banknote },
  { id: "infrastructure", label: "Infrastructure Management", icon: Landmark },
];


export function TeacherManagementTab({ teachersTabProps, batchScheduleTabProps, staffTabProps, salaryTabProps, advanceTabProps, infrastructureTabProps }) {
  const [subTab, setSubTab] = useState("teachers");
  return (
    <div>
      <SectionHeader eyebrow="Staffing" title="Institute Management" />
      <div className="text-sm text-[#6E6650] mb-4">Teacher register, batch allotment, other staff, Salary & Advance payments, and campus infrastructure — in one place. Teacher performance now lives under Academic Monitoring → Performance → Teachers Performance.</div>

      <div className="border rounded-sm overflow-hidden mb-5 max-w-full" style={{ borderColor: "#12312B" }}>
      <div className="flex overflow-x-auto no-scrollbar">
        {TEACHER_MANAGEMENT_SUB_TABS.map((st, i) => {
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

      {subTab === "teachers" && <TeachersTab {...teachersTabProps} />}
      {subTab === "batch-schedule" && <BatchScheduleTab {...batchScheduleTabProps} />}
      {subTab === "staff" && <StaffTab {...staffTabProps} />}
      {subTab === "salary" && <SalaryTab {...salaryTabProps} />}
      {subTab === "advance" && <AdvanceTab {...advanceTabProps} />}
      {subTab === "infrastructure" && <InfrastructureTab {...infrastructureTabProps} />}
    </div>
  );
}


export function TeachersTab({ teachers, subjectsList, batchSchedule, onAdd, onEdit, onRemove, onStatement, onChangeStatus, onJoiningForm }) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(t => {
      const haystack = [t.name, t.teacherId, t.phone, t.guardianPhone, t.email, t.address, t.aadharNumber, ...(t.expertiseSubjects || [])].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [teachers, search]);

  return (
    <div>
      <SectionHeader eyebrow="Register" title="Teachers Directory" action={
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Add Teacher
        </button>
      } />
      <Card className="p-3.5 mb-4">
        <div className="relative">
          <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Search</div>
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" style={{ marginTop: "9px" }} />
          <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, Teacher ID, subject, phone, Aadhar…" />
        </div>
      </Card>
      <Card>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">{teachers.length === 0 ? "No teachers registered yet." : "No teachers match this search."}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["#", "", "Name", "Expertise Subjects", "Status", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, idx) => {
                const isOpen = !!expanded[t.id];
                const myBatches = batchSchedule.filter(b => b.teacherId === t.id || b.substituteTeacherId === t.id);
                return (
                  <React.Fragment key={t.id}>
                    <tr className="ledger-row">
                      <td className="pl-4 py-2.5 text-xs text-[#9C8F6E] font-mono">{idx + 1}</td>
                      <td className="pl-1 py-2.5">
                        <button onClick={() => setExpanded(prev => ({ ...prev, [t.id]: !prev[t.id] }))} className="text-[#9C8F6E] hover:text-[#12312B] text-xs w-4">{isOpen ? "▾" : "▸"}</button>
                      </td>
                      <td className="px-4 py-2.5 font-medium">
                        <div>{t.name}</div>
                        <div className="text-[10px] text-[#9C8F6E] flex gap-1.5">
                          {t.teacherId && <span className="font-mono">{t.teacherId}</span>}
                          {t.phone && <span>{t.teacherId ? "· " : ""}{t.phone}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#6E6650]">{(t.expertiseSubjects || []).join(", ") || "—"}</td>
                      <td className="px-4 py-2.5 text-xs"><Stamp text={(t.status || "active") === "active" ? "Active" : "Inactive"} tone={(t.status || "active") === "active" ? "paid" : "overdue"} /></td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {onStatement && <button onClick={() => onStatement(t)} className="text-xs text-[#8A6420] underline mr-3">Statement</button>}
                        {onJoiningForm && <button onClick={() => onJoiningForm(t)} className="text-xs text-[#12312B] underline inline-flex items-center gap-0.5 mr-3"><FileText size={11} /> Joining Form</button>}
                        <button onClick={() => onChangeStatus(t, (t.status || "active") === "active" ? "inactive" : "active")}
                          className="text-xs underline mr-3" style={{ color: (t.status || "active") === "active" ? "#A63D2F" : "#3F6B52" }}>
                          {(t.status || "active") === "active" ? "Deactivate" : "Reactivate"}
                        </button>
                        <button onClick={() => onEdit(t)} className="text-xs text-[#12312B] underline mr-3">Edit</button>
                        <button onClick={() => onRemove(t.id)} className="text-xs text-[#A63D2F] underline">Remove</button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td></td><td></td>
                        <td colSpan={4} className="px-4 pb-3 pt-0">
                          <div className="p-3 rounded bg-[#FAF6EC] border text-xs space-y-2" style={{ borderColor: "#D8CFB8" }}>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Gender</span>{t.gender || "—"}</div>
                              <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Date of Birth</span>{t.dob ? fmtDate(t.dob) : "—"}</div>
                              <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Joining Date</span>{t.joiningDate ? fmtDate(t.joiningDate) : "—"}</div>
                              <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Guardian / Emergency Phone</span>{t.guardianPhone || "—"}</div>
                              <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Email Address</span>{t.email || "—"}</div>
                              <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Aadhar Number</span>{t.aadharNumber || "—"}</div>
                              <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Address</span>{t.address || "—"}</div>
                              <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Current Salary</span>{fmtINR(t.salaryAmount || 0)}{t.paymentMode ? ` (${t.paymentMode})` : ""}</div>
                            </div>
                            {(t.qualifications || []).length > 0 && (
                              <div>
                                <span className="text-[#9C8F6E] block font-mono text-[10px] uppercase mb-1">Qualifications</span>
                                {t.qualifications.map((q, i) => <div key={i}>{q.degree} — {q.institution} ({q.year})</div>)}
                              </div>
                            )}
                            {(t.parallelProfessions || []).length > 0 && (
                              <div>
                                <span className="text-[#9C8F6E] block font-mono text-[10px] uppercase mb-1">Parallel Professions</span>
                                {t.parallelProfessions.map((p, i) => <div key={i}>{p.role} — {p.organization}{p.description ? ` (${p.description})` : ""}</div>)}
                              </div>
                            )}
                            <div>
                              <span className="text-[#9C8F6E] block font-mono text-[10px] uppercase mb-1">Batches Allotted</span>
                              {myBatches.length === 0 ? "—" : myBatches.map(b => (
                                <div key={b.id}>{b.batchName} — Class {b.class} · {b.subject} ({(b.daysOfWeek || []).join("/")}, {b.startTime}–{b.endTime}){b.substituteTeacherId === t.id ? " [Substitute]" : ""}</div>
                              ))}
                            </div>
                            {(t.statusLog || []).length > 0 && (
                              <div>
                                <span className="text-[#9C8F6E] block font-mono text-[10px] uppercase mb-1">Status History</span>
                                {[...t.statusLog].sort((a, b) => compareChrono(a, b, -1)).map((s, i) => (
                                  <div key={i} className="flex items-center gap-1.5">
                                    <span className="font-semibold" style={{ color: s.type === "deactivated" ? "#A63D2F" : "#3F6B52" }}>
                                      {s.type === "deactivated" ? "Deactivated" : "Reactivated"}
                                    </span>
                                    <span className="text-[#9C8F6E]">{fmtDate(s.date)}</span>
                                    {s.remarks && <span>— {s.remarks}</span>}
                                  </div>
                                ))}
                              </div>
                            )}
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


export function TeacherFormModal({ subjectsList, initial, teachers, onClose, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [dob, setDob] = useState(initial?.dob || "");
  const [gender, setGender] = useState(initial?.gender || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [guardianPhone, setGuardianPhone] = useState(initial?.guardianPhone || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [address, setAddress] = useState(initial?.address || "");
  const [aadharNumber, setAadharNumber] = useState(initial?.aadharNumber || "");
  const [joiningDate, setJoiningDate] = useState(initial?.joiningDate || todayStr());
  const [expertiseSubjects, setExpertiseSubjects] = useState(initial?.expertiseSubjects || []);
  const [salaryAmount, setSalaryAmount] = useState(initial?.salaryAmount || "");
  const [paymentMode, setPaymentMode] = useState(initial?.paymentMode || "Bank Transfer");
  const [qualifications, setQualifications] = useState(initial?.qualifications || []);
  const [parallelProfessions, setParallelProfessions] = useState(initial?.parallelProfessions || []);

  const displayTeacherId = initial?.teacherId || useMemo(() => generateTeacherId(teachers), []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSubject(sub) {
    setExpertiseSubjects(prev => prev.includes(sub) ? prev.filter(x => x !== sub) : [...prev, sub]);
  }
  function addQualification() { setQualifications(prev => [...prev, { degree: "", institution: "", year: "" }]); }
  function updateQualification(i, field, val) { setQualifications(prev => prev.map((q, idx) => idx === i ? { ...q, [field]: val } : q)); }
  function removeQualification(i) { setQualifications(prev => prev.filter((_, idx) => idx !== i)); }
  function addProfession() { setParallelProfessions(prev => [...prev, { role: "", organization: "", description: "" }]); }
  function updateProfession(i, field, val) { setParallelProfessions(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p)); }
  function removeProfession(i) { setParallelProfessions(prev => prev.filter((_, idx) => idx !== i)); }

  function submit() {
    if (!name.trim()) return;
    const salaryHistory = [...(initial?.salaryHistory || [])];
    const newAmt = Number(salaryAmount) || 0;
    const prevAmt = initial ? (Number(initial.salaryAmount) || 0) : null;
    if (prevAmt === null || newAmt !== prevAmt) {
      salaryHistory.push({ date: todayStr(), amount: newAmt, remarks: initial ? "Salary updated" : "Initial salary" });
    }
    onSave({
      ...initial, id: initial?.id, teacherId: initial?.teacherId || displayTeacherId,
      name: name.trim(), dob, gender, phone: phone.trim(), guardianPhone: guardianPhone.trim(), email: email.trim(),
      address: address.trim(), aadharNumber: aadharNumber.trim(), joiningDate: joiningDate || todayStr(),
      qualifications, parallelProfessions, expertiseSubjects,
      salaryAmount: newAmt, paymentMode, salaryHistory, status: initial?.status || "active",
    });
  }

  return (
    <WideModal title={initial ? "Edit Teacher" : "Add Teacher"} onClose={onClose}>
      <div className="flex items-center justify-between mb-3 p-2 rounded bg-[#FAF6EC] border" style={{ borderColor: "#D8CFB8" }}>
        <span className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono">Teacher ID</span>
        <span className="text-sm font-bold text-[#12312B]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{displayTeacherId}{!initial && " (auto-assigned on save)"}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Full Name"><input className={inputCls} style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Anjali Verma" /></Field>
        <Field label="Gender">
          <select className={inputCls} style={inputStyle} value={gender} onChange={e => setGender(e.target.value)}>
            <option value="">— Select —</option><option value="Male">Male</option><option value="Female">Female</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Date of Birth"><input type="date" className={inputCls} style={inputStyle} value={dob} onChange={e => setDob(e.target.value)} /></Field>
        <Field label="Joining Date"><input type="date" className={inputCls} style={inputStyle} value={joiningDate} onChange={e => setJoiningDate(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Phone"><input className={inputCls} style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit phone number" /></Field>
        <Field label="Emergency Contact"><input className={inputCls} style={inputStyle} value={guardianPhone} onChange={e => setGuardianPhone(e.target.value)} placeholder="Alternate contact" /></Field>
      </div>
      <Field label="Email Address (optional)"><input type="email" className={inputCls} style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. teacher@email.com" /></Field>
      <Field label="Address"><input className={inputCls} style={inputStyle} value={address} onChange={e => setAddress(e.target.value)} placeholder="House / street / area / city" /></Field>
      <Field label="Aadhar Number"><input className={inputCls} style={inputStyle} value={aadharNumber} onChange={e => setAadharNumber(e.target.value)} placeholder="12-digit Aadhar number" maxLength={14} /></Field>

      <Field label={`Expertise Subjects (${expertiseSubjects.length} selected)`}>
        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 border bg-white rounded-sm">
          {subjectsList.map(sub => {
            const active = expertiseSubjects.includes(sub);
            return (
              <button key={sub} type="button" onClick={() => toggleSubject(sub)} className="px-2.5 py-1 text-xs rounded-sm border flex items-center gap-1"
                style={{ background: active ? "#12312B" : "white", color: active ? "#F4EFDE" : "#4A4636", borderColor: active ? "#12312B" : "#D8CFB8" }}>
                {active && <Check size={12} />}{sub}
              </button>
            );
          })}
        </div>
      </Field>

      <div className="p-3 border rounded-sm mb-3 bg-white" style={{ borderColor: "#D8CFB8" }}>
        <div className="text-xs font-semibold text-[#12312B] mb-2">Academic Qualifications</div>
        {qualifications.map((q, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_80px_28px] gap-2 mb-2">
            <input className={inputCls} style={inputStyle} value={q.degree} onChange={e => updateQualification(i, "degree", e.target.value)} placeholder="Degree" />
            <input className={inputCls} style={inputStyle} value={q.institution} onChange={e => updateQualification(i, "institution", e.target.value)} placeholder="Institution" />
            <input className={inputCls} style={inputStyle} value={q.year} onChange={e => updateQualification(i, "year", e.target.value)} placeholder="Year" />
            <button type="button" onClick={() => removeQualification(i)} className="text-[#A63D2F]"><X size={14} /></button>
          </div>
        ))}
        <button type="button" onClick={addQualification} className="text-xs text-[#12312B] underline flex items-center gap-1"><Plus size={12} /> Add Qualification</button>
      </div>

      <div className="p-3 border rounded-sm mb-3 bg-white" style={{ borderColor: "#D8CFB8" }}>
        <div className="text-xs font-semibold text-[#12312B] mb-2">Parallel Professions (optional)</div>
        {parallelProfessions.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_28px] gap-2 mb-2">
            <input className={inputCls} style={inputStyle} value={p.role} onChange={e => updateProfession(i, "role", e.target.value)} placeholder="Role" />
            <input className={inputCls} style={inputStyle} value={p.organization} onChange={e => updateProfession(i, "organization", e.target.value)} placeholder="Organization" />
            <input className={inputCls} style={inputStyle} value={p.description} onChange={e => updateProfession(i, "description", e.target.value)} placeholder="Description" />
            <button type="button" onClick={() => removeProfession(i)} className="text-[#A63D2F]"><X size={14} /></button>
          </div>
        ))}
        <button type="button" onClick={addProfession} className="text-xs text-[#12312B] underline flex items-center gap-1"><Plus size={12} /> Add Profession</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Current Salary (₹)"><input type="number" className={inputCls} style={inputStyle} value={salaryAmount} onChange={e => setSalaryAmount(e.target.value)} placeholder="0" /></Field>
        <Field label="Payment Mode">
          <select className={inputCls} style={inputStyle} value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
            {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
      </div>
      {initial?.salaryHistory?.length > 0 && (
        <div className="text-[10px] text-[#9C8F6E] mb-3">Salary history: {initial.salaryHistory.map((h, i) => `${fmtDate(h.date)} — ${fmtINR(h.amount)}`).join(" · ")}</div>
      )}
      {initial && (
        <div className="text-[10px] text-[#9C8F6E] mb-3">
          Status: <span className="font-semibold" style={{ color: (initial.status || "active") === "active" ? "#3F6B52" : "#A63D2F" }}>{(initial.status || "active") === "active" ? "Active" : "Inactive"}</span> — use the Deactivate / Reactivate button on the teacher's row to change this (requires a date and remarks).
        </div>
      )}

      <button onClick={submit} className="w-full mt-2 py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
        {initial ? "Save Changes" : "Register Teacher"}
      </button>
    </WideModal>
  );
}

// ---- Dedicated Deactivate / Reactivate modal — requires a date and
// remarks for every status transition (unlike the old plain Status
// dropdown, which recorded neither). Every submission is appended to the
// teacher's statusLog, never overwritten — see changeTeacherStatus() and
// the "Status History" panel in TeachersTab.


export function TeacherStatusModal({ teacher, newStatus, onClose, onSave }) {
  const [date, setDate] = useState(todayStr());
  const [remarks, setRemarks] = useState("");
  const activating = newStatus === "active";

  return (
    <Modal title={`${activating ? "Reactivate" : "Deactivate"} ${teacher.name}`} onClose={onClose}>
      <div className="text-sm text-[#6E6650] mb-3">
        {activating
          ? "Record when this teacher is returning to active duty, and why."
          : "Record when this teacher stopped active duty, and why. This doesn't remove them or their history — Performance and Batches stay exactly as they are."}
      </div>
      <Field label={activating ? "Reactivation Date" : "Inactive Date"}>
        <input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
      </Field>
      <Field label="Remarks">
        <input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)}
          placeholder={activating ? "e.g. Returned from leave" : "e.g. Extended leave, resigned, on-hold"} />
      </Field>
      <button onClick={() => onSave(date, remarks)} className="w-full mt-2 py-2.5 rounded-sm text-sm font-medium"
        style={{ background: activating ? "#3F6B52" : "#A63D2F", color: "#F4EFDE" }}>
        {activating ? "Confirm Reactivation" : "Confirm Deactivation"}
      </button>
    </Modal>
  );
}

// ---- Settings — now a tabbed modal (SETTINGS_SUB_TABS) so future setting
// categories (Appearance, Users & Roles, Notifications, etc.) have a home
// without redesigning this again. Only one sub-tab exists today: "Institute
// Information" — Name/Tagline/Address/Mobile/Telephone/GST (text only per
// decision — logo is a later addition once Firebase Storage is confirmed
// set up). This is the institute's own business identity shown on every
// printed document via InstituteHeader (see DEFAULT_INSTITUTE_SETTINGS /
// InstituteSettingsContext) — separate from "InstituteOS", the app's own
// product branding in the sidebar, which this does not touch.

