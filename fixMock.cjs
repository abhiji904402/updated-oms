const fs = require('fs');
let code = fs.readFileSync('src/lib/firebaseMock.ts', 'utf8');

code = code.replace(
`callback({
             docs: data.map((d: any) => ({ id: d.id || d._id, ref: { collection: ref.collection, id: d.id || d._id }, data: () => d }))
           });`,
`const docs = data.map((d: any) => ({ id: d.id || d._id, ref: { collection: ref.collection, id: d.id || d._id }, data: () => d }));
           callback({
             docs,
             size: docs.length,
             empty: docs.length === 0,
             forEach: (cb: any) => docs.forEach(cb)
           });`);

fs.writeFileSync('src/lib/firebaseMock.ts', code);
