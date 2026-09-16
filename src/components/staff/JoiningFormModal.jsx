import React, { useRef } from "react";
import { Printer } from "lucide-react";
import { InstituteHeader, Stamp, WideModal } from "../common/UI";
import { FONT_IMPORT } from "../../constants/appConstants";
import { InstituteSettingsContext } from "../../contexts/InstituteSettingsContext";
import { fmtDate, todayStr } from "../../lib/dates";
import { shortId } from "../../lib/ids";
import { fmtINR } from "../../lib/money";

// Shared Joining / Appointment Form print for both Teachers and Staff —
// same visual template as the Student Joining Form (JoiningFormModal in
// StudentModals.jsx), just with the fields that actually exist on a
// Teacher/Staff record (no Class/Stream/Fee section, adds
// Designation/Expertise Subjects/Salary instead). `personType` picks
// between "teacher" and "staff" so labels, the printed ID (Teacher ID vs
// Staff ID), and teacher-only fields (Expertise Subjects) render right.

export function StaffJoiningFormModal({ person, personType, onClose }) {
  const formRef = useRef();
  const instituteSettings = React.useContext(InstituteSettingsContext);
  if (!person) return null;

  const isTeacher = personType === "teacher";
  const displayId = isTeacher ? person.teacherId : person.staffId;
  const idLabel = isTeacher ? "Teacher ID" : "Staff ID";
  const appointmentNo = `APT-${shortId(person.id)}`;
  const roleLabel = isTeacher ? "Teacher" : (person.title || "Staff");

  const handlePrint = () => {
    const printContent = formRef.current.innerHTML;
    const win = window.open("", "", "width=900,height=1000");
    win.document.write(`
      <html>
        <head>
          <title>Joining Form - ${person.name}</title>
          <style>
            ${FONT_IMPORT}
            @page { size: A4; margin: 16mm; }
            body { font-family: 'Inter', sans-serif; padding: 0; color: #12312B; }
            .form-box { max-width: 100%; margin: auto; border: 1.5px solid #B8862B; padding: 22px; border-radius: 4px; }
            .form-box::before { content: ""; display: block; height: 3px; background: #12312B; margin: -22px -22px 18px -22px; }
            .admission-no { text-align: right; font-family: monospace; font-size: 11px; color: #8A6420; letter-spacing: 0.06em; margin-bottom: 4px; }
            .header { text-align: center; border-bottom: 2px dashed #12312B; padding-bottom: 12px; margin-bottom: 18px; }
            .section-title { font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #8A6420; border-bottom: 1px solid #D8CFB8; padding-bottom: 4px; margin: 18px 0 10px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; }
            .row { font-size: 13px; padding: 6px 0; border-bottom: 1px dotted #D8CFB8; display: flex; justify-content: space-between; }
            .label { color: #6E6650; }
            .value { font-weight: 600; color: #12312B; }
            .footer { border-top: 1.5px solid #12312B; padding-top: 10px; margin-top: 24px; text-align: center; font-size: 10px; color: #6E6650; }
            .sign-row { display: flex; justify-content: space-between; margin-top: 60px; font-size: 12px; }
            .sign-line { border-top: 1px solid #12312B; padding-top: 4px; width: 200px; text-align: center; }
          </style>
        </head>
        <body><div class="form-box">${printContent}</div></body>
      </html>
    `);
    win.document.close(); win.focus(); win.print(); win.close();
  };

  const statusLabel = (person.status || "active") === "active" ? "Active" : "Inactive";
  const statusTone = (person.status || "active") === "active" ? "paid" : "overdue";

  return (
    <WideModal title={`${isTeacher ? "Teacher" : "Staff"} Joining Form`} onClose={onClose}>
      <div
        className="joining-form-doc p-6 bg-white rounded-sm mb-4"
        ref={formRef}
        style={{ border: "1.5px solid #B8862B", borderRadius: "4px", boxShadow: "0 1px 3px rgba(18,49,43,0.08)" }}
      >
        <div className="text-right font-mono text-[11px] mb-1" style={{ color: "#8A6420", letterSpacing: "0.06em" }}>{appointmentNo}</div>
        <div className="header">
          <InstituteHeader subtitle={`${isTeacher ? "Teacher" : "Staff"} Joining / Appointment Form`} large={true} />
        </div>

        <div className="section-title">Personal Details</div>
        <div className="grid">
          <div className="row"><span className="label">Full Name</span><span className="value">{person.name || "—"}</span></div>
          <div className="row"><span className="label">{idLabel}</span><span className="value">{displayId || "—"}</span></div>
          {!isTeacher && <div className="row"><span className="label">Title / Designation</span><span className="value">{person.title || "—"}</span></div>}
          {isTeacher && <div className="row"><span className="label">Role</span><span className="value">{roleLabel}</span></div>}
          <div className="row"><span className="label">Gender</span><span className="value">{person.gender || "—"}</span></div>
          <div className="row"><span className="label">Date of Birth</span><span className="value">{person.dob ? fmtDate(person.dob) : "—"}</span></div>
          <div className="row"><span className="label">Joining Date</span><span className="value">{person.joiningDate ? fmtDate(person.joiningDate) : "—"}</span></div>
          <div className="row"><span className="label">Status</span><span className="value"><Stamp text={statusLabel} tone={statusTone} /></span></div>
          <div className="row"><span className="label">Aadhar Number</span><span className="value">{person.aadharNumber || "—"}</span></div>
        </div>

        <div className="section-title">Contact Details</div>
        <div className="grid">
          <div className="row"><span className="label">Phone Number</span><span className="value">{person.phone || "—"}</span></div>
          <div className="row"><span className="label">Emergency Contact</span><span className="value">{person.guardianPhone || "—"}</span></div>
          <div className="row"><span className="label">Email Address</span><span className="value">{person.email || "—"}</span></div>
        </div>
        <div className="row"><span className="label">Address</span><span className="value">{person.address || "—"}</span></div>

        {isTeacher && (
          <>
            <div className="section-title">Academic Details</div>
            <div className="row"><span className="label">Expertise Subjects</span><span className="value">{(person.expertiseSubjects || []).join(", ") || "—"}</span></div>
            {(person.qualifications || []).length > 0 && (
              <div className="row"><span className="label">Qualifications</span><span className="value">{person.qualifications.map(q => `${q.degree}${q.institution ? ` — ${q.institution}` : ""}${q.year ? ` (${q.year})` : ""}`).join(", ")}</span></div>
            )}
          </>
        )}

        <div className="section-title">Employment Details</div>
        <div className="grid">
          <div className="row"><span className="label">Current Salary</span><span className="value">{fmtINR(person.salaryAmount || 0)}</span></div>
          <div className="row"><span className="label">Payment Mode</span><span className="value">{person.paymentMode || "—"}</span></div>
          <div className="row"><span className="label">Form Generated On</span><span className="value">{fmtDate(todayStr())}</span></div>
        </div>

        <div className="sign-row">
          <div className="sign-line">{isTeacher ? "Teacher" : "Staff"} Signature</div>
          <div className="sign-line">Authorized Signatory</div>
        </div>

        <div className="footer">
          Computer Generated Joining Form · {instituteSettings.instituteName || "COACHING CLASSES"} {isTeacher ? "Teacher" : "Staff"} Record · {appointmentNo}
        </div>
      </div>
      <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold text-white bg-[#12312B]"><Printer size={15} /> Print Joining Form (A4)</button>
    </WideModal>
  );
}
