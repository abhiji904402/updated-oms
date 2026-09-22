const fs = require('fs');
let code = fs.readFileSync('src/components/OrderCard.tsx', 'utf-8');

const timerComponent = `
const AutoConfirmTimer: React.FC<{ actualDeliveryTime?: string }> = ({ actualDeliveryTime }) => {
  const [timeLeft, setTimeLeft] = React.useState<string>('30:00');

  React.useEffect(() => {
    if (!actualDeliveryTime) return;
    const deliveryTime = new Date(actualDeliveryTime).getTime();
    
    const update = () => {
      const now = Date.now();
      const diff = Math.max(0, (30 * 60 * 1000) - (now - deliveryTime));
      
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      
      if (diff === 0) {
        setTimeLeft('Auto-confirming...');
      } else {
        setTimeLeft(\`\${mins.toString().padStart(2, '0')}:\${secs.toString().padStart(2, '0')}\`);
      }
    };
    
    update();
    const int = setInterval(update, 1000);
    return () => clearInterval(int);
  }, [actualDeliveryTime]);

  return <span className="text-amber-100 font-mono bg-amber-900/60 px-1.5 py-0.5 rounded border border-amber-500/30 ml-2">Auto in {timeLeft}</span>;
};
`;

if (!code.includes('AutoConfirmTimer')) {
  // Add it before export const OrderCard
  code = code.replace("export const OrderCard:", timerComponent + "\nexport const OrderCard:");
}

// Replace the text in the banner
code = code.replace(
  "<p className=\"text-[10px] text-amber-300/90 font-medium\">Outlet / Admin Confirmation Required</p>",
  "<p className=\"text-[10px] text-amber-300/90 font-medium flex items-center flex-wrap\">\n                        Outlet / Admin Confirmation Required\n                        <AutoConfirmTimer actualDeliveryTime={order.actual_delivery_time} />\n                      </p>"
);

fs.writeFileSync('src/components/OrderCard.tsx', code);
console.log('OrderCard patched with timer');
