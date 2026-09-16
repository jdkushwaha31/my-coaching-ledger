import { useState } from "react";
import { Plus, Printer, Search, Send } from "lucide-react";
import { Card, SectionHeader, Stamp, inputCls, inputStyle } from "../common/UI";
import { PAYMENT_MODES } from "../../constants/appConstants";
import { compareChrono, fmtDate, monthLabel } from "../../lib/dates";
import { getReceiptNo, shortId } from "../../lib/ids";
import { fmtINR, round2 } from "../../lib/money";
import { sendWhatsAppReceipt } from "../../lib/whatsapp";

export function DepositsTab({ deposits, students, classes, studentDues, onAdd, onRemove, onOpenReceipt }) {
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


export const CHARGE_TYPE_META = {
  opening: { label: "Opening Balance", tone: "carried" },
  monthly_fee: { label: "Tuition Fee", tone: "due" },
  extra_charge: { label: "Additional Charge", tone: "due" },
};


export function ChargesTab({ chargeLines, students, classes, onAdd, onRemove, onOpenReceipt }) {
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


export function ExpensesTab({ expenses, onAdd, onRemove, onOpenReceipt }) {
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

