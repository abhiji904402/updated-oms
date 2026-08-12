import { Order, OrderStatus, PaymentType, DeliveryType, OutletName } from '../types';

/**
 * Parses raw CSV text into array of string rows while supporting quoted values with commas/newlines.
 */
export function parseCSVToRows(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(current.trim());
      if (row.some((cell) => cell.length > 0)) {
        lines.push(row);
      }
      row = [];
      current = '';
    } else {
      current += char;
    }
  }

  if (current || row.length > 0) {
    row.push(current.trim());
    if (row.some((cell) => cell.length > 0)) {
      lines.push(row);
    }
  }

  return lines;
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cleanNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const numStr = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(numStr);
  return isNaN(parsed) ? 0 : parsed;
}

function normalizeStatus(statusRaw: any): OrderStatus {
  if (!statusRaw) return 'pending';
  const str = String(statusRaw).toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (['pending', 'processing', 'out_for_delivery', 'delivered', 'on_hold', 'cancelled', 'missed'].includes(str)) {
    return str as OrderStatus;
  }
  if (str.includes('deliver')) return 'delivered';
  if (str.includes('out') || str.includes('dispatch')) return 'out_for_delivery';
  if (str.includes('process') || str.includes('prep') || str.includes('bake')) return 'processing';
  if (str.includes('cancel')) return 'cancelled';
  if (str.includes('hold')) return 'on_hold';
  return 'pending';
}

function normalizePaymentType(payRaw: any): PaymentType {
  if (!payRaw) return 'full';
  const str = String(payRaw).toLowerCase().trim();
  if (['cash', 'online', 'upi', 'part', 'full', 'due'].includes(str)) {
    return str as PaymentType;
  }
  if (str.includes('upi') || str.includes('gpay') || str.includes('phonepe') || str.includes('paytm')) return 'upi';
  if (str.includes('card') || str.includes('net') || str.includes('online')) return 'online';
  if (str.includes('cash')) return 'cash';
  if (str.includes('part') || str.includes('advance')) return 'part';
  if (str.includes('due') || str.includes('unpaid')) return 'due';
  return 'full';
}

function normalizeDeliveryType(typeRaw: any): DeliveryType {
  if (!typeRaw) return 'delivery';
  const str = String(typeRaw).toLowerCase().trim();
  if (str.includes('pick') || str.includes('takeaway') || str.includes('counter')) return 'pickup';
  return 'delivery';
}

/**
 * Parses CSV file text into order objects matching Order type
 */
