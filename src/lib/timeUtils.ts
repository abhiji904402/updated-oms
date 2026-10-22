import { Order } from '../types';

export function getTodayDateStr(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTomorrowDateStr(date: Date = new Date()): string {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return getTodayDateStr(next);
}

export function getCurrentTime12Hour(): string {
  const d = new Date();
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
}

export function formatTo12Hour(timeStr?: string): string {
  if (!timeStr) return '';
  const trimmed = timeStr.trim();
  if (trimmed.toLowerCase().includes('am') || trimmed.toLowerCase().includes('pm')) {
    return trimmed;
  }
  // Try to parse HH:MM (24-hour)
  const parts = trimmed.split(':');
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1].slice(0, 2);
    if (isNaN(hours)) return trimmed;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  }
  return trimmed;
}

export function convertTo24Hour(time12h: string): string {
  if (!time12h) return '12:00';
  const match = time12h.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return time12h;
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

function parseDateTime(dateStr?: string, timeStr?: string): Date | null {
  if (!dateStr) return null;
  let cleanDate = dateStr.trim();
  if (cleanDate.includes('T')) {
    cleanDate = cleanDate.split('T')[0];
  }
  let year = 0;
  let month = 0;
  let day = 0;

  const dmy = cleanDate.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmy) {
    day = parseInt(dmy[1], 10);
    month = parseInt(dmy[2], 10) - 1;
    let yr = dmy[3];
    if (yr.length === 2) yr = `20${yr}`;
    year = parseInt(yr, 10);
  } else {
    const ymd = cleanDate.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    if (ymd) {
      year = parseInt(ymd[1], 10);
      month = parseInt(ymd[2], 10) - 1;
      day = parseInt(ymd[3], 10);
    }
  }

  if (!year || isNaN(year)) {
    const rawParsed = new Date(cleanDate).getTime();
    if (!isNaN(rawParsed) && rawParsed > 0) {
      const dt = new Date(rawParsed);
      year = dt.getFullYear();
      month = dt.getMonth();
      day = dt.getDate();
    } else {
      return null;
    }
  }

  let hours = 18;
  let minutes = 0;
  if (timeStr) {
    let cleanTime = timeStr.trim().toUpperCase();
    cleanTime = cleanTime.replace(/(\d+)\.(\d+)/, '$1:$2');
    const isPM = cleanTime.includes('PM');
    const isAM = cleanTime.includes('AM');
    const digits = cleanTime.replace(/[^0-9:]/g, '').split(':');
    if (digits.length >= 1 && digits[0]) {
      hours = parseInt(digits[0], 10) || 0;
    }
    if (digits.length >= 2 && digits[1]) {
      minutes = parseInt(digits[1], 10) || 0;
    }
    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
    hours = Math.min(23, Math.max(0, hours));
    minutes = Math.min(59, Math.max(0, minutes));
  }

  const result = new Date(year, month, day, hours, minutes, 0);
  return isNaN(result.getTime()) ? null : result;
}

export function getExpectedTimestamp(order: Order): number {
  const dateStr = order.delivery_date || order.order_date || getTodayDateStr();
  const expectedTimeStr = order.delivery_time_expected || order.order_time || '18:00';
  const expectedDate = parseDateTime(dateStr, expectedTimeStr);
  return expectedDate ? expectedDate.getTime() : 0;
}

export interface DeliveryTimeInfo {
  expectedFormatted: string;
  actualFormatted: string;
  delayMinutes: number;
  delayText: string;
  isOverdue: boolean;
}

