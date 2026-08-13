import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { 
  Users, IndianRupee, TrendingUp, AlertCircle, Plus, Search, 
  Trash2, CheckCircle2, ChevronRight, LayoutDashboard, UserPlus, 
  BookOpen, Receipt, RefreshCw 
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function CoachingLedger() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [students, setStudents] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newStudent, setNewStudent] = useState({ name: '', class: '10', batch: 'Mathematics', monthlyFee: '' });
  const [newDeposit, setNewDeposit] = useState({ studentId: '', amount: '', month: 'August', year: '2026' });

  // Real-time Firestore Sync
  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(data);
      setLoading(false);
    });

    const unsubDeposits = onSnapshot(collection(db, 'deposits'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDeposits(data);
    });

    return () => {
      unsubStudents();
      unsubDeposits();
    };
  }, []);

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!newStudent.name || !newStudent.monthlyFee) return;
    const id = Date.now().toString();
    await setDoc(doc(db, 'students', id), {
      ...newStudent,
      monthlyFee: Number(newStudent.monthlyFee),
      joinedDate: new Date().toISOString()
    });
    setNewStudent({ name: '', class: '10', batch: 'Mathematics', monthlyFee: '' });
  };

  const handleAddDeposit = async (e) => {
    e.preventDefault();
    if (!newDeposit.studentId || !newDeposit.amount) return;
    const id = Date.now().toString();
    const student = students.find(s => s.id === newDeposit.studentId);
    await setDoc(doc(db, 'deposits', id), {
      ...newDeposit,
      studentName: student ? student.name : 'Unknown',
      amount: Number(newDeposit.amount),
      date: new Date().toLocaleDateString()
    });
    setNewDeposit({ studentId: '', amount: '', month: 'August', year: '2026' });
  };

  const totalCollected = deposits.reduce((sum, d) => sum + d.amount, 0);
  const totalExpected = students.reduce((sum, s) => sum + s.monthlyFee, 0);

  return (
    <div className="flex h-screen bg-[#FBF9F1] text-[#2C3E35] font-sans">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-[#1A3C34] text-[#E8E4D9] p-6 flex flex-col justify-between shadow-xl">
        <div>
          <div className="mb-8">
            <h1 className="text-2xl font-serif font-bold tracking-wide">Batch Ledger</h1>
            <p className="text-xs text-[#A3B18A] mt-1">REAL-TIME CLOUD SYNC</p>
          </div>
          <nav className="space-y-2">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'students', label: 'Students', icon: Users },
              { id: 'deposits', label: 'Deposits', icon: Receipt },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm transition-all ${
                    activeTab === item.id 
                      ? 'bg-[#2D5A27] text-white font-medium shadow-md' 
                      : 'hover:bg-[#2C4A3E] text-[#C2C9AD]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
        <div className="text-xs text-[#A3B18A] flex items-center gap-2">
          <RefreshCw className="w-3 h-3 animate-spin" /> Live Cloud Active
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-lg text-gray-500">Connecting to Cloud Database...</p>
          </div>
        ) : activeTab === 'dashboard' ? (
          <div className="space-y-8">
            <h2 className="text-3xl font-serif font-bold text-[#1A3C34]">Summary Overview</h2>
            
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E2DFD2]">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Students</p>
                <p className="text-3xl font-bold text-[#1A3C34] mt-2">{students.length}</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E2DFD2]">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Collected</p>
                <p className="text-3xl font-bold text-[#2D5A27] mt-2">₹{totalCollected.toLocaleString()}</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E2DFD2]">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Expected Monthly</p>
                <p className="text-3xl font-bold text-[#A34828] mt-2">₹{totalExpected.toLocaleString()}</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Add Student Box */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E2DFD2]">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><UserPlus className="w-5 h-5" /> Add Student</h3>
                <form onSubmit={handleAddStudent} className="space-y-4">
                  <input
                    type="text"
                    placeholder="Student Name"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({...newStudent, name: e.target.value})}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A3C34]"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="Class (e.g. 10)"
                      value={newStudent.class}
                      onChange={(e) => setNewStudent({...newStudent, class: e.target.value})}
                      className="p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A3C34]"
                    />
                    <input
                      type="number"
                      placeholder="Monthly Fee (₹)"
                      value={newStudent.monthlyFee}
                      onChange={(e) => setNewStudent({...newStudent, monthlyFee: e.target.value})}
                      className="p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A3C34]"
                    />
                  </div>
                  <button type="submit" className="w-full bg-[#1A3C34] text-white py-3 rounded-xl font-medium hover:bg-[#2C4A3E] transition">Save Student</button>
                </form>
              </div>

              {/* Record Payment Box */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E2DFD2]">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Receipt className="w-5 h-5" /> Record Fee Payment</h3>
                <form onSubmit={handleAddDeposit} className="space-y-4">
                  <select
                    value={newDeposit.studentId}
                    onChange={(e) => setNewDeposit({...newDeposit, studentId: e.target.value})}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A3C34]"
                  >
                    <option value="">Select Student</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} (Class {s.class})</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Amount Paid (₹)"
                    value={newDeposit.amount}
                    onChange={(e) => setNewDeposit({...newDeposit, amount: e.target.value})}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A3C34]"
                  />
                  <button type="submit" className="w-full bg-[#2D5A27] text-white py-3 rounded-xl font-medium hover:bg-[#3d7a36] transition">Record Payment</button>
                </form>
              </div>
            </div>
          </div>
        ) : activeTab === 'students' ? (
          <div>
            <h2 className="text-3xl font-serif font-bold text-[#1A3C34] mb-6">Student Roster</h2>
            <div className="bg-white rounded-2xl border border-[#E2DFD2] overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#F4F1E8]">
                  <tr>
                    <th className="p-4 font-semibold text-sm">Name</th>
                    <th className="p-4 font-semibold text-sm">Class</th>
                    <th className="p-4 font-semibold text-sm">Batch</th>
                    <th className="p-4 font-semibold text-sm">Monthly Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id} className="border-t border-gray-100">
                      <td className="p-4 font-medium">{s.name}</td>
                      <td className="p-4">{s.class}</td>
                      <td className="p-4">{s.batch}</td>
                      <td className="p-4 font-semibold text-[#2D5A27]">₹{s.monthlyFee}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-3xl font-serif font-bold text-[#1A3C34] mb-6">Payment History</h2>
            <div className="bg-white rounded-2xl border border-[#E2DFD2] overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#F4F1E8]">
                  <tr>
                    <th className="p-4 font-semibold text-sm">Student</th>
                    <th className="p-4 font-semibold text-sm">Amount</th>
                    <th className="p-4 font-semibold text-sm">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((d) => (
                    <tr key={d.id} className="border-t border-gray-100">
                      <td className="p-4 font-medium">{d.studentName}</td>
                      <td className="p-4 font-semibold text-[#2D5A27]">₹{d.amount}</td>
                      <td className="p-4 text-sm text-gray-500">{d.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
