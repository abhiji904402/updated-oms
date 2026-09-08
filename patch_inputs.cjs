const fs = require('fs');
let code = fs.readFileSync('src/components/EditOrderModal.tsx', 'utf-8');

// The replacement `<input disabled={isManagerUser}` added disabled at the very beginning of the tag.
// If the tag already had disabled={isOutletUser}, we have both.

code = code.replace(
  /<input disabled=\{isManagerUser\}\s+type/g,
  "<input type"
);
code = code.replace(
  /<textarea disabled=\{isManagerUser\}\s+value/g,
  "<textarea value"
);

// Let's just do a clean targeted approach.

// 1. Mobile Number (Line 633)
code = code.replace(
  /value=\{mobileNumber\}\s*disabled=\{isOutletUser\}/g,
  "value={mobileNumber}\n                disabled={isOutletUser || isManagerUser}"
);
// 2. Customer Name
code = code.replace(
  /value=\{customerName\}\s*disabled=\{isOutletUser\}/g,
  "value={customerName}\n                disabled={isOutletUser || isManagerUser}"
);
// 3. Item Type
code = code.replace(
  /value=\{itemType\}\s*disabled=\{isOutletUser\}/g,
  "value={itemType}\n                disabled={isOutletUser || isManagerUser}"
);
// 4. Quantity
code = code.replace(
  /value=\{quantity\}\s*disabled=\{isOutletUser\}/g,
  "value={quantity}\n                disabled={isOutletUser || isManagerUser}"
);
// 5. Total Amount
code = code.replace(
  /value=\{totalAmountStr\}\s*disabled=\{isOutletUser\}/g,
  "value={totalAmountStr}\n                disabled={isOutletUser || isManagerUser}"
);
// 6. Delivery Address
code = code.replace(
  /value=\{deliveryAddress\}\s*disabled=\{isOutletUser\}/g,
  "value={deliveryAddress}\n                  disabled={isOutletUser || isManagerUser}"
);
// 7. Remarks
code = code.replace(
  /value=\{remarks\}\s*disabled=\{isOutletUser\}/g,
  "value={remarks}\n                  disabled={isOutletUser || isManagerUser}"
);
// 8. Expected Delivery Date
code = code.replace(
  /value=\{expectedDeliveryDate\}\s*disabled=\{isOutletUser\}/g,
  "value={expectedDeliveryDate}\n                  disabled={isOutletUser || isManagerUser}"
);
// 9. Expected Delivery Time
code = code.replace(
  /value=\{expectedDeliveryTime\}\s*disabled=\{isOutletUser\}/g,
  "value={expectedDeliveryTime}\n                  disabled={isOutletUser || isManagerUser}"
);
// 10. Advance Amount
code = code.replace(
  /value=\{advanceAmountStr\}\s*onChange/g,
  "disabled={isManagerUser}\n                    value={advanceAmountStr}\n                    onChange"
);
// 11. Delivery Partner (We want this NOT disabled for manager, but disabled for outlet)
// It was patched earlier successfully to `disabled={isOutletUser}`. Let's make sure it doesn't have duplicate disabled.

// 12. Also, remove duplicate `disabled={isManagerUser}` that I added before from all <input> and <textarea>
code = code.replace(/<input disabled=\{isManagerUser\}\s+/g, "<input ");
code = code.replace(/<textarea disabled=\{isManagerUser\}\s+/g, "<textarea ");


fs.writeFileSync('src/components/EditOrderModal.tsx', code);
console.log('Fixed inputs in EditOrderModal');
