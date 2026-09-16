import React from "react";
import { X } from "lucide-react";
import { InstituteSettingsContext } from "../../contexts/InstituteSettingsContext";
import { fmtINR } from "../../lib/money";

export function Stamp({ text, tone }) {
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


export function Card({ children, className = "" }) {
  // overflow-x-auto is the single highest-leverage responsive fix in the
  // app: nearly every <table> is rendered directly inside a <Card>, so
  // this makes every one of them horizontally scrollable on a narrow
  // phone screen instead of blowing out the page layout, without having
  // to touch each individual table.
  return (
    <div className={`bg-white border rounded-sm overflow-x-auto ${className}`} style={{ borderColor: "#E4DCC5" }}>
      {children}
    </div>
  );
}


export function SectionHeader({ eyebrow, title, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4 pb-3" style={{ borderBottom: "1.5px solid #26231D" }}>
      <div>
        {eyebrow && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.12em", color: "#9C8F6E" }} className="uppercase mb-1">{eyebrow}</div>}
        <h2 style={{ fontFamily: "'Zilla Slab', serif" }} className="text-xl sm:text-2xl font-semibold text-[#1B1810]">{title}</h2>
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


export function InstituteHeader({ subtitle, large }) {
  const settings = React.useContext(InstituteSettingsContext);
  const phoneLine = [
    settings.mobileNumber && `M: ${settings.mobileNumber}`,
    settings.telephoneNumber && `T: ${settings.telephoneNumber}`,
    settings.email && `E: ${settings.email}`,
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


export function StatCard({ label, value, sub, tone }) {
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


export function FinancialSummaryCard({ title, icon: TitleIcon, tone, total, metrics }) {
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
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


export function DashSectionLabel({ children }) {
  return (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.12em" }} className="uppercase text-[#9C8F6E] mb-2.5 mt-7 first:mt-0">
      {children}
    </div>
  );
}


export function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4" style={{ background: "#12312Bcc" }}>
      <div className="w-full h-full sm:h-auto sm:max-w-lg bg-[#FAF6EC] sm:rounded-sm flex flex-col" style={{ border: "2px dashed #B8862B" }}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 shrink-0" style={{ borderBottom: "1.5px solid #26231D" }}>
          <h3 style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-[#6E6650] p-1 -m-1"><X size={20} /></button>
        </div>
        <div className="px-4 sm:px-6 py-5 flex-1 overflow-y-auto sm:max-h-[80vh]">{children}</div>
      </div>
    </div>
  );
}


export function WideModal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4" style={{ background: "#12312Bcc" }}>
      <div className="w-full h-full sm:h-auto sm:max-w-2xl bg-[#FAF6EC] sm:rounded-sm flex flex-col" style={{ border: "2px dashed #B8862B" }}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 shrink-0" style={{ borderBottom: "1.5px solid #26231D" }}>
          <h3 style={{ fontFamily: "'Zilla Slab', serif" }} className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-[#6E6650] p-1 -m-1"><X size={20} /></button>
        </div>
        <div className="px-4 sm:px-6 py-5 flex-1 overflow-y-auto sm:max-h-[80vh]">{children}</div>
      </div>
    </div>
  );
}


export function Field({ label, children }) {
  return (
    <div className="mb-3">
      <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.08em" }} className="block uppercase text-[#9C8F6E] mb-1.5">{label}</label>
      {children}
    </div>
  );
}


export const inputCls = "w-full border rounded-sm px-3 py-2 text-sm bg-white";


export const inputStyle = { borderColor: "#D8CFB8" };

