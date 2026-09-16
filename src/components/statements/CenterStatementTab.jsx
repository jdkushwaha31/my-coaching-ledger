import React, { useMemo, useRef, useState } from "react";
import { Landmark, Printer, Receipt, Search } from "lucide-react";
import { Card, InstituteHeader, SectionHeader, Stamp, inputCls, inputStyle } from "../common/UI";
import { FONT_IMPORT } from "../../constants/appConstants";
import { fmtDate, monthLabel, todayStr } from "../../lib/dates";
import { fmtINR, round2 } from "../../lib/money";

export const TXN_TYPE_META = {
  opening: { label: "Opening Balance", tone: "carried" },
  monthly_fee: { label: "Tuition Fee", tone: "due" },
  extra_charge: { label: "Additional Charge", tone: "due" },
  payment: { label: "Payment Received", tone: "paid" },
  writeoff: { label: "Write-off / Discount", tone: "break" },
};

// Type metadata for the dedicated Banking Statement — student deposits,
// center expenses, and internal Cash ⇄ Bank transfers all in one feed.


export function CenterStatementTab({ transactions, totals, students, classes, onViewReceipt, onViewCharge }) {
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
    const win = window.open("", "", "width=900,height=1100");
    // Loads the same Tailwind utility classes + Google Fonts the live app
    // uses, so the printed page renders exactly like the on-screen preview
    // instead of the plain unstyled text a bare popup window would produce.
    // Portrait A4 (per request — every printed document is portrait now,
    // no exceptions). This table has 11 columns, which is a lot for
    // portrait width, so the print-only overrides below shrink the font
    // and tighten padding specifically for print — the on-screen Card
    // above (statementRef) keeps its normal, comfortable size; none of
    // this touches that.
    win.document.write(`
      <html>
        <head>
          <title>Center Statement - InstituteOS</title>
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
            /* Print-only compaction — 11 columns in portrait needs a much
               smaller footprint than the on-screen table. */
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
      <SectionHeader eyebrow="Center-Wide Ledger" title="Master Transaction Statement" action={
        <button onClick={handlePrint} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-sm" style={{ background: "#12312B", color: "#F4EFDE" }}>
          <Printer size={15} /> Print / Export
        </button>
      } />
      <div className="text-sm text-[#6E6650] mb-4">Every transaction recorded across the entire coaching center — tuition charges, additional charges, payments, and write-offs — for every student, in one place.</div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
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

