const fs = require('fs');
let code = fs.readFileSync('src/lib/exportUtils.ts', 'utf-8');

const oldTd = `<div style="font-size: 9px; color: #64748b; line-height: 1.2;">\${o.late_reason || o.remarks || '-'}</div>`;

const newTd = `\${o.remarks ? \`<div style="font-size: 9px; color: #64748b; line-height: 1.2;">\${o.remarks}</div>\` : ''}
        \${o.late_reason ? \`<div style="font-size: 9px; color: #dc2626; font-weight: bold; line-height: 1.2; margin-top: \${o.remarks ? '4px' : '0'};">Delay: \${o.late_reason}</div>\` : ''}
        \${!o.remarks && !o.late_reason ? \`<span style="color: #94a3b8; font-size: 9px;">—</span>\` : ''}`;

code = code.replace(oldTd, newTd);

fs.writeFileSync('src/lib/exportUtils.ts', code);
console.log('Fixed remarks split');
