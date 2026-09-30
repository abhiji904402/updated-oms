import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { collection, query, getDocs, addDoc, updateDoc, doc, deleteDoc, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';
import { isToday, parseISO } from 'date-fns';
export const useStore = create()(persist((set, get) => ({
    orders: [],
    outlets: [
        { id: 'all', name: 'All Outlets' },
        { id: 'mira-road', name: 'Mira Road' },
        { id: 'bhayandar', name: 'Bhayandar' },
        { id: 'dahisar', name: 'Dahisar' },
        { id: 'borivali', name: 'Borivali' }
    ],
    currentRole: 'admin',
    currentOutlet: 'all',
    whatsappConfig: null,
    isLoading: false,
    error: null,
    setRole: (role) => set({ currentRole: role }),
    setOutlet: (outlet) => set({ currentOutlet: outlet }),
    fetchOrders: async () => {
        set({ isLoading: true });
        try {
            const q = query(collection(db, 'orders'), orderBy('created_at', 'desc'), limit(1000));
            const querySnapshot = await getDocs(q);
            const orders = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            set({ orders, isLoading: false });
        }
        catch (error) {
            set({ error: error.message, isLoading: false });
        }
    },
    addOrder: async (orderData) => {
        try {
            const newOrder = {
                ...orderData,
                order_id: Math.floor(1000 + Math.random() * 9000),
                order_number: Math.floor(1000 + Math.random() * 9000),
                status: 'pending',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            // Image stripping to avoid payload limit
            if (newOrder.image && newOrder.image.length > 120000) {
                delete newOrder.image;
            }
            const docRef = await addDoc(collection(db, 'orders'), newOrder);
            const order = { ...newOrder, id: docRef.id };
            set(state => ({
                orders: [order, ...state.orders]
            }));
            // Auto-confirm if enabled
            const config = get().whatsappConfig;
            if (config?.autoConfirmOnCreate) {
                await get().sendWhatsAppNotification(order, 'confirm');
            }
        }
        catch (error) {
            set({ error: error.message });
        }
    },
    updateOrder: async (id, updates) => {
        try {
            const docRef = doc(db, 'orders', id);
            // Image stripping
            const cleanUpdates = { ...updates, updated_at: new Date().toISOString() };
            if (typeof cleanUpdates.image === 'string' && cleanUpdates.image.length > 120000) {
                delete cleanUpdates.image;
            }
            await updateDoc(docRef, cleanUpdates);
            set(state => ({
                orders: state.orders.map(o => o.id === id ? { ...o, ...cleanUpdates } : o)
            }));
        }
        catch (error) {
            set({ error: error.message });
        }
    },
    deleteOrder: async (id) => {
        try {
            await deleteDoc(doc(db, 'orders', id));
            set(state => ({
                orders: state.orders.filter(o => o.id !== id)
            }));
        }
        catch (error) {
            set({ error: error.message });
        }
    },
    getWhatsAppStatus: async () => {
        try {
            const response = await fetch('/api/whatsapp/status');
            const data = await response.json();
            if (data.success) {
                set({ whatsappConfig: {
                        ...(get().whatsappConfig || {
                            id: 'config',
                            templates: {
                                confirm: "Thank you for your order! Order #{order_number}. Items: {items}. Amount: ₹{total_amount}.",
                                dispatch: "Your order #{order_number} is out for delivery with {rider_name}. OTP: {otp}",
                                delivered: "Order #{order_number} delivered! Enjoy your treat.",
                                reminder: "Reminder for order #{order_number}. Balance: ₹{remaining_balance}."
                            },
                            autoConfirmOnCreate: true,
                            autoDispatchOnRider: true,
                            autoDeliveryComplete: true,
                            autoPaymentReminder: false,
                            workingHoursOnly: true,
                            throttleDelaySeconds: 5,
                            antiBanProtection: true
                        }),
                        connected: data.connected,
                        qrCode: data.qrCode,
                        phoneNumber: data.phoneNumber,
                        sessionState: data.sessionState,
                        userName: data.userName
                    } });
            }
        }
        catch (error) {
            console.error('Failed to fetch WhatsApp status:', error);
        }
    },
    logoutWhatsApp: async () => {
        try {
            await fetch('/api/whatsapp/logout', { method: 'POST' });
            await get().getWhatsAppStatus();
        }
        catch (error) {
            console.error('Logout failed:', error);
        }
    },
    sendWhatsAppNotification: async (order, type) => {
        const config = get().whatsappConfig;
        if (!config?.connected)
            return;
        let template = config.templates[type];
        if (!template)
            return;
        // Replace placeholders
        const message = template
            .replace('{order_number}', String(order.order_number))
            .replace('{customer_name}', order.customer_name)
            .replace('{items}', order.items)
            .replace('{total_amount}', String(order.total_amount))
            .replace('{advance_amount}', String(order.advance_amount))
            .replace('{remaining_balance}', String(order.remaining_balance))
            .replace('{otp}', order.otp || '')
            .replace('{rider_name}', order.delivered_by || 'Our delivery partner');
        try {
            await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: order.customer_phone,
                    message
                })
            });
        }
        catch (error) {
            console.error('Failed to send WhatsApp:', error);
        }
    },
    syncWithCloud: async () => {
        await get().fetchOrders();
    },
    getStats: () => {
        const { orders } = get();
        const today = new Date();
        const todayOrders = orders.filter(o => {
            const d = parseISO(o.created_at);
            return isToday(d);
        });
        return {
            total: orders.length,
            pending: orders.filter(o => o.status === 'pending').length,
            delivered: orders.filter(o => o.status === 'delivered').length,
            todayCount: todayOrders.length,
            todayAmount: todayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
        };
    }
}), {
    name: 'broomies-storage',
    storage: createJSONStorage(() => localStorage),
}));
