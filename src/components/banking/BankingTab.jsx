import React, { useMemo, useRef, useState } from "react";
import { ArrowUpRight, Banknote, CreditCard, FileText, Landmark, Percent, Plus, Printer, Receipt, Search, Wallet } from "lucide-react";
import { Card, InstituteHeader, SectionHeader, Stamp, inputCls, inputStyle } from "../common/UI";
import { DepositsTab, ExpensesTab } from "../fees/DepositsChargesExpensesTab";
import { AdvanceTab, SalaryTab } from "../staff/SalaryAdvanceTab";
import { FONT_IMPORT } from "../../constants/appConstants";
import { compareChrono, fmtDate, todayStr } from "../../lib/dates";
import { fmtINR } from "../../lib/money";

export const BANKING_TXN_TYPE_META = {
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


export const BANKING_SUB_TABS = [
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


export function BankingTab({ feed, totals, bankTxns, creditTxns, interestPayments, interestPaidByCreditId, students, expensesTabProps, depositsTabProps, salaryTabProps, advanceTabProps, onAdd, onAddCredit, onPayInterest, onViewReceipt, onViewExpense, onViewBankTxn, onViewCredit, onViewInterest, onRemoveBankTxn, onRemoveCredit, onRemoveInterest }) {
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
    const win = window.open("", "", "width=900,height=1100");
    // Loads the same Tailwind utility classes + Google Fonts the live app
    // uses, so the printed page renders exactly like the on-screen preview
    // instead of the plain unstyled text a bare popup window would produce.
    // Portrait A4 (per request — every printed document is portrait now,
    // no exceptions). Same print-only compaction as Center Statement:
    // smaller font + tighter padding specifically for print, the
    // on-screen Card above (statementRef) is untouched.
    win.document.write(`
      <html>
        <head>
          <title>Banking Statement - InstituteOS</title>
          <script src="https://cdn.tailwindcss.com"><\/script>
          <style>
            ${FONT_IMPORT}
            @page { size: A4; margin: 10mm; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { font-family: 'Inter', sans-serif; color: #12312B; background: #fff; margin: 0; }
            .stmt-doc { border: 1.5px solid #B8862B; border-radius: 4px; padding: 12px; }
            .stmt-doc::before { content: ""; display: block; height: 3px; background: #12312B; margin: -12px -12px 10px -12px; }
            table { page-break-inside: auto; width: 100%; border-collapse: collapse; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
            .stmt-doc table { font-size: 8px !important; }
            .stmt-doc th { font-size: 6.5px !important; padding: 3px 4px !important; }
            .stmt-doc td { padding: 3px 4px !important; white-space: normal !important; word-break: break-word; }
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <Card className="p-5" style={{ borderLeft: "4px solid #3F6B52" }}>
          <div className="text-[10px] uppercase text-[#3F6B52] font-mono flex items-center gap-1 mb-1"><Banknote size={13} /> Cash Balance (in hand)</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-3xl font-bold text-[#3F6B52]">{fmtINR(totals.cashBalance)}</div>
        </Card>
        <Card className="p-5" style={{ borderLeft: "4px solid #4A7B9D" }}>
          <div className="text-[10px] uppercase text-[#2B526C] font-mono flex items-center gap-1 mb-1"><Landmark size={13} /> Bank Balance</div>
          <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-3xl font-bold text-[#2B526C]">{fmtINR(totals.bankBalance)}</div>
        </Card>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
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

