import React, { useState, Suspense, lazy } from 'react';
import { OMSProvider, useOMS } from './lib/store';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginPage } from './components/LoginPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { AddOrderModal } from './components/AddOrderModal';
import { Order } from './types';

// Lazy-loaded secondary pages & modals for maximum initial load performance
const OutletDashboard = lazy(() => import('./pages/OutletDashboard').then(m => ({ default: m.OutletDashboard })));
const DeliveryDashboard = lazy(() => import('./pages/DeliveryDashboard').then(m => ({ default: m.DeliveryDashboard })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const AlertsPage = lazy(() => import('./pages/AlertsPage').then(m => ({ default: m.AlertsPage })));
const GoogleSheetsPage = lazy(() => import('./pages/GoogleSheetsPage').then(m => ({ default: m.GoogleSheetsPage })));

const PasswordManagerModal = lazy(() => import('./components/PasswordManagerModal').then(m => ({ default: m.PasswordManagerModal })));
const ThermalPrintModal = lazy(() => import('./components/ThermalPrintModal').then(m => ({ default: m.ThermalPrintModal })));
const SheetSyncModal = lazy(() => import('./components/SheetSyncModal').then(m => ({ default: m.SheetSyncModal })));

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
  const handleSelectTab = (tab: string) => {
    setActiveTab(tab);
  };

  // Automatically enforce delivery page for rider role and restricted tabs for outlet role
  React.useEffect(() => {
    if (session.role === 'delivery' && activeTab !== 'delivery') {
      setActiveTab('delivery');
    } else if (session.role === 'outlet' && activeTab !== 'dashboard' && activeTab !== 'outlet' && activeTab !== 'analytics') {
      setActiveTab('dashboard');
    }
  }, [session.role, activeTab]);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isThermalModalOpen, setIsThermalModalOpen] = useState(false);
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const handleOpenDeliveryModal = (order: Order) => {
    handleSelectTab('delivery');
  };

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
          onOpenAddModal={() => setIsAddModalOpen(true)}
          onOpenThermalModal={() => setIsThermalModalOpen(true)}
          onOpenSheetModal={() => setIsSheetModalOpen(true)}
          onOpenPasswordModal={() => setIsPasswordModalOpen(true)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto -webkit-overflow-scrolling-touch">
          {/* Header */}
          <Header
            onToggleMobileMenu={() => setIsOpenMobile(!isOpenMobile)}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onOpenPasswordModal={() => setIsPasswordModalOpen(true)}
            onOpenSheetModal={() => setIsSheetModalOpen(true)}
          />

          {/* Instant Active Page Rendering */}
          <main className="flex-1 pb-12 relative">
            <Suspense fallback={<PageFallback />}>
              {(activeTab === 'dashboard' || activeTab === 'admin') && (
                <AdminDashboard
                  onOpenAddModal={() => setIsAddModalOpen(true)}
                  onOpenThermalModal={() => setIsThermalModalOpen(true)}
                  onOpenDeliveryModal={handleOpenDeliveryModal}
                  onOpenPasswordModal={() => setIsPasswordModalOpen(true)}
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
        onClose={() => setIsAddModalOpen(false)}
      />

      {isThermalModalOpen && (
        <Suspense fallback={null}>
          <ThermalPrintModal
            isOpen={isThermalModalOpen}
            onClose={() => setIsThermalModalOpen(false)}
          />
        </Suspense>
      )}

      {isSheetModalOpen && (
        <Suspense fallback={null}>
          <SheetSyncModal
            isOpen={isSheetModalOpen}
            onClose={() => setIsSheetModalOpen(false)}
          />
        </Suspense>
      )}

      {isPasswordModalOpen && (
        <Suspense fallback={null}>
          <PasswordManagerModal
            isOpen={isPasswordModalOpen}
            onClose={() => setIsPasswordModalOpen(false)}
          />
        </Suspense>
      )}
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
