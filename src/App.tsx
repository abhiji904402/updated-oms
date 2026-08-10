import React, { useState } from 'react';
import { OMSProvider, useOMS } from './lib/store';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginPage } from './components/LoginPage';
import { PasswordManagerModal } from './components/PasswordManagerModal';
import { AdminDashboard } from './pages/AdminDashboard';
import { OutletDashboard } from './pages/OutletDashboard';
import { DeliveryDashboard } from './pages/DeliveryDashboard';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AlertsPage } from './pages/AlertsPage';
import { GoogleSheetsPage } from './pages/GoogleSheetsPage';
import { AddOrderModal } from './components/AddOrderModal';
import { ThermalPrintModal } from './components/ThermalPrintModal';
import { SheetSyncModal } from './components/SheetSyncModal';
import { Order } from './types';

function OMSAppContent() {
  const { session, isAuthenticated } = useOMS();

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isOpenMobile, setIsOpenMobile] = useState<boolean>(false);
  const handleSelectTab = (tab: string) => {
    setActiveTab(tab);
  };

  // Automatically enforce delivery page for rider role
  React.useEffect(() => {
    if (session.role === 'delivery' && activeTab !== 'delivery') {
      setActiveTab('delivery');
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
    <div className="min-h-screen minecraft-stone text-slate-100 flex flex-col font-sans selection:bg-purple-500 selection:text-white">
      <div className="flex-1 flex overflow-hidden">
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
            {(activeTab === 'dashboard' || activeTab === 'admin') && (
              <AdminDashboard
                onOpenAddModal={() => setIsAddModalOpen(true)}
                onOpenThermalModal={() => setIsThermalModalOpen(true)}
                onOpenDeliveryModal={handleOpenDeliveryModal}
                onOpenPasswordModal={() => setIsPasswordModalOpen(true)}
              />
            )}

            {activeTab === 'outlet' && <OutletDashboard />}

            {activeTab === 'delivery' && <DeliveryDashboard />}

            {activeTab === 'analytics' && <AnalyticsPage />}

            {activeTab === 'alerts' && <AlertsPage />}

            {activeTab === 'sheets' && <GoogleSheetsPage />}
          </main>
        </div>
      </div>

      {/* Global Modals */}
      <AddOrderModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      <ThermalPrintModal
        isOpen={isThermalModalOpen}
        onClose={() => setIsThermalModalOpen(false)}
      />

      <SheetSyncModal
        isOpen={isSheetModalOpen}
        onClose={() => setIsSheetModalOpen(false)}
      />

      <PasswordManagerModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
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
