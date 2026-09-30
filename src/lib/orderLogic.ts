import { Order } from '../types';

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

export function getDeliveredByDisplayName(order: Order): string {
  if (order.delivered_by_name) return order.delivered_by_name;
  if (order.delivery_partner) return order.delivery_partner;
  if (order.rider_delivered) return 'Rider';
  return order.status === 'delivered' ? 'Delivered' : 'Unassigned';
}

