import { appState } from '../../state/store';
import { HandCalibrator } from '../../utils/calibration';



let calibrator: HandCalibrator | null = null;
let localStream: MediaStream | null = null;

let sizingProgress = 0;

export function renderARWorkspace(container: HTMLElement) {
  container.innerHTML = `
    <div class="glass-panel ar-workspace" style="position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80vh; background: #000; padding: 20px;">
      
      <!-- FSM Header UI -->
      <div id="fsm-header" style="text-align: center; margin-bottom: 1.5rem; font-family: 'Outfit', sans-serif;">
        <h2 id="fsm-title" style="color: var(--accent-gold); margin: 0; font-size: 1.8rem; letter-spacing: 2px; font-weight: 300;">Smart Calibration</h2>
        <p id="fsm-subtitle" style="color: rgba(255,255,255,0.6); font-size: 0.85rem; margin: 5px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Align a standard credit card to set scale.</p>
      </div>

      <!-- RARE CARAT AR HUD (Hidden until TRY_ON) -->
      <div id="ring-configurator" style="display: none; position: absolute; inset: 0; z-index: 100; pointer-events: none; flex-direction: column;">
        
        <!-- TOP HUD -->
        <div class="absolute top-4 left-4 right-4 z-50 pointer-events-none flex flex-col items-center">
          
          <!-- 1. CURRENTLY WEARING CARD (With Live Images) -->
          <div class="bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-2xl border border-white/40 pointer-events-auto flex items-center space-x-3 mb-3 animate-fade-in-down">
            <!-- Diamond Image -->
            <div class="w-12 h-12 bg-gray-100 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
              <img id="hud-diamond-img" src="" alt="Diamond" class="w-full h-full object-cover" style="display: none;" />
            </div>
            <!-- Setting Image -->
            <div class="w-12 h-12 bg-gray-100 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0 -ml-4 relative z-10 shadow-sm">
              <img id="hud-setting-img" src="" alt="Setting" class="w-full h-full object-cover" style="display: none;" />
            </div>
            
            <!-- Text Summary -->
            <div class="pl-2">
              <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-tight">Currently Wearing</p>
              <p id="hud-cart-text1" class="text-sm font-extrabold text-slate-900 leading-tight">Select Diamond</p>
              <p id="hud-cart-text2" class="text-xs font-semibold text-slate-600 leading-tight">Select Setting</p>
            </div>
          </div>

          <!-- 2. TARGET FINGER CONTROLS (Preserved) -->
          <div class="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-white/40 pointer-events-auto flex items-center space-x-3">
            <label for="config-finger" class="text-xs font-bold text-slate-700 uppercase tracking-wider">Target Finger</label>
            <select id="config-finger" class="bg-slate-100 text-slate-900 text-sm font-bold rounded-full px-3 py-1 outline-none border border-slate-200 hover:border-slate-400 transition-colors cursor-pointer">
              <option value="index">Index Finger</option>
              <option value="middle">Middle Finger</option>
              <option value="ring" selected>Ring Finger</option>
              <option value="pinky">Pinky Finger</option>
            </select>
          </div>

        </div>

        <!-- 3. BACK TO SHOP BUTTON -->
        <div class="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50 pointer-events-auto">
          <button id="btn-back-to-shop" class="bg-slate-900 text-white px-8 py-4 rounded-full font-extrabold text-lg shadow-2xl hover:bg-black hover:scale-105 transition-all flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
            </svg>
            <span>Back to Catalog</span>
          </button>
        </div>
      </div>

      <!-- Main AR Camera Viewport -->
      <div id="camera-wrapper" style="position: relative; overflow: hidden; width: 100%; max-width: 600px; aspect-ratio: 3/4; background: #000; border-radius: var(--border-radius-lg); box-shadow: 0 20px 60px rgba(0,0,0,0.9); margin-bottom: 1.5rem;">
        
        <!-- Zoom Wrapper for CSS transform scale -->
        <div id="zoom-wrapper" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; transform-origin: center center; transition: transform 0.1s ease-out;">
          <video id="webcam-source" autoplay muted playsinline style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; display: block !important; visibility: visible !important; opacity: 1 !important; transform: scaleX(-1);"></video>
          <canvas id="ar-output-canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none;"></canvas>
          <canvas id="three-canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; transform: scaleX(-1);"></canvas>
        </div>
        
        <!-- Try-On Premium UI: Zoom Control -->
        <div id="zoom-ui" style="display: none; position: absolute; top: 50%; right: 20px; transform: translateY(-50%); flex-direction: column; align-items: center; background: rgba(0,0,0,0.4); padding: 15px 10px; border-radius: 30px; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); z-index: 20;">
          <span style="color: #fff; font-size: 14px; margin-bottom: 10px;">+</span>
          <input type="range" id="zoom-slider" min="1" max="3" step="0.1" value="1" style="writing-mode: bt-lr; -webkit-appearance: slider-vertical; width: 4px; height: 120px; cursor: pointer; accent-color: var(--accent-gold);">
          <span style="color: #fff; font-size: 18px; margin-top: 10px;">-</span>
        </div>

        <button class="btn btn-primary" id="btn-lock-calibration" style="display: none; position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 50; padding: 1rem 2rem; border-radius: 30px; font-weight: 600; letter-spacing: 1px; background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.5); color: #fff; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">Lock Card Size</button>
      </div>

      <!-- Action Footer -->
      <div style="width: 100%; max-width: 600px; display: flex; flex-direction: column; gap: 1rem;">
        
        <!-- Sizing Progress bar (Visible only in SIZING state) -->
        <div id="sizing-progress-container" style="display: none; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--glass-border); border-radius: var(--border-radius-md); padding: 1rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.6rem;">
            <span id="sizing-progress-label" style="color: var(--accent-gold); font-weight: 600; letter-spacing: 0.5px;">ANALYZING BIOMETRICS...</span>
            <span id="sizing-progress-percent" style="font-weight: bold; color: #00FF66;">0%</span>
          </div>
          <div style="background: rgba(0, 0, 0, 0.5); height: 10px; border-radius: 5px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
            <div id="sizing-progress-bar" style="background: linear-gradient(90deg, #f9d976 0%, #00FF66 100%); width: 0%; height: 100%; transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 0 10px rgba(0,255,102,0.5);"></div>
          </div>
          <div style="width: 100%; display: flex; flex-direction: column; gap: 0.5rem; margin-top: 15px;">
            <label style="font-family: 'Outfit', sans-serif; color: #fff; font-size: 0.85rem;">Already know your size? (Optional)</label>
            <select id="manual-size-override" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 0.4rem 0.8rem; border-radius: 10px; outline: none; font-family: 'Outfit', sans-serif; cursor: pointer;">
              <option value="" style="background: #111;">Detect Automatically</option>
              <option value="4" style="background: #111;">Size 4 (14.8mm)</option>
              <option value="5" style="background: #111;">Size 5 (15.7mm)</option>
              <option value="6" style="background: #111;">Size 6 (16.5mm)</option>
              <option value="7" style="background: #111;">Size 7 (17.3mm)</option>
              <option value="8" style="background: #111;">Size 8 (18.1mm)</option>
              <option value="9" style="background: #111;">Size 9 (18.9mm)</option>
              <option value="10" style="background: #111;">Size 10 (19.8mm)</option>
              <option value="11" style="background: #111;">Size 11 (20.6mm)</option>
              <option value="12" style="background: #111;">Size 12 (21.4mm)</option>
            </select>
          </div>
        </div>

        <button class="btn btn-primary" id="btn-camera-trigger" style="padding: 1rem; border-radius: 30px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">View on My Hand</button>
        <button class="btn btn-primary" id="btn-proceed-tryon" style="display: none; padding: 1rem; border-radius: 30px; font-weight: 600; letter-spacing: 1px; background: linear-gradient(135deg, #f9d976 0%, var(--accent-gold) 100%); color: var(--bg-dark); opacity: 0.5; pointer-events: none;">Proceed to Try-On</button>
        <button class="btn btn-secondary" id="btn-return" style="display: none; padding: 1rem; border-radius: 30px; font-weight: 600; letter-spacing: 1px; background: transparent; border: 1px solid rgba(255,255,255,0.2);">Reset Experience</button>
      </div>

    </div>
  `;

  // Attach Zoom Slider Logic
  const zoomSlider = document.getElementById('zoom-slider') as HTMLInputElement;
  const zoomWrapper = document.getElementById('zoom-wrapper');
  if (zoomSlider && zoomWrapper) {
    zoomSlider.addEventListener('input', (e) => {
      const zoomVal = (e.target as HTMLInputElement).value;
      zoomWrapper.style.transform = `scale(${zoomVal})`;
    });
  }

  // Target Finger UI binding
  const fingerSelect = document.getElementById('config-finger') as HTMLSelectElement;
  if (fingerSelect) {
    fingerSelect.value = appState.targetFinger;
    fingerSelect.addEventListener('change', (e) => {
      appState.setTargetFinger((e.target as HTMLSelectElement).value as any);
    });
  }

  // Button Listeners
  document.getElementById('btn-camera-trigger')?.addEventListener('click', handleCameraToggle);
  
  document.getElementById('btn-lock-calibration')?.addEventListener('click', () => {
    appState.setArFsmState('SIZING');
    updateFsmUI();
  });

  document.addEventListener('arFsmStateChanged', () => {
    updateFsmUI();
  });

  document.getElementById('btn-back-to-shop')?.addEventListener('click', () => {
    if (calibrator) calibrator.stop();
    appState.setArFsmState('CALIBRATION'); // Reset FSM
    window.location.hash = ''; // Return to Shop Configurator
  });

  document.getElementById('manual-size-override')?.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value;
    if (val) {
      const size = parseFloat(val);
      const lockedMm = (size - 3.0) * 0.8128 + 14.07;
      appState.lockedSizeResult = {
        physicalWidthMm: lockedMm,
        calculatedRingSize: size,
        confidenceScore: 1.0,
        ukRingSize: ''
      };
      
      const subtitle = document.getElementById('fsm-subtitle');
      if (subtitle) {
        subtitle.innerText = `Manual Size Set: US Size ${size}`;
        subtitle.style.color = '#00FF66';
      }
      
      const btnProceed = document.getElementById('btn-proceed-tryon');
      if (btnProceed) {
        btnProceed.style.opacity = '1';
        btnProceed.style.pointerEvents = 'auto';
      }
    }
  });

  document.getElementById('btn-proceed-tryon')?.addEventListener('click', () => {
    if (appState.lockedSizeResult) {
      appState.setArFsmState('TRY_ON');
      updateFsmUI();
    }
  });

  document.getElementById('btn-lock-calibration')?.addEventListener('click', () => {
    if (calibrator) {
      calibrator.isCalibrationLocked = true;
    }
    appState.setArFsmState('SIZING');
    updateFsmUI();
  });

  document.getElementById('btn-return')?.addEventListener('click', () => {
    sizingProgress = 0;
    appState.resetSizing(); // Also sets FSM back to CALIBRATION
    if (zoomSlider) {
        zoomSlider.value = "1";
        zoomWrapper!.style.transform = "scale(1)";
    }
    updateFsmUI();
  });

  // Material builder updates
  appState.subscribe(() => {
    if (calibrator) {
      calibrator.selectedMetal = appState.selectedMetal;
      calibrator.selectedSetting = appState.selectedSetting;
      calibrator.selectedStone = appState.selectedStone;
      calibrator.selectedCarat = appState.selectedCarat;
      calibrator.rebuildRing();
    }
  });

  // Auto-start mechanism
  if (appState.autoStartCamera) {
    appState.autoStartCamera = false;
    setTimeout(() => {
      document.getElementById('btn-camera-trigger')?.click();
    }, 100);
  }

  updateFsmUI();
}

