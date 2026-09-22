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
        <div style={{ minHeight: '100vh', backgroundColor: '#070913', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#f43f5e', marginBottom: 12 }}>Broomies OMS - Load Recovery</div>
          <p style={{ color: '#94a3b8', maxWidth: 400, fontSize: 13, marginBottom: 20 }}>
            An unexpected error occurred while loading. Tap below to clear local cache and reload:
          </p>
          <button
            onClick={() => {
              try { localStorage.clear(); sessionStorage.clear(); } catch {}
              window.location.reload();
            }}
            style={{ backgroundColor: '#a855f7', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            Clear Cache & Reload Dashboard
          </button>
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


