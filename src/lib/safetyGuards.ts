/**
 * Safety Guards & Defensive Programming Utilities
 * Broomies Order Management System (OMS)
 * Guarantees zero runtime crashes, safe array operations, and robust state mutations.
 */

/**
 * Safely parse JSON with a default fallback
 */
export function safeJsonParse<T>(jsonString: string | null | undefined, fallback: T): T {
  if (!jsonString) return fallback;
  try {
    return JSON.parse(jsonString) as T;
  } catch (err) {
    console.warn('[safetyGuards] JSON parse error, returning fallback:', err);
    return fallback;
  }
}

/**
 * Ensures a value is an array; returns empty array if null, undefined or invalid
 */
export function safeArray<T>(arr: T[] | null | undefined): T[] {
  return Array.isArray(arr) ? arr : [];
}

/**
 * Safely access string properties with a trimmed default
 */
export function safeString(val: unknown, fallback: string = ''): string {
  if (typeof val === 'string') return val;
  if (val === null || val === undefined) return fallback;
  return String(val);
}

/**
 * Safely convert to a valid number with fallback
 */
export function safeNumber(val: unknown, fallback: number = 0): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}

/**
 * Safely format phone number removing special characters
 */
export function safeCleanPhone(phone: unknown): string {
  const str = safeString(phone);
  return str.replace(/[^0-9+]/g, '');
}
