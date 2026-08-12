import { Order } from '../types';

/**
 * Normalizes an outlet string to a clean comparison token.
 * e.g., "Sector 42" -> "sector42", "sector_42" -> "sector42", "sec-42" -> "sec42"
 */
export function normalizeOutlet(raw?: string): string {
  if (!raw) return '';
  return raw.toLowerCase().trim().replace(/[-_\s]+/g, '');
}

/**
 * Flexible outlet matching.
 * Handles "Sector 42" vs "sector_42", "sec 42", "42", etc.
 */
export function matchesOutlet(orderOutlet?: string, targetOutlet?: string): boolean {
  if (!targetOutlet || targetOutlet === 'ALL' || targetOutlet === 'All Outlets') return true;
  if (!orderOutlet) return false;

  const normOrder = normalizeOutlet(orderOutlet);
  const normTarget = normalizeOutlet(targetOutlet);

  if (normOrder === normTarget) return true;
  if (normOrder.includes(normTarget) || normTarget.includes(normOrder)) return true;

  // Compare numerical sector digits (e.g. 31, 35, 42, 88)
  const targetDigits = normTarget.match(/\d+/)?.[0];
  const orderDigits = normOrder.match(/\d+/)?.[0];
  if (targetDigits && orderDigits && targetDigits === orderDigits) return true;

  return false;
}

/**
 * Formats outlet name nicely for display (e.g. "sector_42" -> "Sector 42")
 */
export function formatOutletDisplayName(raw?: string): string {
  if (!raw) return 'Sector 31';
  const clean = raw.trim();
  const digits = clean.match(/\d+/)?.[0];
  if (digits) {
    return `Sector ${digits}`;
  }
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Checks if an order is scheduled or placed for today
 */
export function isOrderForToday(o: Order, todayISO?: string): boolean {
  const dDate = o.delivery_date?.trim();
  const oDate = o.order_date?.trim();

  // If no date at all, consider it today so riders/outlets don't lose track
  if (!dDate && !oDate) return true;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const localToday = `${year}-${month}-${day}`;
  const isoToday = todayISO || localToday;

  const checkSingle = (dateStr?: string) => {
    if (!dateStr) return false;
    const clean = dateStr.trim();

    if (clean.startsWith(isoToday) || clean.startsWith(localToday)) return true;

    // Check YYYY-MM-DD
    const dateOnly = clean.split('T')[0];
    if (dateOnly === isoToday || dateOnly === localToday) return true;

    // Check DD/MM/YYYY or DD-MM-YYYY or MM/DD/YYYY
    const parts = dateOnly.split(/[/.-]/);
    if (parts.length === 3) {
      const p1 = parseInt(parts[0], 10);
      const p2 = parseInt(parts[1], 10);
      const p3 = parseInt(parts[2], 10);

      // DD/MM/YYYY or MM/DD/YYYY where year is p3
      if (p3 === year) {
        if ((p2 === now.getMonth() + 1 && p1 === now.getDate()) || (p1 === now.getMonth() + 1 && p2 === now.getDate())) {
          return true;
        }
      }
      // YYYY/MM/DD where year is p1
      if (p1 === year && p2 === now.getMonth() + 1 && p3 === now.getDate()) {
        return true;
      }
    }

    // Try standard Date parse
    const parsed = new Date(clean);
    if (!isNaN(parsed.getTime())) {
      return (
        parsed.getFullYear() === now.getFullYear() &&
        parsed.getMonth() === now.getMonth() &&
        parsed.getDate() === now.getDate()
      );
    }

    return false;
  };

  // Prioritize delivery_date. Evaluate order_date ONLY if delivery_date is not specified.
  if (dDate) {
    return checkSingle(dDate);
  }
  return checkSingle(oDate);
}
