import { useState } from "react";
import { Tag, X } from "lucide-react";
import { Card, Field, SectionHeader, inputCls, inputStyle } from "../common/UI";
import { STREAMS } from "../../constants/appConstants";

export function StructureTab({ feeStructure, setFeeStructure, classes, subjectsList, onSaveClasses, onSaveSubjects, streams, onSaveStreams }) {
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
      <div className="border rounded-sm overflow-hidden mb-5 max-w-full" style={{ borderColor: "#12312B" }}>
      <div className="flex overflow-x-auto no-scrollbar">
        <button onClick={() => setSubTab("fees")} className="px-4 py-2 text-xs font-semibold shrink-0 whitespace-nowrap" style={{ background: subTab === "fees" ? "#12312B" : "white", color: subTab === "fees" ? "#F4EFDE" : "#12312B" }}>
          Fee Matrix Pricing
        </button>
        <button onClick={() => setSubTab("classes")} className="px-4 py-2 text-xs font-semibold shrink-0 whitespace-nowrap" style={{ background: subTab === "classes" ? "#12312B" : "white", color: subTab === "classes" ? "#F4EFDE" : "#12312B", borderLeft: "1px solid #12312B" }}>
          Class & Subject List
        </button>
        <button onClick={() => setSubTab("streams")} className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5 shrink-0 whitespace-nowrap" style={{ background: subTab === "streams" ? "#12312B" : "white", color: subTab === "streams" ? "#F4EFDE" : "#12312B", borderLeft: "1px solid #12312B" }}>
          <Tag size={13} /> Manage Streams
        </button>
      </div>
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


export function ClassSubjectManager({ classes, subjectsList, onSaveClasses, onSaveSubjects }) {
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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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


export function StreamManagerPanel({ streams, onSave }) {
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

