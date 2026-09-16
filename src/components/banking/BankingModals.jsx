import { useRef, useState } from "react";
import { ArrowUpRight, Banknote, Landmark, Printer } from "lucide-react";
import { Field, InstituteHeader, Modal, inputCls, inputStyle } from "../common/UI";
import { CREDIT_MODES, CREDIT_PARTY_TYPES, FONT_IMPORT, REFERENCE_TYPES } from "../../constants/appConstants";
import { fmtDate, todayStr } from "../../lib/dates";
import { shortId } from "../../lib/ids";
import { fmtINR } from "../../lib/money";

export function BankTxnFormModal({ onClose, onSave }) {
  const [type, setType] = useState("withdrawal");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [refType, setRefType] = useState("None");
  const [refNumber, setRefNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  function submit() {
    if (!amount || Number(amount) <= 0) return;
    onSave({
      type, amount: Number(amount) || 0, date,
      bankName: bankName.trim(), accountNumber: accountNumber.trim(),
      refType: refType !== "None" ? refType : "", refNumber: refType !== "None" ? refNumber.trim() : "",
      remarks: remarks.trim(),
    });
  }

  return (
    <Modal title="Record Cash ⇄ Bank Transfer" onClose={onClose}>
      <div className="text-xs text-[#6E6650] mb-3">Move money between physical Cash and your Bank/Online account. This does not affect student dues or center expenses — it only shifts where the center's own money is held. It gets a unique Transaction ID and only appears in the Banking tab.</div>

      <Field label="Transaction Type">
        <div className="grid grid-cols-1 gap-2">
          <button type="button" onClick={() => setType("withdrawal")} className="px-3 py-2.5 text-xs rounded-sm border font-semibold text-left flex items-center gap-2"
            style={{ background: type === "withdrawal" ? "#12312B" : "white", color: type === "withdrawal" ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
            <Banknote size={14} /> Withdraw from Bank → Cash in Hand
          </button>
          <button type="button" onClick={() => setType("deposit")} className="px-3 py-2.5 text-xs rounded-sm border font-semibold text-left flex items-center gap-2"
            style={{ background: type === "deposit" ? "#12312B" : "white", color: type === "deposit" ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
            <Landmark size={14} /> Deposit Cash → Bank Account
          </button>
        </div>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Amount (₹)"><input type="number" className={inputCls} style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></Field>
        <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Bank Name"><input className={inputCls} style={inputStyle} value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. State Bank of India" /></Field>
        <Field label="Account Number"><input className={inputCls} style={inputStyle} value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="e.g. 3849201XXXXX" /></Field>
      </div>

      <Field label="Reference Type (optional)">
        <div className="flex gap-2 flex-wrap">
          {REFERENCE_TYPES.map(rt => (
            <button key={rt} type="button" onClick={() => setRefType(rt)} className="px-3 py-1.5 text-xs rounded-sm border font-semibold"
              style={{ background: refType === rt ? "#12312B" : "white", color: refType === rt ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
              {rt}
            </button>
          ))}
        </div>
      </Field>
      {refType !== "None" && (
        <Field label={refType}><input className={inputCls} style={inputStyle} value={refNumber} onChange={e => setRefNumber(e.target.value)} placeholder={`Enter ${refType.toLowerCase()}`} /></Field>
      )}

      <Field label="Remarks (optional)"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any note for this transfer" /></Field>

      <div className="p-3 rounded bg-[#FAF6EC] border text-xs mb-1" style={{ borderColor: "#D8CFB8" }}>
        {type === "withdrawal"
          ? "Bank Balance will decrease and Cash Balance will increase by this amount."
          : "Cash Balance will decrease and Bank Balance will increase by this amount."}
      </div>

      <button onClick={submit} disabled={!amount || Number(amount) <= 0} className="w-full mt-1 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Record Transfer & Generate Transaction Slip
      </button>
    </Modal>
  );
}

// ============================================================================
// BANK TRANSACTION SLIP — printable record for a single Cash ⇄ Bank transfer.
// ============================================================================


export function BankTxnReceiptModal({ txn, onClose }) {
  const receiptRef = useRef();
  if (!txn) return null;
  const txnId = txn.txnId || `BTX-${shortId(txn.id)}`;
  const typeLabel = txn.type === "withdrawal" ? "Bank Withdrawal (Bank → Cash)" : "Cash Deposit to Bank (Cash → Bank)";

  const handlePrint = () => {
    const printContent = receiptRef.current.innerHTML;
    const win = window.open("", "", "width=850,height=1000");
    win.document.write(`
      <html>
        <head>
          <title>Bank Transaction Slip - ${txnId}</title>
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
    <Modal title="Bank Transaction Slip" onClose={onClose}>
      <div className="p-4 border bg-white rounded-sm mb-4" ref={receiptRef} style={{ borderColor: "#12312B" }}>
        <div className="text-center pb-3 mb-3 border-b-2 border-dashed border-[#12312B]">
          <InstituteHeader subtitle={`Internal Banking Transaction Slip`} large={false} />
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-[#6E6650]">
            <span>Transaction ID: <strong className="text-[#12312B]">{txnId}</strong></span>
            <span>Date: <strong className="text-[#12312B]">{fmtDate(txn.date)}</strong></span>
          </div>
          <div className="flex justify-between text-[#6E6650]"><span>Type:</span><strong className="text-[#12312B]">{typeLabel}</strong></div>
          {txn.bankName && <div className="flex justify-between text-[#6E6650]"><span>Bank Name:</span><strong className="text-[#12312B]">{txn.bankName}</strong></div>}
          {txn.accountNumber && <div className="flex justify-between text-[#6E6650]"><span>Account Number:</span><strong className="text-[#12312B]">{txn.accountNumber}</strong></div>}
          {txn.refType && txn.refNumber && <div className="flex justify-between text-[#6E6650]"><span>{txn.refType}:</span><strong className="text-[#12312B]">{txn.refNumber}</strong></div>}
          {txn.remarks && <div className="flex justify-between text-[#6E6650]"><span>Remarks:</span><strong className="text-[#12312B]">{txn.remarks}</strong></div>}

          <div className="pt-3 mt-3 border-t-2 border-[#12312B]">
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="font-bold">Amount Transferred:</span>
              <span className="font-bold text-[#B8862B] text-lg" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(txn.amount)}</span>
            </div>
          </div>
        </div>
        <div className="text-center pt-3 mt-3 border-t border-dashed border-[#12312B] text-[10px] text-[#9C8F6E]">
          Internal Transfer Only — Not a Student Charge, Payment, or Center Expense · Computer Generated Slip
        </div>
      </div>
      <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]"><Printer size={15} /> Print Slip</button>
    </Modal>
  );
}

// ============================================================================
// CREDIT / LOAN LEDGER — money the center borrows from someone (Credit
// Taken) or lends to someone (Credit Given). Each entry gets a unique,
// clickable/printable Credit ID and feeds the Cash Balance / Bank Balance
// the same way a deposit or expense does. A "Pay Interest" action against
// any Credit Taken entry logs a separate, also-unique Interest Payment.
// ============================================================================


export function CreditFormModal({ onClose, onSave }) {
  const [direction, setDirection] = useState("taken");
  const [partyName, setPartyName] = useState("");
  const [partyType, setPartyType] = useState("Person");
  const [address, setAddress] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [mode, setMode] = useState("Cash");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [refType, setRefType] = useState("None");
  const [refNumber, setRefNumber] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [remarks, setRemarks] = useState("");

  function submit() {
    if (!partyName.trim() || !amount || Number(amount) <= 0) return;
    onSave({
      direction, partyName: partyName.trim(), partyType, address: address.trim(), mobile: mobile.trim(), email: email.trim(),
      amount: Number(amount) || 0, date, mode,
      bankName: mode === "Online" ? bankName.trim() : "", accountNumber: mode === "Online" ? accountNumber.trim() : "",
      refType: mode === "Online" && refType !== "None" ? refType : "", refNumber: mode === "Online" && refType !== "None" ? refNumber.trim() : "",
      interestRate: Number(interestRate) || 0, remarks: remarks.trim(),
    });
  }

  return (
    <Modal title="Record Credit / Loan" onClose={onClose}>
      <div className="text-xs text-[#6E6650] mb-3">Log money borrowed from someone, or money lent out to someone. Gets its own unique Credit ID and shows up in the Banking Cash/Bank Balance and the Credit &amp; Loan Ledger below.</div>

      <Field label="Direction">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button type="button" onClick={() => setDirection("taken")} className="px-3 py-2.5 text-xs rounded-sm border font-semibold text-left flex items-center gap-2"
            style={{ background: direction === "taken" ? "#12312B" : "white", color: direction === "taken" ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
            <ArrowUpRight size={14} className="rotate-180" /> Credit Taken (we borrow)
          </button>
          <button type="button" onClick={() => setDirection("given")} className="px-3 py-2.5 text-xs rounded-sm border font-semibold text-left flex items-center gap-2"
            style={{ background: direction === "given" ? "#12312B" : "white", color: direction === "given" ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
            <ArrowUpRight size={14} /> Credit Given (we lend)
          </button>
        </div>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={direction === "taken" ? "Received From" : "Given To"}><input className={inputCls} style={inputStyle} value={partyName} onChange={e => setPartyName(e.target.value)} placeholder="Name of person / company / bank" /></Field>
        <Field label="Party Type">
          <select className={inputCls} style={inputStyle} value={partyType} onChange={e => setPartyType(e.target.value)}>
            {CREDIT_PARTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Mobile Number"><input className={inputCls} style={inputStyle} value={mobile} onChange={e => setMobile(e.target.value)} placeholder="10-digit mobile number" /></Field>
        <Field label="Amount (₹)"><input type="number" className={inputCls} style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></Field>
      </div>
      <Field label="Email Address (optional)"><input type="email" className={inputCls} style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. party@email.com" /></Field>
      <Field label="Address"><input className={inputCls} style={inputStyle} value={address} onChange={e => setAddress(e.target.value)} placeholder="Address of the other party" /></Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Annual Interest Rate % (optional)"><input type="number" className={inputCls} style={inputStyle} value={interestRate} onChange={e => setInterestRate(e.target.value)} placeholder="0" /></Field>
      </div>

      <Field label="Mode">
        <div className="flex gap-2 flex-wrap">
          {CREDIT_MODES.map(m => (
            <button key={m} type="button" onClick={() => setMode(m)} className="px-3 py-1.5 text-xs rounded-sm border font-semibold"
              style={{ background: mode === m ? "#12312B" : "white", color: mode === m ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
              {m}
            </button>
          ))}
        </div>
      </Field>

      {mode === "Online" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Bank Name"><input className={inputCls} style={inputStyle} value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. HDFC Bank" /></Field>
            <Field label="Account Number"><input className={inputCls} style={inputStyle} value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="e.g. 5021XXXXXX" /></Field>
          </div>
          <Field label="Reference Type">
            <div className="flex gap-2 flex-wrap">
              {REFERENCE_TYPES.map(rt => (
                <button key={rt} type="button" onClick={() => setRefType(rt)} className="px-3 py-1.5 text-xs rounded-sm border font-semibold"
                  style={{ background: refType === rt ? "#12312B" : "white", color: refType === rt ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
                  {rt}
                </button>
              ))}
            </div>
          </Field>
          {refType !== "None" && (
            <Field label={refType}><input className={inputCls} style={inputStyle} value={refNumber} onChange={e => setRefNumber(e.target.value)} placeholder={`Enter ${refType.toLowerCase()}`} /></Field>
          )}
        </>
      )}

      <Field label="Remarks (optional)"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any note for this entry" /></Field>

      <div className="p-3 rounded bg-[#FAF6EC] border text-xs mb-1" style={{ borderColor: "#D8CFB8" }}>
        {direction === "taken"
          ? `${mode} Balance will increase by this amount — this is money coming in.`
          : `${mode} Balance will decrease by this amount — this is money going out.`}
      </div>

      <button onClick={submit} disabled={!partyName.trim() || !amount || Number(amount) <= 0} className="w-full mt-1 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Record Credit &amp; Generate Slip
      </button>
    </Modal>
  );
}


export function CreditReceiptModal({ txn, onClose }) {
  const receiptRef = useRef();
  if (!txn) return null;
  const typeLabel = txn.direction === "taken" ? "Credit Taken (Borrowed)" : "Credit Given (Lent)";

  const handlePrint = () => {
    const printContent = receiptRef.current.innerHTML;
    const win = window.open("", "", "width=850,height=1000");
    win.document.write(`
      <html>
        <head>
          <title>Credit Slip - ${txn.creditId}</title>
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
    <Modal title="Credit / Loan Slip" onClose={onClose}>
      <div className="p-4 border bg-white rounded-sm mb-4" ref={receiptRef} style={{ borderColor: "#12312B" }}>
        <div className="text-center pb-3 mb-3 border-b-2 border-dashed border-[#12312B]">
          <InstituteHeader subtitle={`Credit / Loan Ledger Slip`} large={false} />
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-[#6E6650]">
            <span>Credit ID: <strong className="text-[#12312B]">{txn.creditId}</strong></span>
            <span>Date: <strong className="text-[#12312B]">{fmtDate(txn.date)}</strong></span>
          </div>
          <div className="flex justify-between text-[#6E6650]"><span>Type:</span><strong className="text-[#12312B]">{typeLabel}</strong></div>
          <div className="flex justify-between text-[#6E6650]"><span>{txn.direction === "taken" ? "Received From" : "Given To"}:</span><strong className="text-[#12312B]">{txn.partyName}</strong></div>
          <div className="flex justify-between text-[#6E6650]"><span>Party Type:</span><strong className="text-[#12312B]">{txn.partyType}</strong></div>
          {txn.mobile && <div className="flex justify-between text-[#6E6650]"><span>Mobile:</span><strong className="text-[#12312B]">{txn.mobile}</strong></div>}
          {txn.email && <div className="flex justify-between text-[#6E6650]"><span>Email:</span><strong className="text-[#12312B]">{txn.email}</strong></div>}
          {txn.address && <div className="flex justify-between text-[#6E6650]"><span>Address:</span><strong className="text-[#12312B]">{txn.address}</strong></div>}
          <div className="flex justify-between text-[#6E6650]"><span>Mode:</span><strong className="text-[#12312B]">{txn.mode}</strong></div>
          {txn.bankName && <div className="flex justify-between text-[#6E6650]"><span>Bank Name:</span><strong className="text-[#12312B]">{txn.bankName}</strong></div>}
          {txn.accountNumber && <div className="flex justify-between text-[#6E6650]"><span>Account Number:</span><strong className="text-[#12312B]">{txn.accountNumber}</strong></div>}
          {txn.refType && txn.refNumber && <div className="flex justify-between text-[#6E6650]"><span>{txn.refType}:</span><strong className="text-[#12312B]">{txn.refNumber}</strong></div>}
          {Number(txn.interestRate) > 0 && <div className="flex justify-between text-[#6E6650]"><span>Annual Interest Rate:</span><strong className="text-[#12312B]">{txn.interestRate}%</strong></div>}
          {txn.remarks && <div className="flex justify-between text-[#6E6650]"><span>Remarks:</span><strong className="text-[#12312B]">{txn.remarks}</strong></div>}

          <div className="pt-3 mt-3 border-t-2 border-[#12312B]">
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="font-bold">Amount:</span>
              <span className="font-bold text-[#B8862B] text-lg" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(txn.amount)}</span>
            </div>
          </div>
        </div>
        <div className="text-center pt-3 mt-3 border-t border-dashed border-[#12312B] text-[10px] text-[#9C8F6E]">
          Internal Credit / Loan Record · Computer Generated Slip
        </div>
      </div>
      <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]"><Printer size={15} /> Print Slip</button>
    </Modal>
  );
}


export function PayInterestModal({ creditTxn, interestPaidSoFar, onClose, onSave }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [mode, setMode] = useState("Cash");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [refType, setRefType] = useState("None");
  const [refNumber, setRefNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  function submit() {
    if (!amount || Number(amount) <= 0) return;
    onSave({
      creditTxnId: creditTxn.id, amount: Number(amount) || 0, date, mode,
      bankName: mode === "Online" ? bankName.trim() : "", accountNumber: mode === "Online" ? accountNumber.trim() : "",
      refType: mode === "Online" && refType !== "None" ? refType : "", refNumber: mode === "Online" && refType !== "None" ? refNumber.trim() : "",
      remarks: remarks.trim(),
    });
  }

  return (
    <Modal title={`Pay Interest — ${creditTxn.creditId}`} onClose={onClose}>
      <div className="p-3 rounded bg-[#FAF6EC] border text-xs mb-3" style={{ borderColor: "#D8CFB8" }}>
        Against credit taken from <strong>{creditTxn.partyName}</strong> ({fmtINR(creditTxn.amount)}{Number(creditTxn.interestRate) > 0 ? ` @ ${creditTxn.interestRate}% p.a.` : ""}).
        {interestPaidSoFar > 0 && <> Interest paid so far: <strong>{fmtINR(interestPaidSoFar)}</strong>.</>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Interest Amount (₹)"><input type="number" className={inputCls} style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></Field>
        <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
      </div>

      <Field label="Mode">
        <div className="flex gap-2 flex-wrap">
          {CREDIT_MODES.map(m => (
            <button key={m} type="button" onClick={() => setMode(m)} className="px-3 py-1.5 text-xs rounded-sm border font-semibold"
              style={{ background: mode === m ? "#12312B" : "white", color: mode === m ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
              {m}
            </button>
          ))}
        </div>
      </Field>

      {mode === "Online" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Bank Name"><input className={inputCls} style={inputStyle} value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. HDFC Bank" /></Field>
            <Field label="Account Number"><input className={inputCls} style={inputStyle} value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="e.g. 5021XXXXXX" /></Field>
          </div>
          <Field label="Reference Type">
            <div className="flex gap-2 flex-wrap">
              {REFERENCE_TYPES.map(rt => (
                <button key={rt} type="button" onClick={() => setRefType(rt)} className="px-3 py-1.5 text-xs rounded-sm border font-semibold"
                  style={{ background: refType === rt ? "#12312B" : "white", color: refType === rt ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
                  {rt}
                </button>
              ))}
            </div>
          </Field>
          {refType !== "None" && (
            <Field label={refType}><input className={inputCls} style={inputStyle} value={refNumber} onChange={e => setRefNumber(e.target.value)} placeholder={`Enter ${refType.toLowerCase()}`} /></Field>
          )}
        </>
      )}

      <Field label="Remarks (optional)"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any note for this interest payment" /></Field>

      <button onClick={submit} disabled={!amount || Number(amount) <= 0} className="w-full mt-1 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Pay Interest &amp; Generate Slip
      </button>
    </Modal>
  );
}


export function InterestReceiptModal({ payment, creditTxn, onClose }) {
  const receiptRef = useRef();
  if (!payment) return null;

  const handlePrint = () => {
    const printContent = receiptRef.current.innerHTML;
    const win = window.open("", "", "width=850,height=1000");
    win.document.write(`
      <html>
        <head>
          <title>Interest Payment Slip - ${payment.paymentId}</title>
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
    <Modal title="Interest Payment Slip" onClose={onClose}>
      <div className="p-4 border bg-white rounded-sm mb-4" ref={receiptRef} style={{ borderColor: "#12312B" }}>
        <div className="text-center pb-3 mb-3 border-b-2 border-dashed border-[#12312B]">
          <InstituteHeader subtitle={`Interest Payment Slip`} large={false} />
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-[#6E6650]">
            <span>Payment ID: <strong className="text-[#12312B]">{payment.paymentId}</strong></span>
            <span>Date: <strong className="text-[#12312B]">{fmtDate(payment.date)}</strong></span>
          </div>
          {creditTxn && <div className="flex justify-between text-[#6E6650]"><span>Against Credit ID:</span><strong className="text-[#12312B]">{creditTxn.creditId}</strong></div>}
          {creditTxn && <div className="flex justify-between text-[#6E6650]"><span>Paid To:</span><strong className="text-[#12312B]">{creditTxn.partyName}</strong></div>}
          <div className="flex justify-between text-[#6E6650]"><span>Mode:</span><strong className="text-[#12312B]">{payment.mode}</strong></div>
          {payment.bankName && <div className="flex justify-between text-[#6E6650]"><span>Bank Name:</span><strong className="text-[#12312B]">{payment.bankName}</strong></div>}
          {payment.accountNumber && <div className="flex justify-between text-[#6E6650]"><span>Account Number:</span><strong className="text-[#12312B]">{payment.accountNumber}</strong></div>}
          {payment.refType && payment.refNumber && <div className="flex justify-between text-[#6E6650]"><span>{payment.refType}:</span><strong className="text-[#12312B]">{payment.refNumber}</strong></div>}
          {payment.remarks && <div className="flex justify-between text-[#6E6650]"><span>Remarks:</span><strong className="text-[#12312B]">{payment.remarks}</strong></div>}

          <div className="pt-3 mt-3 border-t-2 border-[#12312B]">
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="font-bold">Interest Paid:</span>
              <span className="font-bold text-[#B8862B] text-lg" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(payment.amount)}</span>
            </div>
          </div>
        </div>
        <div className="text-center pt-3 mt-3 border-t border-dashed border-[#12312B] text-[10px] text-[#9C8F6E]">
          Computer Generated Slip
        </div>
      </div>
      <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]"><Printer size={15} /> Print Slip</button>
    </Modal>
  );
}

