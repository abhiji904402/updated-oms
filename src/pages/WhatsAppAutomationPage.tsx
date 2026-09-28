import React, { useState, useEffect } from 'react';
import { Smartphone, RefreshCw, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { useOMS } from '../lib/store';

export const WhatsAppAutomationPage: React.FC = () => {
  const { showNotification } = useOMS();
  const [status, setStatus] = useState<any>({ connected: false, sessionState: 'disconnected' });
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (data.qrCode) setQrCode(data.qrCode);
      }
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleGenerateQR = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/whatsapp/generate-qr', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.qrCode) setQrCode(data.qrCode);
        showNotification('QR Code generated! Scan via WhatsApp Linked Devices.');
      }
    } catch {
      showNotification('Failed generating QR code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch('/api/whatsapp/disconnect', { method: 'POST' });
      setStatus({ connected: false, sessionState: 'disconnected' });
      setQrCode(null);
      showNotification('WhatsApp session disconnected');
    } catch {}
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="p-5 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-indigo-950 border border-emerald-900/50 rounded-2xl flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-400" />
            <span>WhatsApp Automation & Notification Engine</span>
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Auto-send order confirmations, live delivery rider updates, and OTPs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {status.connected ? (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-700/60 rounded-full text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Connected ({status.phoneNumber || 'Linked'})
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-950 text-amber-300 border border-amber-700/60 rounded-full text-xs font-bold">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              Disconnected
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* QR Pairing Card */}
        <div className="bg-[#0f1224] border border-indigo-950 p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-white text-sm mb-2">WhatsApp Web QR Pairing</h3>
            <p className="text-xs text-slate-400 mb-4">
              Scan with WhatsApp on your phone (Linked Devices &gt; Link a Device) to activate automated messages directly from Broomies.
            </p>

            {qrCode && !status.connected ? (
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl max-w-[240px] mx-auto shadow-xl">
                <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48" />
                <span className="text-[11px] text-slate-700 font-semibold mt-2">Scan in WhatsApp</span>
              </div>
            ) : status.connected ? (
              <div className="p-8 text-center bg-emerald-950/30 border border-emerald-900/40 rounded-xl">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
                <div className="text-sm font-bold text-white">Device Active &amp; Paired</div>
                <div className="text-xs text-emerald-300 mt-1">{status.phoneNumber || 'Broomies Official WhatsApp'}</div>
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-900/40 border border-dashed border-indigo-950 rounded-xl text-slate-500 text-xs">
                No active pairing session. Tap below to generate QR.
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-indigo-950 flex items-center gap-2">
            {!status.connected ? (
              <button
                onClick={handleGenerateQR}
                disabled={isLoading}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Generate QR Code</span>
              </button>
            ) : (
              <button
                onClick={handleDisconnect}
                className="flex-1 py-2.5 bg-red-600/80 hover:bg-red-600 text-white font-bold text-xs rounded-xl transition"
              >
                Disconnect Device
              </button>
            )}
          </div>
        </div>

        {/* Templates and Features Card */}
        <div className="bg-[#0f1224] border border-indigo-950 p-5 rounded-2xl space-y-3">
          <h3 className="font-bold text-white text-sm">Automated Event Triggers</h3>
          <div className="space-y-2 text-xs">
            <div className="p-3 bg-[#13162b] rounded-xl border border-indigo-950 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-200 block">Order Confirmation</span>
                <span className="text-[11px] text-slate-500">Sent instantly when an order is created</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400">ENABLED</span>
            </div>

            <div className="p-3 bg-[#13162b] rounded-xl border border-indigo-950 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-200 block">Out for Delivery &amp; OTP</span>
                <span className="text-[11px] text-slate-500">Includes delivery rider details &amp; secure OTP</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400">ENABLED</span>
            </div>

            <div className="p-3 bg-[#13162b] rounded-xl border border-indigo-950 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-200 block">Delivered Feedback Message</span>
                <span className="text-[11px] text-slate-500">Sends warm thank you message upon delivery</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400">ENABLED</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
