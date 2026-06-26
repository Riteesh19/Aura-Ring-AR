import { appState } from '../../state/store';

const SHAPES = ['Round', 'Oval', 'Emerald', 'Princess', 'Cushion', 'Radiant'];
const GEMS = ['Diamond', 'Sapphire', 'Ruby', 'Emerald', 'Morganite'];
const METALS = ['18k White Gold', '18k Yellow Gold', '14k Rose Gold', 'Platinum'];
const STYLES = ['Solitaire', 'Halo', 'Hidden Halo', 'Three Stone'];

const DIAMOND_IMG_MAP: Record<string, string> = {
  'Round': '/diamonds/round.png',
  'Oval': '/diamonds/oval.png',
  'Emerald': '/diamonds/emerald.png',
  'Princess': '/diamonds/princess.png',
  'Cushion': '/diamonds/cushion.png',
  'Radiant': '/diamonds/radiant.png'
};

const SETTING_IMG_MAP: Record<string, string> = {
  'Solitaire': '/settings/solitaire.png',
  'Halo': '/settings/halo.png',
  'Hidden Halo': '/settings/hidden_halo.png',
  'Three Stone': '/settings/threestone.png'
};

const DIAMOND_CATALOG = Array.from({ length: 150 }).map((_, i) => {
  const selectedShape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  return {
    id: `d${i}`,
    type: GEMS[i % GEMS.length],
    shape: selectedShape,
    carat: (Math.random() * 3 + 0.5).toFixed(2),
    price: Math.floor(Math.random() * 15000 + 800),
    img: DIAMOND_IMG_MAP[selectedShape] // PERFECT SYNC
  };
});

const SETTING_CATALOG = Array.from({ length: 150 }).map((_, i) => {
  const selectedStyle = STYLES[i % STYLES.length];
  return {
    id: `s${i}`,
    style: selectedStyle,
    metal: METALS[Math.floor(Math.random() * METALS.length)],
    price: Math.floor(Math.random() * 3000 + 500),
    img: SETTING_IMG_MAP[selectedStyle] // PERFECT SYNC
  };
});

let globalContainer: HTMLElement | null = null;

// Local UI state
let currentStep = 1;
let shapeFilter = 'All';
let styleFilter = 'All';

export function renderStoreAndSizes(container: HTMLElement) {
  globalContainer = container;
  renderUI();
}

