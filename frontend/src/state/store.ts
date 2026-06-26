type StateChangeListener = () => void;

class Store {
  private listeners: StateChangeListener[] = [];

  // Global Mutable State
  public backendConnected: boolean = false;
  public currentUser: any = null;
  public savedSizes: any[] = [];
  public inventoryCatalog: any[] = [];
  public activeBuilderTab: 'setting' | 'stone' | 'summary' = 'setting';

  // Ring Builder Options
  public selectedMetal: string = 'White Gold';
  public ringSetting: string = 'Solitaire'; // New naming from user spec
  public selectedSetting: string = 'Solitaire'; // Legacy
  public selectedStone: string = 'Diamond';
  public stoneShape: string = 'Round';
  public selectedCarat: number = 1.0;
  
  // Wizard State
  public shopStep: number = 1;
  public cart: { diamond: any; setting: any } = { diamond: null, setting: null };

  // Calibration State
  public latestCalibratedData: any = null;
  public lockedSizeResult: any = null;
  public isSizeLocked: boolean = false;
  public targetFinger: 'index' | 'middle' | 'ring' | 'pinky' = 'ring';
  public autoStartCamera: boolean = false;
  
  // Strict AR Finite State Machine
  public arFsmState: 'CALIBRATION' | 'SIZING' | 'TRY_ON' = 'CALIBRATION';

  subscribe(listener: StateChangeListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(listener => listener());
  }

  // Setters
  setAuth(connected: boolean, user?: any) {
    this.backendConnected = connected;
    if (user) this.currentUser = user;
    this.notify();
  }

  setSizes(sizes: any[]) {
    this.savedSizes = sizes;
    this.notify();
  }

  setInventory(inventory: any[]) {
    this.inventoryCatalog = inventory;
    this.notify();
  }

  setRingOptions(options: Partial<{ metal: string; setting: string; ringSetting: string; stone: string; shape: string; carat: number }>) {
    if (options.metal) this.selectedMetal = options.metal;
    if (options.setting) this.selectedSetting = options.setting;
    if (options.ringSetting) this.ringSetting = options.ringSetting;
    if (options.stone) this.selectedStone = options.stone;
    if (options.shape) this.stoneShape = options.shape;
    if (options.carat !== undefined) this.selectedCarat = options.carat;
    this.notify();
  }

  setTab(tab: 'setting' | 'stone' | 'summary') {
    this.activeBuilderTab = tab;
    this.notify();
  }

  setCalibrationData(data: any) {
    this.latestCalibratedData = data;
    this.notify();
  }

  lockSize(result: any) {
    this.lockedSizeResult = result;
    this.isSizeLocked = true;
    this.notify();
  }

  setTargetFinger(finger: 'index' | 'middle' | 'ring' | 'pinky') {
    this.targetFinger = finger;
    this.notify();
  }
  
  setArFsmState(state: 'CALIBRATION' | 'SIZING' | 'TRY_ON') {
    this.arFsmState = state;
    this.notify();
  }

  resetSizing() {
    this.lockedSizeResult = null;
    this.isSizeLocked = false;
    this.latestCalibratedData = null;
    this.arFsmState = 'CALIBRATION';
    this.notify();
  }
}

export const appState = new Store();
