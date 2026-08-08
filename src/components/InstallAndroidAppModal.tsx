import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  CheckCircle2,
  Zap,
  Truck,
  ExternalLink,
  Globe,
  PlusCircle
} from 'lucide-react';

interface InstallAndroidAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  partnerName?: string;
}

export const InstallAndroidAppModal: React.FC<InstallAndroidAppModalProps> = ({
  isOpen,
  onClose,
  partnerName
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      (window as any).deferredPwaPrompt = e;
    };

    window.addEventListener('beforeinstallprompt', handler);

    if ((window as any).deferredPwaPrompt) {
      setDeferredPrompt((window as any).deferredPwaPrompt);
    }

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!isOpen) return null;

  const handleInstallPwa = async () => {
    const activePrompt = deferredPrompt || (window as any).deferredPwaPrompt;
    if (activePrompt) {
      try {
        activePrompt.prompt();
        const choice = await activePrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
        (window as any).deferredPwaPrompt = null;
      } catch (e) {
        console.warn('PWA prompt handled');
      }
    } else {
      alert('Google Chrome me "Install App" (या Add to Home screen) ke liye:\n1. Chrome ke top-right 3 dots menu (⋮) par click karein.\n2. "Install App" / "App install karein" par tap karein.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#0c0f24] border border-indigo-900/90 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in">
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-purple-950 via-[#101432] to-indigo-950 border-b border-indigo-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/app-icon.svg"
              alt="Broomies App Icon"
              className="w-12 h-12 rounded-2xl shadow-xl border border-purple-500/30 object-cover"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  Install Broomies Rider App
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/40">
                  PWA Web App
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Install as a native application directly via Chrome
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center border border-indigo-950 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-left">
          {partnerName && (
            <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-800/60 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-600/30 text-purple-300 flex items-center justify-center font-bold">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Rider Account</div>
                <div className="text-sm font-extrabold text-white">{partnerName}</div>
              </div>
            </div>
          )}

          {/* Vercel Target Badge */}
          <div className="p-3.5 rounded-2xl bg-indigo-950/60 border border-indigo-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Globe className="w-5 h-5 text-indigo-400 shrink-0" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">Target Web App Endpoint</div>
                <div className="text-xs font-mono font-extrabold text-emerald-400">https://broms.vercel.app</div>
              </div>
            </div>
            <a
              href="https://broms.vercel.app"
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-xl bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 text-xs font-bold flex items-center gap-1 transition"
            >
              <span>Open</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Chrome PWA Status Indicator */}
          <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span className="text-xs font-bold text-emerald-300">Chrome PWA Integration:</span>
            </div>
            <span className="text-[11px] font-mono font-extrabold bg-emerald-900/80 text-emerald-200 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              {isInstalled ? 'INSTALLED ON DEVICE' : 'READY TO INSTALL'}
            </span>
          </div>

          {/* Chrome Specific Install Guide */}
          <div className="p-4 rounded-2xl bg-[#090c21] border border-indigo-900/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-purple-400" />
                How to Install directly in Google Chrome:
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#111532] border border-indigo-950">
                <span className="w-5 h-5 rounded-lg bg-emerald-600 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0">1</span>
                <div>
                  <strong className="text-white">Android Mobile Chrome:</strong>
                  <p className="text-[11px] text-slate-400">Tap <strong>3 Dots Menu (⋮)</strong> at top-right &rarr; Select <strong>"Install App"</strong> or <strong>"Add to Home screen"</strong>.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#111532] border border-indigo-950">
                <span className="w-5 h-5 rounded-lg bg-emerald-600 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0">2</span>
                <div>
                  <strong className="text-white">Desktop Chrome:</strong>
                  <p className="text-[11px] text-slate-400">Click the <strong>Install Icon (💻📲)</strong> on the right side of Chrome's address bar.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Key PWA App Features */}
          <div className="space-y-2 bg-[#080a18] p-3.5 rounded-2xl border border-indigo-950 text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-400 block text-[11px]">
              ✨ Installed PWA Benefits:
            </span>
            <div className="grid grid-cols-1 gap-1.5 text-slate-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Runs full screen without browser address bar</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Fast home screen icon launcher & live GPS tracking</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              onClick={handleInstallPwa}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-xl shadow-emerald-950/60 flex items-center justify-center gap-2 transition active:scale-95"
            >
              <PlusCircle className="w-5 h-5 text-emerald-200" />
              <span>
                {deferredPrompt
                  ? '📲 Click Here to Install App Now'
                  : isInstalled
                  ? '✅ App Installed on Home Screen'
                  : '📲 Install App / Add to Home Screen'}
              </span>
            </button>

            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white font-bold text-xs transition"
            >
              Close & Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

