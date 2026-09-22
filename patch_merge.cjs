const fs = require('fs');
let content = fs.readFileSync('src/lib/store.tsx', 'utf-8');

const regex = /const mergeAndDeduplicateOrders = \(currentList: Order\[\], incomingList: Order\[\]\): Order\[\] => \{[\s\S]*?return uniqueOrders;\n  \};/m;

const newFunc = `const mergeAndDeduplicateOrders = (currentList: Order[], incomingList: Order[]): Order[] => {
    const orderMap = new Map<string, Order>(); // By ID for exact matches
    const omsMap = new Map<number, Order>(); // By OMS number to prevent duplicate display

    // 1. Process current local orders
    for (const ord of currentList) {
      if (ord && ord.id) {
        const oms = Number(ord.order_number) || 0;
        
        // Handle pure ID-based merging first
        orderMap.set(ord.id, ord);
        
        // Track the best (newest) order for this OMS number
        if (oms > 0) {
          const existingOms = omsMap.get(oms);
          if (!existingOms) {
            omsMap.set(oms, ord);
          } else {
            const existingTime = new Date(existingOms.updated_at || existingOms.created_at || 0).getTime();
            const incomingTime = new Date(ord.updated_at || ord.created_at || 0).getTime();
            if (incomingTime >= existingTime) {
              omsMap.set(oms, ord);
            }
          }
        }
      }
    }

    // 2. Merge incoming orders
    for (const ord of incomingList) {
      if (!ord || !ord.id) continue;
      const oms = Number(ord.order_number) || 0;

      // Handle ID-based merge
      const existing = orderMap.get(ord.id);
      let mergedOrd = ord;
      if (existing) {
        const existingTime = new Date(existing.updated_at || existing.created_at || 0).getTime();
        const incomingTime = new Date(ord.updated_at || ord.created_at || 0).getTime();
        if (incomingTime >= existingTime) {
          mergedOrd = { ...existing, ...ord };
          orderMap.set(ord.id, mergedOrd);
        } else {
          mergedOrd = existing;
        }
      } else {
        orderMap.set(ord.id, ord);
      }

      // Track by OMS number
      if (oms > 0) {
        const existingOms = omsMap.get(oms);
        if (!existingOms) {
          omsMap.set(oms, mergedOrd);
        } else {
          const existingTime = new Date(existingOms.updated_at || existingOms.created_at || 0).getTime();
          const incomingTime = new Date(mergedOrd.updated_at || mergedOrd.created_at || 0).getTime();
          if (incomingTime >= existingTime) {
            omsMap.set(oms, mergedOrd);
          }
        }
      }
    }

    // Return unique orders by OMS number, discarding ghost duplicates
    const uniqueOrders = Array.from(omsMap.values());
    uniqueOrders.sort((a, b) => {
      const numA = Number(a.order_number) || 0;
      const numB = Number(b.order_number) || 0;
      if (numB !== numA) return numB - numA;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
    return uniqueOrders;
  };`;

content = content.replace(regex, newFunc);
fs.writeFileSync('src/lib/store.tsx', content, 'utf-8');
