import { Order, OrderStatus, PaymentType, DeliveryType, OutletName } from '../types';
import { formatTo12Hour, getCurrentTime12Hour } from './timeUtils';

/**
 * Parses raw CSV/TSV text into array of string rows while supporting quoted values with commas/newlines and tab delimiters.
 */
export function parseCSVToRows(text: string): string[][] {
  if (!text) return [];

  // Auto-detect delimiter from first non-empty line (tab vs comma vs semicolon)
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) || '';
  let delimiter = ',';
  if (firstLine.includes('\t')) {
    delimiter = '\t';
  } else if (firstLine.includes(';') && !firstLine.includes(',')) {
    delimiter = ';';
  }

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
    } else if (char === delimiter && !inQuotes) {
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
  if (str.includes('deliver') || str.includes('done') || str.includes('complete')) return 'delivered';
  if (str.includes('out') || str.includes('dispatch') || str.includes('rider')) return 'out_for_delivery';
  if (str.includes('process') || str.includes('prep') || str.includes('bake') || str.includes('ready')) return 'processing';
  if (str.includes('cancel') || str.includes('reject')) return 'cancelled';
  if (str.includes('hold') || str.includes('wait') || str.includes('pause')) return 'on_hold';
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
  if (str.includes('cash') || str.includes('cod')) return 'cash';
  if (str.includes('part') || str.includes('advance') || str.includes('partial')) return 'part';
  if (str.includes('due') || str.includes('unpaid') || str.includes('pending') || str.includes('credit')) return 'due';
  return 'full';
}

function normalizeDeliveryType(typeRaw: any): DeliveryType {
  if (!typeRaw) return 'delivery';
  const str = String(typeRaw).toLowerCase().trim();
  if (str.includes('pick') || str.includes('takeaway') || str.includes('counter') || str.includes('store')) return 'pickup';
  return 'delivery';
}

function normalizeDateString(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') return new Date().toISOString().split('T')[0];
  const trimmed = dateStr.trim();
  if (!trimmed) return new Date().toISOString().split('T')[0];

  // If already standard ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // If DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Try parsing generic date string
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return trimmed;
}

