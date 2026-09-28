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
import { Order } from './types';

import { OutletDashboard } from './pages/OutletDashboard';
import { DeliveryDashboard } from './pages/DeliveryDashboard';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AlertsPage } from './pages/AlertsPage';
import { ManagerAlarmSystem } from './components/ManagerAlarmSystem';
import { ConfirmDeliveryModal } from './components/ConfirmDeliveryModal';
import { GoogleSheetsPage } from './pages/GoogleSheetsPage';
import { KOTPrintPage } from './pages/KOTPrintPage';
import { WhatsAppAutomationPage } from './pages/WhatsAppAutomationPage';

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
  const { session, isAuthenticated, isInitialLoading, loadingProgress, loadingMessage } = useOMS();

  if (isInitialLoading) {
    return (
      <div className="fixed inset-0 bg-[#0b0f19] text-white flex flex-col items-center justify-center p-6 z-50 font-sans">
        <div className="bg-[#121524] border border-indigo-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl backdrop-blur-xl text-center space-y-6">
          <div className="w-16 h-16 bg-purple-600/20 border-2 border-purple-500 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
            <div className="w-8 h-8 border-3 border-purple-400 border-t-transparent rounded-full animate-spin" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-white">Loading Broomies OMS</h2>
            <p className="text-xs text-slate-400 font-medium">{loadingMessage || 'Fetching live order data from server...'}</p>
          </div>

          {/* Progress Bar & Percentage */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-mono font-bold">
              <span className="text-purple-400">Loading Process</span>
              <span className="text-emerald-400 text-sm">{loadingProgress}%</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden p-0.5 border border-slate-800">
              <div
                className="bg-gradient-to-r from-purple-600 to-indigo-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.max(5, Math.min(100, loadingProgress))}%` }}
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-500 italic">
            Connecting securely to live database & syncing records...
          </div>
        </div>
      </div>
    );
  }

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

  const openAddModal = useCallback(() => setIsAddModalOpen(true), []);
  const closeAddModal = useCallback(() => setIsAddModalOpen(false), []);

  const openThermalModal = useCallback(() => setIsThermalModalOpen(true), []);
  const closeThermalModal = useCallback(() => setIsThermalModalOpen(false), []);

  const openSheetModal = useCallback(() => setIsSheetModalOpen(true), []);
  const closeSheetModal = useCallback(() => setIsSheetModalOpen(false), []);

  const openPasswordModal = useCallback(() => setIsPasswordModalOpen(true), []);
  const closePasswordModal = useCallback(() => setIsPasswordModalOpen(false), []);


  const toggleMobileMenu = useCallback(() => setIsOpenMobile((prev) => !prev), []);

  const handleOpenDeliveryModal = useCallback((_order: Order) => {
    setActiveTab('delivery');
  }, []);

  // Automatically enforce delivery page for rider role and restricted tabs for outlet role
  React.useEffect(() => {
    if (session.role === 'delivery' && activeTab !== 'delivery') {
      setActiveTab('delivery');
    } else if ((session.role === 'outlet' || session.role === 'manager') && activeTab !== 'dashboard' && activeTab !== 'outlet' && activeTab !== 'analytics' && activeTab !== 'kot_print') {
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
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto -webkit-overflow-scrolling-touch">
          {/* Header */}
          <Header
            onToggleMobileMenu={toggleMobileMenu}
            onOpenAddModal={openAddModal}
            onOpenPasswordModal={openPasswordModal}
          />

          {/* Instant Active Page Rendering */}
          <main className="flex-1 pb-12 relative">
            <Suspense fallback={<PageFallback />}>
              {(activeTab === 'dashboard' || activeTab === 'admin') && (
                <AdminDashboard
                  onOpenAddModal={openAddModal}
                  onOpenThermalModal={openThermalModal}
                  onOpenDeliveryModal={handleOpenDeliveryModal}
                  onOpenPasswordModal={openPasswordModal}
                  onOpenSheetModal={openSheetModal}
                />
              )}

              {activeTab === 'outlet' && session.role !== 'outlet' && <OutletDashboard />}

              {activeTab === 'delivery' && session.role !== 'outlet' && <DeliveryDashboard />}

              {activeTab === 'analytics' && <AnalyticsPage />}

              {activeTab === 'alerts' && session.role !== 'outlet' && <AlertsPage />}
              {activeTab === 'sheets' && session.role !== 'outlet' && <GoogleSheetsPage />}
              {activeTab === 'kot_print' && <KOTPrintPage />}
              {activeTab === 'whatsapp' && <WhatsAppAutomationPage />}

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

      <ManagerAlarmSystem />
      <ConfirmDeliveryModal />
      <PasswordManagerModal
        isOpen={isPasswordModalOpen}
        onClose={closePasswordModal}
      />

    </div>
  );
}

import { VersionUpdatePopup } from './lib/versionManager';

export default function App() {
  return (
    <OMSProvider>
      <OMSAppContent />
      <VersionUpdatePopup />
    </OMSProvider>
  );
}
