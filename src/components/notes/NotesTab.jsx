import { useState } from "react";
import { Plus, Search, Tag } from "lucide-react";
import { Card, SectionHeader, inputCls, inputStyle } from "../common/UI";
import { fmtDate, todayStr } from "../../lib/dates";

export function NotesTab({ notes, onAdd, onEdit, onTogglePin, onDelete }) {
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
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

