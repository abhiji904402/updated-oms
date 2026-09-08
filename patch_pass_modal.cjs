const fs = require('fs');
let code = fs.readFileSync('src/components/PasswordManagerModal.tsx', 'utf-8');

// We need updateManagerPassword from useOMS
code = code.replace(
  "    updateAdminPassword,",
  "    updateAdminPassword,\n    updateManagerPassword,"
);

// We need a state for managerPass
code = code.replace(
  "  const [adminPass, setAdminPass] = useState(authPasswords.admin);",
  "  const [adminPass, setAdminPass] = useState(authPasswords.admin);\n  const [managerPass, setManagerPass] = useState(authPasswords.manager || 'manager123');"
);

// We need a submit handler for manager pass. The admin form is currently a simple <form onSubmit={handleAdminSubmit}>
// We can just add a Manager Password section in the same form or below it.
// Let's modify the admin form to handle both.
const newAdminForm = `          {/* Admin & Manager Passwords Tab */}
          {activeTab === 'admin' && (
            <div className="space-y-6">
              <form onSubmit={handleAdminSubmit} className="space-y-4">
                <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-900/40 text-xs text-rose-200">
                  <p className="font-bold">👑 Admin Master Password</p>
                  <p className="text-slate-300 text-[11px] mt-0.5">Used for full system access.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                    New Admin Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords['admin'] ? 'text' : 'password'}
                      value={adminPass}
                      onChange={(e) => setAdminPass(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pr-10 text-sm font-mono text-white focus:outline-none focus:border-rose-500"
                    />
                    <button
                      type="button"
                      onClick={() => toggleVisibility('admin')}
                      className="absolute right-3 top-3 text-slate-400 hover:text-white"
                    >
                      {showPasswords['admin'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-rose-950 flex items-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  Update Admin Password
                </button>
              </form>

              <form onSubmit={(e) => {
                e.preventDefault();
                updateManagerPassword(managerPass);
                showNotification('Manager password updated successfully!');
              }} className="space-y-4 pt-4 border-t border-slate-800">
                <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-900/40 text-xs text-purple-200">
                  <p className="font-bold">💼 Manager Password</p>
                  <p className="text-slate-300 text-[11px] mt-0.5">Used for assignment & delivery confirmations.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                    New Manager Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords['manager'] ? 'text' : 'password'}
                      value={managerPass}
                      onChange={(e) => setManagerPass(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pr-10 text-sm font-mono text-white focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => toggleVisibility('manager')}
                      className="absolute right-3 top-3 text-slate-400 hover:text-white"
                    >
                      {showPasswords['manager'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-purple-950 flex items-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  Update Manager Password
                </button>
              </form>
            </div>
          )}
`;

code = code.replace(/\{\/\* Admin Passwords Tab \*\/\}[\s\S]*?\{\/\* Outlet Passwords Tab \*\/\}/, newAdminForm + "\n          {/* Outlet Passwords Tab */}");

// Tab title for admin tab: "Admin Passwords" -> "Admin & Manager"
code = code.replace(
  ">Admin Passwords</button>",
  ">Admin & Manager</button>"
);

fs.writeFileSync('src/components/PasswordManagerModal.tsx', code);
console.log('PasswordManagerModal.tsx patched');
