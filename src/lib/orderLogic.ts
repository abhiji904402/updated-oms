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
  const dateStr = getNormalizedDateStr(order.delivery_date) || getNormalizedDateStr(order.order_date);
  const timeStr = order.delivery_time_expected || order.order_time || '00:00';
  if (dateStr) {
    const t = new Date(`${dateStr} ${timeStr}`).getTime();
    if (!isNaN(t) && t > 0) return t;
    const dOnly = new Date(dateStr).getTime();
    if (!isNaN(dOnly) && dOnly > 0) return dOnly;
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
      return numB - numA;
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

    // For TODAY and TOMORROW orders: sort by time / order number
    if (timeA !== timeB) return timeA - timeB;
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
 * Re-sequences orders starting from a custom starting number (e.g. 1, 101, 2160, 2500)
 * in chronological order of creation.
 */
export function resequenceOrderNumbers(ordersList: Order[], startNumber: number = 1): Order[] {
  if (!ordersList || ordersList.length === 0) return [];
  const sorted = [...ordersList].sort((a, b) => {
    const numA = Number(a.order_number) || 0;
    const numB = Number(b.order_number) || 0;
    if (numA !== 0 && numB !== 0 && numA !== numB) return numA - numB;
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (timeA !== timeB) return timeA - timeB;
    return a.id.localeCompare(b.id);
  });

  let currentNum = Math.max(1, Math.floor(startNumber));
  const now = new Date().toISOString();

  return sorted.map((ord) => {
    const updated: Order = {
      ...ord,
      order_number: currentNum,
      updated_at: now
    };
    currentNum += 1;
    return updated;
  });
}

