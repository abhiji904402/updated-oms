import { Order, OrderStatus } from '../types';

export type DashboardTab =
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
  return o.status === 'delivered';
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
 * Compute badge counts for all 8 tabs
 */
export const computeTabCounts = (safeOrders: Order[], todayStr: string, tomorrowStr: string) => {
  let today = 0, tomorrow = 0, future = 0, delivered_history = 0, pending_payment = 0, pending_payment_amount = 0, cancelled = 0, missed = 0, on_hold = 0;

  safeOrders.forEach((o) => {
    const isDel = isDeliveredMarked(o);
    const isCanc = o.status === 'cancelled';
    const isHold = o.status === 'on_hold';
    const isPayPending = isPaymentPending(o);
    const delDate = getNormalizedDateStr(o.delivery_date) || getNormalizedDateStr(o.order_date);

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

    if (o.status === 'missed' || (delDate < todayStr && !isDel && !isCanc)) {
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
