const fs = require('fs');
let code = fs.readFileSync('src/components/AR/ARTryOnWorkspace.ts', 'utf-8');

// Remove onloadedmetadata block
code = code.replace(/video\.onloadedmetadata = \(\) => {[\s\S]*?};/, '');

fs.writeFileSync('src/components/AR/ARTryOnWorkspace.ts', code);
