const fs = require('fs');
let code = fs.readFileSync('src/lib/exportUtils.ts', 'utf-8');

// Update TH widths to make room for Remarks
code = code.replace('<th style="width: 5%;">Order #</th>', '<th style="width: 5%;">Order #</th>'); // Order #
code = code.replace('<th style="width: 9%;">Outlet</th>', '<th style="width: 8%;">Outlet</th>'); // Outlet
code = code.replace('<th style="width: 18%;">Customer & Address</th>', '<th style="width: 16%;">Customer & Address</th>'); // Customer
code = code.replace('<th style="width: 13%;">Item Details</th>', '<th style="width: 11%;">Item Details</th>'); // Item
code = code.replace('<th style="width: 11%;">Dates</th>', '<th style="width: 9%;">Dates</th>'); // Dates
code = code.replace('<th style="width: 11%;">Time Tracking</th>', '<th style="width: 12%;">Time Tracking</th>'); // Time Tracking
code = code.replace('<th style="width: 10%;">Payment (₹)</th>', '<th style="width: 9%;">Payment (₹)</th>'); // Payment
code = code.replace('<th style="width: 9%;">Status</th>', '<th style="width: 8%;">Status</th>'); // Status
code = code.replace('<th style="width: 8%;">Delivered By</th>', '<th style="width: 8%;">Delivered By</th>'); // Delivered By
code = code.replace('<th style="width: 8%;">Bill No(s)</th>', '<th style="width: 7%;">Remarks</th>\n              <th style="width: 7%;">Bill No(s)</th>'); // Bill No

// Now to update TD for Remarks & time tracking & pickup logic

const parseDiffHTML = `
        let diffHtml = '';
        if (o.status === 'delivered' && o.actual_delivery_time) {
          const expectedMs = getExpectedTimestamp(o);
          const actualMs = new Date(o.actual_delivery_time).getTime();
          if (expectedMs > 0 && !isNaN(actualMs)) {
            const diffMins = Math.round((actualMs - expectedMs) / 60000);
            if (diffMins > 0) {
              diffHtml = \`<div style="font-size: 10px; color: #dc2626; font-weight: bold; margin-top: 4px;">Diff: +\${diffMins}m (Late)</div>\`;
            } else if (diffMins < 0) {
              diffHtml = \`<div style="font-size: 10px; color: #16a34a; font-weight: bold; margin-top: 4px;">Diff: \${Math.abs(diffMins)}m (Early)</div>\`;
            } else {
              diffHtml = \`<div style="font-size: 10px; color: #0284c7; font-weight: bold; margin-top: 4px;">Diff: On Time</div>\`;
            }
          }
        }
        
        let displayStatus = o.status.toUpperCase();
        if (o.status === 'delivered' && String(o.delivery_type || '').toLowerCase().trim() === 'pickup') {
          displayStatus = 'PICKED UP';
        }
`;

code = code.replace(
  "const advBill = o.advance_bill_number",
  parseDiffHTML + "\n        const advBill = o.advance_bill_number"
);

// replace the actual render values
code = code.replace(
  "<div style=\"font-size: 10px; color: #16a34a; font-weight: bold;\">Act: ${timeInfo.actualFormatted}</div>",
  "<div style=\"font-size: 10px; color: #16a34a; font-weight: bold;\">Act: ${timeInfo.actualFormatted}</div>\n        ${diffHtml}"
);

code = code.replace(
  "${o.status}",
  "${displayStatus}"
);

code = code.replace(
  "${billCellHtml}\n      </td>",
  "</td>\n      <td>\n        <div style=\"font-size: 9px; color: #64748b; line-height: 1.2;\">${o.late_reason || o.remarks || '-'}</div>\n      </td>\n      <td>\n        ${billCellHtml}\n      </td>"
);

fs.writeFileSync('src/lib/exportUtils.ts', code);
console.log('Updated exportUtils table layout');
