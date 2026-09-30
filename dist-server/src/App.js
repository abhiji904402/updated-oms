import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './lib/store';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import AdminDashboard from './pages/AdminDashboard';
import OutletDashboard from './pages/OutletDashboard';
import DeliveryDashboard from './pages/DeliveryDashboard';
import WhatsAppAutomationPage from './pages/WhatsAppAutomationPage';
import LoginPage from './components/LoginPage';
function App() {
    const { currentRole, getWhatsAppStatus, fetchOrders } = useStore();
    const [isAuth, setIsAuth] = useState(false);
    useEffect(() => {
        // Poll WhatsApp status every 10 seconds
        getWhatsAppStatus();
        fetchOrders();
        const interval = setInterval(getWhatsAppStatus, 10000);
        return () => clearInterval(interval);
    }, []);
    if (!isAuth && window.location.pathname !== '/login') {
        return _jsx(LoginPage, { onLogin: () => setIsAuth(true) });
    }
    return (_jsx(Router, { children: _jsxs("div", { className: "flex h-screen bg-slate-50 overflow-hidden", children: [_jsx(Sidebar, {}), _jsxs("div", { className: "flex-1 flex flex-col min-w-0 overflow-hidden", children: [_jsx(Header, {}), _jsx("main", { className: "flex-1 overflow-y-auto p-4 md:p-6 lg:p-8", children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: `/${currentRole}`, replace: true }) }), _jsx(Route, { path: "/admin", element: currentRole === 'admin' ? _jsx(AdminDashboard, {}) : _jsx(Navigate, { to: "/" }) }), _jsx(Route, { path: "/outlet", element: currentRole === 'outlet' ? _jsx(OutletDashboard, {}) : _jsx(Navigate, { to: "/" }) }), _jsx(Route, { path: "/delivery", element: currentRole === 'delivery' ? _jsx(DeliveryDashboard, {}) : _jsx(Navigate, { to: "/" }) }), _jsx(Route, { path: "/whatsapp", element: _jsx(WhatsAppAutomationPage, {}) }), _jsx(Route, { path: "/login", element: _jsx(LoginPage, { onLogin: () => setIsAuth(true) }) })] }) })] })] }) }));
}
export default App;
