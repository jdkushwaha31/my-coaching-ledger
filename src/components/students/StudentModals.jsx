import React, { useEffect, useMemo, useRef, useState } from "react";
import { Banknote, Check, Printer, Receipt, Search } from "lucide-react";
import { Field, InstituteHeader, Modal, Stamp, WideModal, inputCls, inputStyle } from "../common/UI";
import { EXIT_REASONS, FONT_IMPORT, PAYMENT_MODES, STREAMS } from "../../constants/appConstants";
import { InstituteSettingsContext } from "../../contexts/InstituteSettingsContext";
import { compareChrono, currentMonthKey, fmtDate, monthLabel, todayStr } from "../../lib/dates";
import { generateStudentId, shortId } from "../../lib/ids";
import { fmtINR } from "../../lib/money";

export function StudentFormModal({ classes, subjectsList, streams, initial, onClose, onSave, students }) {
  const streamList = streams || STREAMS;
  const [name, setName] = useState(initial?.name || "");
  const [cls, setCls] = useState(initial?.class || classes[0] || "10");
  const [gender, setGender] = useState(initial?.gender || "");
  const [stream, setStream] = useState(initial?.stream || "");
  const [batches, setBatches] = useState(initial?.batches || []);
  const [phone, setPhone] = useState(initial?.phone || "");
  const [fatherName, setFatherName] = useState(initial?.fatherName || "");
  const [guardianPhone, setGuardianPhone] = useState(initial?.guardianPhone || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [address, setAddress] = useState(initial?.address || "");
  const [dob, setDob] = useState(initial?.dob || "");
  const [currentSchool, setCurrentSchool] = useState(initial?.currentSchool || "");
  const [aadharNumber, setAadharNumber] = useState(initial?.aadharNumber || "");
  const [admissionMonth, setAdmissionMonth] = useState(initial?.admissionMonth || currentMonthKey());
  // Joining Date — visibly defaults to TODAY'S date the moment the form
  // opens (for a new student), so office staff see it pre-filled instead
  // of blank. It stays editable — pick a different date to backdate a
  // student — and whatever's in the field at save time is what's stored.
  const [joiningDate, setJoiningDate] = useState(initial?.joiningDate || todayStr());
  const [monthlyDiscount, setMonthlyDiscount] = useState(initial?.monthlyDiscount || 0);
  const [previousDues, setPreviousDues] = useState(initial?.previousDues || 0);
  const [status] = useState(initial?.status || "active");

  // Student ID — shown read-only on the form. For an existing student it's
  // whatever was already assigned (never changes). For a new student it's
  // computed here purely for display, using the same rule saveStudent()
  // uses, so what the user sees on the form is exactly what gets saved.
  const displayStudentId = initial?.studentId || useMemo(() => generateStudentId(students), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Duplicate Aadhar detector — checks the live student list as the user
  // types and flags an existing match with a pop-up. It never blocks
  // saving; it just surfaces the possible duplicate so a human can decide
  // whether to continue (e.g. genuine case) or fix the number.
  const [dupStudent, setDupStudent] = useState(null);
  const [dismissedDupId, setDismissedDupId] = useState(null);
  useEffect(() => {
    const digits = aadharNumber.replace(/\D/g, "");
    if (digits.length < 4) { setDupStudent(null); return; }
    const match = (students || []).find(s => s.id !== initial?.id && (s.aadharNumber || "").replace(/\D/g, "") === digits);
    setDupStudent(match || null);
  }, [aadharNumber, students, initial]);
  const showDupPopup = !!dupStudent && dupStudent.id !== dismissedDupId;

  // Advance Payment — a one-time transaction captured right on the
  // registration/edit form. It is never stored as a field on the student
  // record itself; on save the parent hands it off to become a real
  // Deposit (so it counts toward the student's balance the same as any
  // other payment), and a Receipt is generated right after the student
  // is saved successfully.
  const [advancePayment, setAdvancePayment] = useState("");
  const [advancePaymentMode, setAdvancePaymentMode] = useState("Cash");
  const [advancePaymentRef, setAdvancePaymentRef] = useState("");

  function toggleSubject(sub) {
    setBatches(prev => prev.includes(sub) ? prev.filter(x => x !== sub) : (prev.length >= 6 ? prev : [...prev, sub]));
  }

  function submit() {
    if (!name.trim()) return;
    const baseHistory = initial?.batchHistory && initial.batchHistory.length ? [...initial.batchHistory] : [{ fromMonth: admissionMonth, batches }];
    if (initial?.batchHistory && initial.batchHistory.length) baseHistory[0] = { ...baseHistory[0], batches };
    onSave({
      ...initial, id: initial?.id, studentId: initial?.studentId || displayStudentId,
      name: name.trim(), class: cls, gender, stream, batches, batchHistory: baseHistory,
      phone: phone.trim(), fatherName: fatherName.trim(), guardianPhone: guardianPhone.trim(), email: email.trim(), address: address.trim(),
      dob: dob || "", currentSchool: currentSchool.trim(), aadharNumber: aadharNumber.trim(),
      admissionMonth, monthlyDiscount: Number(monthlyDiscount) || 0,
      // Joining Date — whatever was manually entered; if left blank, auto-
      // fills to today's date at save time.
      joiningDate: joiningDate || todayStr(),
      previousDues: Number(previousDues) || 0, status,
      advancePayment: Number(advancePayment) || 0,
      advancePaymentMode,
      advancePaymentRef: advancePaymentRef.trim(),
    });
  }

  return (
    <Modal title={initial ? "Edit Student Details" : "Add New Student"} onClose={onClose}>
      <div className="p-2.5 border rounded-sm mb-3 flex items-center justify-between bg-[#FAF6EC]" style={{ borderColor: "#D8CFB8" }}>
        <span className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono">Student ID</span>
        <span className="text-sm font-bold text-[#12312B]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{displayStudentId}{!initial && " (auto-assigned on save)"}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Full Name"><input className={inputCls} style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rahul Sharma" /></Field>
        <Field label="Father's Name"><input className={inputCls} style={inputStyle} value={fatherName} onChange={e => setFatherName(e.target.value)} placeholder="e.g. Suresh Sharma" /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Class">
          <select className={inputCls} style={inputStyle} value={cls} onChange={e => setCls(e.target.value)}>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Gender">
          <select className={inputCls} style={inputStyle} value={gender} onChange={e => setGender(e.target.value)}>
            <option value="">— Select —</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Fee Start Month"><input type="month" className={inputCls} style={inputStyle} value={admissionMonth} onChange={e => setAdmissionMonth(e.target.value)} /></Field>
        <Field label="Joining Date">
          <input type="date" className={inputCls} style={inputStyle} value={joiningDate} onChange={e => setJoiningDate(e.target.value)} />
          <div className="text-[10px] text-[#9C8F6E] mt-1">Defaults to today's date — change it to backdate a student.</div>
        </Field>
      </div>
      <Field label="Stream (optional)">
        <select className={inputCls} style={inputStyle} value={stream} onChange={e => setStream(e.target.value)}>
          <option value="">— Not Applicable —</option>
          {streamList.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Phone / WhatsApp Number"><input className={inputCls} style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit phone number" /></Field>
        <Field label="Guardian Phone Number"><input className={inputCls} style={inputStyle} value={guardianPhone} onChange={e => setGuardianPhone(e.target.value)} placeholder="Alternate contact (optional)" /></Field>
      </div>
      <Field label="Email Address (optional)"><input type="email" className={inputCls} style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. student@email.com" /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Date of Birth"><input type="date" className={inputCls} style={inputStyle} value={dob} onChange={e => setDob(e.target.value)} /></Field>
        <Field label="Current School / Institution"><input className={inputCls} style={inputStyle} value={currentSchool} onChange={e => setCurrentSchool(e.target.value)} placeholder="e.g. Delhi Public School" /></Field>
      </div>
      <Field label="Aadhar Number">
        <input className={inputCls} style={inputStyle} value={aadharNumber} onChange={e => setAadharNumber(e.target.value)} placeholder="12-digit Aadhar number" maxLength={14} />
        {dupStudent && (
          <div className="text-[10px] text-[#A63D2F] mt-1 font-medium">
            ⚠ Matches existing record: {dupStudent.name}{dupStudent.studentId ? ` (${dupStudent.studentId})` : ""} — {dupStudent.class}{dupStudent.phone ? ` · ${dupStudent.phone}` : ""}
          </div>
        )}
      </Field>
      <Field label="Address"><input className={inputCls} style={inputStyle} value={address} onChange={e => setAddress(e.target.value)} placeholder="House / street / area / city" /></Field>
      <Field label="Monthly Concession / Discount (₹)"><input type="number" className={inputCls} style={inputStyle} value={monthlyDiscount} onChange={e => setMonthlyDiscount(e.target.value)} placeholder="0" /></Field>
      <Field label="Opening Balance / Legacy Carried Dues (₹)">
        <input type="number" className={inputCls} style={inputStyle} value={previousDues} onChange={e => setPreviousDues(e.target.value)} placeholder="0" />
        <div className="text-[10px] text-[#9C8F6E] mt-1">Only for a one-time starting balance (e.g. migrating from a paper register). For anything ongoing, use "Add Charge" instead — it keeps a dated log.</div>
      </Field>

      <div className="p-3 border rounded-sm mb-3 bg-white" style={{ borderColor: "#3F6B52" }}>
        <div className="text-xs font-semibold text-[#3F6B52] mb-2 flex items-center gap-1.5"><Banknote size={13} /> Advance Payment (optional)</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Amount Received Now (₹)"><input type="number" className={inputCls} style={inputStyle} value={advancePayment} onChange={e => setAdvancePayment(e.target.value)} placeholder="0" /></Field>
          <Field label="Payment Mode">
            <select className={inputCls} style={inputStyle} value={advancePaymentMode} onChange={e => setAdvancePaymentMode(e.target.value)}>
              {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
        </div>
        {(advancePaymentMode === "UPI" || advancePaymentMode === "Bank Transfer") && (
          <Field label="UTR / Reference Number"><input className={inputCls} style={inputStyle} value={advancePaymentRef} onChange={e => setAdvancePaymentRef(e.target.value)} placeholder="e.g. 402913827461" /></Field>
        )}
        {advancePaymentMode === "Cheque" && (
          <Field label="Cheque Number"><input className={inputCls} style={inputStyle} value={advancePaymentRef} onChange={e => setAdvancePaymentRef(e.target.value)} placeholder="e.g. 004521" /></Field>
        )}
        <div className="text-[10px] text-[#9C8F6E]">If an amount is entered here, it's recorded as a Deposit against this student's balance, and a printable Receipt opens right after you save.</div>
      </div>

      <Field label={`Select Subjects / Batches at admission (${batches.length}/6 max)`}>
        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 border bg-white rounded-sm">
          {subjectsList.map(sub => {
            const active = batches.includes(sub);
            return (
              <button key={sub} type="button" onClick={() => toggleSubject(sub)} className="px-2.5 py-1 text-xs rounded-sm border flex items-center gap-1"
                style={{ background: active ? "#12312B" : "white", color: active ? "#F4EFDE" : "#4A4636", borderColor: active ? "#12312B" : "#D8CFB8" }}>
                {active && <Check size={12} />}{sub}
              </button>
            );
          })}
        </div>
        {initial && <div className="text-[10px] text-[#9C8F6E] mt-1">To change subjects from a later month (e.g. add one in September), close this and use "Batches" on the student's row instead.</div>}
      </Field>
      <button onClick={submit} className="w-full mt-3 py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
        {initial ? "Save Changes" : "Register Student"}
      </button>

      {showDupPopup && (
        <Modal title="⚠ Possible Duplicate Registration" onClose={() => setDismissedDupId(dupStudent.id)}>
          <div className="text-sm mb-3 text-[#4A4636]">This Aadhar Number is already registered against an existing student:</div>
          <div className="p-3 rounded-sm border bg-[#FAF6EC] text-sm mb-4 space-y-0.5" style={{ borderColor: "#D8CFB8" }}>
            <div className="font-semibold text-[#12312B]">{dupStudent.name} {dupStudent.studentId ? <span className="font-mono text-xs text-[#9C8F6E]">({dupStudent.studentId})</span> : null}</div>
            <div className="text-xs text-[#6E6650]">Class {dupStudent.class}{dupStudent.stream ? ` · ${dupStudent.stream}` : ""}</div>
            <div className="text-xs text-[#6E6650]">{dupStudent.phone || "No phone on record"}</div>
            <div className="text-xs text-[#6E6650]">Status: <span className="capitalize">{(dupStudent.status || "active").replace("_", " ")}</span></div>
          </div>
          <div className="text-[11px] text-[#9C8F6E] mb-3">This is just a check — nothing is blocked. Confirm whether this is a genuine new admission (e.g. a sibling sharing a guardian's Aadhar) or a duplicate entry, then decide whether to continue, edit the number, or cancel.</div>
          <button onClick={() => setDismissedDupId(dupStudent.id)} className="w-full py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
            Okay, I'll Review This
          </button>
        </Modal>
      )}
    </Modal>
  );
}


export function ExitStudentModal({ student, currentDue, onClose, onConfirm }) {
  const [reason, setReason] = useState("Passed");
  const [exitDate, setExitDate] = useState(todayStr());
  return (
    <Modal title={`End / Pause Enrollment — ${student.name}`} onClose={onClose}>
      <div className="p-3 bg-[#F7E7E3] border border-[#A63D2F] rounded text-xs mb-4">
        This stops monthly fee generation for this student. Their current outstanding balance (<strong>{fmtINR(currentDue)}</strong>) is carried forward and stays visible on the Dues tab.
        Made a mistake? You can undo this in one click from the student's row right after confirming.
      </div>
      <Field label="Reason">
        <div className="space-y-1.5">
          {EXIT_REASONS.map(r => (
            <label key={r.value} className="flex items-center gap-2 text-sm p-2 border rounded-sm cursor-pointer" style={{ borderColor: reason === r.value ? "#12312B" : "#D8CFB8", background: reason === r.value ? "#F5F0E1" : "white" }}>
              <input type="radio" name="exitReason" checked={reason === r.value} onChange={() => setReason(r.value)} />
              {r.label}
            </label>
          ))}
        </div>
      </Field>
      <Field label="Effective Date"><input type="date" className={inputCls} style={inputStyle} value={exitDate} onChange={e => setExitDate(e.target.value)} /></Field>
      <button onClick={() => onConfirm(reason, exitDate)} className="w-full mt-3 py-2.5 rounded-sm text-sm font-semibold text-white" style={{ background: "#A63D2F" }}>Confirm</button>
    </Modal>
  );
}


export function BatchChangeModal({ student, subjectsList, curMonth, onClose, onSave }) {
  const [fromMonth, setFromMonth] = useState(curMonth);
  const [batches, setBatches] = useState(student.batches || []);
  const minMonth = student.admissionMonth || curMonth;
  const sortedHistory = [...(student.batchHistory || [])].sort((a, b) => (a.fromMonth < b.fromMonth ? -1 : 1));

  function toggleSubject(sub) {
    setBatches(prev => prev.includes(sub) ? prev.filter(x => x !== sub) : (prev.length >= 6 ? prev : [...prev, sub]));
  }
  function submit() {
    if (fromMonth < minMonth) { alert(`Effective month can't be before this student's start month (${monthLabel(minMonth)}).`); return; }
    onSave(student, fromMonth, batches);
  }

  return (
    <Modal title={`Change Batches — ${student.name}`} onClose={onClose}>
      <div className="text-xs text-[#6E6650] mb-3">Pick the month this change should start from. Months before it keep using whatever subjects applied back then — nothing already billed gets recalculated.</div>
      <Field label="Effective From Month"><input type="month" min={minMonth} className={inputCls} style={inputStyle} value={fromMonth} onChange={e => setFromMonth(e.target.value)} /></Field>
      <Field label={`Subjects from ${monthLabel(fromMonth)} onward (${batches.length}/6)`}>
        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 border bg-white rounded-sm">
          {subjectsList.map(sub => {
            const active = batches.includes(sub);
            return (
              <button key={sub} type="button" onClick={() => toggleSubject(sub)} className="px-2.5 py-1 text-xs rounded-sm border flex items-center gap-1"
                style={{ background: active ? "#12312B" : "white", color: active ? "#F4EFDE" : "#4A4636", borderColor: active ? "#12312B" : "#D8CFB8" }}>
                {active && <Check size={12} />}{sub}
              </button>
            );
          })}
        </div>
      </Field>
      {sortedHistory.length > 0 && (
        <div className="mt-3 p-3 border rounded bg-white" style={{ borderColor: "#D8CFB8" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="uppercase tracking-wide text-[#9C8F6E] mb-1.5">Existing timeline</div>
          <div className="space-y-1">
            {sortedHistory.map((h, i) => (
              <div key={i} className="text-xs flex justify-between gap-3">
                <span className="font-mono text-[#6E6650] shrink-0">{monthLabel(h.fromMonth)} →</span>
                <span className="text-[#4A4636] text-right">{(h.batches || []).join(", ") || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <button onClick={submit} className="w-full mt-3 py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>Save Batch Change</button>
    </Modal>
  );
}


export function PromoteModal({ student, classes, subjectsList, curMonth, onClose, onPromote }) {
  const [newClass, setNewClass] = useState(student.class);
  const [newBatches, setNewBatches] = useState(student.batches || []);
  const [newStartMonth, setNewStartMonth] = useState(curMonth);
  const [monthlyDiscount, setMonthlyDiscount] = useState(student.monthlyDiscount || 0);

  function toggleSubject(sub) {
    setNewBatches(prev => prev.includes(sub) ? prev.filter(x => x !== sub) : (prev.length >= 6 ? prev : [...prev, sub]));
  }
  function submit() { onPromote(student, newClass, newBatches, newStartMonth, monthlyDiscount); }

  return (
    <Modal title={`${(student.status || "active") === "dropped" ? "Reactivate" : "Promote / Re-Enroll"}: ${student.name}`} onClose={onClose}>
      <div className="p-3 bg-[#EAF1EA] border border-[#3F6B52] rounded text-xs mb-3">
        Carried Dues from previous sessions: <strong>{fmtINR(student.previousDues || 0)}</strong>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="New Class">
          <select className={inputCls} style={inputStyle} value={newClass} onChange={e => setNewClass(e.target.value)}>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Fee Resume Start Month"><input type="month" className={inputCls} style={inputStyle} value={newStartMonth} onChange={e => setNewStartMonth(e.target.value)} /></Field>
      </div>
      <Field label="Monthly Concession (₹)"><input type="number" className={inputCls} style={inputStyle} value={monthlyDiscount} onChange={e => setMonthlyDiscount(e.target.value)} /></Field>
      <Field label={`Select Subjects (${newBatches.length}/6)`}>
        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 border bg-white rounded-sm">
          {subjectsList.map(sub => {
            const active = newBatches.includes(sub);
            return (
              <button key={sub} type="button" onClick={() => toggleSubject(sub)} className="px-2.5 py-1 text-xs rounded-sm border flex items-center gap-1"
                style={{ background: active ? "#12312B" : "white", color: active ? "#F4EFDE" : "#4A4636", borderColor: active ? "#12312B" : "#D8CFB8" }}>
                {active && <Check size={12} />}{sub}
              </button>
            );
          })}
        </div>
      </Field>
      <button onClick={submit} className="w-full mt-3 py-2.5 rounded-sm text-sm font-semibold bg-[#3F6B52] text-white">
        {(student.status || "active") === "dropped" ? "Reactivate Student & Resume Fee Counter" : "Promote Student & Resume Fee Counter"}
      </button>
    </Modal>
  );
}


export function AcademicHistoryModal({ student, onClose }) {
  const history = student.academicHistory || [];
  const batchTimeline = [...(student.batchHistory || [])].sort((a, b) => (a.fromMonth < b.fromMonth ? -1 : 1));
  return (
    <Modal title={`Academic Audit Log — ${student.name}`} onClose={onClose}>
      <div className="space-y-3">
        {history.length === 0 ? (
          <div className="text-sm text-[#9C8F6E] p-4 text-center">No past academic cycles recorded yet.</div>
        ) : (
          history.map((h, i) => (
            <div key={i} className="p-3 border rounded bg-white" style={{ borderColor: "#D8CFB8" }}>
              <div className="flex justify-between items-center text-sm font-semibold text-[#12312B]">
                <span>{h.class}</span>
                <Stamp text={h.resultStatus || "Completed"} tone={h.resultStatus === "Dropped" ? "overdue" : "paid"} />
              </div>
              <div className="text-xs text-[#6E6650] mt-1">Subjects: {(h.batches || []).join(", ") || "General"}</div>
              <div className="text-[11px] text-[#9C8F6E] mt-1 flex justify-between" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                <span>Joined: {monthLabel(h.admissionMonth)}</span>
                <span>Ended: {h.completionDate ? fmtDate(h.completionDate) : "—"}</span>
              </div>
              {h.unpaidBalanceAtEnd > 0 && (
                <div className="text-[11px] text-[#A63D2F] mt-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Balance carried forward: {fmtINR(h.unpaidBalanceAtEnd)}</div>
              )}
            </div>
          ))
        )}
      </div>
      {batchTimeline.length > 0 && (
        <div className="mt-4 pt-4" style={{ borderTop: "1.5px solid #26231D" }}>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-sm font-semibold mb-2">Batch change timeline</div>
          <div className="space-y-1">
            {batchTimeline.map((h, i) => (
              <div key={i} className="text-xs flex justify-between gap-3 p-2 rounded bg-[#FAF6EC]">
                <span className="font-mono text-[#6E6650] shrink-0">{monthLabel(h.fromMonth)} →</span>
                <span className="text-[#4A4636] text-right">{(h.batches || []).join(", ") || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}


export function AddChargeModal({ students, charges, initialStudent, curMonth, onClose, onSave }) {
  const [studentId, setStudentId] = useState(initialStudent?.id || students[0]?.id || "");
  const [studentSearch, setStudentSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [month, setMonth] = useState(curMonth);
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [date, setDate] = useState(todayStr());

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

  const recentChargesForStudent = useMemo(() => {
    if (!studentId || !charges) return [];
    return charges.filter(c => c.studentId === studentId).sort((a, b) => compareChrono(a, b, -1)).slice(0, 5);
  }, [charges, studentId]);

  function submit() {
    if (!studentId || !amount) return;
    onSave({ studentId, month, amount: Number(amount), remarks: remarks.trim(), date });
  }

  return (
    <Modal title="Add Additional Charge" onClose={onClose}>
      <div className="text-xs text-[#6E6650] mb-3">Use this for anything outside regular tuition — exam fee, study material, late fee, damaged equipment, etc. It's logged permanently with a date and remark, and adds straight to the student's balance.</div>

      <Field label="Student">
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

      {student && recentChargesForStudent.length > 0 && (
        <div className="mb-3 p-2.5 rounded-sm border bg-white text-xs" style={{ borderColor: "#D8CFB8" }}>
          <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1.5">Existing charges for {student.name}</div>
          <div className="space-y-1">
            {recentChargesForStudent.map(c => (
              <div key={c.id} className="flex items-center justify-between">
                <span className="text-[#6E6650]">{c.chargeId || `CHG-${shortId(c.id)}`} · {fmtDate(c.date)} · {c.remarks || monthLabel(c.month)}</span>
                <span className="font-mono font-semibold text-[#B8862B]">{fmtINR(c.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="For Month"><input type="month" className={inputCls} style={inputStyle} value={month} onChange={e => setMonth(e.target.value)} /></Field>
        <Field label="Date Added"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
      </div>
      <Field label="Amount (₹)"><input type="number" className={inputCls} style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></Field>
      <Field label="Remarks — what is this charge for?"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g. Annual exam fee" /></Field>
      <button onClick={submit} disabled={!studentId || !amount} className="w-full mt-3 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Add Charge
      </button>
    </Modal>
  );
}

// ============================================================================
// ACADEMIC MONITORING — FORM MODALS. Each reuses the exact same student
// picker (search + class filter, dropdown of matches) as AddChargeModal
// above, so marking attendance, logging a test score, or adding a
// behaviour note all feel consistent with adding a charge. Each modal
// doubles as both "Add" and "Edit" — when `initial` is passed, its id is
// carried through in onSave so the parent's save function knows to update
// the existing record instead of creating a new one (same pattern as
// NoteFormModal / saveNote).
// ============================================================================


export function StudentPickerField({ students, studentId, setStudentId }) {
  const [studentSearch, setStudentSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [pickerOpen, setPickerOpen] = useState(false);

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

  return (
    <Field label="Student">
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
  );
}


export function StudentStatementModal({ student, ledger, onClose, onViewReceipt, onViewCharge }) {
  const statementRef = useRef();
  if (!ledger) return null;

  const generatedOn = fmtDate(todayStr());

  const handlePrintStatement = () => {
    const printContent = statementRef.current.innerHTML;
    const win = window.open("", "", "width=850,height=900");
    // Loads the same Tailwind utility classes + Google Fonts the live app
    // uses, so the printed page renders exactly like the on-screen preview
    // instead of the plain unstyled text a bare popup window would produce.
    win.document.write(`
      <html>
        <head>
          <title>Account Statement - ${student.name}</title>
          <script src="https://cdn.tailwindcss.com"><\/script>
          <style>
            ${FONT_IMPORT}
            @page { size: A4; margin: 14mm; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { font-family: 'Inter', sans-serif; color: #12312B; background: #fff; margin: 0; }
            .stmt-doc { border: 1.5px solid #B8862B; border-radius: 4px; padding: 22px; }
            .stmt-doc::before { content: ""; display: block; height: 3px; background: #12312B; margin: -22px -22px 18px -22px; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
          </style>
        </head>
        <body>
          <div class="stmt-doc">${printContent}</div>
        </body>
      </html>
    `);
    win.document.close(); win.focus(); setTimeout(() => { win.print(); win.close(); }, 300);
  };

  return (
    <WideModal title={`Statement — ${student.name}${student.studentId ? ` (${student.studentId})` : ""}`} onClose={onClose}>
      <div ref={statementRef}>
        {/* Letterhead — mirrors the official receipt so the statement reads as one professional record system */}
        <div className="text-center pb-3 mb-4 border-b-2 border-dashed border-[#12312B]">
          <InstituteHeader subtitle={`Official Account Statement — All Recorded Transactions`} large={false} />
        </div>

        {/* Student / account details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mb-4 text-xs">
          <div className="flex justify-between border-b border-dotted pb-1" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Student Name:</span><strong className="text-[#12312B]">{student.name}</strong></div>
          <div className="flex justify-between border-b border-dotted pb-1" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Student ID:</span><strong className="text-[#12312B]">{student.studentId || "—"}</strong></div>
          <div className="flex justify-between border-b border-dotted pb-1" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Statement Date:</span><strong className="text-[#12312B]">{generatedOn}</strong></div>
          <div className="flex justify-between border-b border-dotted pb-1" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Class:</span><strong className="text-[#12312B]">{student.class}</strong></div>
          <div className="flex justify-between border-b border-dotted pb-1" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Phone:</span><strong className="text-[#12312B]">{student.phone || "—"}</strong></div>
          <div className="flex justify-between border-b border-dotted pb-1" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Fee Start Month:</span><strong className="text-[#12312B]">{monthLabel(student.admissionMonth)}</strong></div>
          <div className="flex justify-between border-b border-dotted pb-1" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Status:</span><strong className="text-[#12312B] capitalize">{(student.status || "active").replace("_", " ")}</strong></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="p-2.5 rounded bg-[#FAF6EC] border" style={{ borderColor: "#D8CFB8" }}>
            <div className="text-[10px] uppercase text-[#9C8F6E] font-mono">Total Charged</div>
            <div className="text-lg font-bold" style={{ fontFamily: "'Zilla Slab', serif" }}>{fmtINR(ledger.totalCharged)}</div>
          </div>
          <div className="p-2.5 rounded bg-[#EAF1EA] border" style={{ borderColor: "#3F6B52" }}>
            <div className="text-[10px] uppercase text-[#3F6B52] font-mono">Total Cleared</div>
            <div className="text-lg font-bold text-[#3F6B52]" style={{ fontFamily: "'Zilla Slab', serif" }}>{fmtINR(ledger.totalCleared)}</div>
          </div>
          <div className="p-2.5 rounded bg-[#F7E7E3] border" style={{ borderColor: "#A63D2F" }}>
            <div className="text-[10px] uppercase text-[#A63D2F] font-mono">Current Balance</div>
            <div className="text-lg font-bold text-[#A63D2F]" style={{ fontFamily: "'Zilla Slab', serif" }}>{fmtINR(ledger.balance)}</div>
          </div>
        </div>

        {ledger.timeline.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">No transactions recorded yet for this student.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Charge / Receipt No", "Date", "Charges Month", "Description", "Remarks", "Debit", "Credit", "Balance"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-3 py-2 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.timeline.map((l, i) => (
                <tr key={i} className="ledger-row">
                  <td className="px-3 py-2 font-mono">
                    {l.kind === "credit" && (l.type === "payment" || l.type === "writeoff") ? (
                      onViewReceipt ? (
                        <button
                          onClick={() => onViewReceipt(l.depositId)}
                          className="underline text-[#12312B] font-semibold inline-flex items-center gap-1 hover:text-[#3F6B52]"
                          title={l.type === "writeoff" ? "Open the receipt this write-off was recorded against" : "Open official receipt for this payment"}
                        >
                          <Receipt size={10} /> #{l.receiptNo}
                        </button>
                      ) : (
                        <span className="text-[#6E6650]">#{l.receiptNo}</span>
                      )
                    ) : l.kind === "debit" && onViewCharge && l.chargeId ? (
                      <button onClick={() => onViewCharge(l)} className="text-[#12312B] underline hover:text-[#3F6B52]" title="Open printable receipt">{l.chargeId}</button>
                    ) : (
                      <span className="text-[#9C8F6E]">{l.chargeId || "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{fmtDate(l.date)}</td>
                  <td className="px-3 py-2 font-mono">{l.month ? monthLabel(l.month) : "—"}</td>
                  <td className="px-3 py-2">{l.label}</td>
                  <td className="px-3 py-2 text-[#6E6650]">{l.remarks || "—"}</td>
                  <td className="px-3 py-2 font-mono text-[#A63D2F]">{l.kind === "debit" ? fmtINR(l.amount) : ""}</td>
                  <td className="px-3 py-2 font-mono text-[#3F6B52]">{l.kind === "credit" ? fmtINR(l.amount) : ""}</td>
                  <td className="px-3 py-2 font-mono font-semibold">{fmtINR(l.runningBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="text-center pt-3 mt-4 border-t border-dashed border-[#12312B] text-[10px] text-[#9C8F6E]">
          This statement reflects every deposit, tuition charge, additional charge, and write-off recorded for this student · Computer Generated Statement
        </div>
      </div>

      <button onClick={handlePrintStatement} className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]">
        <Printer size={15} /> Print / Export Statement
      </button>
    </WideModal>
  );
}


export function JoiningFormModal({ student, deposits, onClose }) {
  const formRef = useRef();
  const instituteSettings = React.useContext(InstituteSettingsContext);
  if (!student) return null;

  // The one-time Advance Payment captured on the Student form (if any) is
  // stored as a regular Deposit tagged with this exact remark — look it up
  // so the Joining Form can show what was actually collected at admission.
  const advanceDeposit = (deposits || []).find(d => d.studentId === student.id && !d.deleted && d.remarks === "Advance Payment at Admission");
  const advanceAmount = advanceDeposit ? Number(advanceDeposit.amount) || 0 : 0;
  const admissionNo = `ADM-${shortId(student.id)}`;

  const handlePrint = () => {
    const printContent = formRef.current.innerHTML;
    const win = window.open("", "", "width=900,height=1000");
    win.document.write(`
      <html>
        <head>
          <title>Joining Form - ${student.name}</title>
          <style>
            ${FONT_IMPORT}
            @page { size: A4; margin: 16mm; }
            body { font-family: 'Inter', sans-serif; padding: 0; color: #12312B; }
            .form-box { max-width: 100%; margin: auto; border: 1.5px solid #B8862B; padding: 22px; border-radius: 4px; }
            .form-box::before { content: ""; display: block; height: 3px; background: #12312B; margin: -22px -22px 18px -22px; }
            .admission-no { text-align: right; font-family: monospace; font-size: 11px; color: #8A6420; letter-spacing: 0.06em; margin-bottom: 4px; }
            .header { text-align: center; border-bottom: 2px dashed #12312B; padding-bottom: 12px; margin-bottom: 18px; }
            .section-title { font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #8A6420; border-bottom: 1px solid #D8CFB8; padding-bottom: 4px; margin: 18px 0 10px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; }
            .row { font-size: 13px; padding: 6px 0; border-bottom: 1px dotted #D8CFB8; display: flex; justify-content: space-between; }
            .label { color: #6E6650; }
            .value { font-weight: 600; color: #12312B; }
            .footer { border-top: 1.5px solid #12312B; padding-top: 10px; margin-top: 24px; text-align: center; font-size: 10px; color: #6E6650; }
            .sign-row { display: flex; justify-content: space-between; margin-top: 60px; font-size: 12px; }
            .sign-line { border-top: 1px solid #12312B; padding-top: 4px; width: 200px; text-align: center; }
          </style>
        </head>
        <body><div class="form-box">${printContent}</div></body>
      </html>
    `);
    win.document.close(); win.focus(); win.print(); win.close();
  };

  const statusLabel = (student.status || "active") === "active" ? "Active" : (student.status === "dropped" ? "Dropped Out" : (student.resultStatus || "On Break"));
  const statusTone = (student.status || "active") === "active" ? "paid" : student.status === "dropped" ? "overdue" : "break";

  return (
    <WideModal title="Student Joining Form" onClose={onClose}>
      <div
        className="joining-form-doc p-6 bg-white rounded-sm mb-4"
        ref={formRef}
        style={{ border: "1.5px solid #B8862B", borderRadius: "4px", boxShadow: "0 1px 3px rgba(18,49,43,0.08)" }}
      >
        <div className="text-right font-mono text-[11px] mb-1" style={{ color: "#8A6420", letterSpacing: "0.06em" }}>{admissionNo}</div>
        <div className="header">
          <InstituteHeader subtitle={`Student Joining / Admission Form`} large={true} />
        </div>

        <div className="section-title">Student Details</div>
        <div className="grid">
          <div className="row"><span className="label">Full Name</span><span className="value">{student.name || "—"}</span></div>
          <div className="row"><span className="label">Student ID</span><span className="value">{student.studentId || "—"}</span></div>
          <div className="row"><span className="label">Father's Name</span><span className="value">{student.fatherName || "—"}</span></div>
          <div className="row"><span className="label">Gender</span><span className="value">{student.gender || "—"}</span></div>
          <div className="row"><span className="label">Aadhar Number</span><span className="value">{student.aadharNumber || "—"}</span></div>
          <div className="row"><span className="label">Date of Birth</span><span className="value">{student.dob ? fmtDate(student.dob) : "—"}</span></div>
          <div className="row"><span className="label">Joining Date</span><span className="value">{student.joiningDate ? fmtDate(student.joiningDate) : "—"}</span></div>
          <div className="row"><span className="label">Status</span><span className="value"><Stamp text={statusLabel} tone={statusTone} /></span></div>
          <div className="row"><span className="label">Current School / Institution</span><span className="value">{student.currentSchool || "—"}</span></div>
        </div>

        <div className="section-title">Contact Details</div>
        <div className="grid">
          <div className="row"><span className="label">Phone / WhatsApp Number</span><span className="value">{student.phone || "—"}</span></div>
          <div className="row"><span className="label">Guardian Phone Number</span><span className="value">{student.guardianPhone || "—"}</span></div>
          <div className="row"><span className="label">Email Address</span><span className="value">{student.email || "—"}</span></div>
        </div>
        <div className="row"><span className="label">Address</span><span className="value">{student.address || "—"}</span></div>

        <div className="section-title">Academic Details</div>
        <div className="grid">
          <div className="row"><span className="label">Class</span><span className="value">{student.class || "—"}</span></div>
          <div className="row"><span className="label">Stream</span><span className="value">{student.stream || "—"}</span></div>
          <div className="row"><span className="label">Fee Start Month</span><span className="value">{monthLabel(student.admissionMonth)}</span></div>
          <div className="row"><span className="label">Subjects / Batches</span><span className="value">{(student.batches || []).join(", ") || "—"}</span></div>
          <div className="row"><span className="label">Monthly Concession / Discount</span><span className="value">{fmtINR(student.monthlyDiscount || 0)}</span></div>
        </div>

        <div className="section-title">Fee Details</div>
        <div className="grid">
          <div className="row"><span className="label">Opening Balance / Legacy Carried Dues</span><span className="value">{fmtINR(student.previousDues || 0)}</span></div>
          <div className="row">
            <span className="label">Advance Amount Paid at Admission</span>
            <span className="value" style={{ color: advanceAmount > 0 ? "#3F6B52" : undefined }}>
              {fmtINR(advanceAmount)}{advanceDeposit ? ` (${advanceDeposit.mode || "Cash"})` : ""}
            </span>
          </div>
          <div className="row"><span className="label">Form Generated On</span><span className="value">{fmtDate(todayStr())}</span></div>
        </div>

        <div className="sign-row">
          <div className="sign-line">Parent / Guardian Signature</div>
          <div className="sign-line">Authorized Signatory</div>
        </div>

        <div className="footer">
          Computer Generated Joining Form · {instituteSettings.instituteName || "COACHING CLASSES"} Admission Record · {admissionNo}
        </div>
      </div>
      <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]"><Printer size={15} /> Print Joining Form (A4)</button>
    </WideModal>
  );
}

