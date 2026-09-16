import { useEffect, useState } from "react";
import { db } from "./firebase";
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { Archive, BookOpen, GraduationCap, Landmark, LayoutGrid, Lock, LogOut, Menu, Settings, UserCog, Users, X } from "lucide-react";
import { AttendanceFormModal } from "./components/academic/AttendanceTabs";
import { BehaviourFormModal } from "./components/academic/BehaviourTab";
import { AcademicMonitoringTab } from "./components/academic/PerformanceReports";
import { TestScoreFormModal } from "./components/academic/ScoresTabs";
import { BankTxnFormModal, BankTxnReceiptModal, CreditFormModal, CreditReceiptModal, InterestReceiptModal, PayInterestModal } from "./components/banking/BankingModals";
import { BankingTab } from "./components/banking/BankingTab";
import { DashboardTab } from "./components/dashboard/DashboardTab";
import { ChargeReceiptModal, DepositFormModal, ExpenseFormModal, ExpenseReceiptModal, ReceiptModal } from "./components/fees/FeeModals";
import { NoteFormModal } from "./components/notes/NoteFormModal";
import { NotesTab } from "./components/notes/NotesTab";
import { SettingsModal } from "./components/settings/SettingsModal";
import { BatchScheduleFormModal } from "./components/staff/BatchScheduleTab";
import { InfrastructureFormModal } from "./components/staff/InfrastructureTab";
import { AdvanceFormModal, AdvanceReturnFormModal, PersonStatementModal, SalaryFormModal, SalarySlipModal } from "./components/staff/SalaryAdvanceTab";
import { StaffFormModal } from "./components/staff/StaffTab";
import { TeacherFormModal, TeacherManagementTab, TeacherStatusModal } from "./components/staff/TeachersTab";
import { StaffJoiningFormModal } from "./components/staff/JoiningFormModal";
import { AcademicHistoryModal, AddChargeModal, BatchChangeModal, ExitStudentModal, JoiningFormModal, PromoteModal, StudentFormModal, StudentStatementModal } from "./components/students/StudentModals";
import { StudentManagementTab } from "./components/students/StudentsTab";
import { TrashTab } from "./components/trash/TrashTab";
import { APP_PASSWORD, DEFAULT_CLASSES, DEFAULT_SUBJECTS, EXIT_REASONS, FONT_IMPORT, STREAMS } from "./constants/appConstants";
import { DEFAULT_INSTITUTE_SETTINGS, InstituteSettingsContext } from "./contexts/InstituteSettingsContext";
import { addMonths, compareChrono, currentMonthKey, monthLabel, monthsBetween, nowStamp, todayStr } from "./lib/dates";
import { allocateAdvancePayoff, computeStudentLedger, defaultFeeStructure, mergeStaffAndTeachers } from "./lib/finance";
import { generateAdvanceId, generateAdvanceReturnId, generateSalaryId, generateStaffId, generateStudentId, generateTeacherId, generateTestId, getReceiptNo, shortId, uid } from "./lib/ids";
import { fmtINR, round2 } from "./lib/money";

