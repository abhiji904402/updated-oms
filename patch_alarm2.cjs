const fs = require('fs');
let code = fs.readFileSync('src/components/ManagerAlarmSystem.tsx', 'utf-8');

code = code.replace(
  "import { getTodayDateStr } from '../lib/timeUtils';",
  "import { getTodayDateStr, getCountdownInfo, formatTo12Hour } from '../lib/timeUtils';"
);

const newFindLogic = `      const upcomingOrder = orders.find(o => {
        if (o.status === 'delivered' || o.status === 'cancelled' || o.status === 'missed') return false;
        
        const timeStr = o.delivery_time_expected || o.order_time;
        if (!timeStr) return false;
            
        // Ensure it's for today
        if (!isOrderForToday(o, todayStr)) return false;

        // Has it already been acked?
        if (ackedAlarms.has(o.id)) return false;

        const cInfo = getCountdownInfo(o, now.getTime());
        // If it's 30 mins or less away, and not super old (e.g., past 2 hours)
        if (cInfo.minutesRemaining <= 30 && cInfo.minutesRemaining >= -120) {
          return true;
        }
        return false;
      });`;

code = code.replace(
  /const upcomingOrder = orders\.find\([^]*?return false;\n      \}\);/,
  newFindLogic
);

// We also need to fix `order.scheduled_time` in the UI part:
code = code.replace(
  "order.scheduled_time",
  "formatTo12Hour(order.delivery_time_expected || order.order_time || '')"
);

fs.writeFileSync('src/components/ManagerAlarmSystem.tsx', code);
console.log('ManagerAlarmSystem.tsx patched');
