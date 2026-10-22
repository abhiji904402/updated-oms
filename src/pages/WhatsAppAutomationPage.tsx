import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw,
  Send,
  CheckCircle2,
  Inbox,
  Trash2,
  Play,
  Settings,
  MessageSquare,
  ShieldCheck,
  Clock,
  Power,
  Zap,
  FileText,
  Sliders,
  QrCode,
  Hash,
  Cloud,
  RotateCcw,
  Save,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Search
} from 'lucide-react';
import { useOMS } from '../lib/store';
import { isPaymentPending } from '../lib/orderLogic';
import {
  DEFAULT_WA_TEMPLATES,
  getSavedWhatsAppTemplates,
  saveWhatsAppTemplatesLocally,
  renderWhatsAppTemplate,
  formatWhatsAppPhone
} from '../components/WhatsAppPopup';

type HubTab = 'qr_link' | 'one_click' | 'rules' | 'templates' | 'logs' | 'outbox';
type TemplateKey = 'confirm' | 'dispatch' | 'pickup' | 'delivered' | 'reminder';

const TEMPLATE_VARIABLES = [
  { token: '{order_number}', label: 'Order #' },
  { token: '{customer_name}', label: 'Customer Name' },
  { token: '{items}', label: 'Bakery Item + Qty' },
  { token: '{name_on_cake}', label: 'Name on Cake' },
  { token: '{total_amount}', label: 'Total ₹' },
  { token: '{advance_amount}', label: 'Advance ₹' },
  { token: '{remaining_balance}', label: 'Balance Due ₹' },
  { token: '{delivery_date}', label: 'Delivery Date' },
  { token: '{delivery_time}', label: 'Delivery Time' },
  { token: '{rider_name}', label: 'Rider Name' },
  { token: '{otp}', label: 'Delivery OTP' },
  { token: '{outlet}', label: 'Outlet Name' }
];

