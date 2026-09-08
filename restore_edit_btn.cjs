const fs = require('fs');
let code = fs.readFileSync('src/components/OrderCard.tsx', 'utf-8');

code = code.replace(
  "{onEditOrder && session?.role !== 'manager' && (\\n                    <button\\n                      onClick={() => onEditOrder(order)}",
  "{onEditOrder && (\\n                    <button\\n                      onClick={() => onEditOrder(order)}"
);

// I need to use the actual exact replacement because the regex I used earlier was specific.
// Let's just find "{onEditOrder && session?.role !== 'manager' && (" and replace it.
code = code.replace(
  "{onEditOrder && session?.role !== 'manager' && (",
  "{onEditOrder && ("
);

fs.writeFileSync('src/components/OrderCard.tsx', code);
console.log('Restored edit btn in OrderCard.tsx');
