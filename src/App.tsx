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
  const { session, isAuthenticated } = useOMS();

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
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto -webkit-overflow-scrolling-touch">
          {/* Header */}
          <Header
            onToggleMobileMenu={toggleMobileMenu}
            onOpenAddModal={openAddModal}
            onOpenPasswordModal={openPasswordModal}
            onOpenSheetModal={openSheetModal}
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