function updateFsmUI() {
  const state = appState.arFsmState;
  const title = document.getElementById('fsm-title');
  const subtitle = document.getElementById('fsm-subtitle');
  
  const btnTrigger = document.getElementById('btn-camera-trigger');
  const btnLockCal = document.getElementById('btn-lock-calibration');
  const btnProceed = document.getElementById('btn-proceed-tryon');
  const btnReturn = document.getElementById('btn-return');

  const sizingContainer = document.getElementById('sizing-progress-container');
  const zoomUi = document.getElementById('zoom-ui');

  const ringConfig = document.getElementById('ring-configurator');
  const cameraWrapper = document.getElementById('camera-wrapper');

  if (!calibrator) {
    // Camera is off - Show Configurator, hide camera
    if (ringConfig) {
      ringConfig.style.display = 'none'; // Configurator shouldn't be visible before camera initializes in this Rare Carat setup, user came from Shop
    }
    if (cameraWrapper) cameraWrapper.style.display = 'none';

    if (btnTrigger) btnTrigger.style.display = 'block';
    if (btnTrigger) btnTrigger.innerText = 'INITIALIZING...'; // Should autostart
    
    if (btnLockCal) btnLockCal.style.display = 'none';
    if (btnProceed) btnProceed.style.display = 'none';
    if (btnReturn) btnReturn.style.display = 'none';
    if (sizingContainer) sizingContainer.style.display = 'none';
    if (zoomUi) zoomUi.style.display = 'none';
    if (title) title.innerText = 'AR Try-On';
    if (subtitle) subtitle.innerText = 'Connecting to camera...';
    return;
  }

  // Camera is on
  if (cameraWrapper) cameraWrapper.style.display = 'block';

  if (btnTrigger) btnTrigger.style.display = 'none';

  if (state === 'CALIBRATION') {
    if (ringConfig) ringConfig.style.display = 'none';
    if (title) title.innerText = 'Calibration Phase';
    if (subtitle) subtitle.innerText = 'Align a standard credit card in the guide frame.';
    
    if (sizingContainer) sizingContainer.style.display = 'none';
    if (zoomUi) zoomUi.style.display = 'none';

    if (btnLockCal) btnLockCal.style.display = 'block';
    if (btnProceed) btnProceed.style.display = 'none';
    if (btnReturn) btnReturn.style.display = 'block';

  } else if (state === 'SIZING') {
    if (ringConfig) ringConfig.style.display = 'none';
    if (title) title.innerText = 'Sizing Phase';
    if (subtitle) subtitle.innerText = 'Hold your hand flat. System will detect biometrics.';
    
    if (sizingContainer) sizingContainer.style.display = 'block';
    if (zoomUi) zoomUi.style.display = 'none';

    if (btnLockCal) btnLockCal.style.display = 'none';
    if (btnProceed) btnProceed.style.display = 'block';
    if (btnReturn) btnReturn.style.display = 'block';

  } else if (state === 'TRY_ON') {
    if (title) title.innerText = 'AURA AR';
    if (subtitle) subtitle.innerText = 'Immersive Try-On Active';

    if (ringConfig) {
      ringConfig.style.display = 'flex';

      // 2. BIND FULL OBJECT TO UI DIRECTLY FROM CART STATE
      if (appState.cart?.diamond && appState.cart?.setting) {
        const fullDiamond = appState.cart.diamond;
        const fullSetting = appState.cart.setting;
        
        const textEl1 = document.getElementById('hud-cart-text1');
        if (textEl1) textEl1.innerText = `${fullDiamond.carat}ct ${fullDiamond.shape}`;
        
        const textEl2 = document.getElementById('hud-cart-text2');
        if (textEl2) textEl2.innerText = `in ${fullSetting.metal} ${fullSetting.style}`;
        
        const dImg = document.getElementById('hud-diamond-img') as HTMLImageElement;
        if (dImg) { dImg.src = fullDiamond.img; dImg.style.display = 'block'; }
        
        const sImg = document.getElementById('hud-setting-img') as HTMLImageElement;
        if (sImg) { sImg.src = fullSetting.img; sImg.style.display = 'block'; }
      }
    }

    if (sizingContainer) sizingContainer.style.display = 'none';
    if (zoomUi) {
        zoomUi.style.display = 'flex';
    }

    if (btnLockCal) btnLockCal.style.display = 'none';
    if (btnProceed) btnProceed.style.display = 'none';
    if (btnReturn) btnReturn.style.display = 'block';
  }
}

