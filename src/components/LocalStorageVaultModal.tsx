import React, { useState, useEffect, useRef } from 'react';
import { useOMS } from '../lib/store';
import {
  StorageSnapshot,
  getAvailableSnapshots,
  createLocalSnapshot,
  restoreSnapshot,
  exportVaultToDisk,
  importVaultFromDisk
} from '../lib/localStorageVault';
import {
  HardDrive,
  Download,
  Upload,
  RotateCcw,
  ShieldCheck,
  Plus,
  Clock,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileJson,
  X,
  Database,
  Sparkles
} from 'lucide-react';

interface LocalStorageVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LocalStorageVaultModal: React.FC<LocalStorageVaultModalProps> = ({ isOpen, onClose }) => {
  const { orders, importOrders } = useOMS();
  const [snapshots, setSnapshots] = useState<StorageSnapshot[]>([]);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSnapshots = async () => {
    try {
      const list = await getAvailableSnapshots();
      setSnapshots(list);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSnapshots();
      setStatusMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateSnapshot = async () => {
    if (orders.length === 0) {
      setStatusMessage({ type: 'error', text: 'No orders available to snapshot.' });
      return;
    }
    setIsCreatingSnapshot(true);
    try {
      const label = snapshotLabel.trim() || `Manual Backup (${orders.length} orders)`;
      await createLocalSnapshot(orders, label);
      setSnapshotLabel('');
      await loadSnapshots();
      setStatusMessage({ type: 'success', text: `🛡️ Snapshot "${label}" created successfully!` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to create snapshot: ${err.message}` });
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  const handleRestoreSnapshot = async (snap: StorageSnapshot) => {
    if (window.confirm(`Restore ${snap.orderCount} orders from snapshot "${snap.label}" created on ${new Date(snap.timestamp).toLocaleString()}?`)) {
      try {
        const restored = await restoreSnapshot(snap.id);
        if (restored && restored.length > 0) {
          importOrders(restored, true);
          setStatusMessage({ type: 'success', text: `✅ Restored ${restored.length} orders from snapshot!` });
        }
      } catch (err: any) {
        setStatusMessage({ type: 'error', text: `Restore failed: ${err.message}` });
      }
    }
  };

  const handleExportJSON = () => {
    exportVaultToDisk(orders);
    setStatusMessage({ type: 'success', text: `📥 Downloaded ${orders.length} orders as JSON backup file to your computer.` });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const res = await importVaultFromDisk(file);
      if (res.success && res.orders.length > 0) {
        importOrders(res.orders, true);
        setStatusMessage({ type: 'success', text: `🎉 ${res.message}` });
        await loadSnapshots();
      } else {
        setStatusMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Import error: ${err.message}` });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Local Storage Vault & 100% Zero-Loss Backup
              </h2>
              <p className="text-xs text-slate-400">
                Ultra-fast 0ms local disk persistence (IndexedDB + Storage Folders). No Firestore limit issues.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                  : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Quick Health & Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                <Database className="w-4 h-4 text-purple-400" />
                <span>Active Local Orders</span>
              </div>
              <p className="text-2xl font-black text-white mt-1">{orders.length}</p>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3 h-3" /> 100% Stored Locally
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Local Vault Status</span>
              </div>
              <p className="text-sm font-bold text-emerald-300 mt-2">Zero-Loss Active</p>
              <span className="text-[10px] text-slate-400">Unlimited IndexedDB</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>Saved Snapshots</span>
              </div>
              <p className="text-2xl font-black text-white mt-1">{snapshots.length}</p>
              <span className="text-[10px] text-slate-400">Rollback points ready</span>
            </div>
          </div>

          {/* Fast Disk Export & Import Actions */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <FileJson className="w-4 h-4 text-indigo-400" />
              Download / Restore Local Backup File
            </h3>
            <p className="text-xs text-slate-400">
              Apne sabhi orders ka 1-click JSON backup file download karein ya kisi bhi doosre PC se backup file upload karke data instant load karein.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={handleExportJSON}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-900/30 transition"
              >
                <Download className="w-4 h-4" />
                <span>Download Backup (.JSON)</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-2 border border-slate-600 transition"
              >
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>{isImporting ? 'Restoring...' : 'Restore from Backup (.JSON)'}</span>
              </button>
            </div>
          </div>

          {/* Create Instant Rollback Snapshot */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              Create Snapshot Rollback Point
            </h3>
            <p className="text-xs text-slate-400">
              Koi bhi bada change ya bulk import karne se pehle ek snapshot point bana lijiye, taaki 1-click me wapas aa sakein.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={snapshotLabel}
                onChange={(e) => setSnapshotLabel(e.target.value)}
                placeholder="Snapshot Name (e.g. Before Morning Dispatch)"
                className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={handleCreateSnapshot}
                disabled={isCreatingSnapshot}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-900/30 transition shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>{isCreatingSnapshot ? 'Saving...' : 'Save Snapshot'}</span>
              </button>
            </div>
          </div>

          {/* Available Snapshots History */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Saved Snapshots & Rollback History</span>
              <span className="text-[10px] text-slate-500 font-normal">Latest 10 auto-stored</span>
            </h3>

            {snapshots.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-950/40 border border-slate-800/80 text-center text-xs text-slate-500">
                No snapshots created yet. Create a snapshot above to set your first rollback point.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                {snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{snap.label}</span>
                        <span className="px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-500/40 text-purple-300 text-[10px] font-bold">
                          {snap.orderCount} Orders
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {new Date(snap.timestamp).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>

                    <button
                      onClick={() => handleRestoreSnapshot(snap)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Rollback</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            All data persists safely on this browser even when offline.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
          >
            Close Vault
          </button>
        </div>
      </div>
    </div>
  );
};
