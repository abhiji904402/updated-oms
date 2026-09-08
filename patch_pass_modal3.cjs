const fs = require('fs');
let code = fs.readFileSync('src/components/PasswordManagerModal.tsx', 'utf-8');

const newAdminForm = `          {/* Admin & Manager Password Tab */}
          {activeTab === 'admin' && (
            <div className="space-y-6">
              <form onSubmit={handleSaveAdminPassword} className="space-y-4 max-w-md">
                <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-900/40 text-xs text-rose-200">
                  <p className="font-bold mb-1">👑 Admin Central Passcode</p>
                  <p className="text-slate-300">
                    This password allows full master access to analytics, order editing, thermal receipts, and security configuration.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Set Admin Password
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
                setToastMessage('✅ Manager password updated successfully!');
                setTimeout(() => setToastMessage(null), 3000);
              }} className="space-y-4 max-w-md pt-6 border-t border-slate-800/80">
                <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-900/40 text-xs text-purple-200">
                  <p className="font-bold mb-1">💼 Manager Access Passcode</p>
                  <p className="text-slate-300">
                    Used for assignment, tracking, and delivery confirmations without edit rights. Default: <code className="text-purple-300 bg-slate-950 px-1 py-0.5 rounded font-mono">manager123</code>
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Set Manager Password
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

code = code.replace(/\{\/\* Admin Password Tab \*\/\}[\s\S]*?\{\/\* Outlet Passwords Tab \*\/\}/, newAdminForm + "\n          {/* Outlet Passwords Tab */}");

// Let's also update the label of the tab button
code = code.replace(">Admin Passwords</button>", ">Admin & Manager</button>");
code = code.replace(">Admin Passcode</button>", ">Admin & Manager</button>");

fs.writeFileSync('src/components/PasswordManagerModal.tsx', code);
console.log('PasswordManagerModal.tsx fixed');
