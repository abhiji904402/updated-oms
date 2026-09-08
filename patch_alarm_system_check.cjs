const fs = require('fs');
let code = fs.readFileSync('src/components/ManagerAlarmSystem.tsx', 'utf-8');

// Also prevent user from closing modal by clicking outside
const modalUi = `<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>`;
code = code.replace(
  /<div className="fixed inset-0 z-\[100\] flex items-center justify-center p-4 bg-slate-950\/80 backdrop-blur-sm animate-in fade-in duration-200">/,
  modalUi
);

fs.writeFileSync('src/components/ManagerAlarmSystem.tsx', code);
console.log('Modal UI patched');
