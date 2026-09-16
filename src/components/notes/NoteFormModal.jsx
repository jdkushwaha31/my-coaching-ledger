import { useState } from "react";
import { Field, Modal, inputCls, inputStyle } from "../common/UI";

export function NoteFormModal({ initial, onClose, onSave }) {
  const [title, setTitle] = useState(initial ? initial.title || "" : "");
  const [body, setBody] = useState(initial ? initial.body || "" : "");

  function submit() {
    if (!title.trim() && !body.trim()) return;
    onSave({ id: initial ? initial.id : null, title: title.trim(), body: body.trim() });
  }

  return (
    <Modal title={initial ? "Edit Note" : "Add Note"} onClose={onClose}>
      <div className="text-xs text-[#6E6650] mb-3">A quick note for the office — a reminder, a follow-up, anything worth writing down. This does not affect any student's fees or dues.</div>

      <Field label="Title"><input className={inputCls} style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Call Priya's parent about fee date" autoFocus /></Field>

      <Field label="Note">
        <textarea className={inputCls} style={{ ...inputStyle, minHeight: "120px", resize: "vertical" }} value={body} onChange={e => setBody(e.target.value)} placeholder="Write as much detail as you need…" />
      </Field>

      <button onClick={submit} disabled={!title.trim() && !body.trim()} className="w-full mt-1 py-2.5 rounded-sm text-sm font-medium disabled:opacity-40" style={{ background: "#12312B", color: "#F4EFDE" }}>
        {initial ? "Save Changes" : "Add Note"}
      </button>
    </Modal>
  );
}

