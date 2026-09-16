import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Card, Field, Modal, SectionHeader, inputCls, inputStyle } from "../common/UI";

export const INFRASTRUCTURE_CATEGORIES = [
  "Class Room", "Laboratories", "Lecture Hall", "Workshops & Studios", "Library",
  "Auditorium", "Exam Halls", "Principal / Director / Registrar Office", "Accounts",
  "Registrar", "Faculty & Staff Rooms", "Conference Rooms", "Indoor Sports Room",
  "Gymnasium", "Cafeteria", "Server & IT Room", "Storage", "Computer Center",
  "Parking", "Sports Ground", "Main Entry Gate", "Other",
];


export function InfrastructureTab({ infrastructure, onAdd, onEdit, onRemove }) {
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


export function InfrastructureFormModal({ initial, onClose, onSave }) {
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

