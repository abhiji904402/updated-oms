const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  "import { AlertsPage } from './pages/AlertsPage';",
  "import { AlertsPage } from './pages/AlertsPage';\nimport { ManagerAlarmSystem } from './components/ManagerAlarmSystem';"
);

code = code.replace(
  "      <PasswordManagerModal",
  "      <ManagerAlarmSystem />\n      <PasswordManagerModal"
);

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx patched with ManagerAlarmSystem');
