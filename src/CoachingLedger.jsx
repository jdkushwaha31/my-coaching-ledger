import React, { useState, useEffect, useMemo, useRef } from "react";
import { db } from "./firebase";
import { 
  collection, onSnapshot, doc, setDoc, deleteDoc 
} from "firebase/firestore";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid 
} from "recharts";
import { 
  LayoutGrid, Users, Wallet, Receipt, AlertCircle, Plus, Trash2, X, Check, Lock, LogOut, BookOpen, Send, Printer, Award, ArrowUpRight, History, Tag
} from "lucide-react";

// Admin Access Password
const APP_PASSWORD = "admin"; 

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');`;

const DEFAULT_CLASSES = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const DEFAULT_SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Science", "Hindi", "English", "Social Studies", "Computer"];
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
  
  const receiptNo = deposit.id ? deposit.id.slice(0, 8).toUpperCase() : "REC-" + Date.now().toString().slice(-4);
  const msg = `*FEE PAYMENT RECEIPT*\n----------------------------------------\n*Receipt No:* #${receiptNo}\n*Date:* ${deposit.date}\n*Student Name:* ${student.name}\n*Class:* ${student.class}\n*For Month:* ${monthLabel(deposit.month)}\n*Payment Mode:* ${deposit.mode || "Cash"}\n----------------------------------------\n*Amount Paid Today:* ₹${deposit.amount}\n*Remaining Balance:* ₹${totalRemainingDue}\n*Status:* ACKNOWLEDGED ✅\n----------------------------------------\nThank you for your payment!`;
  
  window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`, "_blank");
}

function Stamp({ text, tone }) {
  const colors = {
    paid: { bg: "#EAF1EA", border: "#3F6B52", text: "#2E5240" },
    due: { bg: "#FBEFE3", border: "#B8862B", text: "#8A6420" },
    overdue: { bg: "#F7E7E3", border: "#A63D2F", text: "#8A3226" },
    break: { bg: "#EBF3F5", border: "#4A7B9D", text: "#2B526C" }
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
  
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(null); // student object
  const [showHistoryModal, setShowHistoryModal] = useState(null); // student object
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

    const unsubSubjects = onSnapshot(doc(db, "settings", "subjectList"), (docSnap) => {
      if (docSnap.exists()) {
        setSubjectsList(docSnap.data().list || DEFAULT_SUBJECTS);
      } else {
        setDoc(doc(db, "settings", "subjectList"), { list: DEFAULT_SUBJECTS });
      }
    });

    return () => {
      unsubStudents();
      unsubDeposits();
      unsubFee();
      unsubClasses();
      unsubSubjects();
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

  function expectedFeeFor(cls, batchCount, monthlyDiscount = 0) {
    const bc = Math.max(1, Math.min(6, batchCount || 1));
    const baseFee = (feeStructure[cls] && feeStructure[cls][bc]) || 0;
    return Math.max(0, baseFee - (Number(monthlyDiscount) || 0));
  }

  function batchesForMonth(student, month) {
    const dep = deposits.filter(d => d.studentId === student.id && d.month === month).slice(-1)[0];
    if (dep && dep.batches && dep.batches.length) return dep.batches;
    return student.batches || [];
  }

  // Dues Engine with Break/Pause Support & Carried Dues
  const duesLedger = [];
  students.forEach(st => {
    // If student is on break / completed, they don't accrue fees unless they have an admissionMonth active
    if (!st.admissionMonth || st.status === "on_break") return;
    
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
      const expected = expectedFeeFor(st.class, bc, st.monthlyDiscount || 0);
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
  students.forEach(st => {
    const currentAcademicOutstanding = duesLedger.filter(r => r.studentId === st.id).reduce((a, r) => a + r.outstanding, 0);
    const carriedOverDues = Number(st.previousDues || 0);
    studentDuesMap[st.id] = currentAcademicOutstanding + carriedOverDues;
  });

  const activeStudents = students.filter(s => (s.status || "active") === "active");
  const outstandingRows = duesLedger.filter(r => r.outstanding > 0).sort((a, b) => a.month < b.month ? -1 : 1);
  const totalOutstanding = Object.values(studentDuesMap).reduce((a, v) => a + v, 0);

  const thisMonthCollected = deposits.filter(d => d.month === curMonth).reduce((a, d) => a + Number(d.amount || 0), 0);
  const thisMonthExpected = duesLedger.filter(r => r.month === curMonth && r.status === "active").reduce((a, r) => a + r.expected, 0);

  const start = addMonths(curMonth, -5);
  const trendMonths = monthsBetween(start, curMonth);
  const trend = trendMonths.map(m => ({
    month: monthLabel(m).split(" ")[0],
    collected: deposits.filter(d => d.month === m).reduce((a, d) => a + Number(d.amount || 0), 0),
  }));

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

  async function completeAcademicYear(student, resultStatus) {
    const totalCurrentOutstanding = duesLedger.filter(r => r.studentId === student.id).reduce((a, r) => a + r.outstanding, 0);
    const accumulatedPreviousDues = (Number(student.previousDues) || 0) + totalCurrentOutstanding;

    const historyItem = {
      class: student.class,
      batches: student.batches || [],
      admissionMonth: student.admissionMonth,
      completionDate: new Date().toISOString().slice(0, 10),
      resultStatus: resultStatus, // Passed, Repeat, Dropped
      unpaidBalanceAtEnd: totalCurrentOutstanding
    };

    const updatedHistory = [...(student.academicHistory || []), historyItem];

    const updatedStudent = {
      ...student,
      status: "on_break", // Fee counter stops completely
      previousDues: accumulatedPreviousDues,
      academicHistory: updatedHistory,
      exitDate: new Date().toISOString().slice(0, 10)
    };

    await setDoc(doc(db, "students", student.id), updatedStudent);
    alert(`${student.name} marked as ${resultStatus}! Academic record archived. Remaining balance carried forward: ${fmtINR(accumulatedPreviousDues)}`);
  }

  async function promoteStudent(student, newClass, newBatches, newStartMonth, monthlyDiscount) {
    const updatedStudent = {
      ...student,
      class: newClass,
      batches: newBatches,
      admissionMonth: newStartMonth,
      monthlyDiscount: Number(monthlyDiscount) || 0,
      status: "active", // Resumes monthly billing
      exitDate: null
    };

    await setDoc(doc(db, "students", student.id), updatedStudent);
    setShowPromoteModal(null);
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

  async function saveSubjects(updatedList) {
    setSubjectsList(updatedList);
    await setDoc(doc(db, "settings", "subjectList"), { list: updatedList });
  }

  async function saveDeposit(data) {
    const id = uid();
    const newDep = { ...data, id };
    await setDoc(doc(db, "deposits", id), newDep);
    setShowDepositForm(false);
    
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
            <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#F4EFDE] leading-tight">Batch<br/>Ledger Pro</div>
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
            totalOutstanding={totalOutstanding} trend={trend} classStrength={classStrength}
            recentDeposits={recentDeposits} studentById={studentById} curMonth={curMonth} classes={classes}
            studentDues={studentDuesMap}
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
            onCompleteYear={completeAcademicYear}
            onPromote={(s) => setShowPromoteModal(s)}
            onViewHistory={(s) => setShowHistoryModal(s)}
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
            onCompleteYear={completeAcademicYear}
            onPromote={(s) => setShowPromoteModal(s)}
            onViewHistory={(s) => setShowHistoryModal(s)}
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
            studentDues={studentDuesMap}
            onAdd={() => setShowDepositForm(true)} 
            onRemove={removeDeposit} 
            onOpenReceipt={(dep) => setReceiptData({ deposit: dep, student: studentById[dep.studentId] })}
          />
        )}
        {tab === "dues" && (
          <DuesTab rows={outstandingRows} totalOutstanding={totalOutstanding} students={students} studentDues={studentDuesMap} />
        )}
      </main>

      {showStudentForm && (
        <StudentFormModal
          classes={classes}
          subjectsList={subjectsList}
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
          subjectsList={subjectsList}
          onClose={() => setShowClassModal(false)} 
          onSaveClasses={saveClasses}
          onSaveSubjects={saveSubjects}
        />
      )}
      {showPromoteModal && (
        <PromoteModal
          student={showPromoteModal}
          classes={classes}
          subjectsList={subjectsList}
          curMonth={curMonth}
          onClose={() => setShowPromoteModal(null)}
          onPromote={promoteStudent}
        />
      )}
      {showHistoryModal && (
        <AcademicHistoryModal
          student={showHistoryModal}
          onClose={() => setShowHistoryModal(null)}
        />
      )}
      {receiptData && (
        <ReceiptModal 
          deposit={receiptData.deposit} 
          student={receiptData.student} 
          totalRemainingDue={studentDuesMap[receiptData.student?.id] || 0}
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

function DashboardTab({ students, thisMonthCollected, thisMonthExpected, totalOutstanding, trend, classStrength, recentDeposits, studentById, curMonth, classes, studentDues, onOpenReceipt }) {
  const collectionRate = thisMonthExpected > 0 ? Math.round((thisMonthCollected / thisMonthExpected) * 100) : 0;
  return (
    <div>
      <SectionHeader eyebrow={monthLabel(curMonth)} title="Summary" />
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Students" value={students.length} sub={`${classes.filter(c => students.some(s => s.class === c)).length} active classes`} />
        <StatCard label="Collected this month" value={fmtINR(thisMonthCollected)} sub={`of ${fmtINR(thisMonthExpected)} expected`} tone="good" />
        <StatCard label="Collection rate" value={`${collectionRate}%`} tone={collectionRate >= 80 ? "good" : collectionRate >= 50 ? "warn" : "bad"} />
        <StatCard label="Total Dues Balance" value={fmtINR(totalOutstanding)} sub="includes carried-over dues" tone={totalOutstanding > 0 ? "bad" : "good"} />
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

      <Card className="p-5">
        <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold mb-3">Recent Deposits Logged</div>
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
  );
}

function ClassAndDuesHubTab({ students, classes, studentDues, outstandingRows, onManageClasses, onEditStudent, onCompleteYear, onPromote, onViewHistory }) {
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
    const msg = `Dear Parent, this is a gentle reminder regarding ${name}'s tuition fee for ${monthLabel(month)}. Pending Balance: ₹${amount}. Please clear it at your earliest convenience. Thank you!`;
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div>
      <SectionHeader 
        eyebrow="Dedicated Analytics" 
        title="Class & Dues Hub" 
        action={
          <button onClick={onManageClasses} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-sm" style={{ background: "white", borderColor: "#26231D" }}>
            <Plus size={14} /> Manage Classes & Subjects
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
            Class Directory & Promotions
          </button>
          <button 
            onClick={() => setViewMode("dues")}
            className="px-4 py-2 text-xs font-semibold"
            style={{ background: viewMode === "dues" ? "#12312B" : "white", color: viewMode === "dues" ? "#F4EFDE" : "#12312B" }}
          >
            Dues Breakdown ({outstandingRows.length})
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
                  {["Name", "Class", "Subjects", "Total Due", "Status", "Academic Cycle Actions"].map(h => (
                    <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(s => {
                  const due = studentDues[s.id] || 0;
                  const status = s.status || "active";
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
                      <td className="px-4 py-2.5 text-xs text-[#6E6650]">{(s.batches || []).join(", ") || "—"}</td>
                      <td className="px-4 py-2.5 text-xs font-semibold" style={{ fontFamily: "'IBM Plex Mono', monospace", color: due > 0 ? "#A63D2F" : "#3F6B52" }}>
                        {fmtINR(due)}
                        {s.previousDues > 0 && <div className="text-[9px] text-[#A63D2F]">({fmtINR(s.previousDues)} old)</div>}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        <Stamp 
                          text={status === "active" ? "Active" : status === "on_break" ? "On Break / Gap" : status} 
                          tone={status === "active" ? "paid" : status === "on_break" ? "break" : "overdue"} 
                        />
                      </td>
                      <td className="px-4 py-2.5 text-xs space-x-2">
                        {status === "active" ? (
                          <button 
                            onClick={() => onCompleteYear(s, "Passed")} 
                            className="px-2 py-1 bg-[#26231D] text-[#FAF6EC] rounded text-[11px] font-medium hover:bg-black inline-flex items-center gap-1"
                          >
                            <Award size={11} /> Complete Year
                          </button>
                        ) : (
                          <button 
                            onClick={() => onPromote(s)} 
                            className="px-2 py-1 bg-[#3F6B52] text-white rounded text-[11px] font-medium hover:bg-[#2E5240] inline-flex items-center gap-1"
                          >
                            <ArrowUpRight size={11} /> Promote / Resume
                          </button>
                        )}
                        <button onClick={() => onViewHistory(s)} className="text-[#12312B] underline inline-flex items-center gap-0.5">
                          <History size={11} /> Log
                        </button>
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
            <div className="p-8 text-center text-sm text-[#3F6B52] font-medium">🎉 Great job! There are no pending fee dues for active months.</div>
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

function StudentsTab({ students, studentDues, classes, onAdd, onEdit, onStatusChange, onCompleteYear, onPromote, onViewHistory, onRemove }) {
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
                {["Name", "Class", "Subjects", "Total Due", "Status", "Actions"].map(h => (
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
                    <td className="px-4 py-2.5 font-medium">
                      <div>{s.name}</div>
                      {s.phone && <div className="text-[10px] text-[#9C8F6E]">{s.phone}</div>}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-[#12312B]">{s.class}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6E6650]">{(s.batches || []).join(", ") || "—"}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold" style={{ fontFamily: "'IBM Plex Mono', monospace", color: dueAmount > 0 ? "#A63D2F" : "#3F6B52" }}>
                      {fmtINR(dueAmount)}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <Stamp text={status === "active" ? "Active" : status === "on_break" ? "On Break" : status} tone={status === "active" ? "paid" : "break"} />
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap space-x-2">
                      {status === "active" ? (
                        <button onClick={() => onCompleteYear(s, "Passed")} className="text-xs text-[#26231D] font-semibold underline">
                          Complete Year
                        </button>
                      ) : (
                        <button onClick={() => onPromote(s)} className="text-xs text-[#3F6B52] font-semibold underline">
                          Promote
                        </button>
                      )}
                      <button onClick={() => onEdit(s)} className="text-xs text-[#12312B] underline">Edit</button>
                      <button onClick={() => onViewHistory(s)} className="text-xs text-[#12312B] underline">History</button>
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
                      <input
                        type="number"
                        value={feeStructure[c] ? feeStructure[c][count] || 0 : 0}
                        onChange={(e) => update(c, count, e.target.value)}
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                        className="w-20 border rounded-sm px-1.5 py-1 text-xs bg-white"
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

function DepositsTab({ deposits, students, studentDues, onAdd, onRemove, onOpenReceipt }) {
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
                {["Date", "Student", "Class", "For Month", "Subjects Paid", "Mode", "Amount Paid", "Actions"].map(h => (
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
                      <button onClick={() => sendWhatsAppReceipt(d, st, studentDues[st?.id] || 0)} className="text-xs text-[#25D366] font-semibold underline mr-3 inline-flex items-center gap-1">
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

function DuesTab({ rows, totalOutstanding, students, studentDues }) {
  return (
    <div>
      <SectionHeader eyebrow="Outstanding Dues" title="Pending Dues Ledger" />
      <Card className="p-5 mb-5 flex items-center justify-between" style={{ borderLeft: "4px solid #A63D2F" }}>
        <div>
          <div className="text-sm text-[#6E6650]">Total pending balance across all active & break students</div>
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
                  {s.previousDues > 0 && <div className="text-[10px] text-[#A63D2F]">Carried Dues: ₹{s.previousDues}</div>}
                </div>
                <div className="font-bold text-[#A63D2F]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(due)}</div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">No active monthly dues pending.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Student", "Class", "Month", "Expected", "Paid", "Outstanding", "Status"].map(h => (
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

function StudentFormModal({ classes, subjectsList, initial, onClose, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [cls, setCls] = useState(initial?.class || classes[0] || "10");
  const [batches, setBatches] = useState(initial?.batches || []);
  const [phone, setPhone] = useState(initial?.phone || "");
  const [admissionMonth, setAdmissionMonth] = useState(initial?.admissionMonth || currentMonthKey());
  const [monthlyDiscount, setMonthlyDiscount] = useState(initial?.monthlyDiscount || 0);
  const [previousDues, setPreviousDues] = useState(initial?.previousDues || 0);
  const [status, setStatus] = useState(initial?.status || "active");

  function toggleSubject(sub) {
    setBatches(prev => {
      if (prev.includes(sub)) return prev.filter(x => x !== sub);
      if (prev.length >= 6) return prev;
      return [...prev, sub];
    });
  }

  function submit() {
    if (!name.trim()) return;
    onSave({ 
      ...initial,
      id: initial?.id, 
      name: name.trim(), 
      class: cls, 
      batches, 
      phone: phone.trim(), 
      admissionMonth, 
      monthlyDiscount: Number(monthlyDiscount) || 0,
      previousDues: Number(previousDues) || 0,
      status
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
        <Field label="Fee Start Month">
          <input type="month" className={inputCls} style={inputStyle} value={admissionMonth} onChange={e => setAdmissionMonth(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone / WhatsApp Number">
          <input className={inputCls} style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit phone number" />
        </Field>
        <Field label="Monthly Concession / Discount (₹)">
          <input type="number" className={inputCls} style={inputStyle} value={monthlyDiscount} onChange={e => setMonthlyDiscount(e.target.value)} placeholder="0" />
        </Field>
      </div>

      <Field label="Carried-Over Previous Dues (₹)">
        <input type="number" className={inputCls} style={inputStyle} value={previousDues} onChange={e => setPreviousDues(e.target.value)} placeholder="0" />
      </Field>

      <Field label={`Select Subjects / Batches (${batches.length}/6 max)`}>
        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 border bg-white rounded-sm">
          {subjectsList.map(sub => {
            const active = batches.includes(sub);
            return (
              <button key={sub} type="button" onClick={() => toggleSubject(sub)}
                className="px-2.5 py-1 text-xs rounded-sm border flex items-center gap-1"
                style={{ background: active ? "#12312B" : "white", color: active ? "#F4EFDE" : "#4A4636", borderColor: active ? "#12312B" : "#D8CFB8" }}>
                {active && <Check size={12} />}{sub}
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

function PromoteModal({ student, classes, subjectsList, curMonth, onClose, onPromote }) {
  const [newClass, setNewClass] = useState(student.class);
  const [newBatches, setNewBatches] = useState(student.batches || []);
  const [newStartMonth, setNewStartMonth] = useState(curMonth);
  const [monthlyDiscount, setMonthlyDiscount] = useState(student.monthlyDiscount || 0);

  function toggleSubject(sub) {
    setNewBatches(prev => {
      if (prev.includes(sub)) return prev.filter(x => x !== sub);
      if (prev.length >= 6) return prev;
      return [...prev, sub];
    });
  }

  function submit() {
    onPromote(student, newClass, newBatches, newStartMonth, monthlyDiscount);
  }

  return (
    <Modal title={`Promote / Re-Enroll: ${student.name}`} onClose={onClose}>
      <div className="p-3 bg-[#EAF1EA] border border-[#3F6B52] rounded text-xs mb-3">
        Carried Dues from previous sessions: <strong>{fmtINR(student.previousDues || 0)}</strong>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="New Class">
          <select className={inputCls} style={inputStyle} value={newClass} onChange={e => setNewClass(e.target.value)}>
            {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
          </select>
        </Field>
        <Field label="Fee Resume Start Month">
          <input type="month" className={inputCls} style={inputStyle} value={newStartMonth} onChange={e => setNewStartMonth(e.target.value)} />
        </Field>
      </div>

      <Field label="Monthly Concession (₹)">
        <input type="number" className={inputCls} style={inputStyle} value={monthlyDiscount} onChange={e => setMonthlyDiscount(e.target.value)} />
      </Field>

      <Field label={`Select Subjects (${newBatches.length}/6)`}>
        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 border bg-white rounded-sm">
          {subjectsList.map(sub => {
            const active = newBatches.includes(sub);
            return (
              <button key={sub} type="button" onClick={() => toggleSubject(sub)}
                className="px-2.5 py-1 text-xs rounded-sm border flex items-center gap-1"
                style={{ background: active ? "#12312B" : "white", color: active ? "#F4EFDE" : "#4A4636", borderColor: active ? "#12312B" : "#D8CFB8" }}>
                {active && <Check size={12} />}{sub}
              </button>
            );
          })}
        </div>
      </Field>

      <button onClick={submit} className="w-full mt-3 py-2.5 rounded-sm text-sm font-semibold bg-[#3F6B52] text-white">
        Promote Student & Resume Fee Counter
      </button>
    </Modal>
  );
}

function AcademicHistoryModal({ student, onClose }) {
  const history = student.academicHistory || [];
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
                <Stamp text={h.resultStatus || "Completed"} tone="paid" />
              </div>
              <div className="text-xs text-[#6E6650] mt-1">
                Subjects: {(h.batches || []).join(", ") || "General"}
              </div>
              <div className="text-[11px] text-[#9C8F6E] mt-1 flex justify-between" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                <span>Joined: {monthLabel(h.admissionMonth)}</span>
                <span>Ended: {h.completionDate}</span>
              </div>
            </div>
          ))
        )}
      </div>
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

  const suggested = student ? expectedFeeFor(student.class, batches.length || 1, student.monthlyDiscount || 0) : 0;

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

function ClassManagerModal({ classes, subjectsList, onClose, onSaveClasses, onSaveSubjects }) {
  const [classList, setClassList] = useState([...classes]);
  const [subjList, setSubjList] = useState([...subjectsList]);
  const [newClassName, setNewClassName] = useState("");
  const [newSubjName, setNewSubjName] = useState("");

  const addClass = () => {
    if (newClassName.trim() && !classList.includes(newClassName.trim())) {
      setClassList([...classList, newClassName.trim()]);
      setNewClassName("");
    }
  };

  const addSubject = () => {
    if (newSubjName.trim() && !subjList.includes(newSubjName.trim())) {
      setSubjList([...subjList, newSubjName.trim()]);
      setNewSubjName("");
    }
  };

  const handleSave = () => {
    onSaveClasses(classList);
    onSaveSubjects(subjList);
    onClose();
  };

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

      <button onClick={handleSave} className="w-full mt-2 py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Save All Changes
      </button>
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
            <span>Payment Mode:</span>
            <strong className="text-[#12312B]">{deposit.mode || "Cash"}</strong>
          </div>

          <div className="pt-3 mt-3 border-t-2 border-[#12312B]">
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="font-bold">Amount Paid Today:</span>
              <span className="font-bold text-[#3F6B52] text-lg" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(deposit.amount)}</span>
            </div>
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
        <button 
          onClick={handlePrint} 
          className="flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]"
        >
          <Printer size={15} /> Print Receipt
        </button>
        <button 
          onClick={() => sendWhatsAppReceipt(deposit, student, totalRemainingDue)} 
          className="flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#25D366] hover:bg-[#1DA851]"
        >
          <Send size={15} /> Send to WhatsApp
        </button>
      </div>
    </Modal>
  );
}
// Example of updated student object structure
const [students, setStudents] = useState([
  {
    id: "stu_1",
    name: "John Doe",
    status: "Active", // "Active", "Passed Out", "On Break", "Dropped Out"
    statusHistory: [],
    // Effective-dated batches
    batches: [
      { batchName: "Batch A", startDate: "2026-01-01", endDate: null, status: "Active" }
    ]
  }
]);
// ====================================================
// 1. REVERT / UNDO PASSED OUT STATUS
// ====================================================
const revertStudentStatus = (studentId, newStatus) => {
  setStudents(prev => prev.map(student => {
    if (student.id === studentId) {
      const historyEntry = {
        prevStatus: student.status,
        newStatus: newStatus,
        date: new Date().toISOString()
      };
      return {
        ...student,
        status: newStatus,
        statusHistory: [...(student.statusHistory || []), historyEntry]
      };
    }
    return student;
  }));
};

// ====================================================
// 2. FETCH DUES (SHOWS GAP / ON BREAK STUDENTS TOO)
// ====================================================
// Filter invoices by UNPAID status, NOT by student status
const getUnpaidDuesList = (invoices) => {
  return invoices.filter(inv => inv.status === 'Unpaid');
};

// ====================================================
// 3. MID-YEAR DROPOUT HANDLER
// ====================================================
const processDropout = (studentId, dropoutDate, cancelFutureDues) => {
  setStudents(prev => prev.map(student => {
    if (student.id === studentId) {
      // Close active batch entries
      const updatedBatches = (student.batches || []).map(b => 
        !b.endDate ? { ...b, endDate: dropoutDate, status: 'Completed' } : b
      );
      return {
        ...student,
        status: 'Dropped Out',
        dropoutDate: dropoutDate,
        batches: updatedBatches
      };
    }
    return student;
  }));

  // Cancel future unpaid invoices if toggle is checked
  if (cancelFutureDues) {
    setInvoices(prev => prev.map(inv => {
      if (inv.studentId === studentId && inv.status === 'Unpaid' && inv.dueDate > dropoutDate) {
        return { ...inv, status: 'Cancelled' };
      }
      return inv;
    }));
  }
};

// ====================================================
// 4. BATCH TRANSFER / ADDITION (EFFECTIVE FROM MONTH)
// ====================================================
const manageBatch = (studentId, targetBatchName, effectiveDate, actionType) => {
  // actionType: 'TRANSFER' or 'ADD'
  setStudents(prev => prev.map(student => {
    if (student.id === studentId) {
      let currentBatches = [...(student.batches || [])];

      if (actionType === 'TRANSFER') {
        // End existing active batch on day prior
        currentBatches = currentBatches.map(b => 
          !b.endDate ? { ...b, endDate: effectiveDate, status: 'Transferred' } : b
        );
      }

      // Add new batch starting on effective date (e.g. Sept 1)
      currentBatches.push({
        batchName: targetBatchName,
        startDate: effectiveDate,
        endDate: null,
        status: 'Active'
      });

      return { ...student, batches: currentBatches };
    }
    return student;
  }));
};
{/* Example Action UI inside Student Card or Row */}
<div className="student-actions">
  
  {/* 1. Undo / Revert Status Controls */}
  <button onClick={() => revertStudentStatus(student.id, 'Active')}>
    Undo / Set Active
  </button>
  <button onClick={() => revertStudentStatus(student.id, 'On Break')}>
    Set On Break
  </button>

  {/* 2. Drop Out Action */}
  <button onClick={() => processDropout(student.id, '2026-09-01', true)}>
    Mark Dropped Out
  </button>

  {/* 3. Batch Transfer starting Sept */}
  <button onClick={() => manageBatch(student.id, 'Batch B (Sept)', '2026-09-01', 'TRANSFER')}>
    Switch to Sept Batch
  </button>

</div>
