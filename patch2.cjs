const fs = require('fs');
let code = fs.readFileSync('src/components/OrderCard.tsx', 'utf8');
code = code.replace(
  'Title & Customer Subtitle',
  'Title & Phone Number Subtitle'
);
code = code.replace(
  'Hi ${order.customer_name}, regarding',
  'Hi ${order.customer_name || "Customer"}, regarding'
);
fs.writeFileSync('src/components/OrderCard.tsx', code);
