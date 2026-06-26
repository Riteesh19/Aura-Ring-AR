const fs = require('fs');
let code = fs.readFileSync('src/utils/calibration.ts', 'utf-8');

// Remove the drawImage block
const drawBlock = `    // Draw camera frame mirroring the feed
    this.ctx.save();
    this.ctx.translate(this.canvasElement.width, 0);
    this.ctx.scale(-1, 1);
    this.ctx.drawImage(results.image, 0, 0, this.canvasElement.width, this.canvasElement.height);
    this.ctx.restore();`;

code = code.replace(drawBlock, '');

fs.writeFileSync('src/utils/calibration.ts', code);
