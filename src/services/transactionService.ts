// Shared formatting + session helpers still imported across the persistent
// player shell. Legacy /transactions/buy|sell|portfolio|user HTTP helpers
// were removed with the Apocalypse cutover — trades go through persistentService.

// Custom error class for session expired errors
export class SessionExpiredError extends Error {
  constructor(message: string = 'Your session has expired. Please log in again.') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

export function formatCurrency(value: number) {
  return value.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parsePrice(price: string | number): number {
  if (typeof price === 'string') {
    // Remove display formatting before converting API values to numbers.
    const cleanPrice = price.replace(/[£,\s]/g, '');
    return parseFloat(cleanPrice);
  }
  return price;
}
