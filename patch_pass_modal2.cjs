const fs = require('fs');
let code = fs.readFileSync('src/components/PasswordManagerModal.tsx', 'utf-8');

code = code.replace(
  "  const [adminPass, setAdminPass] = useState(authPasswords?.admin || 'admin123');",
  "  const [adminPass, setAdminPass] = useState(authPasswords?.admin || 'admin123');\n  const [managerPass, setManagerPass] = useState(authPasswords?.manager || 'manager123');"
);

fs.writeFileSync('src/components/PasswordManagerModal.tsx', code);
console.log('PasswordManagerModal.tsx patched states');
