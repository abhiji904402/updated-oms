import React, { useState, useCallback, Suspense } from 'react';
import { OMSProvider, useOMS } from './lib/store';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginPage } from './components/LoginPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { OutletDashboard } from './pages/OutletDashboard';
import { DeliveryDashboard } from './pages/DeliveryDashboard';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AlertsPage } from './pages/AlertsPage';
import { GoogleSheetsPage } from './pages/GoogleSheetsPage';
import { KOTPrintPage } from './pages/KOTPrintPage';
import { WhatsAppAutomationPage } from './pages/WhatsAppAutomationPage';
import { AddOrderModal } from './components/AddOrderModal';
import { ViewOrderModal } from './components/ViewOrderModal';
import { EditOrderModal } from './components/EditOrderModal';
import { WhatsAppPopup } from './components/WhatsAppPopup';
import { SheetSyncModal } from './components/SheetSyncModal';
import { PasswordManagerModal } from './components/PasswordManagerModal';
import { ThermalPrintModal } from './components/ThermalPrintModal';
import { ManagerAlarmSystem } from './components/ManagerAlarmSystem';
import { ConfirmDeliveryModal } from './components/ConfirmDeliveryModal';
import { SafeErrorBoundary } from './components/SafeErrorBoundary';
import { VersionUpdatePopup } from './lib/versionManager';
import { printThermalReceipts } from './lib/thermalPrint';
import { Order } from './types';

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
  const { session, isAuthenticated, orders } = useOMS();

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
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [whatsAppOrder, setWhatsAppOrder] = useState<Order | null>(null);

  const liveViewingOrder = React.useMemo(() => {
    if (!viewingOrder) return null;
    return orders.find((o) => o.id === viewingOrder.id || (viewingOrder.order_number && o.order_number === viewingOrder.order_number)) || viewingOrder;
  }, [viewingOrder, orders]);

  const liveEditingOrder = React.useMemo(() => {
    if (!editingOrder) return null;
    return orders.find((o) => o.id === editingOrder.id || (editingOrder.order_number && o.order_number === editingOrder.order_number)) || editingOrder;
  }, [editingOrder, orders]);

  const liveWhatsAppOrder = React.useMemo(() => {
    if (!whatsAppOrder) return null;
    return orders.find((o) => o.id === whatsAppOrder.id || (whatsAppOrder.order_number && o.order_number === whatsAppOrder.order_number)) || whatsAppOrder;
  }, [whatsAppOrder, orders]);

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

  const handleViewOrder = useCallback((ord: Order) => setViewingOrder(ord), []);
  const handleEditOrder = useCallback((ord: Order) => setEditingOrder(ord), []);
  const handleWhatsAppOrder = useCallback((ord: Order) => setWhatsAppOrder(ord), []);

  // Automatically enforce delivery page for rider role and restricted tabs for outlet role
  React.useEffect(() => {
    if (session.role === 'delivery' && activeTab !== 'delivery') {
      setActiveTab('delivery');
    } else if (
      (session.role === 'outlet' || session.role === 'manager') &&
      activeTab !== 'dashboard' &&
      activeTab !== 'admin' &&
      activeTab !== 'outlet' &&
      activeTab !== 'analytics' &&
      activeTab !== 'kot_print'
    ) {
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
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Header */}
          <Header
            activeTab={activeTab}
            setActiveTab={handleSelectTab}
            onToggleMobileMenu={toggleMobileMenu}
            onOpenAddModal={openAddModal}
            onOpenPasswordModal={openPasswordModal}
          />

          {/* Instant Active Page Rendering */}
          <main className="flex-1 pb-12 relative">
            <SafeErrorBoundary fallbackTitle="Dashboard Module Shield">
              <Suspense fallback={<PageFallback />}>
                {(activeTab === 'dashboard' || activeTab === 'admin') && (
                  <AdminDashboard
                    onViewOrder={handleViewOrder}
                    onEditOrder={handleEditOrder}
                    onWhatsAppOrder={handleWhatsAppOrder}
                    onOpenAddModal={openAddModal}
                    onOpenThermalModal={openThermalModal}
                    onOpenDeliveryModal={handleOpenDeliveryModal}
                    onOpenPasswordModal={openPasswordModal}
                    onOpenSheetModal={openSheetModal}
                  />
                )}

                {activeTab === 'outlet' && session.role !== 'outlet' && (
                  <OutletDashboard
                    onViewOrder={handleViewOrder}
                    onEditOrder={handleEditOrder}
                    onWhatsAppOrder={handleWhatsAppOrder}
                    onOpenAddModal={openAddModal}
                    onOpenThermalModal={openThermalModal}
                  />
                )}

                {activeTab === 'delivery' && session.role !== 'outlet' && (
                  <DeliveryDashboard
                    onViewOrder={handleViewOrder}
                    onEditOrder={handleEditOrder}
                    onWhatsAppOrder={handleWhatsAppOrder}
                  />
                )}

                {(activeTab === 'analytics' || activeTab === 'reports') && <AnalyticsPage />}

                {activeTab === 'alerts' && session.role !== 'outlet' && <AlertsPage />}
                {activeTab === 'sheets' && session.role !== 'outlet' && <GoogleSheetsPage />}
                {activeTab === 'kot_print' && <KOTPrintPage />}
                {activeTab === 'whatsapp' && <WhatsAppAutomationPage />}
              </Suspense>
            </SafeErrorBoundary>
          </main>
        </div>
      </div>

      {/* Global Modals */}
      <AddOrderModal
        isOpen={isAddModalOpen}
        onClose={closeAddModal}
      />

      <ViewOrderModal
        order={liveViewingOrder}
        isOpen={Boolean(liveViewingOrder)}
        onClose={() => setViewingOrder(null)}
        onEdit={(ord) => {
          setViewingOrder(null);
          setEditingOrder(ord);
        }}
        onPrintThermal={(ord) => printThermalReceipts([ord])}
      />

      <EditOrderModal
        order={liveEditingOrder}
        isOpen={Boolean(liveEditingOrder)}
        onClose={() => setEditingOrder(null)}
      />

      <WhatsAppPopup
        order={liveWhatsAppOrder}
        onClose={() => setWhatsAppOrder(null)}
        onOpenQRScanner={() => {
          setWhatsAppOrder(null);
          setActiveTab('whatsapp');
        }}
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

export const App: React.FC = () => {
  return (
    <OMSProvider>
      <OMSAppContent />
      <VersionUpdatePopup />
    </OMSProvider>
  );
};

export default App;
