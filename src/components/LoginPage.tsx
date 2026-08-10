import React, { useState } from 'react';
import { useOMS } from '../lib/store';
import { Role, OutletName } from '../types';
import { ShieldCheck, Store, Truck, Lock, Eye, EyeOff, AlertCircle, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { verifyPassword, login, authPasswords, partners } = useOMS();

  const outlets: OutletName[] = ['Sector 31', 'Sector 35', 'Sector 42', 'Sector 88'];

  const [loginRole, setLoginRole] = useState<Role>('admin');
  const [selectedOutlet, setSelectedOutlet] = useState<OutletName>(outlets[0]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(partners[0]?.id || '');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    let identifier: string | undefined = undefined;
    if (loginRole === 'outlet') {
      identifier = selectedOutlet;
    } else if (loginRole === 'delivery') {
      identifier = selectedPartnerId;
    }

    const res = verifyPassword(loginRole, identifier, passwordInput);

    if (res.success && res.userSession) {
      login(res.userSession);
    } else {
      setErrorMessage(res.message || 'Invalid password! Please try again.');
    }
  };

  const activePartner = partners.find((p) => p.id === selectedPartnerId) || partners[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3 flex flex-col items-center">
          <img
            src="/app-icon.svg"
            alt="Broomies Logo"
            className="w-16 h-16 rounded-2xl border-2 border-purple-500/50 shadow-2xl shadow-purple-950/80 bg-slate-900 object-cover"
          />
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/80 border border-purple-800/60 text-purple-300 text-xs font-extrabold uppercase tracking-widest shadow-lg">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            Broomies Order Management
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Login Portal
          </h1>
          <p className="text-xs text-slate-400">
            Select your role and enter password to access your dashboard
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#0b0e1d] border border-indigo-950/80 rounded-3xl p-6 shadow-2xl space-y-6 backdrop-blur-xl relative">
          {/* Role Selector Tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-slate-950/80 rounded-2xl border border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                setLoginRole('admin');
                setPasswordInput('');
                setErrorMessage(null);
              }}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 ${
                loginRole === 'admin'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-950 border border-rose-400/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setLoginRole('outlet');
                setPasswordInput('');
                setErrorMessage(null);
              }}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 ${
                loginRole === 'outlet'
                  ? 'bg-amber-600 text-slate-950 font-black shadow-lg shadow-amber-950 border border-amber-300/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>Outlet</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setLoginRole('delivery');
                setPasswordInput('');
                setErrorMessage(null);
              }}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 ${
                loginRole === 'delivery'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950 border border-emerald-400/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Rider</span>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-rose-950/90 border border-rose-800 rounded-2xl text-xs text-rose-200 font-bold flex items-center gap-2 animate-bounce">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Admin Header Info */}
            {loginRole === 'admin' && (
              <div className="p-3.5 bg-rose-950/20 border border-rose-900/40 rounded-2xl text-xs space-y-1">
                <div className="font-extrabold text-rose-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  Admin Central Access
                </div>
                <div className="text-[11px] text-slate-400">
                  Full control across all outlets, rider dispatches, and system settings.
                </div>
              </div>
            )}

            {/* Outlet Selection */}
            {loginRole === 'outlet' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-amber-300">
                  Select Outlet / Store Branch
                </label>
                <select
                  value={selectedOutlet}
                  onChange={(e) => setSelectedOutlet(e.target.value as OutletName)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                >
                  {outlets.map((o) => (
                    <option key={o} value={o}>
                      {o} Branch
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Delivery Partner Selection */}
            {loginRole === 'delivery' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-emerald-300">
                  Select Delivery Partner / Rider
                </label>
                <select
                  value={selectedPartnerId}
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                >
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.vehicle || 'Bike'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-3 text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your passcode..."
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-500 hover:text-white transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Login Action Button */}
            <button
              type="submit"
              className={`w-full py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition shadow-xl flex items-center justify-center gap-2 ${
                loginRole === 'admin'
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950'
                  : loginRole === 'outlet'
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-950'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950'
              }`}
            >
              <span>Login to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Demo Credentials Helper Box */}
        <div className="bg-[#0a0c18] border border-indigo-950 rounded-2xl p-4 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-purple-300 text-[11px] uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
            <span>Default Demo Passwords</span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 text-center">
              <div className="text-[10px] text-rose-400 font-sans font-bold">Admin</div>
              <div className="font-black text-white mt-0.5">{authPasswords.admin}</div>
            </div>

            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 text-center">
              <div className="text-[10px] text-amber-400 font-sans font-bold">Outlet</div>
              <div className="font-black text-white mt-0.5">
                {authPasswords.outlets[selectedOutlet] || authPasswords.defaultOutletPassword}
              </div>
            </div>

            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 text-center">
              <div className="text-[10px] text-emerald-400 font-sans font-bold">Rider</div>
              <div className="font-black text-white mt-0.5">
                {authPasswords.partners[selectedPartnerId] || authPasswords.defaultPartnerPassword}
              </div>
            </div>
          </div>

          <p className="text-[10px] text-slate-500 text-center pt-1 italic">
            Note: Admin can edit or set new passwords anytime from Password Settings.
          </p>
          <div className="pt-2 border-t border-indigo-950/60 text-center">
            <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-800/40">
              🔒 Session Persistent: App stays logged in permanently until you manually click Logout
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