export default function CoachingLedger() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem("ledger_auth") === "true");
  const [passInput, setPassInput] = useState("");
  const [passError, setPassError] = useState(false);

  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("dashboard");
  // Mobile navigation drawer — the sidebar is permanently visible on
  // desktop (md and up) but becomes an off-canvas drawer on phone/tablet
  // screens, toggled by a hamburger button in a small top bar that only
  // renders below md. Closes automatically whenever a nav item is picked
  // so it doesn't stay open over the newly-selected tab's content.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState(DEFAULT_CLASSES);
  const [subjectsList, setSubjectsList] = useState(DEFAULT_SUBJECTS);
  const [streams, setStreams] = useState(STREAMS);
  const [feeStructure, setFeeStructure] = useState({});
  const [deposits, setDeposits] = useState([]);
  const [charges, setCharges] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [bankTransactions, setBankTransactions] = useState([]);
  const [creditTransactions, setCreditTransactions] = useState([]);
  const [interestPayments, setInterestPayments] = useState([]);
  // Internal Notes / notepad — free-form notes staff can jot down (office
  // reminders, follow-ups, things to remember) that aren't tied to any
  // student or transaction. Same live-cloud-sync pattern as everything
  // else in the app (see NotesTab / addNote / updateNote / deleteNote /
  // toggleNotePin below).
  const [notes, setNotes] = useState([]);
  // Academic Monitoring — Attendance, Test Scores, and Behaviour & Conduct
  // records. Each is its own Firestore collection, synced live via
  // onSnapshot exactly like every other collection above, and each
  // supports the same soft-delete + Trash/Restore pattern (see
  // AttendanceTab / TestScoresTab / BehaviourTab and the
  // saveAttendance / saveTestScore / saveBehaviourNote functions below).
  const [attendance, setAttendance] = useState([]);
  const [testScores, setTestScores] = useState([]);
  const [behaviourNotes, setBehaviourNotes] = useState([]);

  // Teacher Management / Batch Schedule / Staff / Attendance / Test Marks —
  // five new Firestore collections, same live-sync + soft-delete pattern
  // as everything above (see UPDATE NOTES #23). NOTE: this "attendanceLog"
  // collection is deliberately a different name from the existing
  // "attendance" collection above, which powers the older per-student
  // Academic Monitoring → Attendance sub-tab — the two are unrelated and
  // must not collide.
  const [teachers, setTeachers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [batchSchedule, setBatchSchedule] = useState([]);
  const [attendanceLog, setAttendanceLog] = useState([]);
  const [tests, setTests] = useState([]);
  const [infrastructure, setInfrastructure] = useState([]);
  // Salary / Advance — two new Firestore collections, same live-sync +
  // soft-delete pattern as teachers/staff above (see UPDATE NOTES #24).
  const [salaryPayments, setSalaryPayments] = useState([]);
  const [advances, setAdvances] = useState([]);
  // Advance Returns — a teacher/staff member directly handing back advance
  // money outside of a salary run. Same live-sync + soft-delete pattern as
  // every other collection above. See the new UPDATE NOTES entry for the
  // "Return Advance" feature.
  const [advanceReturns, setAdvanceReturns] = useState([]);

  const [showStudentForm, setShowStudentForm] = useState(false);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(null);
  const [showExitModal, setShowExitModal] = useState(null);
  const [showBatchChangeModal, setShowBatchChangeModal] = useState(null);
  const [showChargeModal, setShowChargeModal] = useState(null); // { student } or { student: null } for picker
  const [showStatementModal, setShowStatementModal] = useState(null);
  const [showJoiningForm, setShowJoiningForm] = useState(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showBankTxnForm, setShowBankTxnForm] = useState(false);
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [showPayInterestModal, setShowPayInterestModal] = useState(null); // credit transaction
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [showAttendanceForm, setShowAttendanceForm] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState(null);
  const [showTestScoreForm, setShowTestScoreForm] = useState(false);
  const [editingTestScore, setEditingTestScore] = useState(null);
  const [showBehaviourForm, setShowBehaviourForm] = useState(false);
  const [editingBehaviour, setEditingBehaviour] = useState(null);
  const [showTeacherForm, setShowTeacherForm] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  // { teacher, newStatus } while the dedicated Deactivate/Reactivate modal
  // (date + remarks) is open — separate from the Add/Edit Teacher form.
  const [showTeacherStatusModal, setShowTeacherStatusModal] = useState(null);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [editingStaffMember, setEditingStaffMember] = useState(null);
  const [showPersonJoiningForm, setShowPersonJoiningForm] = useState(null); // { person, personType }
  const [showBatchScheduleForm, setShowBatchScheduleForm] = useState(false);
  const [editingBatchSchedule, setEditingBatchSchedule] = useState(null);
  const [showInfrastructureForm, setShowInfrastructureForm] = useState(false);
  const [editingInfrastructure, setEditingInfrastructure] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [expenseReceiptData, setExpenseReceiptData] = useState(null);
  const [chargeReceiptData, setChargeReceiptData] = useState(null); // { line, student }
  const [bankTxnReceiptData, setBankTxnReceiptData] = useState(null);
  const [creditReceiptData, setCreditReceiptData] = useState(null);
  const [interestReceiptData, setInterestReceiptData] = useState(null); // { payment, creditTxn }
  // Salary / Advance modal state — same shape/naming convention as the
  // other form + receipt state above (see UPDATE NOTES #24).
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [salarySlipData, setSalarySlipData] = useState(null); // salaryPayments record to print/reprint
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [showAdvanceReturnForm, setShowAdvanceReturnForm] = useState(false);
  const [showPersonStatement, setShowPersonStatement] = useState(null); // { personId, personType }
  const [instituteSettings, setInstituteSettings] = useState(DEFAULT_INSTITUTE_SETTINGS);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

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

    const unsubBankTxns = onSnapshot(collection(db, "bankTransactions"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, deleted: false, ...doc.data() }));
      setBankTransactions(data);
    });

    const unsubCreditTxns = onSnapshot(collection(db, "creditTransactions"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, deleted: false, ...doc.data() }));
      setCreditTransactions(data);
    });

    const unsubInterestPayments = onSnapshot(collection(db, "interestPayments"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, deleted: false, ...doc.data() }));
      setInterestPayments(data);
    });

    const unsubNotes = onSnapshot(collection(db, "notes"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, deleted: false, ...doc.data() }));
      setNotes(data);
    });

    // Academic Monitoring collections — same live-sync pattern as every
    // other collection above.
    const unsubAttendance = onSnapshot(collection(db, "attendance"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, deleted: false, ...doc.data() }));
      setAttendance(data);
    });

    const unsubTestScores = onSnapshot(collection(db, "testScores"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, deleted: false, ...doc.data() }));
      setTestScores(data);
    });

    const unsubBehaviourNotes = onSnapshot(collection(db, "behaviourNotes"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, deleted: false, ...doc.data() }));
      setBehaviourNotes(data);
    });

    // Teacher Management / Batch Schedule / Staff / Attendance / Test Marks
    // collections — same live-sync pattern as every collection above.
    const unsubTeachers = onSnapshot(collection(db, "teachers"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, deleted: false, ...doc.data() }));
      setTeachers(data);
    });
    const unsubStaff = onSnapshot(collection(db, "staff"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, deleted: false, ...doc.data() }));
      setStaff(data);
    });
    // Salary / Advance — same live-sync pattern as every collection above
    // (see UPDATE NOTES #24).
    const unsubSalaryPayments = onSnapshot(collection(db, "salaryPayments"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, deleted: false, ...doc.data() }));
      setSalaryPayments(data);
    });
    const unsubAdvances = onSnapshot(collection(db, "advances"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, deleted: false, ...doc.data() }));
      setAdvances(data);
    });
    // Advance Returns — same live-sync pattern as every collection above.
    const unsubAdvanceReturns = onSnapshot(collection(db, "advanceReturns"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, deleted: false, ...doc.data() }));
      setAdvanceReturns(data);
    });
    const unsubBatchSchedule = onSnapshot(collection(db, "batchSchedule"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBatchSchedule(data);
    });
    const unsubAttendanceLog = onSnapshot(collection(db, "attendanceLog"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAttendanceLog(data);
    });
    const unsubTests = onSnapshot(collection(db, "tests"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTests(data);
    });
    // Infrastructure Management — rooms/areas registry (Institute
    // Management → Infrastructure Management). Same live-sync pattern as
    // batchSchedule/tests above; no soft-delete/Trash for this collection,
    // same as those two.
    const unsubInfrastructure = onSnapshot(collection(db, "infrastructure"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInfrastructure(data);
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

    // Streams / academic tracks — same pattern as Classes & Subjects above,
    // stored under settings/streamList so Add/Delete Stream (Fee & Class
    // Structure → Manage Streams) persists and immediately reflects in the
    // Add Student form's Stream dropdown for every user.
    const unsubStreams = onSnapshot(doc(db, "settings", "streamList"), (docSnap) => {
      if (docSnap.exists()) {
        setStreams(docSnap.data().list || STREAMS);
      } else {
        setDoc(doc(db, "settings", "streamList"), { list: STREAMS });
      }
    });

    // Institute Settings — Name/Tagline/Address/Phone/GST shown on every
    // printed document (see InstituteHeader / InstituteSettingsContext).
    // Same settings/<key> doc pattern as classList/subjectList/streamList
    // above; falls back to DEFAULT_INSTITUTE_SETTINGS (the same
    // placeholder every print template already showed) until set.
    const unsubInstituteSettings = onSnapshot(doc(db, "settings", "institute"), (docSnap) => {
      if (docSnap.exists()) {
        setInstituteSettings({ ...DEFAULT_INSTITUTE_SETTINGS, ...docSnap.data() });
      } else {
        setInstituteSettings(DEFAULT_INSTITUTE_SETTINGS);
      }
    });

    return () => {
      unsubStudents(); unsubDeposits(); unsubCharges(); unsubExpenses(); unsubBankTxns();
      unsubCreditTxns(); unsubInterestPayments(); unsubNotes();
      unsubAttendance(); unsubTestScores(); unsubBehaviourNotes();
      unsubTeachers(); unsubStaff(); unsubSalaryPayments(); unsubAdvances(); unsubAdvanceReturns(); unsubBatchSchedule(); unsubAttendanceLog(); unsubTests(); unsubInfrastructure();
      unsubFee(); unsubClasses(); unsubSubjects(); unsubStreams(); unsubInstituteSettings();
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#12312B", fontFamily: "'Inter', sans-serif" }}>
        <style>{FONT_IMPORT}</style>
        <div className="bg-[#FAF6EC] p-8 rounded-sm shadow-2xl max-w-md w-full border-2" style={{ borderColor: "#B8862B" }}>
          <div className="flex justify-center mb-3 text-[#12312B]"><Lock size={32} /></div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-2xl font-bold text-[#12312B] text-center">InstituteOS</div>
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
    // BUG FIX: a student with ZERO subjects/batches selected must be
    // charged ₹0 tuition — not the 1-subject fee matrix rate. The old
    // code did `batchCount || 1`, so a batchCount of 0 (falsy) silently
    // fell through to 1, and this student got billed as if they'd taken
    // a single subject they were never actually enrolled in. Now a
    // batchCount of 0 (or anything not a positive number) returns ₹0
    // straight away, before the fee matrix is ever consulted. Any real
    // subject count (1–6) still looks itself up exactly as before.
    const count = Number(batchCount) || 0;
    if (count <= 0) return 0;
    const bc = Math.max(1, Math.min(6, count));
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
  // Signed version of the same figure — negative when a student has paid
  // in advance / overpaid. Only the Students Register "Total Due" column
  // reads this; every other total in the app keeps using the clamped
  // studentDuesMap above so nothing else changes behavior.
  const studentDuesRawMap = {};
  visibleStudents.forEach(st => { studentDuesRawMap[st.id] = ledgers[st.id].rawBalance; });

  const totalOutstanding = round2(Object.values(studentDuesMap).reduce((a, v) => a + v, 0));

  // Master charges feed — every debit line (Opening Balance, Tuition Fee
  // accruals, and Additional Charges) for every student, merged into one
  // list. Powers the consolidated "Charges" tab, which tracks all student
  // charges rather than just ad-hoc Additional Charges.
  const allChargeLines = visibleStudents.flatMap(st =>
    (ledgers[st.id]?.chargeLines || []).map(l => ({
      ...l, studentId: st.id, studentName: st.name, studentClass: st.class, studentStatus: st.status || "active",
    }))
  ).sort((a, b) => compareChrono(a, b, -1));

  // Cash vs. Online split — "Cash" is its own bucket; UPI / Bank Transfer /
  // Cheque are all treated as "Online" for the balance tracker & tiles.
  function paymentModeOf(x) { return x.mode || "Cash"; }
  const cashCollected = round2(visibleDeposits.filter(d => paymentModeOf(d) === "Cash").reduce((a, d) => a + Number(d.amount || 0), 0));
  const onlineCollected = round2(visibleDeposits.filter(d => paymentModeOf(d) !== "Cash").reduce((a, d) => a + Number(d.amount || 0), 0));
  const cashExpensesTotal = round2(visibleExpenses.filter(e => paymentModeOf(e) === "Cash").reduce((a, e) => a + Number(e.amount || 0), 0));
  const onlineExpensesTotal = round2(visibleExpenses.filter(e => paymentModeOf(e) !== "Cash").reduce((a, e) => a + Number(e.amount || 0), 0));
  const totalExpenses = round2(cashExpensesTotal + onlineExpensesTotal);

  // Center-wide statement — every ledger line (tuition, additional charges,
  // payments, write-offs) from every student, merged into one master feed.
  // NOTE: Expenses deliberately do NOT appear here any more — they live
  // exclusively in the dedicated Banking Statement below, since they are
  // money movement for the center, not a student-facing charge/payment.
  const allTransactions = visibleStudents.flatMap(st =>
    (ledgers[st.id]?.timeline || []).map(l => ({
      ...l,
      studentId: st.id, studentName: st.name, studentClass: st.class, studentStatus: st.status || "active",
    }))
  ).sort((a, b) => compareChrono(a, b, -1));

  const centerTotals = {
    charged: round2(Object.values(ledgers).reduce((a, l) => a + l.totalCharged, 0)),
    collected: round2(visibleDeposits.reduce((a, d) => a + Number(d.amount || 0), 0)),
    writtenOff: round2(visibleDeposits.reduce((a, d) => a + Number(d.writeOffAmount || 0), 0)),
    outstanding: totalOutstanding,
  };

  // ============================================================================
  // BANKING LEDGER — the dedicated feed for the Banking tab. Combines every
  // student deposit (money in), every center expense (money out), and every
  // internal Cash ⇄ Bank transfer, into one chronological statement with a
  // running Cash Balance and Bank Balance after every single line. This is
  // the only place Expenses appear now, and the only place Cash⇄Bank
  // transfers ever appear — they never touch the Center Statement because
  // no student charge/payment or center expense actually happened.
  // ============================================================================
  const visibleBankTxns = bankTransactions.filter(t => !t.deleted);
  const trashedBankTxns = bankTransactions.filter(t => t.deleted);
  const visibleCreditTxns = creditTransactions.filter(c => !c.deleted);
  const trashedCreditTxns = creditTransactions.filter(c => c.deleted);
  const visibleInterestPayments = interestPayments.filter(p => !p.deleted);
  const trashedInterestPayments = interestPayments.filter(p => p.deleted);
  const creditTxnById = Object.fromEntries(creditTransactions.map(c => [c.id, c]));

  // Notes — not part of the financial ledger at all, just a simple internal
  // notepad. Pinned notes always float to the top; everything else sorts
  // by most-recently-updated first.
  const visibleNotes = [...notes.filter(n => !n.deleted)].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || "");
  });

  // Academic Monitoring — Attendance, Test Scores, Behaviour & Conduct.
  // Same visible/trashed split as every other collection above.
  const visibleAttendance = attendance.filter(a => !a.deleted);
  const trashedAttendance = attendance.filter(a => a.deleted);
  const visibleTestScores = testScores.filter(t => !t.deleted);
  const trashedTestScores = testScores.filter(t => t.deleted);
  const visibleBehaviourNotes = behaviourNotes.filter(b => !b.deleted);
  const trashedBehaviourNotes = behaviourNotes.filter(b => b.deleted);

  // Teacher Management / Batch Schedule / Staff / Attendance / Test Marks —
  // Teachers and Staff follow the same soft-delete + Trash pattern as
  // students. Batch Schedule, Attendance, and Test Marks records don't get
  // a trash bin (see UPDATE NOTES #23) — batchSchedule/attendanceLog/tests
  // are used as-is.
  const visibleTeachers = teachers.filter(t => !t.deleted);
  const trashedTeachers = teachers.filter(t => t.deleted);
  const visibleStaff = staff.filter(s => !s.deleted);
  const trashedStaff = staff.filter(s => s.deleted);
  const teacherById = Object.fromEntries(teachers.map(t => [t.id, t]));
  const staffById = Object.fromEntries(staff.map(s => [s.id, s]));
  // Salary / Advance — same visible/trashed split as every other
  // collection (see UPDATE NOTES #24).
  const visibleSalaryPayments = salaryPayments.filter(p => !p.deleted);
  const trashedSalaryPayments = salaryPayments.filter(p => p.deleted);
  const visibleAdvances = advances.filter(a => !a.deleted);
  const trashedAdvances = advances.filter(a => a.deleted);
  // Advance Returns — same visible/trashed split as every other collection.
  const visibleAdvanceReturns = advanceReturns.filter(r => !r.deleted);
  const trashedAdvanceReturns = advanceReturns.filter(r => r.deleted);

  const totalWithdrawals = round2(visibleBankTxns.filter(t => t.type === "withdrawal").reduce((a, t) => a + Number(t.amount || 0), 0));
  const totalBankDeposits = round2(visibleBankTxns.filter(t => t.type === "deposit").reduce((a, t) => a + Number(t.amount || 0), 0));

  const totalCreditTaken = round2(visibleCreditTxns.filter(c => c.direction === "taken").reduce((a, c) => a + Number(c.amount || 0), 0));
  const totalCreditGiven = round2(visibleCreditTxns.filter(c => c.direction === "given").reduce((a, c) => a + Number(c.amount || 0), 0));
  const totalInterestPaid = round2(visibleInterestPayments.reduce((a, p) => a + Number(p.amount || 0), 0));
  // Interest paid so far against each individual credit entry — used to
  // show a running "Interest Paid" figure on each row of the Credit Ledger.
  const interestPaidByCreditId = {};
  visibleInterestPayments.forEach(p => {
    interestPaidByCreditId[p.creditTxnId] = round2((interestPaidByCreditId[p.creditTxnId] || 0) + Number(p.amount || 0));
  });

  const bankingDepositLines = visibleDeposits.filter(d => Number(d.amount) > 0).map(d => {
    const st = studentById[d.studentId];
    const isCash = paymentModeOf(d) === "Cash";
    return {
      id: `${d.id}-bdep`, refId: getReceiptNo(d.id), source: "deposit", depositId: d.id, studentId: d.studentId,
      type: "deposit", kind: "credit", bucket: isCash ? "cash" : "bank",
      date: d.date || todayStr(), createdAt: d.createdAt || "",
      label: `Student Deposit — ${st ? st.name : "Unknown Student"}${st ? " (" + st.class + ")" : ""}`,
      remarks: d.remarks || "", amount: round2(d.amount), mode: d.mode || "Cash",
    };
  });

  const bankingExpenseLines = visibleExpenses.map(e => {
    const isCash = paymentModeOf(e) === "Cash";
    return {
      id: `${e.id}-bexp`, refId: e.expenseId || `EXP-${shortId(e.id)}`, source: "expense", expenseRowId: e.id,
      type: "expense", kind: "debit", bucket: isCash ? "cash" : "bank",
      date: e.date || todayStr(), createdAt: e.createdAt || "",
      label: (e.category ? `Expense — ${e.category}` : "Expense") + (e.paidTo ? ` (Paid to: ${e.paidTo})` : ""),
      remarks: e.remarks || "", amount: round2(e.amount), mode: e.mode || "Cash",
    };
  });

  const bankingTransferLines = visibleBankTxns.map(t => ({
    id: `${t.id}-btxn`, refId: t.txnId, source: "banktxn", bankTxnId: t.id,
    type: t.type === "withdrawal" ? "bank_withdrawal" : "bank_deposit",
    kind: "transfer", bucket: "both",
    date: t.date || todayStr(), createdAt: t.createdAt || "",
    label: t.type === "withdrawal" ? "Cash Withdrawal from Bank" : "Cash Deposited to Bank",
    remarks: t.remarks || "", amount: round2(t.amount), mode: "—",
    cashDelta: t.type === "withdrawal" ? round2(t.amount) : -round2(t.amount),
    bankDelta: t.type === "withdrawal" ? -round2(t.amount) : round2(t.amount),
  }));

  // Credit / Loan lines — "taken" (borrowed) brings money IN, "given"
  // (lent) sends money OUT, landing in Cash or Bank depending on mode.
  const bankingCreditLines = visibleCreditTxns.map(c => {
    const isCash = (c.mode || "Cash") === "Cash";
    const isTaken = c.direction === "taken";
    return {
      id: `${c.id}-credit`, refId: c.creditId, source: "credit", creditTxnId: c.id,
      type: isTaken ? "credit_taken" : "credit_given", kind: isTaken ? "credit" : "debit", bucket: isCash ? "cash" : "bank",
      date: c.date || todayStr(), createdAt: c.createdAt || "",
      label: `${isTaken ? "Credit Taken from" : "Credit Given to"} ${c.partyName || "Unknown"}`,
      remarks: c.remarks || "", amount: round2(c.amount), mode: c.mode || "Cash",
    };
  });

  // Interest we pay against a Credit Taken entry — always money OUT.
  const bankingInterestLines = visibleInterestPayments.map(p => {
    const isCash = (p.mode || "Cash") === "Cash";
    const creditTxn = creditTxnById[p.creditTxnId];
    return {
      id: `${p.id}-interest`, refId: p.paymentId, source: "interest", interestPaymentId: p.id, creditTxnId: p.creditTxnId,
      type: "interest_payment", kind: "debit", bucket: isCash ? "cash" : "bank",
      date: p.date || todayStr(), createdAt: p.createdAt || "",
      label: `Interest Paid — ${creditTxn ? creditTxn.partyName : "Unknown"}`,
      remarks: p.remarks || "", amount: round2(p.amount), mode: p.mode || "Cash",
    };
  });

  // Salary payments — money actually handed over right now (baseAmount
  // minus whatever was already deducted as an advance settlement). If the
  // full base salary was absorbed by an advance deduction, netPaid is 0
  // and no cash/bank actually moved, so no DEBIT line is created for that
  // payment (see UPDATE NOTES #24) — but see bankingSalarySettlementLines
  // just below, which makes sure the settlement itself is still visible
  // even then (see UPDATE NOTES entry for the advance-settlement fix).
  const bankingSalaryLines = visibleSalaryPayments.filter(p => Number(p.netPaid) > 0).map(p => {
    const isCash = (p.mode || "Cash") === "Cash";
    return {
      id: `${p.id}-salary`, refId: p.slipId, source: "salary", salaryPaymentId: p.id,
      type: "salary_payment", kind: "debit", bucket: isCash ? "cash" : "bank",
      date: p.date || todayStr(), createdAt: p.createdAt || "",
      label: `Staff Salary — ${p.personName || "Unknown"} (${monthLabel(p.month)})`,
      remarks: p.remarks || "", amount: round2(p.netPaid), mode: p.mode || "Cash",
    };
  });

  // BUG FIX — a salary payment that settled an advance (whether or not it
  // left any cash actually changing hands, i.e. even when netPaid is 0 and
  // no bankingSalaryLines debit is created above) previously left no trace
  // at all in the Banking Statement. One "memo" line per advance actually
  // settled by a salary payment (matches PersonStatementModal's
  // settlementLines breakdown exactly, so the two always agree), kind:
  // "memo" — the cash movement already happened when the advance was
  // originally given (bankingAdvanceLines), so this line must NOT move
  // runningCash/runningBank again; see the memo branch in the running-
  // balance pass below. See UPDATE NOTES entry for the advance-settlement
  // fix.
  const bankingSalarySettlementLines = visibleSalaryPayments.flatMap(p =>
    (p.settledAdvances || []).map((s, idx) => ({
      id: `${p.id}-salary-settle-${idx}`, refId: p.slipId, source: "salary", salaryPaymentId: p.id,
      type: "advance_settled", kind: "memo", bucket: (p.mode || "Cash") === "Cash" ? "cash" : "bank",
      date: p.date || todayStr(), createdAt: p.createdAt || "",
      label: `Advance Settled via Salary ${p.slipId}${s.advanceRefId ? ` (${s.advanceRefId})` : ""} — ${fmtINR(s.amount)}`,
      remarks: p.remarks || "", amount: round2(s.amount), mode: p.mode || "Cash",
    }))
  );

  // Advances given — always money OUT, the moment the advance is given.
  const bankingAdvanceLines = visibleAdvances.map(a => {
    const isCash = (a.mode || "Cash") === "Cash";
    return {
      id: `${a.id}-advance`, refId: a.advanceId, source: "advance", advanceId: a.id,
      type: "advance_given", kind: "debit", bucket: isCash ? "cash" : "bank",
      date: a.date || todayStr(), createdAt: a.createdAt || "",
      label: `Staff Advance — ${a.personName || "Unknown"}`,
      remarks: a.remarks || "", amount: round2(a.amount), mode: a.mode || "Cash",
    };
  });

  // Advances returned — real money coming back IN, the opposite direction
  // of bankingAdvanceLines above. See UPDATE NOTES entry for the new
  // "Return Advance" feature.
  const bankingAdvanceReturnLines = visibleAdvanceReturns.map(r => {
    const isCash = (r.mode || "Cash") === "Cash";
    return {
      id: `${r.id}-advreturn`, refId: r.returnId, source: "advanceReturn", advanceReturnId: r.id,
      type: "advance_returned", kind: "credit", bucket: isCash ? "cash" : "bank",
      date: r.date || todayStr(), createdAt: r.createdAt || "",
      label: `Advance Returned — ${r.personName || "Unknown"}`,
      remarks: r.remarks || "", amount: round2(r.amount), mode: r.mode || "Cash",
    };
  });

  // Ascending pass (oldest first) to compute the running Cash / Bank balance
  // at each line — this is what makes "two balances with every transaction"
  // work correctly regardless of what order the statement is displayed in.
  const bankingFeedAsc = [...bankingDepositLines, ...bankingExpenseLines, ...bankingTransferLines, ...bankingCreditLines, ...bankingInterestLines, ...bankingSalaryLines, ...bankingSalarySettlementLines, ...bankingAdvanceLines, ...bankingAdvanceReturnLines]
    .sort((a, b) => compareChrono(a, b, 1) || (a.kind === "credit" ? -1 : 1));

  let runningCash = 0, runningBank = 0;
  const bankingFeed = bankingFeedAsc.map(t => {
    if (t.kind === "transfer") {
      runningCash = round2(runningCash + t.cashDelta);
      runningBank = round2(runningBank + t.bankDelta);
    } else if (t.kind === "memo") {
      // Zero-cash-impact line (e.g. an advance settled via salary) — the
      // cash movement already happened elsewhere, so runningCash/
      // runningBank are deliberately left untouched here; the line still
      // shows the same running balance value in and out.
    } else if (t.bucket === "cash") {
      runningCash = round2(runningCash + (t.kind === "credit" ? t.amount : -t.amount));
    } else {
      runningBank = round2(runningBank + (t.kind === "credit" ? t.amount : -t.amount));
    }
    return { ...t, cashBalance: runningCash, bankBalance: runningBank };
  }).sort((a, b) => compareChrono(a, b, -1)); // newest first for display

  const bankingCashBalance = runningCash;
  const bankingBankBalance = runningBank;

  // Dashboard "Net Liquidity" balances — FIX: previously computed as just
  // (deposits collected − expenses), which silently ignored money moved by
  // Cash⇄Bank transfers, Credit/Loan entries, and Interest payments, so the
  // Dashboard could show a different (wrong) number than the Banking tab.
  // Now sourced from the exact same running balance the Banking Statement
  // uses, so both screens always agree.
  const totalCashBalance = bankingCashBalance;
  const totalOnlineBalance = bankingBankBalance;

  const bankingTotals = {
    cashBalance: bankingCashBalance,
    bankBalance: bankingBankBalance,
    totalDeposits: round2(cashCollected + onlineCollected),
    totalExpenses: totalExpenses,
    totalWithdrawals, totalBankDeposits,
    totalCreditTaken, totalCreditGiven, totalInterestPaid,
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

  const recentDeposits = [...visibleDeposits].sort((a, b) => compareChrono(a, b, -1)).slice(0, 8);

  // Fee forecast — "how much will be charged in month X" across active
  // students (tuition) plus any additional charges already logged for X.
  function forecastForMonth(month) {
    const rows = [];
    activeStudents.forEach(st => {
      if (!st.admissionMonth || st.admissionMonth > month) return;
      const batches = batchesForMonth(st, month);
      // Same fix as computeStudentLedger() above — a subject-less student
      // must forecast ₹0, not the 1-subject rate.
      const bc = batches.length;
      const expected = expectedFeeFor(st.class, bc, st.monthlyDiscount || 0);
      if (expected > 0) rows.push({ student: st, batches, expected });
    });
    const extra = visibleCharges.filter(c => c.month === month);
    const tuitionTotal = round2(rows.reduce((a, r) => a + r.expected, 0));
    const extraTotal = round2(extra.reduce((a, c) => a + Number(c.amount || 0), 0));
    return { rows, extra, tuitionTotal, extraTotal, total: round2(tuitionTotal + extraTotal) };
  }

  // ---- Student lifecycle actions ----
  async function saveStudent(data) {
    const id = data.id || uid();
    // Every student gets a permanent, human-readable Student ID. If this is
    // an existing record that already has one (or the form already computed
    // one), it's preserved as-is; only a genuinely missing one is generated
    // — this also quietly backfills any older student saved before this
    // feature existed, the first time that record is edited.
    const studentId = data.studentId || generateStudentId(students);
    // Advance Payment is captured on the Student form but is a transaction,
    // not a student field — split it off before writing the student record.
    const { advancePayment, advancePaymentMode, advancePaymentRef, ...studentData } = data;
    const savedStudent = { ...studentData, id, studentId, deleted: false };
    await setDoc(doc(db, "students", id), savedStudent);
    setShowStudentForm(false);
    setEditingStudent(null);

    const advAmt = Number(advancePayment) || 0;
    if (advAmt > 0) {
      const depId = uid();
      const mode = advancePaymentMode || "Cash";
      const newDep = {
        id: depId, studentId: id, amount: advAmt, date: todayStr(), mode,
        utr: (mode === "UPI" || mode === "Bank Transfer") ? (advancePaymentRef || "") : "",
        chequeNumber: mode === "Cheque" ? (advancePaymentRef || "") : "",
        remarks: "Advance Payment at Admission", writeOffAmount: 0, writeOffRemarks: "", deleted: false,
      };
      await setDoc(doc(db, "deposits", depId), newDep);
      setReceiptData({ deposit: newDep, student: savedStudent });
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
    if (!window.confirm(`Undo the last status change for ${student.name}? This restores ${student.lastSnapshot.class} as Active and removes the most recent history entry.`)) return;
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

  // ---- Teachers ----
  async function saveTeacher(data) {
    const id = data.id || uid();
    const teacherId = data.teacherId || generateTeacherId(teachers);
    await setDoc(doc(db, "teachers", id), { ...data, id, teacherId, deleted: false });
    setShowTeacherForm(false);
    setEditingTeacher(null);
  }
  // ---- Dedicated Deactivate / Reactivate action for teachers — replaces
  // the old plain "Status" dropdown in the Add/Edit Teacher form, which
  // could flip active/inactive with no date and no reason on record. Every
  // transition requires a date + remarks and is appended to `statusLog`
  // (same append-only pattern as `salaryHistory` already uses), so a
  // teacher's full activation history is preserved — nothing overwrites a
  // past entry. Shown as its own "Status History" panel on the teacher's
  // expanded row, kept separate from the existing Performance tab (which
  // is completely untouched by this).
  async function changeTeacherStatus(teacher, newStatus, date, remarks) {
    const statusLog = [...(teacher.statusLog || []), {
      type: newStatus === "inactive" ? "deactivated" : "reactivated",
      date, remarks: remarks || "", loggedAt: nowStamp(),
    }];
    await setDoc(doc(db, "teachers", teacher.id), { ...teacher, status: newStatus, statusLog });
  }
  async function softDeleteTeacher(id) {
    const t = teacherById[id];
    if (!t) return;
    if (!window.confirm("Move this teacher to Trash? Their record can be restored later.")) return;
    await setDoc(doc(db, "teachers", id), { ...t, deleted: true, deletedAt: todayStr() });
  }
  async function restoreTeacher(id) {
    const t = teachers.find(x => x.id === id);
    if (!t) return;
    await setDoc(doc(db, "teachers", id), { ...t, deleted: false, deletedAt: null });
  }
  async function permanentlyDeleteTeacher(id) {
    if (!window.confirm("Permanently delete this teacher? This cannot be undone.")) return;
    await deleteDoc(doc(db, "teachers", id));
  }

  // ---- Staff ----
  async function saveStaffMember(data) {
    const id = data.id || uid();
    const staffId = data.staffId || generateStaffId(staff);
    await setDoc(doc(db, "staff", id), { ...data, id, staffId, deleted: false });
    setShowStaffForm(false);
    setEditingStaffMember(null);
  }
  async function softDeleteStaffMember(id) {
    const s = staff.find(x => x.id === id);
    if (!s) return;
    if (!window.confirm("Move this staff member to Trash? Their record can be restored later.")) return;
    await setDoc(doc(db, "staff", id), { ...s, deleted: true, deletedAt: todayStr() });
  }
  async function restoreStaffMember(id) {
    const s = staff.find(x => x.id === id);
    if (!s) return;
    await setDoc(doc(db, "staff", id), { ...s, deleted: false, deletedAt: null });
  }
  async function permanentlyDeleteStaffMember(id) {
    if (!window.confirm("Permanently delete this staff member? This cannot be undone.")) return;
    await deleteDoc(doc(db, "staff", id));
  }

  // ---- Salary ----
  // Pays a teacher or staff member. If advanceDeducted > 0, walks that
  // person's open advances oldest-first (compareChrono), reducing each
  // one's outstandingAmount (flipping it to "settled" at zero) until the
  // requested deduction is exhausted — see UPDATE NOTES #24. netPaid is
  // what actually leaves Cash/Bank right now (baseAmount minus whatever
  // was deducted), which is what bankingSalaryLines reads.
  // BUG FIX — this used to filter open advances by personId alone, not
  // personType, unlike SalaryFormModal's outstandingAdvance preview (which
  // did check personType) — a correctness gap if a teacher and a staff
  // member ever shared a personId. Now uses the shared
  // allocateAdvancePayoff() helper (scoped by personId AND personType),
  // the same helper SalaryFormModal's preview and saveAdvanceReturn() use,
  // so all three can never drift apart again. See UPDATE NOTES entry for
  // the advance-settlement fix.
  async function saveSalaryPayment(data) {
    const id = uid();
    const slipId = generateSalaryId(salaryPayments);
    const { applied, actualApplied } = allocateAdvancePayoff(advances, data.personId, data.personType, data.advanceDeducted);
    for (const a of applied) {
      const adv = advances.find(x => x.id === a.advanceId);
      if (!adv) continue;
      await setDoc(doc(db, "advances", a.advanceId), { ...adv, outstandingAmount: a.newOutstanding, status: a.newStatus });
    }
    const settledAdvances = applied.map(a => ({ advanceId: a.advanceId, advanceRefId: a.advanceRefId, date: a.date, amount: a.amount }));
    // If the office asked to deduct more than is actually outstanding,
    // only what was really available gets applied.
    const actualDeducted = actualApplied;
    const netPaid = round2((Number(data.baseAmount) || 0) - actualDeducted);
    const record = {
      ...data, id, slipId, advanceDeducted: actualDeducted, netPaid, settledAdvances,
      deleted: false, createdAt: nowStamp(),
    };
    await setDoc(doc(db, "salaryPayments", id), record);
    setShowSalaryForm(false);
    setSalarySlipData(record);
  }
  async function softDeleteSalaryPayment(id) {
    const p = salaryPayments.find(x => x.id === id);
    if (!p) return;
    if (!window.confirm("Move this salary payment to Trash? It can be restored later.")) return;
    await setDoc(doc(db, "salaryPayments", id), { ...p, deleted: true, deletedAt: todayStr() });
  }
  async function restoreSalaryPayment(id) {
    const p = salaryPayments.find(x => x.id === id);
    if (!p) return;
    await setDoc(doc(db, "salaryPayments", id), { ...p, deleted: false, deletedAt: null });
  }
  async function permanentlyDeleteSalaryPayment(id) {
    if (!window.confirm("Permanently delete this salary payment? This cannot be undone.")) return;
    await deleteDoc(doc(db, "salaryPayments", id));
  }

  // ---- Advance ----
  async function saveAdvance(data) {
    const id = uid();
    const advanceId = generateAdvanceId(advances);
    const amount = round2(Number(data.amount) || 0);
    await setDoc(doc(db, "advances", id), {
      ...data, id, advanceId, amount, outstandingAmount: amount, status: "open",
      deleted: false, createdAt: nowStamp(),
    });
    setShowAdvanceForm(false);
  }
  async function softDeleteAdvance(id) {
    const a = advances.find(x => x.id === id);
    if (!a) return;
    if (!window.confirm("Move this advance to Trash? It can be restored later.")) return;
    await setDoc(doc(db, "advances", id), { ...a, deleted: true, deletedAt: todayStr() });
  }
  async function restoreAdvance(id) {
    const a = advances.find(x => x.id === id);
    if (!a) return;
    await setDoc(doc(db, "advances", id), { ...a, deleted: false, deletedAt: null });
  }
  async function permanentlyDeleteAdvance(id) {
    if (!window.confirm("Permanently delete this advance? This cannot be undone.")) return;
    await deleteDoc(doc(db, "advances", id));
  }

  // ---- Advance Return ----
  // Records a teacher/staff member directly returning advance money (e.g.
  // handing back cash) outside of a salary run. Applies the returned
  // amount across that person's open advances oldest-first, using the
  // exact same allocateAdvancePayoff() helper saveSalaryPayment() uses, so
  // the two settlement paths can never disagree. Real money coming back
  // IN — see bankingAdvanceReturnLines (kind: "credit"), the opposite
  // direction of bankingAdvanceLines. ASSUMPTION, same as UPDATE NOTES #24
  // already flags for salary payments: soft-deleting an advance return does
  // not reverse the advance settlement it made — no existing soft-delete in
  // this file reverses side effects either.
  async function saveAdvanceReturn(data) {
    const id = uid();
    const returnId = generateAdvanceReturnId(advanceReturns);
    const amount = round2(Number(data.amount) || 0);
    const { applied } = allocateAdvancePayoff(advances, data.personId, data.personType, amount);
    for (const a of applied) {
      const adv = advances.find(x => x.id === a.advanceId);
      if (!adv) continue;
      await setDoc(doc(db, "advances", a.advanceId), { ...adv, outstandingAmount: a.newOutstanding, status: a.newStatus });
    }
    const settledAdvances = applied.map(a => ({ advanceId: a.advanceId, advanceRefId: a.advanceRefId, date: a.date, amount: a.amount }));
    await setDoc(doc(db, "advanceReturns", id), {
      ...data, id, returnId, amount, settledAdvances,
      deleted: false, createdAt: nowStamp(),
    });
    setShowAdvanceReturnForm(false);
  }
  async function softDeleteAdvanceReturn(id) {
    const r = advanceReturns.find(x => x.id === id);
    if (!r) return;
    if (!window.confirm("Move this advance return to Trash? It can be restored later.")) return;
    await setDoc(doc(db, "advanceReturns", id), { ...r, deleted: true, deletedAt: todayStr() });
  }
  async function restoreAdvanceReturn(id) {
    const r = advanceReturns.find(x => x.id === id);
    if (!r) return;
    await setDoc(doc(db, "advanceReturns", id), { ...r, deleted: false, deletedAt: null });
  }
  async function permanentlyDeleteAdvanceReturn(id) {
    if (!window.confirm("Permanently delete this advance return? This cannot be undone.")) return;
    await deleteDoc(doc(db, "advanceReturns", id));
  }

  // ---- Batch Schedule ----
  async function saveBatchScheduleEntry(data) {
    const id = data.id || uid();
    await setDoc(doc(db, "batchSchedule", id), { ...data, id });
    setShowBatchScheduleForm(false);
    setEditingBatchSchedule(null);
  }
  async function deleteBatchScheduleEntry(id) {
    if (!window.confirm("Delete this batch schedule entry? This cannot be undone.")) return;
    await deleteDoc(doc(db, "batchSchedule", id));
  }

  // ---- Attendance (batch-wise) — idempotent upsert keyed by
  // date_class_subject, so re-saving the same combination edits the same
  // document instead of creating a duplicate. `time` is captured once at
  // first save (the moment attendance was actually taken) and kept as-is on
  // every re-save from Mark Attendance itself; `remarks` is passed through
  // as typed. Editing date/time/remarks afterward goes through
  // editAttendanceLog below instead, which is the only path allowed to move
  // the doc to a new key.
  async function saveAttendanceLog(dateStr, cls, subject, batchId, records, time, remarks) {
    const key = `${dateStr}_${cls}_${subject}`.replace(/[^a-zA-Z0-9_-]/g, "-");
    const existing = attendanceLog.find(a => a.id === key);
    await setDoc(doc(db, "attendanceLog", key), {
      id: key, date: dateStr, class: cls, subject, batchId, records,
      time: existing ? (existing.time || time || "") : (time || ""),
      remarks: remarks || "",
      createdAt: existing ? existing.createdAt : nowStamp(),
    });
  }
  // ---- View Attendance → dedicated "Edit" action. Only date, time,
  // remarks, and per-student statuses are editable (class/subject define
  // which batch this session belongs to and aren't changed here). Since the
  // doc id is derived from date_class_subject, changing the date means the
  // key changes too — this deletes the old doc and writes the new one so no
  // duplicate/orphan record is left behind.
  async function editAttendanceLog(original, { date, time, remarks, records }) {
    const newKey = `${date}_${original.class}_${original.subject}`.replace(/[^a-zA-Z0-9_-]/g, "-");
    if (newKey !== original.id) {
      await deleteDoc(doc(db, "attendanceLog", original.id));
    }
    await setDoc(doc(db, "attendanceLog", newKey), {
      id: newKey, date, class: original.class, subject: original.subject, batchId: original.batchId || null,
      records, time: time || "", remarks: remarks || "", createdAt: original.createdAt || nowStamp(),
    });
  }
  // ---- View Attendance → dedicated "Delete" action, for accidentally
  // created sessions. Hard delete (no Trash/restore for this collection —
  // same as batchSchedule/tests below; flagged as an assumption in UPDATE
  // NOTES, consistent with the existing attendanceLog/tests vs. old
  // attendance/testScores Trash-support mismatch already called out there).
  async function deleteAttendanceLog(id) {
    if (!window.confirm("Delete this attendance record? This cannot be undone.")) return;
    await deleteDoc(doc(db, "attendanceLog", id));
  }

  // ---- Test Marks — upsert by testId (same reopen-and-reload behavior:
  // selecting the same Class+Subject+Date, or the same generated Test ID,
  // loads existing marks instead of starting blank).
  async function saveTest(data) {
    const existing = tests.find(t => t.testId === data.testId);
    const id = existing ? existing.id : uid();
    await setDoc(doc(db, "tests", id), {
      ...data, id, createdAt: existing ? existing.createdAt : nowStamp(),
    });
  }
  // ---- View & Search Scores → dedicated "Edit" action. Unlike saveTest
  // (which looks up the doc by matching testId — fine when testId doesn't
  // change), this edit path lets class/subject/date change, which changes
  // what generateTestId computes. Writing to the same Firestore doc id
  // (original.id, stable since creation — see saveTest's uid()) instead of
  // looking up by testId means the record is renamed/moved in place rather
  // than leaving the old testId behind as an orphan or creating a duplicate.
  async function editTest(original, { cls, subject, date, maxMarks, description, scores }) {
    const testId = generateTestId(tests, cls, subject, date, original.testId);
    await setDoc(doc(db, "tests", original.id), {
      id: original.id, testId, class: cls, subject, date,
      maxMarks: Number(maxMarks) || 0, description, scores,
      createdAt: original.createdAt || nowStamp(),
    });
  }
  // ---- View & Search Scores → dedicated "Delete" action, for accidentally
  // created tests. Hard delete, same rationale as deleteAttendanceLog above.
  async function deleteTest(id) {
    if (!window.confirm("Delete this test and all its scores? This cannot be undone.")) return;
    await deleteDoc(doc(db, "tests", id));
  }

  // ---- Infrastructure Management — rooms/areas registry. Same simple
  // upsert/hard-delete pattern as saveTest/deleteTest above (no Trash for
  // this collection either).
  async function saveInfrastructure(data) {
    const id = data.id || uid();
    await setDoc(doc(db, "infrastructure", id), { ...data, id });
    setShowInfrastructureForm(false);
    setEditingInfrastructure(null);
  }
  async function deleteInfrastructure(id) {
    if (!window.confirm("Delete this room/area entry? This cannot be undone.")) return;
    await deleteDoc(doc(db, "infrastructure", id));
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
    await setDoc(doc(db, "charges", id), { ...data, id, chargeId, deleted: false, createdAt: nowStamp() });
    setShowChargeModal(null);
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
    const newExp = { ...data, id, expenseId, deleted: false, createdAt: nowStamp() };
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

  // ---- Notes — simple internal notepad, independent of the financial ledger ----
  async function saveNote(data) {
    if (data.id) {
      const existing = notes.find(n => n.id === data.id);
      await setDoc(doc(db, "notes", data.id), {
        ...existing, title: data.title, body: data.body, pinned: !!(existing && existing.pinned),
        updatedAt: nowStamp(),
      });
    } else {
      const id = uid();
      await setDoc(doc(db, "notes", id), {
        id, title: data.title, body: data.body, pinned: false, deleted: false,
        createdAt: nowStamp(), updatedAt: nowStamp(),
      });
    }
    setShowNoteForm(false);
    setEditingNote(null);
  }
  async function toggleNotePin(id) {
    const n = notes.find(x => x.id === id);
    if (!n) return;
    await setDoc(doc(db, "notes", id), { ...n, pinned: !n.pinned, updatedAt: nowStamp() });
  }
  async function deleteNote(id) {
    if (!window.confirm("Delete this note? This cannot be undone.")) return;
    await deleteDoc(doc(db, "notes", id));
  }

  // ---- Banking — internal Cash ↔ Bank transfer transactions ----
  // These move money between the two balances the center actually holds
  // (physical Cash and the Bank/Online account) without creating any
  // student charge, payment, or center expense. Each one gets its own
  // unique, trackable Transaction ID and only ever appears in the Banking
  // Statement — never in the Center Statement — because no real income or
  // expenditure has happened, just a transfer between two of our own pockets.
  async function addBankTransaction(data) {
    const id = uid();
    const txnId = `BTX-${shortId(id)}`;
    const newTxn = { ...data, id, txnId, deleted: false, createdAt: nowStamp() };
    await setDoc(doc(db, "bankTransactions", id), newTxn);
    setShowBankTxnForm(false);
    setBankTxnReceiptData(newTxn);
  }
  async function softDeleteBankTransaction(id) {
    const t = bankTransactions.find(x => x.id === id);
    if (!t) return;
    if (!window.confirm("Remove this bank transaction? It can be restored later from Trash.")) return;
    await setDoc(doc(db, "bankTransactions", id), { ...t, deleted: true, deletedAt: todayStr() });
  }
  async function restoreBankTransaction(id) {
    const t = bankTransactions.find(x => x.id === id);
    if (!t) return;
    await setDoc(doc(db, "bankTransactions", id), { ...t, deleted: false, deletedAt: null });
  }
  async function permanentlyDeleteBankTransaction(id) {
    if (!window.confirm("Permanently delete this bank transaction? This cannot be undone.")) return;
    await deleteDoc(doc(db, "bankTransactions", id));
  }

  // ---- Banking — Credit / Loan ledger (money we borrow from someone, or
  // money we lend to someone). Each entry gets its own unique Credit ID
  // and feeds the Cash Balance / Bank Balance the same way a deposit or
  // expense does, based on whether it moved as Cash or Online. ----
  async function addCreditTransaction(data) {
    const id = uid();
    const creditId = `CR-${shortId(id)}`;
    const newTxn = { ...data, id, creditId, deleted: false, createdAt: nowStamp() };
    await setDoc(doc(db, "creditTransactions", id), newTxn);
    setShowCreditForm(false);
    setCreditReceiptData(newTxn);
  }
  async function softDeleteCreditTransaction(id) {
    const c = creditTransactions.find(x => x.id === id);
    if (!c) return;
    if (!window.confirm("Remove this credit / loan entry? It can be restored later from Trash.")) return;
    await setDoc(doc(db, "creditTransactions", id), { ...c, deleted: true, deletedAt: todayStr() });
  }
  async function restoreCreditTransaction(id) {
    const c = creditTransactions.find(x => x.id === id);
    if (!c) return;
    await setDoc(doc(db, "creditTransactions", id), { ...c, deleted: false, deletedAt: null });
  }
  async function permanentlyDeleteCreditTransaction(id) {
    if (!window.confirm("Permanently delete this credit / loan entry? This cannot be undone.")) return;
    await deleteDoc(doc(db, "creditTransactions", id));
  }

  // Interest paid against a specific Credit Taken (borrowed) entry. Gets
  // its own unique, clickable/printable Interest Payment ID and is always
  // money moving out (Cash or Online) from the center.
  async function addInterestPayment(data) {
    const id = uid();
    const paymentId = `INT-${shortId(id)}`;
    const newPayment = { ...data, id, paymentId, deleted: false, createdAt: nowStamp() };
    await setDoc(doc(db, "interestPayments", id), newPayment);
    setShowPayInterestModal(null);
    const creditTxn = creditTransactions.find(c => c.id === data.creditTxnId);
    setInterestReceiptData({ payment: newPayment, creditTxn });
  }
  async function softDeleteInterestPayment(id) {
    const p = interestPayments.find(x => x.id === id);
    if (!p) return;
    if (!window.confirm("Remove this interest payment? It can be restored later from Trash.")) return;
    await setDoc(doc(db, "interestPayments", id), { ...p, deleted: true, deletedAt: todayStr() });
  }
  async function restoreInterestPayment(id) {
    const p = interestPayments.find(x => x.id === id);
    if (!p) return;
    await setDoc(doc(db, "interestPayments", id), { ...p, deleted: false, deletedAt: null });
  }
  async function permanentlyDeleteInterestPayment(id) {
    if (!window.confirm("Permanently delete this interest payment? This cannot be undone.")) return;
    await deleteDoc(doc(db, "interestPayments", id));
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
  async function saveStreams(updatedList) {
    setStreams(updatedList);
    await setDoc(doc(db, "settings", "streamList"), { list: updatedList });
  }
  async function saveInstituteSettings(data) {
    setInstituteSettings(data);
    await setDoc(doc(db, "settings", "institute"), data);
    setShowSettingsModal(false);
  }

  async function saveDeposit(data) {
    const id = uid();
    const newDep = { ...data, id, deleted: false, createdAt: nowStamp() };
    await setDoc(doc(db, "deposits", id), newDep);
    setShowDepositForm(false);
    const st = studentById[data.studentId];
    setReceiptData({ deposit: newDep, student: st });
  }

  // ---- Academic Monitoring — Attendance, Test Scores, Behaviour & Conduct.
  // Same add-or-edit-by-id pattern as saveNote(), and the same soft
  // delete / restore / permanent delete pattern as every other collection
  // above (see softDeleteCharge / restoreCharge / permanentlyDeleteCharge
  // for the template this follows). ----
  async function saveAttendance(data) {
    if (data.id) {
      const existing = attendance.find(a => a.id === data.id);
      await setDoc(doc(db, "attendance", data.id), {
        ...existing, studentId: data.studentId, date: data.date, status: data.status,
        remarks: data.remarks, deleted: existing ? existing.deleted : false,
      });
    } else {
      const id = uid();
      await setDoc(doc(db, "attendance", id), { ...data, id, deleted: false, createdAt: nowStamp() });
    }
    setShowAttendanceForm(false);
    setEditingAttendance(null);
  }
  async function softDeleteAttendance(id) {
    const a = attendance.find(x => x.id === id);
    if (!a) return;
    if (!window.confirm("Remove this attendance record? It can be restored later from Trash.")) return;
    await setDoc(doc(db, "attendance", id), { ...a, deleted: true, deletedAt: todayStr() });
  }
  async function restoreAttendance(id) {
    const a = attendance.find(x => x.id === id);
    if (!a) return;
    await setDoc(doc(db, "attendance", id), { ...a, deleted: false, deletedAt: null });
  }
  async function permanentlyDeleteAttendance(id) {
    if (!window.confirm("Permanently delete this attendance record? This cannot be undone.")) return;
    await deleteDoc(doc(db, "attendance", id));
  }

  async function saveTestScore(data) {
    if (data.id) {
      const existing = testScores.find(t => t.id === data.id);
      await setDoc(doc(db, "testScores", data.id), {
        ...existing, studentId: data.studentId, testName: data.testName, subject: data.subject,
        date: data.date, marksObtained: data.marksObtained, maxMarks: data.maxMarks, remarks: data.remarks,
        deleted: existing ? existing.deleted : false,
      });
    } else {
      const id = uid();
      await setDoc(doc(db, "testScores", id), { ...data, id, deleted: false, createdAt: nowStamp() });
    }
    setShowTestScoreForm(false);
    setEditingTestScore(null);
  }
  async function softDeleteTestScore(id) {
    const t = testScores.find(x => x.id === id);
    if (!t) return;
    if (!window.confirm("Remove this test score? It can be restored later from Trash.")) return;
    await setDoc(doc(db, "testScores", id), { ...t, deleted: true, deletedAt: todayStr() });
  }
  async function restoreTestScore(id) {
    const t = testScores.find(x => x.id === id);
    if (!t) return;
    await setDoc(doc(db, "testScores", id), { ...t, deleted: false, deletedAt: null });
  }
  async function permanentlyDeleteTestScore(id) {
    if (!window.confirm("Permanently delete this test score? This cannot be undone.")) return;
    await deleteDoc(doc(db, "testScores", id));
  }

  async function saveBehaviourNote(data) {
    if (data.id) {
      const existing = behaviourNotes.find(b => b.id === data.id);
      await setDoc(doc(db, "behaviourNotes", data.id), {
        ...existing, studentId: data.studentId, date: data.date, note: data.note, tag: data.tag,
        deleted: existing ? existing.deleted : false,
      });
    } else {
      const id = uid();
      await setDoc(doc(db, "behaviourNotes", id), { ...data, id, deleted: false, createdAt: nowStamp() });
    }
    setShowBehaviourForm(false);
    setEditingBehaviour(null);
  }
  async function softDeleteBehaviourNote(id) {
    const b = behaviourNotes.find(x => x.id === id);
    if (!b) return;
    if (!window.confirm("Remove this behaviour note? It can be restored later from Trash.")) return;
    await setDoc(doc(db, "behaviourNotes", id), { ...b, deleted: true, deletedAt: todayStr() });
  }
  async function restoreBehaviourNote(id) {
    const b = behaviourNotes.find(x => x.id === id);
    if (!b) return;
    await setDoc(doc(db, "behaviourNotes", id), { ...b, deleted: false, deletedAt: null });
  }
  async function permanentlyDeleteBehaviourNote(id) {
    if (!window.confirm("Permanently delete this behaviour note? This cannot be undone.")) return;
    await deleteDoc(doc(db, "behaviourNotes", id));
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
    // Students Register, Pending Dues, Deposits Log, Charges, Center
    // Statement, and Fee & Class Structure used to be six separate sidebar
    // entries. They're now one "Student Management" tab with an internal
    // pill row of six sub-tabs (see StudentManagementTab /
    // STUDENT_MANAGEMENT_SUB_TABS) — same merge pattern already used for
    // Banking's four sub-tabs.
    { id: "students-management", label: "Student Management", icon: Users },
    // Teacher Management — Teachers, Performance, Batch Schedule, Staff,
    // Salary, and Advance, grouped under one sidebar entry with its own
    // internal pill row, same pattern as Student Management (see
    // TeacherManagementTab / TEACHER_MANAGEMENT_SUB_TABS). See UPDATE
    // NOTES #23. Renamed to "Institute Management" in UPDATE NOTES #24 —
    // the id stays "teacher-management" on purpose so nothing that
    // already references it breaks.
    { id: "teacher-management", label: "Institute Management", icon: UserCog },
    // Academic Monitoring — Attendance, Test Scores, Behaviour & Conduct,
    // and the printable Performance Report, grouped under one sidebar
    // entry with its own internal pill row (see AcademicMonitoringTab /
    // ACADEMIC_MONITORING_SUB_TABS), same pattern as Student Management.
    // Attendance (batch-wise, roster + autofill) and Test Marks used to be
    // their own top-level "Attendance" sidebar entry (AttendanceMgmtTab /
    // ATTENDANCE_MGMT_SUB_TABS, see UPDATE NOTES #23). That standalone tab
    // has been removed and folded into Academic Monitoring below as its
    // "Mark Attendance" / "Test Marks" sub-tabs, replacing the older
    // per-student Attendance / Test Scores sub-tabs there — see the new
    // UPDATE NOTES entry for this change and AcademicMonitoringTab /
    // ACADEMIC_MONITORING_SUB_TABS.
    { id: "academic-monitoring", label: "Academic Monitoring", icon: GraduationCap },
    // "Expenses Log" used to be its own sidebar entry here. It's now a
    // Banking sub-tab instead (right after "Banking Statement") — see
    // BANKING_SUB_TABS / BankingTab and the matching UPDATE NOTES entry.
    // The ExpensesTab component, expensesTabProps, and softDeleteExpense
    // are all unchanged; only where the tab is reachable from changed.
    { id: "banking", label: "Banking", icon: Landmark },
    { id: "notes", label: "Notes", icon: BookOpen },
    { id: "trash", label: "Trash / Restore", icon: Archive },
  ];

  const trashCount = trashedStudents.length + trashedDeposits.length + trashedCharges.length + trashedExpenses.length + trashedBankTxns.length + trashedCreditTxns.length + trashedInterestPayments.length + trashedAttendance.length + trashedTestScores.length + trashedBehaviourNotes.length + trashedTeachers.length + trashedStaff.length + trashedSalaryPayments.length + trashedAdvances.length + trashedAdvanceReturns.length;

  // These four prop objects used to be built inline, once each, right where
  // their one consumer tab was rendered. They're now local consts instead —
  // same exact shape, same exact values — so Banking's three new sub-tabs
  // (#7: Salary, Advance, Deposits Log copies, plus #6: Expenses Log moved
  // in) can be handed the identical object their original tab uses. Same
  // data, same onAdd/onRemove/onStatement handlers, single source of truth
  // — nothing about how any of these four behave changed, they're just
  // reachable from two places now instead of one.
  const depositsTabProps = {
    deposits: visibleDeposits, students: visibleStudents, classes, studentDues: studentDuesMap,
    onAdd: () => setShowDepositForm(true), onRemove: softDeleteDeposit,
    onOpenReceipt: (dep) => setReceiptData({ deposit: dep, student: studentById[dep.studentId] }),
  };
  const expensesTabProps = {
    expenses: visibleExpenses,
    onAdd: () => setShowExpenseForm(true), onRemove: softDeleteExpense,
    onOpenReceipt: (exp) => setExpenseReceiptData(exp),
  };
  const salaryTabProps = {
    salaryPayments: visibleSalaryPayments, persons: mergeStaffAndTeachers(visibleTeachers, visibleStaff),
    onAdd: () => setShowSalaryForm(true),
    onViewSlip: (p) => setSalarySlipData(p),
    onRemove: softDeleteSalaryPayment,
    onStatement: (personId, personType) => setShowPersonStatement({ personId, personType }),
  };
  const advanceTabProps = {
    advances: visibleAdvances, advanceReturns: visibleAdvanceReturns, persons: mergeStaffAndTeachers(visibleTeachers, visibleStaff),
    onAdd: () => setShowAdvanceForm(true),
    onReturn: () => setShowAdvanceReturnForm(true),
    onRemove: softDeleteAdvance,
    onRemoveReturn: softDeleteAdvanceReturn,
    onStatement: (personId, personType) => setShowPersonStatement({ personId, personType }),
  };

  return (
    <InstituteSettingsContext.Provider value={instituteSettings}>
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: "#FAF6EC", fontFamily: "'Inter', sans-serif", color: "#26231D" }}>
      <style>{`${FONT_IMPORT}
        .ledger-row:nth-child(even) { background: #F5F0E1; }
        input, select { font-family: 'Inter', sans-serif; }
        ::selection { background: #B8862B33; }

        /* Sub-tab pill-row strips (Academic Monitoring, Student
           Management, Teacher Management, Fee & Class Structure, etc.)
           now scroll horizontally on narrow screens instead of wrapping
           into a jagged multi-row brick layout. This hides the scrollbar
           itself while keeping the scroll gesture, and — because it's a
           real horizontally-scrollable element now — a touch-drag over
           the strip scrolls just the strip instead of dragging the whole
           page along with it. */
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        /* Joining Form — same class names the print stylesheet uses, so the
           on-screen preview matches the printed A4 form instead of showing
           up as plain unstyled text. */
        .joining-form-doc { position: relative; }
        .joining-form-doc .header { text-align: center; border-bottom: 2px dashed #12312B; padding-bottom: 14px; margin-bottom: 20px; }
        .joining-form-doc .section-title { font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #8A6420; border-bottom: 1px solid #D8CFB8; padding-bottom: 5px; margin: 22px 0 12px; }
        .joining-form-doc .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 28px; }
        .joining-form-doc .row { font-size: 13px; padding: 8px 2px; border-bottom: 1px dotted #E4DCC5; display: flex; justify-content: space-between; gap: 14px; }
        .joining-form-doc .label { color: #6E6650; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; letter-spacing: 0.02em; }
        .joining-form-doc .value { font-weight: 600; color: #12312B; text-align: right; }
        .joining-form-doc .footer { border-top: 1.5px solid #12312B; padding-top: 12px; margin-top: 30px; text-align: center; font-size: 10px; color: #6E6650; letter-spacing: 0.05em; }
        .joining-form-doc .sign-row { display: flex; justify-content: space-between; margin-top: 68px; font-size: 12px; }
        .joining-form-doc .sign-line { border-top: 1px solid #12312B; padding-top: 6px; width: 200px; text-align: center; color: #4A4636; }
      `}</style>

      {/* Mobile top bar — only rendered below md; gives phone/tablet users
          a hamburger to open the nav drawer instead of the always-visible
          desktop sidebar, which would otherwise eat most of a phone's
          screen width. */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-20" style={{ background: "#12312B" }}>
        <div className="flex items-center gap-2">
          <button onClick={() => setMobileNavOpen(true)} className="text-[#F4EFDE] p-1 -ml-1" aria-label="Open menu"><Menu size={22} /></button>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-bold text-[#F4EFDE] leading-tight">InstituteOS</div>
        </div>
        <button onClick={() => setShowSettingsModal(true)} className="text-[#8FAE9F] p-1 -mr-1" aria-label="Settings"><Settings size={20} /></button>
      </div>

      {/* Backdrop — tapping outside the open drawer closes it. Desktop
          never sets mobileNavOpen true (no hamburger to trigger it there),
          so this never renders on md+ regardless. */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-30 md:hidden" style={{ background: "#12312Bcc" }} onClick={() => setMobileNavOpen(false)} />
      )}

      <aside
        className={`w-64 md:w-60 shrink-0 flex flex-col justify-between fixed md:sticky inset-y-0 left-0 md:top-0 h-screen overflow-y-auto z-40 transition-transform duration-200 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
        style={{ background: "#12312B" }}
      >
        <div>
          <div className="flex items-center justify-between px-5 pt-6 pb-5" style={{ borderBottom: "1px solid #24473F" }}>
            <div>
              <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#F4EFDE] leading-tight">InstituteOS</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#8FAE9F" }} className="mt-1 uppercase tracking-wider">Institute Operating System</div>
            </div>
            <button onClick={() => setMobileNavOpen(false)} className="md:hidden text-[#8FAE9F] p-1" aria-label="Close menu"><X size={20} /></button>
          </div>
          <nav className="px-3 py-4 space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button key={item.id} onClick={() => { setTab(item.id); setMobileNavOpen(false); }}
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
          <button onClick={() => { setShowSettingsModal(true); setMobileNavOpen(false); }} className="w-full flex items-center gap-2 px-5 py-3 text-xs font-medium text-[#8FAE9F] hover:text-[#F4EFDE] transition-colors" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            <Settings size={14} /> Settings
          </button>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-5 py-3 text-xs font-medium text-[#8FAE9F] hover:text-[#F4EFDE] transition-colors" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            <LogOut size={14} /> Lock Portal
          </button>
          <div className="px-5 pb-4 text-[10px]" style={{ color: "#6E9384", fontFamily: "'IBM Plex Mono', monospace" }}>
            {monthLabel(curMonth)} · <span style={{ color: "#8FAE9F" }}>live cloud sync</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 px-4 sm:px-6 md:px-8 py-5 md:py-7 max-w-6xl w-full">
        {tab === "dashboard" && (
          <DashboardTab
            students={activeStudents} thisMonthCollected={thisMonthCollected} thisMonthWriteOffs={thisMonthWriteOffs}
            thisMonthExpected={thisMonthExpected} totalOutstanding={totalOutstanding} trend={trend} classStrength={classStrength}
            recentDeposits={recentDeposits} studentById={studentById} curMonth={curMonth} classes={classes}
            studentDues={studentDuesMap} forecastForMonth={forecastForMonth}
            totalCashBalance={totalCashBalance} totalOnlineBalance={totalOnlineBalance}
            cashExpensesTotal={cashExpensesTotal} onlineExpensesTotal={onlineExpensesTotal} totalExpenses={totalExpenses}
            attendanceLog={attendanceLog} tests={tests} teachers={visibleTeachers} staff={visibleStaff}
            onOpenReceipt={(dep) => setReceiptData({ deposit: dep, student: studentById[dep.studentId] })}
            onStatement={(s) => setShowStatementModal(s)}
          />
        )}
        {tab === "students-management" && (
          <StudentManagementTab
            studentsTabProps={{
              students: visibleStudents, studentDues: studentDuesMap, studentDuesRaw: studentDuesRawMap, classes, streams,
              batchesForMonth, curMonth,
              onAdd: () => { setEditingStudent(null); setShowStudentForm(true); },
              onEdit: (s) => { setEditingStudent(s); setShowStudentForm(true); },
              onExit: (s) => setShowExitModal(s), onPromote: (s) => setShowPromoteModal(s),
              onViewHistory: (s) => setShowHistoryModal(s), onBatchChange: (s) => setShowBatchChangeModal(s),
              onUndo: undoExit, onStatement: (s) => setShowStatementModal(s),
              onAddCharge: (s) => setShowChargeModal({ student: s }),
              onJoiningForm: (s) => setShowJoiningForm(s),
              onRemove: softDeleteStudent,
            }}
            duesTabProps={{
              students: visibleStudents, ledgers, totalOutstanding, classes,
              onStatement: (s) => setShowStatementModal(s),
            }}
            depositsTabProps={depositsTabProps}
            chargesTabProps={{
              chargeLines: allChargeLines, students: visibleStudents, classes,
              onAdd: () => setShowChargeModal({ student: null }), onRemove: softDeleteCharge,
              onOpenReceipt: (line) => setChargeReceiptData({ line, student: studentById[line.studentId] }),
            }}
            statementTabProps={{
              transactions: allTransactions, totals: centerTotals, students: visibleStudents, classes,
              onViewReceipt: (depositId) => {
                const dep = visibleDeposits.find(d => d.id === depositId);
                if (dep) setReceiptData({ deposit: dep, student: studentById[dep.studentId] });
              },
              onViewCharge: (t) => setChargeReceiptData({
                line: { chargeId: t.chargeId, type: t.type, date: t.date, month: t.month, label: t.label, amount: t.amount, remarks: t.remarks },
                student: studentById[t.studentId],
              }),
            }}
            structureTabProps={{
              feeStructure, setFeeStructure: saveFeeStructure, classes,
              subjectsList, onSaveClasses: saveClasses, onSaveSubjects: saveSubjects,
              streams, onSaveStreams: saveStreams,
            }}
          />
        )}
        {tab === "academic-monitoring" && (
          <AcademicMonitoringTab
            students={visibleStudents} classes={classes}
            attendance={visibleAttendance} testScores={visibleTestScores} behaviourNotes={visibleBehaviourNotes}
            onAddAttendance={() => { setEditingAttendance(null); setShowAttendanceForm(true); }}
            onEditAttendance={(a) => { setEditingAttendance(a); setShowAttendanceForm(true); }}
            onRemoveAttendance={softDeleteAttendance}
            onAddTestScore={() => { setEditingTestScore(null); setShowTestScoreForm(true); }}
            onEditTestScore={(t) => { setEditingTestScore(t); setShowTestScoreForm(true); }}
            onRemoveTestScore={softDeleteTestScore}
            onAddBehaviour={() => { setEditingBehaviour(null); setShowBehaviourForm(true); }}
            onEditBehaviour={(b) => { setEditingBehaviour(b); setShowBehaviourForm(true); }}
            onRemoveBehaviour={softDeleteBehaviourNote}
            subjectsList={subjectsList} batchSchedule={batchSchedule}
            attendanceLog={attendanceLog} batchesForMonth={batchesForMonth}
            onSaveAttendanceLog={saveAttendanceLog}
            onEditAttendanceLog={editAttendanceLog}
            onDeleteAttendanceLog={deleteAttendanceLog}
            tests={tests} onSaveTest={saveTest}
            onEditTest={editTest}
            onDeleteTest={deleteTest}
            teacherPerformanceTabProps={{
              teachers: visibleTeachers, batches: batchSchedule, attendanceRecords: attendanceLog, tests,
            }}
          />
        )}
        {tab === "teacher-management" && (
          <TeacherManagementTab
            teachersTabProps={{
              teachers: visibleTeachers, subjectsList, batchSchedule,
              onAdd: () => { setEditingTeacher(null); setShowTeacherForm(true); },
              onEdit: (t) => { setEditingTeacher(t); setShowTeacherForm(true); },
              onRemove: softDeleteTeacher,
              onStatement: (t) => setShowPersonStatement({ personId: t.id, personType: "teacher" }),
              onChangeStatus: (t, newStatus) => setShowTeacherStatusModal({ teacher: t, newStatus }),
              onJoiningForm: (t) => setShowPersonJoiningForm({ person: t, personType: "teacher" }),
            }}
            batchScheduleTabProps={{
              batchSchedule, teachers: visibleTeachers, classes, subjectsList,
              onAdd: () => { setEditingBatchSchedule(null); setShowBatchScheduleForm(true); },
              onEdit: (b) => { setEditingBatchSchedule(b); setShowBatchScheduleForm(true); },
              onRemove: deleteBatchScheduleEntry,
            }}
            staffTabProps={{
              staff: visibleStaff,
              onAdd: () => { setEditingStaffMember(null); setShowStaffForm(true); },
              onEdit: (s) => { setEditingStaffMember(s); setShowStaffForm(true); },
              onRemove: softDeleteStaffMember,
              onStatement: (s) => setShowPersonStatement({ personId: s.id, personType: "staff" }),
              onJoiningForm: (s) => setShowPersonJoiningForm({ person: s, personType: "staff" }),
            }}
            salaryTabProps={salaryTabProps}
            advanceTabProps={advanceTabProps}
            infrastructureTabProps={{
              infrastructure,
              onAdd: () => { setEditingInfrastructure(null); setShowInfrastructureForm(true); },
              onEdit: (r) => { setEditingInfrastructure(r); setShowInfrastructureForm(true); },
              onRemove: deleteInfrastructure,
            }}
          />
        )}
        {tab === "banking" && (
          <BankingTab
            feed={bankingFeed} totals={bankingTotals}
            bankTxns={visibleBankTxns} creditTxns={visibleCreditTxns} interestPayments={visibleInterestPayments}
            interestPaidByCreditId={interestPaidByCreditId} students={visibleStudents}
            expensesTabProps={expensesTabProps} depositsTabProps={depositsTabProps}
            salaryTabProps={salaryTabProps} advanceTabProps={advanceTabProps}
            onAdd={() => setShowBankTxnForm(true)}
            onAddCredit={() => setShowCreditForm(true)}
            onPayInterest={(creditTxn) => setShowPayInterestModal(creditTxn)}
            onViewReceipt={(depositId) => {
              const dep = visibleDeposits.find(d => d.id === depositId);
              if (dep) setReceiptData({ deposit: dep, student: studentById[dep.studentId] });
            }}
            onViewExpense={(expenseRowId) => {
              const exp = visibleExpenses.find(e => e.id === expenseRowId);
              if (exp) setExpenseReceiptData(exp);
            }}
            onViewBankTxn={(bankTxnId) => {
              const t = visibleBankTxns.find(x => x.id === bankTxnId);
              if (t) setBankTxnReceiptData(t);
            }}
            onViewCredit={(creditTxnId) => {
              const c = visibleCreditTxns.find(x => x.id === creditTxnId);
              if (c) setCreditReceiptData(c);
            }}
            onViewInterest={(interestPaymentId) => {
              const p = visibleInterestPayments.find(x => x.id === interestPaymentId);
              if (p) setInterestReceiptData({ payment: p, creditTxn: creditTxnById[p.creditTxnId] });
            }}
            onRemoveBankTxn={softDeleteBankTransaction}
            onRemoveCredit={softDeleteCreditTransaction}
            onRemoveInterest={softDeleteInterestPayment}
          />
        )}
        {tab === "notes" && (
          <NotesTab
            notes={visibleNotes}
            onAdd={() => { setEditingNote(null); setShowNoteForm(true); }}
            onEdit={(n) => { setEditingNote(n); setShowNoteForm(true); }}
            onTogglePin={toggleNotePin}
            onDelete={deleteNote}
          />
        )}
        {tab === "trash" && (
          <TrashTab
            trashedStudents={trashedStudents} trashedDeposits={trashedDeposits} trashedCharges={trashedCharges} trashedExpenses={trashedExpenses}
            trashedBankTxns={trashedBankTxns} trashedCreditTxns={trashedCreditTxns} trashedInterestPayments={trashedInterestPayments}
            trashedAttendance={trashedAttendance} trashedTestScores={trashedTestScores} trashedBehaviourNotes={trashedBehaviourNotes}
            trashedTeachers={trashedTeachers} trashedStaff={trashedStaff}
            trashedSalaryPayments={trashedSalaryPayments} trashedAdvances={trashedAdvances} trashedAdvanceReturns={trashedAdvanceReturns}
            studentById={studentById}
            onRestoreStudent={restoreStudent} onDeleteStudent={permanentlyDeleteStudent}
            onRestoreDeposit={restoreDeposit} onDeleteDeposit={permanentlyDeleteDeposit}
            onRestoreCharge={restoreCharge} onDeleteCharge={permanentlyDeleteCharge}
            onRestoreExpense={restoreExpense} onDeleteExpense={permanentlyDeleteExpense}
            onRestoreBankTxn={restoreBankTransaction} onDeleteBankTxn={permanentlyDeleteBankTransaction}
            onRestoreCredit={restoreCreditTransaction} onDeleteCredit={permanentlyDeleteCreditTransaction}
            onRestoreInterest={restoreInterestPayment} onDeleteInterest={permanentlyDeleteInterestPayment}
            onRestoreAttendance={restoreAttendance} onDeleteAttendance={permanentlyDeleteAttendance}
            onRestoreTestScore={restoreTestScore} onDeleteTestScore={permanentlyDeleteTestScore}
            onRestoreBehaviour={restoreBehaviourNote} onDeleteBehaviour={permanentlyDeleteBehaviourNote}
            onRestoreTeacher={restoreTeacher} onDeleteTeacher={permanentlyDeleteTeacher}
            onRestoreStaff={restoreStaffMember} onDeleteStaff={permanentlyDeleteStaffMember}
            onRestoreSalaryPayment={restoreSalaryPayment} onDeleteSalaryPayment={permanentlyDeleteSalaryPayment}
            onRestoreAdvance={restoreAdvance} onDeleteAdvance={permanentlyDeleteAdvance}
            onRestoreAdvanceReturn={restoreAdvanceReturn} onDeleteAdvanceReturn={permanentlyDeleteAdvanceReturn}
          />
        )}
      </main>

      {showStudentForm && (
        <StudentFormModal classes={classes} subjectsList={subjectsList} streams={streams} initial={editingStudent} students={visibleStudents}
          onClose={() => { setShowStudentForm(false); setEditingStudent(null); }} onSave={saveStudent} />
      )}
      {showDepositForm && (
        <DepositFormModal students={visibleStudents} studentDues={studentDuesMap} onClose={() => setShowDepositForm(false)} onSave={saveDeposit} />
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
      {showJoiningForm && <JoiningFormModal student={showJoiningForm} deposits={visibleDeposits} onClose={() => setShowJoiningForm(null)} />}
      {showChargeModal && (
        <AddChargeModal students={visibleStudents} charges={visibleCharges} initialStudent={showChargeModal.student} curMonth={curMonth} onClose={() => setShowChargeModal(null)} onSave={addCharge} />
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
      {showNoteForm && (
        <NoteFormModal initial={editingNote} onClose={() => { setShowNoteForm(false); setEditingNote(null); }} onSave={saveNote} />
      )}
      {showAttendanceForm && (
        <AttendanceFormModal students={visibleStudents} initial={editingAttendance}
          onClose={() => { setShowAttendanceForm(false); setEditingAttendance(null); }} onSave={saveAttendance} />
      )}
      {showTestScoreForm && (
        <TestScoreFormModal students={visibleStudents} initial={editingTestScore}
          onClose={() => { setShowTestScoreForm(false); setEditingTestScore(null); }} onSave={saveTestScore} />
      )}
      {showBehaviourForm && (
        <BehaviourFormModal students={visibleStudents} initial={editingBehaviour}
          onClose={() => { setShowBehaviourForm(false); setEditingBehaviour(null); }} onSave={saveBehaviourNote} />
      )}
      {showTeacherForm && (
        <TeacherFormModal subjectsList={subjectsList} initial={editingTeacher} teachers={visibleTeachers}
          onClose={() => { setShowTeacherForm(false); setEditingTeacher(null); }} onSave={saveTeacher} />
      )}
      {showTeacherStatusModal && (
        <TeacherStatusModal teacher={showTeacherStatusModal.teacher} newStatus={showTeacherStatusModal.newStatus}
          onClose={() => setShowTeacherStatusModal(null)}
          onSave={(date, remarks) => { changeTeacherStatus(showTeacherStatusModal.teacher, showTeacherStatusModal.newStatus, date, remarks); setShowTeacherStatusModal(null); }} />
      )}
      {showStaffForm && (
        <StaffFormModal initial={editingStaffMember} staff={visibleStaff}
          onClose={() => { setShowStaffForm(false); setEditingStaffMember(null); }} onSave={saveStaffMember} />
      )}
      {showPersonJoiningForm && (
        <StaffJoiningFormModal person={showPersonJoiningForm.person} personType={showPersonJoiningForm.personType}
          onClose={() => setShowPersonJoiningForm(null)} />
      )}
      {showBatchScheduleForm && (
        <BatchScheduleFormModal classes={classes} subjectsList={subjectsList} teachers={visibleTeachers} infrastructure={infrastructure} initial={editingBatchSchedule}
          onClose={() => { setShowBatchScheduleForm(false); setEditingBatchSchedule(null); }} onSave={saveBatchScheduleEntry} />
      )}
      {showInfrastructureForm && (
        <InfrastructureFormModal initial={editingInfrastructure}
          onClose={() => { setShowInfrastructureForm(false); setEditingInfrastructure(null); }} onSave={saveInfrastructure} />
      )}
      {showSalaryForm && (
        <SalaryFormModal persons={mergeStaffAndTeachers(visibleTeachers, visibleStaff)} advances={visibleAdvances}
          onClose={() => setShowSalaryForm(false)} onSave={saveSalaryPayment} />
      )}
      {salarySlipData && (
        <SalarySlipModal payment={salarySlipData} onClose={() => setSalarySlipData(null)} />
      )}
      {showAdvanceForm && (
        <AdvanceFormModal persons={mergeStaffAndTeachers(visibleTeachers, visibleStaff)}
          onClose={() => setShowAdvanceForm(false)} onSave={saveAdvance} />
      )}
      {showAdvanceReturnForm && (
        <AdvanceReturnFormModal persons={mergeStaffAndTeachers(visibleTeachers, visibleStaff)} advances={visibleAdvances}
          onClose={() => setShowAdvanceReturnForm(false)} onSave={saveAdvanceReturn} />
      )}
      {showPersonStatement && (
        <PersonStatementModal
          person={showPersonStatement.personType === "teacher" ? teacherById[showPersonStatement.personId] : staffById[showPersonStatement.personId]}
          personType={showPersonStatement.personType}
          salaryPayments={visibleSalaryPayments.filter(p => p.personId === showPersonStatement.personId && p.personType === showPersonStatement.personType)}
          advances={visibleAdvances.filter(a => a.personId === showPersonStatement.personId && a.personType === showPersonStatement.personType)}
          advanceReturns={visibleAdvanceReturns.filter(r => r.personId === showPersonStatement.personId && r.personType === showPersonStatement.personType)}
          onClose={() => setShowPersonStatement(null)}
          onViewSlip={(p) => setSalarySlipData(p)}
        />
      )}
      {expenseReceiptData && (
        <ExpenseReceiptModal expense={expenseReceiptData} onClose={() => setExpenseReceiptData(null)} />
      )}
      {chargeReceiptData && (
        <ChargeReceiptModal line={chargeReceiptData.line} student={chargeReceiptData.student} onClose={() => setChargeReceiptData(null)} />
      )}
      {showBankTxnForm && (
        <BankTxnFormModal onClose={() => setShowBankTxnForm(false)} onSave={addBankTransaction} />
      )}
      {bankTxnReceiptData && (
        <BankTxnReceiptModal txn={bankTxnReceiptData} onClose={() => setBankTxnReceiptData(null)} />
      )}
      {showCreditForm && (
        <CreditFormModal onClose={() => setShowCreditForm(false)} onSave={addCreditTransaction} />
      )}
      {creditReceiptData && (
        <CreditReceiptModal txn={creditReceiptData} onClose={() => setCreditReceiptData(null)} />
      )}
      {showPayInterestModal && (
        <PayInterestModal creditTxn={showPayInterestModal} interestPaidSoFar={interestPaidByCreditId[showPayInterestModal.id] || 0}
          onClose={() => setShowPayInterestModal(null)} onSave={addInterestPayment} />
      )}
      {interestReceiptData && (
        <InterestReceiptModal payment={interestReceiptData.payment} creditTxn={interestReceiptData.creditTxn} onClose={() => setInterestReceiptData(null)} />
      )}
      {showSettingsModal && (
        <SettingsModal initial={instituteSettings} onClose={() => setShowSettingsModal(false)} onSave={saveInstituteSettings} />
      )}
    </div>
    </InstituteSettingsContext.Provider>
  );
}

// ---- "Attendance" sub-tab wrapper — hosts its own inner pill row with two
// panels: "Mark Attendance" (the existing batch-wise fill form,
// MarkAttendanceTab, untouched) and "View Attendance" (new — browse/search
// previously saved attendanceLog sessions and edit them in place, see
// ViewAttendanceTab below). Both read/write the same attendanceLog
// collection via the same onSave (saveAttendanceLog), so anything edited in
// View Attendance shows up immediately if reopened in Mark Attendance. ----

