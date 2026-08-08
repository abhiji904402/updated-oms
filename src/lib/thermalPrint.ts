import { Order } from '../types';
import { formatTo12Hour } from './timeUtils';

export function printThermalReceipts(orders: Order[]) {
  if (!orders || orders.length === 0) return;

  const receiptHtml = orders
    .map(
      (o) => {
        const orderDateStr = new Date(o.order_date).toLocaleDateString('en-GB');
        const orderTimeStr = formatTo12Hour(o.order_time || o.order_date);
        const delivDateStr = o.delivery_date
          ? new Date(o.delivery_date).toLocaleDateString('en-GB')
          : orderDateStr;
        const delivTimeStr = formatTo12Hour(o.delivery_time_expected || o.order_time);

        return `
    <div class="receipt">
      <div class="center header-title">BROOMIES BAKERY</div>
      <div class="center sub-title">Fresh Baked Handcrafted Delights</div>
      <div class="divider">================================</div>
      
      <!-- TOP KEY DETAILS: ORDER DATE, DELIVERY DATE, DELIVERY TIME -->
      <div class="top-details-box">
        <div class="flex-between font-extra-large">
          <span class="bold">ORDER #:</span>
          <span class="bold">#${o.order_number}</span>
        </div>
        <div class="flex-between font-large">
          <span class="bold">ORDER DATE:</span>
          <span class="bold">${orderDateStr} (${orderTimeStr})</span>
        </div>
        <div class="flex-between font-large highlight-row">
          <span class="bold">DELIVERY DATE:</span>
          <span class="bold">${delivDateStr}</span>
        </div>
        <div class="flex-between font-large highlight-row">
          <span class="bold">DELIVERY TIME:</span>
          <span class="bold">${delivTimeStr}</span>
        </div>
        <div class="flex-between">
          <span class="bold">OUTLET:</span>
          <span class="bold uppercase">${o.outlet}</span>
        </div>
        <div class="flex-between">
          <span class="bold">TYPE:</span>
          <span class="bold uppercase">[${o.delivery_type === 'delivery' ? 'HOME DELIVERY' : 'STORE PICKUP'}]</span>
        </div>
      </div>

      <div class="divider">--------------------------------</div>
      
      <div class="bold font-medium uppercase">CUSTOMER DETAILS:</div>
      <div class="bold">${o.customer_name}</div>
      <div class="bold">Ph: ${o.mobile_number}</div>
      ${o.address ? `<div class="bold" style="font-size: 11px;">Add: ${o.address}</div>` : ''}

      <div class="divider">--------------------------------</div>

      <div class="bold font-medium uppercase">ORDER ITEMS:</div>
      <div class="flex-between item-row">
        <span class="bold font-large">${o.item_type}</span>
        <span class="bold font-large">Qty: ${o.quantity}</span>
      </div>

      <!-- CAKE PHOTO SECTION -->
      <div class="photo-container">
        <div class="bold center photo-title">[ CAKE PHOTO ]</div>
        <div class="center photo-wrapper">
          <img src="${o.item_image_url || o.delivery_photo_url || 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=300&q=80'}" class="cake-photo" alt="Cake Photo" />
        </div>
      </div>

      ${o.remarks ? `
        <div class="notes-box">
          <strong style="font-size:12px;">Remarks:</strong> <span style="font-weight:bold;">${o.remarks}</span>
        </div>
      ` : ''}

      <div class="divider">--------------------------------</div>

      <div class="flex-between font-extra-large">
        <span class="bold">TOTAL:</span>
        <span class="bold">₹${(o.total_amount || 0).toLocaleString()}</span>
      </div>
      <div class="flex-between font-medium">
        <span class="bold">Advance Paid:</span>
        <span class="bold">₹${(o.advance_amount || 0).toLocaleString()}</span>
      </div>
      <div class="flex-between font-large">
        <span class="bold">Remaining Due:</span>
        <span class="bold" style="color:${o.remaining_balance > 0 ? '#000' : '#000'}; text-decoration: ${o.remaining_balance > 0 ? 'underline' : 'none'};">₹${(o.remaining_balance || 0).toLocaleString()}</span>
      </div>
      <div class="flex-between font-medium">
        <span class="bold">Payment Mode:</span>
        <span class="bold uppercase">${o.payment_type}</span>
      </div>

      ${(o.advance_bill_number || o.final_bill_number) ? `
        <div class="flex-between font-medium" style="margin-top: 3px;">
          <span class="bold">Bill No(s):</span>
          <span class="bold">${[o.advance_bill_number, o.final_bill_number].filter(Boolean).join(' / ')}</span>
        </div>
      ` : ''}

      ${o.otp ? `
        <div class="center otp-box">
          DELIVERY OTP: <strong>${o.otp}</strong>
        </div>
      ` : ''}

      <div class="divider">================================</div>
      <div class="center footer-text bold">Thank you for choosing Broomies!</div>
      <div class="center footer-text bold">www.broomiesbakery.com</div>
      <div class="cut-line"> - - - - - CUT HERE - - - - - </div>
    </div>
  `;
      }
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Thermal Print Receipts - Broomies OMS</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          body {
            font-family: Arial, Helvetica, sans-serif, 'Courier New';
            width: 80mm;
            margin: 0 auto;
            padding: 4mm;
            color: #000;
            background: #fff;
            font-size: 13px;
            font-weight: 700;
            line-height: 1.3;
            -webkit-print-color-adjust: exact;
          }
          .receipt {
            margin-bottom: 20px;
            page-break-after: always;
          }
          .center { text-align: center; }
          .bold { font-weight: 900 !important; color: #000 !important; }
          .uppercase { text-transform: uppercase; }
          .header-title { font-size: 18px; font-weight: 900; letter-spacing: 1px; }
          .sub-title { font-size: 11px; font-weight: 800; margin-bottom: 4px; }
          .divider { text-align: center; font-weight: 900; margin: 4px 0; overflow: hidden; white-space: nowrap; font-size: 14px; }
          .flex-between { display: flex; justify-content: space-between; margin: 3px 0; }
          .top-details-box { border: 2px solid #000; padding: 6px; margin: 4px 0; border-radius: 4px; background: #fff; }
          .highlight-row { background: #eee; padding: 2px 4px; border-radius: 2px; }
          .font-medium { font-size: 12px; }
          .font-large { font-size: 14px; }
          .font-extra-large { font-size: 16px; font-weight: 900; }
          .item-row { margin: 6px 0; }
          .photo-container { margin: 8px 0; text-align: center; }
          .photo-title { font-size: 12px; font-weight: 900; margin-bottom: 4px; }
          .photo-wrapper { text-align: center; }
          .cake-photo { max-width: 100%; width: 220px; max-height: 200px; object-fit: cover; border: 2px solid #000; border-radius: 4px; display: block; margin: 0 auto; }
          .notes-box { font-style: italic; border: 1.5px dashed #000; padding: 6px; margin: 4px 0; font-size: 12px; }
          .otp-box { margin: 8px 0; padding: 6px; background: #eee; font-size: 14px; border: 2px solid #000; font-weight: 900; }
          .footer-text { font-size: 11px; margin-top: 2px; font-weight: 800; }
          .cut-line { font-size: 10px; text-align: center; margin-top: 15px; margin-bottom: 15px; color: #000; font-weight: 900; }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        ${receiptHtml}
      </body>
    </html>
  `;

  // Try opening a popup window first
  const printWindow = window.open('', '_blank', 'width=450,height=700');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    const doPrint = () => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (e) {
        console.error('Window print error:', e);
      }
    };

    setTimeout(doPrint, 300);
    return;
  }

  // Fallback to off-screen iframe if popups are blocked or disabled
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = '80mm';
  iframe.style.height = '1000px';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    alert('Unable to initialize printing.');
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const triggerDirectPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Direct thermal print error:', e);
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }
  };

  setTimeout(triggerDirectPrint, 300);
}
