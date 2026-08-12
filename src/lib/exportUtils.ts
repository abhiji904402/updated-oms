import { Order } from '../types';
import { formatTo12Hour, getDeliveryTimeInfo } from './timeUtils';

export function exportToCSV(orders: Order[], filename = 'broomies_orders.csv') {
  const headers = [
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
  ];

  const rows = orders.map((o) => {
    const timeInfo = getDeliveryTimeInfo(o);
    const advBill = o.advance_bill_number || (o as any).adv_bill_number || (o as any).adv_bill || (o as any).advance_bill || '';
    const finalBill = o.final_bill_number || (o as any).final_bill_no || (o as any).final_bill || (o as any).bill_number || (o as any).bill_no || (o as any).bill || '';

    return [
      o.order_number,
      `"${o.outlet}"`,
      `"${o.order_date}"`,
      `"${formatTo12Hour(o.order_time) || ''}"`,
      `"${o.delivery_date || ''}"`,
      `"${timeInfo.expectedFormatted}"`,
      `"${timeInfo.actualFormatted}"`,
      `"${o.customer_name}"`,
      `"${o.mobile_number}"`,
      `"${(o.address || 'N/A').replace(/"/g, '""')}"`,
      `"${o.item_type.replace(/"/g, '""')}"`,
      o.quantity,
      o.delivery_type,
      (o.total_amount || 0).toFixed(2),
      (o.advance_amount || 0).toFixed(2),
      (o.remaining_balance || 0).toFixed(2),
      o.payment_type,
      `"${advBill || 'N/A'}"`,
      `"${finalBill || 'N/A'}"`,
      o.status,
      `"${o.delivery_partner || 'Unassigned'}"`,
      `"${o.delivered_by || o.delivery_partner || 'N/A'}"`,
      `"${o.payment_changed_by || 'System'}"`,
      `"${o.payment_changed_at ? formatTo12Hour(o.payment_changed_at) : ''}"`
    ];
  });

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function printPDFReport(orders: Order[], title = 'Broomies Bakery - Master Order Summary Report') {
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const totalPaid = orders.reduce((sum, o) => sum + (o.advance_amount || 0), 0);
  const totalPending = orders.reduce((sum, o) => sum + (o.remaining_balance || 0), 0);

  const rowsHtml = orders
    .map(
      (o) => {
        const timeInfo = getDeliveryTimeInfo(o);
        const statusColor =
          o.status === 'delivered'
            ? '#16a34a'
            : o.status === 'out_for_delivery'
            ? '#d97706'
            : o.status === 'processing'
            ? '#9333ea'
            : o.status === 'on_hold'
            ? '#2563eb'
            : o.status === 'cancelled'
            ? '#dc2626'
            : '#475569';

        const advBill = o.advance_bill_number || (o as any).adv_bill_number || (o as any).adv_bill || (o as any).advance_bill || '';
        const finalBill = o.final_bill_number || (o as any).final_bill_no || (o as any).final_bill || (o as any).bill_number || (o as any).bill_no || (o as any).bill || '';

        let billCellHtml = '';
        if (advBill && finalBill) {
          billCellHtml = `
            <div style="font-size: 10px; color: #d97706;">Adv Bill: <strong>${advBill}</strong></div>
            <div style="font-size: 10px; color: #16a34a;">Final Bill: <strong>${finalBill}</strong></div>
          `;
        } else if (finalBill) {
          billCellHtml = `<div style="font-size: 11px; color: #16a34a; font-weight: bold;">${finalBill}</div>`;
        } else if (advBill) {
          billCellHtml = `<div style="font-size: 11px; color: #d97706; font-weight: bold;">Adv: ${advBill}</div>`;
        } else {
          billCellHtml = `<span style="color: #94a3b8; font-size: 10px;">—</span>`;
        }

        return `
    <tr>
      <td style="font-weight: bold; color: #0f172a;">#${o.order_number}</td>
      <td><strong>${o.outlet}</strong></td>
      <td>
        <strong>${o.customer_name}</strong><br/>
        <span style="color: #2563eb; font-weight: 600;">📞 ${o.mobile_number}</span><br/>
        <small style="color: #64748b;">📍 ${o.address || 'Pickup/N/A'}</small>
      </td>
      <td>
        <strong>${o.item_type}</strong> (x${o.quantity})<br/>
        <span style="font-size: 9px; text-transform: uppercase; padding: 2px 4px; background: #e2e8f0; border-radius: 3px; font-weight: bold;">
          ${o.delivery_type}
        </span>
      </td>
      <td>
        <span style="font-size: 10px; color: #475569;">Ord: ${o.order_date || ''} ${formatTo12Hour(o.order_time) || ''}</span><br/>
        <span style="font-size: 10px; color: #0284c7; font-weight: 600;">Del: ${o.delivery_date || ''}</span>
      </td>
      <td>
        <div style="font-size: 10px;">Exp: <strong>${timeInfo.expectedFormatted}</strong></div>
        <div style="font-size: 10px; color: #16a34a; font-weight: bold;">Act: ${timeInfo.actualFormatted}</div>
      </td>
      <td>
        <div>Total: <strong>₹${(o.total_amount || 0).toFixed(2)}</strong></div>
        <div style="color: #16a34a; font-size: 10px;">Paid: ₹${(o.advance_amount || 0).toFixed(2)}</div>
        <div style="color: #dc2626; font-size: 10px;">Due: ₹${(o.remaining_balance || 0).toFixed(2)}</div>
      </td>
      <td>
        <span style="font-weight: 700; font-size: 9px; color: ${statusColor}; text-transform: uppercase; padding: 2px 4px; border: 1px solid ${statusColor}; border-radius: 3px;">
          ${o.status}
        </span>
        <div style="font-size: 10px; color: #475569; margin-top: 3px;">Pay: ${o.payment_type.toUpperCase()}</div>
      </td>
      <td>
        <div style="font-weight: 600;">${o.delivery_partner || '—'}</div>
        ${o.delivered_by ? `<div style="font-size: 10px; color: #64748b;">By: ${o.delivered_by}</div>` : ''}
        ${o.otp ? `<div style="font-size: 10px; color: #d97706; font-weight: bold;">OTP: ${o.otp}</div>` : ''}
      </td>
      <td>
        ${billCellHtml}
      </td>
    </tr>
  `;
      }
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page {
            size: landscape;
            margin: 8mm;
          }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; padding: 10px; margin: 0; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e11d48; padding-bottom: 10px; margin-bottom: 12px; }
          .brand { font-size: 20px; font-weight: 800; color: #e11d48; letter-spacing: -0.5px; }
          .meta { font-size: 11px; color: #475569; text-align: right; }
          .summary { display: flex; gap: 15px; margin-bottom: 15px; background: #f8fafc; padding: 10px 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
          .stat { flex: 1; }
          .stat-label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; }
          .stat-value { font-size: 16px; font-weight: 800; margin-top: 2px; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; }
          th { background: #0f172a; color: white; padding: 8px 6px; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b; }
          td { padding: 6px; border: 1px solid #cbd5e1; vertical-align: top; }
          tr:nth-child(even) { background-color: #f8fafc; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">BROOMIES BAKERY</div>
            <div style="font-size: 13px; color: #334155; font-weight: 600;">${title}</div>
          </div>
          <div class="meta">
            Generated: ${new Date().toLocaleString()}<br/>
            Total Orders Count: ${orders.length}
          </div>
        </div>

        <div class="summary">
          <div class="stat">
            <div class="stat-label">Total Orders</div>
            <div class="stat-value">${orders.length}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Total Order Value</div>
            <div class="stat-value">₹${(totalRevenue || 0).toFixed(2)}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Total Advance Received</div>
            <div class="stat-value" style="color: #16a34a;">₹${(totalPaid || 0).toFixed(2)}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Total Balance Due</div>
            <div class="stat-value" style="color: #dc2626;">₹${(totalPending || 0).toFixed(2)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 5%;">Order #</th>
              <th style="width: 9%;">Outlet</th>
              <th style="width: 18%;">Customer & Address</th>
              <th style="width: 13%;">Item Details</th>
              <th style="width: 11%;">Dates</th>
              <th style="width: 11%;">Time Tracking</th>
              <th style="width: 10%;">Payment (₹)</th>
              <th style="width: 9%;">Status</th>
              <th style="width: 8%;">Delivery / OTP</th>
              <th style="width: 8%;">Bill No(s)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div style="margin-top: 20px; text-align: center; font-size: 11px; color: #64748b;" class="no-print">
          PDF report formatted in landscape layout with all order fields.
        </div>
        <div style="text-align: center; margin-top: 10px;" class="no-print">
          <button onclick="window.print()" style="background: #e11d48; color: white; border: none; padding: 10px 24px; font-size: 14px; border-radius: 8px; cursor: pointer; font-weight: 700;">🖨️ Print / Save Full PDF Report</button>
        </div>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (e) {
        console.error('Print error:', e);
      }
    }, 300);
    return;
  }

  // Fallback if popup blocked
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = '100%';
  iframe.style.height = '1000px';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Iframe print error:', e);
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }
  }, 300);
}
