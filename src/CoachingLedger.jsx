import React, { useState, useEffect, useMemo } from "react";
import { db } from "./firebase";
import { 
  collection, onSnapshot, doc, setDoc, deleteDoc 
} from "firebase/firestore";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid 
} from "recharts";
import { 
  LayoutGrid, Users, Wallet, Receipt, AlertCircle, Plus, Trash2, X, Check, Lock, LogOut 
} from "lucide-react";

// Set your admin password here
const APP_PASSWORD = "958906"; 

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');`;

const CLASSES = ["8", "9", "10", "11", "12"];
const BATCHES = ["Mathematics", "Physics", "Chemistry", "Science", "Normal"];
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

const defaultFeeStructure = () => {
  const fs = {};
  CLASSES.forEach((c, i) => {
    fs[c] = { 1: 800 + i * 100, 2: 1400 + i * 150, 3: 1900 + i * 200 };
  });
  return fs;
};

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
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem("ledger_auth") === "true";
  });
  const [passInput, setPassInput] = useState("");
  const [passError, setPassError] = useState(false);

  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [students, setStudents] = useState([]);
  const [feeStructure, setFeeStructure] = useState(defaultFeeStructure());
  const [deposits, setDeposits] = useState([]);
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);

  // Authentication handle
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

  // Real-time Cloud Sync with Firestore
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
        setFeeStructure(docSnap.data().matrix);
      } else {
        setDoc(doc(db, "settings", "feeStructure"), { matrix: defaultFeeStructure() });
      }
    });

    return () => {
      unsubStudents();
      unsubDeposits();
      unsubFee();
    };
  }, [isAuthenticated]);

  // Render Lock Screen if not logged in
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#12312B", fontFamily: "'Inter', sans-serif" }}>
        <style>{FONT_IMPORT}</style>
        <div className="bg-[#FAF6EC] p-8 rounded-sm shadow-2xl max-w-md w-full border-2" style={{ borderColor: "#B8862B" }}>
          <div className="flex justify-center mb-3 text-[#12312B]">
            <Lock size={32} />
          </div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-2xl font-bold text-[#12312B] text-center">
            Batch Ledger
          </div>
          <p className="text-xs text-[#9C8F6E] text-center uppercase tracking-wider mb-6" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            Restricted Access
          </p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#6E6650] mb-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                Enter Passcode
              </label>
              <input
                type="password"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                placeholder="••••••••"
                className="w-full border rounded-sm px-3 py-2 text-sm bg-white focus:outline-none"
                style={{ borderColor: passError ? "#A63D2F" : "#D8CFB8" }}
                autoFocus
              />
              {passError && (
                <p className="text-xs text-[#A63D2F] mt-1 font-medium">Incorrect passcode. Try again.</p>
              )}
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-sm text-sm font-medium transition-colors"
              style={{ background: "#12312B", color: "#F4EFDE" }}
            >
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

  // Derived calculations
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
    const months = monthsBetween(st.admissionMonth, curMonth);
    months.forEach(m => {
      const batches = batchesForMonth(st, m);
      const bc = batches.length || 1;
      const expected = expectedFeeFor(st.class, bc);
      const paid = deposits.filter(d => d.studentId === st.id && d.month === m).reduce((a, d) => a + Number(d.amount || 0), 0);
      const outstanding = Math.max(0, expected - paid);
      duesLedger.push({ studentId: st.id, name: st.name, cls: st.class, month: m, batches, expected, paid, outstanding, isCurrent: m === curMonth, status: st.status || "active" });
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

  const classStrength = Object.fromEntries(CLASSES.map(c => [c, 0]));
  activeStudents.forEach(s => { if (classStrength[s.class] !== undefined) classStrength[s.class]++; });

  const recentDeposits = [...deposits].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 8);

  // Cloud Actions
  async function saveStudent(data) {
    const id = data.id || uid();
    await setDoc(doc(db, "students", id), { ...data, id });
    setShowStudentForm(false);
    setEditingStudent(null);
  }

  async function updateStudentStatus(id, newStatus) {
    const st = students.find(s => s.id === id);
    if (st) {
      await setDoc(doc(db, "students", id), { ...st, status: newStatus });
    }
  }

  async function removeStudent(id) {
    if (window.confirm("Are you sure you want to remove this student?")) {
      await deleteDoc(doc(db, "students", id));
    }
  }

  async function saveFeeStructure(updatedMatrix) {
    setFeeStructure(updatedMatrix);
    await setDoc(doc(db, "settings", "feeStructure"), { matrix: updatedMatrix });
  }

  async function saveDeposit(data) {
    const id = uid();
    await setDoc(doc(db, "deposits", id), { ...data, id });
    setShowDepositForm(false);
  }

  async function removeDeposit(id) {
    await deleteDoc(doc(db, "deposits", id));
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { id: "students", label: "Students", icon: Users },
    { id: "structure", label: "Fee Structure", icon: Wallet },
    { id: "deposits", label: "Deposits", icon: Receipt },
    { id: "dues", label: "Dues", icon: AlertCircle },
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
            recentDeposits={recentDeposits} studentById={studentById} curMonth={curMonth}
          />
        )}
        {tab === "students" && (
          <StudentsTab
            students={students}
            studentDues={studentDuesMap}
            onAdd={() => { setEditingStudent(null); setShowStudentForm(true); }}
            onEdit={(s) => { setEditingStudent(s); setShowStudentForm(true); }}
            onStatusChange={updateStudentStatus}
            onRemove={removeStudent}
          />
        )}
        {tab === "structure" && (
          <StructureTab feeStructure={feeStructure} setFeeStructure={saveFeeStructure} />
        )}
        {tab === "deposits" && (
          <DepositsTab deposits={deposits} students={students} onAdd={() => setShowDepositForm(true)} onRemove={removeDeposit} />
        )}
        {tab === "dues" && (
          <DuesTab rows={outstandingRows} totalOutstanding={totalOutstanding} />
        )}
      </main>

      {showStudentForm && (
        <StudentFormModal
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

function DashboardTab({ students, thisMonthCollected, thisMonthExpected, totalOutstanding, trend, batchStrength, classStrength, recentDeposits, studentById, curMonth }) {
  const collectionRate = thisMonthExpected > 0 ? Math.round((thisMonthCollected / thisMonthExpected) * 100) : 0;
  return (
    <div>
      <SectionHeader eyebrow={monthLabel(curMonth)} title="Summary" />
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Students" value={students.length} sub={`${CLASSES.filter(c => students.some(s => s.class === c)).length} classes active`} />
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
        <Card className="p-5">
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold mb-3">Class strength</div>
          <div className="space-y-2">
            {CLASSES.map(c => (
              <div key={c} className="flex items-center gap-2">
                <span className="text-xs w-16 text-[#6E6650]">Class {c}</span>
                <div className="flex-1 bg-[#F0EAD6] rounded-sm h-3 overflow-hidden">
                  <div style={{ width: `${students.length ? (classStrength[c] / Math.max(...Object.values(classStrength), 1)) * 100 : 0}%`, background: "#12312B" }} className="h-full" />
                </div>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs w-6 text-right">{classStrength[c]}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <Card className="p-5">
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold mb-3">Batch enrollment</div>
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
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold mb-3">Recent deposits</div>
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
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="font-semibold text-[#3F6B52]">{fmtINR(d.amount)}</span>
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

function StudentsTab({ students, studentDues, onAdd, onEdit, onStatusChange, onRemove }) {
  return (
    <div>
      <SectionHeader eyebrow="Register" title="Students" action={
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Add student
        </button>
      } />
      <Card>
        {students.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">No students yet. Add your first student to begin the register.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Name", "Class", "Batches", "Phone", "Admitted", "Due Fees", "Status", ""].map(h => (
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
                    <td className="px-4 py-2.5">{s.class}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6E6650]">{(s.batches || []).join(", ") || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6E6650]">{s.phone || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6E6650]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{s.admissionMonth ? monthLabel(s.admissionMonth) : "—"}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold" style={{ fontFamily: "'IBM Plex Mono', monospace", color: dueAmount > 0 ? "#A63D2F" : "#3F6B52" }}>
                      {fmtINR(dueAmount)}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <select 
                        value={status} 
                        onChange={(e) => onStatusChange(s.id, e.target.value)}
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

function StructureTab({ feeStructure, setFeeStructure }) {
  function update(cls, count, val) {
    const updated = { ...feeStructure, [cls]: { ...feeStructure[cls], [count]: Number(val) || 0 } };
    setFeeStructure(updated);
  }
  return (
    <div>
      <SectionHeader eyebrow="Package pricing" title="Fee Structure" />
      <div className="text-sm text-[#6E6650] mb-4">Monthly fee by class and number of batches chosen. Changes update in cloud real-time.</div>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1.5px solid #26231D" }}>
              <th style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">Class</th>
              <th style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">1 batch / month</th>
              <th style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">2 batches / month</th>
              <th style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">3 batches / month</th>
            </tr>
          </thead>
          <tbody>
            {CLASSES.map(c => (
              <tr key={c} className="ledger-row">
                <td className="px-4 py-2.5 font-medium">Class {c}</td>
                {[1, 2, 3].map(count => (
                  <td key={count} className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <span className="text-[#9C8F6E]">₹</span>
                      <input
                        type="number"
                        value={feeStructure[c] ? feeStructure[c][count] : 0}
                        onChange={(e) => update(c, count, e.target.value)}
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                        className="w-24 border rounded-sm px-2 py-1 text-sm"
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

function DepositsTab({ deposits, students, onAdd, onRemove }) {
  const sorted = [...deposits].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const byId = Object.fromEntries(students.map(s => [s.id, s]));
  return (
    <div>
      <SectionHeader eyebrow="Fee deposits" title="Deposits" action={
        <button onClick={onAdd} disabled={students.length === 0} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Record deposit
        </button>
      } />
      {students.length === 0 && <div className="text-sm text-[#9C8F6E] mb-3">Add a student first before recording deposits.</div>}
      <Card>
        {sorted.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">No deposits recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Date", "Student", "Class", "Month", "Batches", "Mode", "Amount", ""].map(h => (
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
                    <td className="px-4 py-2.5">{st ? st.class : "—"}</td>
                    <td className="px-4 py-2.5 text-xs">{monthLabel(d.month)}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6E6650]">{(d.batches || []).join(", ")}</td>
                    <td className="px-4 py-2.5 text-xs">{d.mode}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#3F6B52]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(d.amount)}</td>
                    <td className="px-4 py-2.5 text-right"><button onClick={() => onRemove(d.id)} className="text-xs text-[#A63D2F] underline">Delete</button></td>
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
      <SectionHeader eyebrow="Outstanding" title="Dues" />
      <Card className="p-5 mb-5 flex items-center justify-between" style={{ borderLeft: "4px solid #A63D2F" }}>
        <div>
          <div className="text-sm text-[#6E6650]">Total outstanding across all students</div>
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
                  <td className="px-4 py-2.5">{r.cls}</td>
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
        <div className="px-6 py-5">{children}</div>
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

function StudentFormModal({ initial, onClose, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [cls, setCls] = useState(initial?.class || CLASSES[0]);
  const [batches, setBatches] = useState(initial?.batches || []);
  const [phone, setPhone] = useState(initial?.phone || "");
  const [admissionMonth, setAdmissionMonth] = useState(initial?.admissionMonth || currentMonthKey());
  const [status, setStatus] = useState(initial?.status || "active");

  function toggleBatch(b) {
    setBatches(prev => {
      if (prev.includes(b)) return prev.filter(x => x !== b);
      if (prev.length >= 3) return prev;
      return [...prev, b];
    });
  }

  function submit() {
    if (!name.trim()) return;
    onSave({ id: initial?.id, name: name.trim(), class: cls, batches, phone: phone.trim(), admissionMonth, status });
  }

  return (
    <Modal title={initial ? "Edit student" : "Add student"} onClose={onClose}>
      <Field label="Full name">
        <input className={inputCls} style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ananya Sharma" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Class">
          <select className={inputCls} style={inputStyle} value={cls} onChange={e => setCls(e.target.value)}>
            {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
          </select>
        </Field>
        <Field label="Admitted (month)">
          <input type="month" className={inputCls} style={inputStyle} value={admissionMonth} onChange={e => setAdmissionMonth(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone">
          <input className={inputCls} style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit number" />
        </Field>
        <Field label="Status">
          <select className={inputCls} style={inputStyle} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="passed_out">Passed Out</option>
            <option value="dropped_out">Dropped Out</option>
          </select>
        </Field>
      </div>
      <Field label={`Batches (default — pick up to 3, chosen: ${batches.length})`}>
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
        {initial ? "Save changes" : "Add student"}
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
    <Modal title="Record fee deposit" onClose={onClose}>
      <Field label="Student">
        <select className={inputCls} style={inputStyle} value={studentId} onChange={e => setStudentId(e.target.value)}>
          {students.map(s => <option key={s.id} value={s.id}>{s.name} — Class {s.class} ({s.status || "active"})</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="For month">
          <input type="month" className={inputCls} style={inputStyle} value={month} onChange={e => setMonth(e.target.value)} />
        </Field>
        <Field label="Deposit date">
          <input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
        </Field>
      </div>
      <Field label={`Batches this month (${batches.length}/3)`}>
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
        <Field label={`Amount (suggested ${fmtINR(suggested)})`}>
          <input type="number" className={inputCls} style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder={String(suggested)} />
        </Field>
        <Field label="Mode">
          <select className={inputCls} style={inputStyle} value={mode} onChange={e => setMode(e.target.value)}>
            <option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Cheque</option>
          </select>
        </Field>
      </div>
      <button onClick={submit} disabled={!studentId || !amount} className="w-full mt-3 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Record deposit
      </button>
    </Modal>
  );
}