/**
 * Parses CSV/TSV file text into order objects matching all 24 system columns
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

    // 1. Order #
    const orderNumRaw = getVal('ordernumber', 'order', 'ordernum', 'order#', 'orderid', 'orderno', 'sno', 'sn', 'id');
    // 2. Outlet
    const outlet = getVal('outlet', 'branch', 'location', 'store', 'outletname');
    // 3. Order Date
    const orderDate = normalizeDateString(getVal('orderdate', 'ordercreateddate', 'createddate', 'dateoforder', 'punchdate', 'date'));
    // 4. Order Time
    const orderTime = formatTo12Hour(getVal('ordertime', 'ordercreatedtime', 'createdtime', 'timeoforder', 'punchtime', 'time')) || getCurrentTime12Hour();
    // 5. Delivery Date
    const deliveryDate = normalizeDateString(getVal('deliverydate', 'deldate', 'expecteddeliverydate', 'targetdate', 'date'));
    // 6. Expected Delivery Time
    const expectedTime = formatTo12Hour(getVal('expecteddeliverytime', 'deliverytimeexpected', 'deliverytime', 'expectedtime', 'timeexpected', 'deltime', 'time')) || '05:00 PM';
    // 7. Actual Delivery Time
    const actualDeliveryTime = getVal('actualdeliverytime', 'actualdelivery', 'deliveredtime', 'deliverytimeactual', 'actualtime', 'deliverycompletiontime');
    // 8. Customer Name
    const customerName = getVal('customername', 'customer', 'name', 'clientname', 'client', 'buyername', 'custname');
    // 9. Mobile
    const mobile = getVal('mobile', 'phone', 'mobilenumber', 'contact', 'phone#', 'contactnumber', 'customermobile', 'phonenumber', 'cell');
    // 10. Address
    const address = getVal('address', 'deliveryaddress', 'locationaddress', 'custaddress', 'shippingaddress', 'customeraddress', 'street');
    // 11. Item Type
    const itemType = getVal('itemtype', 'item', 'itemdetails', 'product', 'items', 'itemname', 'itemdescription', 'description', 'cake');
    // 12. Qty
    const quantity = getVal('qty', 'quantity', 'quantityweight', 'weight', 'count', 'pieces', 'pcs') || 1;
    // 13. Type
    const deliveryType = normalizeDeliveryType(getVal('type', 'deliverytype', 'ordertype', 'fulfillmenttype', 'deliverymode', 'mode'));
    // 14. Total (₹)
    const totalAmount = cleanNumber(getVal('total', 'totalamount', 'amount', 'price', 'totalrs', 'totalinr', 'grandtotal', 'billamount'));
    // 15. Advance (₹)
    const advanceAmount = cleanNumber(getVal('advance', 'advanceamount', 'adv', 'advamount', 'advancers', 'advanceinr', 'paidamount', 'paid'));
    // 16. Remaining Balance (₹)
    const remRaw = getVal('remainingbalance', 'remaining', 'due', 'dueamount', 'balance', 'balanceamount', 'remainingamount', 'duers', 'remainingrs', 'pendingamount');
    const remainingBalance = remRaw !== '' ? cleanNumber(remRaw) : Math.max(0, totalAmount - advanceAmount);
    // 17. Payment Status
    const paymentType = normalizePaymentType(getVal('paymentstatus', 'paymenttype', 'payment', 'paystatus', 'paytype', 'modeofpayment', 'paymentmode'));
    // 18. Adv Bill No.
    const advBill = getVal('advbillno', 'advancebillnumber', 'advbill', 'advancebillno', 'advancebill', 'advbillnum', 'advbillno.', 'advbill#', 'advancebillno.');
    // 19. Final Bill No.
    const finalBill = getVal('finalbillno', 'finalbillnumber', 'finalbill', 'billno', 'billnumber', 'billnos', 'bill', 'bill#', 'finalbillno.', 'invoiceno', 'invoice', 'finalbillnum', 'invoicenumber');
    // 20. Order Status
    const status = normalizeStatus(getVal('orderstatus', 'status', 'orderstate', 'state', 'currentstatus'));
    // 21. Delivery Partner
    const deliveryPartner = getVal('deliverypartner', 'rider', 'deliveryboy', 'driver', 'partner', 'assignedrider', 'assignedpartner');
    // 22. Delivered By
    const deliveredBy = getVal('deliveredby', 'deliveredperson', 'deliveryagent', 'deliveredagent') || (status === 'delivered' && deliveryPartner ? deliveryPartner : '');
    // 23. Payment Changed By
    const paymentChangedBy = getVal('paymentchangedby', 'paymentmodifiedby', 'paymentupdatedby', 'paychangedby');
    // 24. Payment Changed At
    const paymentChangedAt = getVal('paymentchangedat', 'paymentmodifiedat', 'paymentupdatedat', 'paychangedat');

    // Supplementary
    const photoUrl = getVal('cakephotourl', 'photourl', 'itemimageurl', 'photo', 'image', 'cakephoto');
    const remarks = getVal('remarks', 'notes', 'comments', 'specialinstructions');
    const informedBy = getVal('informedby', 'informed', 'channel', 'source');

    // Skip completely empty rows
    if (!customerName && !itemType && !totalAmount && !orderNumRaw) {
      continue;
    }

    const orderNumberParsed = parseInt(orderNumRaw.replace(/[^0-9]/g, ''), 10);

    const parsedOrder: Partial<Order> = {
      order_number: !isNaN(orderNumberParsed) && orderNumberParsed > 0 ? orderNumberParsed : undefined,
      order_id: !isNaN(orderNumberParsed) && orderNumberParsed > 0 ? orderNumberParsed : undefined,
      customer_name: customerName || 'Valued Customer',
      mobile_number: mobile || '9876543210',
      outlet: (outlet || 'Sector 31') as OutletName,
      item_type: itemType || 'Assorted Bakery Item',
      quantity: quantity || 1,
      total_amount: totalAmount || 0,
      advance_amount: advanceAmount || 0,
      remaining_balance: remainingBalance,
      due_amount: remainingBalance,
      status,
      payment_type: paymentType,
      delivery_type: deliveryType,
      delivery_date: deliveryDate || new Date().toISOString().split('T')[0],
      delivery_time_expected: expectedTime,
      actual_delivery_time: actualDeliveryTime ? (formatTo12Hour(actualDeliveryTime) || actualDeliveryTime) : (status === 'delivered' ? (formatTo12Hour(expectedTime) || expectedTime) : ''),
      informed_by: informedBy || 'Walk-in',
      advance_bill_number: advBill || '',
      final_bill_number: finalBill || '',
      delivery_partner: deliveryPartner || '',
      delivered_by: deliveredBy || '',
      payment_changed_by: paymentChangedBy || '',
      payment_changed_at: paymentChangedAt || '',
      rider_delivered: Boolean(status === 'delivered' || deliveredBy || actualDeliveryTime),
      item_image_url: photoUrl || '',
      remarks: remarks || '',
      address: address || (deliveryType === 'pickup' ? 'Store Pickup' : 'Customer Address'),
      order_date: orderDate || new Date().toISOString().split('T')[0],
      order_time: orderTime
    };

    orders.push(parsedOrder);
  }

  return orders;
}

/**
 * Parses JSON file text into order objects array supporting all 24 system columns
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
      const remainingBalance = cleanNumber(item.remaining_balance !== undefined ? item.remaining_balance : (item.due || item.remaining || Math.max(0, totalAmount - advanceAmount)));
      const status = normalizeStatus(item.status || item.order_status);
      const orderNum = item.order_number ? parseInt(String(item.order_number).replace(/[^0-9]/g, ''), 10) : (item.order_id ? parseInt(String(item.order_id).replace(/[^0-9]/g, ''), 10) : undefined);

      return {
        order_number: !isNaN(Number(orderNum)) ? Number(orderNum) : undefined,
        order_id: !isNaN(Number(orderNum)) ? Number(orderNum) : undefined,
        customer_name: String(item.customer_name || item.name || 'Valued Customer'),
        mobile_number: String(item.mobile_number || item.phone || item.mobile || '9876543210'),
        outlet: (item.outlet || 'Sector 31') as OutletName,
        item_type: String(item.item_type || item.item || item.item_details || 'Bakery Item'),
        quantity: item.quantity || item.qty || 1,
        total_amount: totalAmount,
        advance_amount: advanceAmount,
        remaining_balance: remainingBalance,
        due_amount: remainingBalance,
        status,
        payment_type: normalizePaymentType(item.payment_type || item.payment_status || item.payment),
        delivery_type: normalizeDeliveryType(item.delivery_type || item.type),
        delivery_date: normalizeDateString(String(item.delivery_date || item.del_date || new Date().toISOString().split('T')[0])),
        delivery_time_expected: formatTo12Hour(String(item.delivery_time_expected || item.expected_delivery_time || item.time || '05:00 PM')) || '05:00 PM',
        actual_delivery_time: String(item.actual_delivery_time || item.actual_delivery || ''),
        delivery_partner: String(item.delivery_partner || item.rider || ''),
        delivered_by: String(item.delivered_by || ''),
        payment_changed_by: String(item.payment_changed_by || ''),
        payment_changed_at: String(item.payment_changed_at || ''),
        rider_delivered: Boolean(status === 'delivered' || item.delivered_by || item.rider_delivered),
        informed_by: String(item.informed_by || 'App'),
        address: String(item.address || item.delivery_address || 'Address'),
        remarks: String(item.remarks || item.notes || ''),
        advance_bill_number: String(item.advance_bill_number || item.adv_bill_number || item.adv_bill || item.advance_bill || ''),
        final_bill_number: String(item.final_bill_number || item.final_bill_no || item.final_bill || item.bill_number || item.bill_no || item.bill || ''),
        order_date: normalizeDateString(String(item.order_date || new Date().toISOString().split('T')[0])),
        order_time: formatTo12Hour(String(item.order_time || getCurrentTime12Hour())) || getCurrentTime12Hour()
      };
    });
  } catch (err) {
    console.error('JSON parsing error:', err);
    throw new Error('Invalid JSON format. Please check your JSON structure.');
  }
}

/**
 * Downloads a sample CSV template matching the exact 24 columns for users
 */
