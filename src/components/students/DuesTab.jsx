import { useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";
import { Card, SectionHeader, Stamp, inputCls, inputStyle } from "../common/UI";
import { fmtINR, round2 } from "../../lib/money";

export function DuesTab({ students, ledgers, totalOutstanding, classes, onStatement }) {
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

