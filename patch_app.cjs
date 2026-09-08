const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  "else if (session.role === 'outlet' && activeTab !== 'dashboard' && activeTab !== 'outlet' && activeTab !== 'analytics')",
  "else if ((session.role === 'outlet' || session.role === 'manager') && activeTab !== 'dashboard' && activeTab !== 'outlet' && activeTab !== 'analytics')"
);

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx patched');
