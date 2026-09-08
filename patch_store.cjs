const fs = require('fs');
let code = fs.readFileSync('src/lib/store.tsx', 'utf-8');

// 1. Add manager to AuthPasswords
code = code.replace(
  'export interface AuthPasswords {\n  admin: string;',
  'export interface AuthPasswords {\n  admin: string;\n  manager: string;'
);

// 2. Add manager to DEFAULT_PASSWORDS
code = code.replace(
  "  admin: 'admin123',",
  "  admin: 'admin123',\n  manager: 'manager123',"
);

// 3. Update verifyPassword to handle manager
const verifyReplacement = `  const verifyPassword = useCallback(
    (
      role: Role,
      identifier: string | null,
      attempt: string
    ) => {
      if (role === 'admin') {
        return attempt === authPasswords.admin;
      }
      if (role === 'manager') {
        return attempt === (authPasswords.manager || 'manager123');
      }
`;
code = code.replace(
  `  const verifyPassword = useCallback(
    (
      role: Role,
      identifier: string | null,
      attempt: string
    ) => {
      if (role === 'admin') {
        return attempt === authPasswords.admin;
      }`,
  verifyReplacement
);

// 4. Update the passwords subscription to include manager
code = code.replace(
  "              admin: data.admin || prev.admin,",
  "              admin: data.admin || prev.admin,\n              manager: data.manager || prev.manager || 'manager123',"
);

// We need an updateManagerPassword function too
const updateManagerPassCode = `  const updateManagerPassword = useCallback((newPass: string) => {
    setAuthPasswords((prev) => {
      const next = { ...prev, manager: newPass };
      setDoc(doc(db, 'system_settings', 'passwords'), next, { merge: true }).catch(() => {});
      return next;
    });
  }, []);

  const updateOutletPassword`;

code = code.replace("  const updateOutletPassword", updateManagerPassCode);

// Add to context type
code = code.replace(
  "  updateAdminPassword: (newPass: string) => void;",
  "  updateAdminPassword: (newPass: string) => void;\n  updateManagerPassword: (newPass: string) => void;"
);

// Add to context value
code = code.replace(
  "      updateAdminPassword,",
  "      updateAdminPassword,\n      updateManagerPassword,"
);

fs.writeFileSync('src/lib/store.tsx', code);
console.log('store.tsx patched');