export function parseCSVToOrders(csvText: string): Partial<Order>[] {
  const rows = parseCSVToRows(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);
  const orders: Partial<Order>[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const rawData: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rawData[h] = row[idx] || '';
    });

    // Helper to search field by keywords
    const getVal = (...keys: string[]) => {
      for (const k of keys) {
        if (rawData[k] !== undefined && rawData[k] !== '') {
          return rawData[k];
        }
      }
      return '';
    };

    const orderNumRaw = getVal('ordernumber', 'order', 'ordernum', 'order#', 'sno', 'sn');
    const customerName = getVal('customername', 'customer', 'name');
    const mobile = getVal('phone', 'mobile', 'mobilenumber', 'contact', 'phone#');
    const outlet = getVal('outlet', 'branch', 'location');
    const itemType = getVal('itemtype', 'item', 'itemdetails', 'product');
    const quantity = getVal('quantityweight', 'quantity', 'qty', 'weight');
    const totalAmount = cleanNumber(getVal('total', 'totalamount', 'amount', 'price'));
    const advanceAmount = cleanNumber(getVal('advance', 'advanceamount', 'adv'));
    const remainingBalance = cleanNumber(getVal('remaining', 'remainingbalance', 'due', 'dueamount', 'balance'));
    const status = normalizeStatus(getVal('status', 'orderstatus'));
    const paymentType = normalizePaymentType(getVal('paymenttype', 'payment', 'paymentstatus'));
    const deliveryType = normalizeDeliveryType(getVal('deliverytype', 'type'));
    const deliveryDate = getVal('deliverydate', 'deldate', 'date');
    const expectedTime = getVal('time', 'deliverytime', 'expecteddeliverytime', 'timeexpected', 'expectedtime');
    const informedBy = getVal('informedby', 'informed');
    const advBill = getVal('advbillno', 'advancebillnumber', 'advbill', 'advancebillno', 'advancebill', 'advbillno.', 'advbill#');
    const finalBill = getVal('finalbillno', 'finalbillnumber', 'finalbill', 'billno', 'billnumber', 'billnos', 'bill', 'bill#', 'finalbillno.', 'invoiceno', 'invoice');
    const photoUrl = getVal('cakephotourl', 'photourl', 'itemimageurl', 'photo');
    const remarks = getVal('remarks', 'notes', 'comments');
    const address = getVal('address', 'deliveryaddress', 'locationaddress');
    const orderDate = getVal('orderdate', 'createddate') || new Date().toISOString().split('T')[0];
    const orderTime = getVal('ordertime', 'createdtime') || new Date().toTimeString().slice(0, 5);

    // Skip completely empty rows
    if (!customerName && !itemType && !totalAmount && !orderNumRaw) {
      continue;
    }

    const parsedOrder: Partial<Order> = {
      order_number: parseInt(orderNumRaw.replace(/[^0-9]/g, ''), 10) || undefined,
      customer_name: customerName || 'Valued Customer',
      mobile_number: mobile || '9876543210',
      outlet: (outlet || 'Sector 31') as OutletName,
      item_type: itemType || 'Assorted Bakery Item',
      quantity: quantity || 1,
      total_amount: totalAmount || 0,
      advance_amount: advanceAmount || 0,
      remaining_balance: remainingBalance || Math.max(0, totalAmount - advanceAmount),
      due_amount: remainingBalance || Math.max(0, totalAmount - advanceAmount),
      status,
      payment_type: paymentType,
      delivery_type: deliveryType,
      delivery_date: deliveryDate || new Date().toISOString().split('T')[0],
      delivery_time_expected: expectedTime || '17:00',
      informed_by: informedBy || 'Walk-in',
      advance_bill_number: advBill || '',
      final_bill_number: finalBill || '',
      item_image_url: photoUrl || '',
      remarks: remarks || '',
      address: address || (deliveryType === 'pickup' ? 'Store Pickup' : 'Customer Address'),
      order_date: orderDate,
      order_time: orderTime
    };

    orders.push(parsedOrder);
  }

  return orders;
}

/**
 * Parses JSON file text into order objects array
 */
export function parseJSONToOrders(jsonText: string): Partial<Order>[] {
  try {
    const data = JSON.parse(jsonText);
    let items: any[] = [];

    if (Array.isArray(data)) {
      items = data;
    } else if (data && Array.isArray(data.orders)) {
      items = data.orders;
    } else if (data && Array.isArray(data.data)) {
      items = data.data;
    } else if (data && typeof data === 'object') {
      items = [data];
    }

    return items.map((item) => {
      const totalAmount = cleanNumber(item.total_amount || item.total || item.amount || 0);
      const advanceAmount = cleanNumber(item.advance_amount || item.advance || 0);
      const remainingBalance = cleanNumber(item.remaining_balance || item.due || item.remaining || Math.max(0, totalAmount - advanceAmount));

      return {
        order_number: item.order_number ? parseInt(String(item.order_number), 10) : undefined,
        customer_name: String(item.customer_name || item.name || 'Valued Customer'),
        mobile_number: String(item.mobile_number || item.phone || item.mobile || '9876543210'),
        outlet: (item.outlet || 'Sector 31') as OutletName,
        item_type: String(item.item_type || item.item || 'Bakery Item'),
        quantity: item.quantity || item.qty || 1,
        total_amount: totalAmount,
        advance_amount: advanceAmount,
        remaining_balance: remainingBalance,
        due_amount: remainingBalance,
        status: normalizeStatus(item.status),
        payment_type: normalizePaymentType(item.payment_type || item.payment),
        delivery_type: normalizeDeliveryType(item.delivery_type || item.type),
        delivery_date: String(item.delivery_date || item.del_date || new Date().toISOString().split('T')[0]),
        delivery_time_expected: String(item.delivery_time_expected || item.expected_time || item.time || '18:00'),
        informed_by: String(item.informed_by || 'App'),
        address: String(item.address || 'Address'),
        remarks: String(item.remarks || item.notes || ''),
        advance_bill_number: String(item.advance_bill_number || item.adv_bill_number || item.adv_bill || item.advance_bill || ''),
        final_bill_number: String(item.final_bill_number || item.final_bill_no || item.final_bill || item.bill_number || item.bill_no || item.bill || ''),
        order_date: String(item.order_date || new Date().toISOString().split('T')[0]),
        order_time: String(item.order_time || new Date().toTimeString().slice(0, 5))
      };
    });
  } catch (err) {
    console.error('JSON parsing error:', err);
    throw new Error('Invalid JSON format. Please check your JSON structure.');
  }
}

