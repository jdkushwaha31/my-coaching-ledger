import React, { useState, useEffect, useMemo } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
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
  Printer,
  DollarSign,
  Send,
  Calendar,
  Layers,
  Settings,
  Tag,
  CheckSquare,
  Square
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

// Default Master Options
const DEFAULT_CLASSES = ["Class 8", "Class 9", "Class 10", "Class 11", "Class 12"];
const DEFAULT_SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "English", "Computer Science"];

export default function CoachingLedger() {
  // Navigation & Admin Auth
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, students, projections, statements, settings, trash

  // Real-time collections
  const [students, setStudents] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [classList, setClassList] = useState(DEFAULT_CLASSES);
  const [subjectList, setSubjectList] = useState(DEFAULT_SUBJECTS);
  const [feeMatrix, setFeeMatrix] = useState({
    "Class 10": { 1: 500, 2: 900, 3: 1200, 4: 1500, 5: 1800, 6: 2000 },
    "Class 12": { 1: 700, 2: 1300, 3: 1800, 4: 2200, 5: 2500, 6: 2800 }
  });

  // Filters & Selections
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentForStatement, setSelectedStudentForStatement] = useState(null);
  const [projectionMonth, setProjectionMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // Modals
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showChargeModal, setShowChargeModal] = useState(false);

  // Blank Form State Definitions (For Easy Resetting)
  const initialStudentForm = {
    name: "",
    parentName: "",
    phone: "",
    className: "Class 10",
    selectedSubjects: [],
    carriedForwardDues: 0,
    monthlyConcession: 0
  };

  const initialPaymentForm = {
    studentId: "",
    amountPaid: 0,
    writeOffDiscount: 0,
    paymentMode: "UPI",
    utrNumber: "",
    chequeNumber: "",
    remarks: ""
  };

  const initialChargeForm = {
    studentId: "",
    month: new Date().toISOString().slice(0, 7),
    chargeTitle: "",
    amount: 0,
    remarks: ""
  };

  // Active Forms State
  const [studentForm, setStudentForm] = useState(initialStudentForm);
  const [paymentForm, setPaymentForm] = useState(initialPaymentForm);
  const [chargeForm, setChargeForm] = useState(initialChargeForm);

  // --- Real-time Firestore Listeners ---
  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, "students"), (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setStudents(docs);
    });

    const unsubReceipts = onSnapshot(collection(db, "receipts"), (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setReceipts(docs);
    });

    const unsubMatrix = onSnapshot(doc(db, "settings", "feeMatrix"), (snap) => {
      if (snap.exists()) {
        setFeeMatrix(snap.data());
      }
    });

    return () => {
      unsubStudents();
      unsubReceipts();
      unsubMatrix();
    };
  }, []);

  // Filter Active vs Deleted
  const activeStudents = useMemo(() => students.filter((s) => !s.isDeleted), [students]);
  const deletedStudents = useMemo(() => students.filter((s) => s.isDeleted), [students]);
  const activeReceipts = useMemo(() => receipts.filter((r) => !r.isDeleted), [receipts]);
  const deletedReceipts = useMemo(() => receipts.filter((r) => r.isDeleted), [receipts]);

  // Dynamic Fee Calculator based on Matrix
  const calculateCalculatedMonthlyFee = (className, subjectCount) => {
    if (!className || subjectCount === 0) return 0;
    const classRules = feeMatrix[className];
    if (classRules && classRules[subjectCount]) {
      return Number(classRules[subjectCount]);
    }
    // Fallback baseline calculation if matrix row isn't explicitly defined
    return subjectCount * 400;
  };

  // --- Feature 3: Bank Statement / Passbook Engine ---
  const getStudentLedger = (studentId) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return { transactions: [], netBalance: 0 };

    let transactions = [];

    // 1. Carried Forward Dues
    if (student.carriedForwardDues > 0) {
      transactions.push({
        id: "init_dues",
        date: student.createdAt || "Initial",
        type: "CARRIED_DUES",
        description: "Carried Forward Dues / Past Balance",
        debit: Number(student.carriedForwardDues),
        credit: 0
      });
    }

    // 2. Base Monthly Tuition Billing
    if (student.billingHistory && Array.isArray(student.billingHistory)) {
      student.billingHistory.forEach((bill, idx) => {
        transactions.push({
          id: `bill_${idx}`,
          date: `${bill.month}-01`,
          type: "MONTHLY_FEE",
          description: `Base Tuition Fee (${bill.month}) [${bill.subjectCount || 0} Subjects]`,
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
            description: `Extra Charge: ${chg.chargeTitle} (${chg.month}) ${chg.remarks ? `- ${chg.remarks}` : ""}`,
            debit: Number(chg.amount),
            credit: 0
          });
        }
      });
    }

    // 4. Payments & Discounts (Feature 2 & 5)
    const stReceipts = activeReceipts.filter((r) => r.studentId === studentId);
    stReceipts.forEach((r) => {
      if (Number(r.amountPaid) > 0) {
        let paymentInfo = `Payment Received (${r.paymentMode})`;
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
          description: `Discount / Write-off Applied (#${r.receiptNumber})`,
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

  // --- Handlers with Auto-Resetting Form Fields ---

  // Add Student
  const handleAddStudent = async (e) => {
    e.preventDefault();
    const newId = `STU-${Date.now().toString().slice(-5)}`;
    const currentMonth = new Date().toISOString().slice(0, 7);

    const calculatedFee = calculateCalculatedMonthlyFee(
      studentForm.className,
      studentForm.selectedSubjects.length
    );
    const netBaseFee = Math.max(0, calculatedFee - parseFloat(studentForm.monthlyConcession || 0));

    await setDoc(doc(db, "students", newId), {
      ...studentForm,
      carriedForwardDues: parseFloat(studentForm.carriedForwardDues || 0),
      monthlyConcession: parseFloat(studentForm.monthlyConcession || 0),
      baseMonthlyFee: netBaseFee,
      status: "ACTIVE",
      isDeleted: false,
      additionalCharges: [],
      billingHistory: [
        {
          month: currentMonth,
          amount: netBaseFee,
          subjectCount: studentForm.selectedSubjects.length,
          subjects: studentForm.selectedSubjects
        }
      ],
      createdAt: new Date().toISOString().split("T")[0]
    });

    // Reset Form to initial clean state
    setStudentForm(initialStudentForm);
    setShowAddStudentModal(false);
  };

  // Add Extra Charge (Feature 1)
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

    await updateDoc(doc(db, "students", chargeForm.studentId), {
      additionalCharges: arrayUnion(chargeObj)
    });

    // Reset Form
    setChargeForm(initialChargeForm);
    setShowChargeModal(false);
  };

  // Record Payment & Write-off (Feature 2 & 5)
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

    // Reset Form
    setPaymentForm(initialPaymentForm);
    setShowPaymentModal(false);
  };

  // Fee Matrix Setting Saver
  const handleSaveFeeMatrix = async (className, subjectNum, amount) => {
    const updated = {
      ...feeMatrix,
      [className]: {
        ...(feeMatrix[className] || {}),
        [subjectNum]: parseFloat(amount || 0)
      }
    };
    setFeeMatrix(updated);
    await setDoc(doc(db, "settings", "feeMatrix"), updated);
  };

  // Soft Delete & Restore (Feature 6)
  const handleSoftDeleteStudent = async (id) => {
    if (window.confirm("Move student to Trash?")) {
      await updateDoc(doc(db, "students", id), { isDeleted: true, deletedAt: new Date().toISOString() });
    }
  };

  const handleRestoreStudent = async (id) => {
    await updateDoc(doc(db, "students", id), { isDeleted: false, deletedAt: null });
  };

  const handleSoftDeleteReceipt = async (id) => {
    if (window.confirm("Move receipt to Trash?")) {
      await updateDoc(doc(db, "receipts", id), { isDeleted: true, deletedAt: new Date().toISOString() });
    }
  };

  const handleRestoreReceipt = async (id) => {
    await updateDoc(doc(db, "receipts", id), { isDeleted: false, deletedAt: null });
  };

  // Subject Selection Toggle Helper
  const toggleSubjectSelection = (subj) => {
    setStudentForm((prev) => {
      const exists = prev.selectedSubjects.includes(subj);
      const updatedSubjs = exists
        ? prev.selectedSubjects.filter((s) => s !== subj)
        : [...prev.selectedSubjects, subj];
      return { ...prev, selectedSubjects: updatedSubjs };
    });
  };

  // Monthly Projection Calculation (Feature 4)
  const projectionMetrics = useMemo(() => {
    let totalBaseFees = 0;
    let totalCharges = 0;
    let totalDiscounts = 0;
    let totalPaid = 0;

    activeStudents.forEach((st) => {
      if (st.billingHistory) {
        const mBill = st.billingHistory.find((b) => b.month === projectionMonth);
        if (mBill) totalBaseFees += Number(mBill.amount || 0);
      }
      if (st.additionalCharges) {
        st.additionalCharges.forEach((chg) => {
          if (chg.month === projectionMonth && !chg.isDeleted) {
            totalCharges += Number(chg.amount || 0);
          }
        });
      }
    });

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
      {/* Navbar Header */}
      <header className="border-b border-slate-800 bg-slate-950 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Layers className="h-7 w-7 text-indigo-400" />
          <h1 className="text-xl font-bold text-white">
            CoachingLedger <span className="text-xs text-indigo-400 font-mono">v3.0 Complete</span>
          </h1>
        </div>

        {/* Navigation Tabs */}
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
            Passbook / Statements
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center space-x-1 ${
              activeTab === "settings" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Fee Matrix</span>
          </button>
          <button
            onClick={() => setActiveTab("trash")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center space-x-1 ${
              activeTab === "trash" ? "bg-red-600 text-white" : "text-slate-400 hover:text-red-400"
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>Trash ({deletedStudents.length + deletedReceipts.length})</span>
          </button>
        </nav>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowChargeModal(true)}
            className="flex items-center space-x-1 bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-md text-sm font-medium transition"
          >
            <Tag className="w-4 h-4" />
            <span>Extra Charge</span>
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

      {/* Main App Content Area */}
      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {/* --- TAB 1: DASHBOARD --- */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Enrolled Students</p>
                <h2 className="text-3xl font-extrabold text-white mt-2">{activeStudents.length}</h2>
              </div>
              <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Collections</p>
                <h2 className="text-3xl font-extrabold text-emerald-400 mt-2">
                  ₹{activeReceipts.reduce((acc, r) => acc + Number(r.amountPaid || 0), 0).toLocaleString()}
                </h2>
              </div>
              <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Discounts / Write-offs</p>
                <h2 className="text-3xl font-extrabold text-amber-400 mt-2">
                  ₹{activeReceipts.reduce((acc, r) => acc + Number(r.writeOffDiscount || 0), 0).toLocaleString()}
                </h2>
              </div>
              <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Items in Recycle Bin</p>
                <h2 className="text-3xl font-extrabold text-red-400 mt-2">
                  {deletedStudents.length + deletedReceipts.length}
                </h2>
              </div>
            </div>

            {/* Recent Receipts Log */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <h3 className="text-lg font-bold text-white mb-4">Recent Payments & Receipts</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
                    <tr>
                      <th className="p-3">Receipt #</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Student ID</th>
                      <th className="p-3">Amount Paid</th>
                      <th className="p-3">Discount</th>
                      <th className="p-3">Mode</th>
                      <th className="p-3">Ref Details</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {activeReceipts.slice(-6).reverse().map((r) => (
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
                  placeholder="Search by student name or phone..."
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

                      {/* Display Enrolled Subjects */}
                      <div className="space-y-1">
                        <p className="text-xs text-slate-400 font-medium">Enrolled Batch Subjects:</p>
                        <div className="flex flex-wrap gap-1">
                          {st.selectedSubjects && st.selectedSubjects.length > 0 ? (
                            st.selectedSubjects.map((sub, i) => (
                              <span key={i} className="bg-slate-900 text-slate-300 text-[11px] px-2 py-0.5 rounded border border-slate-700">
                                {sub}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-500 italic">No subjects selected</span>
                          )}
                        </div>
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

        {/* --- TAB 3: PROJECTIONS (FEATURE 4) --- */}
        {activeTab === "projections" && (
          <div className="space-y-6">
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">Monthly Fee Projection & Revenue Hub</h3>
                <p className="text-xs text-slate-400">View expected tuition fees, extra charges, and actual collections for any selected month.</p>
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-slate-300">Select Month:</label>
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
                <p className="text-xs text-slate-400 uppercase font-semibold">Discounts Granted</p>
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

        {/* --- TAB 4: PASSBOOK / STATEMENTS (FEATURE 3) --- */}
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
                <option value="">-- Choose Student --</option>
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
                        <p className="text-xs text-slate-400 uppercase font-medium">Net Outstanding Due</p>
                        <p className={`text-2xl font-extrabold ${netBalance > 0 ? "text-red-400" : "text-emerald-400"}`}>
                          ₹{netBalance}
                        </p>
                      </div>
                    </div>

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
                                No statement entries found.
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
                Select a student from the dropdown above to view their chronological passbook ledger.
              </div>
            )}
          </div>
        )}

        {/* --- TAB 5: RESTORED FEE MATRIX SETTINGS --- */}
        {activeTab === "settings" && (
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white">Class & Subject Fee Matrix Settings</h3>
              <p className="text-xs text-slate-400">
                Define standard monthly fees per class based on how many subjects a student takes (1 to 6 subjects).
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
                  <tr>
                    <th className="p-3">Class Name</th>
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <th key={num} className="p-3 text-center">{num} Subject{num > 1 ? "s" : ""} (₹)</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {classList.map((cls) => (
                    <tr key={cls}>
                      <td className="p-3 font-bold text-white">{cls}</td>
                      {[1, 2, 3, 4, 5, 6].map((num) => (
                        <td key={num} className="p-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={feeMatrix[cls]?.[num] || ""}
                            onChange={(e) => handleSaveFeeMatrix(cls, num, e.target.value)}
                            placeholder="0"
                            className="w-20 bg-slate-900 border border-slate-700 rounded text-center py-1 text-white text-xs focus:outline-none focus:border-indigo-500"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- TAB 6: TRASH & RESTORE (FEATURE 6) --- */}
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

            {/* Deleted Students Table */}
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
                        <td colSpan={5} className="p-4 text-center text-slate-500">No deleted students.</td>
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

            {/* Deleted Receipts Table */}
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
                        <td colSpan={5} className="p-4 text-center text-slate-500">No deleted receipts.</td>
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

      {/* --- MODAL 1: ADD NEW STUDENT (WITH SUBJECT/BATCH SELECTION & AUTO-RESET) --- */}
      {showAddStudentModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white">Enroll New Student</h3>
            <form onSubmit={handleAddStudent} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium">Student Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Full Name"
                    value={studentForm.name}
                    onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium">Parent Name</label>
                  <input
                    type="text"
                    placeholder="Parent/Guardian"
                    value={studentForm.parentName}
                    onChange={(e) => setStudentForm({ ...studentForm, parentName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium">Contact Phone</label>
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    value={studentForm.phone}
                    onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium">Select Class</label>
                  <select
                    value={studentForm.className}
                    onChange={(e) => setStudentForm({ ...studentForm, className: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none"
                  >
                    {classList.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subject Selection Checkboxes */}
              <div>
                <label className="text-xs text-slate-400 font-medium mb-1 block">
                  Select Subjects / Batch ({studentForm.selectedSubjects.length} selected)
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-900 p-3 rounded-lg border border-slate-700">
                  {subjectList.map((subj) => {
                    const isChecked = studentForm.selectedSubjects.includes(subj);
                    return (
                      <button
                        type="button"
                        key={subj}
                        onClick={() => toggleSubjectSelection(subj)}
                        className={`flex items-center space-x-2 text-xs p-2 rounded text-left transition ${
                          isChecked ? "bg-indigo-900/60 text-indigo-300 border border-indigo-700" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {isChecked ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4 text-slate-600" />}
                        <span>{subj}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Fee Calculation Preview */}
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Calculated Matrix Monthly Fee:</span>
                  <span className="font-bold text-white">
                    ₹{calculateCalculatedMonthlyFee(studentForm.className, studentForm.selectedSubjects.length)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium">Monthly Concession (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={studentForm.monthlyConcession}
                    onChange={(e) => setStudentForm({ ...studentForm, monthlyConcession: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium">Carried Forward Dues (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={studentForm.carriedForwardDues}
                    onChange={(e) => setStudentForm({ ...studentForm, carriedForwardDues: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="flex-1 bg-slate-700 text-slate-300 py-2.5 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg text-sm font-medium"
                >
                  Save & Enroll Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: ADD EXTRA CHARGES (FEATURE 1) --- */}
      {showChargeModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-white">Add Extra Charge to Student</h3>
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
                <label className="text-xs text-slate-400 font-medium">Target Month</label>
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
                  placeholder="Lab Fee / Book Set"
                  value={chargeForm.chargeTitle}
                  onChange={(e) => setChargeForm({ ...chargeForm, chargeTitle: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium">Amount (₹)</label>
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
                <label className="text-xs text-slate-400 font-medium">Remarks / Details</label>
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

      {/* --- MODAL 3: RECORD PAYMENT & WRITE-OFF (FEATURE 2 & 5) --- */}
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
                  placeholder="Optional payment notes..."
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
    </div>
  );
}
