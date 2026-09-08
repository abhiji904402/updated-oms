const fs = require('fs');
let code = fs.readFileSync('src/components/EditOrderModal.tsx', 'utf-8');

code = code.replace(
  "  const isOutletUser = session?.role === 'outlet';",
  "  const isOutletUser = session?.role === 'outlet';\n  const isManagerUser = session?.role === 'manager';"
);

// Disable delete for manager
code = code.replace(
  "            {!isOutletUser ? (",
  "            {!isOutletUser && !isManagerUser ? ("
);

// We need to disable fields if isManagerUser is true.
// A simple way is to replace `<input ` with `<input disabled={isManagerUser} ` 
// and `<textarea ` with `<textarea disabled={isManagerUser} `
// `<select ` with `<select disabled={isManagerUser && name !== 'delivery_partner'} ` but name isn't always easily available.
// Let's just find the form elements and disable them safely. Let's do it using regex.

code = code.replace(/<input\b/g, "<input disabled={isManagerUser}");
code = code.replace(/<textarea\b/g, "<textarea disabled={isManagerUser}");
// Be careful with selects. Delivery Partner select must remain active.
// Let's find selects:
// There is an Outlet select, Delivery Type select, Status select, Payment Type select.
code = code.replace(/<select\s+value=\{formData\.outlet\}/g, "<select disabled={isManagerUser} value={formData.outlet}");
code = code.replace(/<select\s+value=\{formData\.delivery_type\}/g, "<select disabled={isManagerUser} value={formData.delivery_type}");
code = code.replace(/<select\s+value=\{formData\.status\}/g, "<select disabled={isManagerUser} value={formData.status}");
code = code.replace(/<select\s+value=\{formData\.payment_type\}/g, "<select disabled={isManagerUser} value={formData.payment_type}");

// Buttons that update images or image preview remove:
code = code.replace(
  /onClick=\{\(\) => setFormData\(\(prev\) => \(\{ \.\.\.prev, item_image_url: '' \}\)\)\}/g,
  "disabled={isManagerUser} onClick={() => setFormData((prev) => ({ ...prev, item_image_url: '' }))}"
);

// Check if we accidentally added multiple disabled attributes if run multiple times (no).

fs.writeFileSync('src/components/EditOrderModal.tsx', code);
console.log('EditOrderModal.tsx patched');
