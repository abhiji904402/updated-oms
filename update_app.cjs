const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

if (!code.includes('KOTPrintPage')) {
    code = code.replace(
        "import { GoogleSheetsPage } from './pages/GoogleSheetsPage';",
        "import { GoogleSheetsPage } from './pages/GoogleSheetsPage';\nimport { KOTPrintPage } from './pages/KOTPrintPage';"
    );
    
    code = code.replace(
        "{activeTab === 'sheets' && session.role !== 'outlet' && <GoogleSheetsPage />}",
        "{activeTab === 'sheets' && session.role !== 'outlet' && <GoogleSheetsPage />}\n              {activeTab === 'kot_print' && <KOTPrintPage />}"
    );
    
    fs.writeFileSync('src/App.tsx', code);
    console.log('App updated');
}
