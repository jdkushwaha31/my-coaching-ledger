import React, { useState, useEffect, useMemo } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  arrayUnion
} from "firebase/firestore";
import {
  Users,
  CreditCard,
  FileText,
  Trash2,
  RotateCcw,
  PlusCircle,
  TrendingUp,
  Search,
  Filter,
  Printer,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Send,
  Calendar,
  Layers,
  ShieldCheck,
  Tag
} from "lucide-react";

// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "YOUR_APP_ID"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export default function CoachingLedger() {
  // State: Navigation & Admin Auth
  const [isAdmin, setIsAdmin] = useState(true);
  const [adminPassword, setAdminPassword] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, students, payments, statements, projections, trash

  // State: Real-time collections
  const [students, setStudents] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [feeMatrix, setFeeMatrix] = useState({});

  // State: Filters & Selection
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState("ALL");
  const [selectedStudentForStatement, setSelectedStudentForStatement] = useState(null);
  const [projectionMonth, setProjectionMonth] = useState(
    new Date().toISOString().slice(0, 7)
  ); // YYYY-MM

  // State: Modals
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [selectedStudentForAction, setSelectedStudentForAction] = useState(null);

  // Forms
  const [studentForm, setStudentForm] = useState({
    name: "",
    parentName: "",
    phone: "",
    className: "",
    selectedSubjects: [],
    carriedForwardDues: 0,
    monthlyConcession: 0
  });

  const [paymentForm, setPaymentForm] = useState({
    studentId: "",
    amountPaid: 0,
    writeOffDiscount: 0,
    paymentMode: "UPI", // UPI, Cash, Cheque, Bank Transfer
    utrNumber: "",
    chequeNumber: "",
    remarks: ""
  });

  const [chargeForm, setChargeForm] = useState({
    studentId: "",
    month: new Date().toISOString().slice(0, 7),
    chargeTitle: "",
    amount: 0,
    remarks: ""
  });

  // --- Real-time Listeners ---
  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, "students"), (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setStudents(docs);
    });

    const unsubReceipts = onSnapshot(collection(db, "receipts"), (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setReceipts(docs);
    });

    const unsubClasses = onSnapshot(collection(db, "classes"), (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setClasses(docs);
    });

    return () => {
      unsubStudents();
      unsubReceipts();
      unsubClasses();
    };
  }, []);

  // --- Filtered Data ---
  const activeStudents = useMemo(() => {
    return students.filter((s) => !s.isDeleted);
  }, [students]);

  const deletedStudents = useMemo(() => {
    return students.filter((s) => s.isDeleted);
  }, [students]);

  const activeReceipts = useMemo(() => {
    return receipts.filter((r) => !r.isDeleted);
  }, [receipts]);

  const deletedReceipts = useMemo(() => {
    return receipts.filter((r) => r.isDeleted);
  }, [receipts]);

  // --- Ledger Calculation Helper (Feature 3 & Feature 5) ---
  const getStudentLedger = (studentId) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return { transactions: [], netBalance: 0 };

    let transactions = [];

    // 1. Initial / Carried Forward Dues
    if (student.carriedForwardDues > 0) {
      transactions.push({
        id: "init_dues",
        date: student.createdAt || "Initial",
        type: "CARRIED_DUES",
        description: "Carried Forward Balance from Previous Session",
        debit: Number(student.carriedForwardDues),
        credit: 0
      });
    }

    // 2. Monthly Base Tuition Charges
    if (student.billingHistory && Array.isArray(student.billingHistory)) {
      student.billingHistory.forEach((bill, idx) => {
        transactions.push({
          id: `bill_${idx}`,
          date: `${bill.month}-01`,
          type: "MONTHLY_FEE",
          description: `Base Tuition Fee (${bill.month})`,
          debit: Number(bill.amount),
          credit: 0
        });
      });
    }

    // 3. Additional Custom Charges (Feature 1)
    if (student.additionalCharges && Array.isArray(student.additionalCharges)) {
      student.additionalCharges.forEach((chg) => {
        if (!chg.isDeleted) {
          transactions.push({
            id: chg.id,
            date: chg.date || chg.month,
            type: "ADDITIONAL_CHARGE",
            description: `Extra Charge: ${chg.chargeTitle} (${chg.month}) - ${chg.remarks || "N/A"}`,
            debit: Number(chg.amount),
            credit: 0
          });
        }
      });
    }

    // 4. Payments & Discounts/Write-offs (Feature 2 & 5)
    const stReceipts = activeReceipts.filter((r) => r.studentId === studentId);
    stReceipts.forEach((r) => {
      if (Number(r.amountPaid) > 0) {
        let paymentInfo = `Payment Received via ${r.paymentMode}`;
        if (r.utrNumber) paymentInfo += ` | UTR: ${r.utrNumber}`;
        if (r.chequeNumber) paymentInfo += ` | Cheque: ${r.chequeNumber}`;
        if (r.remarks) paymentInfo += ` (${r.remarks})`;

        transactions.push({
          id: `${r.id}_paid`,
          date: r.date,
          type: "PAYMENT",
          description: paymentInfo,
          debit: 0,
          credit: Number(r.amountPaid),
          receiptId: r.id
        });
      }

      if (Number(r.writeOffDiscount) > 0) {
        transactions.push({
          id: `${r.id}_discount`,
          date: r.date,
          type: "DISCOUNT_WRITEOFF",
          description: `Discount / Write-off Applied on Receipt #${r.receiptNumber}`,
          debit: 0,
          credit: Number(r.writeOffDiscount),
          receiptId: r.id
        });
      }
    });

    // Sort Chronologically
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate Running Balance
    let runningBalance = 0;
    transactions = transactions.map((tx) => {
      runningBalance += tx.debit - tx.credit;
      return { ...tx, balance: runningBalance };
    });

    return { transactions, netBalance: runningBalance };
  };

  // --- Handlers: Feature 1 (Add Additional Charge) ---
  const handleAddAdditionalCharge = async (e) => {
    e.preventDefault();
    if (!chargeForm.studentId || !chargeForm.amount) return;

    const chargeObj = {
      id: `chg_${Date.now()}`,
      month: chargeForm.month,
      chargeTitle: chargeForm.chargeTitle,
      amount: parseFloat(chargeForm.amount),
      remarks: chargeForm.remarks,
      date: new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString()
    };

    const studentRef = doc(db, "students", chargeForm.studentId);
    await updateDoc(studentRef, {
      additionalCharges: arrayUnion(chargeObj)
    });

    setShowChargeModal(false);
    setChargeForm({
      studentId: "",
      month: new Date().toISOString().slice(0, 7),
      chargeTitle: "",
      amount: 0,
      remarks: ""
    });
  };

  // --- Handlers: Feature 2 & 5 (Record Payment with Discount/Write-off) ---
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentForm.studentId) return;

    const receiptNum = `REC-${Date.now().toString().slice(-6)}`;
    const newReceipt = {
      receiptNumber: receiptNum,
      studentId: paymentForm.studentId,
      amountPaid: parseFloat(paymentForm.amountPaid || 0),
      writeOffDiscount: parseFloat(paymentForm.writeOffDiscount || 0),
      paymentMode: paymentForm.paymentMode,
      utrNumber: paymentForm.utrNumber,
      chequeNumber: paymentForm.chequeNumber,
      remarks: paymentForm.remarks,
      date: new Date().toISOString().split("T")[0],
      isDeleted: false,
      createdAt: serverTimestamp()
    };

    await setDoc(doc(db, "receipts", receiptNum), newReceipt);

    setShowPaymentModal(false);
    setPaymentForm({
      studentId: "",
      amountPaid: 0,
      writeOffDiscount: 0,
      paymentMode: "UPI",
      utrNumber: "",
      chequeNumber: "",
      remarks: ""
    });
  };

  // --- Handlers: Feature 6 (Soft Delete & Restore) ---
  const handleSoftDeleteStudent = async (studentId) => {
    if (window.confirm("Are you sure you want to move this student to the Recycle Bin?")) {
      await updateDoc(doc(db, "students", studentId), {
        isDeleted: true,
        deletedAt: new Date().toISOString()
      });
    }
  };

  const handleRestoreStudent = async (studentId) => {
    await updateDoc(doc(db, "students", studentId), {
      isDeleted: false,
      deletedAt: null
    });
  };

  const handleSoftDeleteReceipt = async (receiptId) => {
    if (window.confirm("Move receipt to Recycle Bin?")) {
      await updateDoc(doc(db, "receipts", receiptId), {
        isDeleted: true,
        deletedAt: new Date().toISOString()
      });
    }
  };

  const handleRestoreReceipt = async (receiptId) => {
    await updateDoc(doc(db, "receipts", receiptId), {
      isDeleted: false,
      deletedAt: null
    });
  };

  // --- Handlers: Add Student ---
  const handleAddStudent = async (e) => {
    e.preventDefault();
    const newId = `STU-${Date.now().toString().slice(-5)}`;
    await setDoc(doc(db, "students", newId), {
      ...studentForm,
      carriedForwardDues: parseFloat(studentForm.carriedForwardDues || 0),
      monthlyConcession: parseFloat(studentForm.monthlyConcession || 0),
      status: "ACTIVE",
      isDeleted: false,
      additionalCharges: [],
      billingHistory: [
        {
          month: new Date().toISOString().slice(0, 7),
          amount: 1000 // Base default or mapped fee
        }
      ],
      createdAt: new Date().toISOString().split("T")[0]
    });

    setShowAddStudentModal(false);
    setStudentForm({
      name: "",
      parentName: "",
      phone: "",
      className: "",
      selectedSubjects: [],
      carriedForwardDues: 0,
      monthlyConcession: 0
    });
  };

  // --- Feature 4: Projection Metric Calculation ---
  const projectionMetrics = useMemo(() => {
    let totalBaseFees = 0;
    let totalCharges = 0;
    let totalDiscounts = 0;
    let totalPaid = 0;

    activeStudents.forEach((st) => {
      // Base billing for month
      if (st.billingHistory) {
        const mBill = st.billingHistory.find((b) => b.month === projectionMonth);
        if (mBill) totalBaseFees += Number(mBill.amount || 0);
      }
      // Additional charges for month
      if (st.additionalCharges) {
        st.additionalCharges.forEach((chg) => {
          if (chg.month === projectionMonth && !chg.isDeleted) {
            totalCharges += Number(chg.amount || 0);
          }
        });
      }
    });

    // Receipts collected in month
    activeReceipts.forEach((r) => {
      if (r.date && r.date.startsWith(projectionMonth)) {
        totalPaid += Number(r.amountPaid || 0);
        totalDiscounts += Number(r.writeOffDiscount || 0);
      }
    });

    const netBilled = totalBaseFees + totalCharges - totalDiscounts;

    return {
      totalBaseFees,
      totalCharges,
      totalDiscounts,
      totalPaid,
      netBilled,
      outstandingForMonth: netBilled - totalPaid
    };
  }, [activeStudents, activeReceipts, projectionMonth]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-950 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Layers className="h-7 w-7 text-indigo-400" />
          <h1 className="text-xl font-bold tracking-tight text-white">
            CoachingLedger <span className="text-xs text-indigo-400 font-mono">v2.5 Pro</span>
          </h1>
        </div>

        {/* Tab Navigation */}
        <nav className="flex flex-wrap gap-2 bg-slate-900 p-1.5 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              activeTab === "dashboard" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("students")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              activeTab === "students" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Students Directory
          </button>
          <button
            onClick={() => setActiveTab("projections")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              activeTab === "projections" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Fee Projections
          </button>
          <button
            onClick={() => setActiveTab("statements")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              activeTab === "statements" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Student Statements
          </button>
          <button
            onClick={() => setActiveTab("trash")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center space-x-1 ${
              activeTab === "trash" ? "bg-red-600 text-white" : "text-slate-400 hover:text-red-400"
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>Trash Center</span>
          </button>
        </nav>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowChargeModal(true)}
            className="flex items-center space-x-1 bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-md text-sm font-medium transition"
          >
            <Tag className="w-4 h-4" />
            <span>Add Extra Charge</span>
          </button>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-md text-sm font-medium transition"
          >
            <DollarSign className="w-4 h-4" />
            <span>Collect Payment</span>
          </button>
          <button
            onClick={() => setShowAddStudentModal(true)}
            className="flex items-center space-x-1 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md text-sm font-medium transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Student</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {/* --- TAB 1: DASHBOARD --- */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Active Students</p>
                <h2 className="text-3xl font-extrabold text-white mt-2">{activeStudents.length}</h2>
              </div>
              <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Payments Recorded</p>
                <h2 className="text-3xl font-extrabold text-emerald-400 mt-2">
                  ₹{activeReceipts.reduce((acc, r) => acc + Number(r.amountPaid || 0), 0).toLocaleString()}
                </h2>
              </div>
              <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Write-offs / Discounts</p>
                <h2 className="text-3xl font-extrabold text-amber-400 mt-2">
                  ₹{activeReceipts.reduce((acc, r) => acc + Number(r.writeOffDiscount || 0), 0).toLocaleString()}
                </h2>
              </div>
              <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Deleted Items in Trash</p>
                <h2 className="text-3xl font-extrabold text-red-400 mt-2">
                  {deletedStudents.length + deletedReceipts.length}
                </h2>
              </div>
            </div>

            {/* Quick Overview Table */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <h3 className="text-lg font-bold text-white mb-4">Recent Receipts Issued</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
                    <tr>
                      <th className="p-3">Receipt #</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Student ID</th>
                      <th className="p-3">Paid Amount</th>
                      <th className="p-3">Discount</th>
                      <th className="p-3">Mode</th>
                      <th className="p-3">Reference / Remarks</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {activeReceipts.slice(-5).reverse().map((r) => (
                      <tr key={r.receiptNumber} className="hover:bg-slate-750">
                        <td className="p-3 font-mono font-medium text-indigo-400">{r.receiptNumber}</td>
                        <td className="p-3">{r.date}</td>
                        <td className="p-3">{r.studentId}</td>
                        <td className="p-3 text-emerald-400 font-semibold">₹{r.amountPaid}</td>
                        <td className="p-3 text-amber-400">₹{r.writeOffDiscount || 0}</td>
                        <td className="p-3">{r.paymentMode}</td>
                        <td className="p-3 text-slate-400 text-xs">
                          {r.utrNumber && `UTR: ${r.utrNumber} `}
                          {r.chequeNumber && `Cheque: ${r.chequeNumber} `}
                          {r.remarks}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleSoftDeleteReceipt(r.receiptNumber)}
                            className="text-red-400 hover:text-red-300 text-xs flex items-center space-x-1 justify-end ml-auto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 2: STUDENTS DIRECTORY --- */}
        {activeTab === "students" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700">
              <div className="flex items-center space-x-2 bg-slate-900 px-3 py-2 rounded-lg border border-slate-700 w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search student name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-sm focus:outline-none text-white w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeStudents
                .filter((s) => s.name?.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((st) => {
                  const ledger = getStudentLedger(st.id);
                  return (
                    <div key={st.id} className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-white text-lg">{st.name}</h4>
                          <p className="text-xs text-slate-400">ID: {st.id} | Class: {st.className || "N/A"}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-900/60 text-indigo-300 border border-indigo-700">
                          {st.status || "ACTIVE"}
                        </span>
                      </div>

                      <div className="text-sm space-y-1 text-slate-300">
                        <p><span className="text-slate-500">Parent:</span> {st.parentName || "N/A"}</p>
                        <p><span className="text-slate-500">Phone:</span> {st.phone || "N/A"}</p>
                      </div>

                      <div className="bg-slate-900 p-3 rounded-lg border border-slate-750 flex justify-between items-center">
                        <span className="text-xs text-slate-400 font-medium">Net Current Balance:</span>
                        <span className={`font-bold text-base ${ledger.netBalance > 0 ? "text-red-400" : "text-emerald-400"}`}>
                          ₹{ledger.netBalance}
                        </span>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => {
                            setSelectedStudentForStatement(st.id);
                            setActiveTab("statements");
                          }}
                          className="flex-1 bg-slate-700 hover:bg-slate-600 text-xs py-2 rounded-md font-medium text-slate-200 transition"
                        >
                          View Passbook
                        </button>
                        <button
                          onClick={() => handleSoftDeleteStudent(st.id)}
                          className="px-3 bg-red-950/40 hover:bg-red-900/50 text-red-400 border border-red-800/40 text-xs py-2 rounded-md transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* --- TAB 3: FEATURE 4 - FEE PROJECTIONS & EXPECTED REVENUE VIEW --- */}
        {activeTab === "projections" && (
          <div className="space-y-6">
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">Monthly Fee Projection & Revenue Hub</h3>
                <p className="text-xs text-slate-400">View expected tuition fees, additional charges, and actual collections for any target month.</p>
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-slate-300">Target Month:</label>
                <input
                  type="month"
                  value={projectionMonth}
                  onChange={(e) => setProjectionMonth(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                <p className="text-xs text-slate-400 uppercase font-semibold">Base Tuition Billed</p>
                <h3 className="text-2xl font-bold text-white mt-1">₹{projectionMetrics.totalBaseFees.toLocaleString()}</h3>
              </div>
              <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                <p className="text-xs text-slate-400 uppercase font-semibold">Additional Charges Billed</p>
                <h3 className="text-2xl font-bold text-amber-400 mt-1">₹{projectionMetrics.totalCharges.toLocaleString()}</h3>
              </div>
              <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                <p className="text-xs text-slate-400 uppercase font-semibold">Discounts / Write-offs Granted</p>
                <h3 className="text-2xl font-bold text-slate-400 mt-1">₹{projectionMetrics.totalDiscounts.toLocaleString()}</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-indigo-950/40 border border-indigo-800/50 p-5 rounded-xl">
                <p className="text-xs text-indigo-300 uppercase font-semibold">Net Expected Billing ({projectionMonth})</p>
                <h2 className="text-3xl font-extrabold text-indigo-200 mt-1">
                  ₹{projectionMetrics.netBilled.toLocaleString()}
                </h2>
              </div>
              <div className="bg-emerald-950/40 border border-emerald-800/50 p-5 rounded-xl">
                <p className="text-xs text-emerald-300 uppercase font-semibold">Actual Collections Received</p>
                <h2 className="text-3xl font-extrabold text-emerald-300 mt-1">
                  ₹{projectionMetrics.totalPaid.toLocaleString()}
                </h2>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 4: FEATURE 3 - BANK STATEMENT / PASSBOOK STYLE LEDGER --- */}
        {activeTab === "statements" && (
          <div className="space-y-6">
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white">Student Account Passbook / Statement</h3>
              </div>
              <select
                value={selectedStudentForStatement || ""}
                onChange={(e) => setSelectedStudentForStatement(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none w-full sm:w-72"
              >
                <option value="">-- Select a Student --</option>
                {activeStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.id})
                  </option>
                ))}
              </select>
            </div>

            {selectedStudentForStatement ? (
              (() => {
                const st = activeStudents.find((s) => s.id === selectedStudentForStatement);
                const { transactions, netBalance } = getStudentLedger(selectedStudentForStatement);
                return (
                  <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-6">
                    <div className="flex flex-wrap justify-between items-center pb-4 border-b border-slate-700 gap-4">
                      <div>
                        <h2 className="text-xl font-bold text-white">{st?.name}</h2>
                        <p className="text-xs text-slate-400">Class: {st?.className} | Phone: {st?.phone}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400 uppercase font-medium">Net Balance Due</p>
                        <p className={`text-2xl font-extrabold ${netBalance > 0 ? "text-red-400" : "text-emerald-400"}`}>
                          ₹{netBalance}
                        </p>
                      </div>
                    </div>

                    {/* Statement Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
                          <tr>
                            <th className="p-3">Date</th>
                            <th className="p-3">Transaction Description</th>
                            <th className="p-3 text-right">Debit (+Fee)</th>
                            <th className="p-3 text-right">Credit (-Paid)</th>
                            <th className="p-3 text-right">Running Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                          {transactions.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-4 text-center text-slate-500">
                                No statement records found.
                              </td>
                            </tr>
                          ) : (
                            transactions.map((tx) => (
                              <tr key={tx.id} className="hover:bg-slate-750">
                                <td className="p-3 font-mono text-xs text-slate-400">{tx.date}</td>
                                <td className="p-3 font-medium text-slate-200">{tx.description}</td>
                                <td className="p-3 text-right text-red-400 font-mono">
                                  {tx.debit > 0 ? `₹${tx.debit}` : "-"}
                                </td>
                                <td className="p-3 text-right text-emerald-400 font-mono">
                                  {tx.credit > 0 ? `₹${tx.credit}` : "-"}
                                </td>
                                <td className="p-3 text-right font-bold font-mono text-slate-100">
                                  ₹{tx.balance}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="text-center py-12 bg-slate-800 rounded-xl border border-slate-700 text-slate-500">
                Please select a student from the dropdown above to view their statement.
              </div>
            )}
          </div>
        )}

        {/* --- TAB 5: FEATURE 6 - TRASH & RESTORE CENTER --- */}
        {activeTab === "trash" && (
          <div className="space-y-6">
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <RotateCcw className="w-5 h-5 text-indigo-400" />
                <span>Recycle Bin & Data Restoration Hub</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Restore soft-deleted students or payment receipts back to active status without losing any records.
              </p>
            </div>

            {/* Deleted Students */}
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4">
              <h4 className="font-semibold text-slate-200">Deleted Students ({deletedStudents.length})</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
                    <tr>
                      <th className="p-3">Student ID</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Class</th>
                      <th className="p-3">Deleted Date</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {deletedStudents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-500">
                          No deleted students in trash.
                        </td>
                      </tr>
                    ) : (
                      deletedStudents.map((st) => (
                        <tr key={st.id}>
                          <td className="p-3 font-mono">{st.id}</td>
                          <td className="p-3 font-medium text-white">{st.name}</td>
                          <td className="p-3">{st.className}</td>
                          <td className="p-3 text-xs text-slate-400">{st.deletedAt || "N/A"}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleRestoreStudent(st.id)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-xs transition"
                            >
                              Restore
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Deleted Receipts */}
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4">
              <h4 className="font-semibold text-slate-200">Deleted Receipts ({deletedReceipts.length})</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
                    <tr>
                      <th className="p-3">Receipt #</th>
                      <th className="p-3">Student ID</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Deleted Date</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {deletedReceipts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-500">
                          No deleted receipts in trash.
                        </td>
                      </tr>
                    ) : (
                      deletedReceipts.map((r) => (
                        <tr key={r.receiptNumber}>
                          <td className="p-3 font-mono text-indigo-400">{r.receiptNumber}</td>
                          <td className="p-3">{r.studentId}</td>
                          <td className="p-3 font-semibold text-emerald-400">₹{r.amountPaid}</td>
                          <td className="p-3 text-xs text-slate-400">{r.deletedAt || "N/A"}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleRestoreReceipt(r.receiptNumber)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-xs transition"
                            >
                              Restore
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- MODAL 1: ADD ADDITIONAL CHARGES (FEATURE 1) --- */}
      {showChargeModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-white">Add Additional Charge to Student</h3>
            <form onSubmit={handleAddAdditionalCharge} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-medium">Select Student</label>
                <select
                  required
                  value={chargeForm.studentId}
                  onChange={(e) => setChargeForm({ ...chargeForm, studentId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none"
                >
                  <option value="">-- Choose Student --</option>
                  {activeStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium">Charge Target Month</label>
                <input
                  type="month"
                  required
                  value={chargeForm.month}
                  onChange={(e) => setChargeForm({ ...chargeForm, month: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium">Charge Title (e.g. Exam Fee, Books)</label>
                <input
                  type="text"
                  required
                  placeholder="Exam Fee / Annual Charge"
                  value={chargeForm.chargeTitle}
                  onChange={(e) => setChargeForm({ ...chargeForm, chargeTitle: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium">Charge Amount (₹)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={chargeForm.amount}
                  onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium">Remarks / Reason</label>
                <input
                  type="text"
                  placeholder="Additional notes..."
                  value={chargeForm.remarks}
                  onChange={(e) => setChargeForm({ ...chargeForm, remarks: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChargeModal(false)}
                  className="flex-1 bg-slate-700 text-slate-300 py-2 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-2 rounded-lg text-sm font-medium"
                >
                  Save Charge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: COLLECT PAYMENT & DISCOUNT (FEATURE 2 & 5) --- */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-white">Record Payment / Generate Receipt</h3>
            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-medium">Select Student</label>
                <select
                  required
                  value={paymentForm.studentId}
                  onChange={(e) => setPaymentForm({ ...paymentForm, studentId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none"
                >
                  <option value="">-- Choose Student --</option>
                  {activeStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400 font-medium">Amount Received (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={paymentForm.amountPaid}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amountPaid: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-amber-400 font-medium">Discount / Write-off (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={paymentForm.writeOffDiscount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, writeOffDiscount: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium">Payment Mode</label>
                <select
                  value={paymentForm.paymentMode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none"
                >
                  <option value="UPI">UPI / GPay / PhonePe</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              {(paymentForm.paymentMode === "UPI" || paymentForm.paymentMode === "Bank Transfer") && (
                <div>
                  <label className="text-xs text-slate-400 font-medium">UTR / Transaction Ref Number</label>
                  <input
                    type="text"
                    placeholder="Enter UTR / Ref Number"
                    value={paymentForm.utrNumber}
                    onChange={(e) => setPaymentForm({ ...paymentForm, utrNumber: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
              )}

              {paymentForm.paymentMode === "Cheque" && (
                <div>
                  <label className="text-xs text-slate-400 font-medium">Cheque Number</label>
                  <input
                    type="text"
                    placeholder="Enter Cheque Number"
                    value={paymentForm.chequeNumber}
                    onChange={(e) => setPaymentForm({ ...paymentForm, chequeNumber: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="text-xs text-slate-400 font-medium">Payment Remarks</label>
                <input
                  type="text"
                  placeholder="Optional payment remarks..."
                  value={paymentForm.remarks}
                  onChange={(e) => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 bg-slate-700 text-slate-300 py-2 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-sm font-medium"
                >
                  Save Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: ADD NEW STUDENT --- */}
      {showAddStudentModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-white">Enroll New Student</h3>
            <form onSubmit={handleAddStudent} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-medium">Student Name</label>
                <input
                  type="text"
                  required
                  placeholder="Full name"
                  value={studentForm.name}
                  onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium">Parent / Guardian Name</label>
                <input
                  type="text"
                  placeholder="Parent Name"
                  value={studentForm.parentName}
                  onChange={(e) => setStudentForm({ ...studentForm, parentName: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium">Contact Phone Number</label>
                <input
                  type="tel"
                  placeholder="10-digit Phone"
                  value={studentForm.phone}
                  onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium">Class / Grade</label>
                <input
                  type="text"
                  placeholder="Class 10 / Class 12"
                  value={studentForm.className}
                  onChange={(e) => setStudentForm({ ...studentForm, className: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium">Carried Forward Initial Dues (₹)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={studentForm.carriedForwardDues}
                  onChange={(e) => setStudentForm({ ...studentForm, carriedForwardDues: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="flex-1 bg-slate-700 text-slate-300 py-2 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-sm font-medium"
                >
                  Enroll Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
