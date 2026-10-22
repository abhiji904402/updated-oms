import { Order } from '../types';
import { getTodayDateStr, isOrderFinalDelivered } from './timeUtils';

export function getNextOrderNumber(orders: Order[], defaultStart = 1): number {
  if (!orders || orders.length === 0) return defaultStart;
  let maxNum = 0;
  for (const o of orders) {
    const num = Number(o.order_number || o.order_id);
    if (!isNaN(num) && num > maxNum) {
      maxNum = num;
    }
  }
  return maxNum > 0 ? maxNum + 1 : defaultStart;
}

export function getDeliveredByDisplayName(order: Partial<Order>): string {
  if (order.delivered_by_name) return order.delivered_by_name;
  if (order.delivered_by) return order.delivered_by;
  if (order.delivery_partner) return order.delivery_partner;
  if (order.rider_delivered) return 'Rider';
  return order.status === 'delivered' ? 'Delivered' : 'Unassigned';
}

export function isOrderForToday(order: Partial<Order>, todayStr: string = getTodayDateStr()): boolean {
  const dateToCheck = (order.delivery_date || order.order_date || '').trim();
  return dateToCheck === todayStr;
}

export function isPaymentPending(order: Partial<Order>): boolean {
  if (!order || order.status !== 'delivered') return false;
  if (!isOrderFinalDelivered(order as Order)) return false;

  const pType = String(order.payment_type || 'due').toLowerCase().trim();
  const isPaidFull =
    pType === 'full' ||
    pType === 'full_paid' ||
    pType === 'paid' ||
    pType === 'cash' ||
    pType === 'upi' ||
    pType === 'online';
  if (isPaidFull) return false;

  const totalVal = Number(order.total_amount) || 0;
  const advanceVal = pType === 'due' ? 0 : (Number(order.advance_amount) || 0);
  const computedDue = pType === 'due' ? totalVal : Math.max(0, totalVal - advanceVal);
  const due = Number(order.remaining_balance ?? order.due_amount ?? computedDue);
  return due > 0 || pType === 'due' || pType === 'part';
}


