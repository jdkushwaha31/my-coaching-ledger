import React, { useMemo, useState } from "react";
import { AlertCircle, ArrowUpRight, Award, ClipboardList, FileText, History, Plus, Receipt, Search, Tag, Undo2, Users, Wallet } from "lucide-react";
import { Card, SectionHeader, Stamp, inputCls, inputStyle } from "../common/UI";
import { ChargesTab, DepositsTab } from "../fees/DepositsChargesExpensesTab";
import { CenterStatementTab } from "../statements/CenterStatementTab";
import { StructureTab } from "../structure/StructureTab";
import { DuesTab } from "./DuesTab";
import { STREAMS } from "../../constants/appConstants";
import { fmtDate } from "../../lib/dates";
import { fmtINR } from "../../lib/money";

export function LifecycleActions({ s, onExit, onPromote, onBatchChange, onViewHistory, onUndo, onStatement, onAddCharge, onJoiningForm, compact }) {
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

// ============================================================================
// STUDENT MANAGEMENT TAB — merges what used to be six separate sidebar
// tabs (Students Register, Pending Dues, Deposits Log, Charges, Center
// Statement, Fee & Class Structure) into one "Student Management" sidebar
// entry with an internal pill row of six sub-tabs, in that exact
// left-to-right order. This is purely navigational regrouping: every one
// of the six original components (StudentsTab, DuesTab, DepositsTab,
// ChargesTab, CenterStatementTab, StructureTab) is reused completely
// as-is below, with the exact same props it was given before the merge —
// same filters, search boxes, print/export buttons, add/edit/delete
// actions, receipts, and modals as before. Same sub-tab pill-row pattern
// already used by StructureTab (3 sub-tabs) and BankingTab (4 sub-tabs).
// ============================================================================


export const STUDENT_MANAGEMENT_SUB_TABS = [
  { id: "students", label: "Students Register", icon: Users },
  { id: "dues", label: "Pending Dues", icon: AlertCircle },
  { id: "deposits", label: "Deposits Log", icon: Receipt },
  { id: "charges", label: "Charges", icon: ClipboardList },
  { id: "statement", label: "Center Statement", icon: FileText },
  { id: "structure", label: "Fee & Class Structure", icon: Wallet },
];


export function StudentManagementTab({ studentsTabProps, duesTabProps, depositsTabProps, chargesTabProps, statementTabProps, structureTabProps }) {
  const [subTab, setSubTab] = useState("students");

  return (
    <div>
      <SectionHeader eyebrow="Student Lifecycle" title="Student Management" />
      <div className="text-sm text-[#6E6650] mb-4">Roster, dues, payments in, ad-hoc charges, the master transaction record, and fee setup — the full student lifecycle in one place.</div>

      {/* Same bordered pill-row pattern as StructureTab / BankingTab —
          only one sub-tab's panel renders at a time; nothing below was
          removed, just regrouped under one sidebar entry. */}
      <div className="border rounded-sm overflow-hidden mb-5 max-w-full" style={{ borderColor: "#12312B" }}>
      <div className="flex overflow-x-auto no-scrollbar">
        {STUDENT_MANAGEMENT_SUB_TABS.map((st, i) => {
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

      {subTab === "students" && <StudentsTab {...studentsTabProps} />}
      {subTab === "dues" && <DuesTab {...duesTabProps} />}
      {subTab === "deposits" && <DepositsTab {...depositsTabProps} />}
      {subTab === "charges" && <ChargesTab {...chargesTabProps} />}
      {subTab === "statement" && <CenterStatementTab {...statementTabProps} />}
      {subTab === "structure" && <StructureTab {...structureTabProps} />}
    </div>
  );
}


export function StudentsTab({ students, studentDues, studentDuesRaw, classes, streams, batchesForMonth, curMonth, onAdd, onEdit, onExit, onPromote, onViewHistory, onBatchChange, onUndo, onStatement, onAddCharge, onJoiningForm, onRemove }) {
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
      const haystack = [s.name, s.studentId, s.fatherName, s.phone, s.guardianPhone, s.email, s.address, s.aadharNumber, ...(s.batches || [])].filter(Boolean).join(" ").toLowerCase();
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
                const hasDetails = s.fatherName || s.guardianPhone || s.email || s.address || s.dob || s.currentSchool || s.aadharNumber || s.stream || s.gender || s.studentId || s.joiningDate;
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
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded bg-[#FAF6EC] border text-xs" style={{ borderColor: "#D8CFB8" }}>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Student ID</span>{s.studentId || "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Gender</span>{s.gender || "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Father's Name</span>{s.fatherName || "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Guardian Phone</span>{s.guardianPhone || "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Email Address</span>{s.email || "—"}</div>
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

