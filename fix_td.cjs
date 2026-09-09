const fs = require('fs');
let code = fs.readFileSync('src/lib/exportUtils.ts', 'utf-8');

code = code.replace(
`      <td>
        </td>
      <td>
        <div style="font-size: 9px; color: #64748b; line-height: 1.2;">\${o.late_reason || o.remarks || '-'}</div>
      </td>
      <td>
        \${billCellHtml}
      </td>`,
`      <td>
        <div style="font-size: 9px; color: #64748b; line-height: 1.2;">\${o.late_reason || o.remarks || '-'}</div>
      </td>
      <td>
        \${billCellHtml}
      </td>`
);

fs.writeFileSync('src/lib/exportUtils.ts', code);
console.log('Fixed extra TD in exportUtils.ts');
