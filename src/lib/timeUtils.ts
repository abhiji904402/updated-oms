import { Order } from '../types';

export interface DeliveryTimeInfo {
  expectedFormatted: string;
  actualFormatted: string;
  delayMinutes: number;
  delayText: string;
  isOverdue: boolean;
}

export interface CountdownInfo {
  text: string;
  minutesRemaining: number;
  urgency: 'overdue' | 'critical' | 'warning' | 'normal' | 'completed';
  badgeColorClass: string;
}

/**
 * Parses time string like "14:30" or "2:30 PM" or "14:30:00" on a given date string "YYYY-MM-DD"
 */
function parseDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr) return null;
  const cleanDate = dateStr.trim();
  if (!timeStr) {
    const d = new Date(cleanDate);
    return isNaN(d.getTime()) ? null : d;
  }

  const cleanTime = timeStr.trim();

  // Try parsing ISO or standard date string
  if (cleanTime.includes('T')) {
    const d = new Date(cleanTime);
    if (!isNaN(d.getTime())) return d;
  }

  // Parse HH:MM or HH:MM AM/PM
  let hours = 0;
  let minutes = 0;

  const isPM = /pm/i.test(cleanTime);
  const isAM = /am/i.test(cleanTime);
  const digits = cleanTime.replace(/[^0-9:]/g, '').split(':');

  if (digits.length >= 1) {
    hours = parseInt(digits[0], 10) || 0;
  }
  if (digits.length >= 2) {
    minutes = parseInt(digits[1], 10) || 0;
  }

  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  const yearParts = cleanDate.split('-').map(Number);
  if (yearParts.length === 3) {
    const [y, m, d] = yearParts;
    return new Date(y, m - 1, d, hours, minutes, 0);
  }

  const fallback = new Date(`${cleanDate} ${hours}:${minutes}:00`);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Gets expected timestamp for an order in milliseconds
 */
export function getExpectedTimestamp(order: Order): number {
  const dateStr = order.delivery_date || order.order_date || new Date().toISOString().split('T')[0];
  const expectedTimeStr = order.delivery_time_expected || order.order_time || '18:00';
  const expectedDate = parseDateTime(dateStr, expectedTimeStr);
  return expectedDate ? expectedDate.getTime() : 0;
}

/**
 * Formats any time or date-time string into standard 12-Hour format (e.g., "06:30 PM")
 */
export function formatTo12Hour(timeStr?: string | null): string {
  if (!timeStr) return '';
  const str = timeStr.trim();
  if (!str) return '';

  // If already contains AM or PM (case insensitive), normalize format
  if (/am|pm/i.test(str)) {
    const match = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)$/i);
    if (match) {
      const h = parseInt(match[1], 10);
      const m = match[2];
      const ampm = match[3].toUpperCase();
      const hStr = h < 10 ? `0${h}` : `${h}`;
      return `${hStr}:${m} ${ampm}`;
    }
    return str.toUpperCase();
  }

  // Check if it's an ISO or full Date string
  if (str.includes('T') || str.includes('Z')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
  }

  // Match 24-hour HH:MM or HH:MM:SS format (e.g., "18:30" or "09:15:00")
  const match24 = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match24) {
    let hours = parseInt(match24[1], 10);
    const minutes = match24[2];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const hStr = hours < 10 ? `0${hours}` : `${hours}`;
    return `${hStr}:${minutes} ${ampm}`;
  }

  return str;
}

/**
 * Returns current system time formatted in 12-hour AM/PM format (e.g., "10:30 AM")
 */
