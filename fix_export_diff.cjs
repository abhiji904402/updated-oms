const fs = require('fs');
let code = fs.readFileSync('src/lib/exportUtils.ts', 'utf-8');

// The block we added to exportToCSV by accident:
const diffHtmlBlock = `        let diffHtml = '';
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

// Remove it from exportToCSV
code = code.replace(diffHtmlBlock, "");

// Add it to printPDFReport right after "const statusColor = ..."
const addAfter = `            : '#475569';`;

code = code.replace(addAfter, addAfter + "\n\n" + diffHtmlBlock);

fs.writeFileSync('src/lib/exportUtils.ts', code);
console.log('Fixed exportUtils.ts diffHtml scope issue');
