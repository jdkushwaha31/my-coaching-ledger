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
  ClipboardList, Percent, FileText, Search, Banknote, Landmark, CreditCard,
  GraduationCap, CalendarCheck, ClipboardCheck, MessageSquare, FileBarChart2,
  UserCog, Clock, BadgeCheck, Settings
} from "lucide-react";

// ============================================================================
// UPDATE NOTES — read this before touching anything below.
//
// IMPORTANT: every existing feature in this file (student lifecycle,
// deposits, charges, write-offs, Banking ledger, Credit/Loan ledger,
// receipts, statements, joining form, promote/exit/undo, trash/restore,
// etc.) is intact and unchanged in behavior except where explicitly noted
// below. Nothing was removed. If you (a future Claude, or anyone editing
// this file) are asked to add more on top of this, keep that same rule:
// add / fix, never silently drop something that already worked.
//
// Changes made in this update pass:
//   1. Fee & Class Structure → "Manage Streams" was floating in the
//      SectionHeader action slot, misaligned from the "Fee Matrix Pricing"
//      / "Class & Subject List" sub-tab pill row underneath it. It's now a
//      third button inside that same bordered pill row, right after
//      "Class & Subject List", styled to match (see StructureTab).
//   2. Dashboard "Net Liquidity" (Cash Balance / Online Balance) used a
//      simplified formula — deposits minus expenses only — which silently
//      ignored Cash⇄Bank transfers, Credit/Loan entries, and Interest
//      payments. It now reuses the exact same running-balance figures
//      (bankingCashBalance / bankingBankBalance) the Banking tab computes,
//      so the two screens always agree to the rupee (see the "Dashboard
//      Net Liquidity" note near the Banking Ledger block, and the
//      totalCashBalance / totalOnlineBalance assignment).
//   3. Dashboard was reorganized into clearly labeled sections (Overview →
//      Financial Health → Trends & Activity) and gained a new "Top
//      Outstanding Dues" panel for a quick at-a-glance view of who owes
//      the most, without needing to open the Dues tab (see DashboardTab).
//   4. Center Statement: the Student ID under each row was a clickable
//      button that also toggled the mini "student info" panel open. It's
//      now plain, non-clickable text — the info panel still opens, just
//      via a separate small ▸/▾ toggle next to the ID instead of the ID
//      itself being clickable. Search now also matches on mobile number,
//      not just name / Student ID (see CenterStatementTab).
//   5. Banking Statement: Student ID was already shown on every row; search
//      now also matches mobile number in addition to Student ID / name /
//      description / remarks (see BankingTab).
//
// Changes made in this second update pass:
//   6. Fee & Class Structure → "Manage Streams" is now a real third tab
//      (not a modal launched from a button) inside the same pill row as
//      "Fee Matrix Pricing" / "Class & Subject List" — clicking it swaps
//      the panel below inline, exactly like the other two. The old modal
//      component was converted to an inline panel, StreamManagerPanel
//      (see StructureTab).
//   7. Banking → Credit & Loan Ledger: interest payments now also have
//      their own separate "Interest Payments Log" section (below the
//      Credit & Loan Ledger, same pattern as the Cash ⇄ Bank Transfer
//      Logs section), so they can be deleted independently instead of
//      only from inside a credit entry's expanded history (which is now
//      view-only) (see BankingTab).
//   8. Center Statement & Banking Statement: the Student ID under each row
//      is now plain, non-clickable text with no ▸/▾ arrow at all — the
//      per-row "view student info" toggle from the previous pass has been
//      removed entirely, per request (see CenterStatementTab / BankingTab).
//   9. Every transaction list ("statement") was sorted by date only, so
//      same-day entries could appear out of the order they actually
//      happened in. Every deposit/charge/expense/bank-transfer/credit/
//      interest-payment record now also stores a `createdAt` timestamp at
//      creation time, and every statement/log sort (Center Statement,
//      Banking Statement, Student Statement, Deposits/Charges/Expenses
//      logs, Credit Ledger, Transfer logs) uses date + createdAt together
//      via the new chronoKey()/compareChrono() helpers — so same-day
//      entries now land in true chronological order. No time is ever
//      displayed anywhere; only the date still shows, exactly as before.
//  10. Students Register → "Total Due": a student who has deposited extra
//      or paid in advance now shows their Total Due as a NEGATIVE amount
//      (e.g. "-₹500 (advance)") instead of ₹0. computeStudentLedger() now
//      returns an additional `rawBalance` (unclamped, can go negative)
//      alongside the existing `balance` (still clamped at 0) — every other
//      total in the app (Dues tab, Dashboard, totalOutstanding, etc.)
//      keeps using the clamped `balance` exactly as before; only the
//      Students Register table reads the new signed figure.
//  11. Every date shown anywhere in the UI (statements, receipts, the
//      Joining Form, Trash tab, student details, etc.) now displays as
//      DD-MM-YYYY via the new fmtDate() helper. Nothing about how dates
//      are stored, filtered, or compared changed — <input type="date">/
//      "month"> fields, Firestore fields, and all string comparisons still
//      use the original YYYY-MM-DD (ISO) format; fmtDate() is purely a
//      last-mile display formatter, never used for storage or logic.
//  12. Student form gained a "Joining Date" field (type="date", optional).
//      If left blank, it's auto-filled with today's date at save time
//      (see submit() in StudentFormModal). Stored as `joiningDate` on the
//      student record and shown in the Students Register expanded row and
//      on the printed Joining Form.
//
// Changes made in this third update pass:
//  13. Add Student → "Joining Date" field now visibly defaults to TODAY'S
//      date the moment the form opens (not just silently at save time as
//      before) — office staff see it pre-filled and can change it to
//      backdate a student if needed; if they don't touch it, today's date
//      is what gets saved (see the joiningDate useState in
//      StudentFormModal).
//  14. Student Statement → Description column no longer shows the small
//      "Unpaid" stamp next to an outstanding charge line. The Debit /
//      Credit / running Balance columns already show exactly what's owed,
//      so the stamp was redundant clutter (see StudentStatementModal).
//  15. Every date shown anywhere in the app now displays as "D Month
//      YYYY" (e.g. "17 August 2026") instead of "DD-MM-YYYY" — this is a
//      one-line change to the shared fmtDate() helper, so it applies
//      everywhere at once: Students Register, Student/Center/Banking
//      Statements, all receipts & slips, the Joining Form, Trash tab,
//      credit/interest logs, everywhere. Storage format (YYYY-MM-DD),
//      <input type="date"/"month">, filtering, and sorting are completely
//      untouched — only the last-mile display formatter changed.
//  16. Printable Statement (Student Statement, Center Statement, Banking
//      Statement) — the "Print / Export" button used to clone the on-
//      screen preview's HTML into a bare popup window that never loaded
//      the app's Tailwind styling or fonts, so everything printed as
//      unstyled black text with no layout, colors, or letterhead — even
//      though the on-screen preview looked correct. Each of these three
//      print windows now loads the same Google Fonts import and the
//      Tailwind CDN the live app effectively relies on, plus a proper A4
//      @page rule, a bordered letterhead document wrapper matching the
//      Joining Form's professional look, and print-safe table rules (no
//      row splitting across pages, repeating header). The on-screen
//      preview markup itself is unchanged — only what the popup window
//      loads before printing it changed.
//
// Changes made in this fourth update pass:
//  17. NEW FEATURE — Notes: a simple internal notepad tab (sidebar, right
//      above Trash / Restore) completely separate from the financial
//      ledger. Add / edit / pin / delete free-text notes (title + body),
//      cloud-synced like everything else via a new "notes" Firestore
//      collection. Pinned notes float to the top. Nothing here touches
//      any student, deposit, charge, or balance (see NotesTab,
//      NoteFormModal, saveNote / toggleNotePin / deleteNote).
//  18. BUG FIX — Statement dates wrapping onto 3 lines (DD on one line,
//      Month on the next, YYYY on the last): fmtDate() itself always
//      produced a correct single-line "D Month YYYY" string — the actual
//      bug was that the narrow table cells showing it had no
//      `whitespace-nowrap`, so the browser wrapped the string wherever it
//      ran out of column width. Added `whitespace-nowrap` to every date
//      cell across every statement/log table (Deposits, Charges,
//      Expenses, Center Statement, Banking Statement, Cash⇄Bank Transfer
//      Logs, Credit & Loan Ledger, Interest Payments Log, Trash tab,
//      Student Statement) — dates now always render on one line.
//  19. Banking tab reorganized into four separate, professional pill-tab
//      panels — Banking Statement, Cash ⇄ Bank Transfer Logs, Credit &
//      Loan Ledger, Interest Payments Log — instead of one long stacked
//      scroll, using the same sub-tab pattern already used by Fee &
//      Class Structure (see StructureTab). Every feature that existed
//      before (search & filters on the main statement, print/export,
//      add/delete on each log, expand a credit entry's interest-payment
//      history, Pay Interest) is fully intact — this only changes how
//      the four sections are navigated, not what they do (see
//      BankingTab, BANKING_SUB_TABS).
//  20. BUG FIX — a student saved with ZERO subjects/batches selected was
//      being silently charged the 1-subject Fee Matrix rate every month,
//      because both computeStudentLedger() and the dashboard's
//      forecastForMonth() did `batches.length || 1`, and expectedFeeFor()
//      itself also forced any falsy batch count up to 1. A batch count of
//      0 is falsy in JavaScript, so "no subjects chosen" was
//      indistinguishable from "1 subject chosen" and got billed as if
//      the student had taken a single subject they were never actually
//      enrolled in. expectedFeeFor() now returns ₹0 immediately for a
//      batch count of 0 (before ever consulting the fee matrix), and
//      both call sites no longer force that fallback to 1 — a
//      subject-less student now correctly accrues ₹0 tuition instead of
//      the 1-subject rate. Students with 1+ subjects are billed exactly
//      as before.
//
// Changes made in this fifth update pass:
//  21. NAVIGATION — the six sidebar tabs Students Register, Pending Dues,
//      Deposits Log, Charges, Center Statement, and Fee & Class Structure
//      are now one sidebar entry, "Student Management" (id
//      "students-management"), with an internal bordered pill row of six
//      sub-tabs in that exact left-to-right order — same pattern already
//      used by Fee & Class Structure's own 3-way pill row and Banking's
//      4-way pill row. This is purely a navigation regroup: StudentsTab,
//      DuesTab, DepositsTab, ChargesTab, CenterStatementTab, and
//      StructureTab are all reused completely unchanged, wired with the
//      exact same props (search boxes, filters, Add Student / Add Charge
//      / Record Deposit / Print-Export buttons, receipts, modals,
//      add/edit/delete/restore actions) they had as standalone tabs — none
//      of that behavior changed. See StudentManagementTab and
//      STUDENT_MANAGEMENT_SUB_TABS. Fee & Class Structure's own internal
//      3-way pill row (Fee Matrix Pricing / Class & Subject List / Manage
//      Streams) is untouched and still lives one level down, inside the
//      new "Fee & Class Structure" sub-tab. Expenses Log and Banking are
//      unaffected and remain separate sidebar tabs, exactly as before.
//
// Changes made in this sixth update pass:
//  22. NEW FEATURE — Academic Monitoring: a new sidebar tab (id
//      "academic-monitoring", right after Student Management) tracking
//      student academic performance, for internal use and for
//      parent-facing printouts. Uses the exact same bordered pill-tab
//      pattern as Fee & Class Structure / Student Management (see
//      AcademicMonitoringTab / ACADEMIC_MONITORING_SUB_TABS), with four
//      sub-tabs in this order: Attendance (mark daily/class-wise
//      Present/Absent/Late per student, date filter, per-student
//      attendance % summary — see AttendanceTab), Test Scores (test name,
//      subject, date, marks, remarks per student, with per-student score
//      history and class-wise averages — see TestScoresTab), Behaviour &
//      Conduct (dated notes tagged positive / neutral / needs-attention —
//      see BehaviourTab), and Performance Report (a printable A4,
//      parent-facing summary combining attendance %, recent test scores,
//      and behaviour notes for one student, reusing the same Tailwind CDN
//      + Google Fonts print-popup pattern as the Joining Form / Center
//      Statement — see PerformanceReportTab). Each of Attendance, Test
//      Scores, and Behaviour & Conduct has its own Firestore collection
//      ("attendance", "testScores", "behaviourNotes" respectively), synced
//      live via onSnapshot exactly like every other collection in this
//      file, and each fully supports soft-delete + Trash/Restore +
//      permanent delete, wired into the existing TrashTab and trashCount
//      (see AttendanceFormModal / TestScoreFormModal / BehaviourFormModal
//      and the saveAttendance / saveTestScore / saveBehaviourNote +
//      soft/restore/permanent-delete functions below). Nothing about any
//      existing tab, collection, or handler changed.
//
// Changes made in this seventh update pass:
//  23. NEW FEATURE — Teacher Management, Batch Schedule, Staff, Teacher
//      Performance, Attendance (batch-wise), and Test Marks. Five new
//      Firestore collections, synced live via onSnapshot exactly like
//      every other collection in this file: "teachers", "staff",
//      "batchSchedule", "attendanceLog", "tests".
//      NOTE on naming: the brief asked for a Firestore collection named
//      "attendance" for the new batch-wise marking feature, but this file
//      already has a per-student "attendance" collection powering the
//      existing Academic Monitoring → Attendance sub-tab (see change #22
//      above). That collection is untouched — this pass uses a
//      differently-named collection, "attendanceLog", for the new
//      roster/date/subject-based marking feature so the two never collide
//      or get mixed up. Flagging this rename since it wasn't explicitly
//      asked for.
//    - Teacher Management (new sidebar tab, right after Student
//      Management): sub-tabs Teachers (register/list/expand-row, mirrors
//      StudentsTab + StudentFormModal — see TeachersTab /
//      TeacherFormModal), Performance (see computeTeacherPerformance /
//      TeacherPerformanceTab), Batch Schedule (see BatchScheduleTab /
//      BatchScheduleFormModal), and Staff (reuses the Teacher form shell
//      minus expertise/batch fields, plus a free-text Title — see
//      StaffTab / StaffFormModal). Batch Schedule and Staff were placed
//      here as sub-tabs rather than their own sidebar entries, to keep
//      the sidebar from getting crowded — flagged as a judgment call per
//      the brief, easy to promote to top-level nav later if preferred.
//    - Attendance (new sidebar tab): sub-tabs "Mark Attendance" (date +
//      class + subject, autofill from Batch Schedule only when the date
//      is today and exactly one schedule window matches the current
//      time, defaults everyone to Absent, idempotent upsert keyed by
//      date+class+subject — see MarkAttendanceTab) and "Test Marks"
//      (auto-generated Test ID {class}{subject}{YY}{seq}, roster pulled
//      from the matching Batch Schedule record — see TestMarksTab). Test
//      Marks was placed under Attendance rather than its own sidebar
//      entry, same sidebar-crowding judgment call as above.
//    - Teacher Performance is intentionally NOT hardcoded to one
//      weighting formula — see computeTeacherPerformance(), an isolated,
//      clearly-commented function with the attendance/test-score weights
//      called out as the one thing to confirm/tune. The Performance
//      sub-tab shows the computed summary AND the batch-level numbers it
//      was built from, so it's auditable rather than a black box.
//    - "Student active in a batch as of date X" (Test Marks roster) reuses
//      the same batchHistory-by-month logic batchesForMonth() already
//      uses for fee calculation (matched on the selected test date's
//      month) — see studentsActiveInBatch(). Flagged: this checks the
//      student's CURRENT class against the batch's class, since class
//      itself isn't tracked with per-date history the way subjects/
//      batches are (only the latest class change is snapshotted via
//      Promote). Worth confirming if that's precise enough.
//    - Trash/Restore: Teachers and Staff are fully wired into the
//      existing Trash tab (soft delete / restore / permanent delete),
//      same as students. Batch Schedule entries use a simple confirm +
//      permanent delete (no trash bin) since they're setup/config
//      records, not financial or attendance history. Attendance and Test
//      Marks records save as one upserted document per key (date+class+
//      subject, or the generated Test ID) exactly as specified, so
//      re-opening the same combination edits in place rather than
//      creating a duplicate to trash.
//      Nothing about any existing tab, collection, component, or handler
//      changed.
//
// Changes made in this fourth update pass:
//  24. Teacher Management → renamed to "Institute Management" in the
//      sidebar label and the tab's own SectionHeader/eyebrow text only —
//      the internal id stays "teacher-management" so nothing that already
//      referenced it (routing, trashCount, etc.) broke. Subtitle reworded
//      to mention Salary and Advance now living here too.
//      NEW FEATURE — Salary (see SalaryTab / SalaryFormModal /
//      SalarySlipModal): a new sub-tab, right after "Staff", for paying
//      teachers and other staff. The picker merges visibleTeachers and
//      visibleStaff into one list (see mergeStaffAndTeachers()) with a
//      personType flag ("teacher"|"staff") carried through everywhere.
//      Pay Salary writes a `salaryPayments` record (own generateSalaryId()
//      sequence, "SAL<year>####", same mechanism as generateStaffId) and,
//      when the net amount paid is > 0, a matching banking feed line
//      (kind: "debit", bucket by mode) so it lands in the Banking
//      Statement's running Cash/Bank balance exactly like an expense —
//      see bankingSalaryLines, folded into bankingFeedAsc alongside
//      bankingExpenseLines. A printable salary slip (ChargeReceiptModal's
//      print-window pattern) is shown after saving and can be reopened
//      from the Salary history table.
//      NEW FEATURE — Advance (see AdvanceTab / AdvanceFormModal): another
//      new sub-tab, right after "Salary", for recording an advance given
//      to a teacher or staff member. Give Advance writes an `advances`
//      record (own generateAdvanceId() sequence, "ADV<year>####|,
//      outstandingAmount starts equal to amount, status "open") and its
//      own banking debit line (bankingAdvanceLines), same treatment as an
//      expense. The Salary form reads a person's open advances (oldest
//      first) and lets the office deduct part or all of the outstanding
//      total from a salary payment; the deducted amount is subtracted
//      from that payment's net payable and walked across the person's
//      open advance records (oldest first) reducing each one's
//      outstandingAmount, flipping status to "settled" at zero — see the
//      settlement loop inside saveSalaryPayment(). The salary slip lists
//      which advance record(s) were deducted, with date/reference.
//      Both new collections follow the exact same onSnapshot subscribe /
//      visibleX = x.filter(r => !r.deleted) / trashedX / soft-delete
//      pattern as teachers/staff, and are fully wired into the existing
//      Trash tab (new "Deleted Salary Payments" / "Deleted Advances"
//      sections, counted in trashCount) exactly like every other
//      collection. ASSUMPTION: soft-deleting a salary payment does not
//      reverse any advance settlement it made (no existing soft-delete in
//      this file reverses side effects either, e.g. deleting a deposit
//      doesn't undo the charges it paid off) — flagging this in case the
//      office wants that behavior changed.
//      NEW — Per-person Statement (see PersonStatementModal): a combined,
//      chronological (compareChrono) history of every salary payment and
//      every advance given/settled for one teacher or staff member, with
//      running totals, modeled directly on StudentStatementModal. Opens
//      from a row in Salary/Advance history or from a new small
//      "Statement" action added next to the existing Edit/Remove actions
//      on each row in the Teachers and Staff registers (see TeachersTab /
//      StaffTab) — those two tables' existing columns and actions are
//      otherwise untouched.
//
// Changes made in this eighth update pass:
//  25. BUG FIX — advance settled from salary not showing correctly in the
//      statement. Root causes, confirmed by walking every place the brief
//      flagged:
//        a) saveSalaryPayment()'s open-advances filter matched a person by
//           personId ALONE, unlike SalaryFormModal's outstandingAdvance
//           preview (which also checked personType) — a real scoping gap
//           if a teacher and a staff member ever shared a personId.
//           Fixed by factoring the "find this person's open advances
//           oldest-first, and apply a deduction across them" logic into
//           two shared helpers — openAdvancesFor() and
//           allocateAdvancePayoff() (both scoped by personId AND
//           personType) — now used by SalaryFormModal's live preview,
//           saveSalaryPayment()'s settlement loop, AND
//           saveAdvanceReturn()'s settlement loop (see #26 below), so all
//           three can never drift apart again.
//        b) Confirmed as the strongest suspect: bankingSalaryLines only
//           ever created a line when netPaid > 0, so a salary payment
//           whose advance deduction fully absorbed the base salary
//           (netPaid = 0) left NO trace anywhere in the Banking Statement
//           — the settlement was completely invisible even though it
//           happened. Fixed with a new bankingSalarySettlementLines feed
//           — one "Advance Settled via Salary <slipId>" line per advance
//           actually settled by a payment (same per-advance breakdown
//           PersonStatementModal's settlementLines already uses, so the
//           two always agree), created regardless of whether netPaid
//           ended up 0. These are zero-cash-impact — kind: "memo" — the
//           cash already moved when the advance was originally given
//           (bankingAdvanceLines); the running-balance pass in the
//           Banking Ledger computation now has an explicit memo branch
//           that leaves runningCash/runningBank untouched, so nothing is
//           ever double-counted. The existing bankingSalaryLines DEBIT
//           line is untouched — still only created when real cash/bank
//           actually moved (netPaid > 0).
//        c) PersonStatementModal itself was fine internally, but the
//           call site that builds its salaryPayments/advances props
//           (App's render of <PersonStatementModal .../>) had the exact
//           same personId-only filtering gap as (a) above — fixed to
//           filter by personId AND personType, so its
//           settlementLines/runningOutstanding can never show stale or
//           cross-person data.
//        d) SalaryTab's "Advance Deducted" column and the printed salary
//           slip were AUDITED and found already correct — saveSalaryPayment
//           always overwrites the saved record's advanceDeducted with the
//           actual (post-clamp) amount before saving, so both already
//           read actualDeducted/settledAdvances, never the raw requested
//           input, including on partial settlement. No change needed
//           there; confirming it explicitly since the brief asked for it
//           to be checked.
//      Added two new banking line types to BANKING_TXN_TYPE_META —
//      advance_settled and advance_returned (the latter for #26 below) —
//      so both show a proper label/Stamp in the Banking Statement's Type
//      column and filter dropdown instead of falling back to the raw
//      type string.
//  26. NEW FEATURE — Return Advance (see AdvanceReturnFormModal /
//      saveAdvanceReturn): a teacher/staff member can now directly return
//      advance money (e.g. handing back cash) outside of a salary run.
//      A new "Return Advance" button sits immediately to the left of
//      "Give Advance" in AdvanceTab's action row, same visual weight.
//      The new modal mirrors AdvanceFormModal (PersonPicker, Amount,
//      Date, Payment Mode, optional Remarks) and shows the selected
//      person's current outstanding advance total, sourced from the same
//      openAdvancesFor() helper #25 introduced. On save, the returned
//      amount is walked across that person's open advances oldest-first
//      via the shared allocateAdvancePayoff() helper (the exact same one
//      saveSalaryPayment() uses), reducing outstandingAmount and flipping
//      status to "settled" at zero — so a salary deduction and a direct
//      return can never disagree about how a person's advances get paid
//      down. Stored in a new "advanceReturns" Firestore collection (own
//      generateAdvanceReturnId() sequence, "ADR<year>####", same
//      mechanism as generateAdvanceId), synced live via onSnapshot and
//      fully wired into Trash/Restore (new "Deleted Advance Returns"
//      section in TrashTab, counted in trashCount), exactly like every
//      other collection in this file. AdvanceTab also gained a second,
//      read-only-style "Advance Returns" history table below the existing
//      Advances table (Date / Person / Amount Returned / Mode / Remove),
//      so the soft-delete action actually has a button to reach it from,
//      same as every other collection's own tab. This is real money
//      coming back IN — a new bankingAdvanceReturnLines feed (type:
//      "advance_returned", kind: "credit") was added, folded into
//      bankingFeedAsc alongside every other banking line type; Dashboard's
//      "Net Liquidity" figures pick this up automatically since they're
//      already sourced from the same running bankingCashBalance /
//      bankingBankBalance the Banking tab computes (see UPDATE NOTES #2),
//      no separate Dashboard change was needed. PersonStatementModal
//      gained a matching new timeline line kind ("advance_returned"),
//      reducing runningOutstanding at the correct chronological point via
//      compareChrono, same as advance_settled lines. ASSUMPTION, same one
//      UPDATE NOTES #24 already flags for salary payments: soft-deleting
//      an advance return does not reverse the advance settlement it made
//      — no existing soft-delete in this file reverses side effects
//      either — flagging this in case the office wants that changed.
//  27. NAVIGATION — the standalone "Attendance" sidebar tab (id
//      "attendance", AttendanceMgmtTab / ATTENDANCE_MGMT_SUB_TABS, see
//      UPDATE NOTES #23) has been removed. Its two sub-tabs,
//      MarkAttendanceTab ("Mark Attendance") and TestMarksTab ("Test
//      Marks") — both batch-wise, driven off batchSchedule/attendanceLog
//      and batchSchedule/tests respectively — are now rendered directly
//      inside Academic Monitoring instead, REPLACING the older per-student
//      "Attendance" and "Test Scores" sub-tabs that used to live there
//      (AttendanceTab / TestScoresTab, reading the older "attendance" /
//      "testScores" collections). ACADEMIC_MONITORING_SUB_TABS now reads,
//      left to right: Mark Attendance → Test Marks → Behaviour & Conduct
//      → Performance Report, and AcademicMonitoringTab's subTab now
//      defaults to "mark-attendance" (the same role the old "attendance"
//      id played as the default). AttendanceMgmtTab and
//      ATTENDANCE_MGMT_SUB_TABS themselves have been deleted as dead code
//      now that nothing renders them; MarkAttendanceTab and TestMarksTab
//      are untouched, just relocated to render directly inside
//      AcademicMonitoringTab with the same props they always took.
//      IMPORTANT, called out per the brief's request: AttendanceTab,
//      TestScoresTab, the "attendance" / "testScores" Firestore
//      collections, their onSnapshot listeners, and their Trash/Restore
//      support (softDeleteAttendance / softDeleteTestScore / restore /
//      permanent-delete, the "Deleted Attendance" / "Deleted Test Scores"
//      sections in TrashTab) are all completely UNTOUCHED — nothing was
//      deleted there, exactly as instructed, since PerformanceReportTab
//      (the "Performance Report" sub-tab) still reads attendance/
//      testScores props sourced from those same old collections. This
//      DOES create the visible mismatch the brief asked to be flagged
//      rather than silently resolved: going forward, new attendance/test
//      data entered through the visible "Mark Attendance" / "Test Marks"
//      sub-tabs is written to the newer attendanceLog/tests collections
//      (see UPDATE NOTES #23), NOT to the older attendance/testScores
//      collections Performance Report reads from — so Performance
//      Report's attendance % and test score history will progressively
//      diverge from what "Mark Attendance"/"Test Marks" show, since
//      nothing in the visible UI writes to attendance/testScores anymore
//      (their only entry points, the old AttendanceTab/TestScoresTab
//      "Add"/"Edit" buttons, are no longer rendered anywhere — the
//      AttendanceFormModal/TestScoreFormModal components, their
//      onAdd/onEdit/onRemove handlers, and their top-level state are ALL
//      still fully intact and unchanged, just currently unreachable from
//      any button). Please confirm whether Performance Report should
//      instead be pointed at attendanceLog/tests, or whether the old
//      Attendance/Test Scores entry forms should be restored somewhere so
//      the two stay in sync — left as-is pending your call, per the
//      brief's explicit instruction not to silently pick a side.
//
// Changes made in this fourth update pass:
//  28. Academic Monitoring → the "Mark Attendance" sub-tab is renamed
//      "Attendance" and now has its own inner pill row with two panels:
//      "Mark Attendance" (unchanged — still MarkAttendanceTab, the
//      existing batch-wise fill form) and a new "View Attendance" panel
//      (new component ViewAttendanceTab) to browse/search previously
//      saved attendanceLog sessions — filter by class/subject/date, free-
//      text search by class/subject/student name/Student ID, expand a
//      session to see the roster, and edit + re-save statuses in place.
//      Both panels read/write the exact same attendanceLog collection via
//      the same onSave (saveAttendanceLog, same date_class_subject upsert
//      key), so an edit made in View Attendance is immediately reflected
//      if that same session is reopened in Mark Attendance, and vice
//      versa. New wrapper component AttendanceSectionTab hosts the inner
//      pill row and switches between the two; ACADEMIC_MONITORING_SUB_TABS'
//      "mark-attendance" entry now routes to it instead of directly to
//      MarkAttendanceTab (id kept as "mark-attendance" so nothing else
//      referencing that id needed to change).
//  29. Academic Monitoring → the "Test Marks" sub-tab is renamed "Scores"
//      and, same pattern as #28, now has its own inner pill row: "Fill
//      Marks" (unchanged — still TestMarksTab) and a new "View & Search
//      Scores" panel (new component ViewScoresTab) to browse the "tests"
//      collection with filters (class/subject/date) plus free-text search
//      across Test ID, description, class, subject, and student name/
//      Student ID. Expanding a test reveals its full score table with an
//      optional "Sort: Top Scorers" toggle (ranks students by marks,
//      highest first, with a #1/#2/... badge) and lets you edit Max
//      Marks, Description, and any student's marks, saving through the
//      same onSave (saveTest, upserts by testId) TestMarksTab already
//      uses — so nothing about how tests are stored changed, this only
//      adds a second way to reach and edit the same records. New wrapper
//      component ScoresSectionTab hosts the inner pill row; the
//      "test-marks" sub-tab id is unchanged.
//
// Changes made in this fifth update pass:
//  30. Test ID generation (generateTestId) no longer includes the literal
//      word "Class" when the class field itself is stored as e.g. "Class
//      12" — a new classCodeForId() strips a leading "Class" (any casing)
//      before building the ID, so "Class 12Mathematics2601" becomes
//      "12Mathematics2601". This only changes the generated ID string;
//      the actual `class` field/value everywhere else (display, filters,
//      Firestore storage) is completely untouched.
//  31. Attendance — saveAttendanceLog now also captures `time` (HH:MM,
//      auto-captured once at first save via nowTimeStr(), shown via the
//      new fmtTime() helper) and `remarks` (free text, entered in Mark
//      Attendance). Both are new fields on the attendanceLog doc,
//      additive — old records without them just render with no time/
//      remarks shown, nothing breaks.
//  32. Attendance/View Attendance — new dedicated Edit and Delete buttons
//      on every row (visible without expanding first). Clicking a row
//      still only opens a READ-ONLY roster view (this used to be
//      editable directly — that accidental-edit path is now closed).
//      "Edit" opens a separate panel with Date, Time, and Remarks inputs
//      plus per-student status toggles, saved through the new
//      editAttendanceLog() (deletes+recreates the doc under the new
//      date_class_subject key if the date changed, so nothing is
//      duplicated or orphaned; class/subject aren't editable here since
//      that would change which batch the session belongs to — out of
//      scope of "edit the date and time"). "Delete" calls the new
//      deleteAttendanceLog() (window.confirm, then a hard delete — no
//      Trash/restore for this collection; see the existing note above
//      about the attendanceLog/tests vs. old attendance/testScores Trash
//      mismatch — flagging this as the same kind of assumption rather
//      than silently building out full Trash support for it).
//  33. Scores/View & Search Scores — same pattern as #32: dedicated Edit
//      and Delete buttons on every row; expanding a row is READ-ONLY
//      (also gained its own "Sort: Top Scorers" toggle, independent of
//      Edit mode, so you can rank without entering edit). "Edit" opens a
//      panel where Class, Subject, Date, Maximum Marks, Description, and
//      every student's marks are all editable, saved through the new
//      editTest() — writes to the same Firestore doc id (stable since
//      creation) rather than looking up by testId, and regenerates the
//      testId via generateTestId() if class/subject/date changed, so
//      editing those fields renames/moves the test in place instead of
//      creating a duplicate or leaving the old testId as an orphan (a UI
//      hint appears when class/subject/date differ from the saved values
//      to make that clear). "Delete" calls the new deleteTest() (confirm
//      + hard delete, same rationale as #32).
//  34. BUGFIX — Performance Report (Academic Monitoring → Performance
//      Report) was reading the old, no-longer-written-to `attendance` /
//      `testScores` props, so it always showed "No data" / stale numbers
//      no matter how much was marked in Mark Attendance / Fill Marks —
//      this was flagged as a known risk in update #27 and is now fixed.
//      PerformanceReportTab is repointed at `attendanceLog` / `tests`
//      (the same batch-wise collections everything else already uses)
//      and derives each student's attendance % / recent scores by
//      scanning those collections for that student's own record/score on
//      each saved session/test. AcademicMonitoringTab's "report" sub-tab
//      now passes attendanceLog/tests instead of attendance/testScores;
//      the old attendance/testScores props are left wired through
//      unchanged (per convention) even though this tab no longer reads
//      them. "X day(s) recorded" is relabelled "X session(s) recorded"
//      to match what's actually being counted (one per saved
//      date+class+subject session the student appears in, not one per
//      calendar day).
//
// Changes made in this sixth update pass:
//  35. View & Search Scores — each test row now shows how many students
//      appeared ("N student(s) appeared" in the summary line, and "N
//      student(s) on this test" inside the Edit panel), and the marks
//      table (both the read-only view and the Edit panel) always has a
//      leading "#" row-number column now instead of only showing numbers
//      when "Sort: Top Scorers" was on.
//  36. Test IDs are now always fully UPPERCASE (generateTestId uppercases
//      the whole generated string). The sequence-number lookup that
//      finds "the next number for this prefix" now also compares
//      existing testIds case-insensitively, so older mixed-case IDs
//      already in Firestore still get recognized and numbered correctly
//      going forward instead of restarting from 01.
//  37. Attendance — AttendanceSectionTab's header now shows a running
//      total ("N attendance session(s) recorded so far"), and View
//      Attendance gives every session its own permanent sequence number
//      ("Session #N", oldest = #1, ascending) plus a "Showing X of Y"
//      line above the list — together these answer "how many classes'
//      attendance has been filled so far" both as a total and per-row.
//  38. Scores — same pattern as #37: ScoresSectionTab's header shows a
//      running total ("N test(s) conducted so far"), and View & Search
//      Scores gives every test its own permanent sequence number ("Test
//      #N", oldest = #1) plus a "Showing X of Y" line.
//  39. Add/Edit Batch modal (Teacher Management → Batch Schedule) — Batch
//      Name now auto-fills from Class + Subject as either is picked
//      (e.g. Class "12" + Subject "Physics" -> "12 Physics"; Class "JEE"
//      + Subject "Mathematics" -> "JEE Mathematics", reusing the same
//      classCodeForId() from #30 so a class stored as "Class 12" still
//      auto-fills to "12 Physics" not "Class 12 Physics"). Auto-fill
//      stops the moment the user types into Batch Name themselves (a
//      small hint line explains this), and never overwrites an existing
//      batch's saved name when opening it to edit — only applies to a
//      genuinely untouched name, whether on a new batch or after
//      clearing an existing one.
//
// Changes made in this seventh update pass:
//  40. View Attendance / View & Search Scores — the "#" row badge is now
//      dynamic: it's the row's position within whatever is currently
//      displayed (i.e. after search/class/subject/date filters, and —
//      for a test's marks table — after the "Sort: Top Scorers" toggle),
//      so it renumbers live as you filter/search/sort instead of showing
//      a fixed lifetime session/test number. The fixed sessionNumberById
//      / testNumberById lookups from update #37/#38 are removed — the
//      "Showing X of Y" line and the header running totals (from #37/#38)
//      are untouched and still reflect the true lifetime totals.
//  41. Add/Edit Batch modal — Class and Subject now render above Batch
//      Name (previously Batch Name was first). Pure reorder of the JSX —
//      same fields, same state, same auto-fill-from-Class+Subject
//      behavior from #39, nothing about how the form works changed.
//  42. Batch Schedule (Teacher Management → Batch Schedule) gained a
//      search box (matches batch name, class, subject, teacher/
//      substitute name, or day) plus Class/Subject filter dropdowns —
//      same Card/filter pattern used everywhere else in the app — a
//      "Showing X of Y batches" line, and a dynamic "#" numbering column
//      (position within the filtered list, same as #40) on the table.
//
// Changes made in this eighth update pass:
//  43. Recycle Bin (Trash / Restore) was fully re-laid-out — previously
//      all 15 deleted-record categories (Students, Receipts, Charges,
//      Expenses, Bank Transactions, Credit/Loan Entries, Interest
//      Payments, Attendance Records, Test Scores, Behaviour Notes,
//      Teachers, Staff, Salary Payments, Advances, Advance Returns) were
//      stacked one after another, always fully open — a long scroll even
//      when most were empty. It's now the same bordered pill-row +
//      single-panel pattern used everywhere else in the app (Academic
//      Monitoring, Structure, Batch Schedule): one category active at a
//      time, its table fills the panel below. Each pill shows a live
//      count badge, e.g. "Receipts (3)"; empty categories stay visible
//      (not hidden) but greyed out so it's obvious at a glance what has
//      nothing in it. Opening the tab defaults to the first category
//      that actually has something in it (falls back to Students if the
//      whole bin is empty) rather than always landing on a possibly-empty
//      first pill. Added a search box scoped to whichever category is
//      active (matches name/ID/description-ish fields relevant to that
//      record type — never amounts or dates, which already have their
//      own columns), plus a total-items-in-bin count in the intro line.
//      New TRASH_CATEGORIES config array drives the pill row; every
//      category's actual data (all trashed*/onRestore*/onDelete* props),
//      every table's columns, and every Restore/Delete Permanently button
//      are exactly what they were before — this is a pure re-layout, no
//      restore/delete behavior changed and TrashTab's own prop signature
//      (and therefore its call site) is untouched.
//
// Changes made in this ninth update pass:
//  44. Recycle Bin's category pill row (#43) — fixed two visual bugs seen
//      in production: (a) the row was one bordered strip with internal
//      left-border dividers between pills, which broke apart into an
//      orphan box with a stray border whenever it wrapped to a new line
//      (visible with 15 categories on a normal-width screen); and (b)
//      the "empty category" text/icon color (#B8AF95) was so washed out
//      that on a fresh install — where every category is empty — the
//      entire row looked disabled/unreadable. Replaced with individual
//      chip buttons (each with its own border + rounded corners, so
//      wrapping is always clean) and swapped the empty-category color for
//      #9C8F6E, the same muted tone already used for secondary text
//      everywhere else in the app, so it stays legible. Icons follow the
//      same color automatically (lucide icons use currentColor) — no
//      separate icon-color fix needed. Non-empty / active states, the
//      count badges, and everything else about how the pill row behaves
//      are unchanged.
//
// Changes made in this tenth update pass:
//  45. Teachers — added a dedicated Deactivate / Reactivate action
//      (separate "Status History" panel on the teacher's expanded row,
//      Option 1 from discussion) replacing the old plain Status dropdown
//      in the Add/Edit Teacher form, which recorded neither a date nor a
//      reason. Every transition now requires a date + remarks (new
//      TeacherStatusModal) and is appended to a new `statusLog` array on
//      the teacher doc (same append-only pattern as `salaryHistory`), so
//      full activation history is preserved. New changeTeacherStatus()
//      function; Performance (TeacherPerformanceTab) is completely
//      untouched, exactly as planned.
//  46. Dashboard gained an "Institute Snapshot" row (Overview → Institute
//      Snapshot → Financial Health) with a Month/Year toggle: Institute
//      Attendance % and Institute Avg Score % (derived from
//      attendanceLog/tests — the same batch-wise collections Performance
//      Report was just repointed at), plus Active Teachers and Active
//      Staff counts. Purely additive; nothing else on the Dashboard
//      changed.
//  47. Settings — new "Settings" button just above "Lock Portal" opens a
//      Institute Info form (Name, Tagline, Address, Phone, GST/
//      Registration Number — text only per decision, logo deferred until
//      Firebase Storage is confirmed set up). Backed by a new
//      settings/institute Firestore doc, same live-sync pattern as
//      classList/subjectList/streamList. Bigger win found while
//      implementing: all 12 printed documents (receipts, slips,
//      statements, the joining form) had "COACHING CLASSES" hardcoded as
//      a duplicated literal — replaced with one shared InstituteHeader
//      component (fed via InstituteSettingsContext) so setting the
//      institute name here now updates every printout at once. Falls
//      back to the same "COACHING CLASSES" placeholder text until
//      Settings is filled in, so nothing looks broken pre-setup. The
//      app's own product branding ("InstituteOS" in the sidebar) is
//      untouched — this only governs the institute's own identity shown
//      on documents.
//  48. Add/Edit Batch modal gained a Room Number field (free text, per
//      decision — Infrastructure Management's own room names are meant
//      to be kept consistent with what's typed here, upgradeable to a
//      dropdown later). Shown as a new "Room" column in the Batch
//      Schedule table and included in its search.
//  49. New "Infrastructure Management" sub-tab in Institute Management,
//      right after "Advance" — a campus rooms/areas registry (Name,
//      Category from the specified list, Capacity, Floor/Location,
//      Remarks) with the same search/filter/numbering pattern as Batch
//      Schedule (#42). New `infrastructure` Firestore collection, same
//      simple upsert/hard-delete as tests/attendanceLog (no Trash
//      support, same rationale as those two).
//  50. Banking reorganization (per direct request): "Expenses Log" is no
//      longer its own sidebar tab — it's now a Banking sub-tab, right
//      after "Banking Statement". Salary, Advance, and Deposits Log are
//      now ALSO reachable inside Banking (right before "Cash ⇄ Bank
//      Transfer Logs"), alongside their original tabs in Student
//      Management / Institute Management — true reuse, not a duplicate:
//      depositsTabProps/expensesTabProps/salaryTabProps/advanceTabProps
//      were pulled out into local consts (computed once) so both
//      locations render the exact same component with the exact same
//      data/handlers. Nothing about how any of the four behave changed.
//
// Changes made in this eleventh update pass:
//  51. Performance reorganization (per direct request): Institute
//      Management's "Performance" sub-tab (TeacherPerformanceTab) is
//      removed from there — Institute Management no longer has a
//      Performance entry, its intro line updated to point at the new
//      location. Academic Monitoring's "Performance Report" sub-tab is
//      renamed "Performance" (id kept as "report") and now hosts its own
//      inner pill row (new PerformanceSectionTab, same pattern as
//      AttendanceSectionTab/ScoresSectionTab) with three panels in this
//      order: "Performance Report" (the exact same PerformanceReportTab,
//      individual student view, completely unchanged), "Teachers
//      Performance" (the exact same TeacherPerformanceTab moved from
//      Institute Management — same component, same props object, just
//      relocated, nothing about its calculation changed), and "Institute
//      Performance" (new — see #52). teacherPerformanceTabProps is
//      passed into AcademicMonitoringTab now instead of
//      TeacherManagementTab; same object shape as before.
//  52. New Institute Performance tab (new InstitutePerformanceTab) —
//      overall attendance % and average test score % across the whole
//      institute, with its own Month/Year toggle (independent of the
//      Dashboard's), plus a By Class and By Subject breakdown table
//      (attendance %, avg score %, sessions held, tests conducted per
//      group). Same attendanceLog/tests-derived calculation approach as
//      the Dashboard's Institute Snapshot tiles (#46), just with its own
//      period control and per-class/subject detail those tiles don't
//      have room for.
//
// Changes made in this twelfth update pass:
//  53. BUGFIX — Add Room / Area (Infrastructure Management): clicking "Add
//      to Registry" repeatedly created duplicate entries with identical
//      data. Cause: saveInfrastructure() never closed the modal after
//      saving (every other Add-form's save function does this —
//      saveBatchScheduleEntry, saveTeacher, etc. — this one was missed).
//      With the modal left open, a repeated/double click called onSave
//      again while `data.id` was still undefined, so a fresh uid() ran
//      each time and wrote a second doc. Fixed by closing the modal on
//      save, matching the established convention, plus a `submitting`
//      guard directly in InfrastructureFormModal as defense-in-depth
//      against a fast double-click landing before the modal visually
//      closes.
//  54. Add/Edit Batch → Room Number now autocompletes from Infrastructure
//      Management's registry (via a <datalist>, so free text still works
//      if nothing's registered yet — this doesn't block saving a batch)
//      and shows a live indicator right under the field: a green match
//      confirmation naming the matched room + category if what's typed
//      matches a registered room exactly (case-insensitive), an amber
//      "no matching room found" warning if it doesn't match any
//      registered room, or a neutral hint to go register rooms if
//      Infrastructure Management is still empty. BatchScheduleFormModal
//      now receives the `infrastructure` list as a prop for this.
//  55. Banking's sub-tab row (8 tabs: Statement, Expenses, Salary,
//      Advance, Deposits Log, Transfer Logs, Credit & Loan Ledger,
//      Interest Payments Log) used the single-bordered-strip-with-
//      internal-dividers pattern, which breaks apart into a stray-
//      bordered orphan box whenever it wraps to a new line — the exact
//      same visual bug already found and fixed on Recycle Bin's category
//      row. Replaced with the same fix: individual chip buttons, each
//      with its own border and rounded corners, so wrapping at any width
//      stays clean. Sub-tab order/behavior is unchanged.
//
// Changes made in this thirteenth update pass:
//  56. Rebrand — app product name changed from "Batch Ledger Pro" to
//      "InstituteOS" (login screen + sidebar header), tagline changed
//      from "Coaching Register" to "Institute Operating System" (settled
//      on after a couple of revisions — briefly "The Complete Institute,
//      in One Place," which was too long for the sidebar strip). This is
//      purely the app's own product branding — separate from Settings'
//      Institute Name/Tagline (#47), which is the institute's own
//      identity shown on printed documents and is untouched by this. The
//      underlying component/function name (`CoachingLedger`) and this
//      file's name are left as-is, since renaming those would require
//      touching whatever file imports this component (App.js or
//      similar), which isn't in view here — purely cosmetic/internal,
//      doesn't affect what's shown on screen.
//
// Changes made in this fourteenth update pass:
//  57. BUGFIX — Institute Performance's Month/Year toggle (and, found
//      proactively while fixing it, the identical toggle on Dashboard's
//      Institute Snapshot) used the single-bordered-strip-with-internal-
//      divider pattern already found buggy twice before (Recycle Bin,
//      Banking) — visually breaking when toggled, likely because the
//      button label width swings a lot between the two states (e.g.
//      "August 2026" vs "2026", or a full month name vs a bare year),
//      which reflows the shared border oddly. Both replaced with
//      individual chip buttons (own border + rounded corners each), the
//      same fix already applied elsewhere.
//  58. Settings is now a tabbed modal (new SETTINGS_SUB_TABS config, one
//      entry today — "Institute Information" — with the same chip-button
//      row pattern from #57, ready for more categories later without a
//      redesign). Institute Information's single "Phone" field is split
//      into separate "Mobile Number" and "Telephone Number" fields, as
//      requested — DEFAULT_INSTITUTE_SETTINGS and InstituteHeader (the
//      shared print-header component from #47) both updated to match;
//      printed documents now show "M: ... · T: ..." instead of one
//      generic phone line. Existing settings docs with the old `phone`
//      field just show blank Mobile/Telephone until re-saved — nothing
//      crashes, no data was deleted.
// ============================================================================

// Admin Access Password
const APP_PASSWORD = "958906"; 

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');`;

const DEFAULT_CLASSES = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const DEFAULT_SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Science", "Hindi", "English", "Social Studies", "Computer"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
// Full month names, used only by fmtDate() for the "D Month YYYY" display format.
const FULL_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Cheque"];
const EXPENSE_CATEGORIES = ["Rent", "Electricity", "Staff Salary", "Stationery", "Maintenance", "Marketing", "Internet / Phone", "Furniture", "Miscellaneous"];

// Streams / academic tracks — shown on the Student form and used as a
// filter in the Students Directory. Kept as a flat list (not tied to
// class) since the same stream label can apply across senior classes,
// diplomas, and degree-level admissions.
const STREAMS = [
  "PCM", "PCB", "PCM+B", "PCB+M", "Commerce", "Arts", "Engineering",
  "Graduate", "Under Graduate", "Post Graduate", "Other",
];

// Reference types used whenever a bank-side transaction needs a paper
// trail — Cash ⇄ Bank transfers and the Credit / Loan ledger both reuse
// this same set so the UI and stored field names stay consistent.
const REFERENCE_TYPES = ["None", "UTR Number", "Cheque Number", "Reference Number"];

// Who the other side of a Credit / Loan entry is.
const CREDIT_PARTY_TYPES = ["Person", "Company", "Bank", "Other"];
// How the money actually moved for a Credit / Loan entry or an Interest
// Payment against one — Cash stays in the Cash Balance, Online covers
// UPI / Bank Transfer / NEFT / IMPS and stays in the Bank Balance.
const CREDIT_MODES = ["Cash", "Online"];

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
  // Negative amounts (e.g. a student who has paid in advance / overpaid)
  // are shown as "-₹500" rather than "₹-500".
  const sign = v < 0 ? "-" : "";
  return sign + "₹" + Math.abs(v).toLocaleString("en-IN");
}
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function nowStamp() { return new Date().toISOString(); }
// Current local clock time as "HH:MM" (24-hour), used to auto-capture "what
// time was this attendance taken" on Mark Attendance / View Attendance —
// distinct from `createdAt` (the row's own audit/creation timestamp used
// only internally for chronoKey sort ordering, never shown).
function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
// Formats a stored "HH:MM" (24-hour) time string as "h:mm AM/PM" for display.
function fmtTime(t) {
  if (!t) return "";
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return t;
  let h = Number(m[1]);
  const min = m[2];
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${min} ${period}`;
}
// Converts a stored YYYY-MM-DD (or full ISO datetime) string into the
// "D Month YYYY" format (e.g. "17 August 2026") used for DISPLAY
// everywhere in the UI. Storage, form inputs (type="date"/"month"),
// filters, and every string comparison in this file keep using the
// original YYYY-MM-DD value untouched — only what actually gets printed
// on screen / receipts / statements is routed through this. Never store
// the output of this function.
function fmtDate(d) {
  if (!d) return d;
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return d;
  const monthIdx = Number(m[2]) - 1;
  const monthName = FULL_MONTH_NAMES[monthIdx] || m[2];
  return `${Number(m[3])} ${monthName} ${m[1]}`;
}
// Combines a transaction's chosen `date` (YYYY-MM-DD, what the user picked
// on the form) with the actual time it was recorded (`createdAt`, a full
// ISO timestamp) so that multiple entries on the same date sort in true
// chronological order instead of landing in whatever order they happened
// to be read back from the database. The date itself is never overridden —
// a backdated entry still sorts under the date the user chose; only ties
// on that same date are broken by real recorded time. Nothing here is
// displayed — statements only ever show the plain date.
function chronoKey(t) {
  const d = t && t.date ? t.date : "";
  const c = t && t.createdAt ? String(t.createdAt) : "";
  const time = c.length > 10 ? c.slice(11, 19) : "00:00:00";
  return `${d}T${time}`;
}
// Shared comparator: dir = 1 for oldest-first, -1 for newest-first.
function compareChrono(a, b, dir = 1) {
  const av = chronoKey(a), bv = chronoKey(b);
  return av < bv ? -dir : av > bv ? dir : 0;
}
// Human-readable, unique Student ID — separate from the internal Firestore
// doc `id` (which stays exactly as-is so nothing already saved ever breaks).
// Format: STU<year><4-digit sequence>, e.g. STU20260007. Sequence is derived
// from the highest existing number for the current year across ALL students
// (including trashed ones, so a restored/undeleted student never collides),
// so it keeps counting up correctly even if students are removed.
function generateStudentId(allStudents) {
  const year = new Date().getFullYear();
  const prefix = `STU${year}`;
  let max = 0;
  (allStudents || []).forEach(s => {
    if (s && s.studentId && s.studentId.startsWith(prefix)) {
      const n = parseInt(s.studentId.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
// Same mechanism as generateStudentId, own prefix/sequence — Teacher IDs
// never share a counter with Student IDs.
function generateTeacherId(allTeachers) {
  const year = new Date().getFullYear();
  const prefix = `TCH${year}`;
  let max = 0;
  (allTeachers || []).forEach(t => {
    if (t && t.teacherId && t.teacherId.startsWith(prefix)) {
      const n = parseInt(t.teacherId.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
// Same mechanism again, own prefix/sequence for Other Staff.
function generateStaffId(allStaff) {
  const year = new Date().getFullYear();
  const prefix = `STF${year}`;
  let max = 0;
  (allStaff || []).forEach(s => {
    if (s && s.staffId && s.staffId.startsWith(prefix)) {
      const n = parseInt(s.staffId.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
// Same mechanism again — Salary Slip IDs, own prefix/sequence.
function generateSalaryId(allSalaryPayments) {
  const year = new Date().getFullYear();
  const prefix = `SAL${year}`;
  let max = 0;
  (allSalaryPayments || []).forEach(p => {
    if (p && p.slipId && p.slipId.startsWith(prefix)) {
      const n = parseInt(p.slipId.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
// Same mechanism again — Advance IDs, own prefix/sequence.
function generateAdvanceId(allAdvances) {
  const year = new Date().getFullYear();
  const prefix = `ADV${year}`;
  let max = 0;
  (allAdvances || []).forEach(a => {
    if (a && a.advanceId && a.advanceId.startsWith(prefix)) {
      const n = parseInt(a.advanceId.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
// Same mechanism again — Advance Return IDs, own prefix/sequence. See
// UPDATE NOTES entry for the "Return Advance" feature.
function generateAdvanceReturnId(allAdvanceReturns) {
  const year = new Date().getFullYear();
  const prefix = `ADR${year}`;
  let max = 0;
  (allAdvanceReturns || []).forEach(r => {
    if (r && r.returnId && r.returnId.startsWith(prefix)) {
      const n = parseInt(r.returnId.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
// Returns one person's OPEN advances (oldest-first), scoped by BOTH
// personId and personType — a person's advance history must never be
// matched by personId alone, since a teacher and a staff member could in
// principle share an id space collision. Shared by the Salary form's live
// outstanding-total preview, saveSalaryPayment()'s settlement loop, and
// saveAdvanceReturn()'s settlement loop, so all three can never disagree
// about which records count as "this person's open advances".
function openAdvancesFor(advances, personId, personType) {
  return (advances || [])
    .filter(a => !a.deleted && a.personId === personId && a.personType === personType && (a.status || "open") === "open" && Number(a.outstandingAmount) > 0)
    .sort((a, b) => compareChrono(a, b, 1));
}
// Walks a person's open advances oldest-first, applying `amount` across
// them — a deduction taken from a salary payment, or a direct cash return
// via the "Return Advance" form — and returns the per-advance breakdown
// (which advance, how much of it was applied, its new outstanding/status)
// plus how much of the requested amount actually got applied (in case more
// was requested than was actually outstanding). This does NOT write
// anything to Firestore itself — callers apply `applied[].newOutstanding` /
// `newStatus` via their own setDoc calls, and use the same breakdown to
// build their own settlement record (settledAdvances on a salary payment,
// or on an advance return). Used by both saveSalaryPayment() and
// saveAdvanceReturn() so the two settlement paths can never drift apart.
function allocateAdvancePayoff(advances, personId, personType, amount) {
  let remaining = round2(Number(amount) || 0);
  const applied = [];
  const openAdvances = openAdvancesFor(advances, personId, personType);
  for (const adv of openAdvances) {
    if (remaining <= 0) break;
    const amt = Math.min(remaining, Number(adv.outstandingAmount) || 0);
    if (amt <= 0) continue;
    const newOutstanding = round2((Number(adv.outstandingAmount) || 0) - amt);
    applied.push({
      advanceId: adv.id, advanceRefId: adv.advanceId, date: adv.date, amount: round2(amt),
      newOutstanding, newStatus: newOutstanding <= 0 ? "settled" : "open",
    });
    remaining = round2(remaining - amt);
  }
  return { applied, actualApplied: round2((Number(amount) || 0) - remaining), remaining };
}
// Merges Teachers and Staff — two separate Firestore collections today —
// into one flat, selectable list for the Salary/Advance pickers, tagging
// each entry with personType so it can be written back onto the
// salaryPayments/advances record and used to look the person back up in
// either collection later (see SalaryFormModal, AdvanceFormModal,
// PersonStatementModal).
function mergeStaffAndTeachers(teachers, staff) {
  return [
    ...(teachers || []).map(t => ({
      personId: t.id, personType: "teacher", name: t.name, displayId: t.teacherId || "",
      role: (t.expertiseSubjects || []).join(", ") || "Teacher",
      salaryAmount: t.salaryAmount || 0, paymentMode: t.paymentMode || "Cash", phone: t.phone || "",
    })),
    ...(staff || []).map(s => ({
      personId: s.id, personType: "staff", name: s.name, displayId: s.staffId || "",
      role: s.title || "Staff",
      salaryAmount: s.salaryAmount || 0, paymentMode: s.paymentMode || "Cash", phone: s.phone || "",
    })),
  ];
}
// Test ID pattern: {class}{subject}{YY}{seq} — YY is the year of the
// selected TEST DATE (not system date, so backdating into a prior year
// produces that year's sequence correctly), seq is 2-digit, scoped to
// class+subject+year, computed the same way generateStudentId scans for
// the current max and adds one. Recomputed reactively while the Test
// Marks form is open (see TestMarksTab), same "computed live, finalized
// on save" behavior as displayStudentId in StudentFormModal.
// Strips a leading "Class" word (any casing, optional space) off a class
// value before it goes into a generated Test ID — e.g. class "Class 12"
// becomes "12" for ID purposes only. The actual `class` field stored on the
// student/test record, and everywhere else it's displayed or filtered, is
// completely untouched; this only changes what generateTestId() below
// concatenates into the ID string.
function classCodeForId(cls) {
  return String(cls || "").trim().replace(/^class\s*/i, "");
}
function generateTestId(allTests, cls, subject, dateStr, excludeTestId) {
  const yy = (dateStr || todayStr()).slice(2, 4);
  const prefix = `${classCodeForId(cls)}${subject || ""}${yy}`.toUpperCase();
  let max = 0;
  (allTests || []).forEach(t => {
    if (!t || !t.testId || t.testId === excludeTestId) return;
    const upperId = t.testId.toUpperCase();
    if (upperId.startsWith(prefix)) {
      const seq = parseInt(upperId.slice(prefix.length), 10);
      if (!isNaN(seq) && seq > max) max = seq;
    }
  });
  return `${prefix}${String(max + 1).padStart(2, "0")}`;
}
// Batch Schedule autofill (Attendance → Mark Attendance): only ever
// called for today's date. Compares the current real time against every
// batchSchedule record's startTime–endTime window for today's day-of-
// week; returns the single matching record, or null if zero or more than
// one match (ambiguous — leave Class/Subject for manual selection).
function findAutofillBatch(batchSchedule) {
  const now = new Date();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = dayNames[now.getDay()];
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const toMins = (t) => { if (!t) return null; const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
  const matches = (batchSchedule || []).filter(b => {
    if (!b.daysOfWeek || !b.daysOfWeek.includes(today)) return false;
    const start = toMins(b.startTime), end = toMins(b.endTime);
    if (start == null || end == null) return false;
    return nowMins >= start && nowMins <= end;
  });
  return matches.length === 1 ? matches[0] : null;
}
// Test Marks / Attendance roster resolution — "students active in this
// batch as of date X". Reuses the exact same batchHistory-by-month logic
// batchesForMonth() already uses for fee calculation (see closest
// precedent near expectedFeeFor), matched against the selected date's
// month. See UPDATE NOTES #23 for the flagged caveat: class itself is
// checked against the student's CURRENT class, since (unlike
// subjects/batches) class isn't tracked with its own per-date history.
function studentsActiveInBatch(students, batch, dateStr, batchesForMonth) {
  if (!batch) return [];
  const mKey = (dateStr || todayStr()).slice(0, 7);
  return (students || []).filter(s => {
    if (s.deleted) return false;
    if (String(s.class) !== String(batch.class)) return false;
    const activeSubjects = batchesForMonth(s, mKey);
    return activeSubjects.includes(batch.subject);
  });
}
// Teacher Performance — deliberately isolated so the weighting is easy to
// adjust later without hunting through the rest of the file. FLAGGED AS A
// DECISION TO CONFIRM: attendance consistency and average test score are
// currently weighted 50/50 (attendanceWeight / testWeight below); each
// batch contributes to the teacher's average unweighted by class size.
// Returns null if the teacher has no batches, so the UI can show "No
// batches assigned yet" instead of a misleading 0.
function computeTeacherPerformance(teacher, batches, attendanceRecords, tests) {
  const attendanceWeight = 0.5; // <-- confirm/tune this
  const testWeight = 0.5;       // <-- confirm/tune this
  const myBatches = (batches || []).filter(b => b.teacherId === teacher.id);
  if (!myBatches.length) return null;

  const batchBreakdown = myBatches.map(b => {
    const relevantAttendance = (attendanceRecords || []).filter(a => a.batchId === b.id);
    let presentCount = 0, totalMarks = 0;
    relevantAttendance.forEach(a => (a.records || []).forEach(r => { totalMarks++; if (r.status === "Present") presentCount++; }));
    const attendancePct = totalMarks > 0 ? (presentCount / totalMarks) * 100 : null;

    const relevantTests = (tests || []).filter(t => String(t.class) === String(b.class) && t.subject === b.subject);
    let scoreSum = 0, scoreCount = 0;
    relevantTests.forEach(t => (t.scores || []).forEach(sc => {
      if (sc.marks === "" || sc.marks == null || !t.maxMarks) return;
      scoreSum += (Number(sc.marks) / Number(t.maxMarks)) * 100; scoreCount++;
    }));
    const avgTestPct = scoreCount > 0 ? scoreSum / scoreCount : null;

    return { batch: b, attendancePct, avgTestPct };
  });

  const withAttendance = batchBreakdown.filter(b => b.attendancePct != null);
  const withTests = batchBreakdown.filter(b => b.avgTestPct != null);
  const avgAttendance = withAttendance.length ? withAttendance.reduce((a, b) => a + b.attendancePct, 0) / withAttendance.length : null;
  const avgTest = withTests.length ? withTests.reduce((a, b) => a + b.avgTestPct, 0) / withTests.length : null;

  let summaryScore = null;
  if (avgAttendance != null && avgTest != null) summaryScore = avgAttendance * attendanceWeight + avgTest * testWeight;
  else if (avgAttendance != null) summaryScore = avgAttendance;
  else if (avgTest != null) summaryScore = avgTest;

  return { summaryScore, avgAttendance, avgTest, batchBreakdown };
}

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
  const msg = `*FEE PAYMENT RECEIPT*\n----------------------------------------\n*Receipt No:* #${receiptNo}\n*Date:* ${fmtDate(deposit.date)}\n*Student Name:* ${student.name}\n*Class:* ${student.class}\n*Payment Mode:* ${deposit.mode || "Cash"}${refLine}\n----------------------------------------\n*Amount Paid Today:* ₹${deposit.amount}${woLine}\n*Remaining Balance:* ₹${totalRemainingDue}\n*Status:* ACKNOWLEDGED ✅\n----------------------------------------\nThank you for your payment!`;
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
      // BUG FIX: no longer forces `bc` to 1 when the student has zero
      // subjects selected for this month — that used to silently bill
      // them the 1-subject fee matrix rate for a subject they were never
      // enrolled in. expectedFeeFor() now returns ₹0 for a batch count of
      // 0, so a subject-less student correctly accrues no tuition charge.
      const bc = batches.length;
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
      date: c.date || `${c.month || curMonth}-01`, month: c.month || null, createdAt: c.createdAt || "",
      label: c.remarks ? `Additional Charge — ${c.remarks}` : `Additional Charge${c.month ? " (" + monthLabel(c.month) + ")" : ""}`,
      amount: round2(c.amount), remarks: c.remarks || "", ref: "",
    });
  });

  chargeLines.sort((a, b) => compareChrono(a, b, 1));

  const creditLines = [];
  (deposits || []).filter(d => d.studentId === student.id && !d.deleted).forEach(d => {
    if (Number(d.amount) > 0) {
      const ref = d.utr ? ` · Ref ${d.utr}` : (d.chequeNumber ? ` · Chq #${d.chequeNumber}` : "");
      creditLines.push({
        id: `${d.id}-pay`, depositId: d.id, type: "payment", date: d.date || todayStr(), createdAt: d.createdAt || "",
        label: `Payment Received — ${d.mode || "Cash"}${ref}`, amount: round2(d.amount),
        mode: d.mode, remarks: d.remarks, receiptNo: getReceiptNo(d.id), ref: d.utr || d.chequeNumber || "",
      });
    }
    if (Number(d.writeOffAmount) > 0) {
      creditLines.push({
        id: `${d.id}-wo`, depositId: d.id, type: "writeoff", date: d.date || todayStr(), createdAt: d.createdAt || "",
        label: d.writeOffRemarks ? `Discount / Write-off — ${d.writeOffRemarks}` : "Discount / Write-off",
        amount: round2(d.writeOffAmount), remarks: d.writeOffRemarks, receiptNo: getReceiptNo(d.id), ref: "",
      });
    }
  });
  creditLines.sort((a, b) => compareChrono(a, b, 1));

  let pool = creditLines.reduce((a, c) => a + c.amount, 0);
  const allocatedCharges = chargeLines.map(line => {
    const applied = Math.min(line.amount, pool);
    pool = round2(pool - applied);
    return { ...line, paid: round2(applied), outstanding: round2(line.amount - applied) };
  });

  const totalCharged = round2(chargeLines.reduce((a, l) => a + l.amount, 0));
  const totalCleared = round2(creditLines.reduce((a, l) => a + l.amount, 0));
  // rawBalance keeps the sign: negative means the student has paid more
  // than they've been charged (an advance / credit sitting on account).
  // `balance` stays clamped at 0 everywhere it already was, so nothing
  // downstream (Dues tab, Dashboard totals, totalOutstanding, etc.)
  // changes behavior — only the Students Register "Total Due" column
  // reads rawBalance, to actually show that advance as a negative figure.
  const rawBalance = round2(totalCharged - totalCleared);
  const balance = Math.max(0, rawBalance);

  const timeline = [
    ...allocatedCharges.map(l => ({ ...l, kind: "debit" })),
    ...creditLines.map(l => ({ ...l, kind: "credit" })),
  ].sort((a, b) => compareChrono(a, b, 1) || (a.kind === "debit" ? -1 : 1));

  let running = 0;
  const timelineWithBalance = timeline.map(l => {
    running = round2(running + (l.kind === "debit" ? l.amount : -l.amount));
    return { ...l, runningBalance: running };
  });

  return { chargeLines: allocatedCharges, creditLines, totalCharged, totalCleared, balance, rawBalance, timeline: timelineWithBalance };
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

// ---- Institute Settings — a single Firestore doc (settings/institute)
// holding the institute's own display identity (Name, Tagline, Address,
// Phone, GST/Registration Number), separate from the app's own product
// branding ("InstituteOS" in the sidebar, which is unrelated and
// untouched). Exposed via Context so every print template below can read
// it without threading a prop through every intermediate component.
const DEFAULT_INSTITUTE_SETTINGS = { instituteName: "COACHING CLASSES", tagline: "", address: "", mobileNumber: "", telephoneNumber: "", gstNumber: "" };
const InstituteSettingsContext = React.createContext(DEFAULT_INSTITUTE_SETTINGS);

// Shared header block for every printable document (receipts, slips,
// statements, forms) — previously each of the 12 print templates had its
// own hardcoded "COACHING CLASSES" <h2> + subtitle <p>, duplicated
// verbatim. Now one component, reading institute name/address/phone from
// Settings (falling back to the same "COACHING CLASSES" placeholder if
// nothing's been set yet, so nothing looks broken pre-setup).
function InstituteHeader({ subtitle, large }) {
  const settings = React.useContext(InstituteSettingsContext);
  const phoneLine = [
    settings.mobileNumber && `M: ${settings.mobileNumber}`,
    settings.telephoneNumber && `T: ${settings.telephoneNumber}`,
  ].filter(Boolean).join(" · ");
  return (
    <>
      <h2 style={{ fontFamily: "'Zilla Slab', serif" }} className={`${large ? "text-2xl" : "text-xl"} font-bold text-[#12312B]`}>{settings.instituteName || "COACHING CLASSES"}</h2>
      {settings.tagline && <p className="text-[10px] text-[#6E6650]">{settings.tagline}</p>}
      <p className={`${large ? "text-[11px]" : "text-[10px]"} uppercase tracking-wider text-[#9C8F6E]`} style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{subtitle}</p>
      {(settings.address || phoneLine) && (
        <p className="text-[10px] text-[#9C8F6E] mt-0.5">{[settings.address, phoneLine].filter(Boolean).join(" · ")}</p>
      )}
    </>
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
    <div className="min-h-screen flex" style={{ background: "#FAF6EC", fontFamily: "'Inter', sans-serif", color: "#26231D" }}>
      <style>{`${FONT_IMPORT}
        .ledger-row:nth-child(even) { background: #F5F0E1; }
        input, select { font-family: 'Inter', sans-serif; }
        ::selection { background: #B8862B33; }

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

      <aside className="w-60 shrink-0 flex flex-col justify-between sticky top-0 h-screen overflow-y-auto" style={{ background: "#12312B" }}>
        <div>
          <div className="px-5 pt-6 pb-5" style={{ borderBottom: "1px solid #24473F" }}>
            <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-bold text-[#F4EFDE] leading-tight">InstituteOS</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#8FAE9F" }} className="mt-1 uppercase tracking-wider">Institute Operating System</div>
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
          <button onClick={() => setShowSettingsModal(true)} className="w-full flex items-center gap-2 px-5 py-3 text-xs font-medium text-[#8FAE9F] hover:text-[#F4EFDE] transition-colors" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
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

      <main className="flex-1 px-8 py-7 max-w-6xl">
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
function AttendanceSectionTab({ classes, subjectsList, batchSchedule, students, attendanceLog, batchesForMonth, onSave, onEdit, onDelete }) {
  const [inner, setInner] = useState("mark");
  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex border rounded-sm overflow-hidden w-fit" style={{ borderColor: "#12312B" }}>
          <button onClick={() => setInner("mark")} className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
            style={{ background: inner === "mark" ? "#12312B" : "white", color: inner === "mark" ? "#F4EFDE" : "#12312B" }}>
            <ClipboardCheck size={13} /> Mark Attendance
          </button>
          <button onClick={() => setInner("view")} className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
            style={{ background: inner === "view" ? "#12312B" : "white", color: inner === "view" ? "#F4EFDE" : "#12312B", borderLeft: "1px solid #12312B" }}>
            <Search size={13} /> View Attendance
          </button>
        </div>
        {/* Running total — "how many classes' attendance has been filled so far". */}
        <div className="text-xs text-[#6E6650] font-medium">
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#12312B" }}>{attendanceLog.length}</span> attendance session{attendanceLog.length === 1 ? "" : "s"} recorded so far
        </div>
      </div>
      {inner === "mark" ? (
        <MarkAttendanceTab classes={classes} subjectsList={subjectsList} batchSchedule={batchSchedule} students={students}
          attendanceLog={attendanceLog} batchesForMonth={batchesForMonth} onSave={onSave} />
      ) : (
        <ViewAttendanceTab attendanceLog={attendanceLog} students={students} classes={classes} subjectsList={subjectsList}
          onSave={onSave} onEdit={onEdit} onDelete={onDelete} />
      )}
    </div>
  );
}

// ---- "Scores" sub-tab wrapper — same pattern as AttendanceSectionTab:
// "Fill Marks" (the existing TestMarksTab, untouched) and "View & Search
// Scores" (new — search/filter saved tests by class, subject, date, test ID,
// description, or student, sort by top scorers, and edit marks in place, see
// ViewScoresTab below). Both read/write the same "tests" collection via the
// same onSave (saveTest). ----
function ScoresSectionTab({ classes, subjectsList, batchSchedule, students, tests, batchesForMonth, onSave, onEdit, onDelete }) {
  const [inner, setInner] = useState("fill");
  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex border rounded-sm overflow-hidden w-fit" style={{ borderColor: "#12312B" }}>
          <button onClick={() => setInner("fill")} className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
            style={{ background: inner === "fill" ? "#12312B" : "white", color: inner === "fill" ? "#F4EFDE" : "#12312B" }}>
            <Award size={13} /> Fill Marks
          </button>
          <button onClick={() => setInner("view")} className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
            style={{ background: inner === "view" ? "#12312B" : "white", color: inner === "view" ? "#F4EFDE" : "#12312B", borderLeft: "1px solid #12312B" }}>
            <Search size={13} /> View & Search Scores
          </button>
        </div>
        {/* Running total — "how many tests have been completed so far". */}
        <div className="text-xs text-[#6E6650] font-medium">
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#12312B" }}>{tests.length}</span> test{tests.length === 1 ? "" : "s"} conducted so far
        </div>
      </div>
      {inner === "fill" ? (
        <TestMarksTab classes={classes} subjectsList={subjectsList} batchSchedule={batchSchedule} students={students}
          tests={tests} batchesForMonth={batchesForMonth} onSave={onSave} />
      ) : (
        <ViewScoresTab tests={tests} students={students} classes={classes} subjectsList={subjectsList}
          onSave={onSave} onEdit={onEdit} onDelete={onDelete} />
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

// ============================================================================
// FINANCIAL SUMMARY CARD — a professional, multi-metric tile for the
// Dashboard that groups Cash + Online figures together with a combined
// headline total (e.g. "Total Operating Balance" / "Total Cumulative
// Expenses"), instead of scattering them across separate single-number
// tiles.
// ============================================================================
function FinancialSummaryCard({ title, icon: TitleIcon, tone, total, metrics }) {
  const toneColor = { good: "#3F6B52", bad: "#A63D2F" }[tone] || "#12312B";
  const toneBg = { good: "#EAF1EA", bad: "#F7E7E3" }[tone] || "#FAF6EC";
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          {TitleIcon && <TitleIcon size={14} style={{ color: toneColor }} />}
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.1em" }} className="uppercase text-[#9C8F6E]">{title}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        {metrics.map(m => (
          <div key={m.label} className="p-3 rounded bg-[#FAF6EC] border" style={{ borderColor: "#D8CFB8" }}>
            <div className="flex items-center gap-1 text-[10px] uppercase text-[#9C8F6E] font-mono mb-1">
              {m.icon && <m.icon size={11} />} {m.label}
            </div>
            <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-bold text-[#12312B]">{fmtINR(m.value)}</div>
          </div>
        ))}
      </div>
      <div className="p-3 rounded border" style={{ background: toneBg, borderColor: toneColor }}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: toneColor, fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }}>{total.label}</span>
          <span style={{ fontFamily: "'Zilla Slab', serif", color: toneColor }} className="text-xl font-bold">{fmtINR(total.value)}</span>
        </div>
      </div>
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
                  <td className="px-2 py-1.5 text-[#6E6650]">{r.student.class}</td>
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

// Small uppercase divider label used to break the Dashboard into clearly
// named sections (Overview / Financial Health / Trends & Activity /
// Outstanding Dues) — purely visual grouping, changes nothing functional.
function DashSectionLabel({ children }) {
  return (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.12em" }} className="uppercase text-[#9C8F6E] mb-2.5 mt-7 first:mt-0">
      {children}
    </div>
  );
}

function DashboardTab({ students, thisMonthCollected, thisMonthWriteOffs, thisMonthExpected, totalOutstanding, trend, classStrength, recentDeposits, studentById, curMonth, classes, studentDues, forecastForMonth, totalCashBalance, totalOnlineBalance, cashExpensesTotal, onlineExpensesTotal, totalExpenses, attendanceLog, tests, teachers, staff, onOpenReceipt, onStatement }) {
  const collectionRate = thisMonthExpected > 0 ? Math.round((thisMonthCollected / thisMonthExpected) * 100) : 0;
  // Net Liquidity = Cash Balance + Online/Bank Balance, both now sourced
  // straight from the Banking ledger's running totals (see the "Dashboard
  // Net Liquidity" fix note where totalCashBalance / totalOnlineBalance are
  // computed), so this figure always matches the Banking tab exactly.
  const netLiquidity = round2(totalCashBalance + totalOnlineBalance);

  // ---- Institute Snapshot — Attendance %, Avg Test Score %, and Active
  // Teachers/Staff counts, for either the currently selected month (same
  // curMonth the rest of the Dashboard already uses) or that whole year.
  // Attendance/Score % are computed straight from attendanceLog/tests
  // (the same batch-wise collections Performance Report now uses too —
  // see that bugfix), filtered to the chosen period.
  const [snapshotPeriod, setSnapshotPeriod] = useState("month");
  const snapshotYear = curMonth.slice(0, 4);
  const inPeriod = (dateStr) => {
    if (!dateStr) return false;
    return snapshotPeriod === "month" ? dateStr.slice(0, 7) === curMonth : dateStr.slice(0, 4) === snapshotYear;
  };
  const periodAttendance = (attendanceLog || []).filter(a => inPeriod(a.date));
  const attendanceRecordCount = periodAttendance.reduce((n, a) => n + (a.records || []).length, 0);
  const attendancePresentCount = periodAttendance.reduce((n, a) => n + (a.records || []).filter(r => r.status === "Present").length, 0);
  const institutePresencePct = attendanceRecordCount > 0 ? round2((attendancePresentCount / attendanceRecordCount) * 100) : null;

  const periodTests = (tests || []).filter(t => inPeriod(t.date));
  const scoreTotals = periodTests.reduce((acc, t) => {
    (t.scores || []).forEach(sc => {
      if (sc.marks === "" || sc.marks == null) return;
      acc.obtained += Number(sc.marks) || 0;
      acc.max += Number(t.maxMarks) || 0;
    });
    return acc;
  }, { obtained: 0, max: 0 });
  const institutePerformancePct = scoreTotals.max > 0 ? round2((scoreTotals.obtained / scoreTotals.max) * 100) : null;

  const activeTeacherCount = (teachers || []).filter(t => (t.status || "active") === "active").length;
  const activeStaffCount = (staff || []).filter(s => (s.status || "active") === "active").length;

  // NEW: Top Outstanding Dues — quick at-a-glance list of whoever owes the
  // most right now, without leaving the Dashboard to open the Dues tab.
  // Built from studentDues (id → balance) + studentById, both already
  // available to this component; purely additive, touches no other data.
  const topDues = Object.entries(studentDues || {})
    .map(([id, bal]) => ({ student: studentById[id], balance: round2(bal) }))
    .filter(x => x.student && x.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 6);

  return (
    <div>
      <SectionHeader eyebrow={monthLabel(curMonth)} title="Summary" />

      {/* ===== OVERVIEW ===== */}
      <DashSectionLabel>Overview</DashSectionLabel>
      <div className="grid grid-cols-4 gap-4 mb-4">
        <StatCard label="Active Students" value={students.length} sub={`${classes.filter(c => students.some(s => s.class === c)).length} active classes`} />
        <StatCard label="Collected this month" value={fmtINR(thisMonthCollected)} sub={`of ${fmtINR(thisMonthExpected)} expected`} tone="good" />
        <StatCard label="Collection rate" value={`${collectionRate}%`} tone={collectionRate >= 80 ? "good" : collectionRate >= 50 ? "warn" : "bad"} />
        <StatCard label="Total Dues Balance" value={fmtINR(totalOutstanding)} sub={thisMonthWriteOffs > 0 ? `${fmtINR(thisMonthWriteOffs)} written off this month` : "includes carried-over dues"} tone={totalOutstanding > 0 ? "bad" : "good"} />
      </div>

      {/* ===== INSTITUTE SNAPSHOT ===== */}
      <div className="flex items-center justify-between mb-2">
        <DashSectionLabel>Institute Snapshot</DashSectionLabel>
        <div className="flex gap-1.5 mb-2">
          {["month", "year"].map(p => (
            <button key={p} onClick={() => setSnapshotPeriod(p)}
              className="px-3 py-1 text-[11px] font-semibold rounded-sm border"
              style={{ background: snapshotPeriod === p ? "#12312B" : "white", color: snapshotPeriod === p ? "#F4EFDE" : "#12312B", borderColor: "#12312B" }}>
              {p === "month" ? monthLabel(curMonth) : snapshotYear}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4 mb-4">
        <StatCard label="Institute Attendance" value={institutePresencePct == null ? "—" : `${institutePresencePct}%`}
          sub={attendanceRecordCount > 0 ? `${attendancePresentCount}/${attendanceRecordCount} present` : "No attendance marked yet"}
          tone={institutePresencePct == null ? undefined : institutePresencePct >= 80 ? "good" : institutePresencePct >= 60 ? "warn" : "bad"} />
        <StatCard label="Institute Avg Score" value={institutePerformancePct == null ? "—" : `${institutePerformancePct}%`}
          sub={periodTests.length > 0 ? `${periodTests.length} test${periodTests.length === 1 ? "" : "s"} conducted` : "No tests conducted yet"}
          tone={institutePerformancePct == null ? undefined : institutePerformancePct >= 60 ? "good" : institutePerformancePct >= 40 ? "warn" : "bad"} />
        <StatCard label="Active Teachers" value={activeTeacherCount} sub={`of ${(teachers || []).length} total`} />
        <StatCard label="Active Staff" value={activeStaffCount} sub={`of ${(staff || []).length} total`} />
      </div>

      {/* ===== FINANCIAL HEALTH ===== */}
      <DashSectionLabel>Financial Health — Cash &amp; Bank</DashSectionLabel>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <FinancialSummaryCard
          title="Net Liquidity"
          icon={Landmark}
          tone="good"
          total={{ label: "Total Operating Balance", value: netLiquidity }}
          metrics={[
            { label: "Cash Balance", value: totalCashBalance, icon: Banknote },
            { label: "Online Balance", value: totalOnlineBalance, icon: CreditCard },
          ]}
        />
        <FinancialSummaryCard
          title="Cumulative Outflows"
          icon={Receipt}
          tone="bad"
          total={{ label: "Total Cumulative Expenses", value: totalExpenses }}
          metrics={[
            { label: "Cash Expenses", value: cashExpensesTotal, icon: Banknote },
            { label: "Online Expenses", value: onlineExpensesTotal, icon: CreditCard },
          ]}
        />
      </div>
      <div className="text-[11px] text-[#9C8F6E] mb-2 flex items-center gap-1.5"><Landmark size={11} /> These balances include every deposit, expense, Cash⇄Bank transfer, and Credit/Loan movement — always in sync with the Banking tab.</div>

      {/* ===== TRENDS & ACTIVITY ===== */}
      <DashSectionLabel>Trends &amp; Activity</DashSectionLabel>
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
                      <span className="text-[#9C8F6E] ml-2 text-xs">{st ? st.class : "—"} · {fmtDate(d.date)}</span>
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

      {/* ===== OUTSTANDING DUES (NEW) ===== */}
      <DashSectionLabel>Outstanding Dues</DashSectionLabel>
      <Card className="p-5 mb-2">
        <div className="flex items-center justify-between mb-3">
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold">Top Outstanding Dues</div>
          <span className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono">Highest balance first</span>
        </div>
        {topDues.length === 0 ? (
          <div className="text-sm text-[#9C8F6E]">No outstanding dues — everyone is fully paid up. 🎉</div>
        ) : (
          <div className="space-y-0">
            {topDues.map(({ student: st, balance }) => (
              <div key={st.id} className="flex items-center justify-between py-2 text-sm ledger-row px-2 -mx-2" style={{ borderBottom: "1px solid #EEE7D2" }}>
                <div>
                  <span className="font-medium">{st.name}</span>
                  <span className="text-[#9C8F6E] ml-2 text-xs font-mono">{st.studentId || "—"} · {st.class}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="font-semibold text-[#A63D2F]">{fmtINR(balance)}</span>
                  {onStatement && (
                    <button onClick={() => onStatement(st)} className="p-1 text-[#12312B] hover:bg-[#E4DCC5] rounded" title="Open Student Statement">
                      <FileText size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function LifecycleActions({ s, onExit, onPromote, onBatchChange, onViewHistory, onUndo, onStatement, onAddCharge, onJoiningForm, compact }) {
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
      {onJoiningForm && <button onClick={() => onJoiningForm(s)} className="text-[#12312B] underline inline-flex items-center gap-0.5 text-xs"><FileText size={11} /> Joining Form</button>}
      <button onClick={() => onViewHistory(s)} className="text-[#12312B] underline inline-flex items-center gap-0.5 text-xs"><History size={11} /> Log</button>
    </>
  );
}

// ============================================================================
// STUDENT MANAGEMENT TAB — merges what used to be six separate sidebar
// tabs (Students Register, Pending Dues, Deposits Log, Charges, Center
// Statement, Fee & Class Structure) into one "Student Management" sidebar
// entry with an internal pill row of six sub-tabs, in that exact
// left-to-right order. This is purely navigational regrouping: every one
// of the six original components (StudentsTab, DuesTab, DepositsTab,
// ChargesTab, CenterStatementTab, StructureTab) is reused completely
// as-is below, with the exact same props it was given before the merge —
// same filters, search boxes, print/export buttons, add/edit/delete
// actions, receipts, and modals as before. Same sub-tab pill-row pattern
// already used by StructureTab (3 sub-tabs) and BankingTab (4 sub-tabs).
// ============================================================================
const STUDENT_MANAGEMENT_SUB_TABS = [
  { id: "students", label: "Students Register", icon: Users },
  { id: "dues", label: "Pending Dues", icon: AlertCircle },
  { id: "deposits", label: "Deposits Log", icon: Receipt },
  { id: "charges", label: "Charges", icon: ClipboardList },
  { id: "statement", label: "Center Statement", icon: FileText },
  { id: "structure", label: "Fee & Class Structure", icon: Wallet },
];

function StudentManagementTab({ studentsTabProps, duesTabProps, depositsTabProps, chargesTabProps, statementTabProps, structureTabProps }) {
  const [subTab, setSubTab] = useState("students");

  return (
    <div>
      <SectionHeader eyebrow="Student Lifecycle" title="Student Management" />
      <div className="text-sm text-[#6E6650] mb-4">Roster, dues, payments in, ad-hoc charges, the master transaction record, and fee setup — the full student lifecycle in one place.</div>

      {/* Same bordered pill-row pattern as StructureTab / BankingTab —
          only one sub-tab's panel renders at a time; nothing below was
          removed, just regrouped under one sidebar entry. */}
      <div className="flex border rounded-sm overflow-hidden mb-5 w-fit flex-wrap" style={{ borderColor: "#12312B" }}>
        {STUDENT_MANAGEMENT_SUB_TABS.map((st, i) => {
          const Icon = st.icon;
          const active = subTab === st.id;
          return (
            <button key={st.id} onClick={() => setSubTab(st.id)}
              className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
              style={{ background: active ? "#12312B" : "white", color: active ? "#F4EFDE" : "#12312B", borderLeft: i === 0 ? "none" : "1px solid #12312B" }}>
              <Icon size={13} /> {st.label}
            </button>
          );
        })}
      </div>

      {subTab === "students" && <StudentsTab {...studentsTabProps} />}
      {subTab === "dues" && <DuesTab {...duesTabProps} />}
      {subTab === "deposits" && <DepositsTab {...depositsTabProps} />}
      {subTab === "charges" && <ChargesTab {...chargesTabProps} />}
      {subTab === "statement" && <CenterStatementTab {...statementTabProps} />}
      {subTab === "structure" && <StructureTab {...structureTabProps} />}
    </div>
  );
}

function StudentsTab({ students, studentDues, studentDuesRaw, classes, streams, batchesForMonth, curMonth, onAdd, onEdit, onExit, onPromote, onViewHistory, onBatchChange, onUndo, onStatement, onAddCharge, onJoiningForm, onRemove }) {
  const [search, setSearch] = useState("");
  const [streamFilter, setStreamFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [expanded, setExpanded] = useState({});

  const streamList = streams || STREAMS;
  const streamsInUse = useMemo(() => {
    const set = new Set();
    students.forEach(s => { if (s.stream) set.add(s.stream); });
    return streamList.filter(s => set.has(s));
  }, [students, streamList]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter(s => {
      if (streamFilter !== "all" && (s.stream || "") !== streamFilter) return false;
      if (classFilter !== "all" && String(s.class) !== classFilter) return false;
      if (statusFilter !== "all" && (s.status || "active") !== statusFilter) return false;
      if (genderFilter !== "all" && (s.gender || "") !== genderFilter) return false;
      if (!q) return true;
      const haystack = [s.name, s.studentId, s.fatherName, s.phone, s.guardianPhone, s.address, s.aadharNumber, ...(s.batches || [])].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [students, search, streamFilter, classFilter, statusFilter, genderFilter]);

  const isFiltered = search || streamFilter !== "all" || classFilter !== "all" || statusFilter !== "all" || genderFilter !== "all";

  return (
    <div>
      <SectionHeader eyebrow="Register" title="Students Directory" action={
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Add student
        </button>
      } />

      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Search</div>
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" style={{ marginTop: "9px" }} />
            <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, Student ID, subject, father's name, phone, guardian phone, Aadhar, or address…" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Class</div>
            <select className={inputCls} style={inputStyle} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
              <option value="all">All Classes</option>
              {(classes || []).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Stream</div>
            <select className={inputCls} style={inputStyle} value={streamFilter} onChange={e => setStreamFilter(e.target.value)}>
              <option value="all">All Streams</option>
              {streamsInUse.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Student Status</div>
            <select className={inputCls} style={inputStyle} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="on_break">On Break / Gap</option>
              <option value="dropped">Dropped Out</option>
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Gender</div>
            <select className={inputCls} style={inputStyle} value={genderFilter} onChange={e => setGenderFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          {isFiltered && (
            <button onClick={() => { setSearch(""); setStreamFilter("all"); setClassFilter("all"); setStatusFilter("all"); setGenderFilter("all"); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
        <div className="text-[10px] text-[#9C8F6E] mt-2.5 font-mono">{filtered.length} of {students.length} student{students.length === 1 ? "" : "s"} shown</div>
      </Card>

      <Card>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">{students.length === 0 ? "No students registered yet." : "No students match this search."}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["#", "", "Name", "Class", "Subjects (this month)", "Total Due", "Status", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, idx) => {
                const dueAmount = studentDues[s.id] || 0;
                // Total Due shown here uses the signed (unclamped) balance,
                // so a student who has deposited extra / paid in advance
                // shows their Total Due as a negative amount instead of ₹0.
                const displayDue = studentDuesRaw ? (studentDuesRaw[s.id] || 0) : dueAmount;
                const status = s.status || "active";
                const badgeText = status === "active" ? "Active" : status === "dropped" ? "Dropped Out" : (s.resultStatus || "On Break");
                const badgeTone = status === "active" ? "paid" : status === "dropped" ? "overdue" : "break";
                const isOpen = !!expanded[s.id];
                const hasDetails = s.fatherName || s.guardianPhone || s.address || s.dob || s.currentSchool || s.aadharNumber || s.stream || s.gender || s.studentId || s.joiningDate;
                return (
                  <React.Fragment key={s.id}>
                    <tr className="ledger-row">
                      <td className="pl-4 py-2.5 text-xs text-[#9C8F6E] font-mono">{idx + 1}</td>
                      <td className="pl-1 py-2.5">
                        {hasDetails && (
                          <button onClick={() => setExpanded(prev => ({ ...prev, [s.id]: !prev[s.id] }))} className="text-[#9C8F6E] hover:text-[#12312B] text-xs w-4">
                            {isOpen ? "▾" : "▸"}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-medium">
                        <div>{s.name}</div>
                        <div className="text-[10px] text-[#9C8F6E] flex gap-1.5">
                          {s.studentId && <span className="font-mono">{s.studentId}</span>}
                          {s.phone && <span>{s.studentId ? "· " : ""}{s.phone}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-[#12312B]">
                        {s.class}
                        {s.stream && <div className="text-[10px] font-normal text-[#9C8F6E]">{s.stream}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#6E6650]">{batchesForMonth(s, curMonth).join(", ") || "—"}</td>
                      <td className="px-4 py-2.5 text-xs font-semibold" style={{ fontFamily: "'IBM Plex Mono', monospace", color: displayDue > 0 ? "#A63D2F" : displayDue < 0 ? "#3F6B52" : "#3F6B52" }}>{fmtINR(displayDue)}{displayDue < 0 && <span className="ml-1 text-[9px] font-normal text-[#9C8F6E]">(advance)</span>}</td>
                      <td className="px-4 py-2.5 text-xs"><Stamp text={badgeText} tone={badgeTone} /></td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex flex-wrap gap-2 justify-end">
                          <LifecycleActions s={s} onExit={onExit} onPromote={onPromote} onBatchChange={onBatchChange} onViewHistory={onViewHistory} onUndo={onUndo} onStatement={onStatement} onAddCharge={onAddCharge} onJoiningForm={onJoiningForm} compact />
                          <button onClick={() => onEdit(s)} className="text-xs text-[#12312B] underline">Edit</button>
                          <button onClick={() => onRemove(s.id)} className="text-xs text-[#A63D2F] underline">Remove</button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && hasDetails && (
                      <tr>
                        <td></td>
                        <td></td>
                        <td colSpan={6} className="px-4 pb-3 pt-0">
                          <div className="grid grid-cols-3 gap-3 p-3 rounded bg-[#FAF6EC] border text-xs" style={{ borderColor: "#D8CFB8" }}>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Student ID</span>{s.studentId || "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Gender</span>{s.gender || "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Father's Name</span>{s.fatherName || "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Guardian Phone</span>{s.guardianPhone || "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Address</span>{s.address || "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Date of Birth</span>{s.dob ? fmtDate(s.dob) : "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Joining Date</span>{s.joiningDate ? fmtDate(s.joiningDate) : "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Current School / Institution</span>{s.currentSchool || "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Aadhar Number</span>{s.aadharNumber || "—"}</div>
                            <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Stream</span>{s.stream || "—"}</div>
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

// ============================================================================
// FEE & CLASS STRUCTURE — the consolidated academic-setup tab. Merges what
// used to be a separate "Manage Classes & Subjects" modal (reached from the
// old Class & Dues Hub) directly into the Fee Matrix, as two clean sub-tabs:
// the Class & Subject List on one side, Fee Matrix pricing (1–6 subjects)
// on the other.
// ============================================================================
function StructureTab({ feeStructure, setFeeStructure, classes, subjectsList, onSaveClasses, onSaveSubjects, streams, onSaveStreams }) {
  const [subTab, setSubTab] = useState("fees");

  function update(cls, count, val) {
    const updated = { ...feeStructure, [cls]: { ...feeStructure[cls], [count]: Number(val) || 0 } };
    setFeeStructure(updated);
  }

  return (
    <div>
      <SectionHeader eyebrow="Academic Setup" title="Fee & Class Structure" />
      {/* All three controls live in one aligned pill row as real tabs —
          "Manage Streams" used to open as a separate modal from here; it's
          now a third sub-tab with its own inline panel, exactly like
          "Fee Matrix Pricing" and "Class & Subject List" (see
          StreamManagerPanel below). */}
      <div className="flex border rounded-sm overflow-hidden mb-5 w-fit" style={{ borderColor: "#12312B" }}>
        <button onClick={() => setSubTab("fees")} className="px-4 py-2 text-xs font-semibold" style={{ background: subTab === "fees" ? "#12312B" : "white", color: subTab === "fees" ? "#F4EFDE" : "#12312B" }}>
          Fee Matrix Pricing
        </button>
        <button onClick={() => setSubTab("classes")} className="px-4 py-2 text-xs font-semibold" style={{ background: subTab === "classes" ? "#12312B" : "white", color: subTab === "classes" ? "#F4EFDE" : "#12312B", borderLeft: "1px solid #12312B" }}>
          Class & Subject List
        </button>
        <button onClick={() => setSubTab("streams")} className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5" style={{ background: subTab === "streams" ? "#12312B" : "white", color: subTab === "streams" ? "#F4EFDE" : "#12312B", borderLeft: "1px solid #12312B" }}>
          <Tag size={13} /> Manage Streams
        </button>
      </div>

      {subTab === "fees" ? (
        <div>
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
                    <td className="px-4 py-2.5 font-semibold text-[#12312B]">{c}</td>
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
      ) : subTab === "classes" ? (
        <ClassSubjectManager classes={classes} subjectsList={subjectsList} onSaveClasses={onSaveClasses} onSaveSubjects={onSaveSubjects} />
      ) : (
        <StreamManagerPanel streams={streams} onSave={onSaveStreams} />
      )}
    </div>
  );
}

// Inline (non-modal) Class & Subject manager — folded into the Fee & Class
// Structure tab. Same add/remove behavior the old standalone "Manage
// Classes & Subjects" modal had, just embedded as a sub-tab instead.
function ClassSubjectManager({ classes, subjectsList, onSaveClasses, onSaveSubjects }) {
  const [classList, setClassList] = useState([...classes]);
  const [subjList, setSubjList] = useState([...subjectsList]);
  const [newClassName, setNewClassName] = useState("");
  const [newSubjName, setNewSubjName] = useState("");
  const [saved, setSaved] = useState(false);

  const addClass = () => { if (newClassName.trim() && !classList.includes(newClassName.trim())) { setClassList([...classList, newClassName.trim()]); setNewClassName(""); } };
  const addSubject = () => { if (newSubjName.trim() && !subjList.includes(newSubjName.trim())) { setSubjList([...subjList, newSubjName.trim()]); setNewSubjName(""); } };
  const handleSave = () => {
    onSaveClasses(classList); onSaveSubjects(subjList);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="grid grid-cols-2 gap-5">
      <Card className="p-5">
        <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold mb-3">Class List</div>
        <div className="text-[11px] text-[#6E6650] mb-2 -mt-1">Whatever you type here is stored and shown exactly as-is, everywhere in the system — no automatic "Class" prefix is added. Type <strong>12</strong> to keep it as 12, <strong>JEE</strong> to keep it as JEE, or <strong>Class 12</strong> yourself if that's what you want displayed.</div>
        <Field label="Add Custom Class (typed exactly as you want it stored)">
          <div className="flex gap-2">
            <input className={inputCls} style={inputStyle} value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="e.g. 12, JEE, Class 12, NEET-A" />
            <button onClick={addClass} className="px-3 py-2 bg-[#12312B] text-white text-xs rounded font-semibold whitespace-nowrap">Add Class</button>
          </div>
        </Field>
        <div className="mt-2 flex flex-wrap gap-1.5 max-h-56 overflow-y-auto p-2 border bg-white rounded" style={{ borderColor: "#D8CFB8" }}>
          {classList.map(c => (
            <span key={c} className="px-2 py-0.5 text-xs bg-[#FAF6EC] border rounded font-medium flex items-center gap-1" style={{ borderColor: "#D8CFB8" }}>
              {c}
              <button onClick={() => setClassList(classList.filter(x => x !== c))} className="text-[#A63D2F]"><X size={10} /></button>
            </span>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold mb-3">Master Subject List</div>
        <Field label="Add Master Subject (e.g., Hindi, Computer, Biology)">
          <div className="flex gap-2">
            <input className={inputCls} style={inputStyle} value={newSubjName} onChange={e => setNewSubjName(e.target.value)} placeholder="Subject name" />
            <button onClick={addSubject} className="px-3 py-2 bg-[#12312B] text-white text-xs rounded font-semibold whitespace-nowrap">Add Subject</button>
          </div>
        </Field>
        <div className="mt-2 flex flex-wrap gap-1.5 max-h-56 overflow-y-auto p-2 border bg-white rounded" style={{ borderColor: "#D8CFB8" }}>
          {subjList.map(s => (
            <span key={s} className="px-2 py-0.5 text-xs bg-[#FAF6EC] border rounded font-medium flex items-center gap-1" style={{ borderColor: "#D8CFB8" }}>
              {s}
              <button onClick={() => setSubjList(subjList.filter(x => x !== s))} className="text-[#A63D2F]"><X size={10} /></button>
            </span>
          ))}
        </div>
      </Card>

      <div className="col-span-2">
        <button onClick={handleSave} className="w-full py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
          {saved ? "Saved ✓" : "Save Class & Subject Changes"}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// STREAM MANAGER — an inline panel, folded into the Fee & Class Structure
// tab as its own "Manage Streams" sub-tab (previously a separate modal
// launched from a floating button). Same add/remove/save behavior as
// before, just embedded like the other two sub-tabs instead of overlaying
// the screen. Saves to the same settings/streamList doc the app loads on
// startup, so whatever is added or removed here immediately shows up in
// the Stream dropdown on the Add / Edit Student form — no separate step
// needed anywhere else.
// ============================================================================
function StreamManagerPanel({ streams, onSave }) {
  const [streamList, setStreamList] = useState([...(streams || STREAMS)]);
  const [newStreamName, setNewStreamName] = useState("");
  const [saved, setSaved] = useState(false);

  const addStream = () => {
    const name = newStreamName.trim();
    if (name && !streamList.includes(name)) { setStreamList([...streamList, name]); setNewStreamName(""); }
  };
  const removeStream = (s) => setStreamList(streamList.filter(x => x !== s));
  const handleSave = () => {
    onSave(streamList);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <Card className="p-5 max-w-xl">
      <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold mb-3">Manage Streams</div>
      <div className="text-xs text-[#6E6650] mb-3">
        Add or delete Stream / academic-track options here. These are exactly what shows up in the <strong>Stream</strong> dropdown on the Add / Edit Student form — nothing else needs to change.
      </div>
      <Field label="Add New Stream">
        <div className="flex gap-2">
          <input
            className={inputCls} style={inputStyle} value={newStreamName}
            onChange={e => setNewStreamName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addStream(); } }}
            placeholder="e.g. PCMB, Vocational, Diploma"
          />
          <button onClick={addStream} className="px-3 py-2 bg-[#12312B] text-white text-xs rounded font-semibold whitespace-nowrap">Add Stream</button>
        </div>
      </Field>
      <div className="mt-1 flex flex-wrap gap-1.5 max-h-64 overflow-y-auto p-2 border bg-white rounded" style={{ borderColor: "#D8CFB8" }}>
        {streamList.length === 0 ? (
          <div className="text-xs text-[#9C8F6E] p-2">No streams yet — add one above.</div>
        ) : streamList.map(s => (
          <span key={s} className="px-2 py-0.5 text-xs bg-[#FAF6EC] border rounded font-medium flex items-center gap-1" style={{ borderColor: "#D8CFB8" }}>
            {s}
            <button onClick={() => removeStream(s)} className="text-[#A63D2F]" title="Delete stream"><X size={10} /></button>
          </span>
        ))}
      </div>
      <button onClick={handleSave} className="w-full mt-4 py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
        {saved ? "Saved ✓" : "Save Stream Changes"}
      </button>
    </Card>
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

  const sorted = [...deposits].sort((a, b) => compareChrono(a, b, -1));
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
              {(classes || []).map(c => <option key={c} value={c}>{c}</option>)}
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
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(d.date)}</td>
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

// ============================================================================
// CHARGES — the consolidated master view of every charge raised against a
// student: Opening Balance carry-forwards, monthly Tuition Fee accruals, AND
// ad-hoc Additional Charges, all in one ledger-style feed. "Add Charge"
// still only creates ad-hoc Additional Charges (tuition accrues on its own
// via the fee matrix); this tab is where you come to see and track all of it.
// ============================================================================
const CHARGE_TYPE_META = {
  opening: { label: "Opening Balance", tone: "carried" },
  monthly_fee: { label: "Tuition Fee", tone: "due" },
  extra_charge: { label: "Additional Charge", tone: "due" },
};

function ChargesTab({ chargeLines, students, classes, onAdd, onRemove, onOpenReceipt }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("");

  const sorted = [...chargeLines].sort((a, b) => compareChrono(a, b, -1));
  const filtered = sorted.filter(c => {
    const q = search.trim().toLowerCase();
    if (q && !c.studentName.toLowerCase().includes(q)) return false;
    if (classFilter !== "all" && String(c.studentClass) !== classFilter) return false;
    if (typeFilter !== "all" && c.type !== typeFilter) return false;
    if (monthFilter && c.month !== monthFilter) return false;
    return true;
  });
  const isFiltered = search || classFilter !== "all" || typeFilter !== "all" || monthFilter;
  const filteredTotal = round2(filtered.reduce((a, c) => a + Number(c.amount || 0), 0));

  return (
    <div>
      <SectionHeader eyebrow="Master Charges Ledger" title="Charges" action={
        <button onClick={onAdd} disabled={students.length === 0} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Add Charge
        </button>
      } />
      <div className="text-sm text-[#6E6650] mb-4">Every charge raised against a student — Opening Balances, monthly Tuition Fee accruals, and ad-hoc Additional Charges (exam fee, material cost, late fee, etc.) — tracked together in one master ledger. Use "Add Charge" for anything outside regular tuition.</div>

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
              {(classes || []).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Charge Type</div>
            <select className={inputCls} style={inputStyle} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="all">All Types</option>
              {Object.entries(CHARGE_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Month</div>
            <input type="month" className={inputCls} style={inputStyle} value={monthFilter} onChange={e => setMonthFilter(e.target.value)} />
          </div>
          {isFiltered && (
            <button onClick={() => { setSearch(""); setClassFilter("all"); setTypeFilter("all"); setMonthFilter(""); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
      </Card>

      {isFiltered && (
        <div className="text-xs text-[#6E6650] mb-3">Showing {filtered.length} of {sorted.length} charges · Total: <strong className="text-[#B8862B]">{fmtINR(filteredTotal)}</strong></div>
      )}

      <Card>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">{sorted.length === 0 ? "No charges logged yet." : "No charges match these filters."}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Charge ID", "Date", "Student", "Class", "Type", "Description", "For Month", "Amount", "Paid", "Outstanding", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const meta = CHARGE_TYPE_META[c.type] || { label: c.type, tone: "due" };
                const isAdhoc = c.type === "extra_charge";
                return (
                  <tr key={c.id + "-" + i} className="ledger-row">
                    <td className="px-4 py-2.5 text-[10px] font-mono">
                      <button onClick={() => onOpenReceipt(c)} className="text-[#12312B] underline hover:text-[#3F6B52]" title="Open printable receipt">{c.chargeId}</button>
                    </td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(c.date)}</td>
                    <td className="px-4 py-2.5 font-medium">{c.studentName}{c.studentStatus !== "active" && <span className="ml-1.5 text-[10px] text-[#4A7B9D]">({c.studentStatus === "dropped" ? "dropped" : "on break"})</span>}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#12312B]">{c.studentClass}</td>
                    <td className="px-4 py-2.5"><Stamp text={meta.label} tone={meta.tone} /></td>
                    <td className="px-4 py-2.5 text-xs">{c.label}{c.remarks ? <div className="text-[10px] text-[#9C8F6E]">{c.remarks}</div> : null}</td>
                    <td className="px-4 py-2.5 text-xs">{monthLabel(c.month)}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#B8862B]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(c.amount)}</td>
                    <td className="px-4 py-2.5 text-xs text-[#3F6B52]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(c.paid)}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold" style={{ fontFamily: "'IBM Plex Mono', monospace", color: c.outstanding > 0 ? "#A63D2F" : "#3F6B52" }}>{fmtINR(c.outstanding)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onOpenReceipt(c)} className="flex items-center gap-1 text-xs text-[#12312B] underline mr-3 inline-flex"><Printer size={12} /> Receipt</button>
                      {isAdhoc ? (
                        <button onClick={() => onRemove(c.id)} className="text-xs text-[#A63D2F] underline">Delete</button>
                      ) : (
                        <span className="text-xs text-[#D8CFB8]">—</span>
                      )}
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
// ACADEMIC MONITORING — tracks student academic performance (attendance,
// test scores, behaviour/conduct) for the coaching center's internal use
// and for printable parent-facing reports. Four sub-tabs, same bordered
// pill-row pattern as StructureTab / StudentManagementTab / BankingTab.
// Each of Attendance, Test Scores, and Behaviour & Conduct is backed by
// its own Firestore collection (attendance / testScores / behaviourNotes),
// with full soft-delete + Trash/Restore support wired into TrashTab.
// ============================================================================
// UPDATE — "Attendance" and "Test Scores" used to be the older per-student
// sub-tabs here (AttendanceTab / TestScoresTab, reading the "attendance" /
// "testScores" collections). They've been replaced by "Mark Attendance"
// and "Test Marks" — the same batch-wise, roster-driven components
// (MarkAttendanceTab / TestMarksTab) that used to live under their own
// standalone "Attendance" sidebar tab (removed — see the new UPDATE NOTES
// entry). AttendanceTab / TestScoresTab and the "attendance" / "testScores"
// collections themselves are untouched below — PerformanceReportTab still
// reads from them, see the note on that component.
const ACADEMIC_MONITORING_SUB_TABS = [
  { id: "mark-attendance", label: "Attendance", icon: ClipboardCheck },
  { id: "test-marks", label: "Scores", icon: Award },
  { id: "behaviour", label: "Behaviour & Conduct", icon: MessageSquare },
  { id: "report", label: "Performance", icon: FileBarChart2 },
];

function AcademicMonitoringTab({
  students, classes, attendance, testScores, behaviourNotes,
  onAddBehaviour, onEditBehaviour, onRemoveBehaviour,
  subjectsList, batchSchedule, attendanceLog, batchesForMonth, onSaveAttendanceLog,
  onEditAttendanceLog, onDeleteAttendanceLog,
  tests, onSaveTest, onEditTest, onDeleteTest,
  teacherPerformanceTabProps,
}) {
  const [subTab, setSubTab] = useState("mark-attendance");

  return (
    <div>
      <SectionHeader eyebrow="Academic Tracking" title="Academic Monitoring" />
      <div className="text-sm text-[#6E6650] mb-4">Attendance, test performance, and behaviour & conduct for every student — for internal review, and to print a clean parent-facing summary.</div>

      {/* Same bordered pill-row pattern as StructureTab / StudentManagementTab / BankingTab. */}
      <div className="flex border rounded-sm overflow-hidden mb-5 w-fit flex-wrap" style={{ borderColor: "#12312B" }}>
        {ACADEMIC_MONITORING_SUB_TABS.map((st, i) => {
          const Icon = st.icon;
          const active = subTab === st.id;
          return (
            <button key={st.id} onClick={() => setSubTab(st.id)}
              className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
              style={{ background: active ? "#12312B" : "white", color: active ? "#F4EFDE" : "#12312B", borderLeft: i === 0 ? "none" : "1px solid #12312B" }}>
              <Icon size={13} /> {st.label}
            </button>
          );
        })}
      </div>

      {subTab === "mark-attendance" && (
        <AttendanceSectionTab classes={classes} subjectsList={subjectsList} batchSchedule={batchSchedule} students={students}
          attendanceLog={attendanceLog} batchesForMonth={batchesForMonth} onSave={onSaveAttendanceLog}
          onEdit={onEditAttendanceLog} onDelete={onDeleteAttendanceLog} />
      )}
      {subTab === "test-marks" && (
        <ScoresSectionTab classes={classes} subjectsList={subjectsList} batchSchedule={batchSchedule} students={students}
          tests={tests} batchesForMonth={batchesForMonth} onSave={onSaveTest}
          onEdit={onEditTest} onDelete={onDeleteTest} />
      )}
      {subTab === "behaviour" && (
        <BehaviourTab students={students} classes={classes} behaviourNotes={behaviourNotes}
          onAdd={onAddBehaviour} onEdit={onEditBehaviour} onRemove={onRemoveBehaviour} />
      )}
      {subTab === "report" && (
        // UPDATE — this used to render PerformanceReportTab directly. It now
        // renders PerformanceSectionTab, which adds its own inner pill row
        // with three panels: "Performance Report" (this exact
        // PerformanceReportTab, unchanged — individual student view),
        // "Teachers Performance" (TeacherPerformanceTab, moved here from
        // Institute Management), and "Institute Performance" (new —
        // overall/aggregate view). See PerformanceSectionTab below.
        <PerformanceSectionTab students={students} attendanceLog={attendanceLog} tests={tests} behaviourNotes={behaviourNotes}
          classes={classes} subjectsList={subjectsList} teacherPerformanceTabProps={teacherPerformanceTabProps} />
      )}
    </div>
  );
}

// ---- Attendance — mark daily / class-wise attendance (Present / Absent /
// Late) per student, with a date filter and a per-student attendance %
// summary. ----
function AttendanceTab({ students, classes, attendance, onAdd, onEdit, onRemove }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  const studentById = useMemo(() => Object.fromEntries((students || []).map(s => [s.id, s])), [students]);
  const sorted = useMemo(() => [...attendance].sort((a, b) => compareChrono(a, b, -1)), [attendance]);

  const matchesFilters = (a, includeDate) => {
    const st = studentById[a.studentId];
    if (!st) return false;
    if (classFilter !== "all" && String(st.class) !== classFilter) return false;
    if (includeDate && dateFilter && a.date !== dateFilter) return false;
    if (search) {
      const q = search.trim().toLowerCase();
      if (!(st.name || "").toLowerCase().includes(q)) return false;
    }
    return true;
  };

  const filtered = useMemo(() => sorted.filter(a => matchesFilters(a, true)), [sorted, studentById, classFilter, dateFilter, search]); // eslint-disable-line react-hooks/exhaustive-deps
  const isFiltered = search || classFilter !== "all" || dateFilter;

  // Per-student attendance % summary — respects the Name / Class filters,
  // but deliberately ignores the Date filter so it always reflects the
  // student's full attendance history, not just one day.
  const summary = useMemo(() => {
    const map = {};
    attendance.forEach(a => {
      if (!matchesFilters(a, false)) return;
      if (!map[a.studentId]) map[a.studentId] = { student: studentById[a.studentId], present: 0, absent: 0, late: 0, total: 0 };
      map[a.studentId].total += 1;
      if (a.status === "Present") map[a.studentId].present += 1;
      else if (a.status === "Late") map[a.studentId].late += 1;
      else map[a.studentId].absent += 1;
    });
    return Object.values(map).sort((a, b) => (a.student.name || "").localeCompare(b.student.name || ""));
  }, [attendance, studentById, classFilter, search]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <SectionHeader eyebrow="Daily / Class-wise" title="Attendance" action={
        <button onClick={onAdd} disabled={students.length === 0} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Mark Attendance
        </button>
      } />
      <div className="text-sm text-[#6E6650] mb-4">Mark Present / Absent / Late per student. Filter by date to review a single day — the attendance % summary below always reflects each student's full history.</div>

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
              {(classes || []).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Date</div>
            <input type="date" className={inputCls} style={inputStyle} value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
          </div>
          {isFiltered && (
            <button onClick={() => { setSearch(""); setClassFilter("all"); setDateFilter(""); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
      </Card>

      <div className="mb-3" style={{ fontFamily: "'Zilla Slab', serif" }}><span className="text-lg font-semibold">Attendance % Summary</span></div>
      <Card className="mb-6">
        {summary.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#9C8F6E]">No attendance recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Student", "Class", "Present", "Absent", "Late", "Total Days", "Attendance %"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.map(s => {
                const pct = s.total > 0 ? round2(((s.present + s.late) / s.total) * 100) : 0;
                return (
                  <tr key={s.student.id} className="ledger-row">
                    <td className="px-4 py-2.5 font-medium">{s.student.name}</td>
                    <td className="px-4 py-2.5 text-xs">{s.student.class}</td>
                    <td className="px-4 py-2.5 text-xs text-[#3F6B52] font-mono">{s.present}</td>
                    <td className="px-4 py-2.5 text-xs text-[#A63D2F] font-mono">{s.absent}</td>
                    <td className="px-4 py-2.5 text-xs text-[#B8862B] font-mono">{s.late}</td>
                    <td className="px-4 py-2.5 text-xs font-mono">{s.total}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold font-mono" style={{ color: pct >= 75 ? "#3F6B52" : "#A63D2F" }}>{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {isFiltered && (
        <div className="text-xs text-[#6E6650] mb-3">Showing {filtered.length} of {sorted.length} records</div>
      )}
      <Card>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">{sorted.length === 0 ? "No attendance records yet." : "No attendance records match these filters."}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Date", "Student", "Class", "Status", "Remarks", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const st = studentById[a.studentId];
                const tone = a.status === "Present" ? "paid" : a.status === "Late" ? "due" : "overdue";
                return (
                  <tr key={a.id} className="ledger-row">
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(a.date)}</td>
                    <td className="px-4 py-2.5 font-medium">{st ? st.name : "—"}</td>
                    <td className="px-4 py-2.5 text-xs">{st ? st.class : "—"}</td>
                    <td className="px-4 py-2.5"><Stamp text={a.status} tone={tone} /></td>
                    <td className="px-4 py-2.5 text-xs">{a.remarks || "—"}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onEdit(a)} className="text-xs text-[#12312B] underline mr-3">Edit</button>
                      <button onClick={() => onRemove(a.id)} className="text-xs text-[#A63D2F] underline">Delete</button>
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

// ---- Test Scores — test/exam name, subject, date, marks, remarks per
// student, with a per-student score history and class-wise average. ----
function TestScoresTab({ students, classes, testScores, onAdd, onEdit, onRemove }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");

  const studentById = useMemo(() => Object.fromEntries((students || []).map(s => [s.id, s])), [students]);
  const sorted = useMemo(() => [...testScores].sort((a, b) => compareChrono(a, b, -1)), [testScores]);
  const subjectOptions = useMemo(() => Array.from(new Set(testScores.map(t => t.subject).filter(Boolean))).sort(), [testScores]);

  const filtered = useMemo(() => sorted.filter(t => {
    const st = studentById[t.studentId];
    if (!st) return false;
    if (classFilter !== "all" && String(st.class) !== classFilter) return false;
    if (subjectFilter !== "all" && t.subject !== subjectFilter) return false;
    if (search) {
      const q = search.trim().toLowerCase();
      if (!(st.name || "").toLowerCase().includes(q)) return false;
    }
    return true;
  }), [sorted, studentById, classFilter, subjectFilter, search]);
  const isFiltered = search || classFilter !== "all" || subjectFilter !== "all";

  // Class-wise average % — respects the Subject filter so a center can
  // check e.g. "average Mathematics score by class".
  const classAverages = useMemo(() => {
    const map = {};
    testScores.forEach(t => {
      const st = studentById[t.studentId];
      if (!st) return;
      if (subjectFilter !== "all" && t.subject !== subjectFilter) return;
      const max = Number(t.maxMarks) || 0;
      if (max <= 0) return;
      const cls = st.class;
      if (!map[cls]) map[cls] = { totalObtained: 0, totalMax: 0, count: 0 };
      map[cls].totalObtained += Number(t.marksObtained) || 0;
      map[cls].totalMax += max;
      map[cls].count += 1;
    });
    return Object.entries(map).map(([cls, v]) => ({
      class: cls, count: v.count, avgPct: v.totalMax > 0 ? round2((v.totalObtained / v.totalMax) * 100) : 0,
    })).sort((a, b) => (a.class || "").localeCompare(b.class || "", undefined, { numeric: true }));
  }, [testScores, studentById, subjectFilter]);

  return (
    <div>
      <SectionHeader eyebrow="Exams & Tests" title="Test Scores" action={
        <button onClick={onAdd} disabled={students.length === 0} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Add Test Score
        </button>
      } />
      <div className="text-sm text-[#6E6650] mb-4">Record test/exam name, subject, date, marks obtained, max marks, and remarks per student. See each student's score history and class-wise averages below.</div>

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
              {(classes || []).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Subject</div>
            <select className={inputCls} style={inputStyle} value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
              <option value="all">All Subjects</option>
              {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {isFiltered && (
            <button onClick={() => { setSearch(""); setClassFilter("all"); setSubjectFilter("all"); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
      </Card>

      <div className="mb-3" style={{ fontFamily: "'Zilla Slab', serif" }}><span className="text-lg font-semibold">Class-wise Average</span></div>
      <Card className="mb-6">
        {classAverages.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#9C8F6E]">No test scores recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Class", "Tests Recorded", "Average %"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classAverages.map(c => (
                <tr key={c.class} className="ledger-row">
                  <td className="px-4 py-2.5 font-semibold text-[#12312B]">{c.class}</td>
                  <td className="px-4 py-2.5 text-xs font-mono">{c.count}</td>
                  <td className="px-4 py-2.5 text-xs font-semibold font-mono" style={{ color: c.avgPct >= 40 ? "#3F6B52" : "#A63D2F" }}>{c.avgPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {isFiltered && (
        <div className="text-xs text-[#6E6650] mb-3">Showing {filtered.length} of {sorted.length} records</div>
      )}
      <Card>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">{sorted.length === 0 ? "No test scores logged yet." : "No test scores match these filters."}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Date", "Student", "Class", "Test", "Subject", "Marks", "%", "Remarks", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const st = studentById[t.studentId];
                const pct = Number(t.maxMarks) > 0 ? round2((Number(t.marksObtained) / Number(t.maxMarks)) * 100) : 0;
                return (
                  <tr key={t.id} className="ledger-row">
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(t.date)}</td>
                    <td className="px-4 py-2.5 font-medium">{st ? st.name : "—"}</td>
                    <td className="px-4 py-2.5 text-xs">{st ? st.class : "—"}</td>
                    <td className="px-4 py-2.5 text-xs">{t.testName}</td>
                    <td className="px-4 py-2.5 text-xs">{t.subject}</td>
                    <td className="px-4 py-2.5 text-xs font-mono">{t.marksObtained}/{t.maxMarks}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold font-mono" style={{ color: pct >= 40 ? "#3F6B52" : "#A63D2F" }}>{pct}%</td>
                    <td className="px-4 py-2.5 text-xs">{t.remarks || "—"}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onEdit(t)} className="text-xs text-[#12312B] underline mr-3">Edit</button>
                      <button onClick={() => onRemove(t.id)} className="text-xs text-[#A63D2F] underline">Delete</button>
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

// ---- Behaviour & Conduct — short dated notes/observations per student
// (discipline, participation, homework completion, etc.), each tagged
// positive / neutral / needs-attention. ----
const BEHAVIOUR_TAG_META = {
  positive: { label: "Positive", tone: "paid" },
  neutral: { label: "Neutral", tone: "break" },
  "needs-attention": { label: "Needs Attention", tone: "overdue" },
};

function BehaviourTab({ students, classes, behaviourNotes, onAdd, onEdit, onRemove }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");

  const studentById = useMemo(() => Object.fromEntries((students || []).map(s => [s.id, s])), [students]);
  const sorted = useMemo(() => [...behaviourNotes].sort((a, b) => compareChrono(a, b, -1)), [behaviourNotes]);

  const filtered = useMemo(() => sorted.filter(b => {
    const st = studentById[b.studentId];
    if (!st) return false;
    if (classFilter !== "all" && String(st.class) !== classFilter) return false;
    if (tagFilter !== "all" && b.tag !== tagFilter) return false;
    if (search) {
      const q = search.trim().toLowerCase();
      if (!(st.name || "").toLowerCase().includes(q)) return false;
    }
    return true;
  }), [sorted, studentById, classFilter, tagFilter, search]);
  const isFiltered = search || classFilter !== "all" || tagFilter !== "all";

  return (
    <div>
      <SectionHeader eyebrow="Discipline · Participation · Homework" title="Behaviour & Conduct" action={
        <button onClick={onAdd} disabled={students.length === 0} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Add Note
        </button>
      } />
      <div className="text-sm text-[#6E6650] mb-4">Short dated observations per student — discipline, participation, homework completion, etc. — each tagged Positive, Neutral, or Needs Attention.</div>

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
              {(classes || []).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Tag</div>
            <select className={inputCls} style={inputStyle} value={tagFilter} onChange={e => setTagFilter(e.target.value)}>
              <option value="all">All Tags</option>
              {Object.entries(BEHAVIOUR_TAG_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          {isFiltered && (
            <button onClick={() => { setSearch(""); setClassFilter("all"); setTagFilter("all"); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
      </Card>

      {isFiltered && (
        <div className="text-xs text-[#6E6650] mb-3">Showing {filtered.length} of {sorted.length} notes</div>
      )}
      <Card>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">{sorted.length === 0 ? "No behaviour notes logged yet." : "No notes match these filters."}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Date", "Student", "Class", "Tag", "Note", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const st = studentById[b.studentId];
                const meta = BEHAVIOUR_TAG_META[b.tag] || { label: b.tag, tone: "due" };
                return (
                  <tr key={b.id} className="ledger-row">
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(b.date)}</td>
                    <td className="px-4 py-2.5 font-medium">{st ? st.name : "—"}</td>
                    <td className="px-4 py-2.5 text-xs">{st ? st.class : "—"}</td>
                    <td className="px-4 py-2.5"><Stamp text={meta.label} tone={meta.tone} /></td>
                    <td className="px-4 py-2.5 text-xs">{b.note}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onEdit(b)} className="text-xs text-[#12312B] underline mr-3">Edit</button>
                      <button onClick={() => onRemove(b.id)} className="text-xs text-[#A63D2F] underline">Delete</button>
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

// ---- "Performance" sub-tab wrapper — same inner-pill-row pattern as
// AttendanceSectionTab / ScoresSectionTab: three panels — "Performance
// Report" (PerformanceReportTab, unchanged, individual student view),
// "Teachers Performance" (TeacherPerformanceTab, moved here from Institute
// Management — same component/props, just relocated), and "Institute
// Performance" (new — aggregate/overall view, see InstitutePerformanceTab
// below). ----
function PerformanceSectionTab({ students, attendanceLog, tests, behaviourNotes, classes, subjectsList, teacherPerformanceTabProps }) {
  const [inner, setInner] = useState("report");
  return (
    <div>
      <div className="flex border rounded-sm overflow-hidden mb-4 w-fit" style={{ borderColor: "#12312B" }}>
        <button onClick={() => setInner("report")} className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
          style={{ background: inner === "report" ? "#12312B" : "white", color: inner === "report" ? "#F4EFDE" : "#12312B" }}>
          <FileBarChart2 size={13} /> Performance Report
        </button>
        <button onClick={() => setInner("teachers")} className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
          style={{ background: inner === "teachers" ? "#12312B" : "white", color: inner === "teachers" ? "#F4EFDE" : "#12312B", borderLeft: "1px solid #12312B" }}>
          <UserCog size={13} /> Teachers Performance
        </button>
        <button onClick={() => setInner("institute")} className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
          style={{ background: inner === "institute" ? "#12312B" : "white", color: inner === "institute" ? "#F4EFDE" : "#12312B", borderLeft: "1px solid #12312B" }}>
          <GraduationCap size={13} /> Institute Performance
        </button>
      </div>
      {inner === "report" && <PerformanceReportTab students={students} attendanceLog={attendanceLog} tests={tests} behaviourNotes={behaviourNotes} />}
      {inner === "teachers" && <TeacherPerformanceTab {...teacherPerformanceTabProps} />}
      {inner === "institute" && <InstitutePerformanceTab students={students} attendanceLog={attendanceLog} tests={tests} classes={classes} subjectsList={subjectsList} />}
    </div>
  );
}

// ---- Performance Report — a printable, parent-facing summary per student
// combining attendance %, recent test scores, and behaviour notes into one
// clean A4 report. Reuses the Joining Form / Center Statement print-window
// pattern: Tailwind CDN + Google Fonts loaded into the popup, A4 layout,
// letterhead style. ----
function PerformanceReportTab({ students, attendanceLog, tests, behaviourNotes }) {
  const [studentId, setStudentId] = useState(students[0]?.id || "");
  const [studentSearch, setStudentSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const reportRef = useRef();

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

  // BUGFIX — this used to read the old per-student `attendance` collection,
  // which nothing writes to anymore (Mark Attendance saves to the batch-wise
  // `attendanceLog` collection instead — see UPDATE NOTES). That made this
  // report permanently show "No data" / stale numbers regardless of new
  // attendance actually being marked. Now derived directly from
  // attendanceLog: for every saved session, pull out this student's own
  // record (if they were on that session's roster) into a flat list.
  const studentAttendanceLog = useMemo(() => {
    const rows = [];
    (attendanceLog || []).forEach(a => {
      const rec = (a.records || []).find(r => r.studentId === studentId);
      if (rec) rows.push({ id: a.id, date: a.date, createdAt: a.createdAt, status: rec.status, subject: a.subject });
    });
    return rows.sort((a, b) => compareChrono(a, b, -1));
  }, [attendanceLog, studentId]);
  const attendancePct = useMemo(() => {
    const total = studentAttendanceLog.length;
    if (!total) return null;
    const present = studentAttendanceLog.filter(a => a.status === "Present").length;
    return round2((present / total) * 100);
  }, [studentAttendanceLog]);

  // BUGFIX — same issue as attendance above: this used to read the old
  // per-student `testScores` collection, which nothing writes to anymore
  // (Fill Marks saves to the batch-wise `tests` collection instead). Now
  // derived directly from `tests`: for every saved test, pull out this
  // student's own score (if they were marked) into a flat list.
  const studentTestScores = useMemo(() => {
    const rows = [];
    (tests || []).forEach(t => {
      const sc = (t.scores || []).find(x => x.studentId === studentId);
      if (sc && sc.marks !== "" && sc.marks != null) {
        rows.push({ id: t.id, date: t.date, createdAt: t.createdAt, testId: t.testId, subject: t.subject, marksObtained: Number(sc.marks) || 0, maxMarks: Number(t.maxMarks) || 0, description: t.description });
      }
    });
    return rows.sort((a, b) => compareChrono(a, b, -1)).slice(0, 10);
  }, [tests, studentId]);
  const avgScorePct = useMemo(() => {
    if (!studentTestScores.length) return null;
    const totalObtained = studentTestScores.reduce((a, t) => a + (Number(t.marksObtained) || 0), 0);
    const totalMax = studentTestScores.reduce((a, t) => a + (Number(t.maxMarks) || 0), 0);
    return totalMax > 0 ? round2((totalObtained / totalMax) * 100) : null;
  }, [studentTestScores]);

  const studentBehaviourNotes = useMemo(() =>
    (behaviourNotes || []).filter(b => b.studentId === studentId).sort((a, b) => compareChrono(a, b, -1)).slice(0, 10),
    [behaviourNotes, studentId]
  );

  const generatedOn = fmtDate(todayStr());

  const handlePrint = () => {
    if (!student || !reportRef.current) return;
    const printContent = reportRef.current.innerHTML;
    const win = window.open("", "", "width=900,height=1000");
    // Same Tailwind CDN + Google Fonts print-popup pattern used by the
    // Joining Form and every printable statement in this app, so this
    // prints exactly like the on-screen preview instead of unstyled text.
    win.document.write(`
      <html>
        <head>
          <title>Performance Report - ${student.name}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            ${FONT_IMPORT}
            @page { size: A4; margin: 16mm; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { font-family: 'Inter', sans-serif; color: #12312B; background: #fff; margin: 0; }
            .report-doc { border: 1.5px solid #B8862B; border-radius: 4px; padding: 22px; }
            .report-doc::before { content: ""; display: block; height: 3px; background: #12312B; margin: -22px -22px 18px -22px; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
          </style>
        </head>
        <body>
          <div class="report-doc">${printContent}</div>
        </body>
      </html>
    `);
    win.document.close(); win.focus(); setTimeout(() => { win.print(); win.close(); }, 300);
  };

  return (
    <div>
      <SectionHeader eyebrow="Parent-Facing Summary" title="Performance Report" action={
        <button onClick={handlePrint} disabled={!student} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Printer size={15} /> Print / Export
        </button>
      } />
      <div className="text-sm text-[#6E6650] mb-4">A single printable A4 summary combining attendance %, recent test scores, and behaviour notes — for internal review or to hand to a parent.</div>

      <Card className="p-3.5 mb-5">
        <Field label="Select Student">
          <div className="relative">
            <div className="flex items-center border rounded-sm bg-white px-3 py-2 cursor-pointer" style={inputStyle} onClick={() => setPickerOpen(o => !o)}>
              <Search size={13} className="text-[#9C8F6E] mr-2 shrink-0" />
              <span className="text-sm flex-1 truncate">{student ? `${student.name} — ${student.class}${student.phone ? " · " + student.phone : ""}` : "Search by name, class, or phone…"}</span>
            </div>
            {pickerOpen && (
              <div className="absolute z-10 mt-1 w-full bg-white border rounded-sm shadow-lg max-h-72 overflow-y-auto" style={{ borderColor: "#D8CFB8" }}>
                <div className="p-2 sticky top-0 bg-white border-b flex gap-2" style={{ borderColor: "#EEE7D2" }}>
                  <input autoFocus className={inputCls} style={inputStyle} value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="Type name or phone…" />
                  <select className={inputCls} style={{ ...inputStyle, width: "auto" }} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                    <option value="all">All Classes</option>
                    {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {filteredStudents.length === 0 ? (
                  <div className="p-3 text-xs text-[#9C8F6E] text-center">No students match.</div>
                ) : (
                  filteredStudents.map(s => (
                    <button key={s.id} type="button" onClick={() => { setStudentId(s.id); setPickerOpen(false); setStudentSearch(""); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#F5F0E1] flex items-center justify-between"
                      style={{ background: s.id === studentId ? "#F5F0E1" : "white" }}>
                      <span>{s.name} <span className="text-xs text-[#9C8F6E]">— {s.class}</span></span>
                      <span className="text-xs text-[#9C8F6E] font-mono">{s.phone || ""}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </Field>
      </Card>

      {!student ? (
        <Card className="p-8 text-center text-sm text-[#9C8F6E]">Select a student to view their performance report.</Card>
      ) : (
        <div
          className="p-6 bg-white rounded-sm mb-4"
          ref={reportRef}
          style={{ border: "1.5px solid #B8862B", borderRadius: "4px", boxShadow: "0 1px 3px rgba(18,49,43,0.08)" }}
        >
          <div className="text-center pb-3 mb-4" style={{ borderBottom: "2px dashed #12312B" }}>
            <InstituteHeader subtitle={`Student Performance Report`} large={true} />
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mb-5">
            <div className="flex justify-between border-b border-dotted py-1.5" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Student Name</span><span className="font-semibold text-[#12312B]">{student.name}</span></div>
            <div className="flex justify-between border-b border-dotted py-1.5" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Student ID</span><span className="font-semibold text-[#12312B]">{student.studentId || "—"}</span></div>
            <div className="flex justify-between border-b border-dotted py-1.5" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Class</span><span className="font-semibold text-[#12312B]">{student.class}</span></div>
            <div className="flex justify-between border-b border-dotted py-1.5" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Report Generated</span><span className="font-semibold text-[#12312B]">{generatedOn}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="p-3 rounded-sm border" style={{ borderColor: "#D8CFB8" }}>
              <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Attendance</div>
              <div style={{ fontFamily: "'Zilla Slab', serif", color: attendancePct === null ? "#9C8F6E" : (attendancePct >= 75 ? "#3F6B52" : "#A63D2F") }} className="text-xl font-bold">
                {attendancePct === null ? "No data" : `${attendancePct}%`}
              </div>
              <div className="text-[11px] text-[#9C8F6E]">{studentAttendanceLog.length} session(s) recorded</div>
            </div>
            <div className="p-3 rounded-sm border" style={{ borderColor: "#D8CFB8" }}>
              <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Average Test Score</div>
              <div style={{ fontFamily: "'Zilla Slab', serif", color: avgScorePct === null ? "#9C8F6E" : (avgScorePct >= 40 ? "#3F6B52" : "#A63D2F") }} className="text-xl font-bold">
                {avgScorePct === null ? "No data" : `${avgScorePct}%`}
              </div>
              <div className="text-[11px] text-[#9C8F6E]">Based on last {studentTestScores.length} test(s)</div>
            </div>
          </div>

          <div className="font-bold text-[11px] uppercase tracking-wider mb-2" style={{ color: "#8A6420", borderBottom: "1px solid #D8CFB8", paddingBottom: "4px" }}>Recent Test Scores</div>
          {studentTestScores.length === 0 ? (
            <div className="text-xs text-[#9C8F6E] mb-4">No test scores recorded yet.</div>
          ) : (
            <table className="w-full text-xs mb-4">
              <thead>
                <tr>
                  {["Date", "Test", "Subject", "Marks", "%", "Remarks"].map(h => (
                    <th key={h} className="text-left py-1.5 uppercase tracking-wider text-[#9C8F6E]" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {studentTestScores.map(t => {
                  const pct = Number(t.maxMarks) > 0 ? round2((Number(t.marksObtained) / Number(t.maxMarks)) * 100) : 0;
                  return (
                    <tr key={t.id} style={{ borderTop: "1px dotted #E4DCC5" }}>
                      <td className="py-1.5 whitespace-nowrap">{fmtDate(t.date)}</td>
                      <td className="py-1.5 font-mono">{t.testId}</td>
                      <td className="py-1.5">{t.subject}</td>
                      <td className="py-1.5 font-mono">{t.marksObtained}/{t.maxMarks}</td>
                      <td className="py-1.5 font-mono font-semibold" style={{ color: pct >= 40 ? "#3F6B52" : "#A63D2F" }}>{pct}%</td>
                      <td className="py-1.5">{t.description || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="font-bold text-[11px] uppercase tracking-wider mb-2" style={{ color: "#8A6420", borderBottom: "1px solid #D8CFB8", paddingBottom: "4px" }}>Behaviour & Conduct Notes</div>
          {studentBehaviourNotes.length === 0 ? (
            <div className="text-xs text-[#9C8F6E] mb-4">No behaviour notes recorded yet.</div>
          ) : (
            <div className="space-y-1.5 mb-4">
              {studentBehaviourNotes.map(b => {
                const meta = BEHAVIOUR_TAG_META[b.tag] || { label: b.tag, tone: "due" };
                return (
                  <div key={b.id} className="text-xs flex items-start justify-between gap-3 py-1" style={{ borderBottom: "1px dotted #E4DCC5" }}>
                    <div><span className="font-mono text-[#9C8F6E] mr-2 whitespace-nowrap">{fmtDate(b.date)}</span>{b.note}</div>
                    <Stamp text={meta.label} tone={meta.tone} />
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-between mt-10 text-xs">
            <div style={{ borderTop: "1px solid #12312B", paddingTop: "6px", width: "200px", textAlign: "center", color: "#4A4636" }}>Parent / Guardian Signature</div>
            <div style={{ borderTop: "1px solid #12312B", paddingTop: "6px", width: "200px", textAlign: "center", color: "#4A4636" }}>Authorized Signatory</div>
          </div>

          <div className="text-center text-[10px] text-[#9C8F6E] mt-6 pt-3" style={{ borderTop: "1.5px solid #12312B" }}>
            Computer Generated Report · Coaching Classes Academic Monitoring
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Institute Performance — new aggregate view: overall attendance % and
// average test score % across the whole institute for a selected
// month/year, plus a By Class and By Subject breakdown. Derived directly
// from attendanceLog/tests (the same batch-wise collections everything
// else in Academic Monitoring already uses), same calculation approach as
// the Dashboard's "Institute Snapshot" tiles but with its own period
// control (not tied to the Dashboard's curMonth) and per-class/per-subject
// detail those tiles don't have room for. ----
function InstitutePerformanceTab({ students, attendanceLog, tests, classes, subjectsList }) {
  const [periodType, setPeriodType] = useState("month");
  const [selectedMonth, setSelectedMonth] = useState(todayStr().slice(0, 7));
  const selectedYear = selectedMonth.slice(0, 4);

  const inPeriod = (dateStr) => {
    if (!dateStr) return false;
    return periodType === "month" ? dateStr.slice(0, 7) === selectedMonth : dateStr.slice(0, 4) === selectedYear;
  };

  const periodAttendance = useMemo(() => (attendanceLog || []).filter(a => inPeriod(a.date)), [attendanceLog, periodType, selectedMonth]);
  const periodTests = useMemo(() => (tests || []).filter(t => inPeriod(t.date)), [tests, periodType, selectedMonth]);

  const totalRecords = periodAttendance.reduce((n, a) => n + (a.records || []).length, 0);
  const presentRecords = periodAttendance.reduce((n, a) => n + (a.records || []).filter(r => r.status === "Present").length, 0);
  const overallAttendancePct = totalRecords > 0 ? round2((presentRecords / totalRecords) * 100) : null;

  const scoreTotals = periodTests.reduce((acc, t) => {
    (t.scores || []).forEach(sc => {
      if (sc.marks === "" || sc.marks == null) return;
      acc.obtained += Number(sc.marks) || 0;
      acc.max += Number(t.maxMarks) || 0;
    });
    return acc;
  }, { obtained: 0, max: 0 });
  const overallScorePct = scoreTotals.max > 0 ? round2((scoreTotals.obtained / scoreTotals.max) * 100) : null;

  // By Class / By Subject breakdowns — same attendance%/score% math, just
  // grouped. Only classes/subjects that actually appear in this period's
  // data are shown, so the tables don't pad out with empty rows.
  function breakdownBy(key) {
    const groups = {};
    periodAttendance.forEach(a => {
      const k = a[key];
      if (!k) return;
      if (!groups[k]) groups[k] = { total: 0, present: 0, scoreObtained: 0, scoreMax: 0, testCount: 0, sessionCount: 0 };
      groups[k].sessionCount += 1;
      groups[k].total += (a.records || []).length;
      groups[k].present += (a.records || []).filter(r => r.status === "Present").length;
    });
    periodTests.forEach(t => {
      const k = t[key];
      if (!k) return;
      if (!groups[k]) groups[k] = { total: 0, present: 0, scoreObtained: 0, scoreMax: 0, testCount: 0, sessionCount: 0 };
      groups[k].testCount += 1;
      (t.scores || []).forEach(sc => {
        if (sc.marks === "" || sc.marks == null) return;
        groups[k].scoreObtained += Number(sc.marks) || 0;
        groups[k].scoreMax += Number(t.maxMarks) || 0;
      });
    });
    return Object.entries(groups)
      .map(([k, g]) => ({
        key: k,
        attendancePct: g.total > 0 ? round2((g.present / g.total) * 100) : null,
        scorePct: g.scoreMax > 0 ? round2((g.scoreObtained / g.scoreMax) * 100) : null,
        sessionCount: g.sessionCount, testCount: g.testCount,
      }))
      .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
  }
  const byClass = useMemo(() => breakdownBy("class"), [periodAttendance, periodTests]);
  const bySubject = useMemo(() => breakdownBy("subject"), [periodAttendance, periodTests]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="text-sm text-[#6E6650]">Institute-wide attendance and test performance, aggregated across every batch.</div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            {["month", "year"].map(p => (
              <button key={p} onClick={() => setPeriodType(p)}
                className="px-3 py-1.5 text-xs font-semibold rounded-sm border"
                style={{ background: periodType === p ? "#12312B" : "white", color: periodType === p ? "#F4EFDE" : "#12312B", borderColor: "#12312B" }}>
                {p === "month" ? "Month" : "Year"}
              </button>
            ))}
          </div>
          {periodType === "month" ? (
            <input type="month" className={inputCls} style={inputStyle} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
          ) : (
            <div className="px-3 py-2 text-sm font-mono border rounded-sm" style={{ borderColor: "#D8CFB8" }}>{selectedYear}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-5">
        <StatCard label="Institute Attendance" value={overallAttendancePct == null ? "—" : `${overallAttendancePct}%`}
          sub={totalRecords > 0 ? `${presentRecords}/${totalRecords} present` : "No attendance marked"}
          tone={overallAttendancePct == null ? undefined : overallAttendancePct >= 80 ? "good" : overallAttendancePct >= 60 ? "warn" : "bad"} />
        <StatCard label="Institute Avg Score" value={overallScorePct == null ? "—" : `${overallScorePct}%`}
          sub={periodTests.length > 0 ? `${periodTests.length} test${periodTests.length === 1 ? "" : "s"}` : "No tests conducted"}
          tone={overallScorePct == null ? undefined : overallScorePct >= 60 ? "good" : overallScorePct >= 40 ? "warn" : "bad"} />
        <StatCard label="Sessions Held" value={periodAttendance.length} sub="Attendance sessions this period" />
        <StatCard label="Tests Conducted" value={periodTests.length} sub="Tests this period" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <div className="px-4 py-2.5 text-sm font-semibold border-b" style={{ borderColor: "#E4DCC5" }}>By Class</div>
          {byClass.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No data for this period.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                  {["Class", "Attendance", "Avg Score", "Sessions", "Tests"].map(h => (
                    <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byClass.map(row => (
                  <tr key={row.key} className="ledger-row">
                    <td className="px-4 py-2 font-medium">{row.key}</td>
                    <td className="px-4 py-2 font-mono">{row.attendancePct == null ? "—" : `${row.attendancePct}%`}</td>
                    <td className="px-4 py-2 font-mono">{row.scorePct == null ? "—" : `${row.scorePct}%`}</td>
                    <td className="px-4 py-2 font-mono text-xs text-[#9C8F6E]">{row.sessionCount}</td>
                    <td className="px-4 py-2 font-mono text-xs text-[#9C8F6E]">{row.testCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card>
          <div className="px-4 py-2.5 text-sm font-semibold border-b" style={{ borderColor: "#E4DCC5" }}>By Subject</div>
          {bySubject.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No data for this period.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                  {["Subject", "Attendance", "Avg Score", "Sessions", "Tests"].map(h => (
                    <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bySubject.map(row => (
                  <tr key={row.key} className="ledger-row">
                    <td className="px-4 py-2 font-medium">{row.key}</td>
                    <td className="px-4 py-2 font-mono">{row.attendancePct == null ? "—" : `${row.attendancePct}%`}</td>
                    <td className="px-4 py-2 font-mono">{row.scorePct == null ? "—" : `${row.scorePct}%`}</td>
                    <td className="px-4 py-2 font-mono text-xs text-[#9C8F6E]">{row.sessionCount}</td>
                    <td className="px-4 py-2 font-mono text-xs text-[#9C8F6E]">{row.testCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
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

  const sorted = [...expenses].sort((a, b) => compareChrono(a, b, -1));
  const filtered = sorted.filter(e => {
    const q = search.trim().toLowerCase();
    if (q) {
      const haystack = [e.category, e.expenseId, e.paidTo, e.remarks].filter(Boolean).join(" ").toLowerCase();
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
                {["Expense ID", "Date", "Category", "Paid To", "Amount", "Mode", "Reference / UTR", "Remarks", "Actions"].map(h => (
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
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(e.date)}</td>
                  <td className="px-4 py-2.5 font-medium">{e.category || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-[#6E6650]">{e.paidTo || "—"}</td>
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

// ============================================================================
// NOTES — a simple internal notepad for the office/staff. Completely
// separate from the financial ledger: nothing here touches students,
// deposits, charges, or balances. Just a place to jot things down (a
// reminder to call a parent back, a to-do for the front desk, a note
// about next month's schedule) that everyone using this cloud-synced
// portal can see. Notes can be pinned so important ones stay at the top,
// edited in place, and deleted permanently (no Trash step — notes are
// deliberately lightweight, unlike financial records).
// ============================================================================
function NotesTab({ notes, onAdd, onEdit, onTogglePin, onDelete }) {
  const [search, setSearch] = useState("");

  const filtered = notes.filter(n => {
    if (!search) return true;
    const q = search.trim().toLowerCase();
    return [n.title, n.body].filter(Boolean).join(" ").toLowerCase().includes(q);
  });

  return (
    <div>
      <SectionHeader eyebrow="Office Notepad" title="Notes" action={
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Add Note
        </button>
      } />
      <div className="text-sm text-[#6E6650] mb-4">A shared notepad for anything worth writing down — reminders, follow-ups, things to tell the next shift. Nothing here affects fees, dues, or balances. Pin a note to keep it at the top.</div>

      {notes.length > 0 && (
        <Card className="p-3.5 mb-4">
          <div className="relative max-w-sm">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" />
            <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes…" />
          </div>
        </Card>
      )}

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[#9C8F6E]">
          {notes.length === 0 ? "No notes yet — add one to keep track of anything worth remembering." : "No notes match this search."}
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-3.5">
          {filtered.map(n => (
            <Card key={n.id} className="p-4 flex flex-col" style={{ borderTop: n.pinned ? "3px solid #B8862B" : undefined }}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-base font-semibold text-[#1B1810] leading-snug break-words">{n.title || "Untitled Note"}</div>
                <button onClick={() => onTogglePin(n.id)} title={n.pinned ? "Unpin" : "Pin to top"}
                  className="shrink-0 text-xs mt-0.5" style={{ color: n.pinned ? "#B8862B" : "#D8CFB8" }}>
                  <Tag size={14} style={{ transform: n.pinned ? "none" : "rotate(45deg)" }} />
                </button>
              </div>
              <div className="text-xs text-[#4A4636] whitespace-pre-wrap break-words flex-1 mb-3">{n.body || "—"}</div>
              <div className="flex items-center justify-between pt-2.5" style={{ borderTop: "1px solid #E4DCC5" }}>
                <span className="text-[10px] text-[#9C8F6E] font-mono">{fmtDate(n.updatedAt || n.createdAt || todayStr())}</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => onEdit(n)} className="text-[10px] text-[#12312B] underline font-semibold">Edit</button>
                  <button onClick={() => onDelete(n.id)} className="text-[10px] text-[#A63D2F] underline">Delete</button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


// Previously this tab showed two overlapping views (a card grid AND a
// separate per-charge-line table) which duplicated the same information in
// two different shapes. This is now consolidated into one clean, sortable,
// filterable list: one row per student, with Name, Class, Total Paid,
// Outstanding, a Statement link, and Status — plus Search (name / mobile /
// Aadhar) and a Class / Status filter.
// ============================================================================
function DuesTab({ students, ledgers, totalOutstanding, classes, onStatement }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState("with_dues"); // with_dues | all

  const summaries = useMemo(() => {
    return students.map(s => {
      const ledger = ledgers[s.id] || { totalCleared: 0, balance: 0 };
      return {
        student: s,
        totalPaid: round2(ledger.totalCleared || 0),
        outstanding: round2(ledger.balance || 0),
        status: s.status || "active",
      };
    });
  }, [students, ledgers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return summaries.filter(row => {
      const s = row.student;
      if (dueFilter === "with_dues" && row.outstanding <= 0) return false;
      if (classFilter !== "all" && String(s.class) !== classFilter) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (q) {
        const haystack = [s.name, s.studentId, s.phone, s.guardianPhone, s.aadharNumber].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => b.outstanding - a.outstanding);
  }, [summaries, search, classFilter, statusFilter, dueFilter]);

  const isFiltered = search || classFilter !== "all" || statusFilter !== "all" || dueFilter !== "with_dues";

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

      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Search — Name, Student ID, Mobile, or Aadhar</div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" />
              <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Type a name, Student ID, mobile number, or Aadhar…" />
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Class</div>
            <select className={inputCls} style={inputStyle} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
              <option value="all">All Classes</option>
              {(classes || []).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Student Status</div>
            <select className={inputCls} style={inputStyle} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="on_break">On Break / Gap</option>
              <option value="dropped">Dropped Out</option>
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Show</div>
            <select className={inputCls} style={inputStyle} value={dueFilter} onChange={e => setDueFilter(e.target.value)}>
              <option value="with_dues">With Dues Only</option>
              <option value="all">All Students</option>
            </select>
          </div>
          {isFiltered && (
            <button onClick={() => { setSearch(""); setClassFilter("all"); setStatusFilter("all"); setDueFilter("with_dues"); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
      </Card>

      <Card>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">{summaries.length === 0 ? "No students registered yet." : "No students match these filters."}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Student", "Class", "Total Paid", "Outstanding", "Status", "Statement"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const s = row.student;
                const badgeText = row.status === "active" ? "Active" : row.status === "dropped" ? "Dropped Out" : (s.resultStatus || "On Break");
                const badgeTone = row.status === "active" ? "paid" : row.status === "dropped" ? "overdue" : "break";
                return (
                  <tr key={s.id} className="ledger-row">
                    <td className="px-4 py-2.5 font-medium">
                      <div>{s.name}</div>
                      {(s.studentId || s.phone || s.aadharNumber) && (
                        <div className="text-[10px] text-[#9C8F6E]">{[s.studentId, s.phone, s.aadharNumber].filter(Boolean).join(" · ")}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-[#12312B]">{s.class}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-[#3F6B52]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(row.totalPaid)}</td>
                    <td className="px-4 py-2.5 text-xs font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace", color: row.outstanding > 0 ? "#A63D2F" : "#3F6B52" }}>{fmtINR(row.outstanding)}</td>
                    <td className="px-4 py-2.5"><Stamp text={badgeText} tone={badgeTone} /></td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => onStatement(s)} className="flex items-center gap-1 text-xs text-[#12312B] underline hover:text-[#3F6B52]"><FileText size={12} /> View Statement</button>
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

// Type metadata for the center-wide statement — one place that maps a
// ledger line's raw `type` to a display label and a Stamp tone. Expenses
// are intentionally not part of this map — they live only in the Banking
// Statement now (see BANKING_TXN_TYPE_META below), never in the Center
// Statement, since they aren't a student charge or payment.
const TXN_TYPE_META = {
  opening: { label: "Opening Balance", tone: "carried" },
  monthly_fee: { label: "Tuition Fee", tone: "due" },
  extra_charge: { label: "Additional Charge", tone: "due" },
  payment: { label: "Payment Received", tone: "paid" },
  writeoff: { label: "Write-off / Discount", tone: "break" },
};

// Type metadata for the dedicated Banking Statement — student deposits,
// center expenses, and internal Cash ⇄ Bank transfers all in one feed.
const BANKING_TXN_TYPE_META = {
  deposit: { label: "Student Deposit", tone: "paid" },
  expense: { label: "Expense", tone: "overdue" },
  bank_withdrawal: { label: "Bank Withdrawal (→ Cash)", tone: "break" },
  bank_deposit: { label: "Cash Deposit (→ Bank)", tone: "carried" },
  credit_taken: { label: "Credit Taken (Borrowed)", tone: "carried" },
  credit_given: { label: "Credit Given (Lent)", tone: "overdue" },
  interest_payment: { label: "Interest Paid", tone: "break" },
  // New types added for the advance-settlement fix / Return Advance
  // feature — see the relevant UPDATE NOTES entries.
  advance_settled: { label: "Advance Settled (via Salary)", tone: "paid" },
  advance_returned: { label: "Advance Returned", tone: "paid" },
};

// The four Banking sub-tabs — Banking Statement, Cash ⇄ Bank Transfer
// Logs, Credit & Loan Ledger, and Interest Payments Log — rendered as a
// pill-row inside BankingTab, same pattern as StructureTab's sub-tabs.
const BANKING_SUB_TABS = [
  { id: "statement", label: "Banking Statement", icon: FileText },
  // Expenses Log moved here from its own sidebar entry (see UPDATE NOTES) —
  // right after Banking Statement, per request.
  { id: "expenses", label: "Expenses Log", icon: Wallet },
  // Salary, Advance, and Deposits Log — not new tabs of their own, just the
  // exact same SalaryTab/AdvanceTab/DepositsTab components Institute
  // Management / Student Management already render, reachable here too so
  // Banking is a complete picture of money movement in one place. Placed
  // right before Cash ⇄ Bank Transfer Logs, per request.
  { id: "salary", label: "Salary", icon: Banknote },
  { id: "advance", label: "Advance", icon: ArrowUpRight },
  { id: "deposits", label: "Deposits Log", icon: Receipt },
  { id: "transfers", label: "Cash ⇄ Bank Transfer Logs", icon: ArrowUpRight },
  { id: "credit", label: "Credit & Loan Ledger", icon: CreditCard },
  { id: "interest", label: "Interest Payments Log", icon: Percent },
];

function CenterStatementTab({ transactions, totals, students, classes, onViewReceipt, onViewCharge }) {
  const statementRef = useRef();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Map of internal student doc id → full student record, so each row can
  // show the human-readable Student ID alongside the student's name.
  const studentById = useMemo(() => Object.fromEntries((students || []).map(s => [s.id, s])), [students]);

  const filtered = transactions.filter(t => {
    if (search) {
      const q = search.trim().toLowerCase();
      const st = studentById[t.studentId];
      // Search now matches Name, Student ID, AND mobile number (both the
      // student's own phone and guardian phone), so front-desk staff can
      // look a student up by whichever detail they have on hand.
      const haystack = [t.studentName, st?.studentId, st?.phone, st?.guardianPhone].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
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

  const generatedOn = fmtDate(todayStr());
  const isFiltered = search || typeFilter !== "all" || classFilter !== "all" || fromDate || toDate;

  const handlePrint = () => {
    const printContent = statementRef.current.innerHTML;
    const win = window.open("", "", "width=1100,height=900");
    // Loads the same Tailwind utility classes + Google Fonts the live app
    // uses, so the printed page renders exactly like the on-screen preview
    // instead of the plain unstyled text a bare popup window would produce.
    // Landscape A4, since this statement's table has many columns.
    win.document.write(`
      <html>
        <head>
          <title>Center Statement - Coaching Classes</title>
          <script src="https://cdn.tailwindcss.com"><\/script>
          <style>
            ${FONT_IMPORT}
            @page { size: A4 landscape; margin: 12mm; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { font-family: 'Inter', sans-serif; color: #12312B; background: #fff; margin: 0; }
            .stmt-doc { border: 1.5px solid #B8862B; border-radius: 4px; padding: 18px; }
            .stmt-doc::before { content: ""; display: block; height: 3px; background: #12312B; margin: -18px -18px 14px -18px; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
          </style>
        </head>
        <body>
          <div class="stmt-doc">${printContent}</div>
        </body>
      </html>
    `);
    win.document.close(); win.focus(); setTimeout(() => { win.print(); win.close(); }, 300);
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

      <div className="text-xs text-[#9C8F6E] mb-5 flex items-center gap-1.5"><Landmark size={12} /> Expenses and Cash / Bank balances now live in the dedicated <strong className="text-[#12312B]">Banking</strong> tab, since this statement is purely the student tuition & payments ledger.</div>

      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Search Student</div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" />
              <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, Student ID, or Mobile Number…" />
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
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
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
            <InstituteHeader subtitle={`Center-Wide Master Statement — Generated ${generatedOn}`} large={false} />
          </div>
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#9C8F6E]">No transactions match these filters.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                  {["Charge / Receipt No", "Date", "Charges Month", "Student", "Class", "Description", "Remarks", "Type", "Reference / UTR", "Debit", "Credit"].map(h => (
                    <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  const meta = TXN_TYPE_META[t.type] || { label: t.type, tone: "due" };
                  const hasReceipt = t.kind === "credit" && (t.type === "payment" || t.type === "writeoff");
                  const isChargeLine = t.kind === "debit" && (t.type === "opening" || t.type === "monthly_fee" || t.type === "extra_charge") && onViewCharge;
                  const rowKey = t.id + "-" + i;
                  const st = studentById[t.studentId];
                  return (
                    <React.Fragment key={rowKey}>
                      <tr className="ledger-row">
                        <td className="px-4 py-2.5 text-[10px] font-mono">
                          {hasReceipt ? (
                            <button onClick={() => onViewReceipt(t.depositId)} className="underline text-[#12312B] font-semibold inline-flex items-center gap-1 hover:text-[#3F6B52]" title="Open official receipt">
                              <Receipt size={10} /> #{t.receiptNo}
                            </button>
                          ) : isChargeLine ? (
                            <button onClick={() => onViewCharge(t)} className="text-[#12312B] underline hover:text-[#3F6B52]" title="Open printable receipt">{t.chargeId || "—"}</button>
                          ) : (
                            <span className="text-[#9C8F6E]">{t.chargeId || "—"}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(t.date)}</td>
                        <td className="px-4 py-2.5 text-xs font-mono">{t.month ? monthLabel(t.month) : "—"}</td>
                        <td className="px-4 py-2.5 font-medium">
                          <div>{t.studentName}{t.studentStatus !== "active" && <span className="ml-1.5 text-[10px] text-[#4A7B9D]">({t.studentStatus === "dropped" ? "dropped" : "on break"})</span>}</div>
                          {/* Student ID is plain, non-clickable text — no toggle/arrow,
                              no expand panel. Just the ID, as requested. */}
                          {st?.studentId && (
                            <div className="text-[10px] font-mono text-[#9C8F6E]">{st.studentId}</div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-[#12312B]">{t.studentClass}</td>
                        <td className="px-4 py-2.5 text-xs">{t.label}</td>
                        <td className="px-4 py-2.5 text-xs text-[#6E6650]">{t.remarks || "—"}</td>
                        <td className="px-4 py-2.5"><Stamp text={meta.label} tone={meta.tone} /></td>
                        <td className="px-4 py-2.5 text-xs text-[#6E6650]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{t.ref || "—"}</td>
                        <td className="px-4 py-2.5 font-mono text-[#A63D2F]">{t.kind === "debit" ? fmtINR(t.amount) : ""}</td>
                        <td className="px-4 py-2.5 font-mono text-[#3F6B52]">{t.kind === "credit" ? fmtINR(t.amount) : ""}</td>
                      </tr>
                    </React.Fragment>
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

// ============================================================================
// BANKING TAB — dedicated internal Cash / Bank ledger for the coaching
// center. Tracks every rupee that moves in (student deposits), out
// (expenses), or between the center's own Cash-in-hand and Bank/Online
// account (internal transfers) — completely separate from the
// student-facing Center Statement. Every line carries its own unique,
// clickable reference and shows the resulting Cash Balance + Bank Balance
// side by side, so the two balances are always auditable transaction-by-
// transaction.
// ============================================================================
function BankingTab({ feed, totals, bankTxns, creditTxns, interestPayments, interestPaidByCreditId, students, expensesTabProps, depositsTabProps, salaryTabProps, advanceTabProps, onAdd, onAddCredit, onPayInterest, onViewReceipt, onViewExpense, onViewBankTxn, onViewCredit, onViewInterest, onRemoveBankTxn, onRemoveCredit, onRemoveInterest }) {
  const statementRef = useRef();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expandedCredit, setExpandedCredit] = useState({});
  // Banking is now split into four separate, professionally organized
  // sub-tabs — Banking Statement, Cash ⇄ Bank Transfer Logs, Credit &
  // Loan Ledger, and Interest Payments Log — instead of one long stacked
  // scroll. Every piece of functionality that existed before (search,
  // filters, print/export, add/delete, expand credit history, pay
  // interest, etc.) is unchanged; this state just controls which one of
  // the four panels is visible at a time, exactly like the pill-tab
  // pattern already used in Fee & Class Structure (see StructureTab).
  const [subTab, setSubTab] = useState("statement");

  // Map of internal student doc id → full student record, so deposit rows
  // can show the human-readable Student ID alongside the description.
  const studentById = useMemo(() => Object.fromEntries((students || []).map(s => [s.id, s])), [students]);

  const filtered = feed.filter(t => {
    if (search) {
      const q = search.trim().toLowerCase();
      const st = t.studentId ? studentById[t.studentId] : null;
      const haystack = [t.label, t.refId, t.remarks, st?.studentId, st?.name, st?.phone, st?.guardianPhone].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (fromDate && t.date < fromDate) return false;
    if (toDate && t.date > toDate) return false;
    return true;
  });

  const isFiltered = search || typeFilter !== "all" || fromDate || toDate;
  const generatedOn = fmtDate(todayStr());

  const handlePrint = () => {
    const printContent = statementRef.current.innerHTML;
    const win = window.open("", "", "width=1100,height=900");
    // Loads the same Tailwind utility classes + Google Fonts the live app
    // uses, so the printed page renders exactly like the on-screen preview
    // instead of the plain unstyled text a bare popup window would produce.
    // Landscape A4, since this statement's table has many columns.
    win.document.write(`
      <html>
        <head>
          <title>Banking Statement - Coaching Classes</title>
          <script src="https://cdn.tailwindcss.com"><\/script>
          <style>
            ${FONT_IMPORT}
            @page { size: A4 landscape; margin: 12mm; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { font-family: 'Inter', sans-serif; color: #12312B; background: #fff; margin: 0; }
            .stmt-doc { border: 1.5px solid #B8862B; border-radius: 4px; padding: 18px; }
            .stmt-doc::before { content: ""; display: block; height: 3px; background: #12312B; margin: -18px -18px 14px -18px; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
          </style>
        </head>
        <body>
          <div class="stmt-doc">${printContent}</div>
        </body>
      </html>
    `);
    win.document.close(); win.focus(); setTimeout(() => { win.print(); win.close(); }, 300);
  };

  return (
    <div>
      <SectionHeader eyebrow="Internal Ledger" title="Banking" action={
        <div className="flex gap-2 flex-wrap justify-end">
          <button onClick={handlePrint} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm border" style={{ borderColor: "#12312B", color: "#12312B" }}>
            <Printer size={15} /> Print / Export
          </button>
        </div>
      } />
      <div className="text-sm text-[#6E6650] mb-4">Every student deposit, every center expense, every internal Cash ⇄ Bank transfer, and every Credit / Loan entry, in one auditable feed — with a running Cash Balance and Bank Balance shown on every line. Nothing here appears on the Center Statement.</div>

      {/* Individual chip buttons (not one bordered strip with internal
          dividers) — each has its own border and rounded corners, so
          wrapping to a new line at 8 sub-tabs never leaves an orphan box
          with a stray border. Same fix already applied to Recycle Bin's
          category row for the identical reason. */}
      <div className="flex flex-wrap gap-2 mb-5">
        {BANKING_SUB_TABS.map(st => {
          const Icon = st.icon;
          const active = subTab === st.id;
          return (
            <button key={st.id} onClick={() => setSubTab(st.id)}
              className="px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 rounded-sm border"
              style={{ background: active ? "#12312B" : "white", color: active ? "#F4EFDE" : "#12312B", borderColor: "#12312B" }}>
              <Icon size={13} /> {st.label}
            </button>
          );
        })}
      </div>

      {subTab === "statement" && (
      <>
      <div className="grid grid-cols-2 gap-4 mb-5">
        <Card className="p-5" style={{ borderLeft: "4px solid #3F6B52" }}>
          <div className="text-[10px] uppercase text-[#3F6B52] font-mono flex items-center gap-1 mb-1"><Banknote size={13} /> Cash Balance (in hand)</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-3xl font-bold text-[#3F6B52]">{fmtINR(totals.cashBalance)}</div>
        </Card>
        <Card className="p-5" style={{ borderLeft: "4px solid #4A7B9D" }}>
          <div className="text-[10px] uppercase text-[#2B526C] font-mono flex items-center gap-1 mb-1"><Landmark size={13} /> Bank Balance</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-3xl font-bold text-[#2B526C]">{fmtINR(totals.bankBalance)}</div>
        </Card>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-3">
        <Card className="p-3.5">
          <div className="text-[10px] uppercase text-[#9C8F6E] font-mono">Total Deposits Collected</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-bold text-[#3F6B52]">{fmtINR(totals.totalDeposits)}</div>
        </Card>
        <Card className="p-3.5">
          <div className="text-[10px] uppercase text-[#9C8F6E] font-mono">Total Expenses</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-bold text-[#A63D2F]">{fmtINR(totals.totalExpenses)}</div>
        </Card>
        <Card className="p-3.5">
          <div className="text-[10px] uppercase text-[#9C8F6E] font-mono">Withdrawn from Bank</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-bold text-[#8A6420]">{fmtINR(totals.totalWithdrawals)}</div>
        </Card>
        <Card className="p-3.5">
          <div className="text-[10px] uppercase text-[#9C8F6E] font-mono">Deposited to Bank</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-bold text-[#8A6420]">{fmtINR(totals.totalBankDeposits)}</div>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <Card className="p-3.5">
          <div className="text-[10px] uppercase text-[#9C8F6E] font-mono">Total Credit Taken (Borrowed)</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-bold text-[#8A6420]">{fmtINR(totals.totalCreditTaken)}</div>
        </Card>
        <Card className="p-3.5">
          <div className="text-[10px] uppercase text-[#9C8F6E] font-mono">Total Credit Given (Lent)</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-bold text-[#A63D2F]">{fmtINR(totals.totalCreditGiven)}</div>
        </Card>
        <Card className="p-3.5">
          <div className="text-[10px] uppercase text-[#9C8F6E] font-mono">Total Interest Paid</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-bold text-[#A63D2F]">{fmtINR(totals.totalInterestPaid)}</div>
        </Card>
      </div>

      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Search</div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" />
              <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Description, Student ID, Mobile Number, or remarks…" />
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Type</div>
            <select className={inputCls} style={inputStyle} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="all">All Transactions</option>
              {Object.entries(BANKING_TXN_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
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
            <button onClick={() => { setSearch(""); setTypeFilter("all"); setFromDate(""); setToDate(""); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
      </Card>

      <Card>
        <div ref={statementRef}>
          <div className="stmt-header text-center pb-3 mb-1 px-4 pt-4 border-b-2 border-dashed border-[#12312B]">
            <InstituteHeader subtitle={`Banking Statement — Generated ${generatedOn}`} large={false} />
          </div>
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#9C8F6E]">No banking transactions match these filters.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                  {["Reference / Txn ID", "Date", "Description", "Student", "Remarks", "Type", "Debit", "Credit", "Cash Balance", "Bank Balance"].map(h => (
                    <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  const meta = BANKING_TXN_TYPE_META[t.type] || { label: t.type, tone: "due" };
                  const debitAmt = t.kind === "debit" ? t.amount : (t.kind === "transfer" && t.type === "bank_deposit" ? t.amount : null);
                  const creditAmt = t.kind === "credit" ? t.amount : (t.kind === "transfer" && t.type === "bank_withdrawal" ? t.amount : null);
                  const rowKey = t.id + "-" + i;
                  const st = t.studentId ? studentById[t.studentId] : null;
                  return (
                    <React.Fragment key={rowKey}>
                      <tr className="ledger-row">
                        <td className="px-4 py-2.5 text-[10px] font-mono">
                          {t.source === "deposit" ? (
                            <button onClick={() => onViewReceipt(t.depositId)} className="underline text-[#12312B] font-semibold inline-flex items-center gap-1 hover:text-[#3F6B52]" title="Open official receipt">
                              <Receipt size={10} /> #{t.refId}
                            </button>
                          ) : t.source === "expense" ? (
                            <button onClick={() => onViewExpense(t.expenseRowId)} className="text-[#12312B] underline hover:text-[#3F6B52]" title="Open printable receipt">{t.refId}</button>
                          ) : t.source === "credit" ? (
                            <button onClick={() => onViewCredit(t.creditTxnId)} className="text-[#12312B] underline hover:text-[#3F6B52]" title="Open credit slip">{t.refId}</button>
                          ) : t.source === "interest" ? (
                            <button onClick={() => onViewInterest(t.interestPaymentId)} className="text-[#12312B] underline hover:text-[#3F6B52]" title="Open interest payment slip">{t.refId}</button>
                          ) : (
                            <button onClick={() => onViewBankTxn(t.bankTxnId)} className="text-[#12312B] underline hover:text-[#3F6B52]" title="Open transaction slip">{t.refId}</button>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(t.date)}</td>
                        <td className="px-4 py-2.5 text-xs">{t.label}</td>
                        <td className="px-4 py-2.5">
                          {/* Student ID is plain, non-clickable text — no toggle/arrow,
                              no expand panel. Just the ID, as requested. */}
                          {st?.studentId ? (
                            <span className="text-[10px] font-mono text-[#9C8F6E]">{st.studentId}</span>
                          ) : <span className="text-[10px] text-[#D8CFB8]">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-[#6E6650]">{t.remarks || "—"}</td>
                        <td className="px-4 py-2.5"><Stamp text={meta.label} tone={meta.tone} /></td>
                        <td className="px-4 py-2.5 font-mono text-[#A63D2F]">{debitAmt != null ? fmtINR(debitAmt) : ""}</td>
                        <td className="px-4 py-2.5 font-mono text-[#3F6B52]">{creditAmt != null ? fmtINR(creditAmt) : ""}</td>
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-[#3F6B52]">{fmtINR(t.cashBalance)}</td>
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-[#2B526C]">{fmtINR(t.bankBalance)}</td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
          <div className="footer text-center pt-3 pb-4 mt-2 border-t border-dashed border-[#12312B] text-[10px] text-[#9C8F6E]">
            Computer Generated Statement · Cash Balance and Bank Balance reflect every deposit, expense, internal transfer, and credit/loan entry up to this line
          </div>
        </div>
      </Card>
      </>
      )}

      {subTab === "expenses" && <ExpensesTab {...expensesTabProps} />}
      {subTab === "salary" && <SalaryTab {...salaryTabProps} />}
      {subTab === "advance" && <AdvanceTab {...advanceTabProps} />}
      {subTab === "deposits" && <DepositsTab {...depositsTabProps} />}

      {subTab === "transfers" && (
      <>
      {/* ===================================================================
          CASH ⇄ BANK TRANSFER LOGS — a dedicated sub-tab for internal
          transfers, kept separate from the main statement above (which is
          read-only / no delete button). Delete lives here instead.
      =================================================================== */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.1em" }} className="uppercase text-[#9C8F6E] mb-0.5">Internal Transfers</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-semibold text-[#1B1810]">Cash ⇄ Bank Transfer Logs</div>
        </div>
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Record Cash ⇄ Bank Transfer
        </button>
      </div>
      <Card className="mb-8">
        {(!bankTxns || bankTxns.length === 0) ? (
          <div className="p-6 text-center text-sm text-[#9C8F6E]">No Cash ⇄ Bank transfers recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Txn ID", "Date", "Type", "Bank / Account", "Reference", "Remarks", "Amount", ""].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...bankTxns].sort((a, b) => compareChrono(a, b, -1)).map(t => (
                <tr key={t.id} className="ledger-row">
                  <td className="px-4 py-2.5 text-[10px] font-mono">
                    <button onClick={() => onViewBankTxn(t.id)} className="text-[#12312B] underline hover:text-[#3F6B52]">{t.txnId}</button>
                  </td>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(t.date)}</td>
                  <td className="px-4 py-2.5"><Stamp text={t.type === "withdrawal" ? "Bank → Cash" : "Cash → Bank"} tone={t.type === "withdrawal" ? "break" : "carried"} /></td>
                  <td className="px-4 py-2.5 text-xs text-[#6E6650]">{t.bankName || t.accountNumber ? `${t.bankName || "—"}${t.accountNumber ? " · " + t.accountNumber : ""}` : "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-[#6E6650]">{t.refType && t.refNumber ? `${t.refType}: ${t.refNumber}` : "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-[#6E6650]">{t.remarks || "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-[#8A6420]">{fmtINR(t.amount)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => onRemoveBankTxn(t.id)} className="text-[10px] text-[#A63D2F] underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      </>
      )}

      {subTab === "credit" && (
      <>
      {/* ===================================================================
          CREDIT & LOAN LEDGER — money borrowed (Credit Taken) or lent
          (Credit Given), each with a unique Credit ID, full party details,
          and a "Pay Interest" action (for money we've borrowed) that logs
          its own unique, clickable Interest Payment.
      =================================================================== */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.1em" }} className="uppercase text-[#9C8F6E] mb-0.5">Borrowed & Lent</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-semibold text-[#1B1810]">Credit &amp; Loan Ledger</div>
        </div>
        <button onClick={onAddCredit} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#8A6420", color: "#FAF6EC" }}>
          <Plus size={15} /> Record Credit / Loan
        </button>
      </div>
      <Card>
        {(!creditTxns || creditTxns.length === 0) ? (
          <div className="p-6 text-center text-sm text-[#9C8F6E]">No credit / loan entries recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["", "Credit ID", "Date", "Direction", "Party", "Contact", "Amount", "Interest Paid", ""].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...creditTxns].sort((a, b) => compareChrono(a, b, -1)).map(c => {
                const isOpen = !!expandedCredit[c.id];
                const paidSoFar = (interestPaidByCreditId && interestPaidByCreditId[c.id]) || 0;
                const history = (interestPayments || []).filter(p => p.creditTxnId === c.id).sort((a, b) => compareChrono(a, b, -1));
                return (
                  <React.Fragment key={c.id}>
                    <tr className="ledger-row">
                      <td className="pl-3 py-2.5">
                        {history.length > 0 && (
                          <button onClick={() => setExpandedCredit(prev => ({ ...prev, [c.id]: !prev[c.id] }))} className="text-[#9C8F6E] hover:text-[#12312B] text-xs w-4">
                            {isOpen ? "▾" : "▸"}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[10px] font-mono">
                        <button onClick={() => onViewCredit(c.id)} className="text-[#12312B] underline hover:text-[#3F6B52]">{c.creditId}</button>
                      </td>
                      <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(c.date)}</td>
                      <td className="px-4 py-2.5"><Stamp text={c.direction === "taken" ? "Credit Taken" : "Credit Given"} tone={c.direction === "taken" ? "carried" : "overdue"} /></td>
                      <td className="px-4 py-2.5 text-xs">
                        <div className="font-medium">{c.partyName}</div>
                        <div className="text-[10px] text-[#9C8F6E]">{c.partyType}{c.mode ? " · " + c.mode : ""}</div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#6E6650]">{c.mobile || "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold" style={{ color: c.direction === "taken" ? "#8A6420" : "#A63D2F" }}>{fmtINR(c.amount)}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-[#6E6650]">{paidSoFar > 0 ? fmtINR(paidSoFar) : "—"}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <div className="flex flex-wrap gap-2 justify-end items-center">
                          {c.direction === "taken" && (
                            <button onClick={() => onPayInterest(c)} className="text-[10px] text-[#8A6420] underline font-semibold">Pay Interest</button>
                          )}
                          <button onClick={() => onRemoveCredit(c.id)} className="text-[10px] text-[#A63D2F] underline">Delete</button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && history.length > 0 && (
                      <tr>
                        <td></td>
                        <td colSpan={8} className="px-4 pb-3 pt-0">
                          <div className="p-3 rounded bg-[#FAF6EC] border text-xs" style={{ borderColor: "#D8CFB8" }}>
                            <div className="text-[10px] uppercase font-mono text-[#9C8F6E] mb-2">Interest Payment History</div>
                            <div className="space-y-1.5">
                              {history.map(p => (
                                <div key={p.id} className="flex items-center justify-between">
                                  <span>
                                    <button onClick={() => onViewInterest(p.id)} className="underline text-[#12312B] font-mono mr-2">{p.paymentId}</button>
                                    <span className="text-[#6E6650]">{fmtDate(p.date)} · {p.mode}</span>
                                  </span>
                                  <strong className="font-mono text-[#8A6420]">{fmtINR(p.amount)}</strong>
                                </div>
                              ))}
                            </div>
                            <div className="text-[10px] text-[#9C8F6E] mt-2">To delete an interest payment, switch to the <strong className="text-[#12312B]">Interest Payments Log</strong> tab above.</div>
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
      </>
      )}

      {subTab === "interest" && (
      <>
      {/* ===================================================================
          INTEREST PAYMENTS LOG — a dedicated sub-tab for interest payments
          against Credit Taken entries, kept separate from the Credit &
          Loan Ledger tab (which is read-only / no delete button for
          interest). Delete lives here instead, exactly like the Cash ⇄
          Bank Transfer Logs tab does for transfers.
      =================================================================== */}
      <div className="mb-3">
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.1em" }} className="uppercase text-[#9C8F6E] mb-0.5">Interest Paid Against Credit Taken</div>
        <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl font-semibold text-[#1B1810]">Interest Payments Log</div>
      </div>
      <Card className="mb-8">
        {(!interestPayments || interestPayments.length === 0) ? (
          <div className="p-6 text-center text-sm text-[#9C8F6E]">No interest payments recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Payment ID", "Date", "Against Credit ID", "Party", "Mode", "Remarks", "Amount", ""].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...interestPayments].sort((a, b) => compareChrono(a, b, -1)).map(p => {
                const creditTxn = (creditTxns || []).find(c => c.id === p.creditTxnId);
                return (
                  <tr key={p.id} className="ledger-row">
                    <td className="px-4 py-2.5 text-[10px] font-mono">
                      <button onClick={() => onViewInterest(p.id)} className="text-[#12312B] underline hover:text-[#3F6B52]">{p.paymentId}</button>
                    </td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(p.date)}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-[#6E6650]">{creditTxn ? creditTxn.creditId : "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6E6650]">{creditTxn ? creditTxn.partyName : "Unknown"}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6E6650]">{p.mode || "Cash"}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6E6650]">{p.remarks || "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-[#8A6420]">{fmtINR(p.amount)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onRemoveInterest(p.id)} className="text-[10px] text-[#A63D2F] underline">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      </>
      )}
    </div>
  );
}

// ---- Recycle Bin — category config for the pill-row + single-panel layout
// (same bordered pill-row pattern as Academic Monitoring / Structure /
// Banking / Student Management). Each entry just needs a label/icon; the
// actual data arrays and restore/delete handlers stay as individual props
// on TrashTab exactly as before — this array only drives the pill row and
// count badges, nothing about how any category's data flows changed.
const TRASH_CATEGORIES = [
  { id: "students", label: "Students", icon: Users },
  { id: "receipts", label: "Receipts", icon: Receipt },
  { id: "charges", label: "Charges", icon: Tag },
  { id: "expenses", label: "Expenses", icon: Wallet },
  { id: "bank", label: "Bank Transactions", icon: Landmark },
  { id: "credit", label: "Credit / Loan Entries", icon: CreditCard },
  { id: "interest", label: "Interest Payments", icon: Percent },
  { id: "attendance", label: "Attendance Records", icon: ClipboardCheck },
  { id: "testscores", label: "Test Scores", icon: Award },
  { id: "behaviour", label: "Behaviour Notes", icon: MessageSquare },
  { id: "teachers", label: "Teachers", icon: GraduationCap },
  { id: "staff", label: "Staff", icon: UserCog },
  { id: "salary", label: "Salary Payments", icon: Banknote },
  { id: "advances", label: "Advances", icon: ArrowUpRight },
  { id: "advancereturns", label: "Advance Returns", icon: Undo2 },
];

function TrashTab({ trashedStudents, trashedDeposits, trashedCharges, trashedExpenses, trashedBankTxns, trashedCreditTxns, trashedInterestPayments, trashedAttendance, trashedTestScores, trashedBehaviourNotes, trashedTeachers, trashedStaff, trashedSalaryPayments, trashedAdvances, trashedAdvanceReturns, studentById, onRestoreStudent, onDeleteStudent, onRestoreDeposit, onDeleteDeposit, onRestoreCharge, onDeleteCharge, onRestoreExpense, onDeleteExpense, onRestoreBankTxn, onDeleteBankTxn, onRestoreCredit, onDeleteCredit, onRestoreInterest, onDeleteInterest, onRestoreAttendance, onDeleteAttendance, onRestoreTestScore, onDeleteTestScore, onRestoreBehaviour, onDeleteBehaviour, onRestoreTeacher, onDeleteTeacher, onRestoreStaff, onDeleteStaff, onRestoreSalaryPayment, onDeleteSalaryPayment, onRestoreAdvance, onDeleteAdvance, onRestoreAdvanceReturn, onDeleteAdvanceReturn }) {
  // Every category's raw (unfiltered) array, keyed the same as
  // TRASH_CATEGORIES ids — used for the pill row's count badges and as the
  // source each category's panel filters down from.
  const dataByCat = {
    students: trashedStudents || [], receipts: trashedDeposits || [], charges: trashedCharges || [],
    expenses: trashedExpenses || [], bank: trashedBankTxns || [], credit: trashedCreditTxns || [],
    interest: trashedInterestPayments || [], attendance: trashedAttendance || [], testscores: trashedTestScores || [],
    behaviour: trashedBehaviourNotes || [], teachers: trashedTeachers || [], staff: trashedStaff || [],
    salary: trashedSalaryPayments || [], advances: trashedAdvances || [], advancereturns: trashedAdvanceReturns || [],
  };
  const totalTrashed = Object.values(dataByCat).reduce((sum, arr) => sum + arr.length, 0);

  // Default to the first category that actually has something in it, so
  // opening Recycle Bin doesn't land on an empty "Students" panel when
  // everything deleted recently was, say, a charge.
  const [cat, setCat] = useState(() => TRASH_CATEGORIES.find(c => dataByCat[c.id].length > 0)?.id || "students");
  const [search, setSearch] = useState("");

  // Free-text match per category — checks whatever fields make sense to
  // search for that record type (name/ID/description-ish fields), never
  // amounts or dates (those have their own dedicated columns already).
  function matches(item) {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const st = studentById[item.studentId];
    const haystacks = {
      students: [item.name, item.class],
      receipts: [st?.name],
      charges: [st?.name],
      expenses: [item.category, item.paidTo, item.remarks],
      bank: [item.type, item.txnId],
      credit: [item.partyName, item.creditId],
      interest: [item.paymentId],
      attendance: [st?.name, item.status],
      testscores: [st?.name, item.testName, item.subject],
      behaviour: [st?.name, item.note],
      teachers: [item.name, item.teacherId, ...(item.expertiseSubjects || [])],
      staff: [item.name, item.staffId, item.title],
      salary: [item.personName, item.slipId],
      advances: [item.personName, item.advanceId],
      advancereturns: [item.personName, item.returnId],
    };
    return (haystacks[cat] || []).filter(Boolean).join(" ").toLowerCase().includes(q);
  }

  const activeData = dataByCat[cat] || [];
  const filtered = activeData.filter(matches);
  const activeMeta = TRASH_CATEGORIES.find(c => c.id === cat);

  return (
    <div>
      <SectionHeader eyebrow="Recycle Bin" title="Trash / Restore" />
      <div className="text-sm text-[#6E6650] mb-5">Deleted students, receipts, and charges land here first — nothing is gone for good until you permanently delete it. Restoring brings back the exact record with no data lost. {totalTrashed} item{totalTrashed === 1 ? "" : "s"} in the bin across every category.</div>

      {/* Individual chip buttons (not one bordered strip with internal
          dividers) — each has its own border and rounded corners, so
          wrapping to a new line never leaves an orphan box with a stray
          border, unlike a single flex-wrap pill-row would. Categories with
          nothing in them use the app's existing muted text color (#9C8F6E,
          same as every other secondary/disabled-ish label in the app)
          rather than a separate, more washed-out grey — stays legible even
          when every category is empty (e.g. right after setup). */}
      <div className="flex flex-wrap gap-2 mb-4">
        {TRASH_CATEGORIES.map(c => {
          const Icon = c.icon;
          const active = cat === c.id;
          const count = dataByCat[c.id].length;
          const empty = count === 0;
          return (
            <button key={c.id} onClick={() => { setCat(c.id); setSearch(""); }}
              className="px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 rounded-sm border"
              style={{
                background: active ? "#12312B" : "white",
                color: active ? "#F4EFDE" : (empty ? "#9C8F6E" : "#12312B"),
                borderColor: active ? "#12312B" : (empty ? "#D8CFB8" : "#12312B"),
              }}>
              <Icon size={13} /> {c.label}
              <span className="text-[10px] font-mono" style={{ opacity: active ? 0.85 : 0.75 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {activeData.length > 0 && (
        <Card className="p-3.5 mb-4">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" />
            <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search deleted ${activeMeta.label.toLowerCase()}...`} />
          </div>
        </Card>
      )}

      {cat === "students" && (
        <Card>
          {activeData.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted students.</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted students match your search.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="ledger-row">
                    <td className="px-4 py-2.5 font-medium">{s.name}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6E6650]">{s.class}</td>
                    <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono whitespace-nowrap">Deleted {s.deletedAt ? fmtDate(s.deletedAt) : ""}</td>
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
      )}

      {cat === "receipts" && (
        <Card>
          {activeData.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted receipts.</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted receipts match your search.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {filtered.map(d => {
                  const st = studentById[d.studentId];
                  return (
                    <tr key={d.id} className="ledger-row">
                      <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{fmtDate(d.date)}</td>
                      <td className="px-4 py-2.5 font-medium">{st ? st.name : "—"}</td>
                      <td className="px-4 py-2.5 text-xs font-mono font-semibold text-[#3F6B52]">{fmtINR(d.amount)}</td>
                      <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono whitespace-nowrap">Deleted {d.deletedAt ? fmtDate(d.deletedAt) : ""}</td>
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
      )}

      {cat === "charges" && (
        <Card>
          {activeData.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted charges.</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted charges match your search.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {filtered.map(c => {
                  const st = studentById[c.studentId];
                  return (
                    <tr key={c.id} className="ledger-row">
                      <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{fmtDate(c.date)}</td>
                      <td className="px-4 py-2.5 font-medium">{st ? st.name : "—"}</td>
                      <td className="px-4 py-2.5 text-xs font-mono font-semibold text-[#B8862B]">{fmtINR(c.amount)}</td>
                      <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono whitespace-nowrap">Deleted {c.deletedAt ? fmtDate(c.deletedAt) : ""}</td>
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
      )}

      {cat === "expenses" && (
        <Card>
          {activeData.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted expenses.</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted expenses match your search.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} className="ledger-row">
                    <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{fmtDate(e.date)}</td>
                    <td className="px-4 py-2.5 font-medium">{e.category || "—"}</td>
                    <td className="px-4 py-2.5 text-xs font-mono font-semibold text-[#A63D2F]">{fmtINR(e.amount)}</td>
                    <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono whitespace-nowrap">Deleted {e.deletedAt ? fmtDate(e.deletedAt) : ""}</td>
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
      )}

      {cat === "bank" && (
        <Card>
          {activeData.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted bank transactions.</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted bank transactions match your search.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className="ledger-row">
                    <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{fmtDate(t.date)}</td>
                    <td className="px-4 py-2.5 font-medium">{t.type === "withdrawal" ? "Bank Withdrawal" : "Cash Deposit to Bank"} <span className="text-[10px] text-[#9C8F6E] font-mono">({t.txnId})</span></td>
                    <td className="px-4 py-2.5 text-xs font-mono font-semibold text-[#8A6420]">{fmtINR(t.amount)}</td>
                    <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono whitespace-nowrap">Deleted {t.deletedAt ? fmtDate(t.deletedAt) : ""}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onRestoreBankTxn(t.id)} className="text-xs text-[#3F6B52] font-semibold underline mr-3 inline-flex items-center gap-1"><RotateCcw size={11} /> Restore</button>
                      <button onClick={() => onDeleteBankTxn(t.id)} className="text-xs text-[#A63D2F] underline">Delete Permanently</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {cat === "credit" && (
        <Card>
          {activeData.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted credit / loan entries.</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted credit / loan entries match your search.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="ledger-row">
                    <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{fmtDate(c.date)}</td>
                    <td className="px-4 py-2.5 font-medium">{c.partyName} <span className="text-[10px] text-[#9C8F6E] font-mono">({c.creditId})</span></td>
                    <td className="px-4 py-2.5 text-xs font-mono font-semibold text-[#8A6420]">{fmtINR(c.amount)}</td>
                    <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono whitespace-nowrap">Deleted {c.deletedAt ? fmtDate(c.deletedAt) : ""}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onRestoreCredit(c.id)} className="text-xs text-[#3F6B52] font-semibold underline mr-3 inline-flex items-center gap-1"><RotateCcw size={11} /> Restore</button>
                      <button onClick={() => onDeleteCredit(c.id)} className="text-xs text-[#A63D2F] underline">Delete Permanently</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {cat === "interest" && (
        <Card>
          {activeData.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted interest payments.</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted interest payments match your search.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="ledger-row">
                    <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{fmtDate(p.date)}</td>
                    <td className="px-4 py-2.5 font-medium">{p.paymentId}</td>
                    <td className="px-4 py-2.5 text-xs font-mono font-semibold text-[#8A6420]">{fmtINR(p.amount)}</td>
                    <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono whitespace-nowrap">Deleted {p.deletedAt ? fmtDate(p.deletedAt) : ""}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onRestoreInterest(p.id)} className="text-xs text-[#3F6B52] font-semibold underline mr-3 inline-flex items-center gap-1"><RotateCcw size={11} /> Restore</button>
                      <button onClick={() => onDeleteInterest(p.id)} className="text-xs text-[#A63D2F] underline">Delete Permanently</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {cat === "attendance" && (
        <Card>
          {activeData.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted attendance records.</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted attendance records match your search.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {filtered.map(a => {
                  const st = studentById[a.studentId];
                  return (
                    <tr key={a.id} className="ledger-row">
                      <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{fmtDate(a.date)}</td>
                      <td className="px-4 py-2.5 font-medium">{st ? st.name : "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-[#6E6650]">{a.status}</td>
                      <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono whitespace-nowrap">Deleted {a.deletedAt ? fmtDate(a.deletedAt) : ""}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button onClick={() => onRestoreAttendance(a.id)} className="text-xs text-[#3F6B52] font-semibold underline mr-3 inline-flex items-center gap-1"><RotateCcw size={11} /> Restore</button>
                        <button onClick={() => onDeleteAttendance(a.id)} className="text-xs text-[#A63D2F] underline">Delete Permanently</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {cat === "testscores" && (
        <Card>
          {activeData.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted test scores.</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted test scores match your search.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {filtered.map(t => {
                  const st = studentById[t.studentId];
                  return (
                    <tr key={t.id} className="ledger-row">
                      <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{fmtDate(t.date)}</td>
                      <td className="px-4 py-2.5 font-medium">{st ? st.name : "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-[#6E6650]">{t.testName} — {t.subject}</td>
                      <td className="px-4 py-2.5 text-xs font-mono">{t.marksObtained}/{t.maxMarks}</td>
                      <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono whitespace-nowrap">Deleted {t.deletedAt ? fmtDate(t.deletedAt) : ""}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button onClick={() => onRestoreTestScore(t.id)} className="text-xs text-[#3F6B52] font-semibold underline mr-3 inline-flex items-center gap-1"><RotateCcw size={11} /> Restore</button>
                        <button onClick={() => onDeleteTestScore(t.id)} className="text-xs text-[#A63D2F] underline">Delete Permanently</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {cat === "behaviour" && (
        <Card>
          {activeData.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted behaviour notes.</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted behaviour notes match your search.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {filtered.map(b => {
                  const st = studentById[b.studentId];
                  return (
                    <tr key={b.id} className="ledger-row">
                      <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{fmtDate(b.date)}</td>
                      <td className="px-4 py-2.5 font-medium">{st ? st.name : "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-[#6E6650]">{b.note}</td>
                      <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono whitespace-nowrap">Deleted {b.deletedAt ? fmtDate(b.deletedAt) : ""}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button onClick={() => onRestoreBehaviour(b.id)} className="text-xs text-[#3F6B52] font-semibold underline mr-3 inline-flex items-center gap-1"><RotateCcw size={11} /> Restore</button>
                        <button onClick={() => onDeleteBehaviour(b.id)} className="text-xs text-[#A63D2F] underline">Delete Permanently</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {cat === "teachers" && (
        <Card>
          {activeData.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted teachers.</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted teachers match your search.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className="ledger-row">
                    <td className="px-4 py-2.5 font-medium">{t.name} <span className="text-[10px] text-[#9C8F6E] font-mono">{t.teacherId}</span></td>
                    <td className="px-4 py-2.5 text-xs text-[#6E6650]">{(t.expertiseSubjects || []).join(", ") || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono whitespace-nowrap">Deleted {t.deletedAt ? fmtDate(t.deletedAt) : ""}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onRestoreTeacher(t.id)} className="text-xs text-[#3F6B52] font-semibold underline mr-3 inline-flex items-center gap-1"><RotateCcw size={11} /> Restore</button>
                      <button onClick={() => onDeleteTeacher(t.id)} className="text-xs text-[#A63D2F] underline">Delete Permanently</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {cat === "staff" && (
        <Card>
          {activeData.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted staff.</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted staff match your search.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="ledger-row">
                    <td className="px-4 py-2.5 font-medium">{s.name} <span className="text-[10px] text-[#9C8F6E] font-mono">{s.staffId}</span></td>
                    <td className="px-4 py-2.5 text-xs text-[#6E6650]">{s.title || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono whitespace-nowrap">Deleted {s.deletedAt ? fmtDate(s.deletedAt) : ""}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onRestoreStaff(s.id)} className="text-xs text-[#3F6B52] font-semibold underline mr-3 inline-flex items-center gap-1"><RotateCcw size={11} /> Restore</button>
                      <button onClick={() => onDeleteStaff(s.id)} className="text-xs text-[#A63D2F] underline">Delete Permanently</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {cat === "salary" && (
        <Card>
          {activeData.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted salary payments.</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted salary payments match your search.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="ledger-row">
                    <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{fmtDate(p.date)}</td>
                    <td className="px-4 py-2.5 font-medium">{p.personName} <span className="text-[10px] text-[#9C8F6E] font-mono">{p.slipId}</span></td>
                    <td className="px-4 py-2.5 text-xs font-mono font-semibold text-[#3F6B52]">{fmtINR(p.netPaid)}</td>
                    <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono whitespace-nowrap">Deleted {p.deletedAt ? fmtDate(p.deletedAt) : ""}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onRestoreSalaryPayment(p.id)} className="text-xs text-[#3F6B52] font-semibold underline mr-3 inline-flex items-center gap-1"><RotateCcw size={11} /> Restore</button>
                      <button onClick={() => onDeleteSalaryPayment(p.id)} className="text-xs text-[#A63D2F] underline">Delete Permanently</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {cat === "advances" && (
        <Card>
          {activeData.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted advances.</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted advances match your search.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} className="ledger-row">
                    <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{fmtDate(a.date)}</td>
                    <td className="px-4 py-2.5 font-medium">{a.personName} <span className="text-[10px] text-[#9C8F6E] font-mono">{a.advanceId}</span></td>
                    <td className="px-4 py-2.5 text-xs font-mono font-semibold text-[#A63D2F]">{fmtINR(a.amount)}</td>
                    <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono whitespace-nowrap">Deleted {a.deletedAt ? fmtDate(a.deletedAt) : ""}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onRestoreAdvance(a.id)} className="text-xs text-[#3F6B52] font-semibold underline mr-3 inline-flex items-center gap-1"><RotateCcw size={11} /> Restore</button>
                      <button onClick={() => onDeleteAdvance(a.id)} className="text-xs text-[#A63D2F] underline">Delete Permanently</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {cat === "advancereturns" && (
        <Card>
          {activeData.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted advance returns.</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No deleted advance returns match your search.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="ledger-row">
                    <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="px-4 py-2.5 font-medium">{r.personName} <span className="text-[10px] text-[#9C8F6E] font-mono">{r.returnId}</span></td>
                    <td className="px-4 py-2.5 text-xs font-mono font-semibold text-[#3F6B52]">{fmtINR(r.amount)}</td>
                    <td className="px-4 py-2.5 text-xs text-[#9C8F6E] font-mono whitespace-nowrap">Deleted {r.deletedAt ? fmtDate(r.deletedAt) : ""}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onRestoreAdvanceReturn(r.id)} className="text-xs text-[#3F6B52] font-semibold underline mr-3 inline-flex items-center gap-1"><RotateCcw size={11} /> Restore</button>
                      <button onClick={() => onDeleteAdvanceReturn(r.id)} className="text-xs text-[#A63D2F] underline">Delete Permanently</button>
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

// ============================================================================
// TEACHER MANAGEMENT — new sidebar tab. Sub-tabs: Teachers, Performance,
// Batch Schedule, Staff. Same bordered pill-row pattern as
// STUDENT_MANAGEMENT_SUB_TABS. See UPDATE NOTES #23.
// ============================================================================
const TEACHER_MANAGEMENT_SUB_TABS = [
  { id: "teachers", label: "Teachers", icon: UserCog },
  { id: "batch-schedule", label: "Batch Schedule", icon: CalendarCheck },
  { id: "staff", label: "Staff", icon: Users },
  { id: "salary", label: "Salary", icon: Wallet },
  { id: "advance", label: "Advance", icon: Banknote },
  { id: "infrastructure", label: "Infrastructure Management", icon: Landmark },
];

function TeacherManagementTab({ teachersTabProps, batchScheduleTabProps, staffTabProps, salaryTabProps, advanceTabProps, infrastructureTabProps }) {
  const [subTab, setSubTab] = useState("teachers");
  return (
    <div>
      <SectionHeader eyebrow="Staffing" title="Institute Management" />
      <div className="text-sm text-[#6E6650] mb-4">Teacher register, batch allotment, other staff, Salary & Advance payments, and campus infrastructure — in one place. Teacher performance now lives under Academic Monitoring → Performance → Teachers Performance.</div>

      <div className="flex border rounded-sm overflow-hidden mb-5 w-fit flex-wrap" style={{ borderColor: "#12312B" }}>
        {TEACHER_MANAGEMENT_SUB_TABS.map((st, i) => {
          const Icon = st.icon;
          const active = subTab === st.id;
          return (
            <button key={st.id} onClick={() => setSubTab(st.id)}
              className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
              style={{ background: active ? "#12312B" : "white", color: active ? "#F4EFDE" : "#12312B", borderLeft: i === 0 ? "none" : "1px solid #12312B" }}>
              <Icon size={13} /> {st.label}
            </button>
          );
        })}
      </div>

      {subTab === "teachers" && <TeachersTab {...teachersTabProps} />}
      {subTab === "batch-schedule" && <BatchScheduleTab {...batchScheduleTabProps} />}
      {subTab === "staff" && <StaffTab {...staffTabProps} />}
      {subTab === "salary" && <SalaryTab {...salaryTabProps} />}
      {subTab === "advance" && <AdvanceTab {...advanceTabProps} />}
      {subTab === "infrastructure" && <InfrastructureTab {...infrastructureTabProps} />}
    </div>
  );
}

function TeachersTab({ teachers, subjectsList, batchSchedule, onAdd, onEdit, onRemove, onStatement, onChangeStatus }) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(t => {
      const haystack = [t.name, t.teacherId, t.phone, t.guardianPhone, t.address, t.aadharNumber, ...(t.expertiseSubjects || [])].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [teachers, search]);

  return (
    <div>
      <SectionHeader eyebrow="Register" title="Teachers Directory" action={
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Add Teacher
        </button>
      } />
      <Card className="p-3.5 mb-4">
        <div className="relative">
          <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Search</div>
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" style={{ marginTop: "9px" }} />
          <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, Teacher ID, subject, phone, Aadhar…" />
        </div>
      </Card>
      <Card>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">{teachers.length === 0 ? "No teachers registered yet." : "No teachers match this search."}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["#", "", "Name", "Expertise Subjects", "Status", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, idx) => {
                const isOpen = !!expanded[t.id];
                const myBatches = batchSchedule.filter(b => b.teacherId === t.id || b.substituteTeacherId === t.id);
                return (
                  <React.Fragment key={t.id}>
                    <tr className="ledger-row">
                      <td className="pl-4 py-2.5 text-xs text-[#9C8F6E] font-mono">{idx + 1}</td>
                      <td className="pl-1 py-2.5">
                        <button onClick={() => setExpanded(prev => ({ ...prev, [t.id]: !prev[t.id] }))} className="text-[#9C8F6E] hover:text-[#12312B] text-xs w-4">{isOpen ? "▾" : "▸"}</button>
                      </td>
                      <td className="px-4 py-2.5 font-medium">
                        <div>{t.name}</div>
                        <div className="text-[10px] text-[#9C8F6E] flex gap-1.5">
                          {t.teacherId && <span className="font-mono">{t.teacherId}</span>}
                          {t.phone && <span>{t.teacherId ? "· " : ""}{t.phone}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#6E6650]">{(t.expertiseSubjects || []).join(", ") || "—"}</td>
                      <td className="px-4 py-2.5 text-xs"><Stamp text={(t.status || "active") === "active" ? "Active" : "Inactive"} tone={(t.status || "active") === "active" ? "paid" : "overdue"} /></td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {onStatement && <button onClick={() => onStatement(t)} className="text-xs text-[#8A6420] underline mr-3">Statement</button>}
                        <button onClick={() => onChangeStatus(t, (t.status || "active") === "active" ? "inactive" : "active")}
                          className="text-xs underline mr-3" style={{ color: (t.status || "active") === "active" ? "#A63D2F" : "#3F6B52" }}>
                          {(t.status || "active") === "active" ? "Deactivate" : "Reactivate"}
                        </button>
                        <button onClick={() => onEdit(t)} className="text-xs text-[#12312B] underline mr-3">Edit</button>
                        <button onClick={() => onRemove(t.id)} className="text-xs text-[#A63D2F] underline">Remove</button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td></td><td></td>
                        <td colSpan={4} className="px-4 pb-3 pt-0">
                          <div className="p-3 rounded bg-[#FAF6EC] border text-xs space-y-2" style={{ borderColor: "#D8CFB8" }}>
                            <div className="grid grid-cols-3 gap-3">
                              <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Gender</span>{t.gender || "—"}</div>
                              <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Date of Birth</span>{t.dob ? fmtDate(t.dob) : "—"}</div>
                              <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Joining Date</span>{t.joiningDate ? fmtDate(t.joiningDate) : "—"}</div>
                              <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Guardian / Emergency Phone</span>{t.guardianPhone || "—"}</div>
                              <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Aadhar Number</span>{t.aadharNumber || "—"}</div>
                              <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Address</span>{t.address || "—"}</div>
                              <div><span className="text-[#9C8F6E] block font-mono text-[10px] uppercase">Current Salary</span>{fmtINR(t.salaryAmount || 0)}{t.paymentMode ? ` (${t.paymentMode})` : ""}</div>
                            </div>
                            {(t.qualifications || []).length > 0 && (
                              <div>
                                <span className="text-[#9C8F6E] block font-mono text-[10px] uppercase mb-1">Qualifications</span>
                                {t.qualifications.map((q, i) => <div key={i}>{q.degree} — {q.institution} ({q.year})</div>)}
                              </div>
                            )}
                            {(t.parallelProfessions || []).length > 0 && (
                              <div>
                                <span className="text-[#9C8F6E] block font-mono text-[10px] uppercase mb-1">Parallel Professions</span>
                                {t.parallelProfessions.map((p, i) => <div key={i}>{p.role} — {p.organization}{p.description ? ` (${p.description})` : ""}</div>)}
                              </div>
                            )}
                            <div>
                              <span className="text-[#9C8F6E] block font-mono text-[10px] uppercase mb-1">Batches Allotted</span>
                              {myBatches.length === 0 ? "—" : myBatches.map(b => (
                                <div key={b.id}>{b.batchName} — Class {b.class} · {b.subject} ({(b.daysOfWeek || []).join("/")}, {b.startTime}–{b.endTime}){b.substituteTeacherId === t.id ? " [Substitute]" : ""}</div>
                              ))}
                            </div>
                            {(t.statusLog || []).length > 0 && (
                              <div>
                                <span className="text-[#9C8F6E] block font-mono text-[10px] uppercase mb-1">Status History</span>
                                {[...t.statusLog].sort((a, b) => compareChrono(a, b, -1)).map((s, i) => (
                                  <div key={i} className="flex items-center gap-1.5">
                                    <span className="font-semibold" style={{ color: s.type === "deactivated" ? "#A63D2F" : "#3F6B52" }}>
                                      {s.type === "deactivated" ? "Deactivated" : "Reactivated"}
                                    </span>
                                    <span className="text-[#9C8F6E]">{fmtDate(s.date)}</span>
                                    {s.remarks && <span>— {s.remarks}</span>}
                                  </div>
                                ))}
                              </div>
                            )}
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

function TeacherFormModal({ subjectsList, initial, teachers, onClose, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [dob, setDob] = useState(initial?.dob || "");
  const [gender, setGender] = useState(initial?.gender || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [guardianPhone, setGuardianPhone] = useState(initial?.guardianPhone || "");
  const [address, setAddress] = useState(initial?.address || "");
  const [aadharNumber, setAadharNumber] = useState(initial?.aadharNumber || "");
  const [joiningDate, setJoiningDate] = useState(initial?.joiningDate || todayStr());
  const [expertiseSubjects, setExpertiseSubjects] = useState(initial?.expertiseSubjects || []);
  const [salaryAmount, setSalaryAmount] = useState(initial?.salaryAmount || "");
  const [paymentMode, setPaymentMode] = useState(initial?.paymentMode || "Bank Transfer");
  const [qualifications, setQualifications] = useState(initial?.qualifications || []);
  const [parallelProfessions, setParallelProfessions] = useState(initial?.parallelProfessions || []);

  const displayTeacherId = initial?.teacherId || useMemo(() => generateTeacherId(teachers), []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSubject(sub) {
    setExpertiseSubjects(prev => prev.includes(sub) ? prev.filter(x => x !== sub) : [...prev, sub]);
  }
  function addQualification() { setQualifications(prev => [...prev, { degree: "", institution: "", year: "" }]); }
  function updateQualification(i, field, val) { setQualifications(prev => prev.map((q, idx) => idx === i ? { ...q, [field]: val } : q)); }
  function removeQualification(i) { setQualifications(prev => prev.filter((_, idx) => idx !== i)); }
  function addProfession() { setParallelProfessions(prev => [...prev, { role: "", organization: "", description: "" }]); }
  function updateProfession(i, field, val) { setParallelProfessions(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p)); }
  function removeProfession(i) { setParallelProfessions(prev => prev.filter((_, idx) => idx !== i)); }

  function submit() {
    if (!name.trim()) return;
    const salaryHistory = [...(initial?.salaryHistory || [])];
    const newAmt = Number(salaryAmount) || 0;
    const prevAmt = initial ? (Number(initial.salaryAmount) || 0) : null;
    if (prevAmt === null || newAmt !== prevAmt) {
      salaryHistory.push({ date: todayStr(), amount: newAmt, remarks: initial ? "Salary updated" : "Initial salary" });
    }
    onSave({
      ...initial, id: initial?.id, teacherId: initial?.teacherId || displayTeacherId,
      name: name.trim(), dob, gender, phone: phone.trim(), guardianPhone: guardianPhone.trim(),
      address: address.trim(), aadharNumber: aadharNumber.trim(), joiningDate: joiningDate || todayStr(),
      qualifications, parallelProfessions, expertiseSubjects,
      salaryAmount: newAmt, paymentMode, salaryHistory, status: initial?.status || "active",
    });
  }

  return (
    <WideModal title={initial ? "Edit Teacher" : "Add Teacher"} onClose={onClose}>
      <div className="flex items-center justify-between mb-3 p-2 rounded bg-[#FAF6EC] border" style={{ borderColor: "#D8CFB8" }}>
        <span className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono">Teacher ID</span>
        <span className="text-sm font-bold text-[#12312B]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{displayTeacherId}{!initial && " (auto-assigned on save)"}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Full Name"><input className={inputCls} style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Anjali Verma" /></Field>
        <Field label="Gender">
          <select className={inputCls} style={inputStyle} value={gender} onChange={e => setGender(e.target.value)}>
            <option value="">— Select —</option><option value="Male">Male</option><option value="Female">Female</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date of Birth"><input type="date" className={inputCls} style={inputStyle} value={dob} onChange={e => setDob(e.target.value)} /></Field>
        <Field label="Joining Date"><input type="date" className={inputCls} style={inputStyle} value={joiningDate} onChange={e => setJoiningDate(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone"><input className={inputCls} style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit phone number" /></Field>
        <Field label="Emergency Contact"><input className={inputCls} style={inputStyle} value={guardianPhone} onChange={e => setGuardianPhone(e.target.value)} placeholder="Alternate contact" /></Field>
      </div>
      <Field label="Address"><input className={inputCls} style={inputStyle} value={address} onChange={e => setAddress(e.target.value)} placeholder="House / street / area / city" /></Field>
      <Field label="Aadhar Number"><input className={inputCls} style={inputStyle} value={aadharNumber} onChange={e => setAadharNumber(e.target.value)} placeholder="12-digit Aadhar number" maxLength={14} /></Field>

      <Field label={`Expertise Subjects (${expertiseSubjects.length} selected)`}>
        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 border bg-white rounded-sm">
          {subjectsList.map(sub => {
            const active = expertiseSubjects.includes(sub);
            return (
              <button key={sub} type="button" onClick={() => toggleSubject(sub)} className="px-2.5 py-1 text-xs rounded-sm border flex items-center gap-1"
                style={{ background: active ? "#12312B" : "white", color: active ? "#F4EFDE" : "#4A4636", borderColor: active ? "#12312B" : "#D8CFB8" }}>
                {active && <Check size={12} />}{sub}
              </button>
            );
          })}
        </div>
      </Field>

      <div className="p-3 border rounded-sm mb-3 bg-white" style={{ borderColor: "#D8CFB8" }}>
        <div className="text-xs font-semibold text-[#12312B] mb-2">Academic Qualifications</div>
        {qualifications.map((q, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_80px_28px] gap-2 mb-2">
            <input className={inputCls} style={inputStyle} value={q.degree} onChange={e => updateQualification(i, "degree", e.target.value)} placeholder="Degree" />
            <input className={inputCls} style={inputStyle} value={q.institution} onChange={e => updateQualification(i, "institution", e.target.value)} placeholder="Institution" />
            <input className={inputCls} style={inputStyle} value={q.year} onChange={e => updateQualification(i, "year", e.target.value)} placeholder="Year" />
            <button type="button" onClick={() => removeQualification(i)} className="text-[#A63D2F]"><X size={14} /></button>
          </div>
        ))}
        <button type="button" onClick={addQualification} className="text-xs text-[#12312B] underline flex items-center gap-1"><Plus size={12} /> Add Qualification</button>
      </div>

      <div className="p-3 border rounded-sm mb-3 bg-white" style={{ borderColor: "#D8CFB8" }}>
        <div className="text-xs font-semibold text-[#12312B] mb-2">Parallel Professions (optional)</div>
        {parallelProfessions.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_28px] gap-2 mb-2">
            <input className={inputCls} style={inputStyle} value={p.role} onChange={e => updateProfession(i, "role", e.target.value)} placeholder="Role" />
            <input className={inputCls} style={inputStyle} value={p.organization} onChange={e => updateProfession(i, "organization", e.target.value)} placeholder="Organization" />
            <input className={inputCls} style={inputStyle} value={p.description} onChange={e => updateProfession(i, "description", e.target.value)} placeholder="Description" />
            <button type="button" onClick={() => removeProfession(i)} className="text-[#A63D2F]"><X size={14} /></button>
          </div>
        ))}
        <button type="button" onClick={addProfession} className="text-xs text-[#12312B] underline flex items-center gap-1"><Plus size={12} /> Add Profession</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Current Salary (₹)"><input type="number" className={inputCls} style={inputStyle} value={salaryAmount} onChange={e => setSalaryAmount(e.target.value)} placeholder="0" /></Field>
        <Field label="Payment Mode">
          <select className={inputCls} style={inputStyle} value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
            {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
      </div>
      {initial?.salaryHistory?.length > 0 && (
        <div className="text-[10px] text-[#9C8F6E] mb-3">Salary history: {initial.salaryHistory.map((h, i) => `${fmtDate(h.date)} — ${fmtINR(h.amount)}`).join(" · ")}</div>
      )}
      {initial && (
        <div className="text-[10px] text-[#9C8F6E] mb-3">
          Status: <span className="font-semibold" style={{ color: (initial.status || "active") === "active" ? "#3F6B52" : "#A63D2F" }}>{(initial.status || "active") === "active" ? "Active" : "Inactive"}</span> — use the Deactivate / Reactivate button on the teacher's row to change this (requires a date and remarks).
        </div>
      )}

      <button onClick={submit} className="w-full mt-2 py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
        {initial ? "Save Changes" : "Register Teacher"}
      </button>
    </WideModal>
  );
}

// ---- Dedicated Deactivate / Reactivate modal — requires a date and
// remarks for every status transition (unlike the old plain Status
// dropdown, which recorded neither). Every submission is appended to the
// teacher's statusLog, never overwritten — see changeTeacherStatus() and
// the "Status History" panel in TeachersTab.
function TeacherStatusModal({ teacher, newStatus, onClose, onSave }) {
  const [date, setDate] = useState(todayStr());
  const [remarks, setRemarks] = useState("");
  const activating = newStatus === "active";

  return (
    <Modal title={`${activating ? "Reactivate" : "Deactivate"} ${teacher.name}`} onClose={onClose}>
      <div className="text-sm text-[#6E6650] mb-3">
        {activating
          ? "Record when this teacher is returning to active duty, and why."
          : "Record when this teacher stopped active duty, and why. This doesn't remove them or their history — Performance and Batches stay exactly as they are."}
      </div>
      <Field label={activating ? "Reactivation Date" : "Inactive Date"}>
        <input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
      </Field>
      <Field label="Remarks">
        <input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)}
          placeholder={activating ? "e.g. Returned from leave" : "e.g. Extended leave, resigned, on-hold"} />
      </Field>
      <button onClick={() => onSave(date, remarks)} className="w-full mt-2 py-2.5 rounded-sm text-sm font-medium"
        style={{ background: activating ? "#3F6B52" : "#A63D2F", color: "#F4EFDE" }}>
        {activating ? "Confirm Reactivation" : "Confirm Deactivation"}
      </button>
    </Modal>
  );
}

// ---- Settings — now a tabbed modal (SETTINGS_SUB_TABS) so future setting
// categories (Appearance, Users & Roles, Notifications, etc.) have a home
// without redesigning this again. Only one sub-tab exists today: "Institute
// Information" — Name/Tagline/Address/Mobile/Telephone/GST (text only per
// decision — logo is a later addition once Firebase Storage is confirmed
// set up). This is the institute's own business identity shown on every
// printed document via InstituteHeader (see DEFAULT_INSTITUTE_SETTINGS /
// InstituteSettingsContext) — separate from "InstituteOS", the app's own
// product branding in the sidebar, which this does not touch.
const SETTINGS_SUB_TABS = [
  { id: "institute-info", label: "Institute Information", icon: Landmark },
];

function SettingsModal({ initial, onClose, onSave }) {
  const [subTab, setSubTab] = useState("institute-info");
  const [instituteName, setInstituteName] = useState(initial?.instituteName || "");
  const [tagline, setTagline] = useState(initial?.tagline || "");
  const [address, setAddress] = useState(initial?.address || "");
  const [mobileNumber, setMobileNumber] = useState(initial?.mobileNumber || "");
  const [telephoneNumber, setTelephoneNumber] = useState(initial?.telephoneNumber || "");
  const [gstNumber, setGstNumber] = useState(initial?.gstNumber || "");

  function submit() {
    onSave({
      instituteName: instituteName.trim() || "COACHING CLASSES",
      tagline: tagline.trim(), address: address.trim(),
      mobileNumber: mobileNumber.trim(), telephoneNumber: telephoneNumber.trim(),
      gstNumber: gstNumber.trim(),
    });
  }

  return (
    <Modal title="Settings" onClose={onClose}>
      {/* Individual chip buttons (own border + rounded corners each) —
          same pattern used for Recycle Bin / Banking's sub-tab rows, so
          this stays robust if more Settings categories are added later
          and the row needs to wrap. */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {SETTINGS_SUB_TABS.map(st => {
          const Icon = st.icon;
          const active = subTab === st.id;
          return (
            <button key={st.id} onClick={() => setSubTab(st.id)}
              className="px-3 py-1.5 text-xs font-semibold rounded-sm border flex items-center gap-1.5"
              style={{ background: active ? "#12312B" : "white", color: active ? "#F4EFDE" : "#12312B", borderColor: "#12312B" }}>
              <Icon size={13} /> {st.label}
            </button>
          );
        })}
      </div>

      {subTab === "institute-info" && (
        <>
          <div className="text-sm text-[#6E6650] mb-3">This appears on every printed receipt, slip, and statement in place of the default "COACHING CLASSES" placeholder.</div>
          <Field label="Institute Name"><input className={inputCls} style={inputStyle} value={instituteName} onChange={e => setInstituteName(e.target.value)} placeholder="e.g. Horizon Coaching Classes" /></Field>
          <Field label="Tagline (optional)"><input className={inputCls} style={inputStyle} value={tagline} onChange={e => setTagline(e.target.value)} placeholder="e.g. Excellence in JEE & NEET Coaching" /></Field>
          <Field label="Address (optional)"><input className={inputCls} style={inputStyle} value={address} onChange={e => setAddress(e.target.value)} placeholder="Street / area / city" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mobile Number (optional)"><input className={inputCls} style={inputStyle} value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} /></Field>
            <Field label="Telephone Number (optional)"><input className={inputCls} style={inputStyle} value={telephoneNumber} onChange={e => setTelephoneNumber(e.target.value)} /></Field>
          </div>
          <Field label="GST / Registration No. (optional)"><input className={inputCls} style={inputStyle} value={gstNumber} onChange={e => setGstNumber(e.target.value)} /></Field>
        </>
      )}

      <button onClick={submit} className="w-full mt-2 py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Save Settings
      </button>
    </Modal>
  );
}

function TeacherPerformanceTab({ teachers, batches, attendanceRecords, tests }) {
  return (
    <div>
      <SectionHeader eyebrow="Staffing" title="Teacher Performance" />
      <div className="text-sm text-[#6E6650] mb-4">
        Computed from each teacher's allotted batches — attendance consistency of enrolled students and their average test scores.
        The weighting is a placeholder pending confirmation (see computeTeacherPerformance in code) — every underlying number is shown below so it's auditable, not a black box.
      </div>
      {teachers.length === 0 ? (
        <Card><div className="p-8 text-center text-sm text-[#9C8F6E]">No teachers registered yet.</div></Card>
      ) : (
        <div className="space-y-4">
          {teachers.map(t => {
            const perf = computeTeacherPerformance(t, batches, attendanceRecords, tests);
            return (
              <Card key={t.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-semibold text-[#12312B]">{t.name}</div>
                    <div className="text-[10px] text-[#9C8F6E] font-mono">{t.teacherId}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono">Summary Score</div>
                    <div className="text-xl font-bold text-[#12312B]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                      {perf && perf.summaryScore != null ? `${perf.summaryScore.toFixed(1)}%` : "—"}
                    </div>
                  </div>
                </div>
                {!perf ? (
                  <div className="text-xs text-[#9C8F6E]">No batches assigned yet.</div>
                ) : (
                  <>
                    <div className="text-xs text-[#6E6650] mb-2">Avg. Attendance: {perf.avgAttendance != null ? `${perf.avgAttendance.toFixed(1)}%` : "—"} · Avg. Test Score: {perf.avgTest != null ? `${perf.avgTest.toFixed(1)}%` : "—"}</div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ borderBottom: "1px solid #D8CFB8" }}>
                          <th className="text-left py-1.5 text-[#9C8F6E] font-mono uppercase text-[10px]">Batch</th>
                          <th className="text-left py-1.5 text-[#9C8F6E] font-mono uppercase text-[10px]">Attendance %</th>
                          <th className="text-left py-1.5 text-[#9C8F6E] font-mono uppercase text-[10px]">Avg Test %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {perf.batchBreakdown.map(bb => (
                          <tr key={bb.batch.id} className="ledger-row">
                            <td className="py-1.5">{bb.batch.batchName} (Class {bb.batch.class} · {bb.batch.subject})</td>
                            <td className="py-1.5">{bb.attendancePct != null ? `${bb.attendancePct.toFixed(1)}%` : "—"}</td>
                            <td className="py-1.5">{bb.avgTestPct != null ? `${bb.avgTestPct.toFixed(1)}%` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BatchScheduleTab({ batchSchedule, teachers, classes, subjectsList, onAdd, onEdit, onRemove }) {
  const teacherById = Object.fromEntries(teachers.map(t => [t.id, t]));
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return batchSchedule
      .filter(b => classFilter === "all" || String(b.class) === classFilter)
      .filter(b => subjectFilter === "all" || b.subject === subjectFilter)
      .filter(b => {
        if (!q) return true;
        const teacher = teacherById[b.teacherId];
        const sub = teacherById[b.substituteTeacherId];
        const haystack = [b.batchName, b.class, b.subject, b.roomNumber, teacher?.name, sub?.name, ...(b.daysOfWeek || [])].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(q);
      });
  }, [batchSchedule, classFilter, subjectFilter, search, teacherById]);
  const isFiltered = search || classFilter !== "all" || subjectFilter !== "all";

  return (
    <div>
      <SectionHeader eyebrow="Scheduling" title="Batch Schedule" action={
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Add Batch
        </button>
      } />

      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Search</div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" />
              <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Batch name, teacher, or day..." />
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Class</div>
            <select className={inputCls} style={inputStyle} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
              <option value="all">All Classes</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Subject</div>
            <select className={inputCls} style={inputStyle} value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
              <option value="all">All Subjects</option>
              {subjectsList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {isFiltered && (
            <button onClick={() => { setSearch(""); setClassFilter("all"); setSubjectFilter("all"); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
      </Card>

      {batchSchedule.length > 0 && (
        <div className="text-xs text-[#6E6650] mb-3">Showing {filtered.length} of {batchSchedule.length} batch{batchSchedule.length === 1 ? "" : "es"}</div>
      )}

      <Card>
        {batchSchedule.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">No batches scheduled yet.</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">No batches match these filters.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["#", "Batch", "Class", "Subject", "Room", "Days", "Time", "Teacher", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((b, i) => (
                <tr key={b.id} className="ledger-row">
                  <td className="px-4 py-2.5 text-xs font-mono text-[#9C8F6E]">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium">{b.batchName}</td>
                  <td className="px-4 py-2.5 text-xs">{b.class}</td>
                  <td className="px-4 py-2.5 text-xs">{b.subject}</td>
                  <td className="px-4 py-2.5 text-xs">{b.roomNumber || "—"}</td>
                  <td className="px-4 py-2.5 text-xs">{(b.daysOfWeek || []).join(", ")}</td>
                  <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{b.startTime}–{b.endTime}{b.duration ? ` (${b.duration})` : ""}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {teacherById[b.teacherId]?.name || "—"}
                    {b.substituteTeacherId && teacherById[b.substituteTeacherId] && <div className="text-[10px] text-[#9C8F6E]">Sub: {teacherById[b.substituteTeacherId].name}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => onEdit(b)} className="text-xs text-[#12312B] underline mr-3">Edit</button>
                    <button onClick={() => onRemove(b.id)} className="text-xs text-[#A63D2F] underline">Delete</button>
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

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function BatchScheduleFormModal({ classes, subjectsList, teachers, infrastructure, initial, onClose, onSave }) {
  const [batchName, setBatchName] = useState(initial?.batchName || "");
  const [cls, setCls] = useState(initial?.class || classes[0] || "");
  const [subject, setSubject] = useState(initial?.subject || subjectsList[0] || "");
  const [startTime, setStartTime] = useState(initial?.startTime || "");
  const [endTime, setEndTime] = useState(initial?.endTime || "");
  const [daysOfWeek, setDaysOfWeek] = useState(initial?.daysOfWeek || []);
  const [teacherId, setTeacherId] = useState(initial?.teacherId || "");
  const [substituteTeacherId, setSubstituteTeacherId] = useState(initial?.substituteTeacherId || "");
  const [roomNumber, setRoomNumber] = useState(initial?.roomNumber || "");
  // Room Number ↔ Infrastructure Management matching — free text still
  // works (so this never blocks a batch being saved before rooms are
  // registered), but now autocompletes from Infrastructure Management's
  // registry (via the datalist below) and shows a live match/no-match
  // indicator, so a typo like "Room 10" vs the registered "Room-10" is
  // caught immediately instead of silently creating an unlinked name.
  const roomMatch = useMemo(() => {
    const q = roomNumber.trim().toLowerCase();
    if (!q) return null;
    return (infrastructure || []).find(r => (r.name || "").trim().toLowerCase() === q) || null;
  }, [roomNumber, infrastructure]);
  // Batch Name auto-fills from Class + Subject (e.g. Class "12" + Subject
  // "Physics" -> "12 Physics"; Class "JEE" + Subject "Mathematics" -> "JEE
  // Mathematics") for as long as the user hasn't typed into the field
  // themselves. Editing an existing batch starts "already touched" so its
  // saved name is never silently overwritten just by opening the modal.
  const [nameTouched, setNameTouched] = useState(!!initial);

  useEffect(() => {
    if (nameTouched || !cls || !subject) return;
    setBatchName(`${classCodeForId(cls)} ${subject}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls, subject, nameTouched]);

  function toggleDay(d) { setDaysOfWeek(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]); }

  function durationLabel() {
    if (!startTime || !endTime) return "";
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  function submit() {
    if (!batchName.trim() || !teacherId) return;
    onSave({
      ...initial, id: initial?.id, batchName: batchName.trim(), class: cls, subject,
      startTime, endTime, duration: durationLabel(), daysOfWeek, teacherId,
      substituteTeacherId: substituteTeacherId || null, roomNumber: roomNumber.trim(),
    });
  }

  return (
    <Modal title={initial ? "Edit Batch" : "Add Batch"} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Class">
          <select className={inputCls} style={inputStyle} value={cls} onChange={e => setCls(e.target.value)}>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Subject">
          <select className={inputCls} style={inputStyle} value={subject} onChange={e => setSubject(e.target.value)}>
            {subjectsList.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Batch Name"><input className={inputCls} style={inputStyle} value={batchName} onChange={e => { setBatchName(e.target.value); setNameTouched(true); }} placeholder="e.g. Morning Physics Batch" /></Field>
      {!nameTouched && <div className="text-[10px] text-[#9C8F6E] -mt-2.5 mb-3">Auto-filled from Class + Subject — type here to set a custom name.</div>}
      <Field label="Room Number">
        <input className={inputCls} style={inputStyle} value={roomNumber} onChange={e => setRoomNumber(e.target.value)}
          list="infra-room-options" placeholder="e.g. Room 204, Lab 2 — matches Infrastructure Management" />
        <datalist id="infra-room-options">
          {(infrastructure || []).map(r => <option key={r.id} value={r.name} />)}
        </datalist>
      </Field>
      {roomNumber.trim() && (infrastructure || []).length > 0 && (
        roomMatch ? (
          <div className="text-[10px] text-[#3F6B52] -mt-2.5 mb-3 flex items-center gap-1"><Check size={11} /> Matches "{roomMatch.name}" ({roomMatch.category}) in Infrastructure Management</div>
        ) : (
          <div className="text-[10px] text-[#B8862B] -mt-2.5 mb-3 flex items-center gap-1"><AlertCircle size={11} /> No matching room found in Infrastructure Management — check spelling, or add it there</div>
        )
      )}
      {roomNumber.trim() && (infrastructure || []).length === 0 && (
        <div className="text-[10px] text-[#9C8F6E] -mt-2.5 mb-3">Add rooms in Institute Management → Infrastructure Management to enable matching here.</div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start Time"><input type="time" className={inputCls} style={inputStyle} value={startTime} onChange={e => setStartTime(e.target.value)} /></Field>
        <Field label="End Time"><input type="time" className={inputCls} style={inputStyle} value={endTime} onChange={e => setEndTime(e.target.value)} /></Field>
      </div>
      {startTime && endTime && <div className="text-[10px] text-[#9C8F6E] mb-3">Duration: {durationLabel()}</div>}
      <Field label="Days of Week">
        <div className="flex flex-wrap gap-2">
          {DAYS_OF_WEEK.map(d => {
            const active = daysOfWeek.includes(d);
            return (
              <button key={d} type="button" onClick={() => toggleDay(d)} className="px-2.5 py-1 text-xs rounded-sm border"
                style={{ background: active ? "#12312B" : "white", color: active ? "#F4EFDE" : "#4A4636", borderColor: active ? "#12312B" : "#D8CFB8" }}>{d}</button>
            );
          })}
        </div>
      </Field>
      <Field label="Teacher">
        <select className={inputCls} style={inputStyle} value={teacherId} onChange={e => setTeacherId(e.target.value)}>
          <option value="">— Select Teacher —</option>
          {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <Field label="Substitute Teacher (optional)">
        <select className={inputCls} style={inputStyle} value={substituteTeacherId} onChange={e => setSubstituteTeacherId(e.target.value)}>
          <option value="">— None —</option>
          {teachers.filter(t => t.id !== teacherId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <button onClick={submit} className="w-full mt-2 py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
        {initial ? "Save Changes" : "Add Batch"}
      </button>
    </Modal>
  );
}

function StaffTab({ staff, onAdd, onEdit, onRemove, onStatement }) {
  return (
    <div>
      <SectionHeader eyebrow="Register" title="Other Staff" action={
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Add Staff
        </button>
      } />
      <Card>
        {staff.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">No staff registered yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Name", "Title", "Salary", "Status", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.id} className="ledger-row">
                  <td className="px-4 py-2.5 font-medium">{s.name}<div className="text-[10px] text-[#9C8F6E] font-mono">{s.staffId}</div></td>
                  <td className="px-4 py-2.5 text-xs">{s.title || "—"}</td>
                  <td className="px-4 py-2.5 text-xs font-mono">{fmtINR(s.salaryAmount || 0)}</td>
                  <td className="px-4 py-2.5 text-xs"><Stamp text={(s.status || "active") === "active" ? "Active" : "Inactive"} tone={(s.status || "active") === "active" ? "paid" : "overdue"} /></td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {onStatement && <button onClick={() => onStatement(s)} className="text-xs text-[#8A6420] underline mr-3">Statement</button>}
                    <button onClick={() => onEdit(s)} className="text-xs text-[#12312B] underline mr-3">Edit</button>
                    <button onClick={() => onRemove(s.id)} className="text-xs text-[#A63D2F] underline">Remove</button>
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

function StaffFormModal({ initial, staff, onClose, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [title, setTitle] = useState(initial?.title || "");
  const [dob, setDob] = useState(initial?.dob || "");
  const [gender, setGender] = useState(initial?.gender || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [guardianPhone, setGuardianPhone] = useState(initial?.guardianPhone || "");
  const [address, setAddress] = useState(initial?.address || "");
  const [aadharNumber, setAadharNumber] = useState(initial?.aadharNumber || "");
  const [joiningDate, setJoiningDate] = useState(initial?.joiningDate || todayStr());
  const [salaryAmount, setSalaryAmount] = useState(initial?.salaryAmount || "");
  const [paymentMode, setPaymentMode] = useState(initial?.paymentMode || "Bank Transfer");
  const [status, setStatus] = useState(initial?.status || "active");

  const displayStaffId = initial?.staffId || useMemo(() => generateStaffId(staff), []); // eslint-disable-line react-hooks/exhaustive-deps

  function submit() {
    if (!name.trim()) return;
    const salaryHistory = [...(initial?.salaryHistory || [])];
    const newAmt = Number(salaryAmount) || 0;
    const prevAmt = initial ? (Number(initial.salaryAmount) || 0) : null;
    if (prevAmt === null || newAmt !== prevAmt) {
      salaryHistory.push({ date: todayStr(), amount: newAmt, remarks: initial ? "Salary updated" : "Initial salary" });
    }
    onSave({
      ...initial, id: initial?.id, staffId: initial?.staffId || displayStaffId,
      name: name.trim(), title: title.trim(), dob, gender, phone: phone.trim(),
      guardianPhone: guardianPhone.trim(), address: address.trim(), aadharNumber: aadharNumber.trim(),
      joiningDate: joiningDate || todayStr(), salaryAmount: newAmt, paymentMode, salaryHistory, status,
    });
  }

  return (
    <Modal title={initial ? "Edit Staff" : "Add Staff"} onClose={onClose}>
      <div className="flex items-center justify-between mb-3 p-2 rounded bg-[#FAF6EC] border" style={{ borderColor: "#D8CFB8" }}>
        <span className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono">Staff ID</span>
        <span className="text-sm font-bold text-[#12312B]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{displayStaffId}{!initial && " (auto-assigned on save)"}</span>
      </div>
      <Field label="Full Name"><input className={inputCls} style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ramesh Kumar" /></Field>
      <Field label="Title / Designation"><input className={inputCls} style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Office Assistant, Peon, Accountant" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date of Birth"><input type="date" className={inputCls} style={inputStyle} value={dob} onChange={e => setDob(e.target.value)} /></Field>
        <Field label="Gender">
          <select className={inputCls} style={inputStyle} value={gender} onChange={e => setGender(e.target.value)}>
            <option value="">— Select —</option><option value="Male">Male</option><option value="Female">Female</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone"><input className={inputCls} style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} /></Field>
        <Field label="Emergency Contact"><input className={inputCls} style={inputStyle} value={guardianPhone} onChange={e => setGuardianPhone(e.target.value)} /></Field>
      </div>
      <Field label="Address"><input className={inputCls} style={inputStyle} value={address} onChange={e => setAddress(e.target.value)} /></Field>
      <Field label="Aadhar Number"><input className={inputCls} style={inputStyle} value={aadharNumber} onChange={e => setAadharNumber(e.target.value)} maxLength={14} /></Field>
      <Field label="Joining Date"><input type="date" className={inputCls} style={inputStyle} value={joiningDate} onChange={e => setJoiningDate(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Current Salary (₹)"><input type="number" className={inputCls} style={inputStyle} value={salaryAmount} onChange={e => setSalaryAmount(e.target.value)} placeholder="0" /></Field>
        <Field label="Payment Mode">
          <select className={inputCls} style={inputStyle} value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
            {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Status">
        <select className={inputCls} style={inputStyle} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="active">Active</option><option value="inactive">Inactive</option>
        </select>
      </Field>
      <button onClick={submit} className="w-full mt-2 py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
        {initial ? "Save Changes" : "Register Staff"}
      </button>
    </Modal>
  );
}

// ============================================================================
// SALARY / ADVANCE — two new sub-tabs inside Institute Management (see
// TEACHER_MANAGEMENT_SUB_TABS), right after "Staff". Both read from a
// merged Teachers+Staff picker (mergeStaffAndTeachers) and follow the same
// onSnapshot / visibleX / trashedX / soft-delete pattern as every other
// collection in this file. See UPDATE NOTES #24.
// ============================================================================

// Shared merged-person picker — same search-dropdown pattern already used
// for the student picker in DepositFormModal / AddChargeModal, just over
// the merged Teachers+Staff list instead of Students. `value` is a
// composite "personType:personId" key so a teacher and a staff member can
// never collide even if their Firestore doc ids ever did.
function PersonPicker({ persons, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = persons.find(p => `${p.personType}:${p.personId}` === value);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return persons;
    return persons.filter(p => [p.name, p.displayId, p.role, p.phone].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [persons, search]);

  return (
    <div className="relative">
      <div className="flex items-center border rounded-sm bg-white px-3 py-2 cursor-pointer" style={inputStyle} onClick={() => setOpen(o => !o)}>
        <Search size={13} className="text-[#9C8F6E] mr-2 shrink-0" />
        <span className="text-sm flex-1 truncate">
          {selected ? `${selected.name} — ${selected.personType === "teacher" ? "Teacher" : "Staff"}${selected.role ? " · " + selected.role : ""}` : (placeholder || "Search by name, ID, or role…")}
        </span>
      </div>
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white border rounded-sm shadow-lg max-h-64 overflow-y-auto" style={{ borderColor: "#D8CFB8" }}>
          <div className="p-2 sticky top-0 bg-white border-b" style={{ borderColor: "#EEE7D2" }}>
            <input autoFocus className={inputCls} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Type name, ID, or role…" />
          </div>
          {filtered.length === 0 ? (
            <div className="p-3 text-xs text-[#9C8F6E] text-center">No teacher or staff member matches.</div>
          ) : (
            filtered.map(p => {
              const key = `${p.personType}:${p.personId}`;
              return (
                <button key={key} type="button" onClick={() => { onChange(key); setOpen(false); setSearch(""); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[#F5F0E1] flex items-center justify-between"
                  style={{ background: key === value ? "#F5F0E1" : "white" }}>
                  <span>{p.name} <span className="text-xs text-[#9C8F6E]">— {p.personType === "teacher" ? "Teacher" : "Staff"}{p.role ? " · " + p.role : ""}</span></span>
                  <span className="text-xs text-[#9C8F6E] font-mono">{p.displayId || ""}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function SalaryTab({ salaryPayments, persons, onAdd, onViewSlip, onRemove, onStatement }) {
  const [monthFilter, setMonthFilter] = useState("");
  const [search, setSearch] = useState("");

  const sorted = useMemo(() => [...salaryPayments].sort((a, b) => compareChrono(a, b, -1)), [salaryPayments]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter(p => {
      if (monthFilter && p.month !== monthFilter) return false;
      if (!q) return true;
      return [p.personName, p.personRole, p.slipId].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [sorted, monthFilter, search]);

  return (
    <div>
      <SectionHeader eyebrow="Payroll" title="Salary" action={
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Pay Salary
        </button>
      } />
      <Card className="p-3.5 mb-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Search</div>
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" style={{ marginTop: "9px" }} />
            <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, role, or slip ID…" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Month</div>
            <input type="month" className={inputCls} style={inputStyle} value={monthFilter} onChange={e => setMonthFilter(e.target.value)} />
          </div>
        </div>
      </Card>
      <Card>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">{salaryPayments.length === 0 ? "No salary payments recorded yet." : "No salary payments match this filter."}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Date", "Person", "Month", "Base", "Advance Deducted", "Net Paid", "Mode", "Slip", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="ledger-row">
                  <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{fmtDate(p.date)}</td>
                  <td className="px-4 py-2.5 font-medium">
                    {onStatement ? (
                      <button onClick={() => onStatement(p.personId, p.personType)} className="underline hover:text-[#3F6B52]">{p.personName}</button>
                    ) : p.personName}
                    <div className="text-[10px] text-[#9C8F6E]">{p.personRole}{p.personType === "teacher" ? " · Teacher" : " · Staff"}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono">{monthLabel(p.month)}</td>
                  <td className="px-4 py-2.5 text-xs font-mono">{fmtINR(p.baseAmount)}</td>
                  <td className="px-4 py-2.5 text-xs font-mono text-[#B8862B]">{p.advanceDeducted > 0 ? fmtINR(p.advanceDeducted) : "—"}</td>
                  <td className="px-4 py-2.5 text-xs font-mono font-semibold text-[#3F6B52]">{fmtINR(p.netPaid)}</td>
                  <td className="px-4 py-2.5 text-xs">{p.mode || "Cash"}</td>
                  <td className="px-4 py-2.5 text-xs font-mono">{p.slipId}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => onViewSlip(p)} className="text-xs text-[#12312B] underline mr-3">Slip</button>
                    <button onClick={() => onRemove(p.id)} className="text-xs text-[#A63D2F] underline">Remove</button>
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

function SalaryFormModal({ persons, advances, onClose, onSave }) {
  const [personKey, setPersonKey] = useState(persons[0] ? `${persons[0].personType}:${persons[0].personId}` : "");
  const selected = persons.find(p => `${p.personType}:${p.personId}` === personKey);
  const [month, setMonth] = useState(currentMonthKey());
  const [baseAmount, setBaseAmount] = useState(selected?.salaryAmount || "");
  const [mode, setMode] = useState(selected?.paymentMode || "Cash");
  const [date, setDate] = useState(todayStr());
  const [remarks, setRemarks] = useState("");
  const [advanceDeductInput, setAdvanceDeductInput] = useState("");

  // When the selected person changes, default the amount/mode fields from
  // their record — same "default-fill from salaryAmount" pattern already
  // used in TeacherFormModal / StaffFormModal — and reset the advance
  // deduction so it's never carried over onto a different person.
  useEffect(() => {
    setBaseAmount(selected?.salaryAmount || "");
    setMode(selected?.paymentMode || "Cash");
    setAdvanceDeductInput("");
  }, [personKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sourced from the same shared openAdvancesFor() helper saveSalaryPayment()
  // uses, so this live preview and the actual settlement can never disagree.
  const outstandingAdvance = useMemo(() => {
    if (!selected) return 0;
    return round2(openAdvancesFor(advances, selected.personId, selected.personType)
      .reduce((sum, a) => sum + (Number(a.outstandingAmount) || 0), 0));
  }, [advances, selected]);

  const deduct = Math.min(Number(advanceDeductInput) || 0, outstandingAdvance);
  const netPayable = round2((Number(baseAmount) || 0) - deduct);

  function submit() {
    if (!selected || !month || !(Number(baseAmount) > 0)) return;
    onSave({
      personId: selected.personId, personType: selected.personType, personName: selected.name, personRole: selected.role,
      month, baseAmount: Number(baseAmount) || 0, advanceDeducted: deduct, mode, date, remarks: remarks.trim(),
    });
  }

  return (
    <Modal title="Pay Salary" onClose={onClose}>
      <Field label="Select Teacher / Staff Member">
        <PersonPicker persons={persons} value={personKey} onChange={setPersonKey} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="For Month"><input type="month" className={inputCls} style={inputStyle} value={month} onChange={e => setMonth(e.target.value)} /></Field>
        <Field label="Date Paid"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
      </div>
      <Field label="Base Salary Amount (₹)"><input type="number" className={inputCls} style={inputStyle} value={baseAmount} onChange={e => setBaseAmount(e.target.value)} placeholder="0" /></Field>

      {outstandingAdvance > 0 && (
        <div className="p-3 border rounded-sm mb-3 bg-white" style={{ borderColor: "#B8862B" }}>
          <div className="text-xs font-semibold text-[#8A6420] mb-1.5">Outstanding Advance: {fmtINR(outstandingAdvance)}</div>
          <Field label="Deduct From This Salary (₹, optional)">
            <input type="number" className={inputCls} style={inputStyle} value={advanceDeductInput}
              onChange={e => setAdvanceDeductInput(e.target.value)} placeholder="0" max={outstandingAdvance} />
          </Field>
          <button type="button" onClick={() => setAdvanceDeductInput(String(outstandingAdvance))} className="text-[10px] text-[#8A6420] underline">
            Deduct full outstanding amount
          </button>
        </div>
      )}

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

      <Field label="Remarks (optional)"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any note for this payment" /></Field>

      <div className="text-xs text-[#6E6650] mb-3 flex justify-between">
        <span>Net Payable Now:</span>
        <strong className={netPayable >= 0 ? "text-[#3F6B52]" : "text-[#A63D2F]"}>{fmtINR(netPayable)}</strong>
      </div>

      <button onClick={submit} className="w-full mt-2 py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Pay Salary & Generate Slip
      </button>
    </Modal>
  );
}

function SalarySlipModal({ payment, onClose }) {
  const slipRef = useRef();
  if (!payment) return null;

  const handlePrint = () => {
    const printContent = slipRef.current.innerHTML;
    const win = window.open("", "", "width=600,height=750");
    win.document.write(`
      <html>
        <head>
          <title>Salary Slip - ${payment.slipId || ""}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 20px; color: #12312B; }
            .receipt-box { border: 2px solid #12312B; padding: 20px; border-radius: 4px; max-w: 420px; margin: auto; }
            .header { text-align: center; border-bottom: 2px dashed #12312B; padding-bottom: 10px; margin-bottom: 15px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
            .bold { font-weight: bold; }
            .sign-row { display: flex; justify-content: space-between; margin-top: 40px; }
            .sign-line { border-top: 1px solid #12312B; width: 45%; text-align: center; padding-top: 4px; font-size: 11px; }
            .footer { border-top: 1.5px solid #12312B; padding-top: 10px; margin-top: 15px; text-align: center; font-size: 11px; }
          </style>
        </head>
        <body><div class="receipt-box">${printContent}</div></body>
      </html>
    `);
    win.document.close(); win.focus(); win.print(); win.close();
  };

  return (
    <Modal title="Salary Slip" onClose={onClose}>
      <div className="p-4 border bg-white rounded-sm mb-4" ref={slipRef} style={{ borderColor: "#12312B" }}>
        <div className="text-center pb-3 mb-3 border-b-2 border-dashed border-[#12312B]">
          <InstituteHeader subtitle={`Official Salary Slip`} large={false} />
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-[#6E6650]">
            <span>Slip ID: <strong className="text-[#12312B]">{payment.slipId}</strong></span>
            <span>Date: <strong className="text-[#12312B]">{fmtDate(payment.date)}</strong></span>
          </div>
          <div className="flex justify-between text-[#6E6650]"><span>Employee Name:</span><strong className="text-[#12312B]">{payment.personName}</strong></div>
          <div className="flex justify-between text-[#6E6650]"><span>Role / Designation:</span><strong className="text-[#12312B]">{payment.personRole}{payment.personType === "teacher" ? " (Teacher)" : " (Staff)"}</strong></div>
          <div className="flex justify-between text-[#6E6650]"><span>For Month:</span><strong className="text-[#12312B]">{monthLabel(payment.month)}</strong></div>
          {payment.remarks && <div className="flex justify-between text-[#6E6650]"><span>Remarks:</span><strong className="text-[#12312B]">{payment.remarks}</strong></div>}

          <div className="pt-3 mt-3 border-t-2 border-[#12312B] space-y-1">
            <div className="flex justify-between"><span>Base Salary:</span><strong>{fmtINR(payment.baseAmount)}</strong></div>
            {payment.advanceDeducted > 0 && (
              <div className="flex justify-between text-[#B8862B]">
                <span>
                  Advance Deducted{(payment.settledAdvances || []).length > 0 ? ` (${payment.settledAdvances.map(s => s.advanceRefId).filter(Boolean).join(", ")})` : ""}:
                </span>
                <strong>− {fmtINR(payment.advanceDeducted)}</strong>
              </div>
            )}
            <div className="flex justify-between items-center text-sm pt-1 mt-1 border-t" style={{ borderColor: "#D8CFB8" }}>
              <span className="font-bold">Net Amount Paid:</span>
              <span className="font-bold text-[#3F6B52] text-lg" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(payment.netPaid)}</span>
            </div>
            <div className="flex justify-between text-[#6E6650]"><span>Payment Mode:</span><strong className="text-[#12312B]">{payment.mode || "Cash"}</strong></div>
          </div>
        </div>
        <div className="sign-row" style={{ display: "flex", justifyContent: "space-between", marginTop: "32px" }}>
          <div className="sign-line" style={{ borderTop: "1px solid #12312B", width: "45%", textAlign: "center", paddingTop: "4px", fontSize: "11px" }}>Employee Signature</div>
          <div className="sign-line" style={{ borderTop: "1px solid #12312B", width: "45%", textAlign: "center", paddingTop: "4px", fontSize: "11px" }}>Authorized Signatory</div>
        </div>
        <div className="text-center pt-3 mt-3 border-t border-dashed border-[#12312B] text-[10px] text-[#9C8F6E]">
          Computer Generated Salary Slip
        </div>
      </div>
      <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]"><Printer size={15} /> Print Salary Slip</button>
    </Modal>
  );
}

function AdvanceTab({ advances, advanceReturns, persons, onAdd, onReturn, onRemove, onRemoveReturn, onStatement }) {
  const sorted = useMemo(() => [...advances].sort((a, b) => compareChrono(a, b, -1)), [advances]);
  // Advance Returns history — same sort convention as the Advances table
  // above. See UPDATE NOTES entry for the "Return Advance" feature.
  const sortedReturns = useMemo(() => [...(advanceReturns || [])].sort((a, b) => compareChrono(a, b, -1)), [advanceReturns]);
  return (
    <div>
      <SectionHeader eyebrow="Payroll" title="Advance" action={
        <div className="flex gap-2">
          <button onClick={onReturn} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
            <Undo2 size={15} /> Return Advance
          </button>
          <button onClick={onAdd} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
            <Plus size={15} /> Give Advance
          </button>
        </div>
      } />
      <Card className="mb-6">
        {sorted.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">No advances recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Date", "Person", "Amount Given", "Settled", "Outstanding", "Mode", "Status", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(a => {
                const settled = round2((Number(a.amount) || 0) - (Number(a.outstandingAmount) || 0));
                const isSettled = (a.status || "open") === "settled";
                return (
                  <tr key={a.id} className="ledger-row">
                    <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{fmtDate(a.date)}</td>
                    <td className="px-4 py-2.5 font-medium">
                      {onStatement ? (
                        <button onClick={() => onStatement(a.personId, a.personType)} className="underline hover:text-[#3F6B52]">{a.personName}</button>
                      ) : a.personName}
                      <div className="text-[10px] text-[#9C8F6E]">{a.personRole}{a.personType === "teacher" ? " · Teacher" : " · Staff"} · {a.advanceId}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono">{fmtINR(a.amount)}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-[#3F6B52]">{fmtINR(settled)}</td>
                    <td className="px-4 py-2.5 text-xs font-mono font-semibold text-[#A63D2F]">{fmtINR(a.outstandingAmount)}</td>
                    <td className="px-4 py-2.5 text-xs">{a.mode || "Cash"}</td>
                    <td className="px-4 py-2.5 text-xs"><Stamp text={isSettled ? "Settled" : "Open"} tone={isSettled ? "paid" : "overdue"} /></td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => onRemove(a.id)} className="text-xs text-[#A63D2F] underline">Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Advance Returns history — direct cash-back records, separate from
          the settlements made via Salary deductions above. See UPDATE
          NOTES entry for the "Return Advance" feature. */}
      <div className="mb-3" style={{ fontFamily: "'Zilla Slab', serif" }}><span className="text-lg font-semibold">Advance Returns</span></div>
      <Card>
        {sortedReturns.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">No advance returns recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["Date", "Person", "Amount Returned", "Mode", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedReturns.map(r => (
                <tr key={r.id} className="ledger-row">
                  <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{fmtDate(r.date)}</td>
                  <td className="px-4 py-2.5 font-medium">
                    {onStatement ? (
                      <button onClick={() => onStatement(r.personId, r.personType)} className="underline hover:text-[#3F6B52]">{r.personName}</button>
                    ) : r.personName}
                    <div className="text-[10px] text-[#9C8F6E]">{r.personRole}{r.personType === "teacher" ? " · Teacher" : " · Staff"} · {r.returnId}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono text-[#3F6B52]">{fmtINR(r.amount)}</td>
                  <td className="px-4 py-2.5 text-xs">{r.mode || "Cash"}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => onRemoveReturn(r.id)} className="text-xs text-[#A63D2F] underline">Remove</button>
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

function AdvanceFormModal({ persons, onClose, onSave }) {
  const [personKey, setPersonKey] = useState(persons[0] ? `${persons[0].personType}:${persons[0].personId}` : "");
  const selected = persons.find(p => `${p.personType}:${p.personId}` === personKey);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [mode, setMode] = useState("Cash");
  const [remarks, setRemarks] = useState("");

  function submit() {
    if (!selected || !(Number(amount) > 0)) return;
    onSave({
      personId: selected.personId, personType: selected.personType, personName: selected.name, personRole: selected.role,
      amount: Number(amount) || 0, date, mode, remarks: remarks.trim(),
    });
  }

  return (
    <Modal title="Give Advance" onClose={onClose}>
      <Field label="Select Teacher / Staff Member">
        <PersonPicker persons={persons} value={personKey} onChange={setPersonKey} />
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
      <Field label="Reason / Remarks (optional)"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g. Personal emergency" /></Field>
      <button onClick={submit} className="w-full mt-2 py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Give Advance
      </button>
    </Modal>
  );
}

// Records a teacher/staff member directly returning advance money (e.g.
// handing back cash) outside of a salary run — styled/structured like
// AdvanceFormModal/SalaryFormModal. Shows the person's current outstanding
// advance total once picked, same pattern as SalaryFormModal's
// outstandingAdvance preview (sourced from the same shared
// openAdvancesFor() helper, so the two can never disagree).
function AdvanceReturnFormModal({ persons, advances, onClose, onSave }) {
  const [personKey, setPersonKey] = useState(persons[0] ? `${persons[0].personType}:${persons[0].personId}` : "");
  const selected = persons.find(p => `${p.personType}:${p.personId}` === personKey);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [mode, setMode] = useState("Cash");
  const [remarks, setRemarks] = useState("");

  const outstandingAdvance = useMemo(() => {
    if (!selected) return 0;
    return round2(openAdvancesFor(advances, selected.personId, selected.personType)
      .reduce((sum, a) => sum + (Number(a.outstandingAmount) || 0), 0));
  }, [advances, selected]);

  function submit() {
    if (!selected || !(Number(amount) > 0)) return;
    onSave({
      personId: selected.personId, personType: selected.personType, personName: selected.name, personRole: selected.role,
      amount: Number(amount) || 0, date, mode, remarks: remarks.trim(),
    });
  }

  return (
    <Modal title="Return Advance" onClose={onClose}>
      <Field label="Select Teacher / Staff Member">
        <PersonPicker persons={persons} value={personKey} onChange={setPersonKey} />
      </Field>
      {selected && (
        <div className="text-xs text-[#6E6650] mb-3 flex justify-between">
          <span>Current Outstanding Advance:</span>
          <strong className={outstandingAdvance > 0 ? "text-[#A63D2F]" : "text-[#3F6B52]"}>{fmtINR(outstandingAdvance)}</strong>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount Returned (₹)"><input type="number" className={inputCls} style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" max={outstandingAdvance || undefined} /></Field>
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
      <Field label="Remarks (optional)"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any note for this return" /></Field>
      <button onClick={submit} className="w-full mt-2 py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Record Advance Return
      </button>
    </Modal>
  );
}

// ---- Infrastructure Management — campus rooms/areas registry (Institute
// Management → Infrastructure Management, right after Advance). Category
// list exactly as specified: academic spaces, admin offices, common areas,
// and campus-wide facilities (Parking, Sports Ground, Main Entry Gate) all
// in one registry, same search/filter/numbering pattern as Batch Schedule.
const INFRASTRUCTURE_CATEGORIES = [
  "Class Room", "Laboratories", "Lecture Hall", "Workshops & Studios", "Library",
  "Auditorium", "Exam Halls", "Principal / Director / Registrar Office", "Accounts",
  "Registrar", "Faculty & Staff Rooms", "Conference Rooms", "Indoor Sports Room",
  "Gymnasium", "Cafeteria", "Server & IT Room", "Storage", "Computer Center",
  "Parking", "Sports Ground", "Main Entry Gate", "Other",
];

function InfrastructureTab({ infrastructure, onAdd, onEdit, onRemove }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (infrastructure || [])
      .filter(r => categoryFilter === "all" || r.category === categoryFilter)
      .filter(r => {
        if (!q) return true;
        const haystack = [r.name, r.category, r.location, r.remarks].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(q);
      });
  }, [infrastructure, search, categoryFilter]);
  const isFiltered = search || categoryFilter !== "all";

  // Categories actually in use, so the filter dropdown isn't 22 options
  // deep when only a handful are ever used at a given institute.
  const categoriesInUse = useMemo(() => Array.from(new Set((infrastructure || []).map(r => r.category))).filter(Boolean).sort(), [infrastructure]);

  return (
    <div>
      <SectionHeader eyebrow="Campus" title="Infrastructure Management" action={
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Plus size={15} /> Add Room / Area
        </button>
      } />
      <div className="text-sm text-[#6E6650] mb-4">Every classroom, lab, office, and campus facility — with capacity, location, and remarks — in one registry. Batch Schedule's Room Number is free text today; keeping names consistent here makes it easy to cross-check which room a batch is actually in.</div>

      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Search</div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" />
              <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, category, location, or remarks..." />
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Category</div>
            <select className={inputCls} style={inputStyle} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="all">All Categories</option>
              {categoriesInUse.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {isFiltered && (
            <button onClick={() => { setSearch(""); setCategoryFilter("all"); }} className="text-xs text-[#A63D2F] underline pb-2.5">Clear filters</button>
          )}
        </div>
      </Card>

      {(infrastructure || []).length > 0 && (
        <div className="text-xs text-[#6E6650] mb-3">Showing {filtered.length} of {infrastructure.length} entr{infrastructure.length === 1 ? "y" : "ies"}</div>
      )}

      <Card>
        {(infrastructure || []).length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">No rooms or areas registered yet.</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9C8F6E]">No entries match these filters.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                {["#", "Name", "Category", "Capacity", "Location", "Remarks", "Actions"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} className="ledger-row">
                  <td className="px-4 py-2.5 text-xs font-mono text-[#9C8F6E]">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium">{r.name}</td>
                  <td className="px-4 py-2.5 text-xs">{r.category}</td>
                  <td className="px-4 py-2.5 text-xs font-mono">{r.capacity || "—"}</td>
                  <td className="px-4 py-2.5 text-xs">{r.location || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-[#6E6650]">{r.remarks || "—"}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => onEdit(r)} className="text-xs text-[#12312B] underline mr-3">Edit</button>
                    <button onClick={() => onRemove(r.id)} className="text-xs text-[#A63D2F] underline">Delete</button>
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

function InfrastructureFormModal({ initial, onClose, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [category, setCategory] = useState(initial?.category || INFRASTRUCTURE_CATEGORIES[0]);
  const [capacity, setCapacity] = useState(initial?.capacity || "");
  const [location, setLocation] = useState(initial?.location || "");
  const [remarks, setRemarks] = useState(initial?.remarks || "");
  // Extra guard against double-submission (e.g. a fast double-click before
  // the modal visually closes) on top of saveInfrastructure now correctly
  // closing the modal after saving — belt and suspenders.
  const [submitting, setSubmitting] = useState(false);

  function submit() {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    onSave({ ...initial, id: initial?.id, name: name.trim(), category, capacity: capacity.trim(), location: location.trim(), remarks: remarks.trim() });
  }

  return (
    <Modal title={initial ? "Edit Room / Area" : "Add Room / Area"} onClose={onClose}>
      <Field label="Name"><input className={inputCls} style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Room 204, Physics Lab, Main Gate" /></Field>
      <Field label="Category">
        <select className={inputCls} style={inputStyle} value={category} onChange={e => setCategory(e.target.value)}>
          {INFRASTRUCTURE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Capacity (optional)"><input className={inputCls} style={inputStyle} value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="e.g. 40 students" /></Field>
        <Field label="Floor / Location (optional)"><input className={inputCls} style={inputStyle} value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. 2nd Floor, East Wing" /></Field>
      </div>
      <Field label="Remarks (optional)"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any additional notes" /></Field>
      <button onClick={submit} disabled={submitting} className="w-full mt-2 py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE", opacity: submitting ? 0.6 : 1 }}>
        {submitting ? "Saving…" : (initial ? "Save Changes" : "Add to Registry")}
      </button>
    </Modal>
  );
}

// Per-person Statement — combined chronological (compareChrono) history of
// every salary payment and every advance given/settled for one teacher or
// staff member, with a running Advance Outstanding total. Modeled directly
// on StudentStatementModal. Reachable from Salary/Advance history rows and
// from the "Statement" action on the Teachers/Staff registers.
function PersonStatementModal({ person, personType, salaryPayments, advances, advanceReturns, onClose, onViewSlip }) {
  if (!person) return null;

  const timeline = useMemo(() => {
    const salaryLines = (salaryPayments || []).map(p => ({
      kind: "salary", date: p.date, createdAt: p.createdAt,
      label: `Salary Paid — ${monthLabel(p.month)}`, amount: p.netPaid, ref: p.slipId, raw: p,
    }));
    const advanceGivenLines = (advances || []).map(a => ({
      kind: "advance_given", date: a.date, createdAt: a.createdAt,
      label: "Advance Given", amount: a.amount, ref: a.advanceId, raw: a,
    }));
    // One settlement line per salary payment that deducted against an
    // advance, so the running outstanding total moves down at the same
    // point in time the deduction actually happened.
    const settlementLines = (salaryPayments || []).flatMap(p =>
      (p.settledAdvances || []).map(s => ({
        kind: "advance_settled", date: p.date, createdAt: p.createdAt,
        label: `Advance Settled (${s.advanceRefId || ""}) via Salary ${p.slipId}`, amount: s.amount, ref: p.slipId, raw: p,
      }))
    );
    // One line per advance actually settled by a direct "Return Advance"
    // record — same breakdown pattern as settlementLines above, and the
    // same reduction to runningOutstanding, just via a return instead of a
    // salary deduction. See the new UPDATE NOTES entry for the "Return
    // Advance" feature.
    const returnLines = (advanceReturns || []).flatMap(r =>
      (r.settledAdvances || []).map(s => ({
        kind: "advance_returned", date: r.date, createdAt: r.createdAt,
        label: `Advance Returned (${s.advanceRefId || ""}) — ${r.returnId}`, amount: s.amount, ref: r.returnId, raw: r,
      }))
    );
    const merged = [...salaryLines, ...advanceGivenLines, ...settlementLines, ...returnLines].sort((a, b) => compareChrono(a, b, 1));
    let runningOutstanding = 0;
    return merged.map(l => {
      if (l.kind === "advance_given") runningOutstanding = round2(runningOutstanding + l.amount);
      if (l.kind === "advance_settled" || l.kind === "advance_returned") runningOutstanding = round2(runningOutstanding - l.amount);
      return { ...l, runningOutstanding };
    }).sort((a, b) => compareChrono(a, b, -1));
  }, [salaryPayments, advances, advanceReturns]);

  const totalSalaryPaid = round2((salaryPayments || []).reduce((sum, p) => sum + (Number(p.netPaid) || 0), 0));
  const totalAdvanceGiven = round2((advances || []).reduce((sum, a) => sum + (Number(a.amount) || 0), 0));
  const totalAdvanceOutstanding = round2((advances || []).filter(a => (a.status || "open") === "open").reduce((sum, a) => sum + (Number(a.outstandingAmount) || 0), 0));

  return (
    <WideModal title={`Statement — ${person.name}${personType === "teacher" ? " (Teacher)" : " (Staff)"}`} onClose={onClose}>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-2.5 rounded bg-[#EAF1EA] border" style={{ borderColor: "#3F6B52" }}>
          <div className="text-[10px] uppercase text-[#3F6B52] font-mono">Total Salary Paid</div>
          <div className="text-lg font-bold text-[#3F6B52]" style={{ fontFamily: "'Zilla Slab', serif" }}>{fmtINR(totalSalaryPaid)}</div>
        </div>
        <div className="p-2.5 rounded bg-[#FAF6EC] border" style={{ borderColor: "#D8CFB8" }}>
          <div className="text-[10px] uppercase text-[#9C8F6E] font-mono">Total Advance Given</div>
          <div className="text-lg font-bold" style={{ fontFamily: "'Zilla Slab', serif" }}>{fmtINR(totalAdvanceGiven)}</div>
        </div>
        <div className="p-2.5 rounded bg-[#F7E7E3] border" style={{ borderColor: "#A63D2F" }}>
          <div className="text-[10px] uppercase text-[#A63D2F] font-mono">Advance Outstanding</div>
          <div className="text-lg font-bold text-[#A63D2F]" style={{ fontFamily: "'Zilla Slab', serif" }}>{fmtINR(totalAdvanceOutstanding)}</div>
        </div>
      </div>

      {timeline.length === 0 ? (
        <div className="p-8 text-center text-sm text-[#9C8F6E]">No salary payments or advances recorded yet for this person.</div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "1.5px solid #26231D" }}>
              {["Date", "Reference", "Description", "Amount", "Advance Outstanding"].map(h => (
                <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-3 py-2 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeline.map((l, i) => (
              <tr key={i} className="ledger-row">
                <td className="px-3 py-2 font-mono whitespace-nowrap">{fmtDate(l.date)}</td>
                <td className="px-3 py-2 font-mono">
                  {l.kind === "salary" && onViewSlip ? (
                    <button onClick={() => onViewSlip(l.raw)} className="underline text-[#12312B] hover:text-[#3F6B52]">{l.ref}</button>
                  ) : (l.ref || "—")}
                </td>
                <td className="px-3 py-2">{l.label}</td>
                <td className={"px-3 py-2 font-mono " + (l.kind === "advance_given" ? "text-[#A63D2F]" : "text-[#3F6B52]")}>{fmtINR(l.amount)}</td>
                <td className="px-3 py-2 font-mono font-semibold">{fmtINR(l.runningOutstanding)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </WideModal>
  );
}

// ============================================================================
// ATTENDANCE (batch-wise) — MarkAttendanceTab / TestMarksTab. These used to
// live under their own standalone "Attendance" sidebar tab
// (AttendanceMgmtTab / ATTENDANCE_MGMT_SUB_TABS, see UPDATE NOTES #23);
// that wrapper tab has been removed and these two components are now
// rendered directly as sub-tabs inside AcademicMonitoringTab instead — see
// the new UPDATE NOTES entry. Not to be confused with the older per-student
// Attendance sub-tab that used to live inside Academic Monitoring, which
// these have now replaced there.
// ============================================================================
function MarkAttendanceTab({ classes, subjectsList, batchSchedule, students, attendanceLog, batchesForMonth, onSave }) {
  const [date, setDate] = useState(todayStr());
  const [cls, setCls] = useState("");
  const [subject, setSubject] = useState("");
  const [userOverrode, setUserOverrode] = useState(false);
  const [statuses, setStatuses] = useState({}); // studentId -> "Present" | "Absent"
  const [remarks, setRemarks] = useState("");
  const [saved, setSaved] = useState(false);

  // Autofill — only for today's date, only if exactly one Batch Schedule
  // window matches right now, and only until the user manually overrides
  // Class/Subject themselves.
  useEffect(() => {
    if (date !== todayStr() || userOverrode) return;
    const match = findAutofillBatch(batchSchedule);
    if (match) { setCls(match.class); setSubject(match.subject); }
  }, [date, batchSchedule, userOverrode]);

  const matchedBatch = useMemo(() => batchSchedule.find(b => b.class === cls && b.subject === subject), [batchSchedule, cls, subject]);
  const roster = useMemo(() => matchedBatch ? studentsActiveInBatch(students, matchedBatch, date, batchesForMonth) : [], [matchedBatch, students, date, batchesForMonth]);

  const docKey = `${date}_${cls}_${subject}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  const existingDoc = attendanceLog.find(a => a.id === docKey);

  useEffect(() => {
    setSaved(false);
    setRemarks(existingDoc?.remarks || "");
    if (!roster.length) { setStatuses({}); return; }
    const map = {};
    roster.forEach(s => {
      const existingRecord = existingDoc?.records?.find(r => r.studentId === s.id);
      map[s.id] = existingRecord ? existingRecord.status : "Absent"; // defaults to Absent
    });
    setStatuses(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey, roster.length]);

  function toggle(studentId) {
    setStatuses(prev => ({ ...prev, [studentId]: prev[studentId] === "Present" ? "Absent" : "Present" }));
  }

  function handleSave() {
    const records = roster.map(s => ({ studentId: s.id, status: statuses[s.id] || "Absent" }));
    // Time is captured once, at the moment attendance is first saved for
    // this session — re-saving (e.g. after fixing a status) keeps the
    // originally recorded time (see saveAttendanceLog); it's only ever
    // changed afterward through View Attendance's dedicated Edit.
    onSave(date, cls, subject, matchedBatch?.id || null, records, existingDoc?.time || nowTimeStr(), remarks);
    setSaved(true);
  }

  return (
    <div>
      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Date</div>
            <input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => { setDate(e.target.value); setUserOverrode(false); }} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Class</div>
            <select className={inputCls} style={inputStyle} value={cls} onChange={e => { setCls(e.target.value); setUserOverrode(true); }}>
              <option value="">— Select —</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Subject</div>
            <select className={inputCls} style={inputStyle} value={subject} onChange={e => { setSubject(e.target.value); setUserOverrode(true); }}>
              <option value="">— Select —</option>
              {subjectsList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {cls && subject && (
            <div className="min-w-[200px] flex-1">
              <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Remarks (optional)</div>
              <input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g. Half-day, exam prep session…" />
            </div>
          )}
        </div>
        {date === todayStr() && matchedBatch && !userOverrode && (
          <div className="text-[10px] text-[#3F6B52] mt-2 font-medium">Auto-filled from Batch Schedule: {matchedBatch.batchName}</div>
        )}
      </Card>

      {cls && subject && (
        <Card>
          {!matchedBatch ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No Batch Schedule entry found for Class {cls} · {subject}. Add one under Teacher Management → Batch Schedule.</div>
          ) : roster.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No students enrolled in this batch for {fmtDate(date)}.</div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                    {["Student Name", "Student ID", "Status"].map(h => (
                      <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roster.map(s => {
                    const present = statuses[s.id] === "Present";
                    return (
                      <tr key={s.id} className="ledger-row">
                        <td className="px-4 py-2.5 font-medium">{s.name}</td>
                        <td className="px-4 py-2.5 text-xs font-mono">{s.studentId}</td>
                        <td className="px-4 py-2.5">
                          <button onClick={() => toggle(s.id)} className="px-3 py-1 text-xs font-semibold rounded-sm"
                            style={{ background: present ? "#3F6B52" : "#A63D2F", color: "#F4EFDE" }}>
                            {present ? "Present" : "Absent"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="p-3.5 flex items-center justify-between">
                <div className="text-[11px] text-[#9C8F6E]">
                  {saved ? "Saved." : existingDoc ? "Editing a previously saved record." : "Not yet saved."}
                  {existingDoc?.time && <span> · Recorded at {fmtTime(existingDoc.time)}</span>}
                </div>
                <button onClick={handleSave} className="px-4 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>Save Attendance</button>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

function TestMarksTab({ classes, subjectsList, batchSchedule, students, tests, batchesForMonth, onSave }) {
  const [cls, setCls] = useState("");
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState(todayStr());
  const [maxMarks, setMaxMarks] = useState("");
  const [description, setDescription] = useState("");
  const [marks, setMarks] = useState({}); // studentId -> marks
  const [loadedTestId, setLoadedTestId] = useState(null); // set once user picks an existing test to edit
  const [saved, setSaved] = useState(false);

  const testId = useMemo(() => {
    if (!cls || !subject) return "";
    return generateTestId(tests, cls, subject, date, loadedTestId);
  }, [tests, cls, subject, date, loadedTestId]);

  const matchedBatch = useMemo(() => batchSchedule.find(b => b.class === cls && b.subject === subject), [batchSchedule, cls, subject]);
  const roster = useMemo(() => matchedBatch ? studentsActiveInBatch(students, matchedBatch, date, batchesForMonth) : [], [matchedBatch, students, date, batchesForMonth]);

  const existingTestsForCombo = useMemo(() => tests.filter(t => String(t.class) === String(cls) && t.subject === subject), [tests, cls, subject]);

  useEffect(() => {
    setSaved(false);
    setLoadedTestId(null);
    if (!roster.length) { setMarks({}); return; }
    const map = {};
    roster.forEach(s => { map[s.id] = ""; });
    setMarks(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls, subject, roster.length]);

  function loadExistingTest(t) {
    setLoadedTestId(t.testId);
    setDate(t.date);
    setMaxMarks(t.maxMarks);
    setDescription(t.description || "");
    const map = {};
    roster.forEach(s => {
      const sc = (t.scores || []).find(x => x.studentId === s.id);
      map[s.id] = sc ? sc.marks : "";
    });
    setMarks(map);
  }

  function handleSave() {
    const scores = roster.map(s => ({ studentId: s.id, marks: marks[s.id] === "" ? "" : Number(marks[s.id]) }));
    onSave({ testId, class: cls, subject, date, maxMarks: Number(maxMarks) || 0, description, scores });
    setSaved(true);
    setLoadedTestId(testId);
  }

  return (
    <div>
      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Class</div>
            <select className={inputCls} style={inputStyle} value={cls} onChange={e => setCls(e.target.value)}>
              <option value="">— Select —</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Subject</div>
            <select className={inputCls} style={inputStyle} value={subject} onChange={e => setSubject(e.target.value)}>
              <option value="">— Select —</option>
              {subjectsList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Date</div>
            <input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Maximum Marks</div>
            <input type="number" className={inputCls} style={inputStyle} value={maxMarks} onChange={e => setMaxMarks(e.target.value)} placeholder="e.g. 50" />
          </div>
        </div>
        {cls && subject && (
          <div className="flex items-center justify-between mt-3 p-2 rounded bg-[#FAF6EC] border" style={{ borderColor: "#D8CFB8" }}>
            <span className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono">Test ID</span>
            <span className="text-sm font-bold text-[#12312B]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{testId}</span>
          </div>
        )}
        <div className="mt-3"><Field label="Description"><input className={inputCls} style={inputStyle} value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Unit Test 1 — Chapters 1-3" /></Field></div>
        {existingTestsForCombo.length > 0 && (
          <div className="text-[10px] text-[#9C8F6E]">
            Existing tests for this class/subject: {existingTestsForCombo.map(t => (
              <button key={t.testId} onClick={() => loadExistingTest(t)} className="underline text-[#12312B] mr-2">{t.testId} ({fmtDate(t.date)})</button>
            ))}
          </div>
        )}
      </Card>

      {cls && subject && (
        <Card>
          {!matchedBatch ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No Batch Schedule entry found for Class {cls} · {subject}. Add one under Teacher Management → Batch Schedule.</div>
          ) : roster.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#9C8F6E]">No students active in this batch as of {fmtDate(date)}.</div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                    {["Student Name", "Student ID", "Marks"].map(h => (
                      <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roster.map(s => (
                    <tr key={s.id} className="ledger-row">
                      <td className="px-4 py-2.5 font-medium">{s.name}</td>
                      <td className="px-4 py-2.5 text-xs font-mono">{s.studentId}</td>
                      <td className="px-4 py-2.5">
                        <input type="number" className={inputCls + " w-28"} style={inputStyle} value={marks[s.id] ?? ""}
                          onChange={e => setMarks(prev => ({ ...prev, [s.id]: e.target.value }))} placeholder="0" max={maxMarks || undefined} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-3.5 flex items-center justify-between">
                <div className="text-[11px] text-[#9C8F6E]">{saved ? "Saved." : "Not yet saved."}</div>
                <button onClick={handleSave} className="px-4 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>Save Test Marks</button>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

// ---- View Attendance — browse/search previously saved attendanceLog
// sessions (one doc per date+class+subject). Clicking a row only expands a
// READ-ONLY view — nothing is editable there. A separate, dedicated "Edit"
// button opens an editable panel (date, time, remarks, per-student status),
// so a session can't be accidentally modified just by looking at it. Saves
// through editAttendanceLog (handles the date→doc-key move); a dedicated
// "Delete" button removes an accidentally created session outright. ----
function ViewAttendanceTab({ attendanceLog, students, classes, subjectsList, onSave, onEdit, onDelete }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editRemarks, setEditRemarks] = useState("");
  const [editStatuses, setEditStatuses] = useState({});
  const [savedId, setSavedId] = useState(null);

  const studentById = useMemo(() => { const m = {}; students.forEach(s => { m[s.id] = s; }); return m; }, [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return attendanceLog
      .filter(a => classFilter === "all" || a.class === classFilter)
      .filter(a => subjectFilter === "all" || a.subject === subjectFilter)
      .filter(a => !dateFilter || a.date === dateFilter)
      .filter(a => {
        if (!q) return true;
        if (String(a.class).toLowerCase().includes(q) || String(a.subject).toLowerCase().includes(q) || (a.remarks || "").toLowerCase().includes(q)) return true;
        return (a.records || []).some(r => { const s = studentById[r.studentId]; return s && (s.name.toLowerCase().includes(q) || (s.studentId || "").toLowerCase().includes(q)); });
      })
      .sort((a, b) => compareChrono(a, b, -1));
  }, [attendanceLog, classFilter, subjectFilter, dateFilter, search, studentById]);

  function toggleView(a) {
    setExpandedId(prev => (prev === a.id ? null : a.id));
    if (editingId === a.id) setEditingId(null);
  }

  function startEdit(a) {
    setExpandedId(a.id);
    setEditingId(a.id);
    setSavedId(null);
    setEditDate(a.date);
    setEditTime(a.time || nowTimeStr());
    setEditRemarks(a.remarks || "");
    const map = {};
    (a.records || []).forEach(r => { map[r.studentId] = r.status; });
    setEditStatuses(map);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function toggleStatus(studentId) {
    setEditStatuses(prev => ({ ...prev, [studentId]: prev[studentId] === "Present" ? "Absent" : "Present" }));
  }

  function saveEdit(a) {
    const records = (a.records || []).map(r => ({ studentId: r.studentId, status: editStatuses[r.studentId] || "Absent" }));
    onEdit(a, { date: editDate, time: editTime, remarks: editRemarks, records });
    setEditingId(null);
    setExpandedId(editDate === a.date ? a.id : `${editDate}_${a.class}_${a.subject}`.replace(/[^a-zA-Z0-9_-]/g, "-"));
    setSavedId(a.id);
  }

  return (
    <div>
      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Search</div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" />
              <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Class, subject, remarks, or student..." />
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Class</div>
            <select className={inputCls} style={inputStyle} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
              <option value="all">All Classes</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Subject</div>
            <select className={inputCls} style={inputStyle} value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
              <option value="all">All Subjects</option>
              {subjectsList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Date</div>
            <input type="date" className={inputCls} style={inputStyle} value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-[#9C8F6E]">No saved attendance sessions match.</Card>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-[#6E6650]">Showing {filtered.length} of {attendanceLog.length} attendance session{attendanceLog.length === 1 ? "" : "s"}</div>
          {filtered.map((a, i) => {
            const total = (a.records || []).length;
            const present = (a.records || []).filter(r => r.status === "Present").length;
            const expanded = expandedId === a.id;
            const editing = editingId === a.id;
            return (
              <Card key={a.id} className="overflow-hidden">
                <div className="w-full flex items-center justify-between px-4 py-3">
                  <button onClick={() => toggleView(a)} className="flex-1 text-left">
                    <div className="text-sm font-semibold text-[#12312B]">
                      <span className="text-[10px] font-mono text-[#9C8F6E] mr-2">#{i + 1}</span>
                      {a.class} · {a.subject}
                    </div>
                    <div className="text-[11px] text-[#9C8F6E]">
                      {fmtDate(a.date)}{a.time && ` · ${fmtTime(a.time)}`} · {present}/{total} present{a.remarks && ` · ${a.remarks}`}
                    </div>
                  </button>
                  <div className="flex items-center gap-3 shrink-0 pl-3">
                    {savedId === a.id && !editing && <span className="text-[11px] text-[#3F6B52] font-medium">Saved.</span>}
                    <button onClick={() => startEdit(a)} className="text-xs text-[#12312B] underline font-medium">Edit</button>
                    <button onClick={() => onDelete(a.id)} className="text-xs text-[#A63D2F] underline font-medium">Delete</button>
                    <span className="text-xs text-[#9C8F6E]">{expanded ? "▾" : "▸"}</span>
                  </div>
                </div>
                {expanded && !editing && (
                  <div className="border-t" style={{ borderColor: "#D8CFB8" }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                          {["Student Name", "Student ID", "Status"].map(h => (
                            <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(a.records || []).map(r => {
                          const s = studentById[r.studentId];
                          const isPresent = r.status === "Present";
                          return (
                            <tr key={r.studentId} className="ledger-row">
                              <td className="px-4 py-2.5 font-medium">{s ? s.name : "Unknown Student"}</td>
                              <td className="px-4 py-2.5 text-xs font-mono">{s ? s.studentId : "—"}</td>
                              <td className="px-4 py-2.5">
                                <span className="px-3 py-1 text-xs font-semibold rounded-sm inline-block"
                                  style={{ background: isPresent ? "#3F6B52" : "#A63D2F", color: "#F4EFDE" }}>
                                  {r.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="px-4 py-2.5 text-[11px] text-[#9C8F6E]">Read-only — click Edit above to make changes.</div>
                  </div>
                )}
                {editing && (
                  <div className="border-t" style={{ borderColor: "#D8CFB8" }}>
                    <div className="p-3.5 flex flex-wrap items-end gap-3" style={{ background: "#FAF6EC" }}>
                      <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={editDate} onChange={e => setEditDate(e.target.value)} /></Field>
                      <Field label="Time"><input type="time" className={inputCls} style={inputStyle} value={editTime} onChange={e => setEditTime(e.target.value)} /></Field>
                      <div className="flex-1 min-w-[200px]"><Field label="Remarks"><input className={inputCls} style={inputStyle} value={editRemarks} onChange={e => setEditRemarks(e.target.value)} placeholder="Optional remarks…" /></Field></div>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                          {["Student Name", "Student ID", "Status"].map(h => (
                            <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(a.records || []).map(r => {
                          const s = studentById[r.studentId];
                          const isPresent = editStatuses[r.studentId] === "Present";
                          return (
                            <tr key={r.studentId} className="ledger-row">
                              <td className="px-4 py-2.5 font-medium">{s ? s.name : "Unknown Student"}</td>
                              <td className="px-4 py-2.5 text-xs font-mono">{s ? s.studentId : "—"}</td>
                              <td className="px-4 py-2.5">
                                <button onClick={() => toggleStatus(r.studentId)} className="px-3 py-1 text-xs font-semibold rounded-sm"
                                  style={{ background: isPresent ? "#3F6B52" : "#A63D2F", color: "#F4EFDE" }}>
                                  {isPresent ? "Present" : "Absent"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="p-3.5 flex items-center justify-end gap-2">
                      <button onClick={cancelEdit} className="px-4 py-2 text-sm font-medium rounded-sm border" style={{ borderColor: "#12312B", color: "#12312B" }}>Cancel</button>
                      <button onClick={() => saveEdit(a)} className="px-4 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>Save Changes</button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- View & Search Scores — browse saved tests (the "tests" collection
// TestMarksTab writes to) with search across test ID / description / class /
// subject / student, plus class/subject/date filters, and a "Top Scorers"
// sort. Clicking a row only expands a READ-ONLY view. A separate, dedicated
// "Edit" button opens an editable panel (class, subject, date, max marks,
// description, and every student's marks) so a test can't be accidentally
// modified just by looking at it. Saves through editTest (renames the
// generated testId in place if class/subject/date changed, without leaving
// a duplicate); a dedicated "Delete" button removes an accidentally created
// test outright.
function ViewScoresTab({ tests, students, classes, subjectsList, onSave, onEdit, onDelete }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editMarks, setEditMarks] = useState({});
  const [editMeta, setEditMeta] = useState({ cls: "", subject: "", date: "", maxMarks: "", description: "" });
  const [sortTop, setSortTop] = useState(false);
  const [savedId, setSavedId] = useState(null);

  const studentById = useMemo(() => { const m = {}; students.forEach(s => { m[s.id] = s; }); return m; }, [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tests
      .filter(t => classFilter === "all" || String(t.class) === classFilter)
      .filter(t => subjectFilter === "all" || t.subject === subjectFilter)
      .filter(t => !dateFilter || t.date === dateFilter)
      .filter(t => {
        if (!q) return true;
        if ((t.testId || "").toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q) ||
          String(t.class).toLowerCase().includes(q) || (t.subject || "").toLowerCase().includes(q)) return true;
        return (t.scores || []).some(sc => { const s = studentById[sc.studentId]; return s && (s.name.toLowerCase().includes(q) || (s.studentId || "").toLowerCase().includes(q)); });
      })
      .sort((a, b) => compareChrono(a, b, -1));
  }, [tests, classFilter, subjectFilter, dateFilter, search, studentById]);

  function toggleView(t) {
    setExpandedId(prev => (prev === t.id ? null : t.id));
    setSortTop(false);
    if (editingId === t.id) setEditingId(null);
  }

  function startEdit(t) {
    setExpandedId(t.id);
    setEditingId(t.id);
    setSavedId(null);
    setSortTop(false);
    const map = {};
    (t.scores || []).forEach(sc => { map[sc.studentId] = sc.marks === "" || sc.marks == null ? "" : sc.marks; });
    setEditMarks(map);
    setEditMeta({ cls: t.class, subject: t.subject, date: t.date, maxMarks: t.maxMarks ?? "", description: t.description || "" });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function orderedScores(t) {
    const list = [...(t.scores || [])];
    if (!sortTop) return list;
    const marksFor = editingId === t.id ? editMarks : Object.fromEntries((t.scores || []).map(sc => [sc.studentId, sc.marks]));
    return list.sort((a, b) => (Number(marksFor[b.studentId]) || 0) - (Number(marksFor[a.studentId]) || 0));
  }

  function saveEdit(t) {
    const scores = (t.scores || []).map(sc => ({ studentId: sc.studentId, marks: editMarks[sc.studentId] === "" ? "" : Number(editMarks[sc.studentId]) }));
    onEdit(t, { cls: editMeta.cls, subject: editMeta.subject, date: editMeta.date, maxMarks: editMeta.maxMarks, description: editMeta.description, scores });
    setEditingId(null);
    setSavedId(t.id);
  }

  return (
    <div>
      <Card className="p-3.5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Search</div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9C8F6E]" />
              <input className={inputCls + " pl-7"} style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Test ID, description, class, subject, or student..." />
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Class</div>
            <select className={inputCls} style={inputStyle} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
              <option value="all">All Classes</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Subject</div>
            <select className={inputCls} style={inputStyle} value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
              <option value="all">All Subjects</option>
              {subjectsList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono mb-1">Date</div>
            <input type="date" className={inputCls} style={inputStyle} value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-[#9C8F6E]">No saved tests match.</Card>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-[#6E6650]">Showing {filtered.length} of {tests.length} test{tests.length === 1 ? "" : "s"}</div>
          {filtered.map((t, i) => {
            const count = (t.scores || []).length;
            const avg = count ? round2((t.scores || []).reduce((sum, sc) => sum + (Number(sc.marks) || 0), 0) / count) : 0;
            const expanded = expandedId === t.id;
            const editing = editingId === t.id;
            return (
              <Card key={t.id} className="overflow-hidden">
                <div className="w-full flex items-center justify-between px-4 py-3">
                  <button onClick={() => toggleView(t)} className="flex-1 text-left">
                    <div className="text-sm font-semibold text-[#12312B]">
                      <span className="text-[10px] font-mono text-[#9C8F6E] mr-2">#{i + 1}</span>
                      {t.testId} — {t.class} · {t.subject}
                    </div>
                    <div className="text-[11px] text-[#9C8F6E]">{fmtDate(t.date)} · {t.description || "No description"} · {count} student{count === 1 ? "" : "s"} appeared · Avg {avg}/{t.maxMarks || 0}</div>
                  </button>
                  <div className="flex items-center gap-3 shrink-0 pl-3">
                    {savedId === t.id && !editing && <span className="text-[11px] text-[#3F6B52] font-medium">Saved.</span>}
                    <button onClick={() => startEdit(t)} className="text-xs text-[#12312B] underline font-medium">Edit</button>
                    <button onClick={() => onDelete(t.id)} className="text-xs text-[#A63D2F] underline font-medium">Delete</button>
                    <span className="text-xs text-[#9C8F6E]">{expanded ? "▾" : "▸"}</span>
                  </div>
                </div>
                {expanded && !editing && (
                  <div className="border-t" style={{ borderColor: "#D8CFB8" }}>
                    <div className="p-3.5 flex justify-end" style={{ background: "#FAF6EC" }}>
                      <button onClick={() => setSortTop(v => !v)} className="px-3 py-2 text-xs font-semibold rounded-sm flex items-center gap-1.5"
                        style={{ background: sortTop ? "#B8862B" : "white", color: sortTop ? "#F4EFDE" : "#12312B", border: "1px solid #12312B" }}>
                        <Award size={13} /> {sortTop ? "Sorted: Top Scorers" : "Sort: Top Scorers"}
                      </button>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                          {["#", "Student Name", "Student ID", "Marks"].map(h => (
                            <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {orderedScores(t).map((sc, i) => {
                          const s = studentById[sc.studentId];
                          return (
                            <tr key={sc.studentId} className="ledger-row">
                              <td className="px-4 py-2.5 text-xs font-mono text-[#9C8F6E]">{i + 1}</td>
                              <td className="px-4 py-2.5 font-medium">{s ? s.name : "Unknown Student"}</td>
                              <td className="px-4 py-2.5 text-xs font-mono">{s ? s.studentId : "—"}</td>
                              <td className="px-4 py-2.5 font-mono">{sc.marks === "" || sc.marks == null ? "—" : sc.marks}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="px-4 py-2.5 text-[11px] text-[#9C8F6E]">Read-only — click Edit above to make changes.</div>
                  </div>
                )}
                {editing && (
                  <div className="border-t" style={{ borderColor: "#D8CFB8" }}>
                    <div className="p-3.5 flex flex-wrap items-end gap-3" style={{ background: "#FAF6EC" }}>
                      <Field label="Class">
                        <select className={inputCls} style={inputStyle} value={editMeta.cls} onChange={e => setEditMeta(prev => ({ ...prev, cls: e.target.value }))}>
                          {classes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </Field>
                      <Field label="Subject">
                        <select className={inputCls} style={inputStyle} value={editMeta.subject} onChange={e => setEditMeta(prev => ({ ...prev, subject: e.target.value }))}>
                          {subjectsList.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </Field>
                      <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={editMeta.date} onChange={e => setEditMeta(prev => ({ ...prev, date: e.target.value }))} /></Field>
                      <Field label="Maximum Marks"><input type="number" className={inputCls + " w-28"} style={inputStyle} value={editMeta.maxMarks} onChange={e => setEditMeta(prev => ({ ...prev, maxMarks: e.target.value }))} /></Field>
                      <div className="flex-1 min-w-[180px]"><Field label="Description"><input className={inputCls} style={inputStyle} value={editMeta.description} onChange={e => setEditMeta(prev => ({ ...prev, description: e.target.value }))} /></Field></div>
                      <button onClick={() => setSortTop(v => !v)} className="px-3 py-2 text-xs font-semibold rounded-sm flex items-center gap-1.5"
                        style={{ background: sortTop ? "#B8862B" : "white", color: sortTop ? "#F4EFDE" : "#12312B", border: "1px solid #12312B" }}>
                        <Award size={13} /> {sortTop ? "Sorted: Top Scorers" : "Sort: Top Scorers"}
                      </button>
                    </div>
                    {(editMeta.cls !== t.class || editMeta.subject !== t.subject || editMeta.date !== t.date) && (
                      <div className="px-3.5 pb-2 text-[11px] text-[#B8862B]">Class/Subject/Date changed — Test ID will be regenerated for the new combination on save.</div>
                    )}
                    <div className="px-3.5 pb-2 text-[11px] text-[#9C8F6E]">{(t.scores || []).length} student{(t.scores || []).length === 1 ? "" : "s"} on this test</div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: "1.5px solid #26231D" }}>
                          {["#", "Student Name", "Student ID", "Marks"].map(h => (
                            <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-4 py-2.5 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {orderedScores(t).map((sc, i) => {
                          const s = studentById[sc.studentId];
                          return (
                            <tr key={sc.studentId} className="ledger-row">
                              <td className="px-4 py-2.5 text-xs font-mono text-[#9C8F6E]">{i + 1}</td>
                              <td className="px-4 py-2.5 font-medium">{s ? s.name : "Unknown Student"}</td>
                              <td className="px-4 py-2.5 text-xs font-mono">{s ? s.studentId : "—"}</td>
                              <td className="px-4 py-2.5">
                                <input type="number" className={inputCls + " w-28"} style={inputStyle} value={editMarks[sc.studentId] ?? ""}
                                  onChange={e => setEditMarks(prev => ({ ...prev, [sc.studentId]: e.target.value }))} placeholder="0" max={editMeta.maxMarks || undefined} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="p-3.5 flex items-center justify-end gap-2">
                      <button onClick={cancelEdit} className="px-4 py-2 text-sm font-medium rounded-sm border" style={{ borderColor: "#12312B", color: "#12312B" }}>Cancel</button>
                      <button onClick={() => saveEdit(t)} className="px-4 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>Save Changes</button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
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

function StudentFormModal({ classes, subjectsList, streams, initial, onClose, onSave, students }) {
  const streamList = streams || STREAMS;
  const [name, setName] = useState(initial?.name || "");
  const [cls, setCls] = useState(initial?.class || classes[0] || "10");
  const [gender, setGender] = useState(initial?.gender || "");
  const [stream, setStream] = useState(initial?.stream || "");
  const [batches, setBatches] = useState(initial?.batches || []);
  const [phone, setPhone] = useState(initial?.phone || "");
  const [fatherName, setFatherName] = useState(initial?.fatherName || "");
  const [guardianPhone, setGuardianPhone] = useState(initial?.guardianPhone || "");
  const [address, setAddress] = useState(initial?.address || "");
  const [dob, setDob] = useState(initial?.dob || "");
  const [currentSchool, setCurrentSchool] = useState(initial?.currentSchool || "");
  const [aadharNumber, setAadharNumber] = useState(initial?.aadharNumber || "");
  const [admissionMonth, setAdmissionMonth] = useState(initial?.admissionMonth || currentMonthKey());
  // Joining Date — visibly defaults to TODAY'S date the moment the form
  // opens (for a new student), so office staff see it pre-filled instead
  // of blank. It stays editable — pick a different date to backdate a
  // student — and whatever's in the field at save time is what's stored.
  const [joiningDate, setJoiningDate] = useState(initial?.joiningDate || todayStr());
  const [monthlyDiscount, setMonthlyDiscount] = useState(initial?.monthlyDiscount || 0);
  const [previousDues, setPreviousDues] = useState(initial?.previousDues || 0);
  const [status] = useState(initial?.status || "active");

  // Student ID — shown read-only on the form. For an existing student it's
  // whatever was already assigned (never changes). For a new student it's
  // computed here purely for display, using the same rule saveStudent()
  // uses, so what the user sees on the form is exactly what gets saved.
  const displayStudentId = initial?.studentId || useMemo(() => generateStudentId(students), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Duplicate Aadhar detector — checks the live student list as the user
  // types and flags an existing match with a pop-up. It never blocks
  // saving; it just surfaces the possible duplicate so a human can decide
  // whether to continue (e.g. genuine case) or fix the number.
  const [dupStudent, setDupStudent] = useState(null);
  const [dismissedDupId, setDismissedDupId] = useState(null);
  useEffect(() => {
    const digits = aadharNumber.replace(/\D/g, "");
    if (digits.length < 4) { setDupStudent(null); return; }
    const match = (students || []).find(s => s.id !== initial?.id && (s.aadharNumber || "").replace(/\D/g, "") === digits);
    setDupStudent(match || null);
  }, [aadharNumber, students, initial]);
  const showDupPopup = !!dupStudent && dupStudent.id !== dismissedDupId;

  // Advance Payment — a one-time transaction captured right on the
  // registration/edit form. It is never stored as a field on the student
  // record itself; on save the parent hands it off to become a real
  // Deposit (so it counts toward the student's balance the same as any
  // other payment), and a Receipt is generated right after the student
  // is saved successfully.
  const [advancePayment, setAdvancePayment] = useState("");
  const [advancePaymentMode, setAdvancePaymentMode] = useState("Cash");
  const [advancePaymentRef, setAdvancePaymentRef] = useState("");

  function toggleSubject(sub) {
    setBatches(prev => prev.includes(sub) ? prev.filter(x => x !== sub) : (prev.length >= 6 ? prev : [...prev, sub]));
  }

  function submit() {
    if (!name.trim()) return;
    const baseHistory = initial?.batchHistory && initial.batchHistory.length ? [...initial.batchHistory] : [{ fromMonth: admissionMonth, batches }];
    if (initial?.batchHistory && initial.batchHistory.length) baseHistory[0] = { ...baseHistory[0], batches };
    onSave({
      ...initial, id: initial?.id, studentId: initial?.studentId || displayStudentId,
      name: name.trim(), class: cls, gender, stream, batches, batchHistory: baseHistory,
      phone: phone.trim(), fatherName: fatherName.trim(), guardianPhone: guardianPhone.trim(), address: address.trim(),
      dob: dob || "", currentSchool: currentSchool.trim(), aadharNumber: aadharNumber.trim(),
      admissionMonth, monthlyDiscount: Number(monthlyDiscount) || 0,
      // Joining Date — whatever was manually entered; if left blank, auto-
      // fills to today's date at save time.
      joiningDate: joiningDate || todayStr(),
      previousDues: Number(previousDues) || 0, status,
      advancePayment: Number(advancePayment) || 0,
      advancePaymentMode,
      advancePaymentRef: advancePaymentRef.trim(),
    });
  }

  return (
    <Modal title={initial ? "Edit Student Details" : "Add New Student"} onClose={onClose}>
      <div className="p-2.5 border rounded-sm mb-3 flex items-center justify-between bg-[#FAF6EC]" style={{ borderColor: "#D8CFB8" }}>
        <span className="text-[10px] uppercase tracking-wider text-[#9C8F6E] font-mono">Student ID</span>
        <span className="text-sm font-bold text-[#12312B]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{displayStudentId}{!initial && " (auto-assigned on save)"}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Full Name"><input className={inputCls} style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rahul Sharma" /></Field>
        <Field label="Father's Name"><input className={inputCls} style={inputStyle} value={fatherName} onChange={e => setFatherName(e.target.value)} placeholder="e.g. Suresh Sharma" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Class">
          <select className={inputCls} style={inputStyle} value={cls} onChange={e => setCls(e.target.value)}>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Gender">
          <select className={inputCls} style={inputStyle} value={gender} onChange={e => setGender(e.target.value)}>
            <option value="">— Select —</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fee Start Month"><input type="month" className={inputCls} style={inputStyle} value={admissionMonth} onChange={e => setAdmissionMonth(e.target.value)} /></Field>
        <Field label="Joining Date">
          <input type="date" className={inputCls} style={inputStyle} value={joiningDate} onChange={e => setJoiningDate(e.target.value)} />
          <div className="text-[10px] text-[#9C8F6E] mt-1">Defaults to today's date — change it to backdate a student.</div>
        </Field>
      </div>
      <Field label="Stream (optional)">
        <select className={inputCls} style={inputStyle} value={stream} onChange={e => setStream(e.target.value)}>
          <option value="">— Not Applicable —</option>
          {streamList.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone / WhatsApp Number"><input className={inputCls} style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit phone number" /></Field>
        <Field label="Guardian Phone Number"><input className={inputCls} style={inputStyle} value={guardianPhone} onChange={e => setGuardianPhone(e.target.value)} placeholder="Alternate contact (optional)" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date of Birth"><input type="date" className={inputCls} style={inputStyle} value={dob} onChange={e => setDob(e.target.value)} /></Field>
        <Field label="Current School / Institution"><input className={inputCls} style={inputStyle} value={currentSchool} onChange={e => setCurrentSchool(e.target.value)} placeholder="e.g. Delhi Public School" /></Field>
      </div>
      <Field label="Aadhar Number">
        <input className={inputCls} style={inputStyle} value={aadharNumber} onChange={e => setAadharNumber(e.target.value)} placeholder="12-digit Aadhar number" maxLength={14} />
        {dupStudent && (
          <div className="text-[10px] text-[#A63D2F] mt-1 font-medium">
            ⚠ Matches existing record: {dupStudent.name}{dupStudent.studentId ? ` (${dupStudent.studentId})` : ""} — {dupStudent.class}{dupStudent.phone ? ` · ${dupStudent.phone}` : ""}
          </div>
        )}
      </Field>
      <Field label="Address"><input className={inputCls} style={inputStyle} value={address} onChange={e => setAddress(e.target.value)} placeholder="House / street / area / city" /></Field>
      <Field label="Monthly Concession / Discount (₹)"><input type="number" className={inputCls} style={inputStyle} value={monthlyDiscount} onChange={e => setMonthlyDiscount(e.target.value)} placeholder="0" /></Field>
      <Field label="Opening Balance / Legacy Carried Dues (₹)">
        <input type="number" className={inputCls} style={inputStyle} value={previousDues} onChange={e => setPreviousDues(e.target.value)} placeholder="0" />
        <div className="text-[10px] text-[#9C8F6E] mt-1">Only for a one-time starting balance (e.g. migrating from a paper register). For anything ongoing, use "Add Charge" instead — it keeps a dated log.</div>
      </Field>

      <div className="p-3 border rounded-sm mb-3 bg-white" style={{ borderColor: "#3F6B52" }}>
        <div className="text-xs font-semibold text-[#3F6B52] mb-2 flex items-center gap-1.5"><Banknote size={13} /> Advance Payment (optional)</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount Received Now (₹)"><input type="number" className={inputCls} style={inputStyle} value={advancePayment} onChange={e => setAdvancePayment(e.target.value)} placeholder="0" /></Field>
          <Field label="Payment Mode">
            <select className={inputCls} style={inputStyle} value={advancePaymentMode} onChange={e => setAdvancePaymentMode(e.target.value)}>
              {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
        </div>
        {(advancePaymentMode === "UPI" || advancePaymentMode === "Bank Transfer") && (
          <Field label="UTR / Reference Number"><input className={inputCls} style={inputStyle} value={advancePaymentRef} onChange={e => setAdvancePaymentRef(e.target.value)} placeholder="e.g. 402913827461" /></Field>
        )}
        {advancePaymentMode === "Cheque" && (
          <Field label="Cheque Number"><input className={inputCls} style={inputStyle} value={advancePaymentRef} onChange={e => setAdvancePaymentRef(e.target.value)} placeholder="e.g. 004521" /></Field>
        )}
        <div className="text-[10px] text-[#9C8F6E]">If an amount is entered here, it's recorded as a Deposit against this student's balance, and a printable Receipt opens right after you save.</div>
      </div>

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

      {showDupPopup && (
        <Modal title="⚠ Possible Duplicate Registration" onClose={() => setDismissedDupId(dupStudent.id)}>
          <div className="text-sm mb-3 text-[#4A4636]">This Aadhar Number is already registered against an existing student:</div>
          <div className="p-3 rounded-sm border bg-[#FAF6EC] text-sm mb-4 space-y-0.5" style={{ borderColor: "#D8CFB8" }}>
            <div className="font-semibold text-[#12312B]">{dupStudent.name} {dupStudent.studentId ? <span className="font-mono text-xs text-[#9C8F6E]">({dupStudent.studentId})</span> : null}</div>
            <div className="text-xs text-[#6E6650]">Class {dupStudent.class}{dupStudent.stream ? ` · ${dupStudent.stream}` : ""}</div>
            <div className="text-xs text-[#6E6650]">{dupStudent.phone || "No phone on record"}</div>
            <div className="text-xs text-[#6E6650]">Status: <span className="capitalize">{(dupStudent.status || "active").replace("_", " ")}</span></div>
          </div>
          <div className="text-[11px] text-[#9C8F6E] mb-3">This is just a check — nothing is blocked. Confirm whether this is a genuine new admission (e.g. a sibling sharing a guardian's Aadhar) or a duplicate entry, then decide whether to continue, edit the number, or cancel.</div>
          <button onClick={() => setDismissedDupId(dupStudent.id)} className="w-full py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
            Okay, I'll Review This
          </button>
        </Modal>
      )}
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
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
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
                <span>{h.class}</span>
                <Stamp text={h.resultStatus || "Completed"} tone={h.resultStatus === "Dropped" ? "overdue" : "paid"} />
              </div>
              <div className="text-xs text-[#6E6650] mt-1">Subjects: {(h.batches || []).join(", ") || "General"}</div>
              <div className="text-[11px] text-[#9C8F6E] mt-1 flex justify-between" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                <span>Joined: {monthLabel(h.admissionMonth)}</span>
                <span>Ended: {h.completionDate ? fmtDate(h.completionDate) : "—"}</span>
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
    return charges.filter(c => c.studentId === studentId).sort((a, b) => compareChrono(a, b, -1)).slice(0, 5);
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
            <span className="text-sm flex-1 truncate">{student ? `${student.name} — ${student.class}${student.phone ? " · " + student.phone : ""}` : "Search by name, class, or phone…"}</span>
          </div>
          {pickerOpen && (
            <div className="absolute z-10 mt-1 w-full bg-white border rounded-sm shadow-lg max-h-72 overflow-y-auto" style={{ borderColor: "#D8CFB8" }}>
              <div className="p-2 sticky top-0 bg-white border-b flex gap-2" style={{ borderColor: "#EEE7D2" }}>
                <input autoFocus className={inputCls} style={inputStyle} value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="Type name or phone…" />
                <select className={inputCls} style={{ ...inputStyle, width: "auto" }} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                  <option value="all">All Classes</option>
                  {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {filteredStudents.length === 0 ? (
                <div className="p-3 text-xs text-[#9C8F6E] text-center">No students match.</div>
              ) : (
                filteredStudents.map(s => (
                  <button key={s.id} type="button" onClick={() => { setStudentId(s.id); setPickerOpen(false); setStudentSearch(""); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#F5F0E1] flex items-center justify-between"
                    style={{ background: s.id === studentId ? "#F5F0E1" : "white" }}>
                    <span>{s.name} <span className="text-xs text-[#9C8F6E]">— {s.class}</span></span>
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
                <span className="text-[#6E6650]">{c.chargeId || `CHG-${shortId(c.id)}`} · {fmtDate(c.date)} · {c.remarks || monthLabel(c.month)}</span>
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
// ACADEMIC MONITORING — FORM MODALS. Each reuses the exact same student
// picker (search + class filter, dropdown of matches) as AddChargeModal
// above, so marking attendance, logging a test score, or adding a
// behaviour note all feel consistent with adding a charge. Each modal
// doubles as both "Add" and "Edit" — when `initial` is passed, its id is
// carried through in onSave so the parent's save function knows to update
// the existing record instead of creating a new one (same pattern as
// NoteFormModal / saveNote).
// ============================================================================
function StudentPickerField({ students, studentId, setStudentId }) {
  const [studentSearch, setStudentSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [pickerOpen, setPickerOpen] = useState(false);

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

  return (
    <Field label="Student">
      <div className="relative">
        <div className="flex items-center border rounded-sm bg-white px-3 py-2 cursor-pointer" style={inputStyle} onClick={() => setPickerOpen(o => !o)}>
          <Search size={13} className="text-[#9C8F6E] mr-2 shrink-0" />
          <span className="text-sm flex-1 truncate">{student ? `${student.name} — ${student.class}${student.phone ? " · " + student.phone : ""}` : "Search by name, class, or phone…"}</span>
        </div>
        {pickerOpen && (
          <div className="absolute z-10 mt-1 w-full bg-white border rounded-sm shadow-lg max-h-72 overflow-y-auto" style={{ borderColor: "#D8CFB8" }}>
            <div className="p-2 sticky top-0 bg-white border-b flex gap-2" style={{ borderColor: "#EEE7D2" }}>
              <input autoFocus className={inputCls} style={inputStyle} value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="Type name or phone…" />
              <select className={inputCls} style={{ ...inputStyle, width: "auto" }} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                <option value="all">All Classes</option>
                {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {filteredStudents.length === 0 ? (
              <div className="p-3 text-xs text-[#9C8F6E] text-center">No students match.</div>
            ) : (
              filteredStudents.map(s => (
                <button key={s.id} type="button" onClick={() => { setStudentId(s.id); setPickerOpen(false); setStudentSearch(""); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[#F5F0E1] flex items-center justify-between"
                  style={{ background: s.id === studentId ? "#F5F0E1" : "white" }}>
                  <span>{s.name} <span className="text-xs text-[#9C8F6E]">— {s.class}</span></span>
                  <span className="text-xs text-[#9C8F6E] font-mono">{s.phone || ""}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </Field>
  );
}

function AttendanceFormModal({ students, initial, onClose, onSave }) {
  const [studentId, setStudentId] = useState(initial?.studentId || students[0]?.id || "");
  const [date, setDate] = useState(initial?.date || todayStr());
  const [status, setStatus] = useState(initial?.status || "Present");
  const [remarks, setRemarks] = useState(initial?.remarks || "");

  function submit() {
    if (!studentId || !date) return;
    onSave({ id: initial?.id, studentId, date, status, remarks: remarks.trim() });
  }

  return (
    <Modal title={initial ? "Edit Attendance" : "Mark Attendance"} onClose={onClose}>
      <StudentPickerField students={students} studentId={studentId} setStudentId={setStudentId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Status">
          <select className={inputCls} style={inputStyle} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="Present">Present</option>
            <option value="Absent">Absent</option>
            <option value="Late">Late</option>
          </select>
        </Field>
      </div>
      <Field label="Remarks (optional)"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g. Left early, informed in advance" /></Field>
      <button onClick={submit} disabled={!studentId || !date} className="w-full mt-3 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        {initial ? "Save Changes" : "Mark Attendance"}
      </button>
    </Modal>
  );
}

function TestScoreFormModal({ students, initial, onClose, onSave }) {
  const [studentId, setStudentId] = useState(initial?.studentId || students[0]?.id || "");
  const [testName, setTestName] = useState(initial?.testName || "");
  const [subject, setSubject] = useState(initial?.subject || "");
  const [date, setDate] = useState(initial?.date || todayStr());
  const [marksObtained, setMarksObtained] = useState(initial?.marksObtained ?? "");
  const [maxMarks, setMaxMarks] = useState(initial?.maxMarks ?? "");
  const [remarks, setRemarks] = useState(initial?.remarks || "");

  const canSubmit = studentId && testName.trim() && subject.trim() && date && marksObtained !== "" && maxMarks !== "";

  function submit() {
    if (!canSubmit) return;
    onSave({
      id: initial?.id, studentId, testName: testName.trim(), subject: subject.trim(), date,
      marksObtained: Number(marksObtained), maxMarks: Number(maxMarks), remarks: remarks.trim(),
    });
  }

  return (
    <Modal title={initial ? "Edit Test Score" : "Add Test Score"} onClose={onClose}>
      <StudentPickerField students={students} studentId={studentId} setStudentId={setStudentId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Test / Exam Name"><input className={inputCls} style={inputStyle} value={testName} onChange={e => setTestName(e.target.value)} placeholder="e.g. Unit Test 1" /></Field>
        <Field label="Subject"><input className={inputCls} style={inputStyle} value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Mathematics" /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Marks Obtained"><input type="number" className={inputCls} style={inputStyle} value={marksObtained} onChange={e => setMarksObtained(e.target.value)} placeholder="0" /></Field>
        <Field label="Max Marks"><input type="number" className={inputCls} style={inputStyle} value={maxMarks} onChange={e => setMaxMarks(e.target.value)} placeholder="100" /></Field>
      </div>
      <Field label="Remarks (optional)"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g. Needs more practice in algebra" /></Field>
      <button onClick={submit} disabled={!canSubmit} className="w-full mt-3 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        {initial ? "Save Changes" : "Add Test Score"}
      </button>
    </Modal>
  );
}

function BehaviourFormModal({ students, initial, onClose, onSave }) {
  const [studentId, setStudentId] = useState(initial?.studentId || students[0]?.id || "");
  const [date, setDate] = useState(initial?.date || todayStr());
  const [tag, setTag] = useState(initial?.tag || "neutral");
  const [note, setNote] = useState(initial?.note || "");

  function submit() {
    if (!studentId || !date || !note.trim()) return;
    onSave({ id: initial?.id, studentId, date, tag, note: note.trim() });
  }

  return (
    <Modal title={initial ? "Edit Behaviour Note" : "Add Behaviour Note"} onClose={onClose}>
      <StudentPickerField students={students} studentId={studentId} setStudentId={setStudentId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Tag">
          <select className={inputCls} style={inputStyle} value={tag} onChange={e => setTag(e.target.value)}>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="needs-attention">Needs Attention</option>
          </select>
        </Field>
      </div>
      <Field label="Note — discipline, participation, homework completion, etc.">
        <textarea className={inputCls} style={{ ...inputStyle, minHeight: "80px" }} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Completed homework consistently this week" />
      </Field>
      <button onClick={submit} disabled={!studentId || !date || !note.trim()} className="w-full mt-3 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        {initial ? "Save Changes" : "Add Note"}
      </button>
    </Modal>
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

  const generatedOn = fmtDate(todayStr());

  const handlePrintStatement = () => {
    const printContent = statementRef.current.innerHTML;
    const win = window.open("", "", "width=850,height=900");
    // Loads the same Tailwind utility classes + Google Fonts the live app
    // uses, so the printed page renders exactly like the on-screen preview
    // instead of the plain unstyled text a bare popup window would produce.
    win.document.write(`
      <html>
        <head>
          <title>Account Statement - ${student.name}</title>
          <script src="https://cdn.tailwindcss.com"><\/script>
          <style>
            ${FONT_IMPORT}
            @page { size: A4; margin: 14mm; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { font-family: 'Inter', sans-serif; color: #12312B; background: #fff; margin: 0; }
            .stmt-doc { border: 1.5px solid #B8862B; border-radius: 4px; padding: 22px; }
            .stmt-doc::before { content: ""; display: block; height: 3px; background: #12312B; margin: -22px -22px 18px -22px; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
          </style>
        </head>
        <body>
          <div class="stmt-doc">${printContent}</div>
        </body>
      </html>
    `);
    win.document.close(); win.focus(); setTimeout(() => { win.print(); win.close(); }, 300);
  };

  return (
    <WideModal title={`Statement — ${student.name}${student.studentId ? ` (${student.studentId})` : ""}`} onClose={onClose}>
      <div ref={statementRef}>
        {/* Letterhead — mirrors the official receipt so the statement reads as one professional record system */}
        <div className="text-center pb-3 mb-4 border-b-2 border-dashed border-[#12312B]">
          <InstituteHeader subtitle={`Official Account Statement — All Recorded Transactions`} large={false} />
        </div>

        {/* Student / account details */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-4 text-xs">
          <div className="flex justify-between border-b border-dotted pb-1" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Student Name:</span><strong className="text-[#12312B]">{student.name}</strong></div>
          <div className="flex justify-between border-b border-dotted pb-1" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Student ID:</span><strong className="text-[#12312B]">{student.studentId || "—"}</strong></div>
          <div className="flex justify-between border-b border-dotted pb-1" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Statement Date:</span><strong className="text-[#12312B]">{generatedOn}</strong></div>
          <div className="flex justify-between border-b border-dotted pb-1" style={{ borderColor: "#D8CFB8" }}><span className="text-[#6E6650]">Class:</span><strong className="text-[#12312B]">{student.class}</strong></div>
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
                {["Charge / Receipt No", "Date", "Charges Month", "Description", "Remarks", "Debit", "Credit", "Balance"].map(h => (
                  <th key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }} className="text-left px-3 py-2 uppercase tracking-wider text-[#9C8F6E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.timeline.map((l, i) => (
                <tr key={i} className="ledger-row">
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
                    ) : l.kind === "debit" && onViewCharge && l.chargeId ? (
                      <button onClick={() => onViewCharge(l)} className="text-[#12312B] underline hover:text-[#3F6B52]" title="Open printable receipt">{l.chargeId}</button>
                    ) : (
                      <span className="text-[#9C8F6E]">{l.chargeId || "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{fmtDate(l.date)}</td>
                  <td className="px-3 py-2 font-mono">{l.month ? monthLabel(l.month) : "—"}</td>
                  <td className="px-3 py-2">{l.label}</td>
                  <td className="px-3 py-2 text-[#6E6650]">{l.remarks || "—"}</td>
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
            <span className="text-sm flex-1 truncate">{student ? `${student.name} — ${student.class}${student.phone ? " · " + student.phone : ""}` : "Search by name, class, or phone…"}</span>
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
                    <span>{s.name} <span className="text-xs text-[#9C8F6E]">— {s.class}</span></span>
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
  const [paidTo, setPaidTo] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [mode, setMode] = useState("Cash");
  const [refNumber, setRefNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  function submit() {
    if (!category.trim() || !amount) return;
    onSave({
      category: category.trim(), paidTo: paidTo.trim(), amount: Number(amount) || 0, date, mode,
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

      <Field label="Paid To (vendor, staff, landlord, or recipient)">
        <input className={inputCls} style={inputStyle} value={paidTo} onChange={e => setPaidTo(e.target.value)} placeholder="e.g. Rahul Sharma, XYZ Stationers" />
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

function NoteFormModal({ initial, onClose, onSave }) {
  const [title, setTitle] = useState(initial ? initial.title || "" : "");
  const [body, setBody] = useState(initial ? initial.body || "" : "");

  function submit() {
    if (!title.trim() && !body.trim()) return;
    onSave({ id: initial ? initial.id : null, title: title.trim(), body: body.trim() });
  }

  return (
    <Modal title={initial ? "Edit Note" : "Add Note"} onClose={onClose}>
      <div className="text-xs text-[#6E6650] mb-3">A quick note for the office — a reminder, a follow-up, anything worth writing down. This does not affect any student's fees or dues.</div>

      <Field label="Title"><input className={inputCls} style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Call Priya's parent about fee date" autoFocus /></Field>

      <Field label="Note">
        <textarea className={inputCls} style={{ ...inputStyle, minHeight: "120px", resize: "vertical" }} value={body} onChange={e => setBody(e.target.value)} placeholder="Write as much detail as you need…" />
      </Field>

      <button onClick={submit} disabled={!title.trim() && !body.trim()} className="w-full mt-1 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        {initial ? "Save Changes" : "Add Note"}
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
          <InstituteHeader subtitle={`Official Payment Receipt`} large={false} />
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-[#6E6650]">
            <span>Receipt No: <strong className="text-[#12312B]">#{receiptNo}</strong></span>
            <span>Date: <strong className="text-[#12312B]">{fmtDate(deposit.date)}</strong></span>
          </div>
          <div className="flex justify-between text-[#6E6650]"><span>Student Name:</span><strong className="text-[#12312B]">{student ? student.name : "N/A"}</strong></div>
          <div className="flex justify-between text-[#6E6650]"><span>Class:</span><strong className="text-[#12312B]">{student ? student.class : "N/A"}</strong></div>
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
// ============================================================================
// BANK TRANSACTION FORM — records an internal Cash ⇄ Bank transfer. This is
// NOT money coming into or leaving the coaching center — it's moving money
// the center already has between physical Cash and the Bank/Online account.
// Withdraw from Bank: Bank Balance goes down, Cash Balance goes up.
// Deposit Cash to Bank: Cash Balance goes down, Bank Balance goes up.
// ============================================================================
function BankTxnFormModal({ onClose, onSave }) {
  const [type, setType] = useState("withdrawal");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [refType, setRefType] = useState("None");
  const [refNumber, setRefNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  function submit() {
    if (!amount || Number(amount) <= 0) return;
    onSave({
      type, amount: Number(amount) || 0, date,
      bankName: bankName.trim(), accountNumber: accountNumber.trim(),
      refType: refType !== "None" ? refType : "", refNumber: refType !== "None" ? refNumber.trim() : "",
      remarks: remarks.trim(),
    });
  }

  return (
    <Modal title="Record Cash ⇄ Bank Transfer" onClose={onClose}>
      <div className="text-xs text-[#6E6650] mb-3">Move money between physical Cash and your Bank/Online account. This does not affect student dues or center expenses — it only shifts where the center's own money is held. It gets a unique Transaction ID and only appears in the Banking tab.</div>

      <Field label="Transaction Type">
        <div className="grid grid-cols-1 gap-2">
          <button type="button" onClick={() => setType("withdrawal")} className="px-3 py-2.5 text-xs rounded-sm border font-semibold text-left flex items-center gap-2"
            style={{ background: type === "withdrawal" ? "#12312B" : "white", color: type === "withdrawal" ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
            <Banknote size={14} /> Withdraw from Bank → Cash in Hand
          </button>
          <button type="button" onClick={() => setType("deposit")} className="px-3 py-2.5 text-xs rounded-sm border font-semibold text-left flex items-center gap-2"
            style={{ background: type === "deposit" ? "#12312B" : "white", color: type === "deposit" ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
            <Landmark size={14} /> Deposit Cash → Bank Account
          </button>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₹)"><input type="number" className={inputCls} style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></Field>
        <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Bank Name"><input className={inputCls} style={inputStyle} value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. State Bank of India" /></Field>
        <Field label="Account Number"><input className={inputCls} style={inputStyle} value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="e.g. 3849201XXXXX" /></Field>
      </div>

      <Field label="Reference Type (optional)">
        <div className="flex gap-2 flex-wrap">
          {REFERENCE_TYPES.map(rt => (
            <button key={rt} type="button" onClick={() => setRefType(rt)} className="px-3 py-1.5 text-xs rounded-sm border font-semibold"
              style={{ background: refType === rt ? "#12312B" : "white", color: refType === rt ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
              {rt}
            </button>
          ))}
        </div>
      </Field>
      {refType !== "None" && (
        <Field label={refType}><input className={inputCls} style={inputStyle} value={refNumber} onChange={e => setRefNumber(e.target.value)} placeholder={`Enter ${refType.toLowerCase()}`} /></Field>
      )}

      <Field label="Remarks (optional)"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any note for this transfer" /></Field>

      <div className="p-3 rounded bg-[#FAF6EC] border text-xs mb-1" style={{ borderColor: "#D8CFB8" }}>
        {type === "withdrawal"
          ? "Bank Balance will decrease and Cash Balance will increase by this amount."
          : "Cash Balance will decrease and Bank Balance will increase by this amount."}
      </div>

      <button onClick={submit} disabled={!amount || Number(amount) <= 0} className="w-full mt-1 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Record Transfer & Generate Transaction Slip
      </button>
    </Modal>
  );
}

// ============================================================================
// BANK TRANSACTION SLIP — printable record for a single Cash ⇄ Bank transfer.
// ============================================================================
function BankTxnReceiptModal({ txn, onClose }) {
  const receiptRef = useRef();
  if (!txn) return null;
  const txnId = txn.txnId || `BTX-${shortId(txn.id)}`;
  const typeLabel = txn.type === "withdrawal" ? "Bank Withdrawal (Bank → Cash)" : "Cash Deposit to Bank (Cash → Bank)";

  const handlePrint = () => {
    const printContent = receiptRef.current.innerHTML;
    const win = window.open("", "", "width=600,height=700");
    win.document.write(`
      <html>
        <head>
          <title>Bank Transaction Slip - ${txnId}</title>
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
    <Modal title="Bank Transaction Slip" onClose={onClose}>
      <div className="p-4 border bg-white rounded-sm mb-4" ref={receiptRef} style={{ borderColor: "#12312B" }}>
        <div className="text-center pb-3 mb-3 border-b-2 border-dashed border-[#12312B]">
          <InstituteHeader subtitle={`Internal Banking Transaction Slip`} large={false} />
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-[#6E6650]">
            <span>Transaction ID: <strong className="text-[#12312B]">{txnId}</strong></span>
            <span>Date: <strong className="text-[#12312B]">{fmtDate(txn.date)}</strong></span>
          </div>
          <div className="flex justify-between text-[#6E6650]"><span>Type:</span><strong className="text-[#12312B]">{typeLabel}</strong></div>
          {txn.bankName && <div className="flex justify-between text-[#6E6650]"><span>Bank Name:</span><strong className="text-[#12312B]">{txn.bankName}</strong></div>}
          {txn.accountNumber && <div className="flex justify-between text-[#6E6650]"><span>Account Number:</span><strong className="text-[#12312B]">{txn.accountNumber}</strong></div>}
          {txn.refType && txn.refNumber && <div className="flex justify-between text-[#6E6650]"><span>{txn.refType}:</span><strong className="text-[#12312B]">{txn.refNumber}</strong></div>}
          {txn.remarks && <div className="flex justify-between text-[#6E6650]"><span>Remarks:</span><strong className="text-[#12312B]">{txn.remarks}</strong></div>}

          <div className="pt-3 mt-3 border-t-2 border-[#12312B]">
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="font-bold">Amount Transferred:</span>
              <span className="font-bold text-[#B8862B] text-lg" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(txn.amount)}</span>
            </div>
          </div>
        </div>
        <div className="text-center pt-3 mt-3 border-t border-dashed border-[#12312B] text-[10px] text-[#9C8F6E]">
          Internal Transfer Only — Not a Student Charge, Payment, or Center Expense · Computer Generated Slip
        </div>
      </div>
      <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]"><Printer size={15} /> Print Slip</button>
    </Modal>
  );
}

// ============================================================================
// CREDIT / LOAN LEDGER — money the center borrows from someone (Credit
// Taken) or lends to someone (Credit Given). Each entry gets a unique,
// clickable/printable Credit ID and feeds the Cash Balance / Bank Balance
// the same way a deposit or expense does. A "Pay Interest" action against
// any Credit Taken entry logs a separate, also-unique Interest Payment.
// ============================================================================
function CreditFormModal({ onClose, onSave }) {
  const [direction, setDirection] = useState("taken");
  const [partyName, setPartyName] = useState("");
  const [partyType, setPartyType] = useState("Person");
  const [address, setAddress] = useState("");
  const [mobile, setMobile] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [mode, setMode] = useState("Cash");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [refType, setRefType] = useState("None");
  const [refNumber, setRefNumber] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [remarks, setRemarks] = useState("");

  function submit() {
    if (!partyName.trim() || !amount || Number(amount) <= 0) return;
    onSave({
      direction, partyName: partyName.trim(), partyType, address: address.trim(), mobile: mobile.trim(),
      amount: Number(amount) || 0, date, mode,
      bankName: mode === "Online" ? bankName.trim() : "", accountNumber: mode === "Online" ? accountNumber.trim() : "",
      refType: mode === "Online" && refType !== "None" ? refType : "", refNumber: mode === "Online" && refType !== "None" ? refNumber.trim() : "",
      interestRate: Number(interestRate) || 0, remarks: remarks.trim(),
    });
  }

  return (
    <Modal title="Record Credit / Loan" onClose={onClose}>
      <div className="text-xs text-[#6E6650] mb-3">Log money borrowed from someone, or money lent out to someone. Gets its own unique Credit ID and shows up in the Banking Cash/Bank Balance and the Credit &amp; Loan Ledger below.</div>

      <Field label="Direction">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setDirection("taken")} className="px-3 py-2.5 text-xs rounded-sm border font-semibold text-left flex items-center gap-2"
            style={{ background: direction === "taken" ? "#12312B" : "white", color: direction === "taken" ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
            <ArrowUpRight size={14} className="rotate-180" /> Credit Taken (we borrow)
          </button>
          <button type="button" onClick={() => setDirection("given")} className="px-3 py-2.5 text-xs rounded-sm border font-semibold text-left flex items-center gap-2"
            style={{ background: direction === "given" ? "#12312B" : "white", color: direction === "given" ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
            <ArrowUpRight size={14} /> Credit Given (we lend)
          </button>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={direction === "taken" ? "Received From" : "Given To"}><input className={inputCls} style={inputStyle} value={partyName} onChange={e => setPartyName(e.target.value)} placeholder="Name of person / company / bank" /></Field>
        <Field label="Party Type">
          <select className={inputCls} style={inputStyle} value={partyType} onChange={e => setPartyType(e.target.value)}>
            {CREDIT_PARTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mobile Number"><input className={inputCls} style={inputStyle} value={mobile} onChange={e => setMobile(e.target.value)} placeholder="10-digit mobile number" /></Field>
        <Field label="Amount (₹)"><input type="number" className={inputCls} style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></Field>
      </div>
      <Field label="Address"><input className={inputCls} style={inputStyle} value={address} onChange={e => setAddress(e.target.value)} placeholder="Address of the other party" /></Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Annual Interest Rate % (optional)"><input type="number" className={inputCls} style={inputStyle} value={interestRate} onChange={e => setInterestRate(e.target.value)} placeholder="0" /></Field>
      </div>

      <Field label="Mode">
        <div className="flex gap-2 flex-wrap">
          {CREDIT_MODES.map(m => (
            <button key={m} type="button" onClick={() => setMode(m)} className="px-3 py-1.5 text-xs rounded-sm border font-semibold"
              style={{ background: mode === m ? "#12312B" : "white", color: mode === m ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
              {m}
            </button>
          ))}
        </div>
      </Field>

      {mode === "Online" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bank Name"><input className={inputCls} style={inputStyle} value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. HDFC Bank" /></Field>
            <Field label="Account Number"><input className={inputCls} style={inputStyle} value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="e.g. 5021XXXXXX" /></Field>
          </div>
          <Field label="Reference Type">
            <div className="flex gap-2 flex-wrap">
              {REFERENCE_TYPES.map(rt => (
                <button key={rt} type="button" onClick={() => setRefType(rt)} className="px-3 py-1.5 text-xs rounded-sm border font-semibold"
                  style={{ background: refType === rt ? "#12312B" : "white", color: refType === rt ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
                  {rt}
                </button>
              ))}
            </div>
          </Field>
          {refType !== "None" && (
            <Field label={refType}><input className={inputCls} style={inputStyle} value={refNumber} onChange={e => setRefNumber(e.target.value)} placeholder={`Enter ${refType.toLowerCase()}`} /></Field>
          )}
        </>
      )}

      <Field label="Remarks (optional)"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any note for this entry" /></Field>

      <div className="p-3 rounded bg-[#FAF6EC] border text-xs mb-1" style={{ borderColor: "#D8CFB8" }}>
        {direction === "taken"
          ? `${mode} Balance will increase by this amount — this is money coming in.`
          : `${mode} Balance will decrease by this amount — this is money going out.`}
      </div>

      <button onClick={submit} disabled={!partyName.trim() || !amount || Number(amount) <= 0} className="w-full mt-1 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Record Credit &amp; Generate Slip
      </button>
    </Modal>
  );
}

function CreditReceiptModal({ txn, onClose }) {
  const receiptRef = useRef();
  if (!txn) return null;
  const typeLabel = txn.direction === "taken" ? "Credit Taken (Borrowed)" : "Credit Given (Lent)";

  const handlePrint = () => {
    const printContent = receiptRef.current.innerHTML;
    const win = window.open("", "", "width=600,height=750");
    win.document.write(`
      <html>
        <head>
          <title>Credit Slip - ${txn.creditId}</title>
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
    <Modal title="Credit / Loan Slip" onClose={onClose}>
      <div className="p-4 border bg-white rounded-sm mb-4" ref={receiptRef} style={{ borderColor: "#12312B" }}>
        <div className="text-center pb-3 mb-3 border-b-2 border-dashed border-[#12312B]">
          <InstituteHeader subtitle={`Credit / Loan Ledger Slip`} large={false} />
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-[#6E6650]">
            <span>Credit ID: <strong className="text-[#12312B]">{txn.creditId}</strong></span>
            <span>Date: <strong className="text-[#12312B]">{fmtDate(txn.date)}</strong></span>
          </div>
          <div className="flex justify-between text-[#6E6650]"><span>Type:</span><strong className="text-[#12312B]">{typeLabel}</strong></div>
          <div className="flex justify-between text-[#6E6650]"><span>{txn.direction === "taken" ? "Received From" : "Given To"}:</span><strong className="text-[#12312B]">{txn.partyName}</strong></div>
          <div className="flex justify-between text-[#6E6650]"><span>Party Type:</span><strong className="text-[#12312B]">{txn.partyType}</strong></div>
          {txn.mobile && <div className="flex justify-between text-[#6E6650]"><span>Mobile:</span><strong className="text-[#12312B]">{txn.mobile}</strong></div>}
          {txn.address && <div className="flex justify-between text-[#6E6650]"><span>Address:</span><strong className="text-[#12312B]">{txn.address}</strong></div>}
          <div className="flex justify-between text-[#6E6650]"><span>Mode:</span><strong className="text-[#12312B]">{txn.mode}</strong></div>
          {txn.bankName && <div className="flex justify-between text-[#6E6650]"><span>Bank Name:</span><strong className="text-[#12312B]">{txn.bankName}</strong></div>}
          {txn.accountNumber && <div className="flex justify-between text-[#6E6650]"><span>Account Number:</span><strong className="text-[#12312B]">{txn.accountNumber}</strong></div>}
          {txn.refType && txn.refNumber && <div className="flex justify-between text-[#6E6650]"><span>{txn.refType}:</span><strong className="text-[#12312B]">{txn.refNumber}</strong></div>}
          {Number(txn.interestRate) > 0 && <div className="flex justify-between text-[#6E6650]"><span>Annual Interest Rate:</span><strong className="text-[#12312B]">{txn.interestRate}%</strong></div>}
          {txn.remarks && <div className="flex justify-between text-[#6E6650]"><span>Remarks:</span><strong className="text-[#12312B]">{txn.remarks}</strong></div>}

          <div className="pt-3 mt-3 border-t-2 border-[#12312B]">
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="font-bold">Amount:</span>
              <span className="font-bold text-[#B8862B] text-lg" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(txn.amount)}</span>
            </div>
          </div>
        </div>
        <div className="text-center pt-3 mt-3 border-t border-dashed border-[#12312B] text-[10px] text-[#9C8F6E]">
          Internal Credit / Loan Record · Computer Generated Slip
        </div>
      </div>
      <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]"><Printer size={15} /> Print Slip</button>
    </Modal>
  );
}

function PayInterestModal({ creditTxn, interestPaidSoFar, onClose, onSave }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [mode, setMode] = useState("Cash");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [refType, setRefType] = useState("None");
  const [refNumber, setRefNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  function submit() {
    if (!amount || Number(amount) <= 0) return;
    onSave({
      creditTxnId: creditTxn.id, amount: Number(amount) || 0, date, mode,
      bankName: mode === "Online" ? bankName.trim() : "", accountNumber: mode === "Online" ? accountNumber.trim() : "",
      refType: mode === "Online" && refType !== "None" ? refType : "", refNumber: mode === "Online" && refType !== "None" ? refNumber.trim() : "",
      remarks: remarks.trim(),
    });
  }

  return (
    <Modal title={`Pay Interest — ${creditTxn.creditId}`} onClose={onClose}>
      <div className="p-3 rounded bg-[#FAF6EC] border text-xs mb-3" style={{ borderColor: "#D8CFB8" }}>
        Against credit taken from <strong>{creditTxn.partyName}</strong> ({fmtINR(creditTxn.amount)}{Number(creditTxn.interestRate) > 0 ? ` @ ${creditTxn.interestRate}% p.a.` : ""}).
        {interestPaidSoFar > 0 && <> Interest paid so far: <strong>{fmtINR(interestPaidSoFar)}</strong>.</>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Interest Amount (₹)"><input type="number" className={inputCls} style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></Field>
        <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
      </div>

      <Field label="Mode">
        <div className="flex gap-2 flex-wrap">
          {CREDIT_MODES.map(m => (
            <button key={m} type="button" onClick={() => setMode(m)} className="px-3 py-1.5 text-xs rounded-sm border font-semibold"
              style={{ background: mode === m ? "#12312B" : "white", color: mode === m ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
              {m}
            </button>
          ))}
        </div>
      </Field>

      {mode === "Online" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bank Name"><input className={inputCls} style={inputStyle} value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. HDFC Bank" /></Field>
            <Field label="Account Number"><input className={inputCls} style={inputStyle} value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="e.g. 5021XXXXXX" /></Field>
          </div>
          <Field label="Reference Type">
            <div className="flex gap-2 flex-wrap">
              {REFERENCE_TYPES.map(rt => (
                <button key={rt} type="button" onClick={() => setRefType(rt)} className="px-3 py-1.5 text-xs rounded-sm border font-semibold"
                  style={{ background: refType === rt ? "#12312B" : "white", color: refType === rt ? "#F4EFDE" : "#4A4636", borderColor: "#D8CFB8" }}>
                  {rt}
                </button>
              ))}
            </div>
          </Field>
          {refType !== "None" && (
            <Field label={refType}><input className={inputCls} style={inputStyle} value={refNumber} onChange={e => setRefNumber(e.target.value)} placeholder={`Enter ${refType.toLowerCase()}`} /></Field>
          )}
        </>
      )}

      <Field label="Remarks (optional)"><input className={inputCls} style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any note for this interest payment" /></Field>

      <button onClick={submit} disabled={!amount || Number(amount) <= 0} className="w-full mt-1 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Pay Interest &amp; Generate Slip
      </button>
    </Modal>
  );
}

function InterestReceiptModal({ payment, creditTxn, onClose }) {
  const receiptRef = useRef();
  if (!payment) return null;

  const handlePrint = () => {
    const printContent = receiptRef.current.innerHTML;
    const win = window.open("", "", "width=600,height=700");
    win.document.write(`
      <html>
        <head>
          <title>Interest Payment Slip - ${payment.paymentId}</title>
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
    <Modal title="Interest Payment Slip" onClose={onClose}>
      <div className="p-4 border bg-white rounded-sm mb-4" ref={receiptRef} style={{ borderColor: "#12312B" }}>
        <div className="text-center pb-3 mb-3 border-b-2 border-dashed border-[#12312B]">
          <InstituteHeader subtitle={`Interest Payment Slip`} large={false} />
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-[#6E6650]">
            <span>Payment ID: <strong className="text-[#12312B]">{payment.paymentId}</strong></span>
            <span>Date: <strong className="text-[#12312B]">{fmtDate(payment.date)}</strong></span>
          </div>
          {creditTxn && <div className="flex justify-between text-[#6E6650]"><span>Against Credit ID:</span><strong className="text-[#12312B]">{creditTxn.creditId}</strong></div>}
          {creditTxn && <div className="flex justify-between text-[#6E6650]"><span>Paid To:</span><strong className="text-[#12312B]">{creditTxn.partyName}</strong></div>}
          <div className="flex justify-between text-[#6E6650]"><span>Mode:</span><strong className="text-[#12312B]">{payment.mode}</strong></div>
          {payment.bankName && <div className="flex justify-between text-[#6E6650]"><span>Bank Name:</span><strong className="text-[#12312B]">{payment.bankName}</strong></div>}
          {payment.accountNumber && <div className="flex justify-between text-[#6E6650]"><span>Account Number:</span><strong className="text-[#12312B]">{payment.accountNumber}</strong></div>}
          {payment.refType && payment.refNumber && <div className="flex justify-between text-[#6E6650]"><span>{payment.refType}:</span><strong className="text-[#12312B]">{payment.refNumber}</strong></div>}
          {payment.remarks && <div className="flex justify-between text-[#6E6650]"><span>Remarks:</span><strong className="text-[#12312B]">{payment.remarks}</strong></div>}

          <div className="pt-3 mt-3 border-t-2 border-[#12312B]">
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="font-bold">Interest Paid:</span>
              <span className="font-bold text-[#B8862B] text-lg" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtINR(payment.amount)}</span>
            </div>
          </div>
        </div>
        <div className="text-center pt-3 mt-3 border-t border-dashed border-[#12312B] text-[10px] text-[#9C8F6E]">
          Computer Generated Slip
        </div>
      </div>
      <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]"><Printer size={15} /> Print Slip</button>
    </Modal>
  );
}

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
          <InstituteHeader subtitle={`Official Expense Receipt`} large={false} />
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-[#6E6650]">
            <span>Expense ID: <strong className="text-[#12312B]">{expenseId}</strong></span>
            <span>Date: <strong className="text-[#12312B]">{fmtDate(expense.date)}</strong></span>
          </div>
          <div className="flex justify-between text-[#6E6650]"><span>Category:</span><strong className="text-[#12312B]">{expense.category || "—"}</strong></div>
          {expense.paidTo && <div className="flex justify-between text-[#6E6650]"><span>Paid To:</span><strong className="text-[#12312B]">{expense.paidTo}</strong></div>}
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
// ============================================================================
// JOINING FORM — a full-detail, printable (A4) record of a student's
// registration, generated on demand from the student's row. Pulls every
// field captured on the Student Register form so the center always has a
// complete, printable admission record to keep on file.
// ============================================================================
function JoiningFormModal({ student, deposits, onClose }) {
  const formRef = useRef();
  if (!student) return null;

  // The one-time Advance Payment captured on the Student form (if any) is
  // stored as a regular Deposit tagged with this exact remark — look it up
  // so the Joining Form can show what was actually collected at admission.
  const advanceDeposit = (deposits || []).find(d => d.studentId === student.id && !d.deleted && d.remarks === "Advance Payment at Admission");
  const advanceAmount = advanceDeposit ? Number(advanceDeposit.amount) || 0 : 0;
  const admissionNo = `ADM-${shortId(student.id)}`;

  const handlePrint = () => {
    const printContent = formRef.current.innerHTML;
    const win = window.open("", "", "width=900,height=1000");
    win.document.write(`
      <html>
        <head>
          <title>Joining Form - ${student.name}</title>
          <style>
            @page { size: A4; margin: 16mm; }
            body { font-family: 'Inter', sans-serif; padding: 0; color: #12312B; }
            .form-box { max-width: 100%; margin: auto; border: 1.5px solid #B8862B; padding: 22px; border-radius: 4px; }
            .form-box::before { content: ""; display: block; height: 3px; background: #12312B; margin: -22px -22px 18px -22px; }
            .admission-no { text-align: right; font-family: monospace; font-size: 11px; color: #8A6420; letter-spacing: 0.06em; margin-bottom: 4px; }
            .header { text-align: center; border-bottom: 2px dashed #12312B; padding-bottom: 12px; margin-bottom: 18px; }
            .section-title { font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #8A6420; border-bottom: 1px solid #D8CFB8; padding-bottom: 4px; margin: 18px 0 10px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; }
            .row { font-size: 13px; padding: 6px 0; border-bottom: 1px dotted #D8CFB8; display: flex; justify-content: space-between; }
            .label { color: #6E6650; }
            .value { font-weight: 600; color: #12312B; }
            .footer { border-top: 1.5px solid #12312B; padding-top: 10px; margin-top: 24px; text-align: center; font-size: 10px; color: #6E6650; }
            .sign-row { display: flex; justify-content: space-between; margin-top: 60px; font-size: 12px; }
            .sign-line { border-top: 1px solid #12312B; padding-top: 4px; width: 200px; text-align: center; }
          </style>
        </head>
        <body><div class="form-box">${printContent}</div></body>
      </html>
    `);
    win.document.close(); win.focus(); win.print(); win.close();
  };

  const statusLabel = (student.status || "active") === "active" ? "Active" : (student.status === "dropped" ? "Dropped Out" : (student.resultStatus || "On Break"));
  const statusTone = (student.status || "active") === "active" ? "paid" : student.status === "dropped" ? "overdue" : "break";

  return (
    <WideModal title="Student Joining Form" onClose={onClose}>
      <div
        className="joining-form-doc p-6 bg-white rounded-sm mb-4"
        ref={formRef}
        style={{ border: "1.5px solid #B8862B", borderRadius: "4px", boxShadow: "0 1px 3px rgba(18,49,43,0.08)" }}
      >
        <div className="text-right font-mono text-[11px] mb-1" style={{ color: "#8A6420", letterSpacing: "0.06em" }}>{admissionNo}</div>
        <div className="header">
          <InstituteHeader subtitle={`Student Joining / Admission Form`} large={true} />
        </div>

        <div className="section-title">Student Details</div>
        <div className="grid">
          <div className="row"><span className="label">Full Name</span><span className="value">{student.name || "—"}</span></div>
          <div className="row"><span className="label">Student ID</span><span className="value">{student.studentId || "—"}</span></div>
          <div className="row"><span className="label">Father's Name</span><span className="value">{student.fatherName || "—"}</span></div>
          <div className="row"><span className="label">Gender</span><span className="value">{student.gender || "—"}</span></div>
          <div className="row"><span className="label">Aadhar Number</span><span className="value">{student.aadharNumber || "—"}</span></div>
          <div className="row"><span className="label">Date of Birth</span><span className="value">{student.dob ? fmtDate(student.dob) : "—"}</span></div>
          <div className="row"><span className="label">Joining Date</span><span className="value">{student.joiningDate ? fmtDate(student.joiningDate) : "—"}</span></div>
          <div className="row"><span className="label">Status</span><span className="value"><Stamp text={statusLabel} tone={statusTone} /></span></div>
          <div className="row"><span className="label">Current School / Institution</span><span className="value">{student.currentSchool || "—"}</span></div>
        </div>

        <div className="section-title">Contact Details</div>
        <div className="grid">
          <div className="row"><span className="label">Phone / WhatsApp Number</span><span className="value">{student.phone || "—"}</span></div>
          <div className="row"><span className="label">Guardian Phone Number</span><span className="value">{student.guardianPhone || "—"}</span></div>
        </div>
        <div className="row"><span className="label">Address</span><span className="value">{student.address || "—"}</span></div>

        <div className="section-title">Academic Details</div>
        <div className="grid">
          <div className="row"><span className="label">Class</span><span className="value">{student.class || "—"}</span></div>
          <div className="row"><span className="label">Stream</span><span className="value">{student.stream || "—"}</span></div>
          <div className="row"><span className="label">Fee Start Month</span><span className="value">{monthLabel(student.admissionMonth)}</span></div>
          <div className="row"><span className="label">Subjects / Batches</span><span className="value">{(student.batches || []).join(", ") || "—"}</span></div>
          <div className="row"><span className="label">Monthly Concession / Discount</span><span className="value">{fmtINR(student.monthlyDiscount || 0)}</span></div>
        </div>

        <div className="section-title">Fee Details</div>
        <div className="grid">
          <div className="row"><span className="label">Opening Balance / Legacy Carried Dues</span><span className="value">{fmtINR(student.previousDues || 0)}</span></div>
          <div className="row">
            <span className="label">Advance Amount Paid at Admission</span>
            <span className="value" style={{ color: advanceAmount > 0 ? "#3F6B52" : undefined }}>
              {fmtINR(advanceAmount)}{advanceDeposit ? ` (${advanceDeposit.mode || "Cash"})` : ""}
            </span>
          </div>
          <div className="row"><span className="label">Form Generated On</span><span className="value">{fmtDate(todayStr())}</span></div>
        </div>

        <div className="sign-row">
          <div className="sign-line">Parent / Guardian Signature</div>
          <div className="sign-line">Authorized Signatory</div>
        </div>

        <div className="footer">
          Computer Generated Joining Form · Coaching Classes Admission Record · {admissionNo}
        </div>
      </div>
      <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]"><Printer size={15} /> Print Joining Form (A4)</button>
    </WideModal>
  );
}

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
          <InstituteHeader subtitle={`Official Charge Receipt — ${typeLabel}`} large={false} />
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-[#6E6650]">
            <span>Charge ID: <strong className="text-[#12312B]">{line.chargeId}</strong></span>
            <span>Date: <strong className="text-[#12312B]">{fmtDate(line.date)}</strong></span>
          </div>
          <div className="flex justify-between text-[#6E6650]"><span>Student Name:</span><strong className="text-[#12312B]">{student ? student.name : "N/A"}</strong></div>
          <div className="flex justify-between text-[#6E6650]"><span>Class:</span><strong className="text-[#12312B]">{student ? `${student.class}` : "N/A"}</strong></div>
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
