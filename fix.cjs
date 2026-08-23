const fs = require('fs');
let code = fs.readFileSync('src/pages/GoogleSheetsPage.tsx', 'utf8');

const regex = /\}\)\n\s*<button\n\s*className="px-3\.5 py-2\.5 rounded-xl bg-purple-950\/70[\s\S]*?disabled=\{isSyncing\}/;

code = code.replace(regex, `})
          <button
            onClick={handleManualSync}
            disabled={isSyncing}`);

fs.writeFileSync('src/pages/GoogleSheetsPage.tsx', code);
