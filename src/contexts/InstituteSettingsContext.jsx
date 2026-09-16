import React from "react";

export const DEFAULT_INSTITUTE_SETTINGS = { instituteName: "COACHING CLASSES", tagline: "", address: "", mobileNumber: "", telephoneNumber: "", email: "", gstNumber: "" };


export const InstituteSettingsContext = React.createContext(DEFAULT_INSTITUTE_SETTINGS);

// Shared header block for every printable document (receipts, slips,
// statements, forms) — previously each of the 12 print templates had its
// own hardcoded "COACHING CLASSES" <h2> + subtitle <p>, duplicated
// verbatim. Now one component, reading institute name/address/phone from
// Settings (falling back to the same "COACHING CLASSES" placeholder if
// nothing's been set yet, so nothing looks broken pre-setup).

