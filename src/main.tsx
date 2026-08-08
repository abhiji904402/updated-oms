import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
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

// Register Service Worker for PWA Chrome Installability
if ('serviceWorker' in navigator) {
  const registerSW = () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('✅ PWA ServiceWorker registered successfully with scope:', reg.scope);
      })
      .catch((err) => {
        console.error('❌ ServiceWorker registration failed:', err);
      });
  };

  if (document.readyState === 'complete') {
    registerSW();
  } else {
    window.addEventListener('load', registerSW);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


