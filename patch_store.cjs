const fs = require('fs');
let code = fs.readFileSync('src/lib/store.tsx', 'utf-8');

code = code.replace(
  "admin: parsed.admin || DEFAULT_PASSWORDS.admin,",
  "admin: parsed.admin || DEFAULT_PASSWORDS.admin,\n            manager: parsed.manager || DEFAULT_PASSWORDS.manager,"
);

fs.writeFileSync('src/lib/store.tsx', code);
console.log('Fixed manager property in AuthPasswords');