export function getCurrentTime12Hour(): string {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/**
 * Calculates Expected Delivery Time, Actual Delivery Time, and Delay in Minutes
 */
export function getDeliveryTimeInfo(order: Order): DeliveryTimeInfo {
  const dateStr = order.delivery_date || order.order_date || new Date().toISOString().split('T')[0];
  const expectedTimeStr = order.delivery_time_expected || order.order_time || '06:00 PM';

  const expectedDate = parseDateTime(dateStr, expectedTimeStr);

  // Format Expected Time in 12-Hour AM/PM
  let expectedFormatted = formatTo12Hour(expectedTimeStr);
  if (expectedDate) {
    expectedFormatted = expectedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  // Actual Delivery Time
  let actualDate: Date | null = null;
  let actualFormatted = 'Pending Delivery';

  if (order.actual_delivery_time) {
    const d = new Date(order.actual_delivery_time);
    if (!isNaN(d.getTime())) {
      actualDate = d;
      actualFormatted = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } else {
      actualFormatted = formatTo12Hour(order.actual_delivery_time);
    }
  } else if (order.status === 'delivered') {
    actualFormatted = 'Delivered';
  }

  // Calculate Delay
  let delayMinutes = 0;
  let isOverdue = false;

  if (expectedDate) {
    if (order.status === 'delivered' && actualDate) {
      // Delivered order: difference between actual delivery timestamp and expected timestamp
      const diffMs = actualDate.getTime() - expectedDate.getTime();
      delayMinutes = Math.max(0, Math.round(diffMs / (1000 * 60)));
      isOverdue = delayMinutes > 0;
    } else if (order.status !== 'delivered' && order.status !== 'cancelled') {
      // Pending / Active order: difference between NOW and expected timestamp if NOW > expected
      const now = new Date();
      if (now > expectedDate) {
        const diffMs = now.getTime() - expectedDate.getTime();
        delayMinutes = Math.max(0, Math.round(diffMs / (1000 * 60)));
        isOverdue = delayMinutes > 0;
      }
    }
  }

  let delayText = 'On Time (0 min)';
  if (delayMinutes > 0) {
    delayText = `${delayMinutes} min Delay`;
  }

  return {
    expectedFormatted,
    actualFormatted,
    delayMinutes,
    delayText,
    isOverdue
  };
}

/**
 * Calculates live Countdown Timer info for an order
 */
export function getCountdownInfo(order: Order, nowTime: number = Date.now()): CountdownInfo {
  if (order.status === 'delivered') {
    return {
      text: 'Delivered',
      minutesRemaining: 99999,
      urgency: 'completed',
      badgeColorClass: 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
    };
  }

  if (order.status === 'cancelled') {
    return {
      text: 'Cancelled',
      minutesRemaining: 99999,
      urgency: 'completed',
      badgeColorClass: 'bg-slate-900 text-slate-400 border border-slate-800'
    };
  }

  const dateStr = order.delivery_date || order.order_date || new Date().toISOString().split('T')[0];
  const expectedTimeStr = order.delivery_time_expected || order.order_time || '18:00';
  const expectedDate = parseDateTime(dateStr, expectedTimeStr);

  if (!expectedDate) {
    return {
      text: 'No Time Set',
      minutesRemaining: 99999,
      urgency: 'normal',
      badgeColorClass: 'bg-slate-900 text-slate-300 border border-slate-800'
    };
  }

  const diffMs = expectedDate.getTime() - nowTime;
  const diffMinutes = Math.round(diffMs / (1000 * 60));

  if (diffMinutes < 0) {
    const overdueMins = Math.abs(diffMinutes);
    const hrs = Math.floor(overdueMins / 60);
    const mins = overdueMins % 60;
    const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

    return {
      text: `⚠️ OVERDUE by ${timeStr}`,
      minutesRemaining: diffMinutes,
      urgency: 'overdue',
      badgeColorClass: 'bg-rose-600 text-white font-black animate-pulse shadow-lg shadow-rose-950/80 border border-rose-400'
    };
  }

  if (diffMinutes <= 30) {
    return {
      text: `⏰ ${diffMinutes} MIN LEFT`,
      minutesRemaining: diffMinutes,
      urgency: 'critical',
      badgeColorClass: 'bg-amber-500 text-slate-950 font-black animate-bounce border border-amber-300 shadow-md shadow-amber-950/80'
    };
  }

  if (diffMinutes <= 90) {
    const hrs = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

    return {
      text: `⏳ ${timeStr} left`,
      minutesRemaining: diffMinutes,
      urgency: 'warning',
      badgeColorClass: 'bg-amber-950/90 text-amber-300 font-extrabold border border-amber-800/70'
    };
  }

  const hrs = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

  return {
    text: `⏱️ ${timeStr} left`,
    minutesRemaining: diffMinutes,
    urgency: 'normal',
    badgeColorClass: 'bg-indigo-950/80 text-indigo-300 font-bold border border-indigo-800/60'
  };
}

/**
 * Sorts orders so that earliest due active orders appear first!
 */
export function sortOrdersByDeliveryPriority(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => {
    // Delivered / Cancelled / Rider Delivered / Confirmation Pending go to the bottom
    const aDone = a.status === 'delivered' || a.status === 'cancelled' || Boolean(a.rider_delivered) || Boolean(a.delivery_confirmation_pending);
    const bDone = b.status === 'delivered' || b.status === 'cancelled' || Boolean(b.rider_delivered) || Boolean(b.delivery_confirmation_pending);
    if (aDone && !bDone) return 1;
    if (!aDone && bDone) return -1;

    // Active orders sorted by expected time timestamp (earliest first)
    const timeA = getExpectedTimestamp(a);
    const timeB = getExpectedTimestamp(b);
    return timeA - timeB;
  });
}

