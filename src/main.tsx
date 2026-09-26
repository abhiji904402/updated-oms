import React, { StrictMode, Component } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Declare global variable for early beforeinstallprompt capture
declare global {
  interface Window {
    deferredPwaPrompt?: any;
  }
}

// Capture beforeinstallprompt event as early as possible for Chrome PWA Installability
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredPwaPrompt = e;
  console.log('✅ PWA beforeinstallprompt event captured successfully!');
});

// Unregister any stale Service Worker in development to prevent cached asset conflicts
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  }).catch(() => {});
}

interface RootErrorBoundaryProps {
  children: React.ReactNode;
}

interface RootErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  public override state: RootErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: any): RootErrorBoundaryState {
    return { hasError: true, error };
  }
  override componentDidCatch(error: any, errorInfo: any) {
    console.error('RootErrorBoundary caught error:', error, errorInfo);
  }
  override render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', backgroundColor: '#070913', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 16 }}>
            🛡️
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', marginBottom: 8 }}>Broomies OMS - Emergency Shield</div>
          <p style={{ color: '#cbd5e1', maxWidth: 460, fontSize: 14, lineHeight: 1.5, marginBottom: 8 }}>
            Dashboard me ek unexpected error pakda gaya hai. Aapki data safe hai.
          </p>
          <p style={{ color: '#94a3b8', maxWidth: 460, fontSize: 12, lineHeight: 1.4, marginBottom: 24 }}>
            (An unexpected error was caught safely. Choose an action below to restore operations immediately.)
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', maxWidth: 440 }}>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{ backgroundColor: '#a855f7', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              🔄 Refresh & Retry (Try Again)
            </button>
            <button
              onClick={() => {
                try {
                  localStorage.removeItem('broomies_oms_orders_v7');
                  sessionStorage.clear();
                } catch {}
                window.location.reload();
              }}
              style={{ backgroundColor: '#1e293b', color: '#cbd5e1', border: '1px solid #334155', padding: '12px 20px', borderRadius: 12, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
            >
              🧹 Clear Storage Cache
            </button>
          </div>
          {this.state.error && (
            <div style={{ marginTop: 24, maxWidth: 500, padding: 12, borderRadius: 8, backgroundColor: '#0f172a', border: '1px solid #1e293b', color: '#ef4444', fontSize: 11, textAlign: 'left', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              Error: {String(this.state.error?.message || this.state.error)}
            </div>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </StrictMode>,
  );
}


