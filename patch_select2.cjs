const fs = require('fs');
let code = fs.readFileSync('src/components/EditOrderModal.tsx', 'utf-8');

code = code.replace(
  "<select disabled={isManagerUser || isOutletUser}\n                  value={deliveryType}\n                  disabled={isOutletUser}",
  "<select disabled={isManagerUser || isOutletUser}\n                  value={deliveryType}"
);

// also let's make sure the delivery Partner select is disabled for outlet, but NOT manager.
code = code.replace(
  "<select\n                  value={deliveryPartner}\n                  disabled={isOutletUser}",
  "<select\n                  value={deliveryPartner}\n                  disabled={isOutletUser && !isManagerUser}"
); // Wait, isOutletUser and isManagerUser are mutually exclusive roles. So just `disabled={isOutletUser}` is fine.

fs.writeFileSync('src/components/EditOrderModal.tsx', code);
console.log('Fixed select duplicated');
