import { HandCalibrator } from '../utils/calibration';

export function renderTestView(container: HTMLElement) {
  container.innerHTML = `
    <div style="max-width: 1000px; margin: 0 auto; width: 100%;">
      <h2>Test Harness</h2>
      <button id="btn-run-test" class="btn btn-primary">Run Test on Image</button>
      <div class="camera-container" style="position: relative; border-radius: var(--border-radius-md); overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.8); width: 100%; max-width: 800px; background: #000; margin-top: 20px;">
        <img id="test-image" src="/test_hand.png" style="width: 100%; display: block;" crossorigin="anonymous" />
        <canvas id="ar-output-canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></canvas>
        <canvas id="three-canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></canvas>
      </div>
    </div>
  `;

  document.getElementById('btn-run-test')?.addEventListener('click', async () => {
    const image = document.getElementById('test-image') as HTMLImageElement;
    const canvas = document.getElementById('ar-output-canvas') as HTMLCanvasElement;
    const threeCanvas = document.getElementById('three-canvas') as HTMLCanvasElement;

    // Load image fully
    if (!image.complete) {
        await new Promise((resolve) => { image.onload = resolve; });
    }

    const { appState } = await import('../state/store');
    appState.lockedSizeResult = {
        sizeSystem: 'US',
        ringSize: '9',
        physicalWidthMm: 19.0
    };
    appState.targetFinger = 'index';

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = image.naturalWidth;
    tempCanvas.height = image.naturalHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx?.drawImage(image, 0, 0);

    const calibrator = new HandCalibrator(tempCanvas as any, canvas, threeCanvas);
    calibrator.isTryOnMode = true;

    console.log('TestView: initializing calibrator, isTryOnMode =', calibrator.isTryOnMode);
    await calibrator.initialize();
    calibrator.rebuildRing();
    console.log('TestView: calling testWithImage');
    await calibrator.testWithImage(image);
    console.log('TestView: testWithImage done.');
    
    setTimeout(() => {
        if ((window as any).takeTestScreenshot) {
            (window as any).takeTestScreenshot();
        }
    }, 2000);
  });
}
