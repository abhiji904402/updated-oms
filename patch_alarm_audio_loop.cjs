const fs = require('fs');
let code = fs.readFileSync('src/components/ManagerAlarmSystem.tsx', 'utf-8');

// Increase volume and ensure it loops infinitely until acknowledged
const audioLogic = `  // Web Audio API for synthetic continuous beep
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
  }, []);`;

code = code.replace(
  /\/\/ Web Audio API for synthetic continuous beep\n  useEffect\(\(\) => \{[^]*?  \}, \[\]\);/,
  audioLogic
);

fs.writeFileSync('src/components/ManagerAlarmSystem.tsx', code);
console.log('Audio logic patched for infinite looping until ack');