export function getDeliveryTimeInfo(order: Order): DeliveryTimeInfo {
  const dateStr = order.delivery_date || order.order_date || getTodayDateStr();
  const expectedTimeStr = order.delivery_time_expected || order.order_time || '06:00 PM';
  const expectedDate = parseDateTime(dateStr, expectedTimeStr);

  let expectedFormatted = formatTo12Hour(expectedTimeStr);
  if (expectedDate) {
    expectedFormatted = expectedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

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

  let delayMinutes = 0;
  let isOverdue = false;
  if (expectedDate) {
    if (order.status === 'delivered' && actualDate) {
      const diffMs = actualDate.getTime() - expectedDate.getTime();
      delayMinutes = Math.max(0, Math.round(diffMs / (1000 * 60)));
      isOverdue = delayMinutes > 0;
    } else if (order.status !== 'delivered' && order.status !== 'cancelled') {
      const now = new Date();
      if (now > expectedDate) {
        const diffMs = now.getTime() - expectedDate.getTime();
        delayMinutes = Math.max(0, Math.round(diffMs / (1000 * 60)));
        isOverdue = delayMinutes > 0;
      }
    }
  }

  const delayText = delayMinutes > 0 ? `${delayMinutes} min Delay` : 'On Time (0 min)';

  return {
    expectedFormatted,
    actualFormatted,
    delayMinutes,
    delayText,
    isOverdue
  };
}

export interface CountdownInfo {
  text: string;
  minutesRemaining: number;
  urgency: 'completed' | 'normal' | 'warning' | 'critical' | 'overdue';
  badgeColorClass: string;
}

export function getCountdownInfo(
  orderOrDateStr: Order | string,
  timeStrOrNowTime?: string | number
): CountdownInfo {
  let dateStr: string;
  let expectedTimeStr: string;
  let nowTime = Date.now();

  if (typeof orderOrDateStr === 'string') {
    dateStr = orderOrDateStr;
    expectedTimeStr = typeof timeStrOrNowTime === 'string' ? timeStrOrNowTime : '18:00';
  } else {
    const order = orderOrDateStr;
    if (typeof timeStrOrNowTime === 'number') {
      nowTime = timeStrOrNowTime;
    }
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
    dateStr = order.delivery_date || order.order_date || getTodayDateStr();
    expectedTimeStr = order.delivery_time_expected || order.order_time || '18:00';
  }

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
    const tStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    return {
      text: `OVERDUE by ${tStr}`,
      minutesRemaining: diffMinutes,
      urgency: 'overdue',
      badgeColorClass: 'bg-rose-600 text-white font-black animate-pulse shadow-lg shadow-rose-950/80 border border-rose-400'
    };
  }

  if (diffMinutes <= 30) {
    return {
      text: `${diffMinutes} MIN LEFT`,
      minutesRemaining: diffMinutes,
      urgency: 'critical',
      badgeColorClass: 'bg-amber-500 text-slate-950 font-black animate-bounce border border-amber-300 shadow-md shadow-amber-950/80'
    };
  }

  const hrs = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  const tStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

  if (diffMinutes <= 90) {
    return {
      text: `${tStr} left`,
      minutesRemaining: diffMinutes,
      urgency: 'warning',
      badgeColorClass: 'bg-amber-950/90 text-amber-300 font-extrabold border border-amber-800/70'
    };
  }

  return {
    text: `${tStr} left`,
    minutesRemaining: diffMinutes,
    urgency: 'normal',
    badgeColorClass: 'bg-indigo-950/80 text-indigo-300 font-bold border border-indigo-800/60'
  };
}

export function isOrderFinalDelivered(order: Order): boolean {
  if (order.status !== 'delivered') return false;
  const isPickup = String(order.delivery_type || '').toLowerCase().trim() === 'pickup';
  if (isPickup) return true;
  return !Boolean(order.delivery_confirmation_pending);
}

export function sortOrdersByDeliveryPriority(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => {
    // 1. Put Rider-Delivered orders awaiting Admin/Outlet confirmation right at the TOP of Today Orders
    const aWaitingConfirm = a.status === 'delivered' && Boolean(a.delivery_confirmation_pending) && String(a.delivery_type || '').toLowerCase().trim() !== 'pickup';
    const bWaitingConfirm = b.status === 'delivered' && Boolean(b.delivery_confirmation_pending) && String(b.delivery_type || '').toLowerCase().trim() !== 'pickup';
    if (aWaitingConfirm && !bWaitingConfirm) return -1;
    if (!aWaitingConfirm && bWaitingConfirm) return 1;
    if (aWaitingConfirm && bWaitingConfirm) {
      const tA = new Date(a.actual_delivery_time || a.updated_at || 0).getTime();
      const tB = new Date(b.actual_delivery_time || b.updated_at || 0).getTime();
      return tB - tA;
    }

    // 2. Push fully completed/cancelled to bottom if mixed
    const aDone = isOrderFinalDelivered(a) || a.status === 'cancelled';
    const bDone = isOrderFinalDelivered(b) || b.status === 'cancelled';
    if (aDone && !bDone) return 1;
    if (!aDone && bDone) return -1;

    // 3. Sort active orders by expected delivery time (most urgent first)
    return getExpectedTimestamp(a) - getExpectedTimestamp(b);
  });
}

