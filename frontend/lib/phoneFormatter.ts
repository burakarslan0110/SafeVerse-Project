/**
 * Formats a phone number to Turkish format: (555) 555 55 55
 * Removes all non-digit characters and formats as user types
 */
export function formatPhoneNumber(value: string): string {
  // Remove all non-digit characters
  let digits = value.replace(/\D/g, '');

  // Handle common Turkish formats
  // If starts with 0090 international prefix
  if (digits.startsWith('0090')) {
    digits = digits.substring(4);
  }
  // If starts with country code 90
  if (digits.startsWith('90')) {
    digits = digits.substring(2);
  }
  // If starts with trunk prefix 0
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.substring(1);
  }

  // Keep only the last 10 digits in case longer input slips through
  if (digits.length > 10) {
    digits = digits.slice(-10);
  }

  // Limit to 10 digits (Turkish national number)
  const limited = digits.slice(0, 10);

  if (limited.length === 0) return '';
  if (limited.length <= 3) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  if (limited.length <= 8) return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)} ${limited.slice(6)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)} ${limited.slice(6, 8)} ${limited.slice(8)}`;
}

/**
 * Removes formatting from phone number to get raw digits
 */
export function unformatPhoneNumber(value: string): string {
  // Return national 10-digit number for Turkey
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('0090')) digits = digits.substring(4);
  if (digits.startsWith('90')) digits = digits.substring(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.substring(1);
  if (digits.length > 10) digits = digits.slice(-10);
  return digits;
}

/**
 * Validates if phone number is complete (10 digits)
 */
export function isValidPhoneNumber(value: string): boolean {
  const digits = unformatPhoneNumber(value);
  return digits.length === 10;
}

/**
 * Normalize a phone number to E.164 for Turkey (+90XXXXXXXXXX)
 */
export function normalizeToE164TR(value: string): string {
  const national = unformatPhoneNumber(value); // 10 digits
  return national ? `+90${national}` : '';
}
