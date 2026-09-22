const fs = require('fs');
let code = fs.readFileSync('src/components/ManagerAlarmSystem.tsx', 'utf-8');

// The logic inside `checkAlarms` only considers things that haven't been acked yet, and sets the `activeAlarmOrder`.
// We need to make sure that once it triggers, it STAYS there until OK is clicked.

code = code.replace(
  "if (activeAlarmOrder) return;",
  "// If one is ringing, stay on it. Do not let anything interrupt it.\n      if (activeAlarmOrder) return;"
);

fs.writeFileSync('src/components/ManagerAlarmSystem.tsx', code);
console.log('Alarm logic check done');
