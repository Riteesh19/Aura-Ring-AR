const fs = require('fs');
let code = fs.readFileSync('src/utils/calibration.ts', 'utf-8');

const onResultsCode = `
      this.renderer.setSize(videoWidth, videoHeight, false);
      const rect = this.videoElement.getBoundingClientRect();
      this.threeCanvas.style.width = rect.width + 'px';
      this.threeCanvas.style.height = rect.height + 'px';
`;

code = code.replace(/this\.renderer\.setSize\(videoWidth, videoHeight, false\);\nthis\.threeCanvas\.style\.width = videoWidth \+ 'px';\nthis\.threeCanvas\.style\.height = videoHeight \+ 'px'; \/\/ false prevents inline style override/, onResultsCode);

fs.writeFileSync('src/utils/calibration.ts', code);
