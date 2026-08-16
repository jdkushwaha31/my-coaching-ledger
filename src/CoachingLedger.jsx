import React, { useState, useEffect, useMemo, useRef } from "react";
import { db } from "./firebase";
import { 
  collection, onSnapshot, doc, setDoc, deleteDoc 
} from "firebase/firestore";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid 
} from "recharts";
import { 
  LayoutGrid, Users, Wallet, Receipt, AlertCircle, Plus, Trash2, X, Check, Lock, LogOut, 
  BookOpen, Send, Printer, Award, ArrowUpRight, History, Tag, Undo2, Archive, RotateCcw, 
  ClipboardList, Percent, FileText, Search, Banknote, Landmark, CreditCard
} from "lucide-react";

// Admin Access Password
const APP_PASSWORD = "958906"; 

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');`;

const DEFAULT_CLASSES = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const DEFAULT_SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Science", "Hindi", "English", "Social Studies", "Computer"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Cheque"];
const EXPENSE_CATEGORIES = ["Rent", "Electricity", "Staff Salary", "Stationery", "Maintenance", "Marketing", "Internet / Phone", "Furniture", "Miscellaneous"];

// Exit reasons — used whenever a student leaves an active billing cycle.
const EXIT_REASONS = [
  { value: "Passed", label: "Passed — completed this class", status: "on_break" },
  { value: "Repeat", label: "Repeating this class next session", status: "on_break" },
  { value: "Gap", label: "On Break / Gap (temporary pause)", status: "on_break" },
  { value: "Dropped", label: "Dropped Out (leaving permanently)", status: "dropped" },
];

function monthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function monthLabel(key) { 
  if (!key) return "—";
  if (key === "carried-over") return "Carried Forward";
  const [y, m] = key.split("-").map(Number); 
  if (!m || m < 1 || m > 12) return key;
  return `${MONTH_NAMES[m - 1]} ${y}`; 
}
function currentMonthKey() { return monthKey(new Date()); }
function addMonths(key, n) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return monthKey(d);
}
function monthsBetween(fromKey, toKey) {
  const out = [];
  let cur = fromKey;
  let guard = 0;
  while (cur <= toKey && guard < 240) { out.push(cur); cur = addMonths(cur, 1); guard++; }
  return out;
}
function fmtINR(n) {
  const v = Number(n) || 0;
  return "₹" + v.toLocaleString("en-IN");
}
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
// Single source of truth for receipt numbering, so the Deposit Receipt,
// the WhatsApp receipt message, and the Student Statement always show
// the exact same receipt number for a given deposit.
function getReceiptNo(depositId) {
  return depositId ? depositId.slice(0, 8).toUpperCase() : "REC-" + Date.now().toString().slice(-4);
}

// Deterministic short code used to build a stable, readable Charge ID for
// any ledger line — ad-hoc charges get one stored at creation time, but
// recurring tuition-fee lines are computed on the fly each render, so their
// ID has to be derivable from their own (stable) raw id instead of stored.
function shortId(str) {
  let h = 0;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
  return h.toString(36).toUpperCase().padStart(6, "0").slice(-6);
}

const defaultFeeStructure = (classes) => {
  const fs = {};
  classes.forEach((c, i) => {
    fs[c] = { 
      1: 500 + i * 50, 
      2: 900 + i * 100, 
      3: 1300 + i * 150,
      4: 1600 + i * 180,
      5: 1900 + i * 200,
      6: 2200 + i * 220
    };
  });
  return fs;
};

function sendWhatsAppReceipt(deposit, student, totalRemainingDue) {
  if (!student || !student.phone) {
    alert("No phone number registered for this student.");
    return;
  }
  const cleanPhone = student.phone.replace(/[^0-9]/g, "");
  const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const receiptNo = getReceiptNo(deposit.id);
  const woLine = deposit.writeOffAmount > 0 ? `\n*Discount/Write-off:* ₹${deposit.writeOffAmount}` : "";
  const refLine = deposit.utr ? `\n*Reference/UTR:* ${deposit.utr}` : (deposit.chequeNumber ? `\n*Cheque No:* ${deposit.chequeNumber}` : "");
  const msg = `*FEE PAYMENT RECEIPT*\n----------------------------------------\n*Receipt No:* #${receiptNo}\n*Date:* ${deposit.date}\n*Student Name:* ${student.name}\n*Class:* ${student.class}\n*Payment Mode:* ${deposit.mode || "Cash"}${refLine}\n----------------------------------------\n*Amount Paid Today:* ₹${deposit.amount}${woLine}\n*Remaining Balance:* ₹${totalRemainingDue}\n*Status:* ACKNOWLEDGED ✅\n----------------------------------------\nThank you for your payment!`;
  window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`, "_blank");
}

// ============================================================================
// LEDGER ENGINE — the single source of truth for "how much does this student
// owe". Everything (tuition accrual, ad-hoc charges, payments, write-offs)
// becomes one chronological list of debit/credit lines, credits are applied
// oldest-charge-first, and a running balance falls out naturally. This is
// what powers Dues, the Dashboard totals, and the per-student Statement.
// ============================================================================
function computeStudentLedger(student, deposits, charges, batchesForMonth, expectedFeeFor, curMonth) {
  const chargeLines = [];

  if (Number(student.previousDues) > 0) {
    chargeLines.push({
      id: `opening-${student.id}`, chargeId: `CHG-OPN${shortId(student.id)}`, type: "opening",
      date: `${student.admissionMonth || curMonth}-01`, month: null,
      label: "Opening Balance (Carried Forward)", amount: round2(student.previousDues), remarks: "", ref: "",
    });
  }

  if (student.admissionMonth && (student.status || "active") === "active" && student.admissionMonth <= curMonth) {
    monthsBetween(student.admissionMonth, curMonth).forEach(m => {
      const batches = batchesForMonth(student, m);
      const bc = batches.length || 1;
      const expected = expectedFeeFor(student.class, bc, student.monthlyDiscount || 0);
      if (expected > 0) {
        const lineId = `fee-${student.id}-${m}`;
        chargeLines.push({
          id: lineId, chargeId: `CHG-${shortId(lineId)}`, type: "monthly_fee", date: `${m}-01`, month: m,
          label: `Tuition Fee — ${monthLabel(m)}${batches.length ? " (" + batches.join(", ") + ")" : ""}`,
          amount: round2(expected), remarks: "", ref: "",
        });
      }
    });
  }

  (charges || []).filter(c => c.studentId === student.id && !c.deleted).forEach(c => {
    chargeLines.push({
      id: c.id, chargeId: c.chargeId || `CHG-${shortId(c.id)}`, type: "extra_charge",
      date: c.date || `${c.month || curMonth}-01`, month: c.month || null,
      label: c.remarks ? `Additional Charge — ${c.remarks}` : `Additional Charge${c.month ? " (" + monthLabel(c.month) + ")" : ""}`,
      amount: round2(c.amount), remarks: c.remarks || "", ref: "",
    });
  });

  chargeLines.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const creditLines = [];
  (deposits || []).filter(d => d.studentId === student.id && !d.deleted).forEach(d => {
    if (Number(d.amount) > 0) {
      const ref = d.utr ? ` · Ref ${d.utr}` : (d.chequeNumber ? ` · Chq #${d.chequeNumber}` : "");
      creditLines.push({
        id: `${d.id}-pay`, depositId: d.id, type: "payment", date: d.date || todayStr(),
        label: `Payment Received — ${d.mode || "Cash"}${ref}`, amount: round2(d.amount),
        mode: d.mode, remarks: d.remarks, receiptNo: getReceiptNo(d.id), ref: d.utr || d.chequeNumber || "",
      });
    }
    if (Number(d.writeOffAmount) > 0) {
      creditLines.push({
        id: `${d.id}-wo`, depositId: d.id, type: "writeoff", date: d.date || todayStr(),
        label: d.writeOffRemarks ? `Discount / Write-off — ${d.writeOffRemarks}` : "Discount / Write-off",
        amount: round2(d.writeOffAmount), remarks: d.writeOffRemarks, receiptNo: getReceiptNo(d.id), ref: "",
      });
    }
  });
  creditLines.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  let pool = creditLines.reduce((a, c) => a + c.amount, 0);
  const allocatedCharges = chargeLines.map(line => {
    const applied = Math.min(line.amount, pool);
    pool = round2(pool - applied);
    return { ...line, paid: round2(applied), outstanding: round2(line.amount - applied) };
  });

  const totalCharged = round2(chargeLines.reduce((a, l) => a + l.amount, 0));
  const totalCleared = round2(creditLines.reduce((a, l) => a + l.amount, 0));
  const balance = Math.max(0, round2(totalCharged - totalCleared));

  const timeline = [
    ...allocatedCharges.map(l => ({ ...l, kind: "debit" })),
    ...creditLines.map(l => ({ ...l, kind: "credit" })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.kind === "debit" ? -1 : 1)));

  let running = 0;
  const timelineWithBalance = timeline.map(l => {
    running = round2(running + (l.kind === "debit" ? l.amount : -l.amount));
    return { ...l, runningBalance: running };
  });

  return { chargeLines: allocatedCharges, creditLines, totalCharged, totalCleared, balance, timeline: timelineWithBalance };
}

