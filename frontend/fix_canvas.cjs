const fs = require('fs');
let code = fs.readFileSync('src/utils/calibration.ts', 'utf-8');

code = code.replace(/this\.threeCanvas\.style\.width = '100%';/, "this.threeCanvas.style.width = videoWidth + 'px';");
code = code.replace(/this\.threeCanvas\.style\.height = '100%';/, "this.threeCanvas.style.height = videoHeight + 'px';");

code = code.replace(/this\.ringGroup\.visible = false;/, "// this.ringGroup.visible = false;");

fs.writeFileSync('src/utils/calibration.ts', code);
