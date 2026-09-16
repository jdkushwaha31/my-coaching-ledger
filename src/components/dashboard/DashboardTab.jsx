import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Banknote, CreditCard, FileText, Landmark, Printer, Receipt } from "lucide-react";
import { Card, DashSectionLabel, FinancialSummaryCard, SectionHeader, StatCard } from "../common/UI";
import { fmtDate, monthLabel } from "../../lib/dates";
import { fmtINR, round2 } from "../../lib/money";

export function FeeForecastCard({ curMonth, forecastForMonth }) {
  const [month, setMonth] = useState(curMonth);
  const result = forecastForMonth(month);
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold">Fee Forecast</div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="border rounded-sm px-2.5 py-1.5 text-xs bg-white" style={{ borderColor: "#D8CFB8" }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
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


export function DashboardTab({ students, thisMonthCollected, thisMonthWriteOffs, thisMonthExpected, totalOutstanding, trend, classStrength, recentDeposits, studentById, curMonth, classes, studentDues, forecastForMonth, totalCashBalance, totalOnlineBalance, cashExpensesTotal, onlineExpensesTotal, totalExpenses, attendanceLog, tests, teachers, staff, onOpenReceipt, onStatement }) {
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
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

