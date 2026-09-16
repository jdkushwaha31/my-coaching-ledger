import { useState } from "react";
import { Landmark } from "lucide-react";
import { Field, Modal, inputCls, inputStyle } from "../common/UI";

export const SETTINGS_SUB_TABS = [
  { id: "institute-info", label: "Institute Information", icon: Landmark },
];


export function SettingsModal({ initial, onClose, onSave }) {
  const [subTab, setSubTab] = useState("institute-info");
  const [instituteName, setInstituteName] = useState(initial?.instituteName || "");
  const [tagline, setTagline] = useState(initial?.tagline || "");
  const [address, setAddress] = useState(initial?.address || "");
  const [mobileNumber, setMobileNumber] = useState(initial?.mobileNumber || "");
  const [telephoneNumber, setTelephoneNumber] = useState(initial?.telephoneNumber || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [gstNumber, setGstNumber] = useState(initial?.gstNumber || "");

  function submit() {
    onSave({
      instituteName: instituteName.trim() || "COACHING CLASSES",
      tagline: tagline.trim(), address: address.trim(),
      mobileNumber: mobileNumber.trim(), telephoneNumber: telephoneNumber.trim(),
      email: email.trim(), gstNumber: gstNumber.trim(),
    });
  }

  return (
    <Modal title="Settings" onClose={onClose}>
      {/* Individual chip buttons (own border + rounded corners each) —
          same pattern used for Recycle Bin / Banking's sub-tab rows, so
          this stays robust if more Settings categories are added later
          and the row needs to wrap. */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {SETTINGS_SUB_TABS.map(st => {
          const Icon = st.icon;
          const active = subTab === st.id;
          return (
            <button key={st.id} onClick={() => setSubTab(st.id)}
              className="px-3 py-1.5 text-xs font-semibold rounded-sm border flex items-center gap-1.5"
              style={{ background: active ? "#12312B" : "white", color: active ? "#F4EFDE" : "#12312B", borderColor: "#12312B" }}>
              <Icon size={13} /> {st.label}
            </button>
          );
        })}
      </div>

      {subTab === "institute-info" && (
        <>
          <div className="text-sm text-[#6E6650] mb-3">This appears on every printed receipt, slip, and statement in place of the default "COACHING CLASSES" placeholder.</div>
          <Field label="Institute Name"><input className={inputCls} style={inputStyle} value={instituteName} onChange={e => setInstituteName(e.target.value)} placeholder="e.g. Horizon Coaching Classes" /></Field>
          <Field label="Tagline (optional)"><input className={inputCls} style={inputStyle} value={tagline} onChange={e => setTagline(e.target.value)} placeholder="e.g. Excellence in JEE & NEET Coaching" /></Field>
          <Field label="Address (optional)"><input className={inputCls} style={inputStyle} value={address} onChange={e => setAddress(e.target.value)} placeholder="Street / area / city" /></Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Mobile Number (optional)"><input className={inputCls} style={inputStyle} value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} /></Field>
            <Field label="Telephone Number (optional)"><input className={inputCls} style={inputStyle} value={telephoneNumber} onChange={e => setTelephoneNumber(e.target.value)} /></Field>
          </div>
          <Field label="Email Address (optional)"><input type="email" className={inputCls} style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. office@institute.com" /></Field>
          <Field label="GST / Registration No. (optional)"><input className={inputCls} style={inputStyle} value={gstNumber} onChange={e => setGstNumber(e.target.value)} /></Field>
        </>
      )}

      <button onClick={submit} className="w-full mt-2 py-2.5 rounded-sm text-sm font-medium" style={{ background: "#12312B", color: "#F4EFDE" }}>
        Save Settings
      </button>
    </Modal>
  );
}

