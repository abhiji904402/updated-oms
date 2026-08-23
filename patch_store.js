const fs = require('fs');
let code = fs.readFileSync('src/lib/store.tsx', 'utf8');

code = code.replace(
  /idbGet<Order\[\]>\(LOCAL_VAULT_KEYS\.ACTIVE_ORDERS\)\.then\(\(vaultOrders\) => \{[\s\S]*?\} else \{([\s\S]*?)\}\)\.catch\(\(\) => \{\}\);\n      \}/,
  '$1'
);

// We need a reliable regex. Or let's just do it manually.