export function downloadSampleCSVTemplate() {
  const sampleHeaders = [
    'Order #',
    'Outlet',
    'Order Date',
    'Order Time',
    'Delivery Date',
    'Expected Delivery Time',
    'Actual Delivery Time',
    'Customer Name',
    'Mobile',
    'Address',
    'Item Type',
    'Qty',
    'Type',
    'Total (₹)',
    'Advance (₹)',
    'Remaining Balance (₹)',
    'Payment Status',
    'Adv Bill No.',
    'Final Bill No.',
    'Order Status',
    'Delivery Partner',
    'Delivered By',
    'Payment Changed By',
    'Payment Changed At'
  ].join(',');

  const sampleRow1 = [
    '101',
    'Sector 31',
    '2026-08-16',
    '10:30 AM',
    '2026-08-16',
    '05:00 PM',
    '04:55 PM',
    'Rahul Sharma',
    '9876543210',
    'House #45 Sector 31 Faridabad',
    'Chocolate Fudge Cake 1kg',
    '1',
    'delivery',
    '1200',
    '500',
    '700',
    'part',
    'ADV-101',
    'FIN-101',
    'delivered',
    'Amit Kumar',
    'Amit Kumar',
    'Admin',
    '2026-08-16 10:30 AM'
  ].join(',');

  const sampleRow2 = [
    '102',
    'Sector 35',
    '2026-08-16',
    '11:15 AM',
    '2026-08-16',
    '06:30 PM',
    '',
    'Priya Verma',
    '9123456789',
    'Store Pickup',
    'Red Velvet Pastry (Box of 4)',
    '2',
    'pickup',
    '640',
    '640',
    '0',
    'full',
    'ADV-102',
    '',
    'processing',
    '',
    '',
    '',
    ''
  ].join(',');

  const csvContent = `${sampleHeaders}\n${sampleRow1}\n${sampleRow2}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'broomies_24_columns_orders_template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Downloads a sample JSON template for users matching all 24 fields
 */
export function downloadSampleJSONTemplate() {
  const sampleData = [
    {
      order_number: 101,
      outlet: 'Sector 31',
      order_date: '2026-08-16',
      order_time: '10:30 AM',
      delivery_date: '2026-08-16',
      expected_delivery_time: '05:00 PM',
      actual_delivery_time: '04:55 PM',
      customer_name: 'Rahul Sharma',
      mobile: '9876543210',
      address: 'House #45 Sector 31 Faridabad',
      item_type: 'Chocolate Fudge Cake 1kg',
      qty: 1,
      type: 'delivery',
      total: 1200,
      advance: 500,
      remaining_balance: 700,
      payment_status: 'part',
      adv_bill_no: 'ADV-101',
      final_bill_no: 'FIN-101',
      order_status: 'delivered',
      delivery_partner: 'Amit Kumar',
      delivered_by: 'Amit Kumar',
      payment_changed_by: 'Admin',
      payment_changed_at: '2026-08-16 10:30 AM'
    },
    {
      order_number: 102,
      outlet: 'Sector 35',
      order_date: '2026-08-16',
      order_time: '11:15 AM',
      delivery_date: '2026-08-16',
      expected_delivery_time: '06:30 PM',
      actual_delivery_time: '',
      customer_name: 'Priya Verma',
      mobile: '9123456789',
      address: 'Store Pickup',
      item_type: 'Red Velvet Pastry (Box of 4)',
      qty: 2,
      type: 'pickup',
      total: 640,
      advance: 640,
      remaining_balance: 0,
      payment_status: 'full',
      adv_bill_no: 'ADV-102',
      final_bill_no: '',
      order_status: 'processing',
      delivery_partner: '',
      delivered_by: '',
      payment_changed_by: '',
      payment_changed_at: ''
    }
  ];

  const jsonContent = JSON.stringify(sampleData, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'broomies_24_columns_orders_template.json');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
