import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Plus, Search, Filter, RefreshCw, Trash2, Edit3, 
  CheckCircle, AlertCircle, FileText, Download, Send, 
  TrendingUp, Calendar, DollarSign, RotateCcw, Shield,
  CreditCard, MessageSquare, History, Archive, Eye
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, onSnapshot, doc, setDoc, 
  updateDoc, addDoc, serverTimestamp, query, where 
} from 'firebase/firestore';

// --- FIREBASE INITIALIZATION ---
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function CoachingLedger() {
  // State Management
  const [students, setStudents] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [extraCharges, setExtraCharges] = useState([]);
  const [selectedTab, setSelectedTab] = useState('students'); // 'students', 'projection', 'trash'
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // Modals
  const [showAddChargeModal, setShowAddChargeModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [activeStudent, setActiveStudent] = useState(null);

  // Form States
  const [chargeForm, setChargeForm] = useState({ amount: '', month: selectedMonth, remarks: '' });
  const [paymentForm, setPaymentForm] = useState({ 
    amountPaid: '', 
    writeOffAmount: '0', 
    paymentMode: 'Cash', 
    utrNumber: '', 
    chequeNumber: '', 
    remarks: '' 
  });

  // --- REAL-TIME FIRESTORE LISTENERS ---
  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, "students"), (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubReceipts = onSnapshot(collection(db, "receipts"), (snapshot) => {
      setReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubCharges = onSnapshot(collection(db, "extraCharges"), (snapshot) => {
      setExtraCharges(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubStudents();
      unsubReceipts();
      unsubCharges();
    };
  }, []);

  // --- 1. ADD EXTRA CHARGES LOGIC ---
  const handleAddExtraCharge = async (e) => {
    e.preventDefault();
    if (!activeStudent || !chargeForm.amount) return;

    const chargeAmount = parseFloat(chargeForm.amount);
    
    // 1. Add record to extraCharges collection
    await addDoc(collection(db, "extraCharges"), {
      studentId: activeStudent.id,
      studentName: activeStudent.name,
      amount: chargeAmount,
      month: chargeForm.month,
      remarks: chargeForm.remarks,
      createdAt: new Date().toISOString(),
      isDeleted: false
    });

    // 2. Update Student Total Balance
    const newBalance = (activeStudent.totalDue || 0) + chargeAmount;
    await updateDoc(doc(db, "students", activeStudent.id), {
      totalDue: newBalance
    });

    setShowAddChargeModal(false);
    setChargeForm({ amount: '', month: selectedMonth, remarks: '' });
  };

  // --- 2 & 5. UNIFIED PAYMENT & WRITE-OFF / DISCOUNT LOGIC ---
  const handleProcessPayment = async (e) => {
    e.preventDefault();
    if (!activeStudent) return;

    const paid = parseFloat(paymentForm.amountPaid || 0);
    const writeOff = parseFloat(paymentForm.writeOffAmount || 0);
    const totalCredit = paid + writeOff;

    if (totalCredit <= 0) return;

    // 1. Create Receipt Log
    const receiptData = {
      receiptNo: `REC-${Date.now().toString().slice(-6)}`,
      studentId: activeStudent.id,
      studentName: activeStudent.name,
      amountPaid: paid,
      writeOffAmount: writeOff,
      paymentMode: paymentForm.paymentMode,
      utrNumber: paymentForm.paymentMode === 'UPI' || paymentForm.paymentMode === 'Bank Transfer' ? paymentForm.utrNumber : '',
      chequeNumber: paymentForm.paymentMode === 'Cheque' ? paymentForm.chequeNumber : '',
      remarks: paymentForm.remarks,
      date: new Date().toISOString(),
      isDeleted: false
    };

    await addDoc(collection(db, "receipts"), receiptData);

    // 2. Update Student Balance
    const updatedBalance = Math.max(0, (activeStudent.totalDue || 0) - totalCredit);
    await updateDoc(doc(db, "students", activeStudent.id), {
      totalDue: updatedBalance
    });

    setShowPaymentModal(false);
    setPaymentForm({ amountPaid: '', writeOffAmount: '0', paymentMode: 'Cash', utrNumber: '', chequeNumber: '', remarks: '' });
  };

  // --- 6. SOFT DELETE & RESTORE SYSTEM ---
  const handleSoftDeleteStudent = async (studentId) => {
    if (window.confirm("Move student to Recycle Bin? You can restore them anytime.")) {
      await updateDoc(doc(db, "students", studentId), { isDeleted: true });
    }
  };

  const handleRestoreStudent = async (studentId) => {
    await updateDoc(doc(db, "students", studentId), { isDeleted: false });
  };

  const handleSoftDeleteReceipt = async (receiptId) => {
    if (window.confirm("Move receipt to Recycle Bin?")) {
      await updateDoc(doc(db, "receipts", receiptId), { isDeleted: true });
    }
  };

  const handleRestoreReceipt = async (receiptId) => {
    await updateDoc(doc(db, "receipts", receiptId), { isDeleted: false });
  };

  // --- 3. BANK STATEMENT / ACCOUNT LEDGER CALCULATION ---
  const getStudentStatement = (studentId) => {
    if (!studentId) return [];

    const studentReceipts = receipts
      .filter(r => r.studentId === studentId && !r.isDeleted)
      .map(r => ({
        type: 'CREDIT',
        category: 'Payment Received',
        amount: r.amountPaid,
        writeOff: r.writeOffAmount,
        ref: r.utrNumber || r.chequeNumber || r.receiptNo,
        mode: r.paymentMode,
        remarks: r.remarks,
        date: r.date
      }));

    const studentCharges = extraCharges
      .filter(c => c.studentId === studentId && !c.isDeleted)
      .map(c => ({
        type: 'DEBIT',
        category: `Extra Charge (${c.month})`,
        amount: c.amount,
        writeOff: 0,
        ref: 'CHARGED',
        mode: 'N/A',
        remarks: c.remarks,
        date: c.createdAt
      }));

    const combined = [...studentReceipts, ...studentCharges].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    // Compute Running Balance
    let runningBalance = 0;
    return combined.map(item => {
      if (item.type === 'DEBIT') {
        runningBalance += item.amount;
      } else if (item.type === 'CREDIT') {
        runningBalance -= (item.amount + item.writeOff);
      }
      return { ...item, runningBalance };
    });
  };

  // Active (non-deleted) items
  const activeStudents = useMemo(() => students.filter(s => !s.isDeleted), [students]);
  const activeReceiptList = useMemo(() => receipts.filter(r => !r.isDeleted), [receipts]);
  const deletedStudents = useMemo(() => students.filter(s => s.isDeleted), [students]);
  const deletedReceipts = useMemo(() => receipts.filter(r => r.isDeleted), [receipts]);

  // --- 4. MONTHLY PROJECTION CALCULATION ---
  const projectionMetrics = useMemo(() => {
    const totalBaseMonthly = activeStudents.reduce((sum, s) => sum + (parseFloat(s.monthlyFee) || 0), 0);
    const monthExtraCharges = extraCharges
      .filter(c => c.month === selectedMonth && !c.isDeleted)
      .reduce((sum, c) => sum + c.amount, 0);
    
    return {
      totalBaseMonthly,
      monthExtraCharges,
      totalProjected: totalBaseMonthly + monthExtraCharges
    };
  }, [activeStudents, extraCharges, selectedMonth]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-sans">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="text-indigo-400" /> Coaching Ledger Pro
          </h1>
          <p className="text-sm text-slate-400">Student accounts, fees, receipts & audit logs</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
          <button
            onClick={() => setSelectedTab('students')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${
              selectedTab === 'students' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Students Ledger
          </button>
          <button
            onClick={() => setSelectedTab('projection')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${
              selectedTab === 'projection' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Fee Projection
          </button>
          <button
            onClick={() => setSelectedTab('trash')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition flex items-center gap-1.5 ${
              selectedTab === 'trash' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Archive className="w-4 h-4" /> Recycle Bin ({deletedStudents.length + deletedReceipts.length})
          </button>
        </div>
      </header>

      {/* TAB 1: STUDENTS LEDGER */}
      {selectedTab === 'students' && (
        <main className="mt-6 space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search student name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Student List */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800/80 border-b border-slate-700 text-slate-400 text-xs uppercase font-semibold">
                  <th className="p-4">Student</th>
                  <th className="p-4">Class</th>
                  <th className="p-4">Monthly Fee</th>
                  <th className="p-4">Total Outstanding</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-sm">
                {activeStudents
                  .filter(s => s.name?.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(s => (
                    <tr key={s.id} className="hover:bg-slate-700/30 transition">
                      <td className="p-4 font-medium text-white">{s.name}</td>
                      <td className="p-4 text-slate-300">{s.class || 'N/A'}</td>
                      <td className="p-4 text-slate-300">₹{s.monthlyFee || 0}</td>
                      <td className="p-4">
                        <span className={`font-semibold ${s.totalDue > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          ₹{s.totalDue || 0}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {/* Action Buttons */}
                        <button
                          onClick={() => { setActiveStudent(s); setShowAddChargeModal(true); }}
                          className="px-2.5 py-1.5 bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 border border-amber-500/30 rounded text-xs transition"
                          title="Add Extra Charge"
                        >
                          + Charge
                        </button>

                        <button
                          onClick={() => { setActiveStudent(s); setShowPaymentModal(true); }}
                          className="px-2.5 py-1.5 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 rounded text-xs transition"
                          title="Record Payment & Discount"
                        >
                          + Payment
                        </button>

                        <button
                          onClick={() => { setActiveStudent(s); setShowLedgerModal(true); }}
                          className="px-2.5 py-1.5 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30 rounded text-xs transition"
                          title="View Account Statement"
                        >
                          Statement
                        </button>

                        <button
                          onClick={() => handleSoftDeleteStudent(s.id)}
                          className="px-2 py-1.5 text-slate-400 hover:text-red-400 transition"
                          title="Move to Recycle Bin"
                        >
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      )}

      {/* TAB 2: MONTHLY PROJECTION VIEW (FEATURE 4) */}
      {selectedTab === 'projection' && (
        <main className="mt-6 space-y-6">
          <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
            <div>
              <h2 className="text-lg font-semibold text-white">Monthly Fee Forecast & Billing</h2>
              <p className="text-xs text-slate-400">View charges & projected total revenue for any selected billing cycle</p>
            </div>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
              <span className="text-xs text-slate-400 uppercase font-semibold">Standard Monthly Base</span>
              <p className="text-2xl font-bold text-white mt-1">₹{projectionMetrics.totalBaseMonthly}</p>
            </div>

            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
              <span className="text-xs text-slate-400 uppercase font-semibold">Extra Charges ({selectedMonth})</span>
              <p className="text-2xl font-bold text-amber-400 mt-1">₹{projectionMetrics.monthExtraCharges}</p>
            </div>

            <div className="bg-slate-800 p-5 rounded-xl border border-indigo-500/40 bg-indigo-950/20">
              <span className="text-xs text-indigo-300 uppercase font-semibold">Total Projected Revenue</span>
              <p className="text-2xl font-bold text-indigo-400 mt-1">₹{projectionMetrics.totalProjected}</p>
            </div>
          </div>
        </main>
      )}

      {/* TAB 3: RECYCLE BIN / RESTORE SYSTEM (FEATURE 6) */}
      {selectedTab === 'trash' && (
        <main className="mt-6 space-y-6">
          <h2 className="text-lg font-semibold text-white">Recycle Bin</h2>
          
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-400">Deleted Students ({deletedStudents.length})</h3>
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-slate-400 text-xs">
                  <tr>
                    <th className="p-3">Student Name</th>
                    <th className="p-3">Class</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {deletedStudents.map(s => (
                    <tr key={s.id}>
                      <td className="p-3 text-white">{s.name}</td>
                      <td className="p-3 text-slate-400">{s.class}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleRestoreStudent(s.id)}
                          className="px-3 py-1 bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded text-xs hover:bg-emerald-600/30 transition flex items-center gap-1 ml-auto"
                        >
                          <RotateCcw className="w-3 h-3" /> Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                  {deletedStudents.length === 0 && (
                    <tr><td colSpan="3" className="p-4 text-center text-slate-500">No deleted students in bin.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <h3 className="text-sm font-medium text-slate-400 mt-6">Deleted Receipts ({deletedReceipts.length})</h3>
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-slate-400 text-xs">
                  <tr>
                    <th className="p-3">Receipt No</th>
                    <th className="p-3">Student Name</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {deletedReceipts.map(r => (
                    <tr key={r.id}>
                      <td className="p-3 text-white">{r.receiptNo}</td>
                      <td className="p-3 text-slate-300">{r.studentName}</td>
                      <td className="p-3 text-emerald-400">₹{r.amountPaid}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleRestoreReceipt(r.id)}
                          className="px-3 py-1 bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded text-xs hover:bg-emerald-600/30 transition flex items-center gap-1 ml-auto"
                        >
                          <RotateCcw className="w-3 h-3" /> Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                  {deletedReceipts.length === 0 && (
                    <tr><td colSpan="4" className="p-4 text-center text-slate-500">No deleted receipts in bin.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      )}

      {/* --- MODAL 1: ADD EXTRA CHARGES (FEATURE 1) --- */}
      {showAddChargeModal && activeStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-white">Add Particular Charge</h3>
            <p className="text-xs text-slate-400 mb-4">Student: <span className="text-indigo-400 font-semibold">{activeStudent.name}</span></p>

            <form onSubmit={handleAddExtraCharge} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Target Billing Month</label>
                <input
                  type="month"
                  value={chargeForm.month}
                  onChange={(e) => setChargeForm({...chargeForm, month: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Charge Amount (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  value={chargeForm.amount}
                  onChange={(e) => setChargeForm({...chargeForm, amount: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Remarks / Charge Reason</label>
                <textarea
                  placeholder="e.g. Test series fee, study material charge..."
                  value={chargeForm.remarks}
                  onChange={(e) => setChargeForm({...chargeForm, remarks: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white h-20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddChargeModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition"
                >
                  Save Charge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: UNIFIED PAYMENT & DISCOUNT (FEATURE 2 & 5) --- */}
      {showPaymentModal && activeStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-white">Record Payment / Fee Deposit</h3>
            <p className="text-xs text-slate-400 mb-4">Student: <span className="text-indigo-400 font-semibold">{activeStudent.name}</span> | Current Outstanding: <span className="text-red-400">₹{activeStudent.totalDue || 0}</span></p>

            <form onSubmit={handleProcessPayment} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Amount Paid (₹)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={paymentForm.amountPaid}
                    onChange={(e) => setPaymentForm({...paymentForm, amountPaid: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Discount / Write-Off (₹)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={paymentForm.writeOffAmount}
                    onChange={(e) => setPaymentForm({...paymentForm, writeOffAmount: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Payment Method</label>
                <select
                  value={paymentForm.paymentMode}
                  onChange={(e) => setPaymentForm({...paymentForm, paymentMode: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              {(paymentForm.paymentMode === 'UPI' || paymentForm.paymentMode === 'Bank Transfer') && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">UTR / Transaction Ref Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 320192847192"
                    value={paymentForm.utrNumber}
                    onChange={(e) => setPaymentForm({...paymentForm, utrNumber: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white"
                  />
                </div>
              )}

              {paymentForm.paymentMode === 'Cheque' && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Cheque Number</label>
                  <input
                    type="text"
                    placeholder="e.g. CHQ-004921"
                    value={paymentForm.chequeNumber}
                    onChange={(e) => setPaymentForm({...paymentForm, chequeNumber: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-400 mb-1">Remarks / Note</label>
                <input
                  type="text"
                  placeholder="Optional payment notes..."
                  value={paymentForm.remarks}
                  onChange={(e) => setPaymentForm({...paymentForm, remarks: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition"
                >
                  Generate Receipt & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: BANK STATEMENT / ACCOUNT STATEMENT LEDGER (FEATURE 3) --- */}
      {showLedgerModal && activeStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-3xl p-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-700">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-400" /> Account Statement (Ledger)
                </h3>
                <p className="text-xs text-slate-400">Student: <span className="text-white font-medium">{activeStudent.name}</span></p>
              </div>
              <button onClick={() => setShowLedgerModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 mt-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-slate-400 uppercase font-semibold sticky top-0">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Particulars / Mode</th>
                    <th className="p-3">Reference / UTR</th>
                    <th className="p-3 text-red-400">Debit (+)</th>
                    <th className="p-3 text-emerald-400">Credit (-)</th>
                    <th className="p-3 text-amber-400">Discount</th>
                    <th className="p-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 text-slate-300">
                  {getStudentStatement(activeStudent.id).map((tx, idx) => (
                    <tr key={idx} className="hover:bg-slate-700/20">
                      <td className="p-3 text-slate-400">{new Date(tx.date).toLocaleDateString()}</td>
                      <td className="p-3">
                        <span className="font-medium text-white">{tx.category}</span>
                        {tx.remarks && <p className="text-[10px] text-slate-400">{tx.remarks}</p>}
                      </td>
                      <td className="p-3 text-slate-400">{tx.ref || '-'}</td>
                      <td className="p-3 text-red-400 font-medium">
                        {tx.type === 'DEBIT' ? `₹${tx.amount}` : '-'}
                      </td>
                      <td className="p-3 text-emerald-400 font-medium">
                        {tx.type === 'CREDIT' ? `₹${tx.amount}` : '-'}
                      </td>
                      <td className="p-3 text-amber-400">
                        {tx.writeOff > 0 ? `₹${tx.writeOff}` : '-'}
                      </td>
                      <td className="p-3 text-right font-semibold text-white">
                        ₹{tx.runningBalance}
                      </td>
                    </tr>
                  ))}
                  {getStudentStatement(activeStudent.id).length === 0 && (
                    <tr>
                      <td colSpan="7" className="p-6 text-center text-slate-500">No account history found for this student.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