async function handleCameraToggle() {
  const triggerBtn = document.getElementById('btn-camera-trigger');
  if (!triggerBtn) return;

  if (calibrator) {
    calibrator.stop();
    calibrator = null;
    localStream = null;
    appState.resetSizing();
    sizingProgress = 0;
    updateFsmUI();
    
    const canvas = document.getElementById('ar-output-canvas') as HTMLCanvasElement;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    return;
  }

  // Open the stream
  try {
    triggerBtn.innerText = 'INITIALIZING...';
    triggerBtn.setAttribute('class', 'btn btn-secondary');
    
    localStream = await HandCalibrator.requestCameraPermission();
    
    const video = document.getElementById('webcam-source') as HTMLVideoElement;
    const canvas = document.getElementById('ar-output-canvas') as HTMLCanvasElement;
    const threeCanvas = document.getElementById('three-canvas') as HTMLCanvasElement;
    
    const cFinger = (document.getElementById('config-finger') as HTMLSelectElement)?.value as any || 'ring';
    
    // We get metal and stone directly from the cart now
    const dMetal = appState.cart?.setting?.metal || 'yellow-gold';
    const dStone = appState.cart?.diamond?.type || 'diamond';
    appState.setRingOptions({ metal: dMetal, stone: dStone });
    appState.setTargetFinger(cFinger);
    
    calibrator = new HandCalibrator(video, canvas, threeCanvas);
    await calibrator.initialize();
    
    calibrator.selectedMetal = appState.selectedMetal;
    calibrator.selectedSetting = appState.selectedSetting;
    calibrator.selectedStone = appState.selectedStone;
    calibrator.selectedCarat = appState.selectedCarat;
    
    // Auto-advance to SIZING state as requested, if credit card scale was previously cached, or CALIBRATION otherwise
    if (appState.lockedSizeResult) {
       appState.setArFsmState('SIZING');
    } else {
       appState.setArFsmState('CALIBRATION');
    }
    calibrator.rebuildRing();
    
    calibrator.start(localStream);

    appState.setArFsmState('CALIBRATION');
    sizingProgress = 0;
    updateFsmUI();

    checkTelemetryLoop();
  } catch (err: any) {
    alert(err.message || 'Could not access webcam');
    triggerBtn.innerText = 'INITIALIZE AR';
    triggerBtn.setAttribute('class', 'btn btn-primary');
    calibrator = null;
  }
}

