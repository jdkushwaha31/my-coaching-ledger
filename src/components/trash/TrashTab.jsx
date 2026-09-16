import { useState } from "react";
import { ArrowUpRight, Award, Banknote, ClipboardCheck, CreditCard, GraduationCap, Landmark, MessageSquare, Percent, Receipt, RotateCcw, Search, Tag, Undo2, UserCog, Users, Wallet } from "lucide-react";
import { Card, SectionHeader, inputCls, inputStyle } from "../common/UI";
import { fmtDate } from "../../lib/dates";
import { fmtINR } from "../../lib/money";

export const TRASH_CATEGORIES = [
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


export function TrashTab({ trashedStudents, trashedDeposits, trashedCharges, trashedExpenses, trashedBankTxns, trashedCreditTxns, trashedInterestPayments, trashedAttendance, trashedTestScores, trashedBehaviourNotes, trashedTeachers, trashedStaff, trashedSalaryPayments, trashedAdvances, trashedAdvanceReturns, studentById, onRestoreStudent, onDeleteStudent, onRestoreDeposit, onDeleteDeposit, onRestoreCharge, onDeleteCharge, onRestoreExpense, onDeleteExpense, onRestoreBankTxn, onDeleteBankTxn, onRestoreCredit, onDeleteCredit, onRestoreInterest, onDeleteInterest, onRestoreAttendance, onDeleteAttendance, onRestoreTestScore, onDeleteTestScore, onRestoreBehaviour, onDeleteBehaviour, onRestoreTeacher, onDeleteTeacher, onRestoreStaff, onDeleteStaff, onRestoreSalaryPayment, onDeleteSalaryPayment, onRestoreAdvance, onDeleteAdvance, onRestoreAdvanceReturn, onDeleteAdvanceReturn }) {
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

