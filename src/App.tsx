import React, { useState } from 'react';
import { OMSProvider } from './lib/store';
import { Header } from './components/Header';
import { AdminDashboard } from './pages/AdminDashboard';
import { OutletDashboard } from './pages/OutletDashboard';
import { DeliveryDashboard } from './pages/DeliveryDashboard';
import { ReportsPage } from './pages/ReportsPage';
import { WhatsAppAutomationPage } from './pages/WhatsAppAutomationPage';
import { AddOrderModal } from './components/AddOrderModal';
import { ViewOrderModal } from './components/ViewOrderModal';
import { EditOrderModal } from './components/EditOrderModal';
import { Order } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('admin');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  return (
    <OMSProvider>
      <div className="min-h-screen bg-[#0b0e1b] text-slate-100 flex flex-col">
        {/* Navigation Header */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenAddModal={() => setIsAddModalOpen(true)}
        />

        {/* Main Workspace Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
          {activeTab === 'admin' && (
            <AdminDashboard
              onViewOrder={(order) => setViewingOrder(order)}
              onEditOrder={(order) => setEditingOrder(order)}
              onOpenAddModal={() => setIsAddModalOpen(true)}
            />
          )}

          {activeTab === 'outlet' && (
            <OutletDashboard
              onViewOrder={(order) => setViewingOrder(order)}
              onEditOrder={(order) => setEditingOrder(order)}
              onOpenAddModal={() => setIsAddModalOpen(true)}
            />
          )}

          {activeTab === 'delivery' && (
            <DeliveryDashboard
              onViewOrder={(order) => setViewingOrder(order)}
              onEditOrder={(order) => setEditingOrder(order)}
            />
          )}

          {activeTab === 'reports' && <ReportsPage />}

          {activeTab === 'whatsapp' && <WhatsAppAutomationPage />}
        </main>

        {/* Modals */}
        <AddOrderModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
        />

        <ViewOrderModal
          order={viewingOrder}
          isOpen={Boolean(viewingOrder)}
          onClose={() => setViewingOrder(null)}
          onEdit={(ord) => {
            setViewingOrder(null);
            setEditingOrder(ord);
          }}
        />

        <EditOrderModal
          order={editingOrder}
          isOpen={Boolean(editingOrder)}
          onClose={() => setEditingOrder(null)}
        />
      </div>
    </OMSProvider>
  );
};

export default App;
