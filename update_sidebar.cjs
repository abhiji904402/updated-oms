const fs = require('fs');
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf-8');

if (!code.includes('Printer,')) {
    code = code.replace('  LayoutDashboard,', '  LayoutDashboard,\n  Printer,');
}

const kotPrintButton = `                  {/* KOT Print */}
                  <button
                    onClick={() => handleTabClick('kot_print')}
                    className={\`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition \${
                      activeTab === 'kot_print'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40 font-bold'
                        : 'text-slate-300 hover:bg-indigo-950/50 hover:text-white'
                    }\`}
                  >
                    <Printer className="w-5 h-5" />
                    <span>KOT Print</span>
                  </button>`;

code = code.replace(
    "{/* Password Manager Button (For Admin) */}",
    kotPrintButton + "\n\n                  {/* Password Manager Button (For Admin) */}"
);

fs.writeFileSync('src/components/Sidebar.tsx', code);
console.log('Sidebar updated');
