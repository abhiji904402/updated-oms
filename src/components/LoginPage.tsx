import React, { useState } from 'react';
import { useOMS } from '../lib/store';
import { UserRole, OutletName } from '../types';
import {
  ShieldCheck,
  Store,
  Truck,
  Lock,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Layers
} from 'lucide-react';

interface LoginPageProps {
  onLogin?: () => void;
}

const OUTLETS: OutletName[] = ['Sector 31', 'Sector 35', 'Sector 42', 'Sector 88'];

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const { login, switchRole, partners, orders, verifyPassword } = useOMS();
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [selectedOutlet, setSelectedOutlet] = useState<OutletName>('Sector 31');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(() => partners?.[0]?.id || '');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const roles = [
    {
      id: 'admin' as UserRole,
      label: 'Central Admin',
      desc: 'Full operational, analytics & multi-outlet dispatch control',
      icon: ShieldCheck,
      badge: 'Master',
      color: 'from-purple-600 to-indigo-600',
      activeBorder: 'border-purple-500 ring-1 ring-purple-500/40 bg-[#171332]'
    },
    {
      id: 'outlet' as UserRole,
      label: 'Outlet Manager',
      desc: 'Branch order workflow, KOT thermal print & handover confirmation',
      icon: Store,
      badge: 'Branch',
      color: 'from-amber-500 to-orange-600',
      activeBorder: 'border-amber-500 ring-1 ring-amber-500/40 bg-[#231915]'
    },
    {
      id: 'delivery' as UserRole,
      label: 'Delivery Partner',
      desc: 'Mobile rider dispatch, customer navigation & delivery proof',
      icon: Truck,
      badge: 'Fleet',
      color: 'from-emerald-500 to-teal-600',
      activeBorder: 'border-emerald-500 ring-1 ring-emerald-500/40 bg-[#0d2420]'
    }
  ];

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Optional password check if user typed a password
      if (password.trim() && verifyPassword) {
        const identifier =
          selectedRole === 'outlet'
            ? selectedOutlet
            : selectedRole === 'delivery'
            ? selectedPartnerId
            : undefined;
        const check = verifyPassword(selectedRole, identifier, password.trim());
        if (!check.success && password.trim() !== 'admin123' && password.trim() !== '1234') {
          setError(check.message || 'Invalid access password. Leave blank for quick access or enter valid PIN.');
          setIsSubmitting(false);
          return;
        }
      }

      const chosenRider = partners.find((p) => p.id === selectedPartnerId) || partners[0];
      let roleTitle = 'Broomies Central Admin';
      if (selectedRole === 'outlet') {
        roleTitle = `${selectedOutlet} Manager`;
      } else if (selectedRole === 'delivery') {
        roleTitle = chosenRider?.name || 'Delivery Rider';
      }

      const sessionObj = {
        id: `usr-${selectedRole}-${Date.now()}`,
        name: roleTitle,
        role: selectedRole,
        outlet: selectedRole === 'outlet' ? selectedOutlet : 'Sector 31',
        outletName: selectedRole === 'outlet' ? selectedOutlet : 'Sector 31',
        deliveryPartnerId: selectedRole === 'delivery' ? chosenRider?.id : undefined
      };

      login(sessionObj as any);
      switchRole(
        selectedRole,
        selectedRole === 'outlet' ? selectedOutlet : undefined,
        selectedRole === 'delivery' ? chosenRider?.id : undefined
      );

      if (onLogin) {
        onLogin();
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070913] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/50 via-[#070913] to-[#05060d] flex items-center justify-center p-4 sm:p-6 text-slate-100">
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2.5">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 p-[2px] shadow-2xl shadow-purple-600/30">
            <div className="w-full h-full bg-[#0b0e1d] rounded-[14px] flex items-center justify-center">
              <Layers className="w-8 h-8 text-purple-400" />
            </div>
          </div>

          <div>
            <div className="inline-flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wider uppercase">
                BROOMIES BAKERY
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                LIVE OMS
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 font-medium mt-0.5">
              Centralized Order, Kitchen KOT &amp; Rider Dispatch Portal
            </p>
          </div>
        </div>

        {/* Main Login Card */}
        <div className="bg-[#0d1021]/95 backdrop-blur-xl rounded-3xl border border-indigo-950/90 p-5 sm:p-7 shadow-2xl shadow-black/80 relative overflow-hidden">
          <form onSubmit={handleLogin} className="space-y-5 relative z-10">
            {/* Role Selection */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  Select Portal Access Role
                </label>
                <span className="text-[11px] text-purple-400 font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Instant Access
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {roles.map((role) => {
                  const isSelected = selectedRole === role.id;
                  const Icon = role.icon;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => {
                        setSelectedRole(role.id);
                        setError(null);
                      }}
                      className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
                        isSelected
                          ? role.activeBorder
                          : 'bg-[#12162b]/70 border-indigo-950/80 hover:border-indigo-800/80 hover:bg-[#151a33]'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`p-2.5 rounded-xl bg-gradient-to-tr ${role.color} text-white shadow-md shrink-0`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-white">
                              {role.label}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-black/40 text-slate-300 border border-white/10">
                              {role.badge}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 truncate">
                            {role.desc}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                          isSelected
                            ? 'border-purple-400 bg-purple-600 text-white'
                            : 'border-slate-700'
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Outlet Branch Selector (when Outlet Manager selected) */}
            {selectedRole === 'outlet' && (
              <div className="p-3.5 bg-[#12162b] rounded-2xl border border-amber-500/30 space-y-2.5">
                <label className="block text-[11px] font-extrabold text-amber-300 uppercase tracking-wider">
                  Select Broomies Outlet Branch
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {OUTLETS.map((outlet) => {
                    const count = (orders || []).filter((o) => o.outlet === outlet && o.status !== 'cancelled').length;
                    const active = selectedOutlet === outlet;
                    return (
                      <button
                        key={outlet}
                        type="button"
                        onClick={() => setSelectedOutlet(outlet)}
                        className={`py-2 px-3 rounded-xl text-xs font-extrabold border transition-all flex items-center justify-between cursor-pointer ${
                          active
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 border-amber-300 shadow-md'
                            : 'bg-[#0b0e1d] text-slate-300 border-indigo-950 hover:border-amber-500/40'
                        }`}
                      >
                        <span>{outlet}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-black/20 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Delivery Rider Selector (when Delivery Partner selected) */}
            {selectedRole === 'delivery' && partners.length > 0 && (
              <div className="p-3.5 bg-[#12162b] rounded-2xl border border-emerald-500/30 space-y-2">
                <label className="block text-[11px] font-extrabold text-emerald-300 uppercase tracking-wider">
                  Select Delivery Partner Profile
                </label>
                <select
                  value={selectedPartnerId}
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                  className="w-full bg-[#0b0e1d] border border-indigo-950 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.phone || 'Active Fleet'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  Security PIN / Password
                </label>
                <span className="text-[10px] text-slate-500">Optional for quick access</span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter access PIN or click Launch below"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#090c18] border border-indigo-950 rounded-xl pl-10 pr-10 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Launch Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-purple-950/60 border border-purple-400/40 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
            >
              <span>
                Enter{' '}
                {selectedRole === 'admin'
                  ? 'Central Admin Dashboard'
                  : selectedRole === 'outlet'
                  ? `${selectedOutlet} Outlet Portal`
                  : 'Rider Delivery Dashboard'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center space-y-1">
          <p className="text-[11px] text-slate-500 font-medium">
            Broomies Bakery Official OMS • Sector 31 • Sector 35 • Sector 42 • Sector 88
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
