import { useMemo, useState } from "react";
import { FileText, Plus, Search } from "lucide-react";
import { Card, Field, Modal, SectionHeader, Stamp, inputCls, inputStyle } from "../common/UI";
import { PAYMENT_MODES } from "../../constants/appConstants";
import { todayStr } from "../../lib/dates";
import { generateStaffId } from "../../lib/ids";
import { fmtINR } from "../../lib/money";

export function StaffTab({ staff, onAdd, onEdit, onRemove, onStatement, onJoiningForm }) {
  return (
    <div>
      <SectionHeader eyebrow="Register" title="Other Staff" action={
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Add Staff
        </button>
      } />
      <Card>
        {staff.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">No staff registered yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Name", "Title", "Salary", "Status", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.id} className="ledger-row">
                  <td className="px-4 py-2.5 font-medium">
                    {s.name}
                    <div className="text-[10px] text-[#9C8F6E] flex gap-1.5">
                      <span className="font-mono">{s.staffId}</span>
                      {s.email && <span>· {s.email}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs">{s.title || "—"}</td>
                  <td className="px-4 py-2.5 text-xs font-mono">{fmtINR(s.salaryAmount || 0)}</td>
                  <td className="px-4 py-2.5 text-xs"><Stamp text={(s.status || "active") === "active" ? "Active" : "Inactive"} tone={(s.status || "active") === "active" ? "paid" : "overdue"} /></td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {onStatement && <button onClick={() => onStatement(s)} className="text-xs text-[#8A6420] underline mr-3">Statement</button>}
                    {onJoiningForm && <button onClick={() => onJoiningForm(s)} className="text-xs text-[#12312B] underline inline-flex items-center gap-0.5 mr-3"><FileText size={11} /> Joining Form</button>}
                    <button onClick={() => onEdit(s)} className="text-xs text-[#12312B] underline mr-3">Edit</button>
                    <button onClick={() => onRemove(s.id)} className="text-xs text-[#A63D2F] underline">Remove</button>
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


export function StaffFormModal({ initial, staff, onClose, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [title, setTitle] = useState(initial?.title || "");
  const [dob, setDob] = useState(initial?.dob || "");
  const [gender, setGender] = useState(initial?.gender || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [guardianPhone, setGuardianPhone] = useState(initial?.guardianPhone || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [address, setAddress] = useState(initial?.address || "");
  const [aadharNumber, setAadharNumber] = useState(initial?.aadharNumber || "");
  const [joiningDate, setJoiningDate] = useState(initial?.joiningDate || todayStr());
  const [salaryAmount, setSalaryAmount] = useState(initial?.salaryAmount || "");
  const [paymentMode, setPaymentMode] = useState(initial?.paymentMode || "Bank Transfer");
  const [status, setStatus] = useState(initial?.status || "active");

  const displayStaffId = initial?.staffId || useMemo(() => generateStaffId(staff), []); // eslint-disable-line react-hooks/exhaustive-deps

  function submit() {
    if (!name.trim()) return;
    const salaryHistory = [...(initial?.salaryHistory || [])];
    const newAmt = Number(salaryAmount) || 0;
    const prevAmt = initial ? (Number(initial.salaryAmount) || 0) : null;
    if (prevAmt === null || newAmt !== prevAmt) {
      salaryHistory.push({ date: todayStr(), amount: newAmt, remarks: initial ? "Salary updated" : "Initial salary" });
    }
    onSave({
      ...initial, id: initial?.id, staffId: initial?.staffId || displayStaffId,
      name: name.trim(), title: title.trim(), dob, gender, phone: phone.trim(),
      guardianPhone: guardianPhone.trim(), email: email.trim(), address: address.trim(), aadharNumber: aadharNumber.trim(),
      joiningDate: joiningDate || todayStr(), salaryAmount: newAmt, paymentMode, salaryHistory, status,
    });
  }

  return (
    <Modal title={initial ? "Edit Staff" : "Add Staff"} onClose={onClose}>
      <div className="flex items-center justify-between mb-3 p-2 rounded bg-[#FAF6EC] border" style={{ borderColor: "#D8CFB8" }}>
        <span className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono">Staff ID</span>
        <span className="text-sm font-bold text-[#12312B]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{displayStaffId}{!initial && " (auto-assigned on save)"}</span>
      </div>
      <Field label="Full Name"><input className={inputCls} style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ramesh Kumar" /></Field>
      <Field label="Title / Designation"><input className={inputCls} style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Office Assistant, Peon, Accountant" /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Date of Birth"><input type="date" className={inputCls} style={inputStyle} value={dob} onChange={e => setDob(e.target.value)} /></Field>
        <Field label="Gender">
          <select className={inputCls} style={inputStyle} value={gender} onChange={e => setGender(e.target.value)}>
            <option value="">— Select —</option><option value="Male">Male</option><option value="Female">Female</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Phone"><input className={inputCls} style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} /></Field>
        <Field label="Emergency Contact"><input className={inputCls} style={inputStyle} value={guardianPhone} onChange={e => setGuardianPhone(e.target.value)} /></Field>
      </div>
      <Field label="Email Address (optional)"><input type="email" className={inputCls} style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. staff@email.com" /></Field>
      <Field label="Address"><input className={inputCls} style={inputStyle} value={address} onChange={e => setAddress(e.target.value)} /></Field>
      <Field label="Aadhar Number"><input className={inputCls} style={inputStyle} value={aadharNumber} onChange={e => setAadharNumber(e.target.value)} maxLength={14} /></Field>
      <Field label="Joining Date"><input type="date" className={inputCls} style={inputStyle} value={joiningDate} onChange={e => setJoiningDate(e.target.value)} /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Current Salary (₹)"><input type="number" className={inputCls} style={inputStyle} value={salaryAmount} onChange={e => setSalaryAmount(e.target.value)} placeholder="0" /></Field>
        <Field label="Payment Mode">
          <select className={inputCls} style={inputStyle} value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
            {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Status">
        <select className={inputCls} style={inputStyle} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="active">Active</option><option value="inactive">Inactive</option>
        </select>
      </Field>
      <button onClick={submit} className="w-full mt-2 py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
        {initial ? "Save Changes" : "Register Staff"}
      </button>
    </Modal>
  );
}

// ============================================================================
// SALARY / ADVANCE — two new sub-tabs inside Institute Management (see
// TEACHER_MANAGEMENT_SUB_TABS), right after "Staff". Both read from a
// merged Teachers+Staff picker (mergeStaffAndTeachers) and follow the same
// onSnapshot / visibleX / trashedX / soft-delete pattern as every other
// collection in this file. See UPDATE NOTES #24.
// ============================================================================

// Shared merged-person picker — same search-dropdown pattern already used
// for the student picker in DepositFormModal / AddChargeModal, just over
// the merged Teachers+Staff list instead of Students. `value` is a
// composite "personType:personId" key so a teacher and a staff member can
// never collide even if their Firestore doc ids ever did.


export function PersonPicker({ persons, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = persons.find(p => `${p.personType}:${p.personId}` === value);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return persons;
    return persons.filter(p => [p.name, p.displayId, p.role, p.phone].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [persons, search]);

  return (
    <div className="relative">
      <div className="flex items-center border rounded-sm bg-white px-3 py-2 cursor-pointer" style={inputStyle} onClick={() => setOpen(o => !o)}>
        <Search size={13} className="text-[#9C8F6E] mr-2 shrink-0" />
        <span className="text-sm flex-1 truncate">
          {selected ? `${selected.name} — ${selected.personType === "teacher" ? "Teacher" : "Staff"}${selected.role ? " · " + selected.role : ""}` : (placeholder || "Search by name, ID, or role…")}
        </span>
      </div>
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white border rounded-sm shadow-lg max-h-64 overflow-y-auto" style={{ borderColor: "#D8CFB8" }}>
          <div className="p-2 sticky top-0 bg-white border-b" style={{ borderColor: "#EEE7D2" }}>
            <input autoFocus className={inputCls} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Type name, ID, or role…" />
          </div>
          {filtered.length === 0 ? (
            <div className="p-3 text-xs text-[#9C8F6E] text-center">No teacher or staff member matches.</div>
          ) : (
            filtered.map(p => {
              const key = `${p.personType}:${p.personId}`;
              return (
                <button key={key} type="button" onClick={() => { onChange(key); setOpen(false); setSearch(""); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[#F5F0E1] flex items-center justify-between"
                  style={{ background: key === value ? "#F5F0E1" : "white" }}>
                  <span>{p.name} <span className="text-xs text-[#9C8F6E]">— {p.personType === "teacher" ? "Teacher" : "Staff"}{p.role ? " · " + p.role : ""}</span></span>
                  <span className="text-xs text-[#9C8F6E] font-mono">{p.displayId || ""}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

