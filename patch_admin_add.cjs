const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf-8');

code = code.replace(
  "                      onClick={onOpenAddModal}",
  "                      onClick={onOpenAddModal}\n                      disabled={session?.role === 'manager'}"
);
// It's better to just hide it if manager.
code = code.replace(
  `                    <button
                      onClick={onOpenAddModal}
                      disabled={session?.role === 'manager'}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-900/40 transition"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create First Order</span>
                    </button>`,
  `                    {session?.role !== 'manager' && (
                      <button
                        onClick={onOpenAddModal}
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-900/40 transition"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Create First Order</span>
                      </button>
                    )}`
);

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
console.log('AdminDashboard patched for Add Order button');
