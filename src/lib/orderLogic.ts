import { Order, OrderStatus } from '../types';

export type DashboardTab =
  | 'all'
  | 'today'
  | 'tomorrow'
  | 'future'
  | 'delivered_history'
  | 'pending_payment'
  | 'cancelled'
  | 'missed'
  | 'on_hold';

/**
 * Checks if an order is marked as delivered
 */
export const isDeliveredMarked = (o: Order): boolean => {
  return o.status === 'delivered' && !o.delivery_confirmation_pending;
};

/**
 * Checks if payment is pending on an order
 */
export const isPaymentPending = (o: Order): boolean => {
  const pType = String(o.payment_type || '').toLowerCase().trim();
  if (pType === 'full' || pType === 'full_paid' || pType === 'paid') {
    return false;
  }
  const total = Number(o.total_amount) || 0;
  const adv = Number(o.advance_amount) || 0;
  const rem = typeof o.remaining_balance === 'number' ? o.remaining_balance : Math.max(0, total - adv);
  const due = typeof o.due_amount === 'number' ? o.due_amount : 0;

  if (rem > 0 || due > 0) return true;
  if (pType === 'due' || pType === 'part' || pType === 'partial' || pType === 'part_payment' || pType === 'cod' || pType === 'unpaid') return true;

  return false;
};

/**
 * Normalizes date string into YYYY-MM-DD format
 */
export const getNormalizedDateStr = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  if (!clean) return '';
  if (clean.includes('T')) return clean.split('T')[0];
  return clean;
};

/**
 * Checks if order is for today date
 */
export const isOrderForToday = (order: Order, todayStr: string): boolean => {
  if (order.delivery_confirmation_pending) return true;
  const delDate = getNormalizedDateStr(order.delivery_date) || getNormalizedDateStr(order.order_date);
  return delDate === todayStr;
};

/**
 * Helper to get timestamp for sorting orders by date/time
 */