function Stamp({ text, tone }) {
  const colors = {
    paid: { bg: "#EAF1EA", border: "#3F6B52", text: "#2E5240" },
    due: { bg: "#FBEFE3", border: "#B8862B", text: "#8A6420" },
    overdue: { bg: "#F7E7E3", border: "#A63D2F", text: "#8A3226" },
    break: { bg: "#EBF3F5", border: "#4A7B9D", text: "#2B526C" },
    carried: { bg: "#EFEAE0", border: "#6E6650", text: "#4A4636" },
  };
  const c = colors[tone] || colors.due;
  return (
    <span
      style={{
        background: c.bg, border: `1.5px solid ${c.border}`, color: c.text,
        fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.08em",
        padding: "2px 8px", borderRadius: "3px", fontWeight: 600, display: "inline-block",
        transform: "rotate(-1deg)", textTransform: "uppercase"
      }}
    >{text}</span>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white border rounded-sm ${className}`} style={{ borderColor: "#E4DCC5" }}>
      {children}
    </div>
  );
}

function SectionHeader({ eyebrow, title, action }) {
  return (
    <div className="flex items-end justify-between mb-4 pb-3" style={{ borderBottom: "1.5px solid #26231D" }}>
      <div>
        {eyebrow && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.12em", color: "#9C8F6E" }} className="uppercase mb-1">{eyebrow}</div>}
        <h2 style={{ fontFamily: "'Zilla Slab', serif" }} className="text-2xl font-semibold text-[#1B1810]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export default function CoachingLedger() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem("ledger_auth") === "true");
  const [passInput, setPassInput] = useState("");
  const [passError, setPassError] = useState(false);

  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState(DEFAULT_CLASSES);
  const [subjectsList, setSubjectsList] = useState(DEFAULT_SUBJECTS);
  const [feeStructure, setFeeStructure] = useState({});
  const [deposits, setDeposits] = useState([]);
  const [charges, setCharges] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [showStudentForm, setShowStudentForm] = useState(false);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(null);
  const [showExitModal, setShowExitModal] = useState(null);
  const [showBatchChangeModal, setShowBatchChangeModal] = useState(null);
  const [showChargeModal, setShowChargeModal] = useState(null); // { student } or { student: null } for picker
  const [showBulkChargeModal, setShowBulkChargeModal] = useState(false);
  const [showJoiningFormModal, setShowJoiningFormModal] = useState(null);
  const [showStatementModal, setShowStatementModal] = useState(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [expenseReceiptData, setExpenseReceiptData] = useState(null);
  const [chargeReceiptData, setChargeReceiptData] = useState(null); // { line, student }

  const handleLogin = (e) => {
    e.preventDefault();
    if (passInput === APP_PASSWORD) {
      sessionStorage.setItem("ledger_auth", "true");
      setIsAuthenticated(true);
      setPassError(false);
    } else {
      setPassError(true);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("ledger_auth");
    setIsAuthenticated(false);
    setPassInput("");
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubStudents = onSnapshot(collection(db, "students"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, status: "active", deleted: false, ...doc.data() }));
      setStudents(data);
      setLoaded(true);
    });

    const unsubDeposits = onSnapshot(collection(db, "deposits"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, deleted: false, ...doc.data() }));
      setDeposits(data);
    });

    const unsubCharges = onSnapshot(collection(db, "charges"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, deleted: false, ...doc.data() }));
      setCharges(data);
    });

    const unsubExpenses = onSnapshot(collection(db, "expenses"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, deleted: false, ...doc.data() }));
      setExpenses(data);
    });

    const unsubFee = onSnapshot(doc(db, "settings", "feeStructure"), (docSnap) => {
      if (docSnap.exists()) {
        setFeeStructure(docSnap.data().matrix || {});
      } else {
        const init = defaultFeeStructure(DEFAULT_CLASSES);
        setDoc(doc(db, "settings", "feeStructure"), { matrix: init });
        setFeeStructure(init);
      }
    });

    const unsubClasses = onSnapshot(doc(db, "settings", "classList"), (docSnap) => {
      if (docSnap.exists()) {
        setClasses(docSnap.data().list || DEFAULT_CLASSES);
      } else {
        setDoc(doc(db, "settings", "classList"), { list: DEFAULT_CLASSES });
      }
    });

    const unsubSubjects = onSnapshot(doc(db, "settings", "subjectList"), (docSnap) => {
      if (docSnap.exists()) {
        setSubjectsList(docSnap.data().list || DEFAULT_SUBJECTS);
      } else {
        setDoc(doc(db, "settings", "subjectList"), { list: DEFAULT_SUBJECTS });
      }
    });

    return () => {
      unsubStudents(); unsubDeposits(); unsubCharges(); unsubExpenses(); unsubFee(); unsubClasses(); unsubSubjects();
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#12312B", fontFamily: "'Inter', sans-serif" }}>
        <style>{FONT_IMPORT}</style>
        <div className="bg-[#FAF6EC] p-8 rounded-sm shadow-2xl max-w-md w-full border-2" style={{ borderColor: "#B8862B" }}>
          <div className="flex justify-center mb-3 text-[#12312B]"><Lock size={32} /></div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-2xl font-bold text-[#12312B] text-center">Batch Ledger Pro</div>
          <p className="text-xs text-[#9C8F6E] text-center uppercase tracking-wider mb-6" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Admin Authentication</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#6E6650] mb-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Enter Passcode</label>
              <input
                type="password" value={passInput} onChange={(e) => setPassInput(e.target.value)} placeholder="••••••••"
                className="w-full border rounded-sm px-3 py-2 text-sm bg-white focus:outline-none"
                style={{ borderColor: passError ? "#A63D2F" : "#D8CFB8" }} autoFocus
              />
              {passError && <p className="text-xs text-[#A63D2F] mt-1 font-medium">Incorrect passcode. Try again.</p>}
            </div>
            <button type="submit" className="w-full py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
              Unlock Ledger
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "#FAF6EC", fontFamily: "'IBM Plex Mono', monospace", color: "#8A6420" }}>Connecting to Cloud Database…</div>;
  }

  const curMonth = currentMonthKey();

  const visibleStudents = students.filter(s => !s.deleted);
  const visibleDeposits = deposits.filter(d => !d.deleted);
  const visibleCharges = charges.filter(c => !c.deleted);
  const visibleExpenses = expenses.filter(e => !e.deleted);
  const trashedStudents = students.filter(s => s.deleted);
  const trashedDeposits = deposits.filter(d => d.deleted);
  const trashedCharges = charges.filter(c => c.deleted);
  const trashedExpenses = expenses.filter(e => e.deleted);

  const studentById = Object.fromEntries(students.map(s => [s.id, s]));

  function expectedFeeFor(cls, batchCount, monthlyDiscount = 0) {
    const bc = Math.max(1, Math.min(6, batchCount || 1));
    const baseFee = (feeStructure[cls] && feeStructure[cls][bc]) || 0;
    return Math.max(0, baseFee - (Number(monthlyDiscount) || 0));
  }

  function batchesForMonth(student, month) {
    const history = (student.batchHistory && student.batchHistory.length)
      ? student.batchHistory
      : [{ fromMonth: student.admissionMonth, batches: student.batches || [] }];
    const applicable = history.filter(h => h.fromMonth <= month).sort((a, b) => (a.fromMonth < b.fromMonth ? -1 : 1));
    if (applicable.length) return applicable[applicable.length - 1].batches || [];
    return student.batches || [];
  }

  // Per-student ledger (tuition + charges vs payments + write-offs), computed
  // fresh each render — this is the single source of truth used everywhere.
  const ledgers = {};
  visibleStudents.forEach(st => {
    ledgers[st.id] = computeStudentLedger(st, visibleDeposits, visibleCharges, batchesForMonth, expectedFeeFor, curMonth);
  });

  const studentDuesMap = {};
  visibleStudents.forEach(st => { studentDuesMap[st.id] = ledgers[st.id].balance; });

  const outstandingRows = visibleStudents.flatMap(st =>
    ledgers[st.id].chargeLines.filter(l => l.outstanding > 0).map(l => ({
      studentId: st.id, name: st.name, cls: st.class, phone: st.phone,
      type: l.type, month: l.month, label: l.label, chargeId: l.chargeId, remarks: l.remarks,
      expected: l.amount, paid: l.paid, outstanding: l.outstanding,
      isCurrent: l.month === curMonth, status: st.status || "active",
    }))
  ).sort((a, b) => (a.month || "") < (b.month || "") ? -1 : 1);

  const totalOutstanding = round2(Object.values(studentDuesMap).reduce((a, v) => a + v, 0));

  // Cash vs. Online split — "Cash" is its own bucket; UPI / Bank Transfer /
  // Cheque are all treated as "Online" for the balance tracker & tiles.
  function paymentModeOf(x) { return x.mode || "Cash"; }
  const cashCollected = round2(visibleDeposits.filter(d => paymentModeOf(d) === "Cash").reduce((a, d) => a + Number(d.amount || 0), 0));
  const onlineCollected = round2(visibleDeposits.filter(d => paymentModeOf(d) !== "Cash").reduce((a, d) => a + Number(d.amount || 0), 0));
  const cashExpensesTotal = round2(visibleExpenses.filter(e => paymentModeOf(e) === "Cash").reduce((a, e) => a + Number(e.amount || 0), 0));
  const onlineExpensesTotal = round2(visibleExpenses.filter(e => paymentModeOf(e) !== "Cash").reduce((a, e) => a + Number(e.amount || 0), 0));
  const totalExpenses = round2(cashExpensesTotal + onlineExpensesTotal);
  const totalCashBalance = round2(cashCollected - cashExpensesTotal);
  const totalOnlineBalance = round2(onlineCollected - onlineExpensesTotal);

  // Expense rows shaped like ledger timeline lines, so they merge cleanly
  // into the center-wide statement feed alongside tuition/charges/payments.
  const expenseTransactions = visibleExpenses.map(e => ({
    id: `${e.id}-exp`, chargeId: e.expenseId || `EXP-${shortId(e.id)}`, type: "expense", kind: "debit",
    date: e.date || todayStr(), month: null, label: e.category ? `Expense — ${e.category}` : "Expense",
    remarks: e.remarks || "", amount: round2(e.amount), ref: e.refNumber || "",
    studentId: null, studentName: "Center Expense", studentClass: "—", studentStatus: "active",
  }));

  // Center-wide statement — every ledger line (tuition, additional charges,
  // payments, write-offs) from every student plus every expense, merged
  // into one master feed.
  const allTransactions = [
    ...visibleStudents.flatMap(st =>
      (ledgers[st.id]?.timeline || []).map(l => ({
        ...l,
        studentId: st.id, studentName: st.name, studentClass: st.class, studentStatus: st.status || "active",
      }))
    ),
    ...expenseTransactions,
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const centerTotals = {
    charged: round2(Object.values(ledgers).reduce((a, l) => a + l.totalCharged, 0)),
    collected: round2(visibleDeposits.reduce((a, d) => a + Number(d.amount || 0), 0)),
    writtenOff: round2(visibleDeposits.reduce((a, d) => a + Number(d.writeOffAmount || 0), 0)),
    outstanding: totalOutstanding,
    expenses: totalExpenses,
    cashBalance: totalCashBalance,
    onlineBalance: totalOnlineBalance,
  };

  function depositMonthOf(d) { return d.date ? d.date.slice(0, 7) : null; }
  const thisMonthCollected = visibleDeposits.filter(d => depositMonthOf(d) === curMonth).reduce((a, d) => a + Number(d.amount || 0), 0);
  const thisMonthWriteOffs = visibleDeposits.filter(d => depositMonthOf(d) === curMonth).reduce((a, d) => a + Number(d.writeOffAmount || 0), 0);
  const thisMonthExpected = visibleStudents.reduce((a, st) => a + ledgers[st.id].chargeLines.filter(l => l.month === curMonth).reduce((s, l) => s + l.amount, 0), 0);

  const start = addMonths(curMonth, -5);
  const trendMonths = monthsBetween(start, curMonth);
  const trend = trendMonths.map(m => ({
    month: monthLabel(m).split(" ")[0],
    collected: visibleDeposits.filter(d => depositMonthOf(d) === m).reduce((a, d) => a + Number(d.amount || 0), 0),
  }));

  const activeStudents = visibleStudents.filter(s => (s.status || "active") === "active");
  const classStrength = Object.fromEntries(classes.map(c => [c, 0]));
  activeStudents.forEach(s => { if (classStrength[s.class] !== undefined) classStrength[s.class]++; });

  const recentDeposits = [...visibleDeposits].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 8);

  // Fee forecast — "how much will be charged in month X" across active
  // students (tuition) plus any additional charges already logged for X.
  function forecastForMonth(month) {
    const rows = [];
    activeStudents.forEach(st => {
      if (!st.admissionMonth || st.admissionMonth > month) return;
      const batches = batchesForMonth(st, month);
      const bc = batches.length || 1;
      const expected = expectedFeeFor(st.class, bc, st.monthlyDiscount || 0);
      if (expected > 0) rows.push({ student: st, batches, expected });
    });
    const extra = visibleCharges.filter(c => c.month === month);
    const tuitionTotal = round2(rows.reduce((a, r) => a + r.expected, 0));
    const extraTotal = round2(extra.reduce((a, c) => a + Number(c.amount || 0), 0));
    return { rows, extra, tuitionTotal, extraTotal, total: round2(tuitionTotal + extraTotal) };
  }

  // ---- Student lifecycle actions ----
  async function saveStudent(data, opts) {
    const id = data.id || uid();
    await setDoc(doc(db, "students", id), { ...data, id, deleted: false });
    setShowStudentForm(false);
    setEditingStudent(null);

    const advanceAmount = Number(opts?.advancePayment) || 0;
    if (advanceAmount > 0) {
      const depId = uid();
      const newDep = {
        id: depId, studentId: id, amount: advanceAmount, date: todayStr(),
        mode: "Cash", remarks: "Advance payment at registration", writeOffAmount: 0, deleted: false,
      };
      await setDoc(doc(db, "deposits", depId), newDep);
      setReceiptData({ deposit: newDep, student: { ...data, id } });
    }
  }

  async function exitStudent(student, resultStatus, exitDateInput) {
    const reason = EXIT_REASONS.find(r => r.value === resultStatus) || EXIT_REASONS[2];
    const ledger = ledgers[student.id] || computeStudentLedger(student, visibleDeposits, visibleCharges, batchesForMonth, expectedFeeFor, curMonth);
    const openingLine = ledger.chargeLines.find(l => l.type === "opening");
    const tuitionOutstanding = ledger.chargeLines.filter(l => l.type === "monthly_fee").reduce((a, l) => a + l.outstanding, 0);
    const openingOutstanding = openingLine ? openingLine.outstanding : 0;
    const newPreviousDues = round2(openingOutstanding + tuitionOutstanding);

    const historyItem = {
      class: student.class, batches: student.batches || [], admissionMonth: student.admissionMonth,
      completionDate: exitDateInput || todayStr(), resultStatus, unpaidBalanceAtEnd: tuitionOutstanding,
    };

    const snapshot = {
      class: student.class, batches: student.batches || [],
      batchHistory: student.batchHistory || [{ fromMonth: student.admissionMonth, batches: student.batches || [] }],
      admissionMonth: student.admissionMonth, previousDues: Number(student.previousDues) || 0,
      academicHistory: student.academicHistory || [], status: student.status || "active",
      resultStatus: student.resultStatus || null, exitDate: student.exitDate || null,
    };

    const updatedStudent = {
      ...student, status: reason.status, resultStatus, previousDues: newPreviousDues,
      academicHistory: [...(student.academicHistory || []), historyItem],
      exitDate: exitDateInput || todayStr(), lastSnapshot: snapshot,
    };

    await setDoc(doc(db, "students", student.id), updatedStudent);
    setShowExitModal(null);
  }

  async function undoExit(student) {
    if (!student.lastSnapshot) { alert("Nothing to undo for this student."); return; }
    if (!window.confirm(`Undo the last status change for ${student.name}? This restores Class ${student.lastSnapshot.class} as Active and removes the most recent history entry.`)) return;
    const snap = student.lastSnapshot;
    const restoredHistory = (student.academicHistory || []).slice(0, -1);
    const restored = {
      ...student, class: snap.class, batches: snap.batches, batchHistory: snap.batchHistory,
      admissionMonth: snap.admissionMonth, previousDues: snap.previousDues,
      academicHistory: restoredHistory.length ? restoredHistory : snap.academicHistory,
      status: "active", resultStatus: null, exitDate: null, lastSnapshot: null,
    };
    await setDoc(doc(db, "students", student.id), restored);
  }

  async function promoteStudent(student, newClass, newBatches, newStartMonth, monthlyDiscount) {
    const history = [...(student.batchHistory || [{ fromMonth: student.admissionMonth, batches: student.batches || [] }])];
    const idx = history.findIndex(h => h.fromMonth === newStartMonth);
    const entry = { fromMonth: newStartMonth, batches: newBatches };
    if (idx >= 0) history[idx] = entry; else history.push(entry);
    history.sort((a, b) => (a.fromMonth < b.fromMonth ? -1 : 1));

    const updatedStudent = {
      ...student, class: newClass, batches: newBatches, batchHistory: history, admissionMonth: newStartMonth,
      monthlyDiscount: Number(monthlyDiscount) || 0, status: "active", resultStatus: null, exitDate: null, lastSnapshot: null,
    };
    await setDoc(doc(db, "students", student.id), updatedStudent);
    setShowPromoteModal(null);
  }

  async function changeStudentBatches(student, fromMonth, newBatches) {
    const history = [...(student.batchHistory || [{ fromMonth: student.admissionMonth, batches: student.batches || [] }])];
    const idx = history.findIndex(h => h.fromMonth === fromMonth);
    const entry = { fromMonth, batches: newBatches };
    if (idx >= 0) history[idx] = entry; else history.push(entry);
    history.sort((a, b) => (a.fromMonth < b.fromMonth ? -1 : 1));
    const latest = history[history.length - 1];
    await setDoc(doc(db, "students", student.id), { ...student, batchHistory: history, batches: latest.batches });
    setShowBatchChangeModal(null);
  }

  // ---- Soft delete / restore (Trash) ----
  async function softDeleteStudent(id) {
    const s = studentById[id];
    if (!s) return;
    if (!window.confirm("Move this student to Trash? All their data (fees, payments, history) is kept and can be restored.")) return;
    await setDoc(doc(db, "students", id), { ...s, deleted: true, deletedAt: todayStr() });
  }
  async function restoreStudent(id) {
    const s = studentById[id];
    if (!s) return;
    await setDoc(doc(db, "students", id), { ...s, deleted: false, deletedAt: null });
  }
  async function permanentlyDeleteStudent(id) {
    if (!window.confirm("Permanently delete this student and all associated records? This cannot be undone.")) return;
    await deleteDoc(doc(db, "students", id));
  }

  async function softDeleteDeposit(id) {
    const d = deposits.find(x => x.id === id);
    if (!d) return;
    if (!window.confirm("Move this receipt to Trash? It can be restored later.")) return;
    await setDoc(doc(db, "deposits", id), { ...d, deleted: true, deletedAt: todayStr() });
  }
  async function restoreDeposit(id) {
    const d = deposits.find(x => x.id === id);
    if (!d) return;
    await setDoc(doc(db, "deposits", id), { ...d, deleted: false, deletedAt: null });
  }
  async function permanentlyDeleteDeposit(id) {
    if (!window.confirm("Permanently delete this receipt? This cannot be undone.")) return;
    await deleteDoc(doc(db, "deposits", id));
  }

  async function addCharge(data) {
    const id = uid();
    const chargeId = `CHG-${shortId(id)}`;
    await setDoc(doc(db, "charges", id), { ...data, id, chargeId, deleted: false, createdAt: todayStr() });
    setShowChargeModal(null);
  }
  async function bulkAddCharges(studentIds, data) {
    await Promise.all(studentIds.map(async (studentId) => {
      const id = uid();
      const chargeId = `CHG-${shortId(id)}`;
      await setDoc(doc(db, "charges", id), { ...data, studentId, id, chargeId, deleted: false, createdAt: todayStr() });
    }));
    setShowBulkChargeModal(false);
  }
  async function softDeleteCharge(id) {
    const c = charges.find(x => x.id === id);
    if (!c) return;
    if (!window.confirm("Remove this charge? It can be restored later from Trash.")) return;
    await setDoc(doc(db, "charges", id), { ...c, deleted: true, deletedAt: todayStr() });
  }
  async function restoreCharge(id) {
    const c = charges.find(x => x.id === id);
    if (!c) return;
    await setDoc(doc(db, "charges", id), { ...c, deleted: false, deletedAt: null });
  }
  async function permanentlyDeleteCharge(id) {
    if (!window.confirm("Permanently delete this charge? This cannot be undone.")) return;
    await deleteDoc(doc(db, "charges", id));
  }

  async function addExpense(data) {
    const id = uid();
    const expenseId = `EXP-${shortId(id)}`;
    const newExp = { ...data, id, expenseId, deleted: false, createdAt: todayStr() };
    await setDoc(doc(db, "expenses", id), newExp);
    setShowExpenseForm(false);
    setExpenseReceiptData(newExp);
  }
  async function softDeleteExpense(id) {
    const e = expenses.find(x => x.id === id);
    if (!e) return;
    if (!window.confirm("Remove this expense? It can be restored later from Trash.")) return;
    await setDoc(doc(db, "expenses", id), { ...e, deleted: true, deletedAt: todayStr() });
  }
  async function restoreExpense(id) {
    const e = expenses.find(x => x.id === id);
    if (!e) return;
    await setDoc(doc(db, "expenses", id), { ...e, deleted: false, deletedAt: null });
  }
  async function permanentlyDeleteExpense(id) {
    if (!window.confirm("Permanently delete this expense? This cannot be undone.")) return;
    await deleteDoc(doc(db, "expenses", id));
  }

  async function saveFeeStructure(updatedMatrix) {
    setFeeStructure(updatedMatrix);
    await setDoc(doc(db, "settings", "feeStructure"), { matrix: updatedMatrix });
  }
  async function saveClasses(updatedList) {
    setClasses(updatedList);
    await setDoc(doc(db, "settings", "classList"), { list: updatedList });
  }
  async function saveSubjects(updatedList) {
    setSubjectsList(updatedList);
    await setDoc(doc(db, "settings", "subjectList"), { list: updatedList });
  }

  async function saveDeposit(data) {
    const id = uid();
    const newDep = { ...data, id, deleted: false };
    await setDoc(doc(db, "deposits", id), newDep);
    setShowDepositForm(false);
    const st = studentById[data.studentId];
    setReceiptData({ deposit: newDep, student: st });
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { id: "class_hub", label: "Class & Dues Hub", icon: BookOpen },
    { id: "students", label: "Students Register", icon: Users },
    { id: "structure", label: "Fee Matrix", icon: Wallet },
    { id: "deposits", label: "Deposits Log", icon: Receipt },
    { id: "expenses", label: "Expenses Log", icon: CreditCard },
    { id: "charges", label: "Additional Charges", icon: ClipboardList },
    { id: "dues", label: "Pending Dues", icon: AlertCircle },
    { id: "statement", label: "Center Statement", icon: FileText },
    { id: "trash", label: "Trash / Restore", icon: Archive },
  ];

  const trashCount = trashedStudents.length + trashedDeposits.length + trashedCharges.length + trashedExpenses.length;

  return (
    <div className="min-h-screen flex" style={{ background: "#FAF6EC", fontFamily: "'Inter', sans-serif", color: "#26231D" }}>
      <style>{`${FONT_IMPORT}
        .ledger-row:nth-child(even) { background: #F5F0E1; }
        input, select { font-family: 'Inter', sans-serif; }
        ::selection { background: #B8862B33; }
      `}</style>

      <aside className="w-60 shrink-0 flex flex-col justify-between" style={{ background: "#12312B" }}>
        <div>
          <div className="px-5 pt-6 pb-5" style={{ borderBottom: "1px solid #24473F" }}>
            <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#F4EFDE] leading-tight">Batch<br/>Ledger Pro</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#8FAE9F" }} className="mt-1 uppercase tracking-wider">Coaching Register</div>
          </div>
          <nav className="px-3 py-4 space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button key={item.id} onClick={() => setTab(item.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-sm text-sm transition-colors relative"
                  style={{ background: active ? "#F4EFDE" : "transparent", color: active ? "#12312B" : "#C9D9CF", fontWeight: active ? 600 : 500 }}>
                  <Icon size={16} />
                  {item.label}
                  {item.id === "trash" && trashCount > 0 && (
                    <span className="ml-auto text-[10px] font-mono px-1.5 rounded-full" style={{ background: "#A63D2F", color: "white" }}>{trashCount}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
        <div style={{ borderTop: "1px solid #24473F" }}>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-5 py-3 text-xs font-medium text-[#8FAE9F] hover:text-[#F4EFDE] transition-colors" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            <LogOut size={14} /> Lock Portal
          </button>
          <div className="px-5 pb-4 text-[10px]" style={{ color: "#6E9384", fontFamily: "'IBM Plex Mono', monospace" }}>
            {monthLabel(curMonth)} · <span style={{ color: "#8FAE9F" }}>live cloud sync</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 px-8 py-7 max-w-6xl">
        {tab === "dashboard" && (
          <DashboardTab
            students={activeStudents} thisMonthCollected={thisMonthCollected} thisMonthWriteOffs={thisMonthWriteOffs}
            thisMonthExpected={thisMonthExpected} totalOutstanding={totalOutstanding} trend={trend} classStrength={classStrength}
            recentDeposits={recentDeposits} studentById={studentById} curMonth={curMonth} classes={classes}
            studentDues={studentDuesMap} forecastForMonth={forecastForMonth}
            totalCashBalance={totalCashBalance} totalOnlineBalance={totalOnlineBalance}
            cashExpensesTotal={cashExpensesTotal} onlineExpensesTotal={onlineExpensesTotal}
            onOpenReceipt={(dep) => setReceiptData({ deposit: dep, student: studentById[dep.studentId] })}
          />
        )}
        {tab === "class_hub" && (
          <ClassAndDuesHubTab
            students={visibleStudents} classes={classes} studentDues={studentDuesMap} outstandingRows={outstandingRows}
            batchesForMonth={batchesForMonth} curMonth={curMonth}
            onManageClasses={() => setShowClassModal(true)}
            onExit={(s) => setShowExitModal(s)} onPromote={(s) => setShowPromoteModal(s)}
            onViewHistory={(s) => setShowHistoryModal(s)} onBatchChange={(s) => setShowBatchChangeModal(s)}
            onUndo={undoExit} onStatement={(s) => setShowStatementModal(s)}
          />
        )}
        {tab === "students" && (
          <StudentsTab
            students={visibleStudents} studentDues={studentDuesMap} classes={classes}
            batchesForMonth={batchesForMonth} curMonth={curMonth}
            onAdd={() => { setEditingStudent(null); setShowStudentForm(true); }}
            onEdit={(s) => { setEditingStudent(s); setShowStudentForm(true); }}
            onExit={(s) => setShowExitModal(s)} onPromote={(s) => setShowPromoteModal(s)}
            onViewHistory={(s) => setShowHistoryModal(s)} onBatchChange={(s) => setShowBatchChangeModal(s)}
            onUndo={undoExit} onStatement={(s) => setShowStatementModal(s)}
            onAddCharge={(s) => setShowChargeModal({ student: s })}
            onRemove={softDeleteStudent}
            onJoiningForm={(s) => setShowJoiningFormModal(s)}
          />
        )}
        {tab === "structure" && <StructureTab feeStructure={feeStructure} setFeeStructure={saveFeeStructure} classes={classes} />}
        {tab === "deposits" && (
          <DepositsTab
            deposits={visibleDeposits} students={visibleStudents} classes={classes} studentDues={studentDuesMap}
            onAdd={() => setShowDepositForm(true)} onRemove={softDeleteDeposit}
            onOpenReceipt={(dep) => setReceiptData({ deposit: dep, student: studentById[dep.studentId] })}
          />
        )}
        {tab === "expenses" && (
          <ExpensesTab
            expenses={visibleExpenses}
            onAdd={() => setShowExpenseForm(true)} onRemove={softDeleteExpense}
            onOpenReceipt={(exp) => setExpenseReceiptData(exp)}
          />
        )}
        {tab === "charges" && (
          <ChargesTab
            charges={visibleCharges} students={visibleStudents} classes={classes}
            onAdd={() => setShowChargeModal({ student: null })} onRemove={softDeleteCharge}
            onBulkAdd={() => setShowBulkChargeModal(true)}
            onOpenReceipt={(c) => setChargeReceiptData({
              line: { chargeId: c.chargeId || `CHG-${shortId(c.id)}`, type: "extra_charge", date: c.date, month: c.month, label: c.remarks ? `Additional Charge — ${c.remarks}` : "Additional Charge", amount: c.amount, remarks: c.remarks || "" },
              student: studentById[c.studentId],
            })}
          />
        )}
        {tab === "dues" && <DuesTab rows={outstandingRows} totalOutstanding={totalOutstanding} students={visibleStudents} studentDues={studentDuesMap} classes={classes} />}
        {tab === "statement" && (
          <CenterStatementTab
            transactions={allTransactions} totals={centerTotals} students={visibleStudents} classes={classes}
            onViewReceipt={(depositId) => {
              const dep = visibleDeposits.find(d => d.id === depositId);
              if (dep) setReceiptData({ deposit: dep, student: studentById[dep.studentId] });
            }}
            onViewCharge={(t) => setChargeReceiptData({
              line: { chargeId: t.chargeId, type: t.type, date: t.date, month: t.month, label: t.label, amount: t.amount, remarks: t.remarks },
              student: studentById[t.studentId],
            })}
            onViewExpense={(t) => {
              const exp = visibleExpenses.find(e => (e.expenseId || `EXP-${shortId(e.id)}`) === t.chargeId);
              if (exp) setExpenseReceiptData(exp);
            }}
          />
        )}
        {tab === "trash" && (
          <TrashTab
            trashedStudents={trashedStudents} trashedDeposits={trashedDeposits} trashedCharges={trashedCharges} trashedExpenses={trashedExpenses}
            studentById={studentById}
            onRestoreStudent={restoreStudent} onDeleteStudent={permanentlyDeleteStudent}
            onRestoreDeposit={restoreDeposit} onDeleteDeposit={permanentlyDeleteDeposit}
            onRestoreCharge={restoreCharge} onDeleteCharge={permanentlyDeleteCharge}
            onRestoreExpense={restoreExpense} onDeleteExpense={permanentlyDeleteExpense}
          />
        )}
      </main>

      {showStudentForm && (
        <StudentFormModal classes={classes} subjectsList={subjectsList} initial={editingStudent}
          onClose={() => { setShowStudentForm(false); setEditingStudent(null); }} onSave={saveStudent} />
      )}
      {showDepositForm && (
        <DepositFormModal students={visibleStudents} studentDues={studentDuesMap} onClose={() => setShowDepositForm(false)} onSave={saveDeposit} />
      )}
      {showClassModal && (
        <ClassManagerModal classes={classes} subjectsList={subjectsList} onClose={() => setShowClassModal(false)} onSaveClasses={saveClasses} onSaveSubjects={saveSubjects} />
      )}
      {showPromoteModal && (
        <PromoteModal student={showPromoteModal} classes={classes} subjectsList={subjectsList} curMonth={curMonth} onClose={() => setShowPromoteModal(null)} onPromote={promoteStudent} />
      )}
      {showExitModal && (
        <ExitStudentModal student={showExitModal} currentDue={studentDuesMap[showExitModal.id] || 0} onClose={() => setShowExitModal(null)} onConfirm={(reason, exitDate) => exitStudent(showExitModal, reason, exitDate)} />
      )}
      {showBatchChangeModal && (
        <BatchChangeModal student={showBatchChangeModal} subjectsList={subjectsList} curMonth={curMonth} onClose={() => setShowBatchChangeModal(null)} onSave={changeStudentBatches} />
      )}
      {showHistoryModal && <AcademicHistoryModal student={showHistoryModal} onClose={() => setShowHistoryModal(null)} />}
      {showChargeModal && (
        <AddChargeModal students={visibleStudents} charges={visibleCharges} initialStudent={showChargeModal.student} curMonth={curMonth} onClose={() => setShowChargeModal(null)} onSave={addCharge} />
      )}
      {showBulkChargeModal && (
        <BulkChargeModal students={visibleStudents} classes={classes} curMonth={curMonth} onClose={() => setShowBulkChargeModal(false)} onSave={bulkAddCharges} />
      )}
      {showJoiningFormModal && (
        <JoiningFormModal student={showJoiningFormModal} onClose={() => setShowJoiningFormModal(null)} />
      )}
      {showStatementModal && (
        <StudentStatementModal
          student={showStatementModal}
          ledger={ledgers[showStatementModal.id]}
          onClose={() => setShowStatementModal(null)}
          onViewReceipt={(depositId) => {
            const dep = visibleDeposits.find(d => d.id === depositId);
            if (dep) setReceiptData({ deposit: dep, student: showStatementModal });
          }}
          onViewCharge={(line) => setChargeReceiptData({ line, student: showStatementModal })}
        />
      )}
      {receiptData && (
        <ReceiptModal deposit={receiptData.deposit} student={receiptData.student} totalRemainingDue={studentDuesMap[receiptData.student?.id] || 0} onClose={() => setReceiptData(null)} />
      )}
      {showExpenseForm && (
        <ExpenseFormModal onClose={() => setShowExpenseForm(false)} onSave={addExpense} />
      )}
      {expenseReceiptData && (
        <ExpenseReceiptModal expense={expenseReceiptData} onClose={() => setExpenseReceiptData(null)} />
      )}
      {chargeReceiptData && (
        <ChargeReceiptModal line={chargeReceiptData.line} student={chargeReceiptData.student} onClose={() => setChargeReceiptData(null)} />
      )}
    </div>
  );
}

function StatCard({ label, value, sub, tone }) {
  const toneColor = { good: "#3F6B52", warn: "#B8862B", bad: "#A63D2F", neutral: "#1B1810" }[tone || "neutral"];
  return (
    <Card className="p-4">
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.1em" }} className="uppercase text-[#9C8F6E] mb-2">{label}</div>
      <div style={{ fontFamily: "'Zilla Slab', serif", color: toneColor }} className="text-3xl font-bold">{value}</div>
      {sub && <div className="text-xs text-[#9C8F6E] mt-1">{sub}</div>}
    </Card>
  );
}

function FeeForecastCard({ curMonth, forecastForMonth }) {
  const [month, setMonth] = useState(curMonth);
  const result = forecastForMonth(month);
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold">Fee Forecast</div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="border rounded-sm px-2.5 py-1.5 text-xs bg-white" style={{ borderColor: "#D8CFB8" }} />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="p-2.5 rounded bg-[#FAF6EC] border" style={{ borderColor: "#D8CFB8" }}>
          <div className="text-[10px] uppercase text-[#9C8F6E] font-mono">Tuition</div>
          <div className="text-lg font-bold text-[#12312B]" style={{ fontFamily: "'Zilla Slab', serif" }}>{fmtINR(result.tuitionTotal)}</div>
        </div>
        <div className="p-2.5 rounded bg-[#FAF6EC] border" style={{ borderColor: "#D8CFB8" }}>
          <div className="text-[10px] uppercase text-[#9C8F6E] font-mono">Additional Charges</div>
          <div className="text-lg font-bold text-[#B8862B]" style={{ fontFamily: "'Zilla Slab', serif" }}>{fmtINR(result.extraTotal)}</div>
        </div>
        <div className="p-2.5 rounded bg-[#EAF1EA] border" style={{ borderColor: "#3F6B52" }}>
          <div className="text-[10px] uppercase text-[#3F6B52] font-mono">Total for {monthLabel(month)}</div>
          <div className="text-lg font-bold text-[#3F6B52]" style={{ fontFamily: "'Zilla Slab', serif" }}>{fmtINR(result.total)}</div>
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {result.rows.length === 0 ? (
          <div className="text-xs text-[#9C8F6E] p-2 text-center">No students will be billed for {monthLabel(month)}.</div>
        ) : (
          <table className="w-full text-xs">
            <tbody>
              {result.rows.map(r => (
                <tr key={r.student.id} className="ledger-row">
                  <td className="px-2 py-1.5 font-medium">{r.student.name}</td>
                  <td className="px-2 py-1.5 text-[#6E6650]">Class {r.student.class}</td>
                  <td className="px-2 py-1.5 text-[#6E6650]">{r.batches.join(", ") || "—"}</td>
                  <td className="px-2 py-1.5 text-right font-mono font-semibold">{fmtINR(r.expected)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}

function DashboardTab({ students, thisMonthCollected, thisMonthWriteOffs, thisMonthExpected, totalOutstanding, trend, classStrength, recentDeposits, studentById, curMonth, classes, studentDues, forecastForMonth, totalCashBalance, totalOnlineBalance, cashExpensesTotal, onlineExpensesTotal, onOpenReceipt }) {
  const collectionRate = thisMonthExpected > 0 ? Math.round((thisMonthCollected / thisMonthExpected) * 100) : 0;
  return (
    <div>
      <SectionHeader eyebrow={monthLabel(curMonth)} title="Summary" />
      <div className="grid grid-cols-4 gap-4 mb-4">
        <StatCard label="Active Students" value={students.length} sub={`${classes.filter(c => students.some(s => s.class === c)).length} active classes`} />
        <StatCard label="Collected this month" value={fmtINR(thisMonthCollected)} sub={`of ${fmtINR(thisMonthExpected)} expected`} tone="good" />
        <StatCard label="Collection rate" value={`${collectionRate}%`} tone={collectionRate >= 80 ? "good" : collectionRate >= 50 ? "warn" : "bad"} />
        <StatCard label="Total Dues Balance" value={fmtINR(totalOutstanding)} sub={thisMonthWriteOffs > 0 ? `${fmtINR(thisMonthWriteOffs)} written off this month` : "includes carried-over dues"} tone={totalOutstanding > 0 ? "bad" : "good"} />
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Cash Balance" value={fmtINR(totalCashBalance)} sub="Cash collected minus cash expenses" tone={totalCashBalance >= 0 ? "good" : "bad"} />
        <StatCard label="Total Online Balance" value={fmtINR(totalOnlineBalance)} sub="UPI / Bank / Cheque minus online expenses" tone={totalOnlineBalance >= 0 ? "good" : "bad"} />
        <StatCard label="Total Cash Expenses" value={fmtINR(cashExpensesTotal)} tone="bad" />
        <StatCard label="Total Online Expenses" value={fmtINR(onlineExpensesTotal)} tone="bad" />
      </div>

      <div className="grid grid-cols-3 gap-5 mb-6">
        <Card className="col-span-2 p-5">
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold mb-3">Collections — last 6 months</div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4DCC5" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#8A7F5F" }} axisLine={{ stroke: "#D8CFB8" }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#8A7F5F" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
                <Tooltip formatter={(v) => fmtINR(v)} contentStyle={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, border: "1px solid #D8CFB8" }} />
                <Bar dataKey="collected" fill="#3F6B52" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5 overflow-y-auto max-h-72">
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold mb-3">Class Strength</div>
          <div className="space-y-2">
            {classes.map(c => (
              <div key={c} className="flex items-center gap-2">
                <span className="text-xs w-20 text-[#6E6650] truncate">{c}</span>
                <div className="flex-1 bg-[#F0EAD6] rounded-sm h-3 overflow-hidden">
                  <div style={{ width: `${students.length ? ((classStrength[c] || 0) / Math.max(...Object.values(classStrength), 1)) * 100 : 0}%`, background: "#12312B" }} className="h-full" />
                </div>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs w-6 text-right">{classStrength[c] || 0}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-5 mb-6">
        <FeeForecastCard curMonth={curMonth} forecastForMonth={forecastForMonth} />
        <Card className="p-5">
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold mb-3">Recent Deposits Logged</div>
          {recentDeposits.length === 0 ? (
            <div className="text-sm text-[#9C8F6E]">No deposits recorded yet.</div>
          ) : (
            <div className="space-y-0 max-h-64 overflow-y-auto">
              {recentDeposits.map(d => {
                const st = studentById[d.studentId];
                return (
                  <div key={d.id} className="flex items-center justify-between py-2 text-sm ledger-row px-2 -mx-2" style={{ borderBottom: "1px solid #EEE7D2" }}>
                    <div>
                      <span className="font-medium">{st ? st.name : "Unknown"}</span>
                      <span className="text-[#9C8F6E] ml-2 text-xs">Class {st ? st.class : "—"} · {d.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="font-semibold text-[#3F6B52]">{fmtINR(d.amount)}</span>
                      <button onClick={() => onOpenReceipt(d)} className="p-1 text-[#12312B] hover:bg-[#E4DCC5] rounded" title="View / Print Receipt">
                        <Printer size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function LifecycleActions({ s, onExit, onPromote, onBatchChange, onViewHistory, onUndo, onStatement, onAddCharge, compact }) {
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
      <button onClick={() => onViewHistory(s)} className="text-[#12312B] underline inline-flex items-center gap-0.5 text-xs"><History size={11} /> Log</button>
    </>
  );
}

function ClassAndDuesHubTab({ students, classes, studentDues, outstandingRows, batchesForMonth, curMonth, onManageClasses, onExit, onPromote, onViewHistory, onBatchChange, onUndo, onStatement, onAddCharge }) {
  const [selectedClass, setSelectedClass] = useState("ALL");
  const [viewMode, setViewMode] = useState("class");
  const [search, setSearch] = useState("");

  const filteredStudents = useMemo(() => {
    let list = selectedClass === "ALL" ? students : students.filter(s => s.class === selectedClass);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(s => (s.name || "").toLowerCase().includes(q) || (s.phone || "").toLowerCase().includes(q));
    return list;
  }, [students, selectedClass, search]);

  const sendWhatsAppReminder = (phone, name, label, amount) => {
    if (!phone) { alert("No phone number recorded for this student."); return; }
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = `Dear Parent, this is a gentle reminder regarding ${name}'s pending balance — ${label}. Pending: ₹${amount}. Please clear it at your earliest convenience. Thank you!`;
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div>
      <SectionHeader eyebrow="Dedicated Analytics" title="Class & Dues Hub" action={
        <button onClick={onManageClasses} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-sm" style={{ background: "white", borderColor: "#26231D" }}>
          <Plus size={14} /> Manage Classes & Subjects
        </button>
      } />

      <div className="flex items-center justify-between mb-5 gap-4">
        <div className="flex border rounded-sm overflow-hidden" style={{ borderColor: "#12312B" }}>
          <button onClick={() => setViewMode("class")} className="px-4 py-2 text-xs font-semibold" style={{ background: viewMode === "class" ? "#12312B" : "white", color: viewMode === "class" ? "#F4EFDE" : "#12312B" }}>
            Class Directory & Promotions
          </button>
          <button onClick={() => setViewMode("dues")} className="px-4 py-2 text-xs font-semibold" style={{ background: viewMode === "dues" ? "#12312B" : "white", color: viewMode === "dues" ? "#F4EFDE" : "#12312B" }}>
            Dues Breakdown ({outstandingRows.length})
          </button>
        </div>
        {viewMode === "class" && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" />
              <input className="border rounded-sm pl-7 pr-3 py-1.5 text-xs bg-white w-48" style={{ borderColor: "#D8CFB8" }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or phone…" />
            </div>
            <span className="text-xs text-[#6E6650]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Filter Class:</span>
            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="border rounded-sm px-3 py-1.5 text-xs bg-white" style={{ borderColor: "#D8CFB8" }}>
              <option value="ALL">All Classes ({students.length})</option>
              {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
            </select>
          </div>
        )}
      </div>

      {viewMode === "class" ? (
        <Card>
          {filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#9C8F6E]">No students match{search ? ` "${search}"` : ""}{selectedClass !== "ALL" ? ` in Class ${selectedClass}` : ""}.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                  {["Name", "Class", "Subjects (this month)", "Total Due", "Status", "Academic Cycle Actions"].map(h => (
                    <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(s => {
                  const due = studentDues[s.id] || 0;
                  const status = s.status || "active";
                  const badgeText = status === "active" ? "Active" : status === "dropped" ? "Dropped Out" : (s.resultStatus || "On Break / Gap");
                  const badgeTone = status === "active" ? "paid" : status === "dropped" ? "overdue" : "break";
                  return (
                    <tr key={s.id} className="ledger-row">
                      <td className="px-4 py-2.5 font-medium">
                        <div className="flex items-center gap-1.5">
                          {s.name}
                          {s.monthlyDiscount > 0 && <span className="text-[10px] bg-[#EAF1EA] text-[#3F6B52] px-1.5 py-0.5 rounded font-mono">-{s.monthlyDiscount}/mo</span>}
                        </div>
                        {s.phone && <div className="text-[10px] text-[#9C8F6E]">{s.phone}</div>}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-[#12312B]">{s.class}</td>
                      <td className="px-4 py-2.5 text-xs text-[#6E6650]">{batchesForMonth(s, curMonth).join(", ") || "—"}</td>
                      <td className="px-4 py-2.5 text-xs font-semibold" style={{ fontFamily: "'IBM Plex Mono', monospace", color: due > 0 ? "#A63D2F" : "#3F6B52" }}>{fmtINR(due)}</td>
                      <td className="px-4 py-2.5 text-xs"><Stamp text={badgeText} tone={badgeTone} /></td>
                      <td className="px-4 py-2.5 text-xs flex flex-wrap gap-2">
                        <LifecycleActions s={s} onExit={onExit} onPromote={onPromote} onBatchChange={onBatchChange} onViewHistory={onViewHistory} onUndo={onUndo} onStatement={onStatement} onAddCharge={onAddCharge} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      ) : (
        <Card>
          {outstandingRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#3F6B52] font-medium">🎉 Great job! There are no pending fee dues.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                  {["Charge ID", "Student", "Class", "Line Item", "Expected", "Paid", "Pending Balance", "WhatsApp Reminder"].map(h => (
                    <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {outstandingRows.map((r, i) => (
                  <tr key={i} className="ledger-row">
                    <td className="px-4 py-2.5 text-[10px] font-mono text-[#9C8F6E]">{r.chargeId}</td>
                    <td className="px-4 py-2.5 font-medium">{r.name}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#12312B]">{r.cls}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                      {r.label}
                      <div><Stamp text={r.type === "opening" ? "Carried Forward" : r.type === "extra_charge" ? "Additional Charge" : (r.isCurrent ? "This Month" : "Overdue")} tone={r.type === "opening" ? "carried" : r.type === "extra_charge" ? "due" : (r.isCurrent ? "due" : "overdue")} /></div>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(r.expected)}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(r.paid)}</td>
                    <td className="px-4 py-2.5 font-bold text-[#A63D2F]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(r.outstanding)}</td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => sendWhatsAppReminder(r.phone, r.name, r.label, r.outstanding)} className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold text-white bg-[#25D366] hover:bg-[#1DA851] transition-colors">
                        <Send size={11} /> Send Notice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}

function StudentsTab({ students, studentDues, classes, batchesForMonth, curMonth, onAdd, onEdit, onExit, onPromote, onViewHistory, onBatchChange, onUndo, onStatement, onAddCharge, onRemove, onJoiningForm }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter(s => {
      if (classFilter !== "all" && String(s.class) !== classFilter) return false;
      if (statusFilter !== "all" && (s.status || "active") !== statusFilter) return false;
      if (!q) return true;
      const haystack = [s.name, s.fatherName, s.phone, s.guardianPhone, s.address].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [students, search, classFilter, statusFilter]);

  const isFiltered = search || classFilter !== "all" || statusFilter !== "all";

  return (
    <div>
      <SectionHeader eyebrow="Register" title="Students Directory" action={
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Add student
        </button>
      } />

      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Search</div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" />
              <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, father's name, phone, guardian phone, or address…" />
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Class</div>
            <select className={inputCls} style={inputStyle} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
              <option value="all">All Classes</option>
              {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Status</div>
            <select className={inputCls} style={inputStyle} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="on_break">On Break</option>
              <option value="dropped">Dropped Out</option>
            </select>
          </div>
          {isFiltered && (
            <button onClick={() => { setSearch(""); setClassFilter("all"); setStatusFilter("all"); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
      </Card>

      <Card>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">{students.length === 0 ? "No students registered yet." : "No students match these filters."}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["", "Name", "Class", "Subjects (this month)", "Total Due", "Status", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const dueAmount = studentDues[s.id] || 0;
                const status = s.status || "active";
                const badgeText = status === "active" ? "Active" : status === "dropped" ? "Dropped Out" : (s.resultStatus || "On Break");
                const badgeTone = status === "active" ? "paid" : status === "dropped" ? "overdue" : "break";
                const isOpen = !!expanded[s.id];
                const hasDetails = s.fatherName || s.guardianPhone || s.address || s.dob || s.currentSchool || s.aadharNumber;
                return (
                  <React.Fragment key={s.id}>
                    <tr className="ledger-row">
                      <td className="pl-3 py-2.5">
                        {hasDetails && (
                          <button onClick={() => setExpanded(prev => ({ ...prev, [s.id]: !prev[s.id] }))} className="text-[#9C8F6E] hover:text-[#12312B] text-xs w-4">
                            {isOpen ? "▾" : "▸"}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-medium">
                        <div>{s.name}</div>
                        {s.phone && <div className="text-[10px] text-[#9C8F6E]">{s.phone}</div>}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-[#12312B]">{s.class}</td>
                      <td className="px-4 py-2.5 text-xs text-[#6E6650]">{batchesForMonth(s, curMonth).join(", ") || "—"}</td>
                      <td className="px-4 py-2.5 text-xs font-semibold" style={{ fontFamily: "'IBM Plex Mono', monospace", color: dueAmount > 0 ? "#A63D2F" : "#3F6B52" }}>{fmtINR(dueAmount)}</td>
                      <td className="px-4 py-2.5 text-xs"><Stamp text={badgeText} tone={badgeTone} /></td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex flex-wrap gap-2 justify-end">
                          <LifecycleActions s={s} onExit={onExit} onPromote={onPromote} onBatchChange={onBatchChange} onViewHistory={onViewHistory} onUndo={onUndo} onStatement={onStatement} onAddCharge={onAddCharge} compact />
                          <button onClick={() => onJoiningForm(s)} className="text-xs text-[#12312B] underline inline-flex items-center gap-0.5"><FileText size={11} /> Joining Form</button>
                          <button onClick={() => onEdit(s)} className="text-xs text-[#12312B] underline">Edit</button>
                          <button onClick={() => onRemove(s.id)} className="text-xs text-[#A63D2F] underline">Remove</button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && hasDetails && (
                      <tr>
                        <td></td>
                        <td colSpan={6} className="px-4 pb-3 pt-0">
                          <div className="grid grid-cols-3 gap-3 p-3 rounded bg-[#FAF6EC] border text-xs" style={{ borderColor: "#D8CFB8" }}>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Father's Name</span>{s.fatherName || "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Guardian Phone</span>{s.guardianPhone || "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Address</span>{s.address || "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Date of Birth</span>{s.dob || "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Current School</span>{s.currentSchool || "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Aadhaar Number</span>{s.aadharNumber || "—"}</div>
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

function StructureTab({ feeStructure, setFeeStructure, classes }) {
  function update(cls, count, val) {
    const updated = { ...feeStructure, [cls]: { ...feeStructure[cls], [count]: Number(val) || 0 } };
    setFeeStructure(updated);
  }
  return (
    <div>
      <SectionHeader eyebrow="Package Pricing" title="Expanded Fee Matrix (1 to 6 Subjects)" />
      <div className="text-sm text-[#6E6650] mb-4">Configure monthly fees based on class and total subjects taken (up to 6 subjects).</div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1.5px solid #26231D" }}>
              <th style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">Class Name</th>
              {[1, 2, 3, 4, 5, 6].map(num => (
                <th key={num} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-3 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{num} Subj Fee</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {classes.map(c => (
              <tr key={c} className="ledger-row">
                <td className="px-4 py-2.5 font-semibold text-[#12312B]">Class {c}</td>
                {[1, 2, 3, 4, 5, 6].map(count => (
                  <td key={count} className="px-2 py-2">
                    <div className="flex items-center gap-0.5">
                      <span className="text-[#9C8F6E] text-xs">₹</span>
                      <input type="number" value={feeStructure[c] ? feeStructure[c][count] || 0 : 0} onChange={(e) => update(c, count, e.target.value)}
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="w-20 border rounded-sm px-1.5 py-1 text-xs bg-white" />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function DepositsTab({ deposits, students, classes, studentDues, onAdd, onRemove, onOpenReceipt }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [receiptSearch, setReceiptSearch] = useState("");

  const byId = Object.fromEntries(students.map(s => [s.id, s]));

  const sorted = [...deposits].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const filtered = sorted.filter(d => {
    const st = byId[d.studentId];
    const q = search.trim().toLowerCase();
    if (q && !(st && st.name.toLowerCase().includes(q))) return false;
    if (classFilter !== "all" && !(st && String(st.class) === classFilter)) return false;
    if (modeFilter !== "all" && d.mode !== modeFilter) return false;
    if (fromDate && d.date < fromDate) return false;
    if (toDate && d.date > toDate) return false;
    if (receiptSearch.trim() && !getReceiptNo(d.id).toLowerCase().includes(receiptSearch.trim().toLowerCase())) return false;
    return true;
  });
  const isFiltered = search || classFilter !== "all" || modeFilter !== "all" || fromDate || toDate || receiptSearch;

  return (
    <div>
      <SectionHeader eyebrow="Fee Deposits" title="Deposits Log" action={
        <button onClick={onAdd} disabled={students.length === 0} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Record deposit
        </button>
      } />

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
              {(classes || []).map(c => <option key={c} value={c}>Class {c}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Mode</div>
            <select className={inputCls} style={inputStyle} value={modeFilter} onChange={e => setModeFilter(e.target.value)}>
              <option value="all">All Modes</option>
              {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">From</div>
            <input type="date" className={inputCls} style={inputStyle} value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">To</div>
            <input type="date" className={inputCls} style={inputStyle} value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <div className="min-w-[130px]">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Receipt No.</div>
            <input className={inputCls} style={inputStyle} value={receiptSearch} onChange={e => setReceiptSearch(e.target.value)} placeholder="e.g. A1B2C3" />
          </div>
          {isFiltered && (
            <button onClick={() => { setSearch(""); setClassFilter("all"); setModeFilter("all"); setFromDate(""); setToDate(""); setReceiptSearch(""); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
      </Card>

      <Card>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">{sorted.length === 0 ? "No fee deposits recorded yet." : "No deposits match these filters."}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Receipt No", "Date", "Student", "Class", "Amount Paid", "Write-off", "Mode", "Reference", "Remarks", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const st = byId[d.studentId];
                const ref = d.utr || d.chequeNumber || "—";
                return (
                  <tr key={d.id} className="ledger-row">
                    <td className="px-4 py-2.5 text-[10px] font-mono text-[#9C8F6E]">#{getReceiptNo(d.id)}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{d.date}</td>
                    <td className="px-4 py-2.5 font-medium">{st ? st.name : "—"}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#12312B]">{st ? st.class : "—"}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#3F6B52]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(d.amount)}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace", color: d.writeOffAmount > 0 ? "#B8862B" : "#9C8F6E" }}>{d.writeOffAmount > 0 ? fmtINR(d.writeOffAmount) : "—"}</td>
                    <td className="px-4 py-2.5 text-xs">{d.mode}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6E6650]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{ref}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6E6650]">{d.remarks || "—"}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onOpenReceipt(d)} className="flex items-center gap-1 text-xs text-[#12312B] underline mr-3 inline-flex"><Printer size={12} /> Receipt</button>
                      <button onClick={() => sendWhatsAppReceipt(d, st, studentDues[st?.id] || 0)} className="text-xs text-[#25D366] font-semibold underline mr-3 inline-flex items-center gap-1"><Send size={11} /> WhatsApp</button>
                      <button onClick={() => onRemove(d.id)} className="text-xs text-[#A63D2F] underline">Delete</button>
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

function ChargesTab({ charges, students, classes, onAdd, onRemove, onOpenReceipt, onBulkAdd }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("");

  const byId = Object.fromEntries(students.map(s => [s.id, s]));
  const sorted = [...charges].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const filtered = sorted.filter(c => {
    const st = byId[c.studentId];
    const q = search.trim().toLowerCase();
    if (q && !(st && st.name.toLowerCase().includes(q))) return false;
    if (classFilter !== "all" && !(st && String(st.class) === classFilter)) return false;
    if (monthFilter && c.month !== monthFilter) return false;
    return true;
  });
  const isFiltered = search || classFilter !== "all" || monthFilter;

  return (
    <div>
      <SectionHeader eyebrow="Ad-hoc Billing" title="Additional Charges" action={
        <div className="flex items-center gap-2">
          <button onClick={onBulkAdd} disabled={students.length === 0} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm border disabled:opacity-40" style={{ borderColor: "#12312B", color: "#12312B", background: "white" }}>
            <ClipboardList size={15} /> Bulk Charge
          </button>
          <button onClick={onAdd} disabled={students.length === 0} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
            <Plus size={15} /> Add Charge
          </button>
        </div>
      } />
      <div className="text-sm text-[#6E6650] mb-4">Every extra charge — exam fee, material cost, late fee, anything outside the regular tuition — logged here with who, when, how much, and why. It automatically adds to that student's balance and shows up in Dues.</div>

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
              {(classes || []).map(c => <option key={c} value={c}>Class {c}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Month</div>
            <input type="month" className={inputCls} style={inputStyle} value={monthFilter} onChange={e => setMonthFilter(e.target.value)} />
          </div>
          {isFiltered && (
            <button onClick={() => { setSearch(""); setClassFilter("all"); setMonthFilter(""); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
      </Card>

      <Card>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">{sorted.length === 0 ? "No additional charges logged yet." : "No charges match these filters."}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Charge ID", "Date Added", "Student", "Class", "For Month", "Amount", "Remarks", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const st = byId[c.studentId];
                return (
                  <tr key={c.id} className="ledger-row">
                    <td className="px-4 py-2.5 text-[10px] font-mono">
                      <button onClick={() => onOpenReceipt(c)} className="text-[#12312B] underline hover:text-[#3F6B52]" title="Open printable receipt">{c.chargeId || `CHG-${shortId(c.id)}`}</button>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{c.date}</td>
                    <td className="px-4 py-2.5 font-medium">{st ? st.name : "—"}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#12312B]">{st ? st.class : "—"}</td>
                    <td className="px-4 py-2.5 text-xs">{monthLabel(c.month)}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#B8862B]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(c.amount)}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6E6650]">{c.remarks || "—"}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onOpenReceipt(c)} className="flex items-center gap-1 text-xs text-[#12312B] underline mr-3 inline-flex"><Printer size={12} /> Receipt</button>
                      <button onClick={() => onRemove(c.id)} className="text-xs text-[#A63D2F] underline">Delete</button>
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

// ============================================================================
// EXPENSES — a dedicated log of money going OUT of the center (rent, salary,
// materials, etc). Each expense gets a unique EXP-XXXXXX id and a printable
// receipt, mirroring how deposits and charges work. Feeds the Cash/Online
// balance tiles on the Dashboard and the master Center Statement.
// ============================================================================
function ExpensesTab({ expenses, onAdd, onRemove, onOpenReceipt }) {
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("");

  const sorted = [...expenses].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const filtered = sorted.filter(e => {
    const q = search.trim().toLowerCase();
    if (q) {
      const haystack = [e.category, e.expenseId, e.remarks].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (modeFilter !== "all" && (e.mode || "Cash") !== modeFilter) return false;
    if (monthFilter && (e.date || "").slice(0, 7) !== monthFilter) return false;
    return true;
  });
  const isFiltered = search || modeFilter !== "all" || monthFilter;
  const totalFiltered = round2(filtered.reduce((a, e) => a + Number(e.amount || 0), 0));

  return (
    <div>
      <SectionHeader eyebrow="Money Out" title="Expenses Log" action={
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Add Expense
        </button>
      } />
      <div className="text-sm text-[#6E6650] mb-4">Every expense the center pays out — rent, salaries, materials, maintenance, anything — logged here with its own Expense ID and a printable receipt. Feeds directly into the Cash / Online balance tiles on the Dashboard.</div>

      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Search</div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" />
              <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Category, Expense ID, or remarks…" />
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Payment Mode</div>
            <select className={inputCls} style={inputStyle} value={modeFilter} onChange={e => setModeFilter(e.target.value)}>
              <option value="all">All Modes</option>
              {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Month</div>
            <input type="month" className={inputCls} style={inputStyle} value={monthFilter} onChange={e => setMonthFilter(e.target.value)} />
          </div>
          {isFiltered && (
            <button onClick={() => { setSearch(""); setModeFilter("all"); setMonthFilter(""); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
      </Card>

      {isFiltered && (
        <div className="text-xs text-[#6E6650] mb-3">Showing {filtered.length} of {expenses.length} expenses · Total: <strong className="text-[#A63D2F]">{fmtINR(totalFiltered)}</strong></div>
      )}

      <Card>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">{sorted.length === 0 ? "No expenses logged yet." : "No expenses match these filters."}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Expense ID", "Date", "Category", "Amount", "Mode", "Reference / UTR", "Remarks", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} className="ledger-row">
                  <td className="px-4 py-2.5 text-[10px] font-mono">
                    <button onClick={() => onOpenReceipt(e)} className="text-[#12312B] underline hover:text-[#3F6B52]" title="Open printable receipt">{e.expenseId || `EXP-${shortId(e.id)}`}</button>
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{e.date}</td>
                  <td className="px-4 py-2.5 font-medium">{e.category || "—"}</td>
                  <td className="px-4 py-2.5 font-semibold text-[#A63D2F]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(e.amount)}</td>
                  <td className="px-4 py-2.5 text-xs">{e.mode || "Cash"}</td>
                  <td className="px-4 py-2.5 text-xs text-[#6E6650]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{e.refNumber || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-[#6E6650]">{e.remarks || "—"}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => onOpenReceipt(e)} className="flex items-center gap-1 text-xs text-[#12312B] underline mr-3 inline-flex"><Printer size={12} /> Receipt</button>
                    <button onClick={() => onRemove(e.id)} className="text-xs text-[#A63D2F] underline">Delete</button>
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

const DUE_TYPE_OPTIONS = [
  { value: "opening", label: "Carried Forward" },
  { value: "monthly_fee", label: "Current Month Tuition" },
  { value: "extra_charge", label: "Additional Charge" },
];

function DuesTab({ rows, totalOutstanding, students, studentDues, classes }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (classFilter !== "all" && String(r.cls) !== classFilter) return false;
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      return true;
    });
  }, [rows, search, classFilter, typeFilter]);

  const isFiltered = search || classFilter !== "all" || typeFilter !== "all";

  return (
    <div>
      <SectionHeader eyebrow="Outstanding Dues" title="Pending Dues Ledger" />
      <Card className="p-5 mb-5 flex items-center justify-between" style={{ borderLeft: "4px solid #A63D2F" }}>
        <div>
          <div className="text-sm text-[#6E6650]">Total pending balance across every student — active, on break, or dropped</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-3xl font-bold text-[#A63D2F]">{fmtINR(totalOutstanding)}</div>
        </div>
        <Stamp text={totalOutstanding > 0 ? "Outstanding Dues Present" : "all clear"} tone={totalOutstanding > 0 ? "overdue" : "paid"} />
      </Card>

      <Card className="mb-6 p-4">
        <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-base font-semibold mb-2">Student Balance Summary</div>
        <div className="grid grid-cols-3 gap-3">
          {students.map(s => {
            const due = studentDues[s.id] || 0;
            if (due === 0) return null;
            return (
              <div key={s.id} className="p-2 border rounded bg-[#FAF6EC] flex justify-between items-center text-xs" style={{ borderColor: "#D8CFB8" }}>
                <div>
                  <div className="font-semibold">{s.name} (Class {s.class})</div>
                  {(s.status || "active") !== "active" && <div className="text-[10px] text-[#4A7B9D]">{s.status === "dropped" ? "Dropped Out" : "On Break / Gap"}</div>}
                </div>
                <div className="font-bold text-[#A63D2F]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(due)}</div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Search Student</div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" />
              <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Type a name…" />
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Class</div>
            <select className={inputCls} style={inputStyle} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
              <option value="all">All Classes</option>
              {(classes || []).map(c => <option key={c} value={c}>Class {c}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Due Type</div>
            <select className={inputCls} style={inputStyle} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="all">All Types</option>
              {DUE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {isFiltered && (
            <button onClick={() => { setSearch(""); setClassFilter("all"); setTypeFilter("all"); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
      </Card>

      <Card>
        {filteredRows.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">{rows.length === 0 ? "No dues pending — active or carried forward." : "No dues match these filters."}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Charge ID", "Student", "Class", "Line Item", "Expected", "Paid", "Outstanding", "Status"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r, i) => (
                <tr key={i} className="ledger-row">
                  <td className="px-4 py-2.5 text-[10px] font-mono text-[#9C8F6E]">{r.chargeId}</td>
                  <td className="px-4 py-2.5 font-medium">{r.name}</td>
                  <td className="px-4 py-2.5 font-semibold text-[#12312B]">{r.cls}</td>
                  <td className="px-4 py-2.5 text-xs">{r.label}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(r.expected)}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(r.paid)}</td>
                  <td className="px-4 py-2.5 font-semibold text-[#A63D2F]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(r.outstanding)}</td>
                  <td className="px-4 py-2.5">
                    <Stamp
                      text={r.type === "opening" ? "Carried Forward" : r.type === "extra_charge" ? "Additional Charge" : (r.isCurrent ? "due" : "overdue")}
                      tone={r.type === "opening" ? "carried" : r.type === "extra_charge" ? "due" : (r.isCurrent ? "due" : "overdue")}
                    />
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

// Type metadata for the center-wide statement — one place that maps a
// ledger line's raw `type` to a display label and a Stamp tone.
const TXN_TYPE_META = {
  opening: { label: "Opening Balance", tone: "carried" },
  monthly_fee: { label: "Tuition Fee", tone: "due" },
  extra_charge: { label: "Additional Charge", tone: "due" },
  payment: { label: "Payment Received", tone: "paid" },
  writeoff: { label: "Write-off / Discount", tone: "break" },
  expense: { label: "Expense", tone: "overdue" },
};

function CenterStatementTab({ transactions, totals, students, classes, onViewReceipt, onViewCharge, onViewExpense }) {
  const statementRef = useRef();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const filtered = transactions.filter(t => {
    if (search && !t.studentName.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (classFilter !== "all" && String(t.studentClass) !== classFilter) return false;
    if (fromDate && t.date < fromDate) return false;
    if (toDate && t.date > toDate) return false;
    return true;
  });

  const filteredTotals = {
    debit: round2(filtered.filter(t => t.kind === "debit").reduce((a, t) => a + t.amount, 0)),
    credit: round2(filtered.filter(t => t.kind === "credit").reduce((a, t) => a + t.amount, 0)),
  };

  const generatedOn = todayStr();
  const isFiltered = search || typeFilter !== "all" || classFilter !== "all" || fromDate || toDate;

  const handlePrint = () => {
    const printContent = statementRef.current.innerHTML;
    const win = window.open("", "", "width=950,height=900");
    win.document.write(`
      <html>
        <head>
          <title>Center Statement - Coaching Classes</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 24px; color: #12312B; }
            .stmt-header { text-align: center; border-bottom: 2px dashed #12312B; padding-bottom: 12px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { text-align: left; text-transform: uppercase; letter-spacing: 0.06em; font-size: 9px; color: #6E6650; border-bottom: 1.5px solid #26231D; padding: 6px 8px; }
            td { padding: 6px 8px; border-bottom: 1px solid #EEE7D2; }
            .num { font-family: monospace; }
            .debit { color: #A63D2F; }
            .credit { color: #3F6B52; }
            .footer { border-top: 1.5px solid #12312B; padding-top: 10px; margin-top: 16px; text-align: center; font-size: 10px; color: #6E6650; }
          </style>
        </head>
        <body>${printContent}</body>
      </html>
    `);
    win.document.close(); win.focus(); win.print(); win.close();
  };

  return (
    <div>
      <SectionHeader eyebrow="Center-Wide Ledger" title="Master Transaction Statement" action={
        <button onClick={handlePrint} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Printer size={15} /> Print / Export
        </button>
      } />
      <div className="text-sm text-[#6E6650] mb-4">Every transaction recorded across the entire coaching center — tuition charges, additional charges, payments, and write-offs — for every student, in one place.</div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        <Card className="p-3.5">
          <div className="text-[10px] uppercase text-[#9C8F6E] font-mono">Total Charged</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#1B1810]">{fmtINR(totals.charged)}</div>
        </Card>
        <Card className="p-3.5" style={{ borderLeft: "3px solid #3F6B52" }}>
          <div className="text-[10px] uppercase text-[#3F6B52] font-mono">Total Collected</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#3F6B52]">{fmtINR(totals.collected)}</div>
        </Card>
        <Card className="p-3.5" style={{ borderLeft: "3px solid #B8862B" }}>
          <div className="text-[10px] uppercase text-[#B8862B] font-mono">Total Written Off</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#8A6420]">{fmtINR(totals.writtenOff)}</div>
        </Card>
        <Card className="p-3.5" style={{ borderLeft: "3px solid #A63D2F" }}>
          <div className="text-[10px] uppercase text-[#A63D2F] font-mono">Outstanding</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#A63D2F]">{fmtINR(totals.outstanding)}</div>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <Card className="p-3.5" style={{ borderLeft: "3px solid #3F6B52" }}>
          <div className="text-[10px] uppercase text-[#3F6B52] font-mono flex items-center gap-1"><Banknote size={11} /> Cash Balance</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#3F6B52]">{fmtINR(totals.cashBalance)}</div>
        </Card>
        <Card className="p-3.5" style={{ borderLeft: "3px solid #4A7B9D" }}>
          <div className="text-[10px] uppercase text-[#2B526C] font-mono flex items-center gap-1"><Landmark size={11} /> Online Balance</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#2B526C]">{fmtINR(totals.onlineBalance)}</div>
        </Card>
        <Card className="p-3.5" style={{ borderLeft: "3px solid #B8862B" }}>
          <div className="text-[10px] uppercase text-[#8A6420] font-mono">Total Expenses</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#8A6420]">{fmtINR(totals.expenses)}</div>
        </Card>
      </div>

      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Search Student</div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" />
              <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Type a name…" />
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Type</div>
            <select className={inputCls} style={inputStyle} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="all">All Transactions</option>
              {Object.entries(TXN_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Class</div>
            <select className={inputCls} style={inputStyle} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
              <option value="all">All Classes</option>
              {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">From</div>
            <input type="date" className={inputCls} style={inputStyle} value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">To</div>
            <input type="date" className={inputCls} style={inputStyle} value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          {isFiltered && (
            <button onClick={() => { setSearch(""); setTypeFilter("all"); setClassFilter("all"); setFromDate(""); setToDate(""); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
      </Card>

      <Card>
        <div ref={statementRef}>
          <div className="stmt-header text-center pb-3 mb-1 px-4 pt-4 border-b-2 border-dashed border-[#12312B]">
            <h2 style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#12312B]">COACHING CLASSES</h2>
            <p className="text-[10px] uppercase tracking-wider text-[#9C8F6E]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Center-Wide Master Statement — Generated {generatedOn}</p>
          </div>
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#9C8F6E]">No transactions match these filters.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                  {["Reference / ID", "Date", "Charges Month", "Student", "Class", "Description", "Remarks", "Type", "Reference / UTR", "Debit", "Credit"].map(h => (
                    <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  const meta = TXN_TYPE_META[t.type] || { label: t.type, tone: "due" };
                  const hasReceipt = t.kind === "credit" && (t.type === "payment" || t.type === "writeoff");
                  const isChargeLine = t.kind === "debit" && (t.type === "opening" || t.type === "monthly_fee" || t.type === "extra_charge") && onViewCharge;
                  const isExpenseLine = t.type === "expense" && onViewExpense;
                  return (
                    <tr key={t.id + "-" + i} className="ledger-row">
                      <td className="px-4 py-2.5 text-[10px] font-mono">
                        {isChargeLine ? (
                          <button onClick={() => onViewCharge(t)} className="text-[#12312B] underline hover:text-[#3F6B52]" title="Open printable receipt">{t.chargeId || "—"}</button>
                        ) : isExpenseLine ? (
                          <button onClick={() => onViewExpense(t)} className="text-[#12312B] underline hover:text-[#3F6B52]" title="Open printable receipt">{t.chargeId || "—"}</button>
                        ) : hasReceipt ? (
                          <button onClick={() => onViewReceipt(t.depositId)} className="underline text-[#12312B] font-semibold inline-flex items-center gap-1 hover:text-[#3F6B52]" title="Open official receipt">
                            <Receipt size={10} /> #{t.receiptNo}
                          </button>
                        ) : (
                          <span className="text-[#9C8F6E]">{t.chargeId || "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{t.date}</td>
                      <td className="px-4 py-2.5 text-xs font-mono">{t.month ? monthLabel(t.month) : "—"}</td>
                      <td className="px-4 py-2.5 font-medium">{t.studentName}{t.studentStatus !== "active" && <span className="ml-1.5 text-[10px] text-[#4A7B9D]">({t.studentStatus === "dropped" ? "dropped" : "on break"})</span>}</td>
                      <td className="px-4 py-2.5 font-semibold text-[#12312B]">{t.studentClass}</td>
                      <td className="px-4 py-2.5 text-xs">{t.label}</td>
                      <td className="px-4 py-2.5 text-xs text-[#6E6650]">{t.remarks || "—"}</td>
                      <td className="px-4 py-2.5"><Stamp text={meta.label} tone={meta.tone} /></td>
                      <td className="px-4 py-2.5 text-xs text-[#6E6650]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{t.ref || "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-[#A63D2F]">{t.kind === "debit" ? fmtINR(t.amount) : ""}</td>
                      <td className="px-4 py-2.5 font-mono text-[#3F6B52]">{t.kind === "credit" ? fmtINR(t.amount) : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "1.5px solid #26231D" }}>
                  <td colSpan={9} className="px-4 py-2.5 text-right text-xs font-semibold text-[#6E6650]">Filtered Totals:</td>
                  <td className="px-4 py-2.5 font-mono font-bold text-[#A63D2F]">{fmtINR(filteredTotals.debit)}</td>
                  <td className="px-4 py-2.5 font-mono font-bold text-[#3F6B52]">{fmtINR(filteredTotals.credit)}</td>
                </tr>
              </tfoot>
            </table>
          )}
          <div className="footer text-center pt-3 pb-4 mt-2 border-t border-dashed border-[#12312B] text-[10px] text-[#9C8F6E]">
            Computer Generated Statement · Reflects every deposit, tuition charge, additional charge, and write-off recorded center-wide
          </div>
        </div>
      </Card>
    </div>
  );
}

function TrashTab({ trashedStudents, trashedDeposits, trashedCharges, trashedExpenses, studentById, onRestoreStudent, onDeleteStudent, onRestoreDeposit, onDeleteDeposit, onRestoreCharge, onDeleteCharge, onRestoreExpense, onDeleteExpense }) {
  return (
    <div>
      <SectionHeader eyebrow="Recycle Bin" title="Trash / Restore" />
      <div className="text-sm text-[#6E6650] mb-5">Deleted students, receipts, and charges land here first — nothing is gone for good until you permanently delete it. Restoring brings back the exact record with no data lost.</div>

      <div className="mb-3" style={{ fontFamily: "'Zilla Slab', serif" }}><span className="text-lg font-semibold">Deleted Students</span></div>
      <Card className="mb-6">
        {trashedStudents.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted students.</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {trashedStudents.map(s => (
                <tr key={s.id} className="ledger-row">
                  <td className="px-4 py-2.5 font-medium">{s.name}</td>
                  <td className="px-4 py-2.5 text-xs text-[#6E6650]">Class {s.class}</td>
                  <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono">Deleted {s.deletedAt || ""}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => onRestoreStudent(s.id)} className="text-xs text-[#3F6B52] font-semibold underline mr-3 inline-flex items-center gap-1"><RotateCcw size={11} /> Restore</button>
                    <button onClick={() => onDeleteStudent(s.id)} className="text-xs text-[#A63D2F] underline">Delete Permanently</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="mb-3" style={{ fontFamily: "'Zilla Slab', serif" }}><span className="text-lg font-semibold">Deleted Receipts</span></div>
      <Card className="mb-6">
        {trashedDeposits.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted receipts.</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {trashedDeposits.map(d => {
                const st = studentById[d.studentId];
                return (
                  <tr key={d.id} className="ledger-row">
                    <td className="px-4 py-2.5 text-xs font-mono">{d.date}</td>
                    <td className="px-4 py-2.5 font-medium">{st ? st.name : "—"}</td>
                    <td className="px-4 py-2.5 text-xs font-mono font-semibold text-[#3F6B52]">{fmtINR(d.amount)}</td>
                    <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono">Deleted {d.deletedAt || ""}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onRestoreDeposit(d.id)} className="text-xs text-[#3F6B52] font-semibold underline mr-3 inline-flex items-center gap-1"><RotateCcw size={11} /> Restore</button>
                      <button onClick={() => onDeleteDeposit(d.id)} className="text-xs text-[#A63D2F] underline">Delete Permanently</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <div className="mb-3" style={{ fontFamily: "'Zilla Slab', serif" }}><span className="text-lg font-semibold">Deleted Charges</span></div>
      <Card className="mb-6">
        {trashedCharges.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted charges.</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {trashedCharges.map(c => {
                const st = studentById[c.studentId];
                return (
                  <tr key={c.id} className="ledger-row">
                    <td className="px-4 py-2.5 text-xs font-mono">{c.date}</td>
                    <td className="px-4 py-2.5 font-medium">{st ? st.name : "—"}</td>
                    <td className="px-4 py-2.5 text-xs font-mono font-semibold text-[#B8862B]">{fmtINR(c.amount)}</td>
                    <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono">Deleted {c.deletedAt || ""}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onRestoreCharge(c.id)} className="text-xs text-[#3F6B52] font-semibold underline mr-3 inline-flex items-center gap-1"><RotateCcw size={11} /> Restore</button>
                      <button onClick={() => onDeleteCharge(c.id)} className="text-xs text-[#A63D2F] underline">Delete Permanently</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <div className="mb-3" style={{ fontFamily: "'Zilla Slab', serif" }}><span className="text-lg font-semibold">Deleted Expenses</span></div>
      <Card>
        {trashedExpenses.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted expenses.</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {trashedExpenses.map(e => (
                <tr key={e.id} className="ledger-row">
                  <td className="px-4 py-2.5 text-xs font-mono">{e.date}</td>
                  <td className="px-4 py-2.5 font-medium">{e.category || "—"}</td>
                  <td className="px-4 py-2.5 text-xs font-mono font-semibold text-[#A63D2F]">{fmtINR(e.amount)}</td>
                  <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono">Deleted {e.deletedAt || ""}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => onRestoreExpense(e.id)} className="text-xs text-[#3F6B52] font-semibold underline mr-3 inline-flex items-center gap-1"><RotateCcw size={11} /> Restore</button>
                    <button onClick={() => onDeleteExpense(e.id)} className="text-xs text-[#A63D2F] underline">Delete Permanently</button>
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

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#12312Bcc" }}>
      <div className="w-full max-w-lg bg-[#FAF6EC] rounded-sm" style={{ border: "2px dashed #B8862B" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1.5px solid #26231D" }}>
          <h3 style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-[#6E6650]"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function WideModal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#12312Bcc" }}>
      <div className="w-full max-w-2xl bg-[#FAF6EC] rounded-sm" style={{ border: "2px dashed #B8862B" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1.5px solid #26231D" }}>
          <h3 style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-[#6E6650]"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-3">
      <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.08em" }} className="block uppercase text-[#9C8F6E] mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full border rounded-sm px-3 py-2 text-sm bg-white";
const inputStyle = { borderColor: "#D8CFB8" };

function StudentFormModal({ classes, subjectsList, initial, onClose, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [cls, setCls] = useState(initial?.class || classes[0] || "10");
  const [batches, setBatches] = useState(initial?.batches || []);
  const [phone, setPhone] = useState(initial?.phone || "");
  const [fatherName, setFatherName] = useState(initial?.fatherName || "");
  const [guardianPhone, setGuardianPhone] = useState(initial?.guardianPhone || "");
  const [address, setAddress] = useState(initial?.address || "");
  const [admissionMonth, setAdmissionMonth] = useState(initial?.admissionMonth || currentMonthKey());
  const [monthlyDiscount, setMonthlyDiscount] = useState(initial?.monthlyDiscount || 0);
  const [previousDues, setPreviousDues] = useState(initial?.previousDues || 0);
  const [status] = useState(initial?.status || "active");
  const [dob, setDob] = useState(initial?.dob || "");
  const [currentSchool, setCurrentSchool] = useState(initial?.currentSchool || "");
  const [aadharNumber, setAadharNumber] = useState(initial?.aadharNumber || "");
  const [advancePayment, setAdvancePayment] = useState("");

  function toggleSubject(sub) {
    setBatches(prev => prev.includes(sub) ? prev.filter(x => x !== sub) : (prev.length >= 6 ? prev : [...prev, sub]));
  }

  function submit() {
    if (!name.trim()) return;
    const baseHistory = initial?.batchHistory && initial.batchHistory.length ? [...initial.batchHistory] : [{ fromMonth: admissionMonth, batches }];
    if (initial?.batchHistory && initial.batchHistory.length) baseHistory[0] = { ...baseHistory[0], batches };
    onSave({
      ...initial, id: initial?.id, name: name.trim(), class: cls, batches, batchHistory: baseHistory,
      phone: phone.trim(), fatherName: fatherName.trim(), guardianPhone: guardianPhone.trim(), address: address.trim(),
      admissionMonth, monthlyDiscount: Number(monthlyDiscount) || 0,
      previousDues: Number(previousDues) || 0, status,
      dob, currentSchool: currentSchool.trim(), aadharNumber: aadharNumber.trim(),
    }, { advancePayment: Number(advancePayment) || 0 });
  }

  return (
    <Modal title={initial ? "Edit Student Details" : "Add New Student"} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Full Name"><input className={inputCls} style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rahul Sharma" /></Field>
        <Field label="Father's Name"><input className={inputCls} style={inputStyle} value={fatherName} onChange={e => setFatherName(e.target.value)} placeholder="e.g. Suresh Sharma" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Class">
          <select className={inputCls} style={inputStyle} value={cls} onChange={e => setCls(e.target.value)}>
            {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
          </select>
        </Field>
        <Field label="Fee Start Month"><input type="month" className={inputCls} style={inputStyle} value={admissionMonth} onChange={e => setAdmissionMonth(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone / WhatsApp Number"><input className={inputCls} style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit phone number" /></Field>
        <Field label="Guardian Phone Number"><input className={inputCls} style={inputStyle} value={guardianPhone} onChange={e => setGuardianPhone(e.target.value)} placeholder="Alternate contact (optional)" /></Field>
      </div>
      <Field label="Address"><input className={inputCls} style={inputStyle} value={address} onChange={e => setAddress(e.target.value)} placeholder="House / street / area / city" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date of Birth"><input type="date" className={inputCls} style={inputStyle} value={dob} onChange={e => setDob(e.target.value)} /></Field>
        <Field label="Current School / Institution"><input className={inputCls} style={inputStyle} value={currentSchool} onChange={e => setCurrentSchool(e.target.value)} placeholder="e.g. Delhi Public School" /></Field>
      </div>
      <Field label="Aadhaar Number"><input className={inputCls} style={inputStyle} value={aadharNumber} onChange={e => setAadharNumber(e.target.value.replace(/[^0-9]/g, "").slice(0, 12))} placeholder="12-digit Aadhaar number" /></Field>
      <Field label="Monthly Concession / Discount (₹)"><input type="number" className={inputCls} style={inputStyle} value={monthlyDiscount} onChange={e => setMonthlyDiscount(e.target.value)} placeholder="0" /></Field>
      <Field label="Advance Payment Received Now (₹) — optional">
        <input type="number" className={inputCls} style={inputStyle} value={advancePayment} onChange={e => setAdvancePayment(e.target.value)} placeholder="0" />
        <div className="text-[10px] text-[#9C8F6E] mt-1">If the student is paying something upfront right now, enter it here. It will be recorded as a Deposit and a receipt will be generated automatically upon saving.</div>
      </Field>
      <Field label="Opening Balance / Legacy Carried Dues (₹)">
        <input type="number" className={inputCls} style={inputStyle} value={previousDues} onChange={e => setPreviousDues(e.target.value)} placeholder="0" />
        <div className="text-[10px] text-[#9C8F6E] mt-1">Only for a one-time starting balance (e.g. migrating from a paper register). For anything ongoing, use "Add Charge" instead — it keeps a dated log.</div>
      </Field>
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
    </Modal>
  );
}

function ExitStudentModal({ student, currentDue, onClose, onConfirm }) {
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

function BatchChangeModal({ student, subjectsList, curMonth, onClose, onSave }) {
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

function PromoteModal({ student, classes, subjectsList, curMonth, onClose, onPromote }) {
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
      <div className="grid grid-cols-2 gap-3">
        <Field label="New Class">
          <select className={inputCls} style={inputStyle} value={newClass} onChange={e => setNewClass(e.target.value)}>
            {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
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

function AcademicHistoryModal({ student, onClose }) {
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
                <span>Class {h.class}</span>
                <Stamp text={h.resultStatus || "Completed"} tone={h.resultStatus === "Dropped" ? "overdue" : "paid"} />
              </div>
              <div className="text-xs text-[#6E6650] mt-1">Subjects: {(h.batches || []).join(", ") || "General"}</div>
              <div className="text-[11px] text-[#9C8F6E] mt-1 flex justify-between" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                <span>Joined: {monthLabel(h.admissionMonth)}</span>
                <span>Ended: {h.completionDate}</span>
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

function AddChargeModal({ students, charges, initialStudent, curMonth, onClose, onSave }) {
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
    return charges.filter(c => c.studentId === studentId).sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5);
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
            <span className="text-sm flex-1 truncate">{student ? `${student.name} — Class ${student.class}${student.phone ? " · " + student.phone : ""}` : "Search by name, class, or phone…"}</span>
          </div>
          {pickerOpen && (
            <div className="absolute z-10 mt-1 w-full bg-white border rounded-sm shadow-lg max-h-72 overflow-y-auto" style={{ borderColor: "#D8CFB8" }}>
              <div className="p-2 sticky top-0 bg-white border-b flex gap-2" style={{ borderColor: "#EEE7D2" }}>
                <input autoFocus className={inputCls} style={inputStyle} value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="Type name or phone…" />
                <select className={inputCls} style={{ ...inputStyle, width: "auto" }} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                  <option value="all">All Classes</option>
                  {classOptions.map(c => <option key={c} value={c}>Class {c}</option>)}
                </select>
              </div>
              {filteredStudents.length === 0 ? (
                <div className="p-3 text-xs text-[#9C8F6E] text-center">No students match.</div>
              ) : (
                filteredStudents.map(s => (
                  <button key={s.id} type="button" onClick={() => { setStudentId(s.id); setPickerOpen(false); setStudentSearch(""); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#F5F0E1] flex items-center justify-between"
                    style={{ background: s.id === studentId ? "#F5F0E1" : "white" }}>
                    <span>{s.name} <span className="text-xs text-[#9C8F6E]">— Class {s.class}</span></span>
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
                <span className="text-[#6E6650]">{c.chargeId || `CHG-${shortId(c.id)}`} · {c.date} · {c.remarks || monthLabel(c.month)}</span>
                <span className="font-mono font-semibold text-[#B8862B]">{fmtINR(c.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
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
// BULK CHARGE — apply the same ad-hoc charge to many students at once,
// filtered by class and/or batch/subject, so exam fees, trip costs, etc.
// don't need to be entered student-by-student.
// ============================================================================
function BulkChargeModal({ students, classes, curMonth, onClose, onSave }) {
  const [classFilter, setClassFilter] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [selected, setSelected] = useState({});
  const [month, setMonth] = useState(curMonth);
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [date, setDate] = useState(todayStr());

  const batchOptions = useMemo(() => {
    const set = new Set();
    students.forEach(s => (s.batches || []).forEach(b => set.add(b)));
    return Array.from(set).sort();
  }, [students]);

  const eligible = useMemo(() => {
    return students.filter(s => {
      if (classFilter !== "all" && String(s.class) !== classFilter) return false;
      if (batchFilter !== "all" && !(s.batches || []).includes(batchFilter)) return false;
      return true;
    });
  }, [students, classFilter, batchFilter]);

  // Whenever the filter set changes, default-select everyone currently eligible.
  useEffect(() => {
    setSelected(Object.fromEntries(eligible.map(s => [s.id, true])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classFilter, batchFilter]);

  const selectedIds = eligible.filter(s => selected[s.id]).map(s => s.id);

  function toggleAll(v) {
    setSelected(Object.fromEntries(eligible.map(s => [s.id, v])));
  }
  function toggleOne(id) {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  }
  function submit() {
    if (!selectedIds.length || !amount) return;
    onSave(selectedIds, { month, amount: Number(amount), remarks: remarks.trim(), date });
  }

  return (
    <WideModal title="Bulk Charge — Apply to Multiple Students" onClose={onClose}>
      <div className="text-xs text-[#6E6650] mb-3">Charge the same amount, for the same reason, to a whole class or batch at once — e.g. an annual exam fee for all of Class 10, or a trip fee for everyone in the Physics batch.</div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="Filter by Class">
          <select className={inputCls} style={inputStyle} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
            <option value="all">All Classes</option>
            {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
          </select>
        </Field>
        <Field label="Filter by Subject / Batch">
          <select className={inputCls} style={inputStyle} value={batchFilter} onChange={e => setBatchFilter(e.target.value)}>
            <option value="all">All Batches</option>
            {batchOptions.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <Field label="For Month"><input type="month" className={inputCls} style={inputStyle} value={month} onChange={e => setMonth(e.target.value)} /></Field>
        <Field label="Date Added"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Amount per Student (₹)"><input type="number" className={inputCls} style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></Field>
      </div>
      <Field label="Remarks — what is this charge for?"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g. Annual Sports Day fee" /></Field>

      <div className="border rounded-sm bg-white mb-3" style={{ borderColor: "#D8CFB8" }}>
        <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "#EEE7D2" }}>
          <span className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono">{selectedIds.length} of {eligible.length} selected</span>
          <div className="flex gap-3">
            <button onClick={() => toggleAll(true)} className="text-xs text-[#12312B] underline">Select all</button>
            <button onClick={() => toggleAll(false)} className="text-xs text-[#A63D2F] underline">Clear</button>
          </div>
        </div>
        <div className="max-h-56 overflow-y-auto">
          {eligible.length === 0 ? (
            <div className="p-3 text-xs text-[#9C8F6E] text-center">No students match this filter.</div>
          ) : (
            eligible.map(s => (
              <label key={s.id} className="flex items-center justify-between px-3 py-1.5 text-sm cursor-pointer hover:bg-[#F5F0E1]">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={!!selected[s.id]} onChange={() => toggleOne(s.id)} />
                  {s.name}
                </span>
                <span className="text-xs text-[#9C8F6E]">Class {s.class} · {(s.batches || []).join(", ") || "—"}</span>
              </label>
            ))
          )}
        </div>
      </div>

      {amount && selectedIds.length > 0 && (
        <div className="p-2.5 rounded-sm border bg-[#EAF1EA] text-xs mb-3" style={{ borderColor: "#3F6B52" }}>
          Total to be charged: <strong>{fmtINR(Number(amount) * selectedIds.length)}</strong> across {selectedIds.length} student{selectedIds.length === 1 ? "" : "s"}.
        </div>
      )}

      <button onClick={submit} disabled={!selectedIds.length || !amount} className="w-full mt-1 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Apply Charge to {selectedIds.length || 0} Student{selectedIds.length === 1 ? "" : "s"}
      </button>
    </WideModal>
  );
}

// ============================================================================
// STUDENT STATEMENT — a bank-style "account statement" of every transaction
// (tuition accrual, ad-hoc charges, deposits, write-offs) for one student,
// each row carrying a running balance like the ledger engine produces.
// Payment rows show a Receipt No that links straight to that deposit's
// official receipt (via onViewReceipt), so nothing has to be looked up by hand.
// ============================================================================
function StudentStatementModal({ student, ledger, onClose, onViewReceipt, onViewCharge }) {
  const statementRef = useRef();
  if (!ledger) return null;

  const generatedOn = todayStr();

  const handlePrintStatement = () => {
    const printContent = statementRef.current.innerHTML;
    const win = window.open("", "", "width=850,height=900");
    win.document.write(`
      <html>
        <head>
          <title>Account Statement - ${student.name}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 24px; color: #12312B; }
            .stmt-header { text-align: center; border-bottom: 2px dashed #12312B; padding-bottom: 12px; margin-bottom: 16px; }
            .stmt-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 12px; margin-bottom: 16px; }
            .stmt-meta div { display: flex; justify-content: space-between; border-bottom: 1px dotted #D8CFB8; padding: 3px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { text-align: left; text-transform: uppercase; letter-spacing: 0.06em; font-size: 9px; color: #6E6650; border-bottom: 1.5px solid #26231D; padding: 6px 8px; }
            td { padding: 6px 8px; border-bottom: 1px solid #EEE7D2; }
            .num { font-family: monospace; }
            .debit { color: #A63D2F; }
            .credit { color: #3F6B52; }
            .summary { display: flex; justify-content: space-between; margin: 14px 0; font-size: 12px; font-weight: bold; }
            .footer { border-top: 1.5px solid #12312B; padding-top: 10px; margin-top: 16px; text-align: center; font-size: 10px; color: #6E6650; }
          </style>
        </head>
        <body>${printContent}</body>
      </html>
    `);
    win.document.close(); win.focus(); win.print(); win.close();
  };

  return (
    <WideModal title={`Statement — ${student.name}`} onClose={onClose}>
      <div ref={statementRef}>
        {/* Letterhead — mirrors the official receipt so the statement reads as one professional record system */}
        <div className="text-center pb-3 mb-4 border-b-2 border-dashed border-[#12312B]">
          <h2 style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#12312B]">COACHING CLASSES</h2>
          <p className="text-[10px] uppercase tracking-wider text-[#9C8F6E]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Official Account Statement — All Recorded Transactions</p>
        </div>

        {/* Student / account details */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-4 text-xs">
          <div className="flex justify-between border-b border-dotted pb-1" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Student Name:</span><strong className="text-[#12312B]">{student.name}</strong></div>
          <div className="flex justify-between border-b border-dotted pb-1" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Statement Date:</span><strong className="text-[#12312B]">{generatedOn}</strong></div>
          <div className="flex justify-between border-b border-dotted pb-1" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Class:</span><strong className="text-[#12312B]">Class {student.class}</strong></div>
          <div className="flex justify-between border-b border-dotted pb-1" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Phone:</span><strong className="text-[#12312B]">{student.phone || "—"}</strong></div>
          <div className="flex justify-between border-b border-dotted pb-1" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Fee Start Month:</span><strong className="text-[#12312B]">{monthLabel(student.admissionMonth)}</strong></div>
          <div className="flex justify-between border-b border-dotted pb-1" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Status:</span><strong className="text-[#12312B] capitalize">{(student.status || "active").replace("_", " ")}</strong></div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
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
                {["Charge ID", "Date", "Charges Month", "Description", "Remarks", "Receipt No", "Debit", "Credit", "Balance"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-3 py-2 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.timeline.map((l, i) => (
                <tr key={i} className="ledger-row">
                  <td className="px-3 py-2 font-mono">
                    {l.kind === "debit" && onViewCharge && l.chargeId ? (
                      <button onClick={() => onViewCharge(l)} className="text-[#12312B] underline hover:text-[#3F6B52]" title="Open printable receipt">{l.chargeId}</button>
                    ) : (
                      <span className="text-[#9C8F6E]">{l.chargeId || "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono">{l.date}</td>
                  <td className="px-3 py-2 font-mono">{l.month ? monthLabel(l.month) : "—"}</td>
                  <td className="px-3 py-2">
                    {l.label}
                    {l.kind === "debit" && l.outstanding > 0 && <span className="ml-2"><Stamp text="Unpaid" tone="overdue" /></span>}
                  </td>
                  <td className="px-3 py-2 text-[#6E6650]">{l.remarks || "—"}</td>
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
                    ) : (
                      <span className="text-[#D8CFB8]">—</span>
                    )}
                  </td>
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

function DepositFormModal({ students, studentDues, onClose, onSave }) {
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
            <span className="text-sm flex-1 truncate">{student ? `${student.name} — Class ${student.class}${student.phone ? " · " + student.phone : ""}` : "Search by name, class, or phone…"}</span>
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
                    <span>{s.name} <span className="text-xs text-[#9C8F6E]">— Class {s.class}</span></span>
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

      <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
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
function ExpenseFormModal({ onClose, onSave }) {
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [mode, setMode] = useState("Cash");
  const [refNumber, setRefNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  function submit() {
    if (!category.trim() || !amount) return;
    onSave({
      category: category.trim(), amount: Number(amount) || 0, date, mode,
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

      <div className="grid grid-cols-2 gap-3">
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

function ClassManagerModal({ classes, subjectsList, onClose, onSaveClasses, onSaveSubjects }) {
  const [classList, setClassList] = useState([...classes]);
  const [subjList, setSubjList] = useState([...subjectsList]);
  const [newClassName, setNewClassName] = useState("");
  const [newSubjName, setNewSubjName] = useState("");

  const addClass = () => { if (newClassName.trim() && !classList.includes(newClassName.trim())) { setClassList([...classList, newClassName.trim()]); setNewClassName(""); } };
  const addSubject = () => { if (newSubjName.trim() && !subjList.includes(newSubjName.trim())) { setSubjList([...subjList, newSubjName.trim()]); setNewSubjName(""); } };
  const handleSave = () => { onSaveClasses(classList); onSaveSubjects(subjList); onClose(); };

  return (
    <Modal title="Manage Classes & Master Subjects" onClose={onClose}>
      <Field label="Add Custom Class">
        <div className="flex gap-2">
          <input className={inputCls} style={inputStyle} value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="Class name" />
          <button onClick={addClass} className="px-3 py-2 bg-[#12312B] text-white text-xs rounded font-semibold whitespace-nowrap">Add Class</button>
        </div>
      </Field>
      <div className="my-3 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 border bg-white rounded">
        {classList.map(c => (
          <span key={c} className="px-2 py-0.5 text-xs bg-[#FAF6EC] border rounded font-medium flex items-center gap-1">
            Class {c}
            <button onClick={() => setClassList(classList.filter(x => x !== c))} className="text-[#A63D2F]"><X size={10} /></button>
          </span>
        ))}
      </div>
      <hr className="my-4" />
      <Field label="Add Master Subject (e.g., Hindi, Computer, Biology)">
        <div className="flex gap-2">
          <input className={inputCls} style={inputStyle} value={newSubjName} onChange={e => setNewSubjName(e.target.value)} placeholder="Subject name" />
          <button onClick={addSubject} className="px-3 py-2 bg-[#12312B] text-white text-xs rounded font-semibold whitespace-nowrap">Add Subject</button>
        </div>
      </Field>
      <div className="my-3 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 border bg-white rounded">
        {subjList.map(s => (
          <span key={s} className="px-2 py-0.5 text-xs bg-[#FAF6EC] border rounded font-medium flex items-center gap-1">
            {s}
            <button onClick={() => setSubjList(subjList.filter(x => x !== s))} className="text-[#A63D2F]"><X size={10} /></button>
          </span>
        ))}
      </div>
      <button onClick={handleSave} className="w-full mt-2 py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>Save All Changes</button>
    </Modal>
  );
}

function ReceiptModal({ deposit, student, totalRemainingDue, onClose }) {
  const receiptRef = useRef();

  const handlePrint = () => {
    const printContent = receiptRef.current.innerHTML;
    const win = window.open("", "", "width=600,height=700");
    win.document.write(`
      <html>
        <head>
          <title>Fee Receipt - Coaching Ledger</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 20px; color: #12312B; }
            .receipt-box { border: 2px solid #12312B; padding: 20px; border-radius: 4px; max-w: 400px; margin: auto; }
            .header { text-align: center; border-bottom: 2px dashed #12312B; padding-bottom: 10px; margin-bottom: 15px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
            .bold { font-weight: bold; }
            .footer { border-top: 1.5px solid #12312B; padding-top: 10px; margin-top: 15px; text-align: center; font-size: 11px; }
          </style>
        </head>
        <body><div class="receipt-box">${printContent}</div></body>
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
          <h2 style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#12312B]">COACHING CLASSES</h2>
          <p className="text-[10px] uppercase tracking-wider text-[#9C8F6E]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Official Payment Receipt</p>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-[#6E6650]">
            <span>Receipt No: <strong className="text-[#12312B]">#{receiptNo}</strong></span>
            <span>Date: <strong className="text-[#12312B]">{deposit.date}</strong></span>
          </div>
          <div className="flex justify-between text-[#6E6650]"><span>Student Name:</span><strong className="text-[#12312B]">{student ? student.name : "N/A"}</strong></div>
          <div className="flex justify-between text-[#6E6650]"><span>Class:</span><strong className="text-[#12312B]">Class {student ? student.class : "N/A"}</strong></div>
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
      <div className="grid grid-cols-2 gap-3">
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
function ExpenseReceiptModal({ expense, onClose }) {
  const receiptRef = useRef();
  const expenseId = expense.expenseId || `EXP-${shortId(expense.id)}`;

  const handlePrint = () => {
    const printContent = receiptRef.current.innerHTML;
    const win = window.open("", "", "width=600,height=700");
    win.document.write(`
      <html>
        <head>
          <title>Expense Receipt - ${expenseId}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 20px; color: #12312B; }
            .receipt-box { border: 2px solid #12312B; padding: 20px; border-radius: 4px; max-w: 400px; margin: auto; }
            .header { text-align: center; border-bottom: 2px dashed #12312B; padding-bottom: 10px; margin-bottom: 15px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
            .bold { font-weight: bold; }
            .footer { border-top: 1.5px solid #12312B; padding-top: 10px; margin-top: 15px; text-align: center; font-size: 11px; }
          </style>
        </head>
        <body><div class="receipt-box">${printContent}</div></body>
      </html>
    `);
    win.document.close(); win.focus(); win.print(); win.close();
  };

  return (
    <Modal title="Expense Receipt" onClose={onClose}>
      <div className="p-4 border bg-white rounded-sm mb-4" ref={receiptRef} style={{ borderColor: "#12312B" }}>
        <div className="text-center pb-3 mb-3 border-b-2 border-dashed border-[#12312B]">
          <h2 style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#12312B]">COACHING CLASSES</h2>
          <p className="text-[10px] uppercase tracking-wider text-[#9C8F6E]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Official Expense Receipt</p>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-[#6E6650]">
            <span>Expense ID: <strong className="text-[#12312B]">{expenseId}</strong></span>
            <span>Date: <strong className="text-[#12312B]">{expense.date}</strong></span>
          </div>
          <div className="flex justify-between text-[#6E6650]"><span>Category:</span><strong className="text-[#12312B]">{expense.category || "—"}</strong></div>
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
function ChargeReceiptModal({ line, student, onClose }) {
  const receiptRef = useRef();
  if (!line) return null;

  const typeLabel = { opening: "Opening Balance (Carried Forward)", monthly_fee: "Tuition Fee", extra_charge: "Additional Charge" }[line.type] || "Charge";

  const handlePrint = () => {
    const printContent = receiptRef.current.innerHTML;
    const win = window.open("", "", "width=600,height=700");
    win.document.write(`
      <html>
        <head>
          <title>Charge Receipt - ${line.chargeId || ""}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 20px; color: #12312B; }
            .receipt-box { border: 2px solid #12312B; padding: 20px; border-radius: 4px; max-w: 400px; margin: auto; }
            .header { text-align: center; border-bottom: 2px dashed #12312B; padding-bottom: 10px; margin-bottom: 15px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
            .bold { font-weight: bold; }
            .footer { border-top: 1.5px solid #12312B; padding-top: 10px; margin-top: 15px; text-align: center; font-size: 11px; }
          </style>
        </head>
        <body><div class="receipt-box">${printContent}</div></body>
      </html>
    `);
    win.document.close(); win.focus(); win.print(); win.close();
  };

  return (
    <Modal title="Charge Receipt" onClose={onClose}>
      <div className="p-4 border bg-white rounded-sm mb-4" ref={receiptRef} style={{ borderColor: "#12312B" }}>
        <div className="text-center pb-3 mb-3 border-b-2 border-dashed border-[#12312B]">
          <h2 style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#12312B]">COACHING CLASSES</h2>
          <p className="text-[10px] uppercase tracking-wider text-[#9C8F6E]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Official Charge Receipt — {typeLabel}</p>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-[#6E6650]">
            <span>Charge ID: <strong className="text-[#12312B]">{line.chargeId}</strong></span>
            <span>Date: <strong className="text-[#12312B]">{line.date}</strong></span>
          </div>
          <div className="flex justify-between text-[#6E6650]"><span>Student Name:</span><strong className="text-[#12312B]">{student ? student.name : "N/A"}</strong></div>
          <div className="flex justify-between text-[#6E6650]"><span>Class:</span><strong className="text-[#12312B]">{student ? `Class ${student.class}` : "N/A"}</strong></div>
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

// ============================================================================
// JOINING FORM — a clean, printable A4 admission form for one student,
// pulling straight from the student record (personal details + full batch
// history). Uses a dedicated print window sized/margined for A4 so only the
// form itself prints, never the rest of the app UI.
// ============================================================================
function JoiningFormModal({ student, onClose }) {
  const formRef = useRef();
  if (!student) return null;

  const history = (student.batchHistory && student.batchHistory.length)
    ? [...student.batchHistory].sort((a, b) => (a.fromMonth < b.fromMonth ? -1 : 1))
    : [{ fromMonth: student.admissionMonth, batches: student.batches || [] }];

  const handlePrint = () => {
    const printContent = formRef.current.innerHTML;
    const win = window.open("", "", "width=850,height=1100");
    win.document.write(`
      <html>
        <head>
          <title>Joining Form - ${student.name}</title>
          <style>
            @page { size: A4; margin: 16mm; }
            * { box-sizing: border-box; }
            body { font-family: 'Inter', Arial, sans-serif; color: #12312B; margin: 0; padding: 0; }
            .form-page { width: 100%; }
            .form-header { text-align: center; border-bottom: 3px double #12312B; padding-bottom: 12px; margin-bottom: 18px; }
            .form-header h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: 0.02em; }
            .form-header p { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #6E6650; margin: 0; }
            .form-section-title { font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #6E6650; border-bottom: 1px solid #26231D; padding-bottom: 4px; margin: 18px 0 10px; }
            .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; }
            .form-field { border-bottom: 1px solid #B8862B; padding: 6px 2px 8px; font-size: 13px; }
            .form-field .lbl { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #9C8F6E; margin-bottom: 3px; }
            .form-field .val { font-weight: 600; min-height: 14px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 4px; }
            th { text-align: left; text-transform: uppercase; font-size: 9px; letter-spacing: 0.06em; color: #6E6650; border-bottom: 1.5px solid #26231D; padding: 6px 8px; }
            td { padding: 6px 8px; border-bottom: 1px solid #EEE7D2; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; }
            .sig-line { border-top: 1px solid #26231D; padding-top: 6px; font-size: 11px; text-align: center; color: #6E6650; }
            .footer { text-align: center; font-size: 9px; color: #9C8F6E; margin-top: 30px; border-top: 1px dashed #B8862B; padding-top: 8px; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body><div class="form-page">${printContent}</div></body>
      </html>
    `);
    win.document.close(); win.focus(); win.print(); win.close();
  };

  return (
    <WideModal title={`Joining Form — ${student.name}`} onClose={onClose}>
      <div className="p-5 border bg-white rounded-sm mb-4" ref={formRef} style={{ borderColor: "#12312B" }}>
        <div className="form-header text-center pb-3 mb-4" style={{ borderBottom: "3px double #12312B" }}>
          <h1 style={{ fontFamily: "'Zilla Slab', serif" }} className="text-2xl font-bold m-0">COACHING CLASSES</h1>
          <p className="text-[11px] uppercase tracking-wider text-[#6E6650] m-0" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Student Joining / Admission Form</p>
        </div>

        <div className="form-section-title text-xs uppercase tracking-wider text-[#6E6650] border-b border-[#26231D] pb-1 mb-2.5 mt-3">Personal Details</div>
        <div className="form-grid grid grid-cols-2 gap-x-6 gap-y-2.5">
          <div className="form-field border-b pb-2 pt-1" style={{ borderColor: "#B8862B" }}><span className="lbl block text-[9px] uppercase tracking-wide text-[#9C8F6E] mb-0.5">Student Name</span><span className="val font-semibold">{student.name}</span></div>
          <div className="form-field border-b pb-2 pt-1" style={{ borderColor: "#B8862B" }}><span className="lbl block text-[9px] uppercase tracking-wide text-[#9C8F6E] mb-0.5">Class</span><span className="val font-semibold">Class {student.class}</span></div>
          <div className="form-field border-b pb-2 pt-1" style={{ borderColor: "#B8862B" }}><span className="lbl block text-[9px] uppercase tracking-wide text-[#9C8F6E] mb-0.5">Date of Birth</span><span className="val font-semibold">{student.dob || "—"}</span></div>
          <div className="form-field border-b pb-2 pt-1" style={{ borderColor: "#B8862B" }}><span className="lbl block text-[9px] uppercase tracking-wide text-[#9C8F6E] mb-0.5">Current School / Institution</span><span className="val font-semibold">{student.currentSchool || "—"}</span></div>
          <div className="form-field border-b pb-2 pt-1" style={{ borderColor: "#B8862B" }}><span className="lbl block text-[9px] uppercase tracking-wide text-[#9C8F6E] mb-0.5">Aadhaar Number</span><span className="val font-semibold">{student.aadharNumber || "—"}</span></div>
          <div className="form-field border-b pb-2 pt-1" style={{ borderColor: "#B8862B" }}><span className="lbl block text-[9px] uppercase tracking-wide text-[#9C8F6E] mb-0.5">Admission Date</span><span className="val font-semibold">{student.admissionMonth ? monthLabel(student.admissionMonth) : "—"}</span></div>
        </div>

        <div className="form-section-title text-xs uppercase tracking-wider text-[#6E6650] border-b border-[#26231D] pb-1 mb-2.5 mt-5">Contact Details</div>
        <div className="form-grid grid grid-cols-2 gap-x-6 gap-y-2.5">
          <div className="form-field border-b pb-2 pt-1" style={{ borderColor: "#B8862B" }}><span className="lbl block text-[9px] uppercase tracking-wide text-[#9C8F6E] mb-0.5">Student Phone</span><span className="val font-semibold">{student.phone || "—"}</span></div>
          <div className="form-field border-b pb-2 pt-1" style={{ borderColor: "#B8862B" }}><span className="lbl block text-[9px] uppercase tracking-wide text-[#9C8F6E] mb-0.5">Father's Name</span><span className="val font-semibold">{student.fatherName || "—"}</span></div>
          <div className="form-field border-b pb-2 pt-1" style={{ borderColor: "#B8862B" }}><span className="lbl block text-[9px] uppercase tracking-wide text-[#9C8F6E] mb-0.5">Guardian Phone</span><span className="val font-semibold">{student.guardianPhone || "—"}</span></div>
          <div className="form-field border-b pb-2 pt-1" style={{ borderColor: "#B8862B" }}><span className="lbl block text-[9px] uppercase tracking-wide text-[#9C8F6E] mb-0.5">Address</span><span className="val font-semibold">{student.address || "—"}</span></div>
        </div>

        <div className="form-section-title text-xs uppercase tracking-wider text-[#6E6650] border-b border-[#26231D] pb-1 mb-2.5 mt-5">Batch History</div>
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left uppercase text-[9px] tracking-wide text-[#6E6650] py-1.5 border-b" style={{ borderColor: "#26231D" }}>Effective From</th>
              <th className="text-left uppercase text-[9px] tracking-wide text-[#6E6650] py-1.5 border-b" style={{ borderColor: "#26231D" }}>Subjects / Batches</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h, i) => (
              <tr key={i}>
                <td className="py-1.5 border-b" style={{ borderColor: "#EEE7D2" }}>{monthLabel(h.fromMonth)}</td>
                <td className="py-1.5 border-b" style={{ borderColor: "#EEE7D2" }}>{(h.batches || []).join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="signatures grid grid-cols-2 gap-10 mt-14">
          <div className="sig-line border-t pt-1.5 text-center text-xs text-[#6E6650]" style={{ borderColor: "#26231D" }}>Parent / Guardian Signature</div>
          <div className="sig-line border-t pt-1.5 text-center text-xs text-[#6E6650]" style={{ borderColor: "#26231D" }}>Authorized Signature (Center)</div>
        </div>

        <div className="footer text-center text-[9px] text-[#9C8F6E] mt-6 pt-2 border-t border-dashed" style={{ borderColor: "#B8862B" }}>
          Computer Generated Joining Form · Generated {todayStr()}
        </div>
      </div>
      <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]"><Printer size={15} /> Print Form (A4)</button>
    </WideModal>
  );
}
