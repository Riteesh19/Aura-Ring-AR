const fs = require('fs');
let code = fs.readFileSync('src/utils/calibration.ts', 'utf-8');

code = code.replace(/const threeX = bandMidpoint.x - \(videoW \/ 2\);/, "const threeX = bandMidpoint.x - (videoW / 2);");
code = code.replace(/const threeY = bandMidpoint.y - \(videoH \/ 2\);/, "const threeY = (videoH / 2) - bandMidpoint.y;");
code = code.replace(/this\.renderer\.setSize\(videoWidth, videoHeight, true\);/, "this.renderer.setSize(videoWidth, videoHeight, false);\nthis.threeCanvas.style.width = '100%';\nthis.threeCanvas.style.height = '100%';");

fs.writeFileSync('src/utils/calibration.ts', code);
