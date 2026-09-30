import { Order } from '../types';

export function getTodayDateStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
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

export function getExpectedTimestamp(order: Order): number {
  if (!order.delivery_date) return 0;
  const timeStr = order.delivery_time_expected || '11:00 AM';
  const time24 = convertTo24Hour(timeStr);
  const dtStr = `${order.delivery_date}T${time24.length === 5 ? time24 : '11:00'}:00`;
  const ms = new Date(dtStr).getTime();
  return isNaN(ms) ? 0 : ms;
}

export function getDeliveryTimeInfo(order: Order): { expectedFormatted: string; actualFormatted: string } {
  const expectedFormatted = `${order.delivery_date || ''} ${order.delivery_time_expected || ''}`.trim();
  let actualFormatted = '—';
  if (order.actual_delivery_time) {
    const d = new Date(order.actual_delivery_time);
    if (!isNaN(d.getTime())) {
      actualFormatted = d.toLocaleString();
    }
  } else if (order.status === 'delivered') {
    actualFormatted = 'Delivered';
  }
  return { expectedFormatted, actualFormatted };
}

