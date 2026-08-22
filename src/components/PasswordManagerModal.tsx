import React, { useState } from 'react';
import { useOMS } from '../lib/store';
import { ShieldCheck, Store, Truck, Key, Check, Eye, EyeOff, X, Lock } from 'lucide-react';

interface PasswordManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PasswordManagerModal: React.FC<PasswordManagerModalProps> = ({ isOpen, onClose }) => {
  const {
    authPasswords,
    updateAdminPassword,
    updateOutletPassword,
    updatePartnerPassword,
    partners
  } = useOMS();

  const outlets = ['Sector 31', 'Sector 35', 'Sector 42', 'Sector 88'];

  const [activeTab, setActiveTab] = useState<'admin' | 'outlets' | 'partners'>('admin');
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // Local state for edits
  const [adminPass, setAdminPass] = useState(authPasswords.admin);
  const [outletPasses, setOutletPasses] = useState<Record<string, string>>({
    ...authPasswords.outlets
  });
  const [partnerPasses, setPartnerPasses] = useState<Record<string, string>>({
    ...authPasswords.partners
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleVisibility = (key: string) => {
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveAdminPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPass.trim()) return;
    updateAdminPassword(adminPass.trim());
    setToastMessage('✅ Admin password updated successfully!');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveOutletPassword = (outletName: string) => {
    const pass = outletPasses[outletName] || authPasswords.defaultOutletPassword;
    if (!pass.trim()) return;
    updateOutletPassword(outletName, pass.trim());
    setToastMessage(`✅ Password for ${outletName} updated!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSavePartnerPassword = (partnerId: string, partnerName: string) => {
    const pass = partnerPasses[partnerId] || authPasswords.defaultPartnerPassword;
    if (!pass.trim()) return;
    updatePartnerPassword(partnerId, pass.trim());
    setToastMessage(`✅ Password for rider ${partnerName} updated!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0c0f1d] border border-indigo-900/80 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 bg-gradient-to-r from-purple-950/80 to-slate-900 border-b border-indigo-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Password & Security Settings</h2>
              <p className="text-xs text-slate-400">Admin control to create and change passwords for all logins</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast Notification */}
        {toastMessage && (
          <div className="mx-4 mt-3 p-2.5 bg-emerald-950/90 border border-emerald-600/80 rounded-xl text-emerald-200 text-xs font-bold flex items-center justify-between animate-fade-in">
            <span>{toastMessage}</span>
            <Check className="w-4 h-4 text-emerald-400" />
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-indigo-950 bg-slate-950/60 px-4 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 border-b-2 ${
              activeTab === 'admin'
                ? 'border-rose-500 bg-rose-500/10 text-rose-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Admin Password
          </button>

          <button
            onClick={() => setActiveTab('outlets')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 border-b-2 ${
              activeTab === 'outlets'
                ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Store className="w-4 h-4" />
            Outlet Passwords
          </button>

          <button
            onClick={() => setActiveTab('partners')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 border-b-2 ${
              activeTab === 'partners'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className="w-4 h-4" />
            Rider Passwords
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Admin Password Tab */}
          {activeTab === 'admin' && (
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
          )}

          {/* Outlet Passwords Tab */}
          {activeTab === 'outlets' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 text-xs text-amber-200">
                <p className="font-bold">🏪 Outlet Passwords</p>
                <p className="text-slate-300 text-[11px] mt-0.5">
                  Set unique passwords for each outlet store. Default: <code className="text-amber-300 bg-slate-950 px-1 py-0.5 rounded font-mono">outlet123</code>
                </p>
              </div>

              <div className="space-y-2.5">
                {outlets.map((outletName) => {
                  const val = outletPasses[outletName] ?? authPasswords.defaultOutletPassword;
                  return (
                    <div
                      key={outletName}
                      className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs font-bold text-white">{outletName}</div>
                        <div className="text-[10px] text-slate-400">Kitchen & Store Password</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative w-36">
                          <input
                            type={showPasswords[`outlet_${outletName}`] ? 'text' : 'password'}
                            value={val}
                            onChange={(e) =>
                              setOutletPasses((prev) => ({ ...prev, [outletName]: e.target.value }))
                            }
                            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 pr-8 text-xs font-mono text-white focus:border-amber-500"
                          />
                          <button
                            type="button"
                            onClick={() => toggleVisibility(`outlet_${outletName}`)}
                            className="absolute right-2 top-2 text-slate-400 hover:text-white"
                          >
                            {showPasswords[`outlet_${outletName}`] ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSaveOutletPassword(outletName)}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-lg transition"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rider Passwords Tab */}
          {activeTab === 'partners' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/40 text-xs text-emerald-200">
                <p className="font-bold">🚚 Delivery Partner / Rider Passwords</p>
                <p className="text-slate-300 text-[11px] mt-0.5">
                  Set passwords for delivery boys/riders to access their active order queue. Default: <code className="text-emerald-300 bg-slate-950 px-1 py-0.5 rounded font-mono">rider123</code>
                </p>
              </div>

              <div className="space-y-2.5">
                {partners.map((partner) => {
                  const val = partnerPasses[partner.id] ?? authPasswords.defaultPartnerPassword;
                  return (
                    <div
                      key={partner.id}
                      className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-950 border border-emerald-700/50 flex items-center justify-center font-bold text-emerald-400 text-xs">
                          {partner.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{partner.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            ID: {partner.login_id} | Phone: {partner.phone}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative w-36">
                          <input
                            type={showPasswords[`partner_${partner.id}`] ? 'text' : 'password'}
                            value={val}
                            onChange={(e) =>
                              setPartnerPasses((prev) => ({ ...prev, [partner.id]: e.target.value }))
                            }
                            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 pr-8 text-xs font-mono text-white focus:border-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => toggleVisibility(`partner_${partner.id}`)}
                            className="absolute right-2 top-2 text-slate-400 hover:text-white"
                          >
                            {showPasswords[`partner_${partner.id}`] ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSavePartnerPassword(partner.id, partner.name)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-indigo-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
          >
            Done & Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PasswordManagerModal;
