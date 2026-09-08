const fs = require('fs');
let code = fs.readFileSync('src/lib/store.tsx', 'utf-8');

const adminVerifyBlock = `      if (role === 'admin') {
        if (passwordAttempt === authPasswords.admin) {
          const userSession: UserSession = {
            id: 'usr-admin',
            name: 'Broomies Central Admin',
            role: 'admin'
          };
          return { success: true, userSession };
        }
        return { success: false, message: 'Incorrect Admin Password!' };
      }`;

const managerVerifyBlock = `
      if (role === 'manager') {
        if (passwordAttempt === (authPasswords.manager || 'manager123')) {
          const userSession: UserSession = {
            id: 'usr-manager',
            name: 'Broomies Central Manager',
            role: 'manager'
          };
          return { success: true, userSession };
        }
        return { success: false, message: 'Incorrect Manager Password!' };
      }`;

code = code.replace(adminVerifyBlock, adminVerifyBlock + managerVerifyBlock);

fs.writeFileSync('src/lib/store.tsx', code);
console.log('store.tsx patched with verifyManager');
