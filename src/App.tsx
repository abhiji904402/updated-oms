import React, { useState, useCallback, Suspense, lazy } from 'react';
import { OMSProvider, useOMS } from './lib/store';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginPage } from './components/LoginPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { AddOrderModal } from './components/AddOrderModal';
import { SheetSyncModal } from './components/SheetSyncModal';
import { PasswordManagerModal } from './components/PasswordManagerModal';
import { ThermalPrintModal } from './components/ThermalPrintModal';
import { LocalStorageVaultModal } from './components/LocalStorageVaultModal';
import { Order } from './types';
import { AlertTriangle, ExternalLink } from 'lucide-react';

// Lazy-loaded secondary pages for maximum initial load performance
const OutletDashboard = lazy(() => import('./pages/OutletDashboard').then(m => ({ default: m.OutletDashboard })));
const DeliveryDashboard = lazy(() => import('./pages/DeliveryDashboard').then(m => ({ default: m.DeliveryDashboard })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const AlertsPage = lazy(() => import('./pages/AlertsPage').then(m => ({ default: m.AlertsPage })));
const GoogleSheetsPage = lazy(() => import('./pages/GoogleSheetsPage').then(m => ({ default: m.GoogleSheetsPage })));

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px] text-purple-400">
      <div className="flex items-center gap-3 bg-slate-900/80 border border-purple-500/30 px-5 py-3 rounded-xl shadow-lg backdrop-blur">
        <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Loading page...</span>
      </div>
    </div>
  );
}

function OMSAppContent() {
  const { session, isAuthenticated, isFirestoreQuotaExceeded } = useOMS();

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isOpenMobile, setIsOpenMobile] = useState<boolean>(false);
  const handleSelectTab = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isThermalModalOpen, setIsThermalModalOpen] = useState(false);
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);

  const openAddModal = useCallback(() => setIsAddModalOpen(true), []);
  const closeAddModal = useCallback(() => setIsAddModalOpen(false), []);

  const openThermalModal = useCallback(() => setIsThermalModalOpen(true), []);
  const closeThermalModal = useCallback(() => setIsThermalModalOpen(false), []);

  const openSheetModal = useCallback(() => setIsSheetModalOpen(true), []);
  const closeSheetModal = useCallback(() => setIsSheetModalOpen(false), []);

  const openPasswordModal = useCallback(() => setIsPasswordModalOpen(true), []);
  const closePasswordModal = useCallback(() => setIsPasswordModalOpen(false), []);

  const openVaultModal = useCallback(() => setIsVaultModalOpen(true), []);
  const closeVaultModal = useCallback(() => setIsVaultModalOpen(false), []);

  const toggleMobileMenu = useCallback(() => setIsOpenMobile((prev) => !prev), []);

  const handleOpenDeliveryModal = useCallback((_order: Order) => {
    setActiveTab('delivery');
  }, []);

  // Automatically enforce delivery page for rider role and restricted tabs for outlet role
  React.useEffect(() => {
    if (session.role === 'delivery' && activeTab !== 'delivery') {
      setActiveTab('delivery');
    } else if (session.role === 'outlet' && activeTab !== 'dashboard' && activeTab !== 'outlet' && activeTab !== 'analytics') {
      setActiveTab('dashboard');
    }
  }, [session.role, activeTab]);

  // If user is not authenticated, show Login Screen
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen text-slate-100 flex flex-col font-sans selection:bg-purple-500 selection:text-white relative z-10">
      {/* Cyber Laser Animated Background */}
      <div className="bg-laser-container" aria-hidden="true" />

      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Sidebar Navigation */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={handleSelectTab}
          isOpenMobile={isOpenMobile}
          setIsOpenMobile={setIsOpenMobile}
          onOpenAddModal={openAddModal}
          onOpenThermalModal={openThermalModal}
          onOpenSheetModal={openSheetModal}
          onOpenPasswordModal={openPasswordModal}
          onOpenVaultModal={openVaultModal}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto -webkit-overflow-scrolling-touch">
          {/* Header */}
          <Header
            onToggleMobileMenu={toggleMobileMenu}
            onOpenAddModal={openAddModal}
            onOpenPasswordModal={openPasswordModal}
            onOpenSheetModal={openSheetModal}
            onOpenVaultModal={openVaultModal}
          />

          {/* Instant Active Page Rendering */}
          <main className="flex-1 pb-12 relative">
            {/* Firestore Daily Quota Informative Banner */}
            {isFirestoreQuotaExceeded && (
              <div className="mx-4 sm:mx-6 mt-4 p-3.5 rounded-xl bg-amber-950/60 border border-amber-500/50 text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-amber-100">Firebase Free Daily Quota Exceeded: </span>
                    <span>Firebase daily free reads limit reached. You can use <strong>Google Sheets 2-Way Sync (Google Drive / Unlimited Storage)</strong> to sync live between Vercel and AI Studio with 0 limits!</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('sheets')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1.5 whitespace-nowrap transition cursor-pointer shadow"
                  >
                    <span>⚡ Google Sheets Sync</span>
                  </button>
                  <a
                    href="https://console.firebase.google.com/project/inductive-alliance-96tp2/firestore/databases/ai-studio-updatesbroomieso-fa7b0278-13cd-46d9-bc42-38295233e2c8/data?openUpgradeDialog=true"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-bold text-[11px] flex items-center gap-1.5 whitespace-nowrap transition cursor-pointer"
                  >
                    <span>Firebase Console</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}

            <Suspense fallback={<PageFallback />}>
              {(activeTab === 'dashboard' || activeTab === 'admin') && (
                <AdminDashboard
                  onOpenAddModal={openAddModal}
                  onOpenThermalModal={openThermalModal}
                  onOpenDeliveryModal={handleOpenDeliveryModal}
                  onOpenPasswordModal={openPasswordModal}
                  onOpenSheetModal={openSheetModal}
                  onOpenVaultModal={openVaultModal}
                />
              )}

              {activeTab === 'outlet' && session.role !== 'outlet' && <OutletDashboard />}

              {activeTab === 'delivery' && session.role !== 'outlet' && <DeliveryDashboard />}

              {activeTab === 'analytics' && <AnalyticsPage />}

              {activeTab === 'alerts' && session.role !== 'outlet' && <AlertsPage />}

              {activeTab === 'sheets' && session.role !== 'outlet' && <GoogleSheetsPage onOpenVaultModal={openVaultModal} />}
            </Suspense>
          </main>
        </div>
      </div>

      {/* Global Modals */}
      <AddOrderModal
        isOpen={isAddModalOpen}
        onClose={closeAddModal}
      />

      <ThermalPrintModal
        isOpen={isThermalModalOpen}
        onClose={closeThermalModal}
      />

      <SheetSyncModal
        isOpen={isSheetModalOpen}
        onClose={closeSheetModal}
      />

      <PasswordManagerModal
        isOpen={isPasswordModalOpen}
        onClose={closePasswordModal}
      />

      <LocalStorageVaultModal
        isOpen={isVaultModalOpen}
        onClose={closeVaultModal}
      />
    </div>
  );
}

export default function App() {
  return (
    <OMSProvider>
      <OMSAppContent />
    </OMSProvider>
  );
}
