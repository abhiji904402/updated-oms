import React, { useEffect, useState } from 'react';

// Configuration for polling intervals
const POLLING_INTERVAL_MS = 15000; // Check every 15 seconds

/**
 * Hook to monitor application version from the backend.
 * It will set an internal state when a new version is detected.
 */
export function useAppVersion() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let currentVersion: number | null = null;
    let intervalId: any;

    const checkVersion = async () => {
      try {
        const res = await fetch('/api/version');
        if (!res.ok) return;
        const data = await res.json();
        
        if (currentVersion === null) {
          // Initial load: save the current version
          currentVersion = data.version;
        } else if (currentVersion !== data.version) {
          // Version has changed (app was republished/restarted)
          setUpdateAvailable(true);
          if (intervalId) clearInterval(intervalId); // Stop polling once update is found
        }
      } catch (err) {
        // Silently ignore network errors during polling
      }
    };

    // Delay initial check slightly to allow normal app startup
    const initialTimeout = setTimeout(() => {
      checkVersion();
      intervalId = setInterval(checkVersion, POLLING_INTERVAL_MS);
    }, 2000);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return { updateAvailable };
}

/**
 * UI Component that displays a beautiful overlay popup
 * when a new version is available.
 */
export const VersionUpdatePopup: React.FC = () => {
  const { updateAvailable } = useAppVersion();

  if (!updateAvailable) return null;

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-[#0b0e1e] border border-emerald-500/50 rounded-2xl p-6 shadow-[0_0_50px_-12px_rgba(16,185,129,0.3)] max-w-sm w-full text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-emerald-300"></div>
        
        <div className="w-16 h-16 bg-emerald-950/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
          <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
        </div>
        
        <h3 className="text-xl font-bold text-slate-100 mb-2">Live Update Available</h3>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          The developer just published a new update. Please refresh your screen to apply the latest features and ensure real-time data syncs perfectly.
        </p>
        
        <button
          onClick={handleRefresh}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2"
        >
          <span>Refresh Now</span>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>
  );
};
