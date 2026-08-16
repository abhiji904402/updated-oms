import React, { useState } from 'react';
import { useOMS } from '../lib/store';
import { X, FileSpreadsheet, RefreshCw, CheckCircle2, Clock, Link2, ShieldCheck, Zap, Copy, Check, Code2, HelpCircle } from 'lucide-react';

interface SheetSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const APPS_SCRIPT_CODE = `// =============================================
// BROOMIES BAKERY — Google Apps Script
// Outlet-wise sheets + Smart missing data sync
// =============================================

var OUTLET_SHEET_MAP = {
  "sector_31": "Sector 31",
  "Sector 31": "Sector 31",
  "sector_42": "Sector 42",
  "Sector 42": "Sector 42",
  "sector_35": "Sector 35",
  "Sector 35": "Sector 35",
  "sector_88": "Sector 88",
  "Sector 88": "Sector 88"
};

var HEADERS = [
  "Order#", "Order Date", "Order Time", "Mobile", "Customer Name",
  "Item", "Qty", "Delivery Type", "Informed By", "Amount",
  "Advance", "Remaining", "Payment", "Adv Bill No.", "Final Bill No.",
  "Status", "Delivery Date", "Expected Time", "Actual Time", "Partner",
  "Address", "Remarks", "Image URL", "Last Updated"
];

function getOrCreateSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setBackground("#6345ED")
      .setFontColor("#FFFFFF")
      .setFontWeight("bold");
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setBackground("#6345ED")
      .setFontColor("#FFFFFF")
      .setFontWeight("bold");
  }
  return sheet;
}

function upsertRow(sheet, orderNum, rowData) {
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(orderNum)) {
      sheet.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]);
      return;
    }
  }
  sheet.appendRow(rowData);
}

function deleteRow(sheet, orderNum) {
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(orderNum)) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

function buildRow(d) {
  return [
    d.order_number || "",
    d.order_date || "",
    d.order_time || "",
    d.mobile_number || "",
    d.customer_name || "",
    d.item_type || "",
    d.quantity || "",
    d.delivery_type || "",
    d.informed_by || "",
    Number(d.total_amount) || 0,
    Number(d.advance_amount) || 0,
    Number(d.remaining_balance) || 0,
    d.payment_type || "",
    d.advance_bill_number || "",
    d.final_bill_number || "",
    d.status || "",
    d.delivery_date || "",
    d.delivery_time_expected || "",
    d.actual_delivery_time || "",
    d.delivery_partner || "",
    d.address || "",
    d.remarks || "",
    d.item_image_url || "",
    new Date().toLocaleString("en-IN")
  ];
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = data.action;

    // Handle bulk sync (array of orders)
    if (data.bulk && Array.isArray(data.orders)) {
      var allSheet = getOrCreateSheet(ss, "All Orders");
      data.orders.forEach(function(order) {
        var outletKey = order.outlet ? String(order.outlet).trim() : "Sector 31";
        var sheetName = OUTLET_SHEET_MAP[outletKey] || OUTLET_SHEET_MAP[outletKey.toLowerCase().replace(/\\s+/g, '_')] || outletKey || "Other";
        var sheet = getOrCreateSheet(ss, sheetName);
        var rowData = buildRow(order);
        upsertRow(sheet, order.order_number, rowData);
        upsertRow(allSheet, order.order_number, rowData);
      });
      return ContentService.createTextOutput(JSON.stringify({ status: "success", count: data.orders.length }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (Array.isArray(data)) {
      var allSheet = getOrCreateSheet(ss, "All Orders");
      data.forEach(function(order) {
        var outletKey = order.outlet ? String(order.outlet).trim() : "Sector 31";
        var sheetName = OUTLET_SHEET_MAP[outletKey] || OUTLET_SHEET_MAP[outletKey.toLowerCase().replace(/\\s+/g, '_')] || outletKey || "Other";
        var sheet = getOrCreateSheet(ss, sheetName);
        var rowData = buildRow(order);
        upsertRow(sheet, order.order_number, rowData);
        upsertRow(allSheet, order.order_number, rowData);
      });
      return ContentService.createTextOutput(JSON.stringify({ status: "success", count: data.length }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Single order sync
    var orderData = data.order || data;
    var outletKey = orderData.outlet ? String(orderData.outlet).trim() : "Sector 31";
    var sheetName = OUTLET_SHEET_MAP[outletKey] || OUTLET_SHEET_MAP[outletKey.toLowerCase().replace(/\\s+/g, '_')] || outletKey || "Other";
    var sheet = getOrCreateSheet(ss, sheetName);
    var allSheet = getOrCreateSheet(ss, "All Orders");
    var rowData = buildRow(orderData);

    if (action === "delete") {
      deleteRow(sheet, orderData.order_number);
      deleteRow(allSheet, orderData.order_number);
    } else {
      upsertRow(sheet, orderData.order_number, rowData);
      upsertRow(allSheet, orderData.order_number, rowData);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Broomies Bakery Google Sheets Webhook Active!");
}`;

