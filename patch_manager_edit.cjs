const fs = require('fs');
let code = fs.readFileSync('src/components/EditOrderModal.tsx', 'utf-8');

// Disable select fields for manager
code = code.replace(
  "<select\n                  value={outlet}",
  "<select disabled={isManagerUser || (!isNewOrder && isOutletUser)}\n                  value={outlet}"
);

code = code.replace(
  "<select\n                  value={status}",
  "<select disabled={isManagerUser || isOutletUser}\n                  value={status}"
);

code = code.replace(
  "<select\n                  value={deliveryType}",
  "<select disabled={isManagerUser || isOutletUser}\n                  value={deliveryType}"
);

code = code.replace(
  "<select\n                  value={paymentType}",
  "<select disabled={isManagerUser}\n                  value={paymentType}"
);

// Disable the image remove button properly
code = code.replace(
  "onClick={() => setItemImageUrl(null)}",
  "disabled={isManagerUser} onClick={() => setItemImageUrl(null)}"
);

// We need to hide the generic Edit icon for managers in OrderCard.tsx
let cardCode = fs.readFileSync('src/components/OrderCard.tsx', 'utf-8');
cardCode = cardCode.replace(
  "{onEditOrder && (\\n                    <button\\n                      onClick={() => onEditOrder(order)}",
  "{onEditOrder && session?.role !== 'manager' && (\\n                    <button\\n                      onClick={() => onEditOrder(order)}"
);

fs.writeFileSync('src/components/EditOrderModal.tsx', code);
fs.writeFileSync('src/components/OrderCard.tsx', cardCode);
console.log('Patched edit restrictions for manager');