function getOrderCompletedTimestamp(order: Order): number {
  if (order.actual_delivery_time) {
    const t = new Date(order.actual_delivery_time).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (order.updated_at) {
    const t = new Date(order.updated_at).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  const parsed = parseDateTime(order.delivery_date || order.order_date, order.delivery_time_expected || order.order_time);
  if (parsed) return parsed.getTime();
  return 0;
}

function getNormalizedDateSortable(dateStr?: string): string {
  if (!dateStr) return '0000-00-00';
  const clean = dateStr.trim().split('T')[0];
  const ymd = clean.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }
  const dmy = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmy) {
    const yr = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${yr}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return clean;
}

export function sortDeliveredOrdersRecentFirst(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => {
    // 1. Primary sort: actual delivery / update timestamp descending (most recently delivered at top)
    const timeA = getOrderCompletedTimestamp(a);
    const timeB = getOrderCompletedTimestamp(b);

    // Also compare normalized delivery_date descending
    const dateA = getNormalizedDateSortable(a.delivery_date || a.order_date);
    const dateB = getNormalizedDateSortable(b.delivery_date || b.order_date);

    // If one was delivered very recently (has actual_delivery_time ISO timestamp), sort by exact timestamp descending
    const hasIsoA = Boolean(a.actual_delivery_time && a.actual_delivery_time.includes('T'));
    const hasIsoB = Boolean(b.actual_delivery_time && b.actual_delivery_time.includes('T'));
    if (hasIsoA || hasIsoB) {
      if (timeB !== timeA) return timeB - timeA;
    }

    if (dateA !== dateB) {
      return dateB.localeCompare(dateA);
    }

    if (timeB !== timeA) {
      return timeB - timeA;
    }

    return (Number(b.order_number) || 0) - (Number(a.order_number) || 0);
  });
}

export interface DeliveredDateGroup {
  dateKey: string;
  label: string;
  orders: Order[];
  totalRevenue: number;
}

export function groupDeliveredOrdersByDate(orders: Order[]): DeliveredDateGroup[] {
  const sorted = sortDeliveredOrdersRecentFirst(orders);
  const todayKey = getTodayDateStr();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayKey = getTodayDateStr(yesterdayDate);

  const map = new Map<string, Order[]>();

  for (const ord of sorted) {
    let key = '0000-00-00';
    if (ord.actual_delivery_time && ord.actual_delivery_time.includes('T')) {
      const dt = new Date(ord.actual_delivery_time);
      if (!isNaN(dt.getTime())) {
        key = getTodayDateStr(dt);
      }
    }
    if (key === '0000-00-00') {
      key = getNormalizedDateSortable(ord.delivery_date || ord.order_date);
    }
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(ord);
  }

  const formatFriendlyDate = (dateKey: string): string => {
    if (!dateKey || dateKey === '0000-00-00') return 'Earlier Delivered Orders';
    const parts = dateKey.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      if (!isNaN(d.getTime())) {
        const formatted = d.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
        if (dateKey === todayKey) return `Today — ${formatted}`;
        if (dateKey === yesterdayKey) return `Yesterday — ${formatted}`;
        return formatted;
      }
    }
    return dateKey;
  };

  const groups: DeliveredDateGroup[] = [];
  for (const [dateKey, groupOrders] of map.entries()) {
    const totalRevenue = groupOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    groups.push({
      dateKey,
      label: formatFriendlyDate(dateKey),
      orders: groupOrders,
      totalRevenue
    });
  }

  return groups;
}

export function exportOrdersToCSV(orders: Order[], filenamePrefix = 'Broomies_Delivered_History') {
  if (!orders || orders.length === 0) return;
  const headers = [
    'Order #',
    'Delivery Date',
    'Delivered Time',
    'Customer Name',
    'Mobile Number',
    'Outlet',
    'Delivery Type',
    'Bakery Item',
    'Cake Name',
    'Total Amount (INR)',
    'Advance Paid (INR)',
    'Remaining Due (INR)',
    'Payment Status',
    'Delivered By / Rider',
    'Adv Bill No',
    'Final Bill No'
  ];

  const escapeCsv = (val: any) => {
    const str = String(val ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = orders.map((o) => {
    const info = getDeliveryTimeInfo(o);
    return [
      o.order_number,
      o.delivery_date || o.order_date || '',
      info.actualFormatted,
      o.customer_name || '',
      o.mobile_number || '',
      o.outlet || '',
      o.delivery_type || 'delivery',
      `${o.item_type || ''} (${o.quantity || 1})`,
      o.name_on_cake || '',
      o.total_amount || 0,
      o.advance_amount || 0,
      o.remaining_balance || 0,
      o.payment_type || 'full',
      o.delivered_by || o.delivery_partner || 'Store Pickup',
      o.advance_bill_number || '',
      o.final_bill_number || ''
    ].map(escapeCsv).join(',');
  });

  const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}_${getTodayDateStr()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function playRiderDeliveredChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [587.33, 880]; // D5 -> A5 crisp pleasant chime
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.18, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.36);
    });
  } catch {}
}