export const getOrderTimestamp = (order: Order): number => {
  if (order.actual_delivery_time) {
    const t = new Date(order.actual_delivery_time).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  const dateStr = order.order_date || order.delivery_date;
  const timeStr = order.order_time || order.delivery_time_expected;
  if (dateStr) {
    const ts = parseSafeDateTime(dateStr, timeStr);
    if (ts > 0) return ts;
  }
  if (order.created_at) {
    const cMs = new Date(order.created_at).getTime();
    if (!isNaN(cMs) && cMs > 0) return cMs;
  }
  return 0;
};

/**
 * Sorts orders based on active tab so recently dated / newest orders appear on top
 */
export const sortOrdersByTab = (orders: Order[], tab: DashboardTab): Order[] => {
  return [...orders].sort((a, b) => {
    const timeA = getOrderTimestamp(a);
    const timeB = getOrderTimestamp(b);
    const numA = a.order_number || 0;
    const numB = b.order_number || 0;

    if (tab === 'all') {
      // Strictly by Order # descending (Order #2607, #2606...)
      if (numB !== numA) return numB - numA;
      return timeB - timeA;
    }

    if (tab === 'delivered_history') {
      // Recently delivered / newest delivery date on top (DESCENDING)
      if (timeA !== timeB) return timeB - timeA;
      return numB - numA;
    }

    if (tab === 'future') {
      // Recently dated / newest future date on top (DESCENDING)
      if (timeA !== timeB) return timeB - timeA;
      return numB - numA;
    }

    if (tab === 'pending_payment' || tab === 'cancelled' || tab === 'missed' || tab === 'on_hold') {
      // Newest date / order number first
      if (timeA !== timeB) return timeB - timeA;
      return numB - numA;
    }

    // For TODAY and TOMORROW orders: sort newest punched / highest order number first, or by time
    if (timeA !== timeB) return timeB - timeA;
    return numB - numA;
  });
};

/**
 * Compute badge counts for all tabs
 */
export const computeTabCounts = (safeOrders: Order[], todayStr: string, tomorrowStr: string) => {
  let all = safeOrders.length;
  let today = 0, tomorrow = 0, future = 0, delivered_history = 0, pending_payment = 0, pending_payment_amount = 0, cancelled = 0, missed = 0, on_hold = 0;

  safeOrders.forEach((o) => {
    const isDel = isDeliveredMarked(o);
    const isCanc = o.status === 'cancelled';
    const isHold = o.status === 'on_hold';
    const isPayPending = isPaymentPending(o);
    const delDate = getNormalizedDateStr(o.delivery_date) || getNormalizedDateStr(o.order_date);

    const normDelDate = getNormalizedDateStr(o.delivery_date);

    if (isDel) delivered_history++;
    if (isCanc) cancelled++;
    if (isHold) on_hold++;

    if (isDel && isPayPending && !isCanc) {
      pending_payment++;
      const total = Number(o.total_amount) || 0;
      const adv = Number(o.advance_amount) || 0;
      const rem = typeof o.remaining_balance === 'number' ? o.remaining_balance : (total - adv);
      const due = typeof o.due_amount === 'number' ? o.due_amount : 0;
      const pendingAmt = rem > 0 ? rem : (due > 0 ? due : (total - adv));
      pending_payment_amount += Math.max(0, pendingAmt);
    }

    if (normDelDate && normDelDate < todayStr && !isDel && !isCanc) {
      missed++;
    }

    if (!isCanc && !isHold && !isDel && o.status !== 'missed') {
      if (delDate === todayStr || delDate <= todayStr) {
        today++;
      } else if (delDate === tomorrowStr) {
        tomorrow++;
      } else if (delDate > tomorrowStr) {
        future++;
      }
    }
  });

  return {
    all,
    today,
    tomorrow,
    future,
    delivered_history,
    pending_payment,
    pending_payment_amount,
    cancelled,
    missed,
    on_hold
  };
};

/**
 * Calculates the next sequential order number based on existing orders.
 */
export function getNextOrderNumber(ordersList: Order[], defaultStart: number = 1): number {
  if (!ordersList || ordersList.length === 0) return defaultStart;
  let max = 0;
  ordersList.forEach((o) => {
    const num = Number(o.order_number);
    if (!isNaN(num) && num > 0 && Number.isInteger(num)) {
      if (num > max) max = num;
    }
  });
  return max > 0 ? max + 1 : defaultStart;
}

/**
 * Robust helper to safely parse any date and time string into a unix timestamp (milliseconds).
 * Supports ISO (YYYY-MM-DD), Indian standard (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY), and 12-hour/24-hour time.
 */
export function parseSafeDateTime(dateStr?: string | null, timeStr?: string | null): number {
  if (!dateStr && !timeStr) return 0;

  let d = dateStr ? String(dateStr).trim() : '';
  if (d.includes('T')) {
    d = d.split('T')[0];
  }

  let year = 0;
  let month = 0;
  let day = 0;

  if (d) {
    // Check if DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const dmy = d.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (dmy) {
      day = parseInt(dmy[1], 10);
      month = parseInt(dmy[2], 10) - 1;
      year = parseInt(dmy[3], 10);
    } else {
      // Check if YYYY-MM-DD or YYYY/MM/DD
      const ymd = d.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
      if (ymd) {
        year = parseInt(ymd[1], 10);
        month = parseInt(ymd[2], 10) - 1;
        day = parseInt(ymd[3], 10);
      }
    }
  }

  // Fallback to standard Date constructor if regex didn't match
  if (!year || isNaN(year)) {
    const rawParsed = d ? new Date(d).getTime() : 0;
    if (!isNaN(rawParsed) && rawParsed > 0) {
      return rawParsed;
    }
    return 0;
  }

  let hours = 0;
  let minutes = 0;

  if (timeStr) {
    const cleanTime = String(timeStr).trim().toUpperCase();
    const isPM = cleanTime.includes('PM');
    const isAM = cleanTime.includes('AM');
    const digits = cleanTime.replace(/[^0-9:]/g, '').split(':');
    if (digits.length >= 1 && digits[0]) {
      let h = parseInt(digits[0], 10) || 0;
      let m = parseInt(digits[1] || '0', 10) || 0;
      if (isPM && h < 12) h += 12;
      if (isAM && h === 12) h = 0;
      hours = Math.min(23, Math.max(0, h));
      minutes = Math.min(59, Math.max(0, m));
    }
  }

  const dt = new Date(year, month, day, hours, minutes, 0, 0);
  const ts = dt.getTime();
  return isNaN(ts) ? 0 : ts;
}

/**
 * Helper to get the exact chronological punch timestamp of an order based on order_date and order_time.
 */
export function getOrderChronologicalTime(order: Partial<Order>): number {
  // 1. Order punch date & time (primary source)
  const oDate = order.order_date;
  const oTime = order.order_time;
  if (oDate) {
    const ts = parseSafeDateTime(oDate, oTime);
    if (ts > 0) return ts;
  }

  // 2. Fallback to created_at system timestamp
  if (order.created_at) {
    const cTime = new Date(order.created_at).getTime();
    if (!isNaN(cTime) && cTime > 0) {
      return cTime;
    }
  }

  return 0;
}

/**
 * Normalizes any order date string to standard YYYY-MM-DD for accurate descending chronological sorting.
 */
