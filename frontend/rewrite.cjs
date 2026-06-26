const fs = require('fs');

let code = fs.readFileSync('src/utils/calibration.ts', 'utf-8');

// I'll just write the exact function to replace testWithImage and onResults using string slicing
const startIdx = code.indexOf('public async testWithImage');
const endIdx = code.indexOf('public onResults', startIdx);
const testWithImageCode = `public async testWithImage(image: HTMLImageElement): Promise<void> {
    this.videoElement = image;
    const videoWidth = image.naturalWidth;
    const videoHeight = image.naturalHeight;

    this.threeCanvas.width = videoWidth;
    this.threeCanvas.height = videoHeight;
    this.canvasElement.width = videoWidth;
    this.canvasElement.height = videoHeight;
    
    this.renderer.setSize(videoWidth, videoHeight, false);
    
    const rect = this.videoElement.getBoundingClientRect();
    this.threeCanvas.style.width = rect.width + 'px';
    this.threeCanvas.style.height = rect.height + 'px';
    
    this.camera3D.aspect = videoWidth / videoHeight;
    this.camera3D.position.z = (videoHeight / 2) / Math.tan((45 / 2) * Math.PI / 180);
    this.camera3D.updateProjectionMatrix();

    await this.hands.send({ image: image });
  }

  `;

code = code.substring(0, startIdx) + testWithImageCode + code.substring(endIdx);

fs.writeFileSync('src/utils/calibration.ts', code);
