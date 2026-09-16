export const APP_PASSWORD = "958906"; 


export const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');`;


export const DEFAULT_CLASSES = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];


export const DEFAULT_SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Science", "Hindi", "English", "Social Studies", "Computer"];


export const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
// Full month names, used only by fmtDate() for the "D Month YYYY" display format.


export const FULL_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];


export const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Cheque"];


export const EXPENSE_CATEGORIES = ["Rent", "Electricity", "Staff Salary", "Stationery", "Maintenance", "Marketing", "Internet / Phone", "Furniture", "Miscellaneous"];

// Streams / academic tracks — shown on the Student form and used as a
// filter in the Students Directory. Kept as a flat list (not tied to
// class) since the same stream label can apply across senior classes,
// diplomas, and degree-level admissions.


export const STREAMS = [
  "PCM", "PCB", "PCM+B", "PCB+M", "Commerce", "Arts", "Engineering",
  "Graduate", "Under Graduate", "Post Graduate", "Other",
];

// Reference types used whenever a bank-side transaction needs a paper
// trail — Cash ⇄ Bank transfers and the Credit / Loan ledger both reuse
// this same set so the UI and stored field names stay consistent.


export const REFERENCE_TYPES = ["None", "UTR Number", "Cheque Number", "Reference Number"];

// Who the other side of a Credit / Loan entry is.


export const CREDIT_PARTY_TYPES = ["Person", "Company", "Bank", "Other"];
// How the money actually moved for a Credit / Loan entry or an Interest
// Payment against one — Cash stays in the Cash Balance, Online covers
// UPI / Bank Transfer / NEFT / IMPS and stays in the Bank Balance.


export const CREDIT_MODES = ["Cash", "Online"];

// Exit reasons — used whenever a student leaves an active billing cycle.


export const EXIT_REASONS = [
  { value: "Passed", label: "Passed — completed this class", status: "on_break" },
  { value: "Repeat", label: "Repeating this class next session", status: "on_break" },
  { value: "Gap", label: "On Break / Gap (temporary pause)", status: "on_break" },
  { value: "Dropped", label: "Dropped Out (leaving permanently)", status: "dropped" },
];

