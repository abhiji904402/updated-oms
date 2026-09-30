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
