/**
 * Hand Calibration Module
 * Coordinates MediaPipe Hands, HTML5 Canvas overlay, credit card edge detection,
 * and mapping of finger width to US/UK ring sizes.
 */

import * as THREE from 'three';
import { appState } from '../state/store';
import { JewelryGenerator, RingConfig } from './JewelryGenerator';

// Global definitions for MediaPipe loaded via CDN
declare global {
  interface Window {
    Hands: any;
    Camera: any;
  }
}

export interface CalibrationResult {
  physicalWidthMm: number;
  calculatedRingSize: number;
  confidenceScore: number;
  ukRingSize: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class HandCalibrator {
  private videoElement: HTMLVideoElement | HTMLImageElement;
  private canvasElement: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private hands: any;
  private camera: any;
  
  // State variables
  private cardWidthInPixels: number | null = null;
  private detectedScale: number | null = null; // mm per pixel
  private latestResult: CalibrationResult | null = null;
  private isCalibrating: boolean = false;
  public currentLandmarks: any[] = [];
  // MediaPipe handedness label for the tracked hand ('Left' | 'Right' | null).
  // Used to resolve the sign of the palm-normal cross product (see computeDorsalNormal).
  private currentHandedness: string | null = null;
  
  // Calibration & Sizing locks
  public isCalibrationLocked: boolean = false;
  public isTryOnMode: boolean = false;
  private smoothedFingerWidthPx: number | null = null;
  private sizingBuffer: number[] = [];

  // Three.js AR State
  private threeCanvas: HTMLCanvasElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera3D!: THREE.PerspectiveCamera;
  
  private ringGroup: THREE.Group | null = null;
  private contactShadow: THREE.Sprite | null = null;     // soft grounding shadow under the band
  private ambientSampleCounter: number = 0;              // throttle webcam exposure matching
  private baseExposure: number = 1.05;                   // studio exposure before room matching

  // Custom Ring Builder Selection State (Brilliant Earth / Rare Carat Style)
  public selectedMetal: string = 'yellow-gold';
  public selectedSetting: string = 'solitaire';
  public selectedStone: string = 'diamond';
  public selectedCarat: number = 1.0;
  
  private resizeObserver: ResizeObserver | null = null;
  
  // Configuration
  // Bounding box on screen where the user should align their credit card
  public cardGuideBox: BoundingBox = {
    x: 50,
    y: 180,
    width: 200,
    height: 126 // Aspect ratio close to a standard credit card (85.60 x 53.98 mm)
  };

  constructor(video: HTMLVideoElement | HTMLImageElement, canvas: HTMLCanvasElement, threeCanvas: HTMLCanvasElement) {
    this.videoElement = video;
    this.canvasElement = canvas;
    this.threeCanvas = threeCanvas;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = context;
    this.initThreeJS();

    this.resizeObserver = new ResizeObserver(() => {
      this.syncDimensions();
    });
    if (this.videoElement.parentElement) {
      this.resizeObserver.observe(this.videoElement.parentElement);
    }
  }

  private mapCoordinate(mx: number, my: number): { x: number; y: number } {
    const videoElem = this.videoElement as HTMLVideoElement;
    if (!videoElem) return { x: 0, y: 0 };
    
    // The intrinsic size of the raw video stream
    const naturalWidth = videoElem.videoWidth || (videoElem as any).naturalWidth || 1280;
    const naturalHeight = videoElem.videoHeight || (videoElem as any).naturalHeight || 720;
    
    // The CSS rendered size of the wrapper/container
    const clientWidth = videoElem.clientWidth || this.canvasElement.width;
    const clientHeight = videoElem.clientHeight || this.canvasElement.height;
    
    if (naturalWidth === 0 || naturalHeight === 0 || clientWidth === 0 || clientHeight === 0) {
      return { x: mx * clientWidth, y: my * clientHeight };
    }
    
    const videoRatio = naturalWidth / naturalHeight;
    const containerRatio = clientWidth / clientHeight;
    
    let renderedWidth, renderedHeight, cropOffsetX = 0, cropOffsetY = 0;
    
    if (videoRatio > containerRatio) {
      // Video is wider than container, height matches, width is cropped
      const scale = clientHeight / naturalHeight;
      renderedHeight = clientHeight;
      renderedWidth = naturalWidth * scale;
      cropOffsetX = (renderedWidth - clientWidth) / 2;
    } else {
      // Video is taller than container, width matches, height is cropped
      const scale = clientWidth / naturalWidth;
      renderedWidth = clientWidth;
      renderedHeight = naturalHeight * scale;
      cropOffsetY = (renderedHeight - clientHeight) / 2;
    }
    
    const pixelX = mx * renderedWidth - cropOffsetX;
    const pixelY = my * renderedHeight - cropOffsetY;
    
    return { x: pixelX, y: pixelY };
  }

  /**
   * Request Camera Permission with Privacy Disclosure
   */
  public static async requestCameraPermission(): Promise<MediaStream> {
    try {
      // Disclose privacy before prompting
      console.log('PRIVACY DISCLOSURE: Camera feed is processed strictly in-memory. No raw images or biometric scans are uploaded or saved.');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });
      return stream;
    } catch (error) {
      throw new Error('Camera access denied. Please enable camera permissions to calibrate your ring size.');
    }
  }

  /**
   * Initialize MediaPipe Hands
   */
  public async initialize(): Promise<void> {
    if (!window.Hands) {
      throw new Error('MediaPipe Hands library not loaded. Please ensure index.html includes CDN scripts.');
    }

    this.hands = new window.Hands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
    });

    this.hands.onResults((results: any) => this.onHandResults(results));
  }

  private initThreeJS(): void {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.threeCanvas, alpha: true, antialias: true });
    this.renderer.setSize(this.threeCanvas.width, this.threeCanvas.height);
    // Cap pixel ratio at 2 — beyond that costs fill rate with no visible gain, and jagged
    // edges on a "photoreal" stone break the illusion, so we keep AA + a sharp buffer.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    // Correct PBR pipeline: ACES filmic tone-map + sRGB output. A flat/washed-out look is
    // almost always a tone-mapping / colour-space miss rather than a material problem.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.baseExposure;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();

    this.camera3D = new THREE.PerspectiveCamera(45, this.threeCanvas.width / this.threeCanvas.height, 0.1, 5000);
    this.syncDimensions();

    // Custom studio HDRI does the heavy lifting for both metal specular and diamond fire —
    // it has a few small, bright "softbox" sources that image-based lighting needs. Bind it
    // to scene.environment ONCE so every PBR material reflects it (envMapIntensity per material).
    this.scene.environment = this.createStudioEnvironment();

    // A couple of soft direct lights only to lift shadow detail; the env map is the key light.
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
    this.scene.add(ambientLight);
    const keyLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
    keyLight.position.set(5, 10, 7);
    this.scene.add(keyLight);
    this.scene.add(this.camera3D);

    // Soft contact shadow sprite — a camera-facing dark radial disc that darkens the webcam
    // pixels where the band meets skin, so the ring is grounded instead of looking pasted on.
    const shadowMat = new THREE.SpriteMaterial({
      map: this.createContactShadowTexture(),
      color: 0x000000,
      transparent: true,
      opacity: 0.0,            // faded in only while tracking
      depthTest: false,        // always behind the ring, over the video
      depthWrite: false,
    });
    this.contactShadow = new THREE.Sprite(shadowMat);
    this.contactShadow.renderOrder = -2; // draw before the occlusion cylinder and the ring
    this.contactShadow.visible = false;
    this.scene.add(this.contactShadow);

    this.build3DRing();
  }

  /**
   * Procedural studio HDRI as a floating-point equirectangular environment.
   * A dark gradient base plus a handful of small, very bright elliptical "softboxes"
   * (values well above 1.0 — true HDR) gives metal a tight specular hotspot and the
   * diamond its fire. Run through PMREMGenerator so it's usable as scene.environment.
   */
  private createStudioEnvironment(): THREE.Texture {
    const w = 512, h = 256;
    const data = new Float32Array(w * h * 4);

    // Bright softbox sources: u,v in [0,1], angular radii, and HDR intensity (>1).
    const boxes = [
      { u: 0.50, v: 0.12, ru: 0.10, rv: 0.06, i: 18, c: [1.0, 0.97, 0.92] }, // top key
      { u: 0.18, v: 0.30, ru: 0.07, rv: 0.10, i: 10, c: [0.95, 0.97, 1.0] }, // left fill
      { u: 0.82, v: 0.28, ru: 0.06, rv: 0.09, i: 12, c: [1.0, 0.99, 0.95] }, // right fill
      { u: 0.65, v: 0.55, ru: 0.04, rv: 0.04, i: 22, c: [1.0, 1.0, 1.0] },   // small hot spark
    ];

    for (let y = 0; y < h; y++) {
      const v = y / (h - 1);
      // Base gradient: brighter near the top (sky/ceiling), dark navy toward the floor.
      const base = 0.08 + 0.32 * Math.pow(1 - v, 1.5);
      for (let x = 0; x < w; x++) {
        const u = x / (w - 1);
        let r = base * 0.85, g = base * 0.90, b = base;
        for (const s of boxes) {
          // Wrap horizontally so seams don't show; gaussian-ish falloff for soft edges.
          let du = Math.abs(u - s.u); du = Math.min(du, 1 - du);
          const dv = v - s.v;
          const d = (du * du) / (s.ru * s.ru) + (dv * dv) / (s.rv * s.rv);
          const fall = Math.exp(-d * 2.5);
          r += s.i * s.c[0] * fall; g += s.i * s.c[1] * fall; b += s.i * s.c[2] * fall;
        }
        const idx = (y * w + x) * 4;
        data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 1.0;
      }
    }

    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.needsUpdate = true;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envRT = pmrem.fromEquirectangular(tex);
    tex.dispose();
    pmrem.dispose();
    return envRT.texture;
  }

  /** Radial black→transparent disc used by the contact-shadow sprite. */
  private createContactShadowTexture(): THREE.CanvasTexture {
    const size = 128;
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = size;
    const c = cvs.getContext('2d')!;
    const grd = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0.0, 'rgba(0,0,0,0.85)');
    grd.addColorStop(0.6, 'rgba(0,0,0,0.35)');
    grd.addColorStop(1.0, 'rgba(0,0,0,0.0)');
    c.fillStyle = grd;
    c.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(cvs);
  }

  private syncDimensions(): void {
    // Determine the wrapper dimensions
    const wrapper = this.videoElement.parentElement;
    const clientWidth = wrapper ? wrapper.clientWidth : this.videoElement.clientWidth;
    const clientHeight = wrapper ? wrapper.clientHeight : this.videoElement.clientHeight;

    const videoWidth = clientWidth || (this.videoElement as any).width || (this.videoElement as any).naturalWidth;
    const videoHeight = clientHeight || (this.videoElement as any).height || (this.videoElement as any).naturalHeight;
    
    if (videoWidth === 0 || videoHeight === 0) return;
    
    // Only update if dimensions changed to save CPU
    if (this.threeCanvas.width !== videoWidth || this.threeCanvas.height !== videoHeight) {
      // Sync internal canvas buffers to match the physical DOM pixels
      this.threeCanvas.width = videoWidth;
      this.threeCanvas.height = videoHeight;
      this.canvasElement.width = videoWidth;
      this.canvasElement.height = videoHeight;
      
      const rect = this.videoElement.getBoundingClientRect();
      this.threeCanvas.style.width = rect.width + 'px';
      this.threeCanvas.style.height = rect.height + 'px';
      
      this.renderer.setSize(videoWidth, videoHeight);
      this.camera3D.aspect = videoWidth / videoHeight;
      // Recalibrate FOV depth mapping so 1 unit = 1 pixel at Z=0
      this.camera3D.position.z = (videoHeight / 2) / Math.tan((45 / 2) * Math.PI / 180);
      this.camera3D.updateProjectionMatrix();

      // Dynamically resize and center the credit card guide box
      const cardAspectRatio = 85.60 / 53.98;
      // Target 85% of screen width, max 800px to make it huge as requested
      let boxW = Math.min(videoWidth * 0.85, 800);
      let boxH = boxW / cardAspectRatio;

      // Make sure it doesn't overflow vertically (max 85% of height)
      if (boxH > videoHeight * 0.85) {
        boxH = videoHeight * 0.85;
        boxW = boxH * cardAspectRatio;
      }

      // Center horizontally and vertically
      this.cardGuideBox = {
        x: (videoWidth - boxW) / 2,
        y: (videoHeight - boxH) / 2,
        width: boxW,
        height: boxH
      };
    }
  }

  public rebuildRing(): void {
    this.build3DRing();
  }

  private build3DRing(): void {
    // --- Dispose previous ring if present ---
    if (this.ringGroup) {
      JewelryGenerator.disposeGroup(this.ringGroup);
      this.scene.remove(this.ringGroup);
      this.ringGroup = null;
    }

    // --- Cart validation ---
    if (!appState.cart?.diamond || !appState.cart?.setting) {
      return;
    }
    const activeDiamond = appState.cart.diamond;
    const activeSetting = appState.cart.setting;

    // --- Map the loose catalog strings onto the generator's enums. The catalog stores e.g.
    //     shape "Radiant", style "Three Stone", metal "18k White Gold" — none of which are
    //     valid enum keys verbatim, so we keyword-match instead of naive string casts.

    // Metal: name carries a karat prefix ("18k White Gold") → match the colour keyword.
    const metalRaw = (activeSetting?.metal || appState.selectedMetal || 'yellow gold').toLowerCase();
    const metalType: RingConfig['metalType'] =
      metalRaw.includes('rose')     ? 'rose_gold' :
      metalRaw.includes('yellow')   ? 'yellow_gold' :
      metalRaw.includes('platinum') ? 'platinum' :
      'white_gold'; // white gold / default

    // Setting: catalog field is `style` ("Solitaire" | "Halo" | "Hidden Halo" | "Three Stone").
    const styleRaw = (activeSetting?.style || appState.selectedSetting || '').toLowerCase();
    const settingType: RingConfig['settingType'] =
      styleRaw.includes('three')  ? 'three_stone' :
      styleRaw.includes('hidden') ? 'hidden_halo' :
      styleRaw.includes('halo')   ? 'halo' :
      'solitaire';

    // Shape: lowercase the catalog value; the generator handles round/oval/emerald/princess/
    // cushion/radiant and falls back to round for anything unrecognised.
    const stoneShape = (activeDiamond.shape || 'round').toLowerCase() as RingConfig['stoneShape'];

    // --- Build config from shop state ---
    const config: RingConfig = {
      ringSize: 8.5,
      bandWidth: 2.5,
      bandProfile: 'dome',
      metalType,
      metalFinish: /brushed|satin|matte/.test(metalRaw) ? 'brushed' : 'polished',
      stoneShape,
      settingType,
      stoneCarat: parseFloat(activeDiamond.carat) || 1.5,
    };

    if (((window as any).DEBUG_RING ?? true)) {
      // Temporary: confirm in the console that each selection reaches the generator distinctly.
      // On by default during this fix; set window.DEBUG_RING = false to silence.
      // eslint-disable-next-line no-console
      console.log('[build3DRing] config →', JSON.stringify(config), 'from', { shape: activeDiamond.shape, style: activeSetting?.style, metal: activeSetting?.metal });
    }

    // --- Generate the ring assembly (includes occlusion cylinder) ---
    // Geometry is built ONLY here, on a config change — never inside the per-frame loop.
    // scene.environment is created once in initThreeJS(), so nothing to rebuild here.
    this.ringGroup = JewelryGenerator.generateRing(config);
    this.ringGroup.visible = false;
    this.scene.add(this.ringGroup);
  }

  /**
   * Periodically sample the live webcam frame's average luminance and nudge tone-mapping
   * exposure so the ring's lighting tracks the user's actual room instead of always looking
   * like a fixed studio render pasted onto a variable background. Cheap: downsamples the
   * video to 16×16 and runs once every ~30 frames, not per frame.
   */
  private sampleWebcamAmbient(): void {
    if (++this.ambientSampleCounter % 30 !== 0) return;
    const vid = this.videoElement as HTMLVideoElement;
    if (!vid || (vid.videoWidth || (vid as any).naturalWidth || 0) === 0) return;
    try {
      const tmp = document.createElement('canvas');
      tmp.width = 16; tmp.height = 16;
      const tctx = tmp.getContext('2d', { willReadFrequently: true });
      if (!tctx) return;
      tctx.drawImage(vid, 0, 0, 16, 16);
      const px = tctx.getImageData(0, 0, 16, 16).data;
      let lum = 0;
      for (let i = 0; i < px.length; i += 4) {
        lum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      }
      lum /= (px.length / 4) * 255; // 0..1 average brightness of the room
      // Map a dim room → slightly lower exposure, a bright room → slightly higher, around the
      // studio baseline. Smoothed so the exposure doesn't visibly pump frame to frame.
      const target = this.baseExposure * (0.8 + 0.5 * lum);
      this.renderer.toneMappingExposure += (target - this.renderer.toneMappingExposure) * 0.25;
    } catch (e) { /* cross-origin or not-ready frame — skip this sample */ }
  }


  /**
   * Start Calibration Loop
   */
  public start(stream: MediaStream): void {
    (this.videoElement as HTMLVideoElement).srcObject = stream;
    (this.videoElement as HTMLVideoElement).play();
    this.isCalibrating = true;

    if (!window.Camera) {
      throw new Error('MediaPipe Camera utility not loaded.');
    }

    this.camera = new window.Camera(this.videoElement, {
      onFrame: async () => {
        const vid = this.videoElement as HTMLVideoElement; if (vid.readyState < 2 || vid.videoWidth === 0) return;
        if (this.isCalibrating) {
          this.syncDimensions();
          if (appState.arFsmState === 'CALIBRATION') {
            this.ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
            this.detectCreditCardEdges(this.videoElement);
            this.drawOverlays();
            if (this.ringGroup) this.ringGroup.visible = false;
            this.renderer.render(this.scene, this.camera3D);
          } else {
            await this.hands.send({ image: this.videoElement });
          }
        }
      },
      width: 1280,
      height: 720
    });

    // Force the video element to remain visible, overriding any display:none set by MediaPipe
    (this.videoElement as HTMLVideoElement).style.display = "block";
    (this.videoElement as HTMLVideoElement).style.opacity = "1";
    (this.videoElement as HTMLVideoElement).style.visibility = "visible";

    this.camera.start();
  }/**
   * Stop Calibration
   */
  public stop(): void {
    this.isCalibrating = false;
    if (this.camera) {
      this.camera.stop();
    }
    if ((this.videoElement as HTMLVideoElement).srcObject) {
      const stream = (this.videoElement as HTMLVideoElement).srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      (this.videoElement as HTMLVideoElement).srcObject = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  public getDetectedScale(): number | null {
    return this.detectedScale;
  }

  public async testWithImage(image: HTMLImageElement): Promise<void> {
    this.videoElement = image;
    const videoWidth = image.naturalWidth;
    const videoHeight = image.naturalHeight;

    this.threeCanvas.width = videoWidth;
    this.threeCanvas.height = videoHeight;
    this.canvasElement.width = videoWidth;
    this.canvasElement.height = videoHeight;    const imgWidth = (this.videoElement as any).naturalWidth || this.videoElement.clientWidth;
    const imgHeight = (this.videoElement as any).naturalHeight || this.videoElement.clientHeight;

    this.renderer.setSize(imgWidth, imgHeight, false);
    
    const rect = this.videoElement.getBoundingClientRect();
    this.threeCanvas.style.width = rect.width + 'px';
    this.threeCanvas.style.height = rect.height + 'px';

    this.camera3D.aspect = imgWidth / imgHeight;
    this.camera3D.position.z = (imgHeight / 2) / Math.tan((45 / 2) * Math.PI / 180);
    this.camera3D.updateProjectionMatrix();

    await this.hands.send({ image: image });
  }

  /**
   * MediaPipe Hand Tracking Results callback
   */
  private onHandResults(results: any): void {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);

    // Capture handedness for this frame. NOTE: we feed the RAW (unmirrored) video pixels to
    // MediaPipe, but MP labels handedness assuming a mirrored selfie image — so its label is
    // the anatomical opposite of the real hand. computeDorsalNormal() accounts for this.
    this.currentHandedness = results.multiHandedness?.[0]?.label ?? null;

    const state = appState.arFsmState;

    if (state === 'SIZING') {
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        this.currentLandmarks = results.multiHandLandmarks[0];
        this.drawHandOverlay(this.currentLandmarks);
        if (this.detectedScale) {
          this.calculateRingSize(this.currentLandmarks);
        }
      } else {
        this.currentLandmarks = [];
      }
      if (this.ringGroup) this.ringGroup.visible = false;
      if (this.contactShadow) this.contactShadow.visible = false;
    } else if (state === 'TRY_ON') {
      // Match scene exposure to the room (throttled internally to ~1/30 frames).
      this.sampleWebcamAmbient();
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        this.currentLandmarks = results.multiHandLandmarks[0];
        this.renderTryOnMode(this.currentLandmarks);
      } else {
        this.currentLandmarks = [];
        if (this.ringGroup) this.ringGroup.visible = false;
        if (this.contactShadow) this.contactShadow.visible = false;
      }
    }

    // Render the 3D scene on top
    this.renderer.render(this.scene, this.camera3D);
  }

  private renderTryOnMode(landmarks: any[]): void {
    if (!appState.lockedSizeResult) { return; }

    // We know the exact physical width the user locked in mm
    const lockedWidthMm = appState.lockedSizeResult.physicalWidthMm;

    // Determine target landmarks
    const mcp5 = landmarks[5];
    const mcp9 = landmarks[9];
    const mcp13 = landmarks[13];
    const mcp17 = landmarks[17];

    if (!mcp5 || !mcp9 || !mcp13 || !mcp17) return;

    let targetMcp, targetPip;

    if (appState.targetFinger === 'index') {
      targetMcp = mcp5; targetPip = landmarks[6];
    } else if (appState.targetFinger === 'middle') {
      targetMcp = mcp9; targetPip = landmarks[10];
    } else if (appState.targetFinger === 'pinky') {
      targetMcp = mcp17; targetPip = landmarks[18];
    } else {
      targetMcp = mcp13; targetPip = landmarks[14];
    }

    if (!targetMcp || !targetPip) return;

    const width = this.canvasElement.width;

    const ptBaseMapped = this.mapCoordinate(targetMcp.x, targetMcp.y);
    const ptPipMapped = this.mapCoordinate(targetPip.x, targetPip.y);

    const ptBase = { x: ptBaseMapped.x, y: ptBaseMapped.y, z: targetMcp.z };
    const ptPip = { x: ptPipMapped.x, y: ptPipMapped.y, z: targetPip.z };

    // Use 3D Proximal Phalanx length to determine finger width dynamically
    // Use the mapped 2D coordinates for screen distance
    const dxWidth = ptPip.x - ptBase.x;
    const dyWidth = ptPip.y - ptBase.y;
    // z is roughly mapped to the container width factor
    const dzWidth = (targetPip.z - targetMcp.z) * width;
    
    const phalanxLength3D = Math.sqrt(dxWidth * dxWidth + dyWidth * dyWidth + dzWidth * dzWidth);
    const pixelWidth = phalanxLength3D * 0.48;

    // Apply EMA smoothing to the pixel width
    if (this.smoothedFingerWidthPx === null) {
      this.smoothedFingerWidthPx = pixelWidth;
    } else {
      this.smoothedFingerWidthPx = this.smoothedFingerWidthPx * 0.85 + pixelWidth * 0.15;
    }

    // Since we know physicalWidthMm from the locked size, and we know smoothedFingerWidthPx on screen,
    // we can calculate the dynamically detected Scale right here without a credit card!
    this.detectedScale = lockedWidthMm / this.smoothedFingerWidthPx;

    // Use 3D Z coordinates from MediaPipe to compute Pitch
    const dz = ptPip.z - ptBase.z; // Depth difference
    const dX = ptPip.x - ptBase.x; // X difference
    const dY = ptPip.y - ptBase.y; // Y difference

    // 1. Screen Rotation (Roll around Z axis)
    const angleOnScreen = Math.atan2(dY, dX);

    // 2. Pitch (Rotation around X axis - pointing into/out of screen)
    const zScaleFactor = width;
    const pitch = Math.atan2(dz * zScaleFactor, Math.sqrt(dX * dX + dY * dY));

    // 2b. DORSAL NORMAL — derive the true back-of-hand direction from the palm plane.
    //     This is what makes the diamond hide when the user turns their palm to the camera.
    const dorsalNormal = this.computeDorsalNormal(landmarks, width);

    // 3. Render the immersive AR Ring with full 3D rotation
    this.drawAugmentedRing3D(ptBase, ptPip, this.smoothedFingerWidthPx, pitch, angleOnScreen, dorsalNormal);
  }

  /**
   * Computes the hand's DORSAL normal (the outward direction from the back of the hand) in
   * the ring's world space. The diamond's +Z is aligned to this, so when the palm faces the
   * camera the normal points away and the stone rotates out of view (then the occlusion
   * cylinder hides it).
   *
   * Cross-product math:
   *   The palm is a plane spanned by two edges sharing the wrist:
   *       v1 = indexMCP(5) − wrist(0)
   *       v2 = pinkyMCP(17) − wrist(0)
   *   palmNormal = v1 × v2  is perpendicular to that plane (right-hand rule).
   *   The sign of v1 × v2 is fixed by hand chirality: for one hand it points dorsally,
   *   for the mirrored hand it points palmward — hence we flip it by handedness.
   */
  private computeDorsalNormal(landmarks: any[], scale: number): THREE.Vector3 {
    const wrist = landmarks[0], idxMcp = landmarks[5], pinkyMcp = landmarks[17];
    // Degenerate-safe fallback: face the camera so the stone stays visible.
    if (!wrist || !idxMcp || !pinkyMcp) return new THREE.Vector3(0, 0, 1);

    const W = this.canvasElement.width;
    const H = this.canvasElement.height;
    // Lift each landmark into the same world space the ring lives in. Y is flipped
    // (canvas-down → world-up); MediaPipe z is negative toward the camera, so world
    // +Z (toward camera) = -lm.z * scale.
    const toWorld = (lm: any) => {
      const m = this.mapCoordinate(lm.x, lm.y);
      return new THREE.Vector3(m.x - W / 2, H / 2 - m.y, -lm.z * scale);
    };

    const v1 = toWorld(idxMcp).sub(toWorld(wrist));
    const v2 = toWorld(pinkyMcp).sub(toWorld(wrist));
    const palmNormal = new THREE.Vector3().crossVectors(v1, v2);
    if (palmNormal.lengthSq() < 1e-6) return new THREE.Vector3(0, 0, 1);
    palmNormal.normalize();

    // Resolve dorsal vs palmar by chirality (RESOLVED — was the open "may need one live flip"
    // TODO). Derivation in raw camera space (world +Z toward camera, +Y up):
    //   For a real RIGHT hand showing its back to the camera, v1×v2 points away from the
    //   camera (palmward), so dorsal = −(v1×v2). For a real LEFT hand it already points
    //   toward the camera (dorsal). MediaPipe receives UNMIRRORED pixels but labels assuming
    //   a mirrored selfie, so its label is anatomically inverted: MP 'Left' == real right
    //   hand → sign −1; MP 'Right' == real left hand → sign +1. Net mapping below.
    const sign = this.currentHandedness === 'Right' ? 1 : -1;
    return palmNormal.multiplyScalar(sign);
  }

  private drawAugmentedRing3D(
    ptBase: { x: number; y: number; z: number },
    ptPip: { x: number; y: number; z: number },
    fingerWidthPx: number,
    pitch: number,
    _angleOnScreen: number,
    dorsalHint: THREE.Vector3 = new THREE.Vector3(0, 0, 1)
  ): void {
    if (!this.detectedScale || !this.ringGroup) return;

    const videoW = this.canvasElement.width;
    const videoH = this.canvasElement.height;

    // Convert from canvas coordinates to Three.js world coordinates
    const mcpVec = new THREE.Vector3(
      ptBase.x - (videoW / 2),
      (videoH / 2) - ptBase.y,
      0
    );
    const pipVec = new THREE.Vector3(
      ptPip.x - (videoW / 2),
      (videoH / 2) - ptPip.y,
      0
    );

    // 1. POSITION — slide the ring PAST the knuckle into the natural webbed pocket at the
    //    base of the finger (the proximal phalanx). mcpVec is the knuckle (MCP); pipVec is
    //    the first joint (PIP). Lerping 0.55 from MCP→PIP rests it where a real ring settles.
    const BASE_OF_FINGER_T = 0.55;
    const ringPosition = new THREE.Vector3().lerpVectors(mcpVec, pipVec, BASE_OF_FINGER_T);

    // 2. SCALE — fit the band's INNER hole to the measured finger width like a real ring:
    //    snug, with only a hair of clearance, not a loose loop with visible daylight.
    //    Band geometry (from RingConfig in build3DRing): ringSize 8.5, bandWidth 2.5 →
    //    inner diameter = 2 * (8.5 − 2.5/2) = 14.5 world units. The camera is set so 1 world
    //    unit ≈ 1px at the tracking plane, so scaling the 14.5-unit hole to fingerWidthPx (× a
    //    small clearance) seats the band on the finger. Scale is derived purely from the band
    //    (which sets the fit) — independent of the stone/halo/prong parts, so adding the hidden
    //    halo gallery etc. cannot loosen the fit.
    const BAND_INNER_DIAMETER = 2 * (8.5 - 2.5 / 2); // 14.5 — keep in sync with build3DRing config
    const FIT_CLEARANCE = 1.06;                      // ~6% clearance: snug like a worn ring
    const requiredScale = (fingerWidthPx * FIT_CLEARANCE) / BAND_INNER_DIAMETER;

    // 3. ORIENTATION — align ring's local Y axis with the bone direction
    //    Ring geometry: hole axis = Y, stone at +Z.
    //    We want: local Y → bone direction, local Z → toward camera (dorsal side).

    // Build 3D bone vector incorporating pitch (finger tilt into/out of screen)
    const boneDir2D = new THREE.Vector3().subVectors(pipVec, mcpVec).normalize();
    const boneDir3D = new THREE.Vector3(
      boneDir2D.x * Math.cos(pitch),
      boneDir2D.y * Math.cos(pitch),
      -Math.sin(pitch)
    ).normalize();

    // dorsalHint = the back-of-hand normal from computeDorsalNormal(). When the palm turns to
    // the camera this vector points away (-Z), so the diamond rotates out of view as required.

    // Build an orthonormal basis with Y LOCKED to the finger bone and +Z aligned to the
    // dorsal normal. Because the dorsal normal isn't guaranteed exactly perpendicular to the
    // bone, we re-orthogonalise:
    //   X = Y × dorsalHint   (perpendicular to both the bone and the dorsal direction)
    //   Z = X × Y            (true dorsal, now exactly perpendicular to the bone)
    // makeBasis(X, Y, Z) then maps the ring's local +Z (where the stone sits) onto Z.
    const yAxis = boneDir3D.clone();
    const xAxis = new THREE.Vector3().crossVectors(yAxis, dorsalHint).normalize();
    if (xAxis.lengthSq() < 0.0001) xAxis.set(1, 0, 0); // bone ∥ dorsal → degenerate fallback
    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();

    const rotMatrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
    this.ringGroup.quaternion.setFromRotationMatrix(rotMatrix);

    // Apply transforms
    this.ringGroup.position.copy(ringPosition);
    this.ringGroup.scale.setScalar(requiredScale);
    this.ringGroup.visible = true;

    // Ground the ring with the soft contact shadow: sit it at the band, sized to the band
    // outer diameter, faded to a subtle opacity. It darkens the webcam pixels behind the ring.
    if (this.contactShadow) {
      this.contactShadow.position.copy(ringPosition);
      const shadowSize = requiredScale * 26; // ≈ band outer diameter in world units
      this.contactShadow.scale.set(shadowSize, shadowSize * 0.7, 1);
      (this.contactShadow.material as THREE.SpriteMaterial).opacity = 0.35;
      this.contactShadow.visible = true;
    }

    this.renderer.render(this.scene, this.camera3D);
  }

  private detectCreditCardEdges(resultsImage: any): void {
    if (this.isCalibrationLocked) return;
    const box = this.cardGuideBox;
    try {
      const cW = this.canvasElement.width;
      const cH = this.canvasElement.height;
      const iW = resultsImage.width || (this.videoElement as any).videoWidth;
      const iH = resultsImage.height || (this.videoElement as any).videoHeight;
      
      const scale = Math.max(cW / iW, cH / iH);
      const drawW = iW * scale;
      const drawH = iH * scale;
      const drawX = (cW - drawW) / 2;
      const drawY = (cH - drawH) / 2;
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = cW;
      tempCanvas.height = cH;
      const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      if (!tCtx) return;
      
      // Mirror drawing because the on-screen video is scaleX(-1)
      tCtx.translate(cW, 0);
      tCtx.scale(-1, 1);
      
      tCtx.drawImage(resultsImage, drawX, drawY, drawW, drawH);
      
      const imgData = tCtx.getImageData(box.x, box.y, box.width, box.height);
      const data = imgData.data;
      const w = box.width;
      const h = box.height;
      const gray = new Uint8ClampedArray(w * h);
      for (let i = 0; i < data.length; i += 4) {
        gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      const edge = new Float32Array(w * h);
      let maxGrad = 0;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const gradX = -1 * gray[(y - 1) * w + (x - 1)] + 1 * gray[(y - 1) * w + (x + 1)] +
            -2 * gray[y * w + (x - 1)] + 2 * gray[y * w + (x + 1)] +
            -1 * gray[(y + 1) * w + (x - 1)] + 1 * gray[(y + 1) * w + (x + 1)];
          const magnitude = Math.abs(gradX);
          edge[y * w + x] = magnitude;
          if (magnitude > maxGrad) maxGrad = magnitude;
        }
      }
      const threshold = maxGrad * 0.45;
      const columnSums = new Float32Array(w);
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let y = 0; y < h; y++) {
          if (edge[y * w + x] > threshold) sum += edge[y * w + x];
        }
        columnSums[x] = sum;
      }
      let leftCol = -1, rightCol = -1;
      for (let x = 5; x < w / 2; x++) if (columnSums[x] > 100) { leftCol = x; break; }
      for (let x = w - 6; x > w / 2; x--) if (columnSums[x] > 100) { rightCol = x; break; }
      if (leftCol !== -1 && rightCol !== -1 && (rightCol - leftCol) > w * 0.6) {
        const cardWidthPx = rightCol - leftCol;
        this.cardWidthInPixels = this.cardWidthInPixels ? this.cardWidthInPixels * 0.95 + cardWidthPx * 0.05 : cardWidthPx;
        this.detectedScale = 85.60 / this.cardWidthInPixels;
        this.ctx.lineWidth = 3; this.ctx.strokeStyle = '#00FF66';
        this.ctx.beginPath();
        this.ctx.moveTo(box.x + leftCol, box.y); this.ctx.lineTo(box.x + leftCol, box.y + box.height);
        this.ctx.moveTo(box.x + rightCol, box.y); this.ctx.lineTo(box.x + rightCol, box.y + box.height);
        this.ctx.stroke();
      } else {
        this.detectedScale = null; this.cardWidthInPixels = null;
      }
    } catch (e) {}
  }

  private calculateRingSize(landmarks: any[]): void {
    if (!this.detectedScale) return;
    const mcp5 = landmarks[5], mcp9 = landmarks[9], mcp13 = landmarks[13], mcp17 = landmarks[17];
    if (!mcp5 || !mcp9 || !mcp13 || !mcp17) return;

    let targetMcp, targetPip;
    if (appState.targetFinger === 'index') {
      targetMcp = mcp5; targetPip = landmarks[6];
    } else if (appState.targetFinger === 'middle') {
      targetMcp = mcp9; targetPip = landmarks[10];
    } else if (appState.targetFinger === 'pinky') {
      targetMcp = mcp17; targetPip = landmarks[18];
    } else { // ring
      targetMcp = mcp13; targetPip = landmarks[14];
    }

    if (!targetMcp || !targetPip) return;

    const width = this.canvasElement.width;

    const ptBaseMapped = this.mapCoordinate(targetMcp.x, targetMcp.y);
    const ptPipMapped = this.mapCoordinate(targetPip.x, targetPip.y);
    
    // We use the 3D distance between MCP and PIP (the proximal phalanx) to determine finger width.
    // 3D calculation is invariant to 2D hand rotation/yaw foreshortening.
    const dx = ptPipMapped.x - ptBaseMapped.x;
    const dy = ptPipMapped.y - ptBaseMapped.y;
    
    // MediaPipe Z is normalized roughly to image width scale
    const dz = (targetPip.z - targetMcp.z) * width; 
    
    const phalanxLength3D = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Finger base width is anatomically ~48% of the proximal phalanx length
    const pixelWidth = phalanxLength3D * 0.48;
    
    const ptTargetMcp = { x: ptBaseMapped.x, y: ptBaseMapped.y };

    this.smoothedFingerWidthPx = this.smoothedFingerWidthPx ? this.smoothedFingerWidthPx * 0.85 + pixelWidth * 0.15 : pixelWidth;
    const physicalWidthMm = this.smoothedFingerWidthPx * this.detectedScale;
    let calculatedRingSize = Math.min(Math.max((physicalWidthMm - 14.07) / 0.8128 + 3.0, 3), 14);
    const ukRingSize = this.mapToUkSize(calculatedRingSize);
    const confidenceScore = this.calculateConfidence(landmarks);

    this.latestResult = {
      physicalWidthMm: parseFloat(physicalWidthMm.toFixed(2)),
      calculatedRingSize: parseFloat(calculatedRingSize.toFixed(1)),
      confidenceScore: parseFloat(confidenceScore.toFixed(2)),
      ukRingSize
    };

    // Push calculation to variance buffer for automated locking
    // 1. Smooth the incoming phalanx length
    const lastBufferValue = this.sizingBuffer.length > 0 ? this.sizingBuffer[this.sizingBuffer.length - 1] : phalanxLength3D;
    const smoothedLength = lastBufferValue * 0.8 + phalanxLength3D * 0.2;
    this.sizingBuffer.push(smoothedLength);
    
    if (this.sizingBuffer.length > 30) this.sizingBuffer.shift();

    if (this.sizingBuffer.length === 30 && !appState.lockedSizeResult) {
      const minLength = Math.min(...this.sizingBuffer);
      const maxLength = Math.max(...this.sizingBuffer);
      if ((maxLength - minLength) < 8.0) { // Relaxed to 8.0 pixels variance
        // Stable hand detected
        const avgLength = this.sizingBuffer.reduce((a, b) => a + b, 0) / 30;
        const avgPixelWidth = avgLength * 0.48;
        const lockedMm = avgPixelWidth * this.detectedScale;
        const lockedSize = Math.min(Math.max((lockedMm - 14.07) / 0.8128 + 3.0, 3), 14);
        
        appState.lockedSizeResult = {
          physicalWidthMm: parseFloat(lockedMm.toFixed(2)),
          calculatedRingSize: parseFloat(lockedSize.toFixed(1)),
          confidenceScore: 1.0,
          ukRingSize: this.mapToUkSize(lockedSize)
        };
        
        // Show success and enable proceed button
        this.sizingBuffer = [];
        const subtitle = document.getElementById('fsm-subtitle');
        if (subtitle) {
          subtitle.innerText = `Size Locked: US Size ${lockedSize.toFixed(1)}`;
          subtitle.style.color = '#00FF66';
        }
        
        const btnProceed = document.getElementById('btn-proceed-tryon');
        if (btnProceed) {
          btnProceed.style.opacity = '1';
          btnProceed.style.pointerEvents = 'auto';
        }
      }
    }

    // Render Box
    const boxX = ptTargetMcp.x - 20, boxY = ptTargetMcp.y - 38, boxW = 180, boxH = 26;
    this.ctx.fillStyle = 'rgba(11, 15, 25, 0.85)';
    this.ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
    this.ctx.beginPath();
    this.ctx.roundRect(boxX, boxY, boxW, boxH, 6);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 11px Outfit';
    this.ctx.fillText(`Finger: ${physicalWidthMm.toFixed(1)}mm • US Size ${calculatedRingSize.toFixed(1)} (${ukRingSize})`, boxX + 8, boxY + 16);
  }


  /**
   * Helper to map US Ring Size to UK Letter Size
   */
  private mapToUkSize(usSize: number): string {
    const roundedUs = Math.round(usSize * 2) / 2; // Round to nearest 0.5 size
    
    // Mapping dictionary for standard US to UK sizes
    const mapping: Record<number, string> = {
      3.0: 'F',
      3.5: 'G',
      4.0: 'H',
      4.5: 'I',
      5.0: 'J 1/2',
      5.5: 'L',
      6.0: 'M',
      6.5: 'N',
      7.0: 'O',
      7.5: 'P',
      8.0: 'Q',
      8.5: 'R',
      9.0: 'S',
      9.5: 'T 1/2',
      10.0: 'U 1/2',
      10.5: 'W',
      11.0: 'X',
      11.5: 'Y',
      12.0: 'Z',
      12.5: 'Z+1',
      13.0: 'Z+2',
      13.5: 'Z+3',
      14.0: 'Z+4'
    };

    return mapping[roundedUs] || 'Unknown';
  }

  /**
   * Calculates confidence score based on hand perspective and key landmarks
   */
  private calculateConfidence(landmarks: any[]): number {
    // 1. Check hand rotation/flatness:
    // Compare ring finger length (from MCP 13 to TIP 16) with finger bases.
    // If hand is tilted, landmarks relative distance changes.
    // We also check hand z-coordinates. A large z-variance on flat hand landmarks suggests tilt.
    const pt13 = landmarks[13];
    const pt16 = landmarks[16];
    
    if (!pt13 || !pt16) return 0.5;

    // Ring finger length in normalized units
    const fingerLength = Math.sqrt(
      Math.pow(pt16.x - pt13.x, 2) + Math.pow(pt16.y - pt13.y, 2)
    );

    // If finger is extremely flexed or hand tilted, length shrinks.
    // Optimal finger length in normalized coordinates is around 0.15 - 0.30
    let lengthScore = 1.0;
    if (fingerLength < 0.12) {
      lengthScore = fingerLength / 0.12; // lower confidence
    }

    // 2. Check Z coordinates (tilted hand check)
    // Flat hand means Z-coordinates of joints 9, 13, 17 are very close
    const z9 = landmarks[9].z || 0;
    const z13 = landmarks[13].z || 0;
    const z17 = landmarks[17].z || 0;

    const zVariance = Math.abs(z9 - z13) + Math.abs(z13 - z17);
    let tiltScore = 1.0 - zVariance * 3.0; // Deduct score for large variance
    if (tiltScore < 0) tiltScore = 0;

    // 3. Card stability score
    const cardScore = this.detectedScale ? 1.0 : 0.0;

    const finalScore = (lengthScore * 0.4) + (tiltScore * 0.4) + (cardScore * 0.2);
    return Math.min(Math.max(finalScore, 0.1), 1.0);
  }

  /**
   * Draws guide layouts and information texts on canvas
   */
  private drawOverlays(): void {
    const box = this.cardGuideBox;

    // Draw credit card guide box with glassmorphism visual hint
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    this.ctx.fillRect(box.x, box.y, box.width, box.height);

    this.ctx.lineWidth = 2;
    // Glowing borders depending on detection state
    this.ctx.strokeStyle = this.detectedScale ? 'rgba(0, 255, 102, 0.8)' : 'rgba(255, 255, 255, 0.25)';
    this.ctx.strokeRect(box.x, box.y, box.width, box.height);

    // Corner highlights
    const cornerSize = 15;
    this.ctx.strokeStyle = this.detectedScale ? '#00FF66' : '#FFFFFF';
    this.ctx.lineWidth = 4;

    // Top-Left corner
    this.ctx.beginPath();
    this.ctx.moveTo(box.x + cornerSize, box.y);
    this.ctx.lineTo(box.x, box.y);
    this.ctx.lineTo(box.x, box.y + cornerSize);
    this.ctx.stroke();

    // Top-Right corner
    this.ctx.beginPath();
    this.ctx.moveTo(box.x + box.width - cornerSize, box.y);
    this.ctx.lineTo(box.x + box.width, box.y);
    this.ctx.lineTo(box.x + box.width, box.y + cornerSize);
    this.ctx.stroke();

    // Bottom-Left corner
    this.ctx.beginPath();
    this.ctx.moveTo(box.x + cornerSize, box.y + box.height);
    this.ctx.lineTo(box.x, box.y + box.height);
    this.ctx.lineTo(box.x, box.y + box.height - cornerSize);
    this.ctx.stroke();

    // Bottom-Right corner
    this.ctx.beginPath();
    this.ctx.moveTo(box.x + box.width - cornerSize, box.y + box.height);
    this.ctx.lineTo(box.x + box.width, box.y + box.height);
    this.ctx.lineTo(box.x + box.width, box.y + box.height - cornerSize);
    this.ctx.stroke();

    // Guide text inside the card box
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '12px Outfit';
    this.ctx.textAlign = 'center';
    
    if (!this.detectedScale) {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      this.ctx.fillText('ALIGN CREDIT CARD HERE', box.x + box.width / 2, box.y + box.height / 2 - 5);
      this.ctx.font = '10px Outfit';
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      this.ctx.fillText('(Hold flat next to your hand)', box.x + box.width / 2, box.y + box.height / 2 + 12);
    } else {
      this.ctx.fillStyle = '#00FF66';
      this.ctx.fillText('CARD ALIGNED', box.x + box.width / 2, box.y + box.height / 2 + 5);
    }
    this.ctx.textAlign = 'left'; // Reset
  }

  private drawHandOverlay(landmarks: any[]): void {
    const ringJoints = [13, 14, 15, 16];
    
    // Draw all knuckles for visual context
    landmarks.forEach((landmark, idx) => {
      const mapped = this.mapCoordinate(landmark.x, landmark.y);
      const x = mapped.x;
      const y = mapped.y;

      // Draw standard points in white
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      this.ctx.beginPath();
      this.ctx.arc(x, y, 3, 0, 2 * Math.PI);
      this.ctx.fill();

      // Highlight Ring Finger joints (13-16) in gold
      if (ringJoints.includes(idx)) {
        this.ctx.fillStyle = '#D4AF37'; // Gold
        this.ctx.shadowColor = '#D4AF37';
        this.ctx.shadowBlur = 8;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 6, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.shadowBlur = 0; // Reset
      }
    });

    // Draw lines between ring finger joints
    this.ctx.strokeStyle = '#D4AF37';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    for (let i = 0; i < ringJoints.length - 1; i++) {
      const ptA = landmarks[ringJoints[i]];
      const ptB = landmarks[ringJoints[i + 1]];
      const mappedA = this.mapCoordinate(ptA.x, ptA.y);
      const mappedB = this.mapCoordinate(ptB.x, ptB.y);
      this.ctx.moveTo(mappedA.x, mappedA.y);
      this.ctx.lineTo(mappedB.x, mappedB.y);
    }
    this.ctx.stroke();
  }

  /**
   * Retrieves the latest calibration telemetry
   */
  public getCalibrationData(): CalibrationResult | null {
    return this.latestResult;
  }
}
