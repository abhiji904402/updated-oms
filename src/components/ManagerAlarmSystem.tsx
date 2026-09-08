import React, { useEffect, useState, useRef } from 'react';
import { useOMS } from '../lib/store';
import { Order } from '../types';
import { isOrderForToday, getNormalizedDateStr } from '../lib/orderLogic';
import { getTodayDateStr, getCountdownInfo, formatTo12Hour } from '../lib/timeUtils';
import { BellRing, Check } from 'lucide-react';

export const ManagerAlarmSystem: React.FC = () => {
  const { session, orders } = useOMS();
  const [ackedAlarms, setAckedAlarms] = useState<Set<string>>(new Set());
  const [activeAlarmOrder, setActiveAlarmOrder] = useState<Order | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio object once
  useEffect(() => {
    if (!audioRef.current) {
      // A standard repeating beep or alarm sound. Using a generic beep base64 to ensure it works offline.
      const beepSound = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU' + 'A'.repeat(500); 
      // Actually, a real base64 is too long or might not work if corrupted. Let's use an online URL, 
      // but the app is offline-first. Let's use the Web Audio API for a reliable offline beep!
    }
  }, []);

  useEffect(() => {
    if (session.role !== 'manager') {
      setActiveAlarmOrder(null);
      return;
    }

    const checkAlarms = () => {
      // Don't trigger a new one if one is currently ringing
      // If one is ringing, stay on it. Do not let anything interrupt it.
      if (activeAlarmOrder) return;

      const now = new Date();
      const todayStr = getTodayDateStr(now);
      
            const upcomingOrder = orders.find(o => {
        if (o.status === 'delivered' || o.status === 'cancelled' || o.status === 'missed') return false;
        
        const timeStr = o.delivery_time_expected || o.order_time;
        if (!timeStr) return false;
            
        // Ensure it's for today
        if (!isOrderForToday(o, todayStr)) return false;

        // Has it already been acked?
        if (ackedAlarms.has(o.id)) return false;

        const cInfo = getCountdownInfo(o, now.getTime());
        // If it's 30 mins or less away, and not super old (e.g., past 2 hours)
        if (cInfo.minutesRemaining <= 30 && cInfo.minutesRemaining >= -120) {
          return true;
        }
        return false;
      });

      if (upcomingOrder) {
        setActiveAlarmOrder(upcomingOrder);
      }
    };

    const interval = setInterval(checkAlarms, 10000); // check every 10 secs
    checkAlarms(); // initial check

    return () => clearInterval(interval);
  }, [orders, session.role, activeAlarmOrder, ackedAlarms]);

  return (
    <>
      {activeAlarmOrder && (
        <AlarmModal 
          order={activeAlarmOrder} 
          onAcknowledge={() => {
            setAckedAlarms(prev => {
              const next = new Set(prev);
              next.add(activeAlarmOrder.id);
              return next;
            });
            setActiveAlarmOrder(null);
          }} 
        />
      )}
    </>
  );
};

const AlarmModal: React.FC<{ order: Order, onAcknowledge: () => void }> = ({ order, onAcknowledge }) => {
      // Web Audio API for synthetic continuous beep
  useEffect(() => {
    let audioCtx: AudioContext;
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.error('AudioContext not supported', e);
      return;
    }
    
    let intervalId: any;

    const playBeep = () => {
      try {
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(1.0, audioCtx.currentTime + 0.05); // High volume
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
      } catch (err) {
        console.error('Error playing beep', err);
      }
    };

    // Play a sequence of 3 quick beeps every 1.5 seconds endlessly until closed
    const playAlarmSequence = () => {
      playBeep();
      setTimeout(playBeep, 200);
      setTimeout(playBeep, 400);
    };

    intervalId = setInterval(playAlarmSequence, 1500);
    playAlarmSequence();

    return () => {
      clearInterval(intervalId);
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
      <div className="bg-rose-950 border-2 border-rose-500 rounded-2xl w-full max-w-sm shadow-2xl shadow-rose-900/50 overflow-hidden text-center p-6 space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center animate-pulse">
            <BellRing className="w-10 h-10 text-rose-400 animate-bounce" />
          </div>
        </div>
        
        <div>
          <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-wide">
            Delivery Reminder
          </h2>
          <p className="text-rose-200 font-medium">
            Order <strong className="text-white">#{order.order_number}</strong> is scheduled for <strong className="text-white">{formatTo12Hour(order.delivery_time_expected || order.order_time || '')}</strong>.
          </p>
          <p className="text-xs text-rose-300/80 mt-2">
            Please assign a rider or confirm status.
          </p>
        </div>

        <button
          onClick={onAcknowledge}
          className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-wider shadow-lg shadow-rose-900/50 flex items-center justify-center gap-2 transition active:scale-95"
        >
          <Check className="w-5 h-5" />
          OK, UNDERSTOOD
        </button>
      </div>
    </div>
  );
};