function checkTelemetryLoop() {
  if (!calibrator) return;
  
  const state = appState.arFsmState;

  if (state === 'CALIBRATION') {
    // Check if card is detected to visually unlock button
    const scale = calibrator.getDetectedScale();
    const lockBtn = document.getElementById('btn-lock-calibration') as HTMLButtonElement;
    if (lockBtn) {
       // if detectedScale is valid, we successfully evaluated the card
       if (scale) {
          lockBtn.removeAttribute('disabled');
          lockBtn.style.opacity = '1';
          lockBtn.innerText = 'Lock Calibration (Detected)';
          lockBtn.style.background = 'linear-gradient(135deg, #00FF66 0%, #00CC52 100%)';
       } else {
          // Disable until detected
          lockBtn.setAttribute('disabled', 'true');
          lockBtn.style.opacity = '0.5';
          lockBtn.innerText = 'Detecting Card...';
          lockBtn.style.background = 'rgba(255,255,255,0.1)';
       }
    }
  } else if (state === 'SIZING') {
    const data = calibrator.getCalibrationData();
    if (data) {
      if (data.confidenceScore > 0.60) {
        sizingProgress = Math.min(100, sizingProgress + 1.5);
      } else {
        sizingProgress = Math.max(0, sizingProgress - 1.0);
      }
      updateProgressUI();
      
      if (sizingProgress >= 100) {
         appState.lockSize(data);
      }
    }
  }

  if (calibrator) {
    requestAnimationFrame(checkTelemetryLoop);
  }
}

function updateProgressUI() {
  const bar = document.getElementById('sizing-progress-bar');
  if (bar) bar.style.width = `${Math.round(sizingProgress)}%`;
  const pct = document.getElementById('sizing-progress-percent');
  if (pct) pct.innerText = `${Math.round(sizingProgress)}%`;
  const lbl = document.getElementById('sizing-progress-label');

  if (appState.isSizeLocked || sizingProgress >= 100) {
    if (lbl) lbl.innerHTML = '✅ Sizing Complete! Ready for Try-On';
  } else {
    if (lbl) lbl.innerText = 'ANALYZING BIOMETRICS...';
  }
}
