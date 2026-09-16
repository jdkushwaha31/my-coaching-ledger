import { useMemo, useRef, useState } from "react";
import { Percent, Printer, Search, Send } from "lucide-react";
import { Field, InstituteHeader, Modal, inputCls, inputStyle } from "../common/UI";
import { EXPENSE_CATEGORIES, FONT_IMPORT, PAYMENT_MODES } from "../../constants/appConstants";
import { fmtDate, monthLabel, todayStr } from "../../lib/dates";
import { getReceiptNo, shortId } from "../../lib/ids";
import { fmtINR } from "../../lib/money";
import { sendWhatsAppReceipt } from "../../lib/whatsapp";

export function DepositFormModal({ students, studentDues, onClose, onSave }) {
  const [studentId, setStudentId] = useState(students[0]?.id || "");
  const [studentSearch, setStudentSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const student = students.find(s => s.id === studentId);
  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s => (s.name || "").toLowerCase().includes(q) || String(s.class || "").toLowerCase().includes(q) || (s.phone || "").toLowerCase().includes(q));
  }, [students, studentSearch]);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [mode, setMode] = useState("Cash");
  const [utr, setUtr] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [showWriteOff, setShowWriteOff] = useState(false);
  const [writeOffAmount, setWriteOffAmount] = useState("");
  const [writeOffRemarks, setWriteOffRemarks] = useState("");

  const currentBalance = student ? (studentDues[student.id] || 0) : 0;

  function submit() {
    if (!studentId || (!amount && !writeOffAmount)) return;
    onSave({
      studentId, amount: Number(amount) || 0, date, mode,
      utr: (mode === "UPI" || mode === "Bank Transfer") ? utr.trim() : "",
      chequeNumber: mode === "Cheque" ? chequeNumber.trim() : "",
      remarks: remarks.trim(),
      writeOffAmount: showWriteOff ? (Number(writeOffAmount) || 0) : 0,
      writeOffRemarks: showWriteOff ? writeOffRemarks.trim() : "",
    });
  }

  return (
    <Modal title="Record Payment / Receipt" onClose={onClose}>
      <Field label="Select Student">
        <div className="relative">
          <div className="flex items-center border rounded-sm bg-white px-3 py-2 cursor-pointer" style={inputStyle} onClick={() => setPickerOpen(o => !o)}>
            <Search size={13} className="text-[#9C8F6E] mr-2 shrink-0" />
            <span className="text-sm flex-1 truncate">{student ? `${student.name} — ${student.class}${student.phone ? " · " + student.phone : ""}` : "Search by name, class, or phone…"}</span>
          </div>
          {pickerOpen && (
            <div className="absolute z-10 mt-1 w-full bg-white border rounded-sm shadow-lg max-h-64 overflow-y-auto" style={{ borderColor: "#D8CFB8" }}>
              <div className="p-2 sticky top-0 bg-white border-b" style={{ borderColor: "#EEE7D2" }}>
                <input autoFocus className={inputCls} style={inputStyle} value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="Type name, class, or phone…" />
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
      <div className="text-xs text-[#6E6650] mb-3">
        Current outstanding balance: <strong className={currentBalance > 0 ? "text-[#A63D2F]" : "text-[#3F6B52]"}>{fmtINR(currentBalance)}</strong>
        <div className="text-[10px] text-[#9C8F6E] mt-0.5">Any amount you enter here clears the oldest pending charges first — no need to pick which month it's for.</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Amount Received (₹)"><input type="number" className={inputCls} style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></Field>
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

      {(mode === "UPI" || mode === "Bank Transfer") && (
        <Field label="UTR / Reference Number"><input className={inputCls} style={inputStyle} value={utr} onChange={e => setUtr(e.target.value)} placeholder="e.g. 402913827461" /></Field>
      )}
      {mode === "Cheque" && (
        <Field label="Cheque Number"><input className={inputCls} style={inputStyle} value={chequeNumber} onChange={e => setChequeNumber(e.target.value)} placeholder="e.g. 004521" /></Field>
      )}

      <Field label="Remarks (optional)"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any note for this payment" /></Field>

      {!showWriteOff ? (
        <button type="button" onClick={() => setShowWriteOff(true)} className="text-xs text-[#B8862B] font-semibold underline mb-3 inline-flex items-center gap-1">
          <Percent size={12} /> Add a discount / write-off to this receipt
        </button>
      ) : (
        <div className="p-3 border rounded-sm mb-3 bg-white" style={{ borderColor: "#B8862B" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#8A6420]">Discount / Write-off</span>
            <button type="button" onClick={() => { setShowWriteOff(false); setWriteOffAmount(""); setWriteOffRemarks(""); }} className="text-xs text-[#A63D2F] underline">Remove</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Amount to Forgive (₹)"><input type="number" className={inputCls} style={inputStyle} value={writeOffAmount} onChange={e => setWriteOffAmount(e.target.value)} placeholder="0" /></Field>
            <Field label="Reason"><input className={inputCls} style={inputStyle} value={writeOffRemarks} onChange={e => setWriteOffRemarks(e.target.value)} placeholder="e.g. Sibling discount" /></Field>
          </div>
          <div className="text-[10px] text-[#9C8F6E]">This clears the balance the same way a payment does, but isn't counted as cash collected.</div>
        </div>
      )}

      <button onClick={submit} disabled={!studentId || (!amount && !writeOffAmount)} className="w-full mt-1 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Record & Generate Receipt
      </button>
    </Modal>
  );
}

// ============================================================================
// EXPENSE FORM — captures a single outgoing payment (rent, salary, materials,
// etc). Mirrors the Deposit form's payment-mode + reference/UTR pattern so
// the two logs feel consistent, then hands off to addExpense() which stamps
// a unique EXP-XXXXXX id and opens the printable receipt.
// ============================================================================


export function ExpenseFormModal({ onClose, onSave }) {
  const [category, setCategory] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [mode, setMode] = useState("Cash");
  const [refNumber, setRefNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  function submit() {
    if (!category.trim() || !amount) return;
    onSave({
      category: category.trim(), paidTo: paidTo.trim(), amount: Number(amount) || 0, date, mode,
      refNumber: mode !== "Cash" ? refNumber.trim() : "",
      remarks: remarks.trim(),
    });
  }

  return (
    <Modal title="Add Expense" onClose={onClose}>
      <div className="text-xs text-[#6E6650] mb-3">Log any money paid out by the center — rent, salaries, materials, maintenance, marketing, anything. It gets its own Expense ID and a printable receipt, and feeds the Cash / Online balance tiles on the Dashboard.</div>

      <Field label="Category / Title">
        <input list="expense-categories" className={inputCls} style={inputStyle} value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Rent, Staff Salary, Stationery" />
        <datalist id="expense-categories">
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c} />)}
        </datalist>
      </Field>

      <Field label="Paid To (vendor, staff, landlord, or recipient)">
        <input className={inputCls} style={inputStyle} value={paidTo} onChange={e => setPaidTo(e.target.value)} placeholder="e.g. Rahul Sharma, XYZ Stationers" />
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

      {mode !== "Cash" && (
        <Field label="Reference Number / UTR"><input className={inputCls} style={inputStyle} value={refNumber} onChange={e => setRefNumber(e.target.value)} placeholder="e.g. 402913827461 or cheque no." /></Field>
      )}

      <Field label="Remarks (optional)"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any note for this expense" /></Field>

      <button onClick={submit} disabled={!category.trim() || !amount} className="w-full mt-1 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Add Expense & Generate Receipt
      </button>
    </Modal>
  );
}


export function ReceiptModal({ deposit, student, totalRemainingDue, onClose }) {
  const receiptRef = useRef();

  const handlePrint = () => {
    const printContent = receiptRef.current.innerHTML;
    const win = window.open("", "", "width=850,height=1000");
    win.document.write(`
      <html>
        <head>
          <title>Fee Receipt - InstituteOS</title>
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

  const receiptNo = getReceiptNo(deposit.id);
  const totalCleared = Number(deposit.amount || 0) + Number(deposit.writeOffAmount || 0);
  const ref = deposit.utr || deposit.chequeNumber;

  return (
    <Modal title="Official Fee Receipt" onClose={onClose}>
      <div className="p-4 border bg-white rounded-sm mb-4" ref={receiptRef} style={{ borderColor: "#12312B" }}>
        <div className="text-center pb-3 mb-3 border-b-2 border-dashed border-[#12312B]">
          <InstituteHeader subtitle={`Official Payment Receipt`} large={false} />
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-[#6E6650]">
            <span>Receipt No: <strong className="text-[#12312B]">#{receiptNo}</strong></span>
            <span>Date: <strong className="text-[#12312B]">{fmtDate(deposit.date)}</strong></span>
          </div>
          <div className="flex justify-between text-[#6E6650]"><span>Student Name:</span><strong className="text-[#12312B]">{student ? student.name : "N/A"}</strong></div>
          <div className="flex justify-between text-[#6E6650]"><span>Class:</span><strong className="text-[#12312B]">{student ? student.class : "N/A"}</strong></div>
          <div className="flex justify-between text-[#6E6650]"><span>Payment Mode:</span><strong className="text-[#12312B]">{deposit.mode || "Cash"}</strong></div>
          {ref && <div className="flex justify-between text-[#6E6650]"><span>{deposit.utr ? "UTR / Reference:" : "Cheque No:"}</span><strong className="text-[#12312B]">{ref}</strong></div>}
          {deposit.remarks && <div className="flex justify-between text-[#6E6650]"><span>Remarks:</span><strong className="text-[#12312B]">{deposit.remarks}</strong></div>}

          <div className="pt-3 mt-3 border-t-2 border-[#12312B]">
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="font-bold">Amount Paid Today:</span>
              <span className="font-bold text-[#3F6B52] text-lg" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(deposit.amount)}</span>
            </div>
            {deposit.writeOffAmount > 0 && (
              <div className="flex justify-between items-center text-xs mb-1 text-[#8A6420]">
                <span>Discount / Write-off{deposit.writeOffRemarks ? ` (${deposit.writeOffRemarks})` : ""}:</span>
                <span className="font-semibold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(deposit.writeOffAmount)}</span>
              </div>
            )}
            {deposit.writeOffAmount > 0 && (
              <div className="flex justify-between items-center text-xs mb-1 font-semibold text-[#12312B]">
                <span>Total Cleared:</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(totalCleared)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-xs text-[#A63D2F]">
              <span>Remaining Total Balance:</span>
              <span className="font-semibold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(totalRemainingDue)}</span>
            </div>
          </div>
        </div>
        <div className="text-center pt-3 mt-3 border-t border-dashed border-[#12312B] text-[10px] text-[#9C8F6E]">
          Status: PAYMENT ACKNOWLEDGED ✅ · Computer Generated Receipt
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button onClick={handlePrint} className="flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]"><Printer size={15} /> Print Receipt</button>
        <button onClick={() => sendWhatsAppReceipt(deposit, student, totalRemainingDue)} className="flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#25D366] hover:bg-[#1DA851]"><Send size={15} /> Send to WhatsApp</button>
      </div>
    </Modal>
  );
}

// ============================================================================
// EXPENSE RECEIPT — a dedicated printable receipt for a single expense, in
// the same visual language as the fee Receipt/Statement so every printed
// document from this app reads as one consistent record system.
// ============================================================================
// ============================================================================
// BANK TRANSACTION FORM — records an internal Cash ⇄ Bank transfer. This is
// NOT money coming into or leaving the coaching center — it's moving money
// the center already has between physical Cash and the Bank/Online account.
// Withdraw from Bank: Bank Balance goes down, Cash Balance goes up.
// Deposit Cash to Bank: Cash Balance goes down, Bank Balance goes up.
// ============================================================================


export function ExpenseReceiptModal({ expense, onClose }) {
  const receiptRef = useRef();
  const expenseId = expense.expenseId || `EXP-${shortId(expense.id)}`;

  const handlePrint = () => {
    const printContent = receiptRef.current.innerHTML;
    const win = window.open("", "", "width=850,height=1000");
    win.document.write(`
      <html>
        <head>
          <title>Expense Receipt - ${expenseId}</title>
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
    <Modal title="Expense Receipt" onClose={onClose}>
      <div className="p-4 border bg-white rounded-sm mb-4" ref={receiptRef} style={{ borderColor: "#12312B" }}>
        <div className="text-center pb-3 mb-3 border-b-2 border-dashed border-[#12312B]">
          <InstituteHeader subtitle={`Official Expense Receipt`} large={false} />
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-[#6E6650]">
            <span>Expense ID: <strong className="text-[#12312B]">{expenseId}</strong></span>
            <span>Date: <strong className="text-[#12312B]">{fmtDate(expense.date)}</strong></span>
          </div>
          <div className="flex justify-between text-[#6E6650]"><span>Category:</span><strong className="text-[#12312B]">{expense.category || "—"}</strong></div>
          {expense.paidTo && <div className="flex justify-between text-[#6E6650]"><span>Paid To:</span><strong className="text-[#12312B]">{expense.paidTo}</strong></div>}
          <div className="flex justify-between text-[#6E6650]"><span>Payment Mode:</span><strong className="text-[#12312B]">{expense.mode || "Cash"}</strong></div>
          {expense.refNumber && <div className="flex justify-between text-[#6E6650]"><span>Reference / UTR:</span><strong className="text-[#12312B]">{expense.refNumber}</strong></div>}
          {expense.remarks && <div className="flex justify-between text-[#6E6650]"><span>Remarks:</span><strong className="text-[#12312B]">{expense.remarks}</strong></div>}

          <div className="pt-3 mt-3 border-t-2 border-[#12312B]">
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="font-bold">Amount Paid:</span>
              <span className="font-bold text-[#A63D2F] text-lg" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(expense.amount)}</span>
            </div>
          </div>
        </div>
        <div className="text-center pt-3 mt-3 border-t border-dashed border-[#12312B] text-[10px] text-[#9C8F6E]">
          Status: EXPENSE RECORDED ✅ · Computer Generated Receipt
        </div>
      </div>
      <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]"><Printer size={15} /> Print Receipt</button>
    </Modal>
  );
}

// ============================================================================
// CHARGE RECEIPT — a printable receipt for any single debit line on a
// student's ledger (opening balance, a month's tuition, or an ad-hoc
// additional charge). Works straight off the ledger-line shape shared by
// the Additional Charges log, the Student Statement, and the Center
// Statement, so one receipt design covers all three entry points.
// ============================================================================
// ============================================================================
// JOINING FORM — a full-detail, printable (A4) record of a student's
// registration, generated on demand from the student's row. Pulls every
// field captured on the Student Register form so the center always has a
// complete, printable admission record to keep on file.
// ============================================================================


export function ChargeReceiptModal({ line, student, onClose }) {
  const receiptRef = useRef();
  if (!line) return null;

  const typeLabel = { opening: "Opening Balance (Carried Forward)", monthly_fee: "Tuition Fee", extra_charge: "Additional Charge" }[line.type] || "Charge";

  const handlePrint = () => {
    const printContent = receiptRef.current.innerHTML;
    const win = window.open("", "", "width=850,height=1000");
    win.document.write(`
      <html>
        <head>
          <title>Charge Receipt - ${line.chargeId || ""}</title>
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
    <Modal title="Charge Receipt" onClose={onClose}>
      <div className="p-4 border bg-white rounded-sm mb-4" ref={receiptRef} style={{ borderColor: "#12312B" }}>
        <div className="text-center pb-3 mb-3 border-b-2 border-dashed border-[#12312B]">
          <InstituteHeader subtitle={`Official Charge Receipt — ${typeLabel}`} large={false} />
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-[#6E6650]">
            <span>Charge ID: <strong className="text-[#12312B]">{line.chargeId}</strong></span>
            <span>Date: <strong className="text-[#12312B]">{fmtDate(line.date)}</strong></span>
          </div>
          <div className="flex justify-between text-[#6E6650]"><span>Student Name:</span><strong className="text-[#12312B]">{student ? student.name : "N/A"}</strong></div>
          <div className="flex justify-between text-[#6E6650]"><span>Class:</span><strong className="text-[#12312B]">{student ? `${student.class}` : "N/A"}</strong></div>
          {line.month && <div className="flex justify-between text-[#6E6650]"><span>For Month:</span><strong className="text-[#12312B]">{monthLabel(line.month)}</strong></div>}
          <div className="flex justify-between text-[#6E6650]"><span>Description:</span><strong className="text-[#12312B]">{line.label}</strong></div>
          {line.remarks && <div className="flex justify-between text-[#6E6650]"><span>Remarks:</span><strong className="text-[#12312B]">{line.remarks}</strong></div>}

          <div className="pt-3 mt-3 border-t-2 border-[#12312B]">
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="font-bold">Charge Amount:</span>
              <span className="font-bold text-[#B8862B] text-lg" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(line.amount)}</span>
            </div>
          </div>
        </div>
        <div className="text-center pt-3 mt-3 border-t border-dashed border-[#12312B] text-[10px] text-[#9C8F6E]">
          Computer Generated Receipt
        </div>
      </div>
      <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]"><Printer size={15} /> Print Receipt</button>
    </Modal>
  );
}

