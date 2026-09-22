const fs = require('fs');
let content = fs.readFileSync('src/pages/GoogleSheetsPage.tsx', 'utf-8');

const regex = /const sortedOrders = useMemo\(\(\) => \{[\s\S]*?\}, \[orders\]\);/m;

const newFunc = `const sortedOrders = useMemo(() => {
    // Deduplicate by order number just to be 100% safe for display
    const omsMap = new Map<number, typeof orders[0]>();
    const idMap = new Map<string, typeof orders[0]>();

    for (const ord of orders) {
       const num = Number(ord.order_number) || 0;
       if (num > 0) {
         const existing = omsMap.get(num);
         if (!existing) {
           omsMap.set(num, ord);
         } else {
           // keep newest
           const existingTime = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
           const newTime = ord.updated_at ? new Date(ord.updated_at).getTime() : 0;
           if (newTime > existingTime) {
             omsMap.set(num, ord);
           }
         }
       } else if (ord.id) {
         idMap.set(ord.id, ord);
       }
    }

    const uniqueOrders = [...Array.from(omsMap.values()), ...Array.from(idMap.values())];

    return uniqueOrders.sort((a, b) => {
      const numA = Number(a.order_number) || 0;
      const numB = Number(b.order_number) || 0;
      if (numB !== numA) return numB - numA;
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });
  }, [orders]);`;

content = content.replace(regex, newFunc);
fs.writeFileSync('src/pages/GoogleSheetsPage.tsx', content, 'utf-8');
