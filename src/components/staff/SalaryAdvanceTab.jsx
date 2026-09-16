import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Printer, Search, Undo2 } from "lucide-react";
import { Card, Field, InstituteHeader, Modal, SectionHeader, Stamp, WideModal, inputCls, inputStyle } from "../common/UI";
import { PersonPicker } from "./StaffTab";
import { FONT_IMPORT, PAYMENT_MODES } from "../../constants/appConstants";
import { compareChrono, currentMonthKey, fmtDate, monthLabel, todayStr } from "../../lib/dates";
import { openAdvancesFor } from "../../lib/finance";
import { fmtINR, round2 } from "../../lib/money";

export function SalaryTab({ salaryPayments, persons, onAdd, onViewSlip, onRemove, onStatement }) {
  const [monthFilter, setMonthFilter] = useState("");
  const [search, setSearch] = useState("");

  const sorted = useMemo(() => [...salaryPayments].sort((a, b) => compareChrono(a, b, -1)), [salaryPayments]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter(p => {
      if (monthFilter && p.month !== monthFilter) return false;
      if (!q) return true;
      return [p.personName, p.personRole, p.slipId].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [sorted, monthFilter, search]);

  return (
    <div>
      <SectionHeader eyebrow="Payroll" title="Salary" action={
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Pay Salary
        </button>
      } />
      <Card className="p-3.5 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Search</div>
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" style={{ marginTop: "9px" }} />
            <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, role, or slip ID…" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Month</div>
            <input type="month" className={inputCls} style={inputStyle} value={monthFilter} onChange={e => setMonthFilter(e.target.value)} />
          </div>
        </div>
      </Card>
      <Card>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">{salaryPayments.length === 0 ? "No salary payments recorded yet." : "No salary payments match this filter."}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Date", "Person", "Month", "Base", "Advance Deducted", "Net Paid", "Mode", "Slip", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="ledger-row">
                  <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{fmtDate(p.date)}</td>
                  <td className="px-4 py-2.5 font-medium">
                    {onStatement ? (
                      <button onClick={() => onStatement(p.personId, p.personType)} className="underline hover:text-[#3F6B52]">{p.personName}</button>
                    ) : p.personName}
                    <div className="text-[10px] text-[#9C8F6E]">{p.personRole}{p.personType === "teacher" ? " · Teacher" : " · Staff"}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono">{monthLabel(p.month)}</td>
                  <td className="px-4 py-2.5 text-xs font-mono">{fmtINR(p.baseAmount)}</td>
                  <td className="px-4 py-2.5 text-xs font-mono text-[#B8862B]">{p.advanceDeducted > 0 ? fmtINR(p.advanceDeducted) : "—"}</td>
                  <td className="px-4 py-2.5 text-xs font-mono font-semibold text-[#3F6B52]">{fmtINR(p.netPaid)}</td>
                  <td className="px-4 py-2.5 text-xs">{p.mode || "Cash"}</td>
                  <td className="px-4 py-2.5 text-xs font-mono">{p.slipId}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => onViewSlip(p)} className="text-xs text-[#12312B] underline mr-3">Slip</button>
                    <button onClick={() => onRemove(p.id)} className="text-xs text-[#A63D2F] underline">Remove</button>
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


export function SalaryFormModal({ persons, advances, onClose, onSave }) {
  const [personKey, setPersonKey] = useState(persons[0] ? `${persons[0].personType}:${persons[0].personId}` : "");
  const selected = persons.find(p => `${p.personType}:${p.personId}` === personKey);
  const [month, setMonth] = useState(currentMonthKey());
  const [baseAmount, setBaseAmount] = useState(selected?.salaryAmount || "");
  const [mode, setMode] = useState(selected?.paymentMode || "Cash");
  const [date, setDate] = useState(todayStr());
  const [remarks, setRemarks] = useState("");
  const [advanceDeductInput, setAdvanceDeductInput] = useState("");

  // When the selected person changes, default the amount/mode fields from
  // their record — same "default-fill from salaryAmount" pattern already
  // used in TeacherFormModal / StaffFormModal — and reset the advance
  // deduction so it's never carried over onto a different person.
  useEffect(() => {
    setBaseAmount(selected?.salaryAmount || "");
    setMode(selected?.paymentMode || "Cash");
    setAdvanceDeductInput("");
  }, [personKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sourced from the same shared openAdvancesFor() helper saveSalaryPayment()
  // uses, so this live preview and the actual settlement can never disagree.
  const outstandingAdvance = useMemo(() => {
    if (!selected) return 0;
    return round2(openAdvancesFor(advances, selected.personId, selected.personType)
      .reduce((sum, a) => sum + (Number(a.outstandingAmount) || 0), 0));
  }, [advances, selected]);

  const deduct = Math.min(Number(advanceDeductInput) || 0, outstandingAdvance);
  const netPayable = round2((Number(baseAmount) || 0) - deduct);

  function submit() {
    if (!selected || !month || !(Number(baseAmount) > 0)) return;
    onSave({
      personId: selected.personId, personType: selected.personType, personName: selected.name, personRole: selected.role,
      month, baseAmount: Number(baseAmount) || 0, advanceDeducted: deduct, mode, date, remarks: remarks.trim(),
    });
  }

  return (
    <Modal title="Pay Salary" onClose={onClose}>
      <Field label="Select Teacher / Staff Member">
        <PersonPicker persons={persons} value={personKey} onChange={setPersonKey} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="For Month"><input type="month" className={inputCls} style={inputStyle} value={month} onChange={e => setMonth(e.target.value)} /></Field>
        <Field label="Date Paid"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
      </div>
      <Field label="Base Salary Amount (₹)"><input type="number" className={inputCls} style={inputStyle} value={baseAmount} onChange={e => setBaseAmount(e.target.value)} placeholder="0" /></Field>

      {outstandingAdvance > 0 && (
        <div className="p-3 border rounded-sm mb-3 bg-white" style={{ borderColor: "#B8862B" }}>
          <div className="text-xs font-semibold text-[#8A6420] mb-1.5">Outstanding Advance: {fmtINR(outstandingAdvance)}</div>
          <Field label="Deduct From This Salary (₹, optional)">
            <input type="number" className={inputCls} style={inputStyle} value={advanceDeductInput}
              onChange={e => setAdvanceDeductInput(e.target.value)} placeholder="0" max={outstandingAdvance} />
          </Field>
          <button type="button" onClick={() => setAdvanceDeductInput(String(outstandingAdvance))} className="text-[10px] text-[#8A6420] underline">
            Deduct full outstanding amount
          </button>
        </div>
      )}

      <Field label="Payment Mode">
        <div className="flex gap-2 flex-wrap">
          {PAYMENT_MODES.map(m => (
            <button key={m} type="button" onClick={() => setMode(m)} className="px-3 py-1.5 text-xs rounded-sm border font-semibold"
              style={{ background: mode === m ? "#12312B" : "white", color: mode === m ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
              {m}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Remarks (optional)"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any note for this payment" /></Field>

      <div className="text-xs text-[#6E6650] mb-3 flex justify-between">
        <span>Net Payable Now:</span>
        <strong className={netPayable >= 0 ? "text-[#3F6B52]" : "text-[#A63D2F]"}>{fmtINR(netPayable)}</strong>
      </div>

      <button onClick={submit} className="w-full mt-2 py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Pay Salary & Generate Slip
      </button>
    </Modal>
  );
}


export function SalarySlipModal({ payment, onClose }) {
  const slipRef = useRef();
  if (!payment) return null;

  const handlePrint = () => {
    const printContent = slipRef.current.innerHTML;
    const win = window.open("", "", "width=850,height=1000");
    win.document.write(`
      <html>
        <head>
          <title>Salary Slip - ${payment.slipId || ""}</title>
          <script src="https://cdn.tailwindcss.com"><\/script>
          <style>
            ${FONT_IMPORT}
            @page { size: A4; margin: 16mm; }
            body { font-family: 'Inter', sans-serif; color: #26231D; }
          </style>
        </head>
        <body>${printContent}</body>
      </html>
    `);
    win.document.close(); win.focus(); win.print(); win.close();
  };

  return (
    <Modal title="Salary Slip" onClose={onClose}>
      <div className="p-4 border bg-white rounded-sm mb-4" ref={slipRef} style={{ borderColor: "#12312B" }}>
        <div className="text-center pb-3 mb-3 border-b-2 border-dashed border-[#12312B]">
          <InstituteHeader subtitle={`Official Salary Slip`} large={false} />
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-[#6E6650]">
            <span>Slip ID: <strong className="text-[#12312B]">{payment.slipId}</strong></span>
            <span>Date: <strong className="text-[#12312B]">{fmtDate(payment.date)}</strong></span>
          </div>
          <div className="flex justify-between text-[#6E6650]"><span>Employee Name:</span><strong className="text-[#12312B]">{payment.personName}</strong></div>
          <div className="flex justify-between text-[#6E6650]"><span>Role / Designation:</span><strong className="text-[#12312B]">{payment.personRole}{payment.personType === "teacher" ? " (Teacher)" : " (Staff)"}</strong></div>
          <div className="flex justify-between text-[#6E6650]"><span>For Month:</span><strong className="text-[#12312B]">{monthLabel(payment.month)}</strong></div>
          {payment.remarks && <div className="flex justify-between text-[#6E6650]"><span>Remarks:</span><strong className="text-[#12312B]">{payment.remarks}</strong></div>}

          <div className="pt-3 mt-3 border-t-2 border-[#12312B] space-y-1">
            <div className="flex justify-between"><span>Base Salary:</span><strong>{fmtINR(payment.baseAmount)}</strong></div>
            {payment.advanceDeducted > 0 && (
              <div className="flex justify-between text-[#B8862B]">
                <span>
                  Advance Deducted{(payment.settledAdvances || []).length > 0 ? ` (${payment.settledAdvances.map(s => s.advanceRefId).filter(Boolean).join(", ")})` : ""}:
                </span>
                <strong>− {fmtINR(payment.advanceDeducted)}</strong>
              </div>
            )}
            <div className="flex justify-between items-center text-sm pt-1 mt-1 border-t" style={{ borderColor: "#D8CFB8" }}>
              <span className="font-bold">Net Amount Paid:</span>
              <span className="font-bold text-[#3F6B52] text-lg" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(payment.netPaid)}</span>
            </div>
            <div className="flex justify-between text-[#6E6650]"><span>Payment Mode:</span><strong className="text-[#12312B]">{payment.mode || "Cash"}</strong></div>
          </div>
        </div>
        <div className="sign-row" style={{ display: "flex", justifyContent: "space-between", marginTop: "32px" }}>
          <div className="sign-line" style={{ borderTop: "1px solid #12312B", width: "45%", textAlign: "center", paddingTop: "4px", fontSize: "11px" }}>Employee Signature</div>
          <div className="sign-line" style={{ borderTop: "1px solid #12312B", width: "45%", textAlign: "center", paddingTop: "4px", fontSize: "11px" }}>Authorized Signatory</div>
        </div>
        <div className="text-center pt-3 mt-3 border-t border-dashed border-[#12312B] text-[10px] text-[#9C8F6E]">
          Computer Generated Salary Slip
        </div>
      </div>
      <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]"><Printer size={15} /> Print Salary Slip</button>
    </Modal>
  );
}


export function AdvanceTab({ advances, advanceReturns, persons, onAdd, onReturn, onRemove, onRemoveReturn, onStatement }) {
  const sorted = useMemo(() => [...advances].sort((a, b) => compareChrono(a, b, -1)), [advances]);
  // Advance Returns history — same sort convention as the Advances table
  // above. See UPDATE NOTES entry for the "Return Advance" feature.
  const sortedReturns = useMemo(() => [...(advanceReturns || [])].sort((a, b) => compareChrono(a, b, -1)), [advanceReturns]);
  return (
    <div>
      <SectionHeader eyebrow="Payroll" title="Advance" action={
        <div className="flex gap-2">
          <button onClick={onReturn} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
            <Undo2 size={15} /> Return Advance
          </button>
          <button onClick={onAdd} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
            <Plus size={15} /> Give Advance
          </button>
        </div>
      } />
      <Card className="mb-6">
        {sorted.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">No advances recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Date", "Person", "Amount Given", "Settled", "Outstanding", "Mode", "Status", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(a => {
                const settled = round2((Number(a.amount) || 0) - (Number(a.outstandingAmount) || 0));
                const isSettled = (a.status || "open") === "settled";
                return (
                  <tr key={a.id} className="ledger-row">
                    <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{fmtDate(a.date)}</td>
                    <td className="px-4 py-2.5 font-medium">
                      {onStatement ? (
                        <button onClick={() => onStatement(a.personId, a.personType)} className="underline hover:text-[#3F6B52]">{a.personName}</button>
                      ) : a.personName}
                      <div className="text-[10px] text-[#9C8F6E]">{a.personRole}{a.personType === "teacher" ? " · Teacher" : " · Staff"} · {a.advanceId}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono">{fmtINR(a.amount)}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-[#3F6B52]">{fmtINR(settled)}</td>
                    <td className="px-4 py-2.5 text-xs font-mono font-semibold text-[#A63D2F]">{fmtINR(a.outstandingAmount)}</td>
                    <td className="px-4 py-2.5 text-xs">{a.mode || "Cash"}</td>
                    <td className="px-4 py-2.5 text-xs"><Stamp text={isSettled ? "Settled" : "Open"} tone={isSettled ? "paid" : "overdue"} /></td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onRemove(a.id)} className="text-xs text-[#A63D2F] underline">Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Advance Returns history — direct cash-back records, separate from
          the settlements made via Salary deductions above. See UPDATE
          NOTES entry for the "Return Advance" feature. */}
      <div className="mb-3" style={{ fontFamily: "'Zilla Slab', serif" }}><span className="text-lg font-semibold">Advance Returns</span></div>
      <Card>
        {sortedReturns.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">No advance returns recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Date", "Person", "Amount Returned", "Mode", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedReturns.map(r => (
                <tr key={r.id} className="ledger-row">
                  <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{fmtDate(r.date)}</td>
                  <td className="px-4 py-2.5 font-medium">
                    {onStatement ? (
                      <button onClick={() => onStatement(r.personId, r.personType)} className="underline hover:text-[#3F6B52]">{r.personName}</button>
                    ) : r.personName}
                    <div className="text-[10px] text-[#9C8F6E]">{r.personRole}{r.personType === "teacher" ? " · Teacher" : " · Staff"} · {r.returnId}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono text-[#3F6B52]">{fmtINR(r.amount)}</td>
                  <td className="px-4 py-2.5 text-xs">{r.mode || "Cash"}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => onRemoveReturn(r.id)} className="text-xs text-[#A63D2F] underline">Remove</button>
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


export function AdvanceFormModal({ persons, onClose, onSave }) {
  const [personKey, setPersonKey] = useState(persons[0] ? `${persons[0].personType}:${persons[0].personId}` : "");
  const selected = persons.find(p => `${p.personType}:${p.personId}` === personKey);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [mode, setMode] = useState("Cash");
  const [remarks, setRemarks] = useState("");

  function submit() {
    if (!selected || !(Number(amount) > 0)) return;
    onSave({
      personId: selected.personId, personType: selected.personType, personName: selected.name, personRole: selected.role,
      amount: Number(amount) || 0, date, mode, remarks: remarks.trim(),
    });
  }

  return (
    <Modal title="Give Advance" onClose={onClose}>
      <Field label="Select Teacher / Staff Member">
        <PersonPicker persons={persons} value={personKey} onChange={setPersonKey} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Amount (₹)"><input type="number" className={inputCls} style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></Field>
        <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
      </div>
      <Field label="Payment Mode">
        <div className="flex gap-2 flex-wrap">
          {PAYMENT_MODES.map(m => (
            <button key={m} type="button" onClick={() => setMode(m)} className="px-3 py-1.5 text-xs rounded-sm border font-semibold"
              style={{ background: mode === m ? "#12312B" : "white", color: mode === m ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
              {m}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Reason / Remarks (optional)"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g. Personal emergency" /></Field>
      <button onClick={submit} className="w-full mt-2 py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Give Advance
      </button>
    </Modal>
  );
}

// Records a teacher/staff member directly returning advance money (e.g.
// handing back cash) outside of a salary run — styled/structured like
// AdvanceFormModal/SalaryFormModal. Shows the person's current outstanding
// advance total once picked, same pattern as SalaryFormModal's
// outstandingAdvance preview (sourced from the same shared
// openAdvancesFor() helper, so the two can never disagree).


export function AdvanceReturnFormModal({ persons, advances, onClose, onSave }) {
  const [personKey, setPersonKey] = useState(persons[0] ? `${persons[0].personType}:${persons[0].personId}` : "");
  const selected = persons.find(p => `${p.personType}:${p.personId}` === personKey);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [mode, setMode] = useState("Cash");
  const [remarks, setRemarks] = useState("");

  const outstandingAdvance = useMemo(() => {
    if (!selected) return 0;
    return round2(openAdvancesFor(advances, selected.personId, selected.personType)
      .reduce((sum, a) => sum + (Number(a.outstandingAmount) || 0), 0));
  }, [advances, selected]);

  function submit() {
    if (!selected || !(Number(amount) > 0)) return;
    onSave({
      personId: selected.personId, personType: selected.personType, personName: selected.name, personRole: selected.role,
      amount: Number(amount) || 0, date, mode, remarks: remarks.trim(),
    });
  }

  return (
    <Modal title="Return Advance" onClose={onClose}>
      <Field label="Select Teacher / Staff Member">
        <PersonPicker persons={persons} value={personKey} onChange={setPersonKey} />
      </Field>
      {selected && (
        <div className="text-xs text-[#6E6650] mb-3 flex justify-between">
          <span>Current Outstanding Advance:</span>
          <strong className={outstandingAdvance > 0 ? "text-[#A63D2F]" : "text-[#3F6B52]"}>{fmtINR(outstandingAdvance)}</strong>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Amount Returned (₹)"><input type="number" className={inputCls} style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" max={outstandingAdvance || undefined} /></Field>
        <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
      </div>
      <Field label="Payment Mode">
        <div className="flex gap-2 flex-wrap">
          {PAYMENT_MODES.map(m => (
            <button key={m} type="button" onClick={() => setMode(m)} className="px-3 py-1.5 text-xs rounded-sm border font-semibold"
              style={{ background: mode === m ? "#12312B" : "white", color: mode === m ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
              {m}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Remarks (optional)"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any note for this return" /></Field>
      <button onClick={submit} className="w-full mt-2 py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Record Advance Return
      </button>
    </Modal>
  );
}

// ---- Infrastructure Management — campus rooms/areas registry (Institute
// Management → Infrastructure Management, right after Advance). Category
// list exactly as specified: academic spaces, admin offices, common areas,
// and campus-wide facilities (Parking, Sports Ground, Main Entry Gate) all
// in one registry, same search/filter/numbering pattern as Batch Schedule.


export function PersonStatementModal({ person, personType, salaryPayments, advances, advanceReturns, onClose, onViewSlip }) {
  if (!person) return null;

  const timeline = useMemo(() => {
    const salaryLines = (salaryPayments || []).map(p => ({
      kind: "salary", date: p.date, createdAt: p.createdAt,
      label: `Salary Paid — ${monthLabel(p.month)}`, amount: p.netPaid, ref: p.slipId, raw: p,
    }));
    const advanceGivenLines = (advances || []).map(a => ({
      kind: "advance_given", date: a.date, createdAt: a.createdAt,
      label: "Advance Given", amount: a.amount, ref: a.advanceId, raw: a,
    }));
    // One settlement line per salary payment that deducted against an
    // advance, so the running outstanding total moves down at the same
    // point in time the deduction actually happened.
    const settlementLines = (salaryPayments || []).flatMap(p =>
      (p.settledAdvances || []).map(s => ({
        kind: "advance_settled", date: p.date, createdAt: p.createdAt,
        label: `Advance Settled (${s.advanceRefId || ""}) via Salary ${p.slipId}`, amount: s.amount, ref: p.slipId, raw: p,
      }))
    );
    // One line per advance actually settled by a direct "Return Advance"
    // record — same breakdown pattern as settlementLines above, and the
    // same reduction to runningOutstanding, just via a return instead of a
    // salary deduction. See the new UPDATE NOTES entry for the "Return
    // Advance" feature.
    const returnLines = (advanceReturns || []).flatMap(r =>
      (r.settledAdvances || []).map(s => ({
        kind: "advance_returned", date: r.date, createdAt: r.createdAt,
        label: `Advance Returned (${s.advanceRefId || ""}) — ${r.returnId}`, amount: s.amount, ref: r.returnId, raw: r,
      }))
    );
    const merged = [...salaryLines, ...advanceGivenLines, ...settlementLines, ...returnLines].sort((a, b) => compareChrono(a, b, 1));
    let runningOutstanding = 0;
    return merged.map(l => {
      if (l.kind === "advance_given") runningOutstanding = round2(runningOutstanding + l.amount);
      if (l.kind === "advance_settled" || l.kind === "advance_returned") runningOutstanding = round2(runningOutstanding - l.amount);
      return { ...l, runningOutstanding };
    }).sort((a, b) => compareChrono(a, b, -1));
  }, [salaryPayments, advances, advanceReturns]);

  const totalSalaryPaid = round2((salaryPayments || []).reduce((sum, p) => sum + (Number(p.netPaid) || 0), 0));
  const totalAdvanceGiven = round2((advances || []).reduce((sum, a) => sum + (Number(a.amount) || 0), 0));
  const totalAdvanceOutstanding = round2((advances || []).filter(a => (a.status || "open") === "open").reduce((sum, a) => sum + (Number(a.outstandingAmount) || 0), 0));

  return (
    <WideModal title={`Statement — ${person.name}${personType === "teacher" ? " (Teacher)" : " (Staff)"}`} onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="p-2.5 rounded bg-[#EAF1EA] border" style={{ borderColor: "#3F6B52" }}>
          <div className="text-[10px] uppercase text-[#3F6B52] font-mono">Total Salary Paid</div>
          <div className="text-lg font-bold text-[#3F6B52]" style={{ fontFamily: "'Zilla Slab', serif" }}>{fmtINR(totalSalaryPaid)}</div>
        </div>
        <div className="p-2.5 rounded bg-[#FAF6EC] border" style={{ borderColor: "#D8CFB8" }}>
          <div className="text-[10px] uppercase text-[#9C8F6E] font-mono">Total Advance Given</div>
          <div className="text-lg font-bold" style={{ fontFamily: "'Zilla Slab', serif" }}>{fmtINR(totalAdvanceGiven)}</div>
        </div>
        <div className="p-2.5 rounded bg-[#F7E7E3] border" style={{ borderColor: "#A63D2F" }}>
          <div className="text-[10px] uppercase text-[#A63D2F] font-mono">Advance Outstanding</div>
          <div className="text-lg font-bold text-[#A63D2F]" style={{ fontFamily: "'Zilla Slab', serif" }}>{fmtINR(totalAdvanceOutstanding)}</div>
        </div>
      </div>

      {timeline.length === 0 ? (
        <div className="p-8 text-center text-sm text-[#9C8F6E]">No salary payments or advances recorded yet for this person.</div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "1.5px solid #26231D" }}>
              {["Date", "Reference", "Description", "Amount", "Advance Outstanding"].map(h => (
                <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-3 py-2 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeline.map((l, i) => (
              <tr key={i} className="ledger-row">
                <td className="px-3 py-2 font-mono whitespace-nowrap">{fmtDate(l.date)}</td>
                <td className="px-3 py-2 font-mono">
                  {l.kind === "salary" && onViewSlip ? (
                    <button onClick={() => onViewSlip(l.raw)} className="underline text-[#12312B] hover:text-[#3F6B52]">{l.ref}</button>
                  ) : (l.ref || "—")}
                </td>
                <td className="px-3 py-2">{l.label}</td>
                <td className={"px-3 py-2 font-mono " + (l.kind === "advance_given" ? "text-[#A63D2F]" : "text-[#3F6B52]")}>{fmtINR(l.amount)}</td>
                <td className="px-3 py-2 font-mono font-semibold">{fmtINR(l.runningOutstanding)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </WideModal>
  );
}

// ============================================================================
// ATTENDANCE (batch-wise) — MarkAttendanceTab / TestMarksTab. These used to
// live under their own standalone "Attendance" sidebar tab
// (AttendanceMgmtTab / ATTENDANCE_MGMT_SUB_TABS, see UPDATE NOTES #23);
// that wrapper tab has been removed and these two components are now
// rendered directly as sub-tabs inside AcademicMonitoringTab instead — see
// the new UPDATE NOTES entry. Not to be confused with the older per-student
// Attendance sub-tab that used to live inside Academic Monitoring, which
// these have now replaced there.
// ============================================================================

