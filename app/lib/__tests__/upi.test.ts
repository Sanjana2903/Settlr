import { buildUpiPaymentLink, isValidVpa } from '../upi';

describe('isValidVpa', () => {
  it('accepts typical UPI IDs', () => {
    expect(isValidVpa('jane.doe@okhdfcbank')).toBe(true);
    expect(isValidVpa('9876543210@ybl')).toBe(true);
  });

  it('rejects strings without an @ or with spaces', () => {
    expect(isValidVpa('not-a-vpa')).toBe(false);
    expect(isValidVpa('jane doe@okhdfcbank')).toBe(false);
    expect(isValidVpa('')).toBe(false);
  });
});

describe('buildUpiPaymentLink', () => {
  it('builds a upi://pay link with the expected fields', () => {
    const link = buildUpiPaymentLink({
      payeeVpa: 'jane.doe@okhdfcbank',
      payeeName: 'Jane Doe',
      amount: 250.5,
      note: 'Goa Trip',
    });

    expect(link).toBe('upi://pay?pa=jane.doe%40okhdfcbank&pn=Jane%20Doe&am=250.50&cu=INR&tn=Goa%20Trip');
  });

  it('rejects an invalid payee VPA', () => {
    expect(() =>
      buildUpiPaymentLink({ payeeVpa: 'not-a-vpa', payeeName: 'Jane', amount: 100, note: 'x' })
    ).toThrow();
  });

  it('rejects a zero or negative amount', () => {
    expect(() =>
      buildUpiPaymentLink({ payeeVpa: 'jane@okhdfcbank', payeeName: 'Jane', amount: 0, note: 'x' })
    ).toThrow();
  });
});
