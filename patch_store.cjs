const fs = require('fs');
let code = fs.readFileSync('src/lib/store.tsx', 'utf8');

code = code.replace(
  /\/\/ Check both local vault key and legacy IDB key[\s\S]*?idbGet<Order\[\]>\(LOCAL_VAULT_KEYS\.ACTIVE_ORDERS\)[\s\S]*?\} else \{/,
  ""
);

code = code.replace(
  /\}\)\.catch\(\(\) => \{\}\);\n      \}/,
  ""
);

fs.writeFileSync('src/lib/store.tsx', code);
