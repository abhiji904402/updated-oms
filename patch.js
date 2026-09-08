const fs = require('fs');
let code = fs.readFileSync('src/lib/store.tsx', 'utf-8');

code = code.replace(
  "showNotification(`✅ Order #${targetOrder.order_number} delivery confirmed by Outlet!`);",
  `if (isAutoConfirm) {
      showNotification(\`✅ Order #\${targetOrder.order_number} delivery auto-confirmed (30m timeout)\`);
    } else {
      showNotification(\`✅ Order #\${targetOrder.order_number} delivery confirmed by Outlet!\`);
    }`
);

code = code.replace(
  "confirmRiderDelivery(o.id);",
  "confirmRiderDelivery(o.id, true);"
);

fs.writeFileSync('src/lib/store.tsx', code);
