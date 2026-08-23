const fs = require('fs');
let code = fs.readFileSync('src/lib/firebaseMock.ts', 'utf8');
code = code.replace(/commit: async \(\) => {[\s\S]*?}\n  };/, `commit: async () => {\n      const promises = operations.map(op => {\n         if (op.action === 'set') {\n           return setDoc({collection: op.collection, id: op.id}, op.data, op.options).catch(e => console.error(e));\n         }\n         else if (op.action === 'delete') {\n           return deleteDoc({collection: op.collection, id: op.id}).catch(e => console.error(e));\n         }\n         return Promise.resolve();\n      });\n      await Promise.all(promises);\n    }\n  };`);
fs.writeFileSync('src/lib/firebaseMock.ts', code);