export function getNormalizedOrderDateStr(dateStr?: string | null): string {
  if (!dateStr) return '';
  let d = String(dateStr).trim();
  if (d.includes('T')) d = d.split('T')[0];

  // Match DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (supports 2 or 4 digit years)
  const dmy = d.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    let year = dmy[3];
    if (year.length === 2) {
      year = `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  // Match YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const ymd = d.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymd) {
    const year = ymd[1];
    const month = ymd[2].padStart(2, '0');
    const day = ymd[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Try standard Date parsing for dates like "15 Aug 2026"
  const parsedTs = Date.parse(d);
  if (!isNaN(parsedTs)) {
    try {
      const parsedDate = new Date(parsedTs);
      const y = parsedDate.getFullYear();
      const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const day = String(parsedDate.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    } catch (e) {}
  }

  return d;
}

/**
 * Converts order time string (12-hour AM/PM or 24-hour) into total minutes from midnight for accurate descending sort.
 */
export function getOrderTimeInMinutes(timeStr?: string | null): number {
  if (!timeStr) return 0;
  let clean = String(timeStr).trim().toUpperCase();
  const isPM = clean.includes('PM');
  const isAM = clean.includes('AM');

  // Convert dot-separated times e.g. "4.30 PM" -> "4:30 PM" or "16.45" -> "16:45"
  clean = clean.replace(/(\d+)\.(\d+)/, '$1:$2');

  const digits = clean.replace(/[^0-9:]/g, '').split(':');
  if (digits.length >= 1 && digits[0]) {
    let h = parseInt(digits[0], 10) || 0;
    let m = parseInt(digits[1] || '0', 10) || 0;
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    return Math.min(23, Math.max(0, h)) * 60 + Math.min(59, Math.max(0, m));
  }
  return 0;
}

/**
 * Re-sequences orders starting from a starting number (default 1):
 * 1. Sorts all records in ASCENDING chronological order based on 'order_date' (oldest first).
 * 2. If 'order_date' is the same, sorts further in ASCENDING order based on 'order_time' (earliest time first).
 * 3. Assigns 'order_number' (and 'order_id') sequentially: oldest = #1, newest = #N.
 * 4. UNDER NO CIRCUMSTANCES DOES IT MODIFY, UPDATE, OR TOUCH THE 'delivery_date' FIELD.
 */
export function resequenceOrderNumbers(
  ordersList: Order[],
  startNumber: number = 1
): Order[] {
  if (!ordersList || ordersList.length === 0) return [];
  
  const sorted = [...ordersList].sort((a, b) => {
    // 1. Primary Sort: order_date in ASCENDING order (oldest date first)
    const dateA = getNormalizedOrderDateStr(a.order_date || a.created_at);
    const dateB = getNormalizedOrderDateStr(b.order_date || b.created_at);

    if (dateA !== dateB) {
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA.localeCompare(dateB); // Ascending (oldest date first)
    }

    // 2. Secondary Sort: order_time in ASCENDING order (earliest time first for same date)
    const timeA = getOrderTimeInMinutes(a.order_time || (a.created_at ? new Date(a.created_at).toTimeString() : ''));
    const timeB = getOrderTimeInMinutes(b.order_time || (b.created_at ? new Date(b.created_at).toTimeString() : ''));

    if (timeA !== timeB) {
      return timeA - timeB; // Ascending (earlier time first)
    }

    // Tie-breaker 1: created_at timestamp ascending
    const createA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const createB = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (createA !== createB && createA > 0 && createB > 0) {
      return createA - createB;
    }

    // Tie-breaker 2: existing order_number / order_id ascending
    const numA = Number(a.order_number || a.order_id) || 0;
    const numB = Number(b.order_number || b.order_id) || 0;
    if (numA !== numB && numA > 0 && numB > 0) {
      return numA - numB;
    }

    return (a.id || '').localeCompare(b.id || '');
  });

  let currentNum = Math.max(1, Math.floor(startNumber));
  const now = new Date().toISOString();

  // Assign sequential order_id & order_number WITHOUT touching delivery_date
  return sorted.map((ord) => {
    // If customer name was auto-generated like "Customer #2584", update it to match new order ID
    let finalCustomerName = ord.customer_name;
    if (finalCustomerName && /^Customer\s*#\s*\d+$/i.test(finalCustomerName.trim())) {
      finalCustomerName = `Customer #${currentNum}`;
    }

    const updated: Order = {
      ...ord,
      order_id: currentNum,
      order_number: currentNum,
      customer_name: finalCustomerName || ord.customer_name,
      // CRITICAL CONSTRAINT: Under no circumstances should you modify, update, or touch the 'delivery_date' field.
      delivery_date: ord.delivery_date,
      updated_at: now
    };
    currentNum += 1;
    return updated;
  });
}

