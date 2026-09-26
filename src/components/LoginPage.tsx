import React, { useState } from 'react';
import { useOMS } from '../lib/store';
import { UserRole } from '../types';
import { 
  ShieldCheck, 
  Store, 
  Truck, 
  Lock, 
  ArrowRight, 
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface LoginPageProps {
  onLogin?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const { login, switchRole } = useOMS();
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [selectedOutlet, setSelectedOutlet] = useState<string>('Sector 31');
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const outlets = ['Sector 31', 'Sector 15', 'Sector 46', 'Sector 21'];

  const roles = [
    { 
      id: 'admin' as UserRole, 
      label: 'Central Admin', 
      desc: 'Full operational & dispatch control',
      icon: ShieldCheck, 
      badge: 'Master',
      color: 'from-purple-500 to-indigo-600',
      activeBorder: 'border-purple-500'
    },
    { 
      id: 'outlet' as UserRole, 
      label: 'Outlet Manager', 
      desc: 'Order workflow & KOT management',
      icon: Store, 
      badge: 'Store',
      color: 'from-amber-500 to-orange-600',
      activeBorder: 'border-amber-500'
    },
    { 
      id: 'delivery' as UserRole, 
      label: 'Delivery Partner', 
      desc: 'Mobile rider dispatch & OTP proof',
      icon: Truck, 
      badge: 'Fleet',
      color: 'from-emerald-500 to-teal-600',
      activeBorder: 'border-emerald-500'
    },
  ];

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      let roleTitle = 'Broomies Central Admin';
      if (selectedRole === 'outlet') {
        roleTitle = `${selectedOutlet} Manager`;
      } else if (selectedRole === 'delivery') {
        roleTitle = 'Delivery Rider #1';
      }

      const session = {
        id: `usr-${selectedRole}-${Date.now()}`,
        name: roleTitle,
        role: selectedRole as any,
        outlet: selectedRole === 'outlet' ? selectedOutlet : 'Sector 31',
        outletName: selectedRole === 'outlet' ? selectedOutlet : 'Sector 31',
      };

      login(session);
      switchRole(selectedRole as any, selectedRole === 'outlet' ? (selectedOutlet as any) : undefined);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4 sm:p-6 text-slate-100">
      <div className="max-w-md w-full space-y-8 animate-fade-in">
        {/* Brand Banner */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 p-1 shadow-2xl shadow-purple-500/25 ring-4 ring-purple-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <span className="text-white text-3xl font-black italic tracking-tighter bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
                B
              </span>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
              Broomies Bakery
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                OMS v2.4
              </span>
            </h1>
            <p className="text-sm text-slate-400 font-medium mt-1">
              Real-time Order & Delivery Management System
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-2xl shadow-black/60 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

          <form onSubmit={handleLogin} className="space-y-6 relative z-10">
            {/* Role Selection */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Select Portal Role
                </label>
                <span className="text-[11px] text-purple-400 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Quick Switch
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
                      onClick={() => setSelectedRole(role.id)}
                      className={`group w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left ${
                        isSelected
                          ? `bg-slate-800/90 ${role.activeBorder} shadow-lg shadow-purple-950/40 ring-1 ring-purple-500/30`
                          : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className={`p-2.5 rounded-xl bg-gradient-to-tr ${role.color} text-white shadow-md shadow-black/40`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white tracking-wide">
                              {role.label}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-slate-800 text-slate-300 border border-slate-700/60">
                              {role.badge}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {role.desc}
                          </p>
                        </div>
                      </div>

                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected 
                          ? 'border-purple-400 bg-purple-500 text-white' 
                          : 'border-slate-700 group-hover:border-slate-600'
                      }`}>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Outlet Selection (Conditional) */}
            {selectedRole === 'outlet' && (
              <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/60 space-y-2 animate-fade-in">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Select Outlet Branch
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {outlets.map((outlet) => (
                    <button
                      key={outlet}
                      type="button"
                      onClick={() => setSelectedOutlet(outlet)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                        selectedOutlet === outlet
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-bold'
                          : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      {outlet}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Password Field (Optional quick access) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Password <span className="text-slate-500 text-[10px] lowercase font-normal">(optional / demo bypass enabled)</span>
                </label>
              </div>
              <div className="relative">
                <input
                  type="password"
                  placeholder="Enter access PIN or leave blank for instant login"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 pl-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-xl shadow-purple-600/30 border border-purple-400/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              <span>Launch {selectedRole === 'admin' ? 'Central Admin' : selectedRole === 'outlet' ? 'Outlet Portal' : 'Delivery App'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center space-y-1">
          <p className="text-xs text-slate-500">
            Powered by Baileys Multi-Device & Firebase Firestore Real-Time Sync
          </p>
          <p className="text-[11px] text-slate-600 font-mono">
            © 2024 Broomies Bakery Official • Sector 31, 15, 46, 21
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