export const SheetSyncModal: React.FC<SheetSyncModalProps> = ({ isOpen, onClose }) => {
  const { sheetConfig, updateSheetConfig, triggerGoogleSheetSync, syncLogs } = useOMS();
  const [sheetUrl, setSheetUrl] = useState(sheetConfig.sheet_url);
  const [autoSync, setAutoSync] = useState(sheetConfig.auto_sync);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showScriptGuide, setShowScriptGuide] = useState(true);

  const handleSave = () => {
    const cleanUrl = (sheetUrl || '').trim();
    if (cleanUrl.includes('docs.google.com/spreadsheets')) {
      alert('⚠️ Note: You entered a Google Sheet document URL (docs.google.com)!\n\nTo enable auto-sync, you must paste the Web App URL generated from Google Apps Script (Step 1 -> Extensions -> Apps Script -> Deploy as Web App).\n\nExample Web App URL: https://script.google.com/macros/s/AKfycb.../exec');
      return;
    }
    updateSheetConfig({ sheet_url: cleanUrl, auto_sync: autoSync });
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    await triggerGoogleSheetSync();
    setIsSyncing(false);
  };

  const copyScriptCode = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-100">
                Google Sheets Webhook & Auto-Sync
              </h2>
              <p className="text-xs text-slate-400">
                Bidirectional synchronization for order records & kitchen updates
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs max-h-[82vh] overflow-y-auto">
          {/* Status Overview Card */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-bold text-slate-200 text-xs">Status: {sheetUrl ? 'CONFIGURED' : 'NOT CONFIGURED'}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Last Synced: {sheetConfig.last_synced_at ? new Date(sheetConfig.last_synced_at).toLocaleString() : 'Never'}
              </div>
            </div>

            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-950/50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>

          {/* Apps Script Setup Section */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <Code2 className="w-4 h-4" />
                <span>Google Apps Script Code (गूगल शीट कोड)</span>
              </div>
              <button
                onClick={copyScriptCode}
                className="px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 font-bold transition flex items-center gap-1.5 text-xs"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCode ? 'Copied Code!' : 'Copy Script Code'}
              </button>
            </div>

            {/* Code Snippet Box */}
            <div className="relative">
              <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[10px] overflow-x-auto max-h-36 scrollbar-thin">
                {APPS_SCRIPT_CODE}
              </pre>
            </div>

            {/* How to Connect Instructions */}
            <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-[11px] text-slate-300">
              <div className="font-bold text-amber-400 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" /> How to connect Google Sheets (गूगल शीट कैसे कनेक्ट करें):
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-1">
                <li>Google Sheet खोलें (`sheets.new`) या अपनी मौजूदा शीट खोलें।</li>
                <li>ऊपर मेनू में **Extensions (एक्सटेंशन)** → **Apps Script** पर क्लिक करें।</li>
                <li>वहाँ सारा पुराना कोड हटाकर **ऊपर दिए गए Code को Paste** करें और Save (Ctrl+S) करें।</li>
                <li>**Deploy (डिप्लॉय)** → **New deployment** पर क्लिक करें।</li>
                <li>Select type में **Web app** चुनें, **Execute as: Me** रखें, और **Who has access: Anyone (हर कोई)** सेट करके **Deploy** करें।</li>
                <li>मिले हुए **Web App URL** को कॉपी करके नीचे Webhook URL बॉक्स में डालें और Save करें!</li>
              </ol>
            </div>
          </div>

          {/* Configuration Form */}
          <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-rose-400" /> Google Apps Script Webhook URL
              </label>
              <input
                type="text"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500 font-mono text-[11px]"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Paste the Google Apps Script Web App URL ending with <code className="text-emerald-400">/exec</code>
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div>
                <div className="font-bold text-slate-200 text-xs flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Real-time Webhook Auto-Sync
                </div>
                <div className="text-[11px] text-slate-400">
                  Automatically push order creations, status edits, and payment updates
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAutoSync(!autoSync)}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ${
                  autoSync ? 'bg-emerald-500' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                    autoSync ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Recent Sync Audit Log */}
          <div>
            <div className="font-bold text-slate-300 text-xs mb-2 flex items-center justify-between">
              <span>Recent Webhook Sync Activity ({syncLogs.length})</span>
              <span className="text-[10px] text-slate-500">Total Sync Count: {sheetConfig.sync_count}</span>
            </div>

            <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-2 space-y-1">
              {syncLogs.length === 0 ? (
                <div className="text-center py-6 text-slate-500 italic">
                  No sync events logged in this session yet.
                </div>
              ) : (
                syncLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span className="text-slate-200 font-medium">{log.details}</span>
                    </div>
                    <span className="text-slate-500 font-mono text-[10px]">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
            >
              Close
            </button>
            <button
              onClick={() => {
                handleSave();
                onClose();
              }}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
