import { fmtDate } from "./dates";
import { getReceiptNo } from "./ids";

export function sendWhatsAppReceipt(deposit, student, totalRemainingDue) {
  if (!student || !student.phone) {
    alert("No phone number registered for this student.");
    return;
  }
  const cleanPhone = student.phone.replace(/[^0-9]/g, "");
  const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const receiptNo = getReceiptNo(deposit.id);
  const woLine = deposit.writeOffAmount > 0 ? `\n*Discount/Write-off:* ₹${deposit.writeOffAmount}` : "";
  const refLine = deposit.utr ? `\n*Reference/UTR:* ${deposit.utr}` : (deposit.chequeNumber ? `\n*Cheque No:* ${deposit.chequeNumber}` : "");
  const msg = `*FEE PAYMENT RECEIPT*\n----------------------------------------\n*Receipt No:* #${receiptNo}\n*Date:* ${fmtDate(deposit.date)}\n*Student Name:* ${student.name}\n*Class:* ${student.class}\n*Payment Mode:* ${deposit.mode || "Cash"}${refLine}\n----------------------------------------\n*Amount Paid Today:* ₹${deposit.amount}${woLine}\n*Remaining Balance:* ₹${totalRemainingDue}\n*Status:* ACKNOWLEDGED ✅\n----------------------------------------\nThank you for your payment!`;
  window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`, "_blank");
}

// ============================================================================
// LEDGER ENGINE — the single source of truth for "how much does this student
// owe". Everything (tuition accrual, ad-hoc charges, payments, write-offs)
// becomes one chronological list of debit/credit lines, credits are applied
// oldest-charge-first, and a running balance falls out naturally. This is
// what powers Dues, the Dashboard totals, and the per-student Statement.
// ============================================================================