/**
 * Downloads a sample CSV template for users to fill and upload
 */
export function downloadSampleCSVTemplate() {
  const sampleHeaders = [
    'S.No.',
    'Order #',
    'Customer Name',
    'Phone',
    'Outlet',
    'Item Type',
    'Quantity',
    'Informed By',
    'Delivery Type',
    'Delivery Date',
    'Time',
    'Total (₹)',
    'Advance (₹)',
    'Remaining (₹)',
    'Payment Type',
    'Adv Bill No.',
    'Final Bill No.',
    'Status',
    'Cake Photo URL',
    'Remarks'
  ].join(',');

  const sampleRow1 = [
    '1',
    '101',
    'Rahul Sharma',
    '9876543210',
    'Sector 31',
    'Chocolate Fudge Cake 1kg',
    '1',
    'Swiggy',
    'delivery',
    '2026-08-10',
    '17:00',
    '1200',
    '500',
    '700',
    'part',
    'ADV-101',
    '',
    'pending',
    '',
    'Write Happy Birthday Rahul'
  ].join(',');

  const sampleRow2 = [
    '2',
    '102',
    'Priya Verma',
    '9123456789',
    'Sector 35',
    'Red Velvet Pastry (Box of 4)',
    '2',
    'Walk-in',
    'pickup',
    '2026-08-10',
    '18:30',
    '640',
    '640',
    '0',
    'full',
    'ADV-102',
    'FIN-102',
    'delivered',
    '',
    'Extra candles requested'
  ].join(',');

  const csvContent = `${sampleHeaders}\n${sampleRow1}\n${sampleRow2}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'broomies_orders_sample_template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Downloads a sample JSON template for users
 */
export function downloadSampleJSONTemplate() {
  const sampleData = [
    {
      order_number: 101,
      customer_name: 'Rahul Sharma',
      mobile_number: '9876543210',
      outlet: 'Sector 31',
      item_type: 'Chocolate Fudge Cake 1kg',
      quantity: 1,
      total_amount: 1200,
      advance_amount: 500,
      remaining_balance: 700,
      due_amount: 700,
      payment_type: 'part',
      delivery_type: 'delivery',
      delivery_date: '2026-08-10',
      delivery_time_expected: '17:00',
      status: 'pending',
      informed_by: 'Swiggy',
      address: 'House #45, Sector 31, Gurugram',
      remarks: 'Happy Birthday message required'
    },
    {
      order_number: 102,
      customer_name: 'Priya Verma',
      mobile_number: '9123456789',
      outlet: 'Sector 35',
      item_type: 'Red Velvet Pastry (Box of 4)',
      quantity: 2,
      total_amount: 640,
      advance_amount: 640,
      remaining_balance: 0,
      due_amount: 0,
      payment_type: 'full',
      delivery_type: 'pickup',
      delivery_date: '2026-08-10',
      delivery_time_expected: '18:30',
      status: 'delivered',
      informed_by: 'Walk-in',
      address: 'Store Pickup',
      remarks: 'Packed in gift box'
    }
  ];

  const jsonContent = JSON.stringify(sampleData, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'broomies_orders_sample_template.json');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
