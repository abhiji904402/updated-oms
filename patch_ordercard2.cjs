const fs = require('fs');
let code = fs.readFileSync('src/components/OrderCard.tsx', 'utf-8');

code = code.replace(
  '<option value="delivered" className="bg-slate-900 text-emerald-300">Delivered</option>',
  '<option value="delivered" className="bg-slate-900 text-emerald-300">{String(order.delivery_type || \'\').toLowerCase().trim() === \'pickup\' ? \'Picked Up\' : \'Delivered\'}</option>'
);

code = code.replace(
  'Delivered Marked by',
  '{String(order.delivery_type || \'\').toLowerCase().trim() === \'pickup\' ? \'Picked Up Marked by\' : \'Delivered Marked by\'}'
);

fs.writeFileSync('src/components/OrderCard.tsx', code);
console.log('OrderCard updated for pickup text');
