const VPA_PATTERN = /^[a-zA-Z0-9.\-_]+@[a-zA-Z0-9.\-_]+$/;

export function isValidVpa(vpa: string): boolean {
  return VPA_PATTERN.test(vpa.trim());
}

export function buildUpiPaymentLink(params: {
  payeeVpa: string;
  payeeName: string;
  amount: number;
  note: string;
}): string {
  if (!isValidVpa(params.payeeVpa)) {
    throw new Error(`"${params.payeeVpa}" doesn't look like a valid UPI ID`);
  }
  if (!(params.amount > 0)) {
    throw new Error('Amount must be greater than zero');
  }

  // Built by hand rather than via URLSearchParams -- not guaranteed available
  // in every RN/Hermes runtime, and this is only five fixed fields anyway.
  const query = [
    ['pa', params.payeeVpa.trim()],
    ['pn', params.payeeName],
    ['am', params.amount.toFixed(2)],
    ['cu', 'INR'],
    ['tn', params.note],
  ]
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  return `upi://pay?${query}`;
}
