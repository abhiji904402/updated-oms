const fs = require('fs');
let code = fs.readFileSync('src/components/OrderCard.tsx', 'utf8');
code = code.replace(
  '<span className="truncate">{order.customer_name}</span>',
  '<span className="truncate flex items-center gap-1.5"><Phone className="w-5 h-5 text-purple-400" /> {order.mobile_number}</span>'
);
code = code.replace(
  '<Phone className="w-3 h-3 text-purple-400" /> {order.mobile_number}',
  'Order #{order.order_number}'
);
fs.writeFileSync('src/components/OrderCard.tsx', code);
