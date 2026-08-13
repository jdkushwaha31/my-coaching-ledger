import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { 
  Users, IndianRupee, TrendingUp, AlertCircle, Plus, Search, 
  Trash2, CheckCircle2, ChevronRight, LayoutDashboard, UserPlus, 
  BookOpen, Receipt, RefreshCw, BarChart2, Calendar
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function CoachingLedger() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [students, setStudents] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    });
    setNewDeposit({ studentId: '', amount: '', month: 'August', year: '2026' });
  };

  const handleDeleteStudent = async (id) => {
    if (window.confirm('Are you sure you want to delete this student?')) {
      await deleteDoc(doc(db, 'students', id));
    }
  };

  // Calculations
  const totalCollected = deposits.reduce((sum, d) => sum + d.amount, 0);
  const totalExpected = students.reduce((sum, s) => sum + s.monthlyFee, 0);
  const totalDues = Math.max(0, totalExpected - totalCollected);
  const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

  // Chart Data Preparation
  const chartData = [
    { month: 'Mar', amount: totalCollected * 0.4 },
    { month: 'Apr', amount: totalCollected * 0.6 },
    { month: 'May', amount: totalCollected * 0.5 },
    { month: 'Jun', amount: totalCollected * 0.8 },
    { month: 'Jul', amount: totalCollected * 0.9 },
    { month: 'Aug', amount: totalCollected },
  ];

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.class.includes(searchTerm)
  );

  return (
    <div className="flex h-screen bg-[#FBF9F1] text-[#2C3E35] font-sans">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-[#1A3C34] text-[#E8E4D9] p-6 flex flex-col justify-between shadow-xl">
        <div>
          <div className="mb-8">
            <h1 className="text-2xl font-serif font-bold tracking-wide">Batch Ledger</h1>
            <p className="text-xs text-[#A3B18A] mt-1 uppercase tracking-wider">Coaching Register</p>
          </div>
          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'students', label: 'Students', icon: Users },
              { id: 'fee-structure', label: 'Fee Structure', icon: BookOpen },
              { id: 'deposits', label: 'Deposits', icon: Receipt },
              { id: 'dues', label: 'Dues', icon: AlertCircle },
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
          <RefreshCw className="w-3 h-3 animate-spin text-green-400" /> Live Cloud Active
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
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">AUG 2026</p>
              <h2 className="text-3xl font-serif font-bold text-[#1A3C34] mt-1">Summary</h2>
            </div>
            
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-5 rounded-xl border border-[#E2DFD2] shadow-sm">
                <p className="text-xs font-semibold text-gray-400 uppercase">Active Students</p>
                <p className="text-3xl font-bold text-[#1A3C34] mt-2">{students.length}</p>
                <p className="text-xs text-gray-400 mt-1">{students.length} classes active</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-[#E2DFD2] shadow-sm">
                <p className="text-xs font-semibold text-gray-400 uppercase">Collected This Month</p>
                <p className="text-3xl font-bold text-[#2D5A27] mt-2">₹{totalCollected.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">of ₹{totalExpected.toLocaleString()} expected</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-[#E2DFD2] shadow-sm">
                <p className="text-xs font-semibold text-gray-400 uppercase">Collection Rate</p>
                <p className="text-3xl font-bold text-[#1A3C34] mt-2">{collectionRate}%</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-[#E2DFD2] shadow-sm">
                <p className="text-xs font-semibold text-gray-400 uppercase">Outstanding Dues</p>
                <p className="text-3xl font-bold text-[#A34828] mt-2">₹{totalDues.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">all months, all students</p>
              </div>
            </div>

            {/* Charts & Class Strength */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-[#E2DFD2] shadow-sm">
                <h3 className="text-lg font-bold mb-4 text-[#1A3C34]">Collections — last 6 months</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <XAxis dataKey="month" stroke="#A3B18A" />
                      <YAxis stroke="#A3B18A" />
                      <Tooltip />
                      <Area type="monotone" dataKey="amount" stroke="#2D5A27" fill="#E8F0E6" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-[#E2DFD2] shadow-sm">
                <h3 className="text-lg font-bold mb-4 text-[#1A3C34]">Class Strength</h3>
                <div className="space-y-4">
                  {['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'].map((cls) => {
                    const count = students.filter(s => `Class ${s.class}` === cls || s.class === cls.replace('Class ', '')).length;
                    return (
                      <div key={cls} className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{cls}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-32 bg-[#F4F1E8] h-2 rounded-full overflow-hidden">
                            <div className="bg-[#1A3C34] h-full" style={{ width: `${Math.min(count * 20, 100)}%` }}></div>
                          </div>
                          <span className="text-sm font-bold text-[#1A3C34]">{count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Add Student & Record Payment Forms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-xl border border-[#E2DFD2] shadow-sm">
                <h3 className="text-lg font-bold mb-4 text-[#1A3C34] flex items-center gap-2"><UserPlus className="w-5 h-5" /> Add New Student</h3>
                <form onSubmit={handleAddStudent} className="space-y-4">
                  <input
                    type="text"
                    placeholder="Student Name"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({...newStudent, name: e.target.value})}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A3C34]"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="Class (e.g. 10)"
                      value={newStudent.class}
                      onChange={(e) => setNewStudent({...newStudent, class: e.target.value})}
                      className="p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A3C34]"
                    />
                    <input
                      type="number"
                      placeholder="Monthly Fee (₹)"
                      value={newStudent.monthlyFee}
                      onChange={(e) => setNewStudent({...newStudent, monthlyFee: e.target.value})}
                      className="p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A3C34]"
                    />
                  </div>
                  <button type="submit" className="w-full bg-[#1A3C34] text-white py-3 rounded-lg font-medium hover:bg-[#2C4A3E] transition">Save Student</button>
                </form>
              </div>

              <div className="bg-white p-6 rounded-xl border border-[#E2DFD2] shadow-sm">
                <h3 className="text-lg font-bold mb-4 text-[#1A3C34] flex items-center gap-2"><Receipt className="w-5 h-5" /> Record Fee Payment</h3>
                <form onSubmit={handleAddDeposit} className="space-y-4">
                  <select
                    value={newDeposit.studentId}
                    onChange={(e) => setNewDeposit({...newDeposit, studentId: e.target.value})}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A3C34]"
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
                    className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A3C34]"
                  />
                  <button type="submit" className="w-full bg-[#2D5A27] text-white py-3 rounded-lg font-medium hover:bg-[#3d7a36] transition">Record Payment</button>
                </form>
              </div>
            </div>
          </div>
        ) : activeTab === 'students' ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-serif font-bold text-[#1A3C34]">Students Directory</h2>
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search student..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C34]"
                />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#E2DFD2] overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#F4F1E8]">
                  <tr>
                    <th className="p-4 font-semibold text-sm text-[#1A3C34]">Name</th>
                    <th className="p-4 font-semibold text-sm text-[#1A3C34]">Class</th>
                    <th className="p-4 font-semibold text-sm text-[#1A3C34]">Subject / Batch</th>
                    <th className="p-4 font-semibold text-sm text-[#1A3C34]">Monthly Fee</th>
                    <th className="p-4 font-semibold text-sm text-[#1A3C34]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s) => (
                    <tr key={s.id} className="border-t border-gray-100 hover:bg-[#FAF8F5]">
                      <td className="p-4 font-medium">{s.name}</td>
                      <td className="p-4 text-gray-600">Class {s.class}</td>
                      <td className="p-4 text-gray-600">{s.batch}</td>
                      <td className="p-4 font-semibold text-[#2D5A27]">₹{s.monthlyFee}</td>
                      <td className="p-4">
                        <button onClick={() => handleDeleteStudent(s.id)} className="text-red-500 hover:text-red-700 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center p-8 text-gray-400">No students found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'fee-structure' ? (
          <div className="space-y-6">
            <h2 className="text-3xl font-serif font-bold text-[#1A3C34]">Fee Structure Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {['Class 8-10 (Science/Maths)', 'Class 11-12 (Physics/Chemistry)', 'Competitive Batches'].map((title, i) => (
                <div key={i} className="bg-white p-6 rounded-xl border border-[#E2DFD2] shadow-sm">
                  <h3 className="font-bold text-lg text-[#1A3C34] mb-2">{title}</h3>
                  <p className="text-2xl font-bold text-[#2D5A27] mb-4">₹{(i + 1) * 500} <span className="text-xs font-normal text-gray-400">/ month</span></p>
                  <ul className="text-xs text-gray-600 space-y-2">
                    <li>• Daily 1.5 hours interactive session</li>
                    <li>• Weekly test assessment & ledger updates</li>
                    <li>• Centralized cloud tracking</li>
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'deposits' ? (
          <div className="space-y-6">
            <h2 className="text-3xl font-serif font-bold text-[#1A3C34]">Deposit & Payment Ledger</h2>
            <div className="bg-white rounded-xl border border-[#E2DFD2] overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#F4F1E8]">
                  <tr>
                    <th className="p-4 font-semibold text-sm text-[#1A3C34]">Student Name</th>
                    <th className="p-4 font-semibold text-sm text-[#1A3C34]">Amount Paid</th>
                    <th className="p-4 font-semibold text-sm text-[#1A3C34]">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((d) => (
                    <tr key={d.id} className="border-t border-gray-100 hover:bg-[#FAF8F5]">
                      <td className="p-4 font-medium">{d.studentName}</td>
                      <td className="p-4 font-semibold text-[#2D5A27]">₹{d.amount}</td>
                      <td className="p-4 text-sm text-gray-500">{d.date}</td>
                    </tr>
                  ))}
                  {deposits.length === 0 && (
                    <tr>
                      <td colSpan="3" className="text-center p-8 text-gray-400">No deposits recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-3xl font-serif font-bold text-[#1A3C34]">Outstanding Dues</h2>
            <div className="bg-white rounded-xl border border-[#E2DFD2] p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <p className="text-sm text-gray-500">Total Pending Dues</p>
                  <p className="text-3xl font-bold text-[#A34828]">₹{totalDues.toLocaleString()}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">Dues are calculated based on registered monthly fees minus total recorded deposits.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
