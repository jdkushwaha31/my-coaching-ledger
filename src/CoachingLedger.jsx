import React, { useState, useEffect, useMemo, useRef } from "react";
import { db } from "./firebase";
import { 
  collection, onSnapshot, doc, setDoc, deleteDoc 
} from "firebase/firestore";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid 
} from "recharts";
import { 
  LayoutGrid, Users, Wallet, Receipt, AlertCircle, Plus, Trash2, X, Check, Lock, LogOut, BookOpen, Send, Printer
} from "lucide-react";

// Admin Access Password
const APP_PASSWORD = "958906"; 

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');`;

const DEFAULT_CLASSES = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const BATCHES = ["Mathematics", "Physics", "Chemistry", "Science", "Normal", "Special Coaching"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function monthLabel(key) { 
  if (!key) return "—";
  const [y, m] = key.split("-").map(Number); 
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
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

const defaultFeeStructure = (classes) => {
  const fs = {};
  classes.forEach((c, i) => {
    fs[c] = { 1: 500 + i * 50, 2: 900 + i * 100, 3: 1300 + i * 150 };
  });
  return fs;
};

function sendWhatsAppReceipt(deposit, student) {
  if (!student || !student.phone) {
    alert("No phone number registered for this student.");
    return;
  }
  const cleanPhone = student.phone.replace(/[^0-9]/g, "");
  const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  
  const receiptNo = deposit.id ? deposit.id.slice(0, 8).toUpperCase() : "REC-" + Date.now().toString().slice(-4);
  const msg = `*FEE PAYMENT RECEIPT*\n----------------------------------------\n*Receipt No:* #${receiptNo}\n*Date:* ${deposit.date}\n*Student Name:* ${student.name}\n*Class:* ${student.class}\n*For Month:* ${monthLabel(deposit.month)}\n*Batches:* ${(deposit.batches || []).join(", ") || "General"}\n*Payment Mode:* ${deposit.mode || "Cash"}\n----------------------------------------\n*Amount Paid:* ₹${deposit.amount}\n*Status:* PAID ✅\n----------------------------------------\nThank you for the payment!`;
  
  window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`, "_blank");
}

function Stamp({ text, tone }) {
  const colors = {
    paid: { bg: "#EAF1EA", border: "#3F6B52", text: "#2E5240" },
    due: { bg: "#FBEFE3", border: "#B8862B", text: "#8A6420" },
    overdue: { bg: "#F7E7E3", border: "#A63D2F", text: "#8A3226" },
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
  const [feeStructure, setFeeStructure] = useState({});
  const [deposits, setDeposits] = useState([]);
  
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [receiptData, setReceiptData] = useState(null);

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

  // Real-time Cloud Sync
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubStudents = onSnapshot(collection(db, "students"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, status: "active", ...doc.data() }));
      setStudents(data);
      setLoaded(true);
    });

    const unsubDeposits = onSnapshot(collection(db, "deposits"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDeposits(data);
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

    return () => {
      unsubStudents();
      unsubDeposits();
      unsubFee();
      unsubClasses();
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#12312B", fontFamily: "'Inter', sans-serif" }}>
        <style>{FONT_IMPORT}</style>
        <div className="bg-[#FAF6EC] p-8 rounded-sm shadow-2xl max-w-md w-full border-2" style={{ borderColor: "#B8862B" }}>
          <div className="flex justify-center mb-3 text-[#12312B]"><Lock size={32} /></div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-2xl font-bold text-[#12312B] text-center">Batch Ledger</div>
          <p className="text-xs text-[#9C8F6E] text-center uppercase tracking-wider mb-6" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Admin Authentication</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#6E6650] mb-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Enter Passcode</label>
              <input
                type="password"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                placeholder="••••••••"
                className="w-full border rounded-sm px-3 py-2 text-sm bg-white focus:outline-none"
                style={{ borderColor: passError ? "#A63D2F" : "#D8CFB8" }}
                autoFocus
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
  const studentById = Object.fromEntries(students.map(s => [s.id, s]));

  function expectedFeeFor(cls, batchCount) {
    const bc = Math.max(1, Math.min(3, batchCount || 1));
    return (feeStructure[cls] && feeStructure[cls][bc]) || 0;
  }

  function batchesForMonth(student, month) {
    const dep = deposits.filter(d => d.studentId === student.id && d.month === month).slice(-1)[0];
    if (dep && dep.batches && dep.batches.length) return dep.batches;
    return student.batches || [];
  }

  const duesLedger = [];
  students.forEach(st => {
    if (!st.admissionMonth) return;
    
    let lastActiveMonth = curMonth;
    if (st.status !== "active" && st.exitDate) {
      lastActiveMonth = monthKey(new Date(st.exitDate));
    }

    const endMonthToCalc = lastActiveMonth < curMonth ? lastActiveMonth : curMonth;
    if (st.admissionMonth > endMonthToCalc) return;

    const months = monthsBetween(st.admissionMonth, endMonthToCalc);
    months.forEach(m => {
      const batches = batchesForMonth(st, m);
      const bc = batches.length || 1;
      const expected = expectedFeeFor(st.class, bc);
      const paid = deposits.filter(d => d.studentId === st.id && d.month === m).reduce((a, d) => a + Number(d.amount || 0), 0);
      const outstanding = Math.max(0, expected - paid);
      duesLedger.push({ 
        studentId: st.id, name: st.name, cls: st.class, phone: st.phone, 
        month: m, batches, expected, paid, outstanding, 
        isCurrent: m === curMonth, status: st.status || "active" 
      });
    });
  });

  const studentDuesMap = {};
  duesLedger.forEach(row => {
    studentDuesMap[row.studentId] = (studentDuesMap[row.studentId] || 0) + row.outstanding;
  });

  const activeStudents = students.filter(s => (s.status || "active") === "active");
  const outstandingRows = duesLedger.filter(r => r.outstanding > 0).sort((a, b) => a.month < b.month ? -1 : 1);
  const totalOutstanding = outstandingRows.reduce((a, r) => a + r.outstanding, 0);

  const thisMonthCollected = deposits.filter(d => d.month === curMonth).reduce((a, d) => a + Number(d.amount || 0), 0);
  const thisMonthExpected = duesLedger.filter(r => r.month === curMonth && r.status === "active").reduce((a, r) => a + r.expected, 0);

  const start = addMonths(curMonth, -5);
  const trendMonths = monthsBetween(start, curMonth);
  const trend = trendMonths.map(m => ({
    month: monthLabel(m).split(" ")[0],
    collected: deposits.filter(d => d.month === m).reduce((a, d) => a + Number(d.amount || 0), 0),
  }));

  const batchStrength = Object.fromEntries(BATCHES.map(b => [b, 0]));
  activeStudents.forEach(s => (s.batches || []).forEach(b => { if (batchStrength[b] !== undefined) batchStrength[b]++; }));

  const classStrength = Object.fromEntries(classes.map(c => [c, 0]));
  activeStudents.forEach(s => { if (classStrength[s.class] !== undefined) classStrength[s.class]++; });

  const recentDeposits = [...deposits].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 8);

  // Actions
  async function saveStudent(data) {
    const id = data.id || uid();
    await setDoc(doc(db, "students", id), { ...data, id });
    setShowStudentForm(false);
    setEditingStudent(null);
  }

  async function updateStudentStatus(id, newStatus, exitDate = null) {
    const st = students.find(s => s.id === id);
    if (st) {
      const updated = { 
        ...st, 
        status: newStatus, 
        exitDate: newStatus !== "active" ? (exitDate || new Date().toISOString().slice(0, 10)) : null 
      };
      await setDoc(doc(db, "students", id), updated);
    }
  }

  async function removeStudent(id) {
    if (window.confirm("Are you sure you want to remove this student permanently?")) {
      await deleteDoc(doc(db, "students", id));
    }
  }

  async function saveFeeStructure(updatedMatrix) {
    setFeeStructure(updatedMatrix);
    await setDoc(doc(db, "settings", "feeStructure"), { matrix: updatedMatrix });
  }

  async function saveClasses(updatedList) {
    setClasses(updatedList);
    await setDoc(doc(db, "settings", "classList"), { list: updatedList });
  }

  async function saveDeposit(data) {
    const id = uid();
    const newDep = { ...data, id };
    await setDoc(doc(db, "deposits", id), newDep);
    setShowDepositForm(false);
    
    // Auto trigger receipt view for instant print or WhatsApp
    const st = studentById[data.studentId];
    setReceiptData({ deposit: newDep, student: st });
  }

  async function removeDeposit(id) {
    await deleteDoc(doc(db, "deposits", id));
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { id: "class_hub", label: "Class & Dues Hub", icon: BookOpen },
    { id: "students", label: "Students Register", icon: Users },
    { id: "structure", label: "Fee Matrix", icon: Wallet },
    { id: "deposits", label: "Deposits Log", icon: Receipt },
    { id: "dues", label: "Pending Dues", icon: AlertCircle },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: "#FAF6EC", fontFamily: "'Inter', sans-serif", color: "#26231D" }}>
      <style>{`${FONT_IMPORT}
        .ledger-row:nth-child(even) { background: #F5F0E1; }
        input, select { font-family: 'Inter', sans-serif; }
        ::selection { background: #B8862B33; }
      `}</style>

      {/* Sidebar */}
      <aside className="w-56 shrink-0 flex flex-col justify-between" style={{ background: "#12312B" }}>
        <div>
          <div className="px-5 pt-6 pb-5" style={{ borderBottom: "1px solid #24473F" }}>
            <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#F4EFDE] leading-tight">Batch<br/>Ledger</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#8FAE9F" }} className="mt-1 uppercase tracking-wider">Coaching Register</div>
          </div>
          <nav className="px-3 py-4 space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-sm text-sm transition-colors"
                  style={{
                    background: active ? "#F4EFDE" : "transparent",
                    color: active ? "#12312B" : "#C9D9CF",
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div style={{ borderTop: "1px solid #24473F" }}>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-5 py-3 text-xs font-medium text-[#8FAE9F] hover:text-[#F4EFDE] transition-colors"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            <LogOut size={14} /> Lock Portal
          </button>
          <div className="px-5 pb-4 text-[10px]" style={{ color: "#6E9384", fontFamily: "'IBM Plex Mono', monospace" }}>
            {monthLabel(curMonth)} · <span style={{ color: "#8FAE9F" }}>live cloud sync</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 px-8 py-7 max-w-6xl">
        {tab === "dashboard" && (
          <DashboardTab
            students={activeStudents} thisMonthCollected={thisMonthCollected} thisMonthExpected={thisMonthExpected}
            totalOutstanding={totalOutstanding} trend={trend} batchStrength={batchStrength} classStrength={classStrength}
            recentDeposits={recentDeposits} studentById={studentById} curMonth={curMonth} classes={classes}
            onOpenReceipt={(dep) => setReceiptData({ deposit: dep, student: studentById[dep.studentId] })}
          />
        )}
        {tab === "class_hub" && (
          <ClassAndDuesHubTab 
            students={students} 
            classes={classes} 
            studentDues={studentDuesMap} 
            outstandingRows={outstandingRows}
            onManageClasses={() => setShowClassModal(true)}
            onEditStudent={(s) => { setEditingStudent(s); setShowStudentForm(true); }}
            onStatusChange={updateStudentStatus}
          />
        )}
        {tab === "students" && (
          <StudentsTab
            students={students}
            studentDues={studentDuesMap}
            classes={classes}
            onAdd={() => { setEditingStudent(null); setShowStudentForm(true); }}
            onEdit={(s) => { setEditingStudent(s); setShowStudentForm(true); }}
            onStatusChange={updateStudentStatus}
            onRemove={removeStudent}
          />
        )}
        {tab === "structure" && (
          <StructureTab feeStructure={feeStructure} setFeeStructure={saveFeeStructure} classes={classes} />
        )}
        {tab === "deposits" && (
          <DepositsTab 
            deposits={deposits} 
            students={students} 
            onAdd={() => setShowDepositForm(true)} 
            onRemove={removeDeposit} 
            onOpenReceipt={(dep) => setReceiptData({ deposit: dep, student: studentById[dep.studentId] })}
          />
        )}
        {tab === "dues" && (
          <DuesTab rows={outstandingRows} totalOutstanding={totalOutstanding} />
        )}
      </main>

      {showStudentForm && (
        <StudentFormModal
          classes={classes}
          initial={editingStudent}
          onClose={() => { setShowStudentForm(false); setEditingStudent(null); }}
          onSave={saveStudent}
        />
      )}
      {showDepositForm && (
        <DepositFormModal
          students={students}
          curMonth={curMonth}
          expectedFeeFor={expectedFeeFor}
          onClose={() => setShowDepositForm(false)}
          onSave={saveDeposit}
        />
      )}
      {showClassModal && (
        <ClassManagerModal 
          classes={classes} 
          onClose={() => setShowClassModal(false)} 
          onSave={saveClasses} 
        />
      )}
      {receiptData && (
        <ReceiptModal 
          deposit={receiptData.deposit} 
          student={receiptData.student} 
          onClose={() => setReceiptData(null)} 
        />
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

function DashboardTab({ students, thisMonthCollected, thisMonthExpected, totalOutstanding, trend, batchStrength, classStrength, recentDeposits, studentById, curMonth, classes, onOpenReceipt }) {
  const collectionRate = thisMonthExpected > 0 ? Math.round((thisMonthCollected / thisMonthExpected) * 100) : 0;
  return (
    <div>
      <SectionHeader eyebrow={monthLabel(curMonth)} title="Summary" />
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Students" value={students.length} sub={`${classes.filter(c => students.some(s => s.class === c)).length} active classes`} />
        <StatCard label="Collected this month" value={fmtINR(thisMonthCollected)} sub={`of ${fmtINR(thisMonthExpected)} expected`} tone="good" />
        <StatCard label="Collection rate" value={`${collectionRate}%`} tone={collectionRate >= 80 ? "good" : collectionRate >= 50 ? "warn" : "bad"} />
        <StatCard label="Outstanding dues" value={fmtINR(totalOutstanding)} sub="all months, all students" tone={totalOutstanding > 0 ? "bad" : "good"} />
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

      <div className="grid grid-cols-3 gap-5">
        <Card className="p-5">
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold mb-3">Batch Enrollment</div>
          <div className="space-y-2">
            {BATCHES.map(b => (
              <div key={b} className="flex items-center justify-between text-sm">
                <span className="text-[#4A4636]">{b}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-[#1B1810] font-medium">{batchStrength[b]}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="col-span-2 p-5">
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold mb-3">Recent Deposits</div>
          {recentDeposits.length === 0 ? (
            <div className="text-sm text-[#9C8F6E]">No deposits recorded yet.</div>
          ) : (
            <div className="space-y-0">
              {recentDeposits.map(d => {
                const st = studentById[d.studentId];
                return (
                  <div key={d.id} className="flex items-center justify-between py-2 text-sm ledger-row px-2 -mx-2" style={{ borderBottom: "1px solid #EEE7D2" }}>
                    <div>
                      <span className="font-medium">{st ? st.name : "Unknown"}</span>
                      <span className="text-[#9C8F6E] ml-2 text-xs">Class {st ? st.class : "—"} · {monthLabel(d.month)}</span>
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

function ClassAndDuesHubTab({ students, classes, studentDues, outstandingRows, onManageClasses, onEditStudent, onStatusChange }) {
  const [selectedClass, setSelectedClass] = useState("ALL");
  const [viewMode, setViewMode] = useState("class");

  const filteredStudents = useMemo(() => {
    if (selectedClass === "ALL") return students;
    return students.filter(s => s.class === selectedClass);
  }, [students, selectedClass]);

  const sendWhatsAppReminder = (phone, name, month, amount) => {
    if (!phone) {
      alert("No phone number recorded for this student.");
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = `Dear Parent, this is a gentle reminder regarding ${name}'s tuition fee for ${monthLabel(month)}. Pending Due: ₹${amount}. Please clear it at your earliest convenience. Thank you!`;
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div>
      <SectionHeader 
        eyebrow="Dedicated Analytics" 
        title="Class & Dues Hub" 
        action={
          <button onClick={onManageClasses} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-sm" style={{ background: "white", borderColor: "#26231D" }}>
            <Plus size={14} /> Manage Classes
          </button>
        }
      />

      <div className="flex items-center justify-between mb-5 gap-4">
        <div className="flex border rounded-sm overflow-hidden" style={{ borderColor: "#12312B" }}>
          <button 
            onClick={() => setViewMode("class")}
            className="px-4 py-2 text-xs font-semibold"
            style={{ background: viewMode === "class" ? "#12312B" : "white", color: viewMode === "class" ? "#F4EFDE" : "#12312B" }}
          >
            Class-Wise Directory
          </button>
          <button 
            onClick={() => setViewMode("dues")}
            className="px-4 py-2 text-xs font-semibold"
            style={{ background: viewMode === "dues" ? "#12312B" : "white", color: viewMode === "dues" ? "#F4EFDE" : "#12312B" }}
          >
            Dues-Wise List ({outstandingRows.length})
          </button>
        </div>

        {viewMode === "class" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#6E6650]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Filter Class:</span>
            <select 
              value={selectedClass} 
              onChange={e => setSelectedClass(e.target.value)}
              className="border rounded-sm px-3 py-1.5 text-xs bg-white"
              style={{ borderColor: "#D8CFB8" }}
            >
              <option value="ALL">All Classes ({students.length})</option>
              {classes.map(c => (
                <option key={c} value={c}>Class {c}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {viewMode === "class" ? (
        <Card>
          {filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#9C8F6E]">No students found for class "{selectedClass}".</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                  {["Name", "Class", "Batches", "Admitted", "Status / Exit Date", "Total Due", "Actions"].map(h => (
                    <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(s => {
                  const due = studentDues[s.id] || 0;
                  const isPassOut = s.status !== "active";
                  return (
                    <tr key={s.id} className="ledger-row">
                      <td className="px-4 py-2.5 font-medium">
                        {s.name}
                        {s.phone && <div className="text-[10px] text-[#9C8F6E]">{s.phone}</div>}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-[#12312B]">{s.class}</td>
                      <td className="px-4 py-2.5 text-xs text-[#6E6650]">{(s.batches || []).join(", ") || "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-[#6E6650]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{monthLabel(s.admissionMonth)}</td>
                      <td className="px-4 py-2.5 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Stamp text={s.status} tone={s.status === "active" ? "paid" : s.status === "passed_out" ? "due" : "overdue"} />
                          {isPassOut && s.exitDate && (
                            <span className="text-[10px] text-[#A63D2F]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                              (Exit: {s.exitDate})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-semibold" style={{ fontFamily: "'IBM Plex Mono', monospace", color: due > 0 ? "#A63D2F" : "#3F6B52" }}>
                        {fmtINR(due)}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        <button onClick={() => onEditStudent(s)} className="text-[#12312B] underline mr-2">Edit Details</button>
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
                  {["Student", "Class", "Month", "Expected", "Paid", "Pending Balance", "WhatsApp Reminder"].map(h => (
                    <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {outstandingRows.map((r, i) => (
                  <tr key={i} className="ledger-row">
                    <td className="px-4 py-2.5 font-medium">{r.name}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#12312B]">{r.cls}</td>
                    <td className="px-4 py-2.5 text-xs font-medium" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{monthLabel(r.month)}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(r.expected)}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(r.paid)}</td>
                    <td className="px-4 py-2.5 font-bold text-[#A63D2F]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(r.outstanding)}</td>
                    <td className="px-4 py-2.5">
                      <button 
                        onClick={() => sendWhatsAppReminder(r.phone, r.name, r.month, r.outstanding)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold text-white bg-[#25D366] hover:bg-[#1DA851] transition-colors"
                      >
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

function StudentsTab({ students, studentDues, classes, onAdd, onEdit, onStatusChange, onRemove }) {
  return (
    <div>
      <SectionHeader eyebrow="Register" title="Students Directory" action={
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Add student
        </button>
      } />
      <Card>
        {students.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">No students registered yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Name", "Class", "Batches", "Phone", "Admitted", "Due Fees", "Status & Exit Date", ""].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map(s => {
                const dueAmount = studentDues[s.id] || 0;
                const status = s.status || "active";
                return (
                  <tr key={s.id} className="ledger-row">
                    <td className="px-4 py-2.5 font-medium">{s.name}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#12312B]">{s.class}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6E6650]">{(s.batches || []).join(", ") || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6E6650]">{s.phone || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6E6650]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{s.admissionMonth ? monthLabel(s.admissionMonth) : "—"}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold" style={{ fontFamily: "'IBM Plex Mono', monospace", color: dueAmount > 0 ? "#A63D2F" : "#3F6B52" }}>
                      {fmtINR(dueAmount)}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <div className="flex flex-col gap-1">
                        <select 
                          value={status} 
                          onChange={(e) => onStatusChange(s.id, e.target.value, s.exitDate)}
                          className="text-xs border rounded px-1 py-0.5"
                          style={{
                            borderColor: status === "active" ? "#3F6B52" : status === "passed_out" ? "#B8862B" : "#A63D2F",
                            color: status === "active" ? "#2E5240" : status === "passed_out" ? "#8A6420" : "#8A3226",
                            background: status === "active" ? "#EAF1EA" : status === "passed_out" ? "#FBEFE3" : "#F7E7E3"
                          }}
                        >
                          <option value="active">Active</option>
                          <option value="passed_out">Passed Out</option>
                          <option value="dropped_out">Dropped Out</option>
                        </select>
                        {status !== "active" && (
                          <span className="text-[10px] text-[#8A3226]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                            Exit: {s.exitDate || "Not recorded"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onEdit(s)} className="text-xs text-[#12312B] underline mr-3">Edit</button>
                      <button onClick={() => onRemove(s.id)} className="text-xs text-[#A63D2F] underline">Remove</button>
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

function StructureTab({ feeStructure, setFeeStructure, classes }) {
  function update(cls, count, val) {
    const updated = { ...feeStructure, [cls]: { ...feeStructure[cls], [count]: Number(val) || 0 } };
    setFeeStructure(updated);
  }
  return (
    <div>
      <SectionHeader eyebrow="Package Pricing" title="Fee Structure Matrix" />
      <div className="text-sm text-[#6E6650] mb-4">Set monthly tuition fee according to class and number of batches taken. Saves directly to cloud.</div>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1.5px solid #26231D" }}>
              <th style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">Class Name</th>
              <th style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">1 Batch Fee / Month</th>
              <th style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">2 Batches Fee / Month</th>
              <th style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">3 Batches Fee / Month</th>
            </tr>
          </thead>
          <tbody>
            {classes.map(c => (
              <tr key={c} className="ledger-row">
                <td className="px-4 py-2.5 font-semibold text-[#12312B]">Class {c}</td>
                {[1, 2, 3].map(count => (
                  <td key={count} className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <span className="text-[#9C8F6E]">₹</span>
                      <input
                        type="number"
                        value={feeStructure[c] ? feeStructure[c][count] : 0}
                        onChange={(e) => update(c, count, e.target.value)}
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                        className="w-24 border rounded-sm px-2 py-1 text-sm bg-white"
                      />
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

function DepositsTab({ deposits, students, onAdd, onRemove, onOpenReceipt }) {
  const sorted = [...deposits].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const byId = Object.fromEntries(students.map(s => [s.id, s]));
  return (
    <div>
      <SectionHeader eyebrow="Fee Deposits" title="Deposits Log" action={
        <button onClick={onAdd} disabled={students.length === 0} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Record deposit
        </button>
      } />
      <Card>
        {sorted.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">No fee deposits recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Date", "Student", "Class", "For Month", "Batches", "Mode", "Amount", "Receipt / Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(d => {
                const st = byId[d.studentId];
                return (
                  <tr key={d.id} className="ledger-row">
                    <td className="px-4 py-2.5 text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{d.date}</td>
                    <td className="px-4 py-2.5 font-medium">{st ? st.name : "—"}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#12312B]">{st ? st.class : "—"}</td>
                    <td className="px-4 py-2.5 text-xs">{monthLabel(d.month)}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6E6650]">{(d.batches || []).join(", ")}</td>
                    <td className="px-4 py-2.5 text-xs">{d.mode}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#3F6B52]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(d.amount)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onOpenReceipt(d)} className="flex items-center gap-1 text-xs text-[#12312B] underline mr-3 inline-flex">
                        <Printer size={12} /> Receipt
                      </button>
                      <button onClick={() => sendWhatsAppReceipt(d, st)} className="text-xs text-[#25D366] font-semibold underline mr-3 inline-flex items-center gap-1">
                        <Send size={11} /> WhatsApp
                      </button>
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

function DuesTab({ rows, totalOutstanding }) {
  return (
    <div>
      <SectionHeader eyebrow="Outstanding Dues" title="Pending Dues Ledger" />
      <Card className="p-5 mb-5 flex items-center justify-between" style={{ borderLeft: "4px solid #A63D2F" }}>
        <div>
          <div className="text-sm text-[#6E6650]">Total outstanding across all active students</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-3xl font-bold text-[#A63D2F]">{fmtINR(totalOutstanding)}</div>
        </div>
        <Stamp text={rows.length ? `${rows.length} months pending` : "all clear"} tone={rows.length ? "overdue" : "paid"} />
      </Card>
      <Card>
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">No pending dues. Every account is settled.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Student", "Class", "Month", "Batches", "Expected", "Paid", "Outstanding", "Status"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="ledger-row">
                  <td className="px-4 py-2.5 font-medium">{r.name}</td>
                  <td className="px-4 py-2.5 font-semibold text-[#12312B]">{r.cls}</td>
                  <td className="px-4 py-2.5 text-xs">{monthLabel(r.month)}</td>
                  <td className="px-4 py-2.5 text-xs text-[#6E6650]">{r.batches.join(", ") || "—"}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(r.expected)}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(r.paid)}</td>
                  <td className="px-4 py-2.5 font-semibold text-[#A63D2F]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(r.outstanding)}</td>
                  <td className="px-4 py-2.5"><Stamp text={r.isCurrent ? "due" : "overdue"} tone={r.isCurrent ? "due" : "overdue"} /></td>
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

function StudentFormModal({ classes, initial, onClose, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [cls, setCls] = useState(initial?.class || classes[0] || "10");
  const [batches, setBatches] = useState(initial?.batches || []);
  const [phone, setPhone] = useState(initial?.phone || "");
  const [admissionMonth, setAdmissionMonth] = useState(initial?.admissionMonth || currentMonthKey());
  const [status, setStatus] = useState(initial?.status || "active");
  const [exitDate, setExitDate] = useState(initial?.exitDate || new Date().toISOString().slice(0, 10));

  function toggleBatch(b) {
    setBatches(prev => {
      if (prev.includes(b)) return prev.filter(x => x !== b);
      if (prev.length >= 3) return prev;
      return [...prev, b];
    });
  }

  function submit() {
    if (!name.trim()) return;
    onSave({ 
      id: initial?.id, 
      name: name.trim(), 
      class: cls, 
      batches, 
      phone: phone.trim(), 
      admissionMonth, 
      status,
      exitDate: status !== "active" ? exitDate : null
    });
  }

  return (
    <Modal title={initial ? "Edit Student Details" : "Add New Student"} onClose={onClose}>
      <Field label="Full Name">
        <input className={inputCls} style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rahul Sharma" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Class">
          <select className={inputCls} style={inputStyle} value={cls} onChange={e => setCls(e.target.value)}>
            {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
          </select>
        </Field>
        <Field label="Admission Month">
          <input type="month" className={inputCls} style={inputStyle} value={admissionMonth} onChange={e => setAdmissionMonth(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone / WhatsApp Number">
          <input className={inputCls} style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit phone number" />
        </Field>
        <Field label="Status">
          <select className={inputCls} style={inputStyle} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="passed_out">Passed Out</option>
            <option value="dropped_out">Dropped Out</option>
          </select>
        </Field>
      </div>

      {status !== "active" && (
        <Field label="Exit / Pass-out Date">
          <input type="date" className={inputCls} style={inputStyle} value={exitDate} onChange={e => setExitDate(e.target.value)} />
          <p className="text-[10px] text-[#A63D2F] mt-1">
            Setting exit date ensures monthly fee calculation stops after this date.
          </p>
        </Field>
      )}

      <Field label={`Batches (Choose up to 3, Selected: ${batches.length})`}>
        <div className="flex flex-wrap gap-2">
          {BATCHES.map(b => {
            const active = batches.includes(b);
            return (
              <button key={b} type="button" onClick={() => toggleBatch(b)}
                className="px-3 py-1.5 text-xs rounded-sm border flex items-center gap-1"
                style={{ background: active ? "#12312B" : "white", color: active ? "#F4EFDE" : "#4A4636", borderColor: active ? "#12312B" : "#D8CFB8" }}>
                {active && <Check size={12} />}{b}
              </button>
            );
          })}
        </div>
      </Field>
      <button onClick={submit} className="w-full mt-3 py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
        {initial ? "Save Changes" : "Register Student"}
      </button>
    </Modal>
  );
}

function DepositFormModal({ students, curMonth, expectedFeeFor, onClose, onSave }) {
  const [studentId, setStudentId] = useState(students[0]?.id || "");
  const student = students.find(s => s.id === studentId);
  const [month, setMonth] = useState(curMonth);
  const [batches, setBatches] = useState(student?.batches || []);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState("Cash");

  useEffect(() => {
    const s = students.find(x => x.id === studentId);
    setBatches(s?.batches || []);
  }, [studentId]);

  function toggleBatch(b) {
    setBatches(prev => {
      if (prev.includes(b)) return prev.filter(x => x !== b);
      if (prev.length >= 3) return prev;
      return [...prev, b];
    });
  }

  const suggested = student ? expectedFeeFor(student.class, batches.length || 1) : 0;

  function submit() {
    if (!studentId || !amount) return;
    onSave({ studentId, month, batches, amount: Number(amount), date, mode });
  }

  return (
    <Modal title="Record Fee Deposit" onClose={onClose}>
      <Field label="Select Student">
        <select className={inputCls} style={inputStyle} value={studentId} onChange={e => setStudentId(e.target.value)}>
          {students.map(s => <option key={s.id} value={s.id}>{s.name} — Class {s.class} ({s.status || "active"})</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="For Month">
          <input type="month" className={inputCls} style={inputStyle} value={month} onChange={e => setMonth(e.target.value)} />
        </Field>
        <Field label="Deposit Date">
          <input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
        </Field>
      </div>
      <Field label={`Batches Attended (${batches.length}/3)`}>
        <div className="flex flex-wrap gap-2">
          {BATCHES.map(b => {
            const active = batches.includes(b);
            return (
              <button key={b} type="button" onClick={() => toggleBatch(b)}
                className="px-3 py-1.5 text-xs rounded-sm border flex items-center gap-1"
                style={{ background: active ? "#12312B" : "white", color: active ? "#F4EFDE" : "#4A4636", borderColor: active ? "#12312B" : "#D8CFB8" }}>
                {active && <Check size={12} />}{b}
              </button>
            );
          })}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Amount (Suggested ₹${suggested})`}>
          <input type="number" className={inputCls} style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder={String(suggested)} />
        </Field>
        <Field label="Payment Mode">
          <select className={inputCls} style={inputStyle} value={mode} onChange={e => setMode(e.target.value)}>
            <option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Cheque</option>
          </select>
        </Field>
      </div>
      <button onClick={submit} disabled={!studentId || !amount} className="w-full mt-3 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Record Deposit & Generate Receipt
      </button>
    </Modal>
  );
}

function ClassManagerModal({ classes, onClose, onSave }) {
  const [classList, setClassList] = useState([...classes]);
  const [newClassName, setNewClassName] = useState("");

  const addClass = () => {
    const trimmed = newClassName.trim();
    if (trimmed && !classList.includes(trimmed)) {
      const updated = [...classList, trimmed];
      setClassList(updated);
      setNewClassName("");
    }
  };

  const removeClass = (c) => {
    setClassList(classList.filter(x => x !== c));
  };

  const handleSave = () => {
    onSave(classList);
    onClose();
  };

  return (
    <Modal title="Manage Custom Classes" onClose={onClose}>
      <Field label="Add Custom Class (e.g., Nursery, LKG, 1, 2, Special Batch)">
        <div className="flex gap-2">
          <input 
            className={inputCls} 
            style={inputStyle} 
            value={newClassName} 
            onChange={e => setNewClassName(e.target.value)} 
            placeholder="Class name" 
          />
          <button onClick={addClass} className="px-4 py-2 bg-[#12312B] text-white text-xs rounded-sm font-semibold whitespace-nowrap">
            Add
          </button>
        </div>
      </Field>

      <div className="my-4">
        <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="block uppercase text-[#9C8F6E] mb-2">
          Active Classes List ({classList.length})
        </label>
        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border bg-white rounded-sm" style={{ borderColor: "#D8CFB8" }}>
          {classList.map(c => (
            <span key={c} className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-[#FAF6EC] border border-[#B8862B] rounded-sm font-medium">
              Class {c}
              <button onClick={() => removeClass(c)} className="text-[#A63D2F] hover:text-red-700 ml-1">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      </div>

      <button onClick={handleSave} className="w-full mt-2 py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Save Class Hierarchy
      </button>
    </Modal>
  );
}

function ReceiptModal({ deposit, student, onClose }) {
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
        <body>
          <div class="receipt-box">${printContent}</div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const receiptNo = deposit.id ? deposit.id.slice(0, 8).toUpperCase() : "REC-" + Date.now().toString().slice(-4);

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
          <div className="flex justify-between text-[#6E6650]">
            <span>Student Name:</span>
            <strong className="text-[#12312B]">{student ? student.name : "N/A"}</strong>
          </div>
          <div className="flex justify-between text-[#6E6650]">
            <span>Class:</span>
            <strong className="text-[#12312B]">Class {student ? student.class : "N/A"}</strong>
          </div>
          <div className="flex justify-between text-[#6E6650]">
            <span>Fee Month:</span>
            <strong className="text-[#12312B]">{monthLabel(deposit.month)}</strong>
          </div>
          <div className="flex justify-between text-[#6E6650]">
            <span>Batches:</span>
            <strong className="text-[#12312B]">{(deposit.batches || []).join(", ") || "General"}</strong>
          </div>
          <div className="flex justify-between text-[#6E6650]">
            <span>Payment Mode:</span>
            <strong className="text-[#12312B]">{deposit.mode || "Cash"}</strong>
          </div>

          <div className="pt-3 mt-3 border-t-2 border-[#12312B] flex justify-between items-center text-sm">
            <span className="font-bold">Total Paid:</span>
            <span className="font-bold text-[#3F6B52] text-lg" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(deposit.amount)}</span>
          </div>
        </div>

        <div className="text-center pt-3 mt-3 border-t border-dashed border-[#12312B] text-[10px] text-[#9C8F6E]">
          Status: PAID ✅ · Computer Generated Receipt
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button 
          onClick={handlePrint} 
          className="flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]"
        >
          <Printer size={15} /> Print Receipt
        </button>
        <button 
          onClick={() => sendWhatsAppReceipt(deposit, student)} 
          className="flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#25D366] hover:bg-[#1DA851]"
        >
          <Send size={15} /> Send to WhatsApp
        </button>
      </div>
    </Modal>
  );
}