function renderUI() {
  if (!globalContainer) return;
  const container = globalContainer;

  const filteredDiamonds = DIAMOND_CATALOG.filter(d => shapeFilter === 'All' || d.shape === shapeFilter);
  const filteredSettings = SETTING_CATALOG.filter(s => styleFilter === 'All' || s.style === styleFilter);

  const renderFilters = (options: string[], currentFilter: string, isShape: boolean) => {
    return options.map(f => `
      <button data-filter-type="${isShape ? 'shape' : 'style'}" data-filter-val="${f}" class="filter-btn px-4 py-2 rounded-full border text-sm font-bold whitespace-nowrap transition-colors ${currentFilter === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-gray-300'}">
        ${f}
      </button>
    `).join('');
  };

  const step1Html = currentStep === 1 ? `
    <div class="p-4">
      <div class="flex gap-2 overflow-x-auto pb-4 mb-4 hide-scrollbar">
        ${renderFilters(['All', ...SHAPES], shapeFilter, true)}
      </div>
      <div class="grid grid-cols-2 gap-4">
        ${filteredDiamonds.map(item => `
          <div data-diamond-id="${item.id}" class="diamond-card bg-white p-3 rounded-xl border-2 cursor-pointer hover:shadow-lg transition-all ${appState.cart.diamond?.id === item.id ? 'border-slate-900 ring-2 ring-slate-900' : 'border-gray-100'}">
            <div class="bg-gray-50 rounded-lg aspect-square mb-3 flex items-center justify-center overflow-hidden">
              <img src="${item.img}" alt="${item.shape} ${item.type}" class="w-full h-full object-cover mix-blend-multiply" />
            </div>
            <p class="font-extrabold text-slate-900">${item.carat}ct ${item.shape} ${item.type}</p>
            <p class="text-slate-500 font-medium">$${item.price.toLocaleString()}</p>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  const step2Html = currentStep === 2 ? `
    <div class="p-4">
      <div class="flex gap-2 overflow-x-auto pb-4 mb-4 hide-scrollbar">
        ${renderFilters(['All', ...STYLES], styleFilter, false)}
      </div>
      <div class="grid grid-cols-2 gap-4">
        ${filteredSettings.map(item => `
          <div data-setting-id="${item.id}" class="setting-card bg-white p-3 rounded-xl border-2 cursor-pointer hover:shadow-lg transition-all ${appState.cart.setting?.id === item.id ? 'border-slate-900 ring-2 ring-slate-900' : 'border-gray-100'}">
            <div class="bg-gray-50 rounded-lg aspect-square mb-3 flex items-center justify-center overflow-hidden">
              <img src="${item.img}" alt="${item.style}" class="w-full h-full object-cover mix-blend-multiply" />
            </div>
            <p class="font-extrabold text-slate-900 capitalize">${item.style}</p>
            <p class="text-slate-500 text-sm">${item.metal}</p>
            <p class="text-slate-900 font-medium mt-1">$${item.price.toLocaleString()}</p>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  const step3Html = (currentStep === 3 && appState.cart.diamond && appState.cart.setting) ? `
    <div class="p-6 text-center mt-10">
      <h2 class="text-3xl font-extrabold text-slate-900 mb-2">Your Masterpiece</h2>
      <p class="text-slate-600 mb-8">${appState.cart.diamond.carat}ct ${appState.cart.diamond.shape} ${appState.cart.diamond.type} set in a ${appState.cart.setting.metal} ${appState.cart.setting.style} setting.</p>
      <button id="btn-ar-try-on" class="w-full bg-slate-900 hover:bg-black text-white font-extrabold py-5 rounded-xl shadow-2xl text-lg transition-transform transform hover:scale-105">
        LIVE AR TRY-ON
      </button>
    </div>
  ` : '';

  container.innerHTML = `
    <div class="bg-slate-50 min-h-screen pb-24">
      <div class="flex bg-white shadow-sm sticky top-0 z-20">
        <button id="nav-step-1" class="flex-1 py-4 text-sm font-bold border-b-4 ${currentStep === 1 ? 'border-slate-900 text-slate-900' : 'border-transparent text-gray-400'}">1. LOOSE DIAMONDS</button>
        <button id="nav-step-2" class="flex-1 py-4 text-sm font-bold border-b-4 ${currentStep === 2 ? 'border-slate-900 text-slate-900' : 'border-transparent text-gray-400'}">2. SETTINGS</button>
      </div>
      ${step1Html}
      ${step2Html}
      ${step3Html}
    </div>
  `;

  bindEvents();
}

function bindEvents() {
  document.getElementById('nav-step-1')?.addEventListener('click', () => {
    currentStep = 1;
    renderUI();
  });

  document.getElementById('nav-step-2')?.addEventListener('click', () => {
    currentStep = 2;
    renderUI();
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-filter-type');
      const val = btn.getAttribute('data-filter-val');
      if (type === 'shape' && val) shapeFilter = val;
      if (type === 'style' && val) styleFilter = val;
      renderUI();
    });
  });

  document.querySelectorAll('.diamond-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-diamond-id');
      const item = DIAMOND_CATALOG.find(d => d.id === id);
      if (item) {
        appState.cart.diamond = item;
        currentStep = 2;
        appState.notify();
        renderUI();
      }
    });
  });

  document.querySelectorAll('.setting-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-setting-id');
      const item = SETTING_CATALOG.find(s => s.id === id);
      if (item) {
        appState.cart.setting = item;
        currentStep = 3;
        appState.notify();
        renderUI();
      }
    });
  });

  document.getElementById('btn-ar-try-on')?.addEventListener('click', () => {
    appState.setArFsmState('TRY_ON');
    window.location.hash = '#/calibrate';
    appState.autoStartCamera = true;
    appState.notify();
  });
}