export const WhatsAppAutomationPage: React.FC = () => {
  const { orders, showNotification, checkWhatsAppStatus } = useOMS();
  const [activeTab, setActiveTab] = useState<HubTab>('qr_link');

  // Connection & Pairing State
  const [status, setStatus] = useState<any>({
    connected: true,
    sessionState: 'connected',
    phoneNumber: '+919910759790',
    userName: 'Broomies Bakery'
  });
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingPhone, setPairingPhone] = useState<string>('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [linkMethod, setLinkMethod] = useState<'qr' | 'code'>('qr');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);

  // Queue & Logs State
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [isFlushing, setIsFlushing] = useState<boolean>(false);
  const [logSearch, setLogSearch] = useState<string>('');

  // Automation Rules & Templates State (Default ON, persisted locally & on server)
  const [config, setConfig] = useState<any>(() => {
    const defaults = {
      autoConfirmOnCreate: true,
      autoDispatchOnRider: true,
      autoDeliveryComplete: true,
      autoPaymentReminder: true,
      throttleDelaySeconds: 5,
      antiBanProtection: true,
      workingHoursOnly: false,
      userCustomizedRules: false,
      templates: getSavedWhatsAppTemplates()
    };
    try {
      const saved = localStorage.getItem('broomies_wa_rules_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.userCustomizedRules) {
          return { ...defaults, ...parsed, templates: getSavedWhatsAppTemplates() };
        }
      }
    } catch {}
    return defaults;
  });

  const [activeTemplateKey, setActiveTemplateKey] = useState<TemplateKey>('confirm');
  const [templatesDraft, setTemplatesDraft] = useState<Record<TemplateKey, string>>(() => getSavedWhatsAppTemplates());
  const [isSavingTemplates, setIsSavingTemplates] = useState<boolean>(false);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  // Test Message State (matches Screenshot)
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState(
    '👋 Hello from Broomies Bakery! Your Official WhatsApp Multi-Device connection is active.'
  );
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: 'success' | 'error';
    message: string;
    timestamp: string;
  } | null>(null);

  // 1-Click Dispatch Filter State
  const [oneClickSearch, setOneClickSearch] = useState('');
  const [oneClickTemplateType, setOneClickTemplateType] = useState<TemplateKey>('confirm');
  const [isSendingBulkReminder, setIsSendingBulkReminder] = useState(false);

  const formatDisplayPhone = (raw?: string) => {
    if (!raw) return '+919910759790';
    const clean = String(raw).replace(/[^0-9]/g, '');
    return clean ? `+${clean}` : '+919910759790';
  };

  const fetchAllData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      const [statusRes, queueRes, logsRes, cfgRes] = await Promise.all([
        fetch('/api/whatsapp/status'),
        fetch('/api/whatsapp/queue'),
        fetch('/api/whatsapp/logs'),
        fetch('/api/whatsapp/config')
      ]);

      if (statusRes.ok) {
        const data = await statusRes.json();
        setStatus(data);
        if (data.qrCode) setQrCode(data.qrCode);
        if (data.pairingCode) setPairingCode(data.pairingCode);
      }
      if (queueRes.ok) {
        const qData = await queueRes.json();
        const items = Array.isArray(qData.items) ? qData.items : Array.isArray(qData.queue) ? qData.queue : [];
        setQueueItems(items);
      }
      if (logsRes.ok) {
        const lData = await logsRes.json();
        setLogs(Array.isArray(lData.logs) ? lData.logs : []);
      }
      if (cfgRes.ok) {
        const cData = await cfgRes.json();
        const serverCfg = cData?.config || cData;
        if (serverCfg && typeof serverCfg === 'object') {
          setConfig((prev: any) => {
            const hasUserCustom = Boolean(serverCfg.userCustomizedRules || prev.userCustomizedRules);
            const merged = {
              ...prev,
              ...serverCfg,
              autoConfirmOnCreate: hasUserCustom ? (serverCfg.autoConfirmOnCreate ?? prev.autoConfirmOnCreate ?? true) : true,
              autoDispatchOnRider: hasUserCustom ? (serverCfg.autoDispatchOnRider ?? prev.autoDispatchOnRider ?? true) : true,
              autoDeliveryComplete: hasUserCustom ? (serverCfg.autoDeliveryComplete ?? prev.autoDeliveryComplete ?? true) : true,
              autoPaymentReminder: hasUserCustom ? (serverCfg.autoPaymentReminder ?? prev.autoPaymentReminder ?? true) : true,
              antiBanProtection: hasUserCustom ? (serverCfg.antiBanProtection ?? prev.antiBanProtection ?? true) : true,
              templates: {
                ...DEFAULT_WA_TEMPLATES,
                ...(prev.templates || {}),
                ...(serverCfg.templates || {})
              }
            };
            return merged;
          });
          if (serverCfg.templates) {
            saveWhatsAppTemplatesLocally(serverCfg.templates);
            setTemplatesDraft((prev) => ({
              ...DEFAULT_WA_TEMPLATES,
              ...prev,
              ...serverCfg.templates
            }));
          }
        }
      }
    } catch {} finally {
      if (showSpinner) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(() => fetchAllData(false), 5000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  const handleGenerateQR = async (forceRelink = false) => {
    setIsLoading(true);
    setPairingCode(null);
    try {
      const res = await fetch('/api/whatsapp/generate-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRelink })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.qrCode) {
          setQrCode(data.qrCode);
          showNotification('Fresh WhatsApp QR Code generated! Scan via WhatsApp > Linked Devices.');
        } else if (data.connected) {
          showNotification(`Already connected & active (${formatDisplayPhone(data.phoneNumber)})!`);
        }
        await fetchAllData();
      }
    } catch {
      showNotification('Failed generating QR code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestPairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairingPhone.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/whatsapp/pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: pairingPhone.trim() })
      });
      const data = await res.json();
      if (res.ok && data.pairingCode) {
        setPairingCode(data.pairingCode);
        showNotification(`Pairing Code generated: ${data.pairingCode}`);
      } else {
        showNotification(data.error || 'Could not generate pairing code. Try QR Scan.');
      }
    } catch {
      showNotification('Error requesting pairing code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch('/api/whatsapp/disconnect', { method: 'POST' });
      setStatus({ connected: false, sessionState: 'disconnected', phoneNumber: '' });
      setQrCode(null);
      setPairingCode(null);
      await checkWhatsAppStatus();
      showNotification('WhatsApp session unlinked');
    } catch {}
  };

  const handleCloudSync = async (action: 'backup' | 'restore') => {
    setIsCloudSyncing(true);
    try {
      const res = await fetch('/api/whatsapp/sync-cloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification(data.message || 'Cloud session synced!');
        await fetchAllData();
      }
    } catch {
      showNotification('Cloud sync error');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim() || !testMessage.trim()) {
      showNotification('Please enter recipient mobile number and message');
      return;
    }
    setIsSendingTest(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testPhone.trim(),
          message: testMessage.trim(),
          orderNumber: 'TEST',
          customerName: 'Test Verification',
          type: 'custom',
          strictAuto: true
        })
      });
      const data = await res.json();
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      if (res.ok && data.success && !data.queued) {
        const msg = `✅ Automatic test message delivered to ${testPhone.trim()} via ${data.sentVia || 'Linked WhatsApp Socket'}!`;
        setTestResult({
          status: 'success',
          message: msg,
          timestamp: nowStr
        });
        showNotification(msg);
        setTestPhone('');
        await fetchAllData();
      } else {
        const errMsg =
          data.error ||
          'Automatic WhatsApp socket could not send the message after auto-reconnect attempt. Please click "Unlink / Log Out WhatsApp" and scan a fresh QR Code.';
        setTestResult({
          status: 'error',
          message: errMsg,
          timestamp: nowStr
        });
        showNotification(`❌ Automatic Send Failed: ${errMsg}`);
        await fetchAllData();
      }
    } catch {
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setTestResult({
        status: 'error',
        message: 'Network error while testing automatic WhatsApp connection.',
        timestamp: nowStr
      });
      showNotification('❌ Network error while sending automatic test message');
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleUpdateConfig = async (updates: Record<string, any>) => {
    const nextConfig = { ...config, ...updates, userCustomizedRules: true };
    setConfig(nextConfig);
    try {
      localStorage.setItem('broomies_wa_rules_v2', JSON.stringify(nextConfig));
    } catch {}
    try {
      await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextConfig)
      });
      showNotification('Automation rules updated & synced across all devices');
    } catch {}
  };

  const handleSaveTemplates = async () => {
    setIsSavingTemplates(true);
    try {
      saveWhatsAppTemplatesLocally(templatesDraft);
      const nextConfig = {
        ...config,
        templates: templatesDraft
      };
      setConfig(nextConfig);
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: templatesDraft })
      });
      if (res.ok) {
        showNotification('✅ Message templates saved! All future confirmations & WA buttons will use your custom format.');
      }
    } catch {
      showNotification('Saved templates locally');
    } finally {
      setIsSavingTemplates(false);
    }
  };

  const handleResetTemplate = (key: TemplateKey) => {
    const updated = {
      ...templatesDraft,
      [key]: DEFAULT_WA_TEMPLATES[key]
    };
    setTemplatesDraft(updated);
    saveWhatsAppTemplatesLocally(updated);
    showNotification(`Reset ${key.toUpperCase()} template to Broomies default`);
  };

  const handleInsertVariable = (token: string) => {
    setTemplatesDraft((prev) => ({
      ...prev,
      [activeTemplateKey]: `${prev[activeTemplateKey] || ''}${token}`
    }));
    setCopiedVar(token);
    setTimeout(() => setCopiedVar(null), 1200);
  };

  const handleFlushQueue = async () => {
    setIsFlushing(true);
    try {
      const res = await fetch('/api/whatsapp/process-queue', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showNotification(data.message || 'Processed Outbox queue');
        await fetchAllData();
      }
    } catch {
      showNotification('Could not process outbox queue');
    } finally {
      setIsFlushing(false);
    }
  };

  const handleClearQueue = async () => {
    try {
      const res = await fetch('/api/whatsapp/clear-queue', { method: 'POST' });
      if (res.ok) {
        setQueueItems([]);
        showNotification('Offline Outbox queue cleared');
      }
    } catch {}
  };

  const handleClearLogs = async () => {
    try {
      const res = await fetch('/api/whatsapp/clear-logs', { method: 'POST' });
      if (res.ok) {
        setLogs([]);
        showNotification('Dispatch logs cleared');
      }
    } catch {}
  };

  // Sample order for live template preview
  const samplePreviewOrder: any = useMemo(
    () => ({
      id: 'sample-1051',
      order_number: 1051,
      customer_name: 'Rahul Sharma',
      mobile_number: '9810012345',
      outlet: 'Sector 31',
      item_type: 'Belgian Chocolate Truffle Cake',
      quantity: '1 Kg',
      name_on_cake: 'Happy Birthday Riya',
      total_amount: 1200,
      advance_amount: 500,
      remaining_balance: 700,
      payment_type: 'part',
      delivery_date: new Date().toISOString().split('T')[0],
      delivery_time_expected: '06:30 PM',
      delivery_partner: 'Vikas (Rider)',
      otp: '4829',
      address: 'H.No 412, Sector 31, Faridabad'
    }),
    []
  );

  const liveTemplatePreview = useMemo(
    () => renderWhatsAppTemplate(activeTemplateKey, samplePreviewOrder, templatesDraft),
    [activeTemplateKey, samplePreviewOrder, templatesDraft]
  );

  const pendingPaymentOrders = useMemo(() => {
    return (orders || []).filter(isPaymentPending);
  }, [orders]);

  const handleBulkPaymentReminders = async () => {
    if (pendingPaymentOrders.length === 0) {
      showNotification('No orders with pending payment due found.');
      return;
    }
    setIsSendingBulkReminder(true);
    let sent = 0;
    try {
      for (const ord of pendingPaymentOrders.slice(0, 25)) {
        const msg = renderWhatsAppTemplate('reminder', ord, templatesDraft);
        await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: ord.mobile_number,
            message: msg,
            orderNumber: ord.order_number,
            customerName: ord.customer_name,
            orderId: ord.id,
            type: 'reminder'
          })
        });
        sent++;
      }
      showNotification(`⚡ Dispatched ${sent} Payment Reminder messages via Linked WhatsApp / Outbox!`);
      await fetchAllData();
    } catch {
      showNotification('Error dispatching bulk payment reminders');
    } finally {
      setIsSendingBulkReminder(false);
    }
  };

  const filteredOneClickOrders = useMemo(() => {
    const list = (orders || []).slice(0, 60);
    if (!oneClickSearch.trim()) return list.slice(0, 24);
    const q = oneClickSearch.toLowerCase();
    return list.filter(
      (o) =>
        String(o.order_number).includes(q) ||
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.mobile_number || '').includes(q) ||
        (o.item_type || '').toLowerCase().includes(q)
    );
  }, [orders, oneClickSearch]);

  const filteredLogs = useMemo(() => {
    if (!logSearch.trim()) return logs;
    const q = logSearch.toLowerCase();
    return logs.filter(
      (l) =>
        String(l.order_number || '').includes(q) ||
        (l.recipient_phone || l.phone || '').toLowerCase().includes(q) ||
        (l.customer_name || '').toLowerCase().includes(q) ||
        (l.message || '').toLowerCase().includes(q)
    );
  }, [logs, logSearch]);

  return (
    <div className="p-3 sm:p-5 lg:p-6 space-y-5 max-w-6xl mx-auto">
      {/* TOP HEADER BAR — Matches User Screenshot Exactly */}
      <div className="bg-[#0d111d] border border-slate-800/90 rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#07261d] border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                WhatsApp Automation Hub
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#07291e] text-emerald-400 border border-emerald-500/40">
                Official
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              1-Click Direct WhatsApp Web &amp; Automated Background Messaging for Orders &amp; Dispatches
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {status.connected ? (
            <div className="bg-[#061f18] border border-emerald-500/40 rounded-2xl px-3.5 py-2 flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <div className="leading-tight">
                <div className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
                  LINKED &amp; ACTIVE
                </div>
                <div className="text-[11px] font-mono text-slate-300">
                  {formatDisplayPhone(status.phoneNumber)}
                </div>
              </div>
              <button
                type="button"
                onClick={handleDisconnect}
                className="px-2.5 py-1 rounded-xl bg-[#351520] hover:bg-rose-900/80 border border-rose-500/40 text-rose-300 text-[11px] font-extrabold transition cursor-pointer"
              >
                Unlink
              </button>
            </div>
          ) : (
            <div className="bg-amber-950/60 border border-amber-500/40 rounded-2xl px-3.5 py-2 flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <div className="text-xs font-extrabold text-amber-300">
                Unlinked ({queueItems.length} in Outbox)
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => fetchAllData(true)}
            className="px-3.5 py-2.5 rounded-2xl bg-[#131826] hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-bold flex items-center gap-2 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 6 HORIZONTAL PILL TABS — Matches User Screenshot Exactly */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-2 no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('qr_link')}
          className={`px-4 py-2.5 rounded-full text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
            activeTab === 'qr_link'
              ? 'bg-[#0ea568] text-white shadow-lg shadow-emerald-950/80 border border-emerald-400/50'
              : 'bg-[#111522] hover:bg-[#171c2d] text-slate-300 border border-slate-800'
          }`}
        >
          <QrCode className="w-3.5 h-3.5" />
          <span>Official WhatsApp QR Link</span>
          <span className={`w-2 h-2 rounded-full ${status.connected ? 'bg-emerald-200' : 'bg-amber-400'}`} />
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('one_click')}
          className={`px-4 py-2.5 rounded-full text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
            activeTab === 'one_click'
              ? 'bg-[#0ea568] text-white shadow-lg shadow-emerald-950/80 border border-emerald-400/50'
              : 'bg-[#111522] hover:bg-[#171c2d] text-slate-300 border border-slate-800'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>⚡ 1-Click WhatsApp Web Dispatch</span>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-[#07291e] text-emerald-400 border border-emerald-500/40">
            100% Free
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2.5 rounded-full text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
            activeTab === 'rules'
              ? 'bg-[#0ea568] text-white shadow-lg shadow-emerald-950/80 border border-emerald-400/50'
              : 'bg-[#111522] hover:bg-[#171c2d] text-slate-300 border border-slate-800'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-purple-400" />
          <span>⚙️ Automation Rules</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2.5 rounded-full text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
            activeTab === 'templates'
              ? 'bg-[#0ea568] text-white shadow-lg shadow-emerald-950/80 border border-emerald-400/50'
              : 'bg-[#111522] hover:bg-[#171c2d] text-slate-300 border border-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-amber-300" />
          <span>📝 Message Templates</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 rounded-full text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
            activeTab === 'logs'
              ? 'bg-[#0ea568] text-white shadow-lg shadow-emerald-950/80 border border-emerald-400/50'
              : 'bg-[#111522] hover:bg-[#171c2d] text-slate-300 border border-slate-800'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-emerald-400" />
          <span>📊 Dispatch Logs ({logs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('outbox')}
          className={`px-4 py-2.5 rounded-full text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
            activeTab === 'outbox'
              ? 'bg-[#0ea568] text-white shadow-lg shadow-emerald-950/80 border border-emerald-400/50'
              : 'bg-[#111522] hover:bg-[#171c2d] text-slate-300 border border-slate-800'
          }`}
        >
          <Inbox className="w-3.5 h-3.5 text-amber-400" />
          <span>📦 Offline Outbox ({queueItems.length})</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: OFFICIAL WHATSAPP QR LINK — Exact Match to User Screenshot   */}
      {/* =================================================================== */}
      {activeTab === 'qr_link' && (
        <div className="bg-[#071318] border border-emerald-500/30 rounded-3xl p-5 sm:p-7 space-y-6 shadow-2xl">
          {status.connected ? (
            <>
              {/* Connected Banner Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#07291e] border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-lg sm:text-xl font-black text-white">
                        Official WhatsApp Linked &amp; Active
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#07291e] text-emerald-400 border border-emerald-500/40">
                        Multi-Device Live
                      </span>
                      {status.alreadyLinkedOnOtherDevice && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-950/90 text-indigo-300 border border-indigo-500/40">
                          Synced Across Pre-Deploy &amp; Post-Deploy
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      Your phone is connected. Background automated order messages will deliver directly through this WhatsApp account.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCloudSync('backup')}
                    disabled={isCloudSyncing}
                    className="px-3.5 py-2.5 rounded-xl bg-[#0d1c24] hover:bg-emerald-950 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    title="Keep session permanently logged in across deployments"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>{isCloudSyncing ? 'Syncing...' : 'Cloud Lock Active'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="px-4 py-2.5 rounded-xl bg-[#2a121a] hover:bg-rose-950 border border-rose-500/40 text-rose-300 text-xs font-extrabold flex items-center gap-2 transition cursor-pointer"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>Unlink / Log Out WhatsApp</span>
                  </button>
                </div>
              </div>

              {/* 3 Info Cards Grid — Exact Match to User Screenshot */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#0b131e] border border-slate-800/90 rounded-2xl p-5 space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    LINKED PHONE NUMBER
                  </span>
                  <div className="text-lg font-black text-emerald-400 font-mono">
                    {formatDisplayPhone(status.phoneNumber)}
                  </div>
                  <span className="text-xs text-slate-400 block">
                    Official WhatsApp Account
                  </span>
                </div>

                <div className="bg-[#0b131e] border border-slate-800/90 rounded-2xl p-5 space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    BUSINESS PROFILE
                  </span>
                  <div className="text-lg font-black text-white">
                    {status.userName || 'Broomies Bakery'}
                  </div>
                  <span className="text-xs text-slate-400 block">
                    Direct Socket Connection
                  </span>
                </div>

                <div className="bg-[#0b131e] border border-slate-800/90 rounded-2xl p-5 space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    AUTOMATION ENGINE
                  </span>
                  <div className="text-lg font-black text-emerald-400 flex items-center gap-1.5">
                    <Zap className="w-4 h-4" />
                    <span>Multi-Device Socket</span>
                  </div>
                  <span className="text-xs text-slate-400 block">
                    Zero Subscription Costs (100% Free)
                  </span>
                </div>
              </div>
            </>
          ) : (
            /* When Unlinked: QR Code + 8-Digit Pairing Code + Cloud Restore */
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-emerald-400" />
                    <span>Link Official WhatsApp Account (Pre-Deploy &amp; Post-Deploy Sync)</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Once linked, your session is backed up to Firebase Cloud so it never logs out and works across all devices.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLinkMethod('qr')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                      linkMethod === 'qr'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    QR Code Scan
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinkMethod('code')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                      linkMethod === 'code'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    8-Digit Pairing Code
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCloudSync('restore')}
                    disabled={isCloudSyncing}
                    className="px-3 py-1.5 rounded-xl bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Restore Cloud Session</span>
                  </button>
                </div>
              </div>

              {linkMethod === 'qr' ? (
                <div className="flex flex-col items-center justify-center py-6 space-y-4">
                  {qrCode ? (
                    <div className="bg-white p-4 rounded-2xl shadow-2xl flex flex-col items-center">
                      <img
                        src={
                          qrCode.startsWith('data:')
                            ? qrCode
                            : `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrCode)}`
                        }
                        alt="WhatsApp QR Code"
                        className="w-56 h-56"
                      />
                      <span className="text-xs font-extrabold text-slate-800 mt-2">
                        Open WhatsApp &gt; Linked Devices &gt; Link a Device
                      </span>
                    </div>
                  ) : (
                    <div className="p-8 rounded-2xl bg-[#0b131e] border border-dashed border-slate-700 text-center max-w-md space-y-3">
                      <QrCode className="w-10 h-10 text-emerald-400 mx-auto opacity-80" />
                      <div className="text-sm font-bold text-white">Ready to Generate Official WhatsApp QR</div>
                      <p className="text-xs text-slate-400">
                        Click below to generate a live Multi-Device QR code and scan it from your phone.
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleGenerateQR(true)}
                    disabled={isLoading}
                    className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg flex items-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>{qrCode ? 'Refresh QR Code' : 'Generate Official QR Code'}</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRequestPairingCode} className="max-w-md mx-auto bg-[#0b131e] border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="text-xs text-slate-300 font-semibold flex items-center gap-2">
                    <Hash className="w-4 h-4 text-emerald-400" />
                    <span>Link Using 8-Digit Phone Number Code (No Camera Required)</span>
                  </div>
                  <input
                    type="text"
                    value={pairingPhone}
                    onChange={(e) => setPairingPhone(e.target.value)}
                    placeholder="Enter 10-digit WhatsApp Number (e.g. 9910759790)"
                    className="w-full bg-[#070b12] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                  {pairingCode && (
                    <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-center space-y-1">
                      <div className="text-[10px] uppercase font-bold text-emerald-300">Enter this code in WhatsApp</div>
                      <div className="text-2xl font-black font-mono tracking-widest text-white">{pairingCode}</div>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs cursor-pointer"
                  >
                    {isLoading ? 'Requesting Code...' : 'Get 8-Digit Pairing Code'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Bottom Test Box — Matches User Screenshot Exactly */}
          <div className="bg-[#0b131e] border border-slate-800/90 rounded-2xl p-5 space-y-4">
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-400" />
                <span>Send Live Test Message via Linked WhatsApp</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Enter a number to verify real-time message delivery.
              </p>
            </div>

            <form onSubmit={handleSendTest} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-4 space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                  RECIPIENT MOBILE NUMBER:
                </label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="e.g. 9971860845"
                  className="w-full bg-[#111827] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="md:col-span-6 space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                  TEST MESSAGE:
                </label>
                <input
                  type="text"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full bg-[#111827] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={isSendingTest}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#0ea568] hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingTest ? 'Auto-Sending...' : 'Send Test'}</span>
                </button>
              </div>
            </form>

            {testResult && (
              <div
                className={`rounded-xl p-3.5 border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  testResult.status === 'success'
                    ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
                    : 'bg-rose-950/70 border-rose-500/50 text-rose-200'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="font-extrabold flex items-center gap-2">
                    <span>
                      {testResult.status === 'success'
                        ? 'Automatic Connection Verified (Sent Without Manual WhatsApp Web)'
                        : 'Automatic Send Failed (Auto-Reconnect Attempted)'}
                    </span>
                    <span className="text-[10px] opacity-75 font-mono">({testResult.timestamp})</span>
                  </div>
                  <p className="text-[11px] opacity-90">{testResult.message}</p>
                </div>

                {testResult.status === 'error' && (
                  <button
                    type="button"
                    onClick={() => handleGenerateQR(true)}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-extrabold shrink-0 cursor-pointer"
                  >
                    Scan Fresh QR to Relink
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: ⚡ 1-CLICK WHATSAPP WEB DISPATCH (100% FREE)                  */}
      {/* =================================================================== */}
      {activeTab === 'one_click' && (
        <div className="bg-[#0d111d] border border-slate-800/90 rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <span>1-Click Direct WhatsApp Web &amp; App Dispatcher</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Instantly send formatted Confirmation, Rider OTP, Delivered, or Payment Reminder messages for any order using your custom templates.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {(['confirm', 'dispatch', 'pickup', 'delivered', 'reminder'] as TemplateKey[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setOneClickTemplateType(t)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase cursor-pointer transition ${
                    oneClickTemplateType === t
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 1-Click Bulk Pending Payment Reminder Banner */}
          <div className="bg-gradient-to-r from-amber-950/60 via-[#151226] to-emerald-950/50 border border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>1-Click Bulk Payment Reminder ({pendingPaymentOrders.length} Pending Due Orders)</span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Send your custom Payment Reminder WhatsApp message to all customers with remaining balance due.
              </p>
            </div>
            <button
              type="button"
              onClick={handleBulkPaymentReminders}
              disabled={isSendingBulkReminder || pendingPaymentOrders.length === 0}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-1.5 shrink-0 disabled:opacity-40 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {isSendingBulkReminder
                  ? 'Dispatching Reminders...'
                  : `Send Bulk Reminder (${Math.min(25, pendingPaymentOrders.length)})`}
              </span>
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={oneClickSearch}
              onChange={(e) => setOneClickSearch(e.target.value)}
              placeholder="Search order #, customer name, phone, or cake item..."
              className="w-full bg-[#111827] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
            {filteredOneClickOrders.map((ord) => {
              const cleanPhone = formatWhatsAppPhone(ord.mobile_number);
              const msg = renderWhatsAppTemplate(oneClickTemplateType, ord, templatesDraft);
              const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
              return (
                <div
                  key={ord.id}
                  className="bg-[#111726] border border-slate-800/90 rounded-2xl p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/40 text-[11px] font-black font-mono">
                        #{ord.order_number}
                      </span>
                      <span className="text-xs font-extrabold text-white truncate">
                        {ord.customer_name || 'Customer'}
                      </span>
                      <span className="text-[11px] font-mono text-emerald-400">
                        +{cleanPhone}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-1">
                      {ord.item_type} • {ord.outlet} • ₹{ord.total_amount}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold flex items-center gap-1 shadow transition"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>1-Click WA</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: ⚙️ AUTOMATION RULES                                          */}
      {/* =================================================================== */}
      {activeTab === 'rules' && (
        <div className="bg-[#0d111d] border border-slate-800/90 rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-400" />
                <span>Automated Event Triggers &amp; Anti-Ban Protection</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure which order lifecycle events automatically dispatch WhatsApp messages to customers.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Anti-Ban Guard ({config.throttleDelaySeconds || 5}s delay)</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                key: 'autoConfirmOnCreate',
                title: 'Auto-Send Order Confirmation',
                desc: 'Automatically sends Order Confirmation template the moment a new order is created'
              },
              {
                key: 'autoDispatchOnRider',
                title: 'Auto-Send Out for Delivery & Rider OTP',
                desc: 'Automatically sends Rider name & 4-digit OTP when order is marked Out for Delivery'
              },
              {
                key: 'autoDeliveryComplete',
                title: 'Auto-Send Delivered Feedback Message',
                desc: 'Sends warm thank you & feedback message when order is marked Delivered'
              },
              {
                key: 'autoPaymentReminder',
                title: 'Auto-Send Pending Payment Reminder',
                desc: 'Allows automated balance due reminders for partial/due payment orders'
              },
              {
                key: 'antiBanProtection',
                title: 'Smart Anti-Ban Human Delay Throttle',
                desc: 'Adds natural 3–8 second human-like spacing between bulk/queued messages so your number never gets flagged'
              },
              {
                key: 'workingHoursOnly',
                title: 'Bakery Operating Hours Filter (9 AM – 11 PM)',
                desc: 'Queues late-night automated messages and dispatches them in the morning'
              }
            ].map((rule) => {
              const enabled = Boolean(config[rule.key]);
              return (
                <div
                  key={rule.key}
                  className="bg-[#111726] border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-extrabold text-white">{rule.title}</div>
                    <p className="text-xs text-slate-400 leading-relaxed">{rule.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUpdateConfig({ [rule.key]: !enabled })}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase transition cursor-pointer shrink-0 ${
                      enabled
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/60'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {enabled ? 'ENABLED' : 'OFF'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: 📝 MESSAGE TEMPLATES STUDIO (Custom Customer Templates)      */}
      {/* =================================================================== */}
      {activeTab === 'templates' && (
        <div className="bg-[#0d111d] border border-slate-800/90 rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <span>Custom Customer Message Templates Studio</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Customize the exact message sent to customers for Order Confirmation, Dispatch OTP, Delivered, and Payment Reminders.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleResetTemplate(activeTemplateKey)}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Default</span>
              </button>
              <button
                type="button"
                onClick={handleSaveTemplates}
                disabled={isSavingTemplates}
                className="px-4 py-2 rounded-xl bg-[#0ea568] hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingTemplates ? 'Saving...' : 'Save Templates'}</span>
              </button>
            </div>
          </div>

          {/* 5 Template Type Selector Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { id: 'confirm', label: '1. Order Confirmation Message' },
              { id: 'dispatch', label: '2. Out for Delivery & Rider OTP' },
              { id: 'pickup', label: '3. Ready for Pickup Alert' },
              { id: 'delivered', label: '4. Order Delivered Thank You' },
              { id: 'reminder', label: '5. Pending Payment Reminder' }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTemplateKey(t.id as TemplateKey)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition cursor-pointer ${
                  activeTemplateKey === t.id
                    ? 'bg-purple-600 text-white shadow-lg border border-purple-400/50'
                    : 'bg-[#111726] text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Clickable Dynamic Variable Chips */}
          <div className="bg-[#111726] border border-slate-800 rounded-2xl p-3.5 space-y-2">
            <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Click any variable below to insert it into your message template:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v.token}
                  type="button"
                  onClick={() => handleInsertVariable(v.token)}
                  className="px-2.5 py-1 rounded-lg bg-[#090d16] hover:bg-emerald-950 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  {copiedVar === v.token ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 opacity-60" />}
                  <span>{v.token}</span>
                  <span className="text-slate-400 font-sans font-normal text-[10px]">({v.label})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Editor + Live Preview Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-xs font-extrabold uppercase tracking-wider text-purple-300 block">
                Edit Template ({activeTemplateKey.toUpperCase()})
              </label>
              <textarea
                rows={12}
                value={templatesDraft[activeTemplateKey] || ''}
                onChange={(e) =>
                  setTemplatesDraft((prev) => ({
                    ...prev,
                    [activeTemplateKey]: e.target.value
                  }))
                }
                className="w-full bg-[#090d16] border border-slate-700/80 rounded-2xl p-4 text-xs font-mono text-white leading-relaxed focus:outline-none focus:border-emerald-500 resize-y"
                placeholder="Write your custom WhatsApp template here..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 block">
                Live Customer Preview (Sample Order #1051)
              </label>
              <div className="bg-[#071a14] border border-emerald-500/30 rounded-2xl p-4 min-h-[260px] flex flex-col justify-between">
                <pre className="text-xs font-mono text-emerald-100 whitespace-pre-wrap leading-relaxed">
                  {liveTemplatePreview}
                </pre>
                <div className="pt-3 mt-3 border-t border-emerald-900/50 flex items-center justify-between text-[11px] text-emerald-400">
                  <span>✓ Auto-fills for every customer order</span>
                  <button
                    type="button"
                    onClick={handleSaveTemplates}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold cursor-pointer"
                  >
                    Save &amp; Apply Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 5: 📊 DISPATCH LOGS                                             */}
      {/* =================================================================== */}
      {activeTab === 'logs' && (
        <div className="bg-[#0d111d] border border-slate-800/90 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-400" />
                <span>WhatsApp Dispatch History Logs ({logs.length})</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Complete audit trail of all automated and manual WhatsApp notifications.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Search phone or order #..."
                className="bg-[#111827] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleClearLogs}
                disabled={logs.length === 0}
                className="px-3 py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1 disabled:opacity-40 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Logs</span>
              </button>
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400 bg-[#111726] rounded-2xl border border-slate-800">
              No WhatsApp dispatch logs recorded yet.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {filteredLogs.map((log, idx) => (
                <div
                  key={log.id || idx}
                  className="bg-[#111726] border border-slate-800 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-white">
                        {log.recipient_phone || log.phone || 'N/A'}
                      </span>
                      {log.order_number && (
                        <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 text-[10px] font-bold">
                          Order #{log.order_number}
                        </span>
                      )}
                      <span className="text-slate-400">{log.customer_name || 'Customer'}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 line-clamp-2 font-mono">{log.message}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                        log.status === 'delivered' || log.status === 'sent'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                          : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {log.status || 'sent'}
                    </span>
                    {log.direct_url && (
                      <a
                        href={log.direct_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>WA Web</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 6: 📦 OFFLINE OUTBOX                                            */}
      {/* =================================================================== */}
      {activeTab === 'outbox' && (
        <div className="bg-[#0d111d] border border-slate-800/90 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <Inbox className="w-5 h-5 text-amber-400" />
                <span>Offline Outbox Queue ({queueItems.length})</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Messages queued while offline or unlinked are automatically dispatched the moment WhatsApp is active.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFlushQueue}
                disabled={isFlushing || queueItems.length === 0}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{isFlushing ? 'Dispatching...' : 'Flush & Send All Now'}</span>
              </button>
              <button
                type="button"
                onClick={handleClearQueue}
                disabled={queueItems.length === 0}
                className="px-3.5 py-2 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Outbox</span>
              </button>
            </div>
          </div>

          {queueItems.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400 bg-[#111726] rounded-2xl border border-slate-800">
              Outbox is empty — all queued WhatsApp messages have been delivered!
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {queueItems.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="bg-[#111726] border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="font-bold text-white flex items-center gap-2">
                      <span className="font-mono text-emerald-400">+{item.recipientPhone || item.phone}</span>
                      {item.orderNumber && (
                        <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 text-[10px]">
                          Order #{item.orderNumber}
                        </span>
                      )}
                      <span className="text-slate-400">{item.customerName}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 line-clamp-2 font-mono">{item.message}</div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.directWebUrl && (
                      <a
                        href={item.directWebUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Send via Web</span>
                      </a>
                    )}
                    <span className="px-2.5 py-1 rounded-lg bg-amber-950 text-amber-300 text-[10px] font-bold">
                      QUEUED
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WhatsAppAutomationPage;
