import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOMS } from '../lib/store';
import {
  MessageSquare,
  Smartphone,
  CheckCircle2,
  RefreshCw,
  Send,
  Sliders,
  ShieldCheck,
  Zap,
  Clock,
  ExternalLink,
  Copy,
  Sparkles,
  Power,
  Trash2,
  Check,
  Layers,
  PhoneCall,
  CheckCheck,
  Inbox
} from 'lucide-react';
import { WhatsAppConfig, WhatsAppLog } from '../types';

export const WhatsAppAutomationPage = React.memo(() => {
  const { orders = [], showNotification, checkWhatsAppStatus } = useOMS();

  // State
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [outboxQueue, setOutboxQueue] = useState<any[]>([]);
  const [flushingOutbox, setFlushingOutbox] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Navigation Tabs: QR Login, 1-Click Web Dispatch, Message Templates, Automation Rules, Logs, Outbox
  const [activeTab, setActiveTab] = useState<'qr_login' | 'direct_web' | 'templates' | 'automation' | 'logs' | 'outbox'>('qr_login');

  // Official QR Code State
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [qrGenerating, setQrGenerating] = useState(false);
  const [pairingPhone, setPairingPhone] = useState('');
  const [pairingCodeResult, setPairingCodeResult] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [testDirectPhone, setTestDirectPhone] = useState('');
  const [testDirectMessage, setTestDirectMessage] = useState('👋 Hello from Broomies Bakery! Your Official WhatsApp Multi-Device connection is active.');
  const [sendingTest, setSendingTest] = useState(false);

  // Direct Web Dispatch Form State
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [dispatchPhone, setDispatchPhone] = useState<string>('');
  const [dispatchCustomerName, setDispatchCustomerName] = useState<string>('Customer');
  const [dispatchTemplateType, setDispatchTemplateType] = useState<'confirm' | 'dispatch' | 'delivered' | 'reminder'>('confirm');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [backgroundSending, setBackgroundSending] = useState(false);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  // Active Template editing tab
  const [activeTemplateTab, setActiveTemplateTab] = useState<'confirm' | 'dispatch' | 'delivered' | 'reminder'>('confirm');

  // Fetch Status, Logs & Outbox Queue (Fast, Lightweight)
  const fetchStatusAndLogs = useCallback(async () => {
    try {
      const [resStatus, resLogs, resQueue] = await Promise.all([
        fetch('/api/whatsapp/status'),
        fetch('/api/whatsapp/logs'),
        fetch('/api/whatsapp/queue')
      ]);
      if (resStatus.ok) {
        const data: WhatsAppConfig = await resStatus.json();
        setConfig(data);
        if (data.connected && data.phoneNumber) {
          setQrCodeData(null);
        } else if (data.qrCode) {
          setQrCodeData(data.qrCode);
        } else if (!data.connected) {
          // Auto-fetch/generate QR code so every device instantly sees it without clicking
          fetch('/api/whatsapp/generate-qr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ forceRelink: false })
          })
            .then(r => r.json())
            .then(resData => {
              if (resData.qrCode) setQrCodeData(resData.qrCode);
            })
            .catch(() => {});
        }
      }
      if (resLogs.ok) {
        const data = await resLogs.json();
        setLogs(data.logs || []);
      }
      if (resQueue.ok) {
        const qData = await resQueue.json();
        setOutboxQueue(qData.queue || []);
      }
    } catch (err) {
      console.error('Failed to fetch WhatsApp status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchStatusAndLogs();
  }, [fetchStatusAndLogs]);

  // Smart polling: Polling for QR and connection status across all devices
  useEffect(() => {
    if (activeTab !== 'qr_login' || config?.connected) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/whatsapp/status');
        if (!res.ok) return;
        const data: WhatsAppConfig = await res.json();
        if (data.connected && data.phoneNumber) {
          setConfig(data);
          setQrCodeData(null);
          showNotification('🎉 WhatsApp Linked Successfully!');
          checkWhatsAppStatus();
        } else if (data.qrCode && data.qrCode !== qrCodeData) {
          setQrCodeData(data.qrCode);
        }
      } catch {}
    }, 2500);

    return () => clearInterval(interval);
  }, [activeTab, config?.connected, qrCodeData, showNotification, checkWhatsAppStatus]);

  // Generate Real Official WhatsApp QR Code
  const handleGenerateQR = useCallback(async (forceRelink = false) => {
    setQrGenerating(true);
    try {
      showNotification('🔄 Initializing WhatsApp Web pairing...');
      const res = await fetch('/api/whatsapp/generate-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRelink })
      });
      const data = await res.json();
      if (data.success) {
        if (data.connected && data.phoneNumber) {
          showNotification(`✅ WhatsApp is already linked (+${data.phoneNumber})!`);
          fetchStatusAndLogs();
        } else if (data.qrCode) {
          setQrCodeData(data.qrCode);
          showNotification('📱 Scan the QR Code using WhatsApp on your phone!');
        } else {
          showNotification(data.message || 'QR code initializing...');
        }
      } else {
        showNotification(`❌ ${data.error || 'Failed to generate QR'}`);
      }
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    } finally {
      setQrGenerating(false);
    }
  }, [fetchStatusAndLogs, showNotification]);

  // Request pairing code for phone number login
  const handlePairPhone = async () => {
    if (!pairingPhone || pairingPhone.length < 10) {
      showNotification('Please enter a valid 10-digit mobile number with country code (e.g. 919876543210)');
      return;
    }
    setPairingLoading(true);
    setPairingCodeResult(null);
    try {
      showNotification('🔄 Requesting WhatsApp Pairing Code...');
      const res = await fetch('/api/whatsapp/pair-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: pairingPhone })
      });
      const data = await res.json();
      if (data.success && data.pairingCode) {
        setPairingCodeResult(data.pairingCode);
        showNotification('✅ Pairing code generated successfully!');
      } else {
        showNotification(`❌ ${data.error || 'Failed to generate pairing code'}`);
      }
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    } finally {
      setPairingLoading(false);
    }
  };

  // Test Direct Message via Linked Device
  const handleSendTestDirect = async () => {
    if (!testDirectPhone || !testDirectMessage) {
      showNotification('Please enter mobile number and test message');
      return;
    }
    setSendingTest(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testDirectPhone,
          message: testDirectMessage,
          type: 'test'
        })
      });
      const data = await res.json();
      if (data.success) {
        showNotification('🚀 WhatsApp Message Delivered Successfully!');
        fetchStatusAndLogs();
      } else {
        showNotification(`❌ ${data.error || 'Send failed'}`);
      }
    } catch (err: any) {
      showNotification(`Send error: ${err.message}`);
    } finally {
      setSendingTest(false);
    }
  };

  // Disconnect / Unlink WhatsApp
  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to unlink this WhatsApp account?')) return;
    try {
      const res = await fetch('/api/whatsapp/disconnect', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        setQrCodeData(null);
        showNotification('WhatsApp session unlinked');
        checkWhatsAppStatus();
      }
    } catch {
      showNotification('Failed to disconnect');
    }
  };

  // Sync direct message content when selected order or template changes
  const selectedOrder = useMemo(() => {
    return orders.find(o => o.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  useEffect(() => {
    if (selectedOrder) {
      setDispatchPhone(selectedOrder.mobile_number || '');
      setDispatchCustomerName(selectedOrder.customer_name || 'Customer');
    }
  }, [selectedOrder]);

  useEffect(() => {
    if (!config?.templates) return;
    const rawTemplate = config.templates[dispatchTemplateType] || '';
    if (selectedOrder) {
      const itemDetails = `${selectedOrder.item_type || 'Bakery Item'}${selectedOrder.quantity ? ` (${selectedOrder.quantity})` : ''}`;
      const rendered = rawTemplate
        .replace(/{order_number}/g, String(selectedOrder.order_number))
        .replace(/{customer_name}/g, selectedOrder.customer_name || 'Customer')
        .replace(/{items}/g, itemDetails)
        .replace(/{name_on_cake}/g, selectedOrder.name_on_cake || '')
        .replace(/{total_amount}/g, String(selectedOrder.total_amount || 0))
        .replace(/{advance_amount}/g, String(selectedOrder.advance_amount || 0))
        .replace(/{remaining_balance}/g, String(selectedOrder.remaining_balance || 0))
        .replace(/{delivery_date}/g, selectedOrder.delivery_date || 'Today')
        .replace(/{delivery_time}/g, selectedOrder.delivery_time_expected || 'Standard')
        .replace(/{rider_name}/g, selectedOrder.delivery_partner || 'Assigned Rider')
        .replace(/{otp}/g, selectedOrder.otp || '----');
      setCustomMessage(rendered);
    } else {
      const rendered = rawTemplate
        .replace(/{order_number}/g, '1001')
        .replace(/{customer_name}/g, dispatchCustomerName || 'Customer')
        .replace(/{items}/g, 'Chocolate Truffle Cake (1 Kg)')
        .replace(/{name_on_cake}/g, 'Happy Birthday')
        .replace(/{total_amount}/g, '850')
        .replace(/{advance_amount}/g, '500')
        .replace(/{remaining_balance}/g, '350')
        .replace(/{delivery_date}/g, 'Today')
        .replace(/{delivery_time}/g, '5:00 PM')
        .replace(/{rider_name}/g, 'Rahul')
        .replace(/{otp}/g, '4921');
      setCustomMessage(rendered);
    }
  }, [config?.templates, dispatchTemplateType, selectedOrder, dispatchCustomerName]);

  // Open 1-Click WhatsApp Web link directly
  const handleOpenWhatsAppWeb = () => {
    if (!dispatchPhone) {
      showNotification('Please enter a recipient phone number');
      return;
    }
    const cleanDigits = dispatchPhone.replace(/[^0-9]/g, '');
    const recipient = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
    const url = `https://wa.me/${recipient}?text=${encodeURIComponent(customMessage)}`;
    window.open(url, '_blank');
    showNotification('🚀 Opening WhatsApp Web with pre-filled message...');
  };

  // Open WhatsApp Mobile App
  const handleOpenWhatsAppMobile = () => {
    if (!dispatchPhone) {
      showNotification('Please enter a recipient phone number');
      return;
    }
    const cleanDigits = dispatchPhone.replace(/[^0-9]/g, '');
    const recipient = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
    const url = `whatsapp://send?phone=${recipient}&text=${encodeURIComponent(customMessage)}`;
    window.location.href = url;
  };

  // Background Send via Linked WhatsApp
  const handleSendViaSocket = async () => {
    if (!dispatchPhone || !customMessage) {
      showNotification('Phone number and message are required');
      return;
    }
    setBackgroundSending(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: dispatchPhone,
          message: customMessage,
          customerName: dispatchCustomerName,
          orderNumber: selectedOrder?.order_number,
          orderId: selectedOrder?.id,
          type: dispatchTemplateType
        })
      });
      const data = await res.json();
      if (data.success) {
        showNotification('✅ WhatsApp message delivered successfully!');
        fetchStatusAndLogs();
      } else {
        showNotification(`❌ ${data.error || 'Failed to deliver'}`);
        if (data.directWebUrl) {
          if (window.confirm('WhatsApp is not linked. Open WhatsApp Web to send in 1 click?')) {
            window.open(data.directWebUrl, '_blank');
          }
        }
      }
    } catch (err: any) {
      showNotification(`Send error: ${err.message}`);
    } finally {
      setBackgroundSending(false);
    }
  };

  // Save Settings / Automation Rules / Templates
  const handleSaveConfig = async (partialUpdates?: Partial<WhatsAppConfig>) => {
    setSaving(true);
    try {
      const payload = {
        ...config,
        ...partialUpdates
      };
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        showNotification('✅ Automation Rules Saved Successfully!');
      }
    } catch {
      showNotification('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Quick toggle helper for automation rules
  const handleToggleRule = (key: keyof WhatsAppConfig) => {
    const currentVal = Boolean((config as any)?.[key]);
    const newVal = !currentVal;
    
    // Optimistic UI update
    setConfig(prev => prev ? { ...prev, [key]: newVal } : prev);
    
    // Auto-save to backend
    handleSaveConfig({ [key]: newVal });
  };

  // Copy helper
  const handleCopyVariable = (variableName: string) => {
    navigator.clipboard.writeText(variableName);
    setCopiedVar(variableName);
    showNotification(`Copied ${variableName}`);
    setTimeout(() => setCopiedVar(null), 2000);
  };

  // Clear audit logs
  const handleClearLogs = async () => {
    if (!window.confirm('Clear all WhatsApp dispatch logs?')) return;
    try {
      await fetch('/api/whatsapp/clear-logs', { method: 'POST' });
      setLogs([]);
      showNotification('Logs cleared');
    } catch {
      showNotification('Failed to clear logs');
    }
  };

  // Flush pending Outbox queue
  const handleFlushOutbox = async () => {
    setFlushingOutbox(true);
    try {
      showNotification('🚀 Dispatching all pending Outbox messages to customers...');
      const res = await fetch('/api/whatsapp/process-queue', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showNotification(`✅ Dispatched ${data.successCount} queued messages (${data.remainingCount || 0} remaining)!`);
        fetchStatusAndLogs();
      } else {
        showNotification(`⚠️ Outbox notice: ${data.message || data.error || 'Failed'}`);
      }
    } catch (err: any) {
      showNotification(`Failed to flush outbox: ${err.message}`);
    } finally {
      setFlushingOutbox(false);
    }
  };

  // Clear pending Outbox queue
  const handleClearOutbox = async () => {
    if (!window.confirm('Are you sure you want to clear all pending outbox messages?')) return;
    try {
      await fetch('/api/whatsapp/clear-queue', { method: 'POST' });
      setOutboxQueue([]);
      showNotification('Pending Outbox cleared.');
      fetchStatusAndLogs();
    } catch {
      showNotification('Failed to clear outbox');
    }
  };

  // Real connection status
  const isTrulyConnected = Boolean(config?.connected && config?.phoneNumber);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl shadow-black/20">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <MessageSquare className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white">WhatsApp Automation Hub</h1>
              <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Official
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              1-Click Direct WhatsApp Web & Automated Background Messaging for Orders & Dispatches
            </p>
          </div>
        </div>

        {/* Status Badge & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {isTrulyConnected ? (
            <div className="flex items-center gap-3 bg-emerald-950/40 border border-emerald-500/40 px-4 py-2.5 rounded-2xl">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <div>
                <div className="text-xs font-black uppercase text-emerald-300 flex items-center gap-1.5">
                  <span>Linked & Active</span>
                </div>
                <div className="text-[11px] text-slate-300 font-mono">
                  +{config?.phoneNumber}
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                className="ml-2 text-xs bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 px-2.5 py-1 rounded-xl transition border border-rose-500/30 font-bold"
              >
                Unlink
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-slate-800/80 border border-slate-700 px-4 py-2.5 rounded-2xl">
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div>
                <div className="text-xs font-black uppercase text-slate-200">
                  WhatsApp Not Linked
                </div>
                <div className="text-[11px] text-slate-400">
                  Scan QR code or use 1-Click WhatsApp Web
                </div>
              </div>
            </div>
          )}

          <button
            onClick={fetchStatusAndLogs}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-semibold border border-slate-700 transition"
            title="Refresh Status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('qr_login')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition shrink-0 ${
            activeTab === 'qr_login'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 ring-2 ring-emerald-400/40'
              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Smartphone className="w-4 h-4 text-emerald-300" />
          <span>📱 Official WhatsApp QR Link</span>
          {isTrulyConnected && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('direct_web')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition shrink-0 ${
            activeTab === 'direct_web'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 ring-2 ring-emerald-400/40'
              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Zap className="w-4 h-4 text-emerald-300" />
          <span>⚡ 1-Click WhatsApp Web Dispatch</span>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded-md font-black">
            100% Free
          </span>
        </button>

        <button
          onClick={() => setActiveTab('automation')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition shrink-0 ${
            activeTab === 'automation'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 ring-2 ring-emerald-400/40'
              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4 text-emerald-300" />
          <span>⚙️ Automation Rules</span>
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition shrink-0 ${
            activeTab === 'templates'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 ring-2 ring-emerald-400/40'
              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4 text-emerald-300" />
          <span>📝 Message Templates</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition shrink-0 ${
            activeTab === 'logs'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 ring-2 ring-emerald-400/40'
              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Clock className="w-4 h-4 text-emerald-300" />
          <span>📊 Dispatch Logs ({logs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('outbox')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition shrink-0 ${
            activeTab === 'outbox'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 ring-2 ring-emerald-400/40'
              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Inbox className="w-4 h-4 text-emerald-300" />
          <span>📦 Offline Outbox</span>
          {outboxQueue.length > 0 && (
            <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-full animate-pulse">
              {outboxQueue.length}
            </span>
          )}
        </button>
      </div>

      {/* Offline Outbox Alert Banner */}
      {outboxQueue.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl shadow-amber-950/20">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-500/30">
              <Inbox className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="text-sm font-black text-amber-200 flex items-center gap-2">
                <span>{outboxQueue.length} Customer Update{outboxQueue.length > 1 ? 's' : ''} Stored in Outbox</span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Auto-Retry Ready
                </span>
              </div>
              <div className="text-xs text-slate-300 mt-0.5">
                {isTrulyConnected
                  ? 'WhatsApp is re-connected! Click "Dispatch Outbox Now" or they will auto-send automatically.'
                  : 'WhatsApp unlinked hone ke dauran customer messages (Out for delivery, Delivered) yahan safe hain. Jaise hi WhatsApp dobara link hoga, ye automatically deliver ho jayenge.'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isTrulyConnected && (
              <button
                onClick={handleFlushOutbox}
                disabled={flushingOutbox}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-lg shadow-emerald-900/30"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{flushingOutbox ? 'Sending...' : 'Dispatch Outbox Now'}</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab('outbox')}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition border border-slate-700"
            >
              View Queue ({outboxQueue.length})
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: OFFICIAL WHATSAPP QR LINK */}
      {activeTab === 'qr_login' && (
        <div className="space-y-6">
          {isTrulyConnected ? (
            /* ACTIVE & CONNECTED STATE */
            <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl shadow-emerald-950/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl sm:text-2xl font-black text-white">
                        Official WhatsApp Linked & Active
                      </h2>
                      <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Multi-Device Live
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1">
                      Your phone is connected. Background automated order messages will deliver directly through this WhatsApp account.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleDisconnect}
                  className="flex items-center gap-2 px-4 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs rounded-xl border border-rose-500/40 transition shrink-0"
                >
                  <Power className="w-4 h-4" />
                  <span>Unlink / Log Out WhatsApp</span>
                </button>
              </div>

              {/* Connected Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Linked Phone Number
                  </div>
                  <div className="text-lg font-black text-emerald-400 font-mono mt-1">
                    +{config?.phoneNumber}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Official WhatsApp Account</div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Business Profile
                  </div>
                  <div className="text-lg font-black text-white mt-1">
                    {config?.userName || config?.businessName || 'Broomies Bakery'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Direct Socket Connection</div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Automation Engine
                  </div>
                  <div className="text-lg font-black text-emerald-400 mt-1 flex items-center gap-1.5">
                    <Zap className="w-4 h-4" /> Multi-Device Socket
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Zero Subscription Costs (100% Free)</div>
                </div>
              </div>

              {/* Live Test Message Box */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Send className="w-4 h-4 text-emerald-400" />
                    Send Live Test Message via Linked WhatsApp
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Enter a number to verify real-time message delivery.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-4">
                    <label className="text-[11px] font-bold text-slate-400 uppercase">
                      Recipient Mobile Number:
                    </label>
                    <input
                      type="text"
                      value={testDirectPhone}
                      onChange={(e) => setTestDirectPhone(e.target.value)}
                      placeholder="e.g. 9971860845"
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="sm:col-span-6">
                    <label className="text-[11px] font-bold text-slate-400 uppercase">
                      Test Message:
                    </label>
                    <input
                      type="text"
                      value={testDirectMessage}
                      onChange={(e) => setTestDirectMessage(e.target.value)}
                      placeholder="Enter test message"
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-end">
                    <button
                      onClick={handleSendTestDirect}
                      disabled={sendingTest}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition shadow-lg shadow-emerald-900/30"
                    >
                      <Send className={`w-3.5 h-3.5 ${sendingTest ? 'animate-bounce' : ''}`} />
                      <span>{sendingTest ? 'Sending...' : 'Send Test'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* NOT CONNECTED: OFFICIAL QR SCANNER & INSTRUCTIONS */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: The QR Code Card */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center text-center space-y-5 shadow-xl">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-black text-white">
                    Scan WhatsApp QR Code
                  </h2>
                </div>
                <p className="text-xs text-slate-400 max-w-sm">
                  Official WhatsApp Web Multi-Device Handshake. Open WhatsApp on your phone and scan the code.
                </p>

                {/* QR Display Area */}
                <div className="relative p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center min-w-[280px] min-h-[280px]">
                  {qrGenerating ? (
                    <div className="flex flex-col items-center justify-center py-10 space-y-3">
                      <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                      <div className="text-xs font-bold text-slate-300">
                        Generating WhatsApp QR Code...
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Connecting to WhatsApp Multi-Device server
                      </div>
                    </div>
                  ) : qrCodeData ? (
                    <div className="space-y-3 flex flex-col items-center">
                      <div className="p-2 bg-white rounded-2xl shadow-2xl shadow-emerald-950/40 border-4 border-emerald-500/40">
                        <img
                          src={qrCodeData}
                          alt="WhatsApp Official QR Code"
                          className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-xl"
                        />
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/30">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span>Ready to scan • Code active</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                      <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <Smartphone className="w-10 h-10" />
                      </div>
                      <div className="text-xs text-slate-400 max-w-xs">
                        Click below to generate the official WhatsApp QR code.
                      </div>
                      <button
                        onClick={() => handleGenerateQR(true)}
                        className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-900/40 transition transform active:scale-95"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Generate Official WhatsApp QR</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Regenerate Button */}
                {qrCodeData && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleGenerateQR(true)}
                      disabled={qrGenerating}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${qrGenerating ? 'animate-spin' : ''}`} />
                      <span>Regenerate QR</span>
                    </button>
                    <button
                      onClick={fetchStatusAndLogs}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold rounded-xl border border-emerald-500/30 transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Check Status</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column: Step-by-Step Instructions & Features */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-white">
                      How to Link Your WhatsApp
                    </h2>
                    <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Standard QR Scan
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Just like connecting to WhatsApp Web on a PC, scan the QR code once to link your bakery's WhatsApp.
                  </p>
                </div>

                {/* Steps List */}
                <div className="space-y-3">
                  <div className="flex items-start gap-4 p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-sm shrink-0">
                      1
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">
                        Open WhatsApp on your mobile phone
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Works with WhatsApp personal or WhatsApp Business on Android or iPhone.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-sm shrink-0">
                      2
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">
                        Navigate to Linked Devices
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        On <strong>Android</strong>: Tap Menu (⋮) top right → <strong>Linked Devices</strong>.
                        <br />
                        On <strong>iPhone</strong>: Tap Settings ⚙️ bottom right → <strong>Linked Devices</strong>.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-sm shrink-0">
                      3
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">
                        Tap "Link a Device"
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Unlock with fingerprint or face ID if prompted.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-sm shrink-0">
                      4
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">
                        Scan the QR Code
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Point camera at the code. The system will automatically detect the connection!
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl text-xs text-slate-300">
                  <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <Zap className="w-4 h-4" /> Quick Alternative (Zero Setup):
                  </div>
                  <p className="text-slate-400 mt-1">
                    If you don't want to scan a QR code right now, switch to the <strong>"⚡ 1-Click WhatsApp Web Dispatch"</strong> tab. It opens messages directly in WhatsApp Web with zero login required!
                  </p>
                </div>
              </div>
            </div>

            {/* Phone Number Pairing Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <PhoneCall className="w-5 h-5 text-purple-400" />
                    <h2 className="text-lg font-black text-white">
                      Or Link with Phone Number (Pairing Code)
                    </h2>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Alternative Login
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    If scanning the QR code doesn't work, enter your 10-digit mobile number with country code (e.g. 919876543210) to generate an 8-character pairing code.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-8 flex gap-3">
                  <input
                    type="text"
                    placeholder="Enter mobile number (e.g. 919876543210)"
                    value={pairingPhone}
                    onChange={(e) => setPairingPhone(e.target.value)}
                    className="w-full bg-[#0a0c18] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-purple-500 transition"
                  />
                  <button
                    onClick={handlePairPhone}
                    disabled={pairingLoading}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs rounded-xl shadow-lg shadow-purple-900/40 transition flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                  >
                    {pairingLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>Get Pairing Code</span>
                  </button>
                </div>

                {pairingCodeResult && (
                  <div className="md:col-span-4 bg-purple-950/60 border border-purple-800/60 rounded-2xl p-4 text-center space-y-1">
                    <div className="text-[10px] uppercase font-bold text-purple-300 tracking-wider">
                      Your 8-Character Pairing Code
                    </div>
                    <div className="text-2xl font-mono font-black text-white tracking-widest bg-purple-900/40 py-2 rounded-xl border border-purple-700/40 select-all">
                      {pairingCodeResult}
                    </div>
                    <div className="text-[11px] text-purple-300/80">
                      Open WhatsApp &rarr; Linked Devices &rarr; Link with phone number instead
                    </div>
                  </div>
                )}
              </div>
            </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: 1-CLICK DIRECT WHATSAPP WEB DISPATCH */}
      {activeTab === 'direct_web' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-emerald-400" />
                  Instant Order WhatsApp Dispatch
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select any order or enter phone number. Opens in your real WhatsApp Web in 1 click!
                </p>
              </div>
              <span className="text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full">
                100% Free • Works on Any Device
              </span>
            </div>

            {/* Select Active Order */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold uppercase text-slate-300 tracking-wider">
                Select Order from System:
              </label>
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">-- Or enter custom recipient below --</option>
                {orders.slice(0, 50).map((o) => (
                  <option key={o.id} value={o.id}>
                    Order #{o.order_number} • {o.customer_name} • ₹{o.total_amount} ({o.outlet})
                  </option>
                ))}
              </select>
            </div>

            {/* Recipient Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold uppercase text-slate-300 tracking-wider">
                  Customer Mobile Number:
                </label>
                <input
                  type="tel"
                  value={dispatchPhone}
                  onChange={(e) => setDispatchPhone(e.target.value)}
                  placeholder="e.g. 9971860845"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold uppercase text-slate-300 tracking-wider">
                  Customer Name:
                </label>
                <input
                  type="text"
                  value={dispatchCustomerName}
                  onChange={(e) => setDispatchCustomerName(e.target.value)}
                  placeholder="Customer Name"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Template Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold uppercase text-slate-300 tracking-wider">
                Select Message Template:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'confirm', label: 'Order Confirmed' },
                  { key: 'dispatch', label: 'Out for Delivery' },
                  { key: 'delivered', label: 'Delivered' },
                  { key: 'reminder', label: 'Payment Due' }
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setDispatchTemplateType(t.key as any)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition border ${
                      dispatchTemplateType === t.key
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-950/40'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Editable Message Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold uppercase text-slate-300 tracking-wider">
                  Generated Message (Editable):
                </label>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(customMessage);
                    showNotification('📋 Message copied to clipboard!');
                  }}
                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Text</span>
                </button>
              </div>
              <textarea
                rows={8}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Primary Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleOpenWhatsAppWeb()}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm py-3.5 px-6 rounded-2xl shadow-xl shadow-emerald-950/50 flex items-center justify-center gap-2 transition"
              >
                <ExternalLink className="w-4 h-4" />
                <span>🚀 Open & Send in WhatsApp Web</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenWhatsAppMobile()}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-3.5 px-4 rounded-2xl border border-slate-700 flex items-center justify-center gap-2 transition"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Mobile App</span>
              </button>

              {isTrulyConnected && (
                <button
                  type="button"
                  onClick={handleSendViaSocket}
                  disabled={backgroundSending}
                  className="bg-emerald-950 hover:bg-emerald-900 text-emerald-300 font-bold text-xs py-3.5 px-4 rounded-2xl border border-emerald-500/40 flex items-center justify-center gap-2 transition"
                >
                  <Send className="w-4 h-4" />
                  <span>{backgroundSending ? 'Sending...' : 'Background Direct'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Real Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    WhatsApp Message Preview
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  {dispatchPhone ? `+91 ${dispatchPhone.replace(/[^0-9]/g, '')}` : '+91 XXXXXXXXXX'}
                </div>
              </div>

              {/* Chat Bubble Preview */}
              <div className="mt-4 bg-emerald-950/30 border border-emerald-900/50 rounded-2xl p-4 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed shadow-inner">
                {customMessage || 'Message will appear here...'}
              </div>

              <div className="mt-5 space-y-2.5 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs">
                <div className="font-extrabold text-slate-300 uppercase tracking-wider">
                  How 1-Click Send Works:
                </div>
                <ul className="text-slate-400 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Opens WhatsApp Web directly with customer chat and message pre-filled.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Includes order number, cake flavor, balance amount, and OTP.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Just press Enter in WhatsApp to send. No server setup required!</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUTOMATION RULES */}
      {activeTab === 'automation' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Sliders className="w-6 h-6 text-emerald-400" />
                Automation Rules & Triggers
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Configure automatic WhatsApp notification events when orders progress through the pipeline.
              </p>
            </div>
            <button
              onClick={() => handleSaveConfig()}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-6 py-2.5 rounded-2xl transition disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-950/40"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save All Rules'}</span>
            </button>
          </div>

          {/* Quick Notice */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-start gap-3 text-xs text-slate-300">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Every toggle auto-saves instantly. When an order event occurs, the system triggers the corresponding templated message. If WhatsApp is linked via QR, it sends in the background; otherwise, you can dispatch via 1-Click WhatsApp Web with pre-filled details.
            </p>
          </div>

          {/* Trigger Rules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                key: 'autoConfirmOnCreate' as keyof WhatsAppConfig,
                title: 'Auto Order Confirmation',
                badge: 'Order Created',
                desc: 'Automatically triggers confirmation message when a new order is added, showing item name, advance paid, and remaining balance.'
              },
              {
                key: 'autoDispatchOnRider' as keyof WhatsAppConfig,
                title: 'Auto Out for Delivery & OTP',
                badge: 'Rider Dispatched',
                desc: 'Automatically triggers dispatch message with assigned delivery rider name, contact, and the 4-digit verification OTP.'
              },
              {
                key: 'autoDeliveryComplete' as keyof WhatsAppConfig,
                title: 'Auto Delivery Receipt & Feedback',
                badge: 'Marked Delivered',
                desc: 'Automatically triggers thank-you receipt when order delivery is confirmed by rider or outlet manager.'
              },
              {
                key: 'autoPaymentReminder' as keyof WhatsAppConfig,
                title: 'Auto Payment Due Reminder',
                badge: 'Payment Balance',
                desc: 'Triggers payment reminder to customer for orders having unpaid or partial pending balances.'
              }
            ].map((rule) => {
              const isEnabled = Boolean((config as any)?.[rule.key]);
              return (
                <div
                  key={rule.key}
                  className={`p-5 rounded-2xl border transition ${
                    isEnabled
                      ? 'bg-emerald-950/20 border-emerald-500/40 shadow-lg shadow-emerald-950/20'
                      : 'bg-slate-950 border-slate-800'
                  } flex items-start justify-between gap-4`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{rule.title}</span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                        {rule.badge}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 leading-relaxed">{rule.desc}</div>
                    <div className="text-[11px] font-semibold text-emerald-400 pt-1">
                      {isEnabled ? '● Active • Will trigger on event' : '○ Disabled'}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleRule(rule.key)}
                    className={`w-14 h-7 rounded-full transition relative shrink-0 focus:outline-none ${
                      isEnabled ? 'bg-emerald-500' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-all ${
                        isEnabled ? 'left-8 shadow-md' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Delivery & Anti-Ban Controls */}
          <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Anti-Ban & Rate Limiting Controls
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  Delay Between Automated Messages:
                </label>
                <select
                  value={config?.throttleDelaySeconds || 5}
                  onChange={(e) => {
                    const sec = Number(e.target.value);
                    setConfig(prev => prev ? { ...prev, throttleDelaySeconds: sec } : prev);
                    handleSaveConfig({ throttleDelaySeconds: sec });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value={3}>3 Seconds (Fast)</option>
                  <option value={5}>5 Seconds (Recommended)</option>
                  <option value={8}>8 Seconds (Safe)</option>
                  <option value={15}>15 Seconds (Extra Safe)</option>
                </select>
                <p className="text-[11px] text-slate-400">
                  Randomized interval between consecutive messages prevents WhatsApp spam detection.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  Working Hours Protection (08:00 AM - 10:00 PM):
                </label>
                <div className="flex items-center justify-between p-2.5 bg-slate-900 border border-slate-700 rounded-xl">
                  <span className="text-xs text-slate-300 font-semibold">
                    {config?.workingHoursOnly ? 'Restricted to daytime only' : 'Allow 24x7 messaging'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleRule('workingHoursOnly')}
                    className={`w-12 h-6 rounded-full transition relative shrink-0 ${
                      config?.workingHoursOnly ? 'bg-emerald-500' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                        config?.workingHoursOnly ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Avoids disturbing customers during late night hours.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TEMPLATES */}
      {activeTab === 'templates' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Layers className="w-6 h-6 text-emerald-400" />
                Message Templates Customizer
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Customize order confirmation, rider dispatch, and delivery receipt messages.
              </p>
            </div>
            <button
              onClick={() => handleSaveConfig()}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-6 py-2.5 rounded-2xl transition disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-950/40"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save All Templates'}</span>
            </button>
          </div>

          {/* Template Subtabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            {[
              { key: 'confirm', label: '1. Order Confirmation' },
              { key: 'dispatch', label: '2. Rider Out for Delivery' },
              { key: 'delivered', label: '3. Delivery Completed' },
              { key: 'reminder', label: '4. Payment Due Reminder' }
            ].map((st) => (
              <button
                key={st.key}
                type="button"
                onClick={() => setActiveTemplateTab(st.key as any)}
                className={`py-2 px-4 rounded-xl text-xs font-bold transition border ${
                  activeTemplateTab === st.key
                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Editor Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Template Body Text:
              </label>
              <textarea
                rows={13}
                value={config?.templates?.[activeTemplateTab] || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setConfig((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      templates: {
                        ...prev.templates,
                        [activeTemplateTab]: val
                      }
                    };
                  });
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500 leading-relaxed"
              />
            </div>

            {/* Dynamic Tags Helper */}
            <div className="lg:col-span-4 bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">
                Available Dynamic Tags:
              </div>
              <p className="text-[11px] text-slate-400">
                Click any variable tag to copy and paste into your template.
              </p>

              <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                {[
                  { tag: '{customer_name}', desc: "Customer's Name" },
                  { tag: '{order_number}', desc: 'Order Number (e.g. 1001)' },
                  { tag: '{items}', desc: 'Item flavor, weight, & qty' },
                  { tag: '{name_on_cake}', desc: 'Custom Message/Name on Cake' },
                  { tag: '{total_amount}', desc: 'Total Amount ₹' },
                  { tag: '{advance_amount}', desc: 'Advance Paid ₹' },
                  { tag: '{remaining_balance}', desc: 'Remaining Due ₹' },
                  { tag: '{delivery_date}', desc: 'Delivery Date' },
                  { tag: '{delivery_time}', desc: 'Delivery Slot' },
                  { tag: '{rider_name}', desc: 'Delivery Partner Name' },
                  { tag: '{otp}', desc: '4-Digit Delivery OTP' }
                ].map((v) => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => handleCopyVariable(v.tag)}
                    className="w-full p-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl flex items-center justify-between text-left transition"
                  >
                    <span className="font-mono text-xs font-bold text-emerald-400">{v.tag}</span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      {copiedVar === v.tag ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        v.desc
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-white">WhatsApp Dispatch Audit Logs</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                History of attempted and delivered WhatsApp notifications.
              </p>
            </div>
            <button
              onClick={handleClearLogs}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 rounded-xl text-xs font-bold transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Logs</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-black tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">Order</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Recipient</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      No WhatsApp messages dispatched yet.
                    </td>
                  </tr>
                ) : (
                  logs.slice(0, 50).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-850/50 transition">
                      <td className="p-3 font-mono text-[11px] text-slate-400">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3 font-bold text-white">
                        {log.order_number ? `#${log.order_number}` : 'N/A'}
                      </td>
                      <td className="p-3 text-slate-300">{log.customer_name || 'Customer'}</td>
                      <td className="p-3 font-mono text-emerald-400">{log.recipient_phone}</td>
                      <td className="p-3 uppercase font-extrabold text-[10px] text-slate-400">
                        {log.type}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            log.status === 'sent'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {log.status === 'sent' ? 'Delivered' : 'Failed'}
                        </span>
                      </td>
                      <td className="p-3">
                        {log.direct_url && (
                          <a
                            href={log.direct_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 underline font-semibold"
                          >
                            <span>Open Web</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: OFFLINE OUTBOX & AUTO-RETRY */}
      {activeTab === 'outbox' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <Inbox className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <span>Offline Outbox & Auto-Send Queue</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                      {outboxQueue.length} Pending
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Messages queued while WhatsApp was unlinked or temporarily disconnected. Automatically dispatched the moment WhatsApp reconnects!
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                {isTrulyConnected ? (
                  <button
                    onClick={handleFlushOutbox}
                    disabled={flushingOutbox || outboxQueue.length === 0}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl text-xs font-black transition shadow-lg shadow-emerald-950/40"
                  >
                    <Send className={`w-3.5 h-3.5 ${flushingOutbox ? 'animate-pulse' : ''}`} />
                    <span>{flushingOutbox ? 'Dispatching...' : 'Dispatch All Now'}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveTab('qr_login')}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black transition shadow-lg shadow-emerald-950/40"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Scan QR to Re-link WhatsApp</span>
                  </button>
                )}

                {outboxQueue.length > 0 && (
                  <button
                    onClick={handleClearOutbox}
                    className="flex items-center gap-1 px-3 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-2xl text-xs font-bold transition border border-rose-500/30"
                    title="Clear Outbox"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>

            {/* Explanatory Info Card */}
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-300">
              <Zap className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white">Zero Message Loss Guarantee: </span>
                Jab WhatsApp unlink ya disconnect hota hai, to customer notifications (jaise Out for Delivery, Delivered) drop hone ke bajaye is persistent Outbox me safe save ho jate hain. Jaise hi WhatsApp QR scan karke re-link hota hai, system in sabhi pending messages ko automatically ek-ek karke send kar deta hai.
              </div>
            </div>

            {/* Queue Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/80 text-slate-300 font-bold border-b border-slate-700">
                  <tr>
                    <th className="p-3">Queued Time</th>
                    <th className="p-3">Order #</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Event Type</th>
                    <th className="p-3">Message Preview</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {outboxQueue.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                        <div className="font-bold text-white">Outbox is Empty</div>
                        <div className="text-xs text-slate-500 mt-1">All customer notifications have been delivered successfully!</div>
                      </td>
                    </tr>
                  ) : (
                    outboxQueue.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-850/50 transition">
                        <td className="p-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          {new Date(item.queuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-3 font-bold text-white whitespace-nowrap">
                          {item.orderNumber ? `#${item.orderNumber}` : 'N/A'}
                        </td>
                        <td className="p-3 text-slate-300 whitespace-nowrap font-medium">
                          {item.customerName || 'Customer'}
                        </td>
                        <td className="p-3 font-mono text-emerald-400 whitespace-nowrap">
                          +{item.phone}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            item.type === 'delivered'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : item.type === 'dispatch'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="p-3 max-w-xs truncate text-slate-300" title={item.message}>
                          {item.message}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {item.directWebUrl ? (
                            <a
                              href={item.directWebUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-lg text-[11px] font-bold border border-emerald-500/30 transition"
                            >
                              <span>Send Now via Web</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-500">Auto-retry pending</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
