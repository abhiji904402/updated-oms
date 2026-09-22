const fs = require('fs');
let content = fs.readFileSync('src/pages/OutletDashboard.tsx', 'utf-8');

const regex = /const safeOrders = useMemo\(\(\) => \{[\s\S]*?\}, \[orders, isOutletUser, assignedOutlet\]\);/m;

const newFunc = `const safeOrders = useMemo(() => {
    const raw = orders || [];
    
    // Deduplicate by order number just to be 100% safe for display
    const omsMap = new Map<number, typeof orders[0]>();
    const idMap = new Map<string, typeof orders[0]>();

    for (const ord of raw) {
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

    let uniqueOrders = [...Array.from(omsMap.values()), ...Array.from(idMap.values())];

    if (isOutletUser && assignedOutlet) {
      return uniqueOrders.filter((o) => matchesOutlet(o.outlet, assignedOutlet));
    }
    return uniqueOrders;
  }, [orders, isOutletUser, assignedOutlet]);`;

if (content.match(regex)) {
  content = content.replace(regex, newFunc);
  fs.writeFileSync('src/pages/OutletDashboard.tsx', content, 'utf-8');
  console.log("OutletDashboard patched");
} else {
  console.log("Could not find regex in OutletDashboard");
}
