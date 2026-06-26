import { appState } from "../state/store";

import { renderLandingView } from '../views/LandingView';
import { renderShopView } from '../views/ShopView';
import { renderCalibrationView } from '../views/CalibrationView';
import { renderTestView } from '../views/TestView';


export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  
  // Also handle global auth state changes to redirect if logged out
  appState.subscribe(() => {
    if (!appState.currentUser && window.location.hash !== '') {
      window.location.hash = ''; // Redirect to landing
    }
  });

  handleRoute();
}

function handleRoute() {
  const hash = window.location.hash || '#/';
  const appContainer = document.querySelector<HTMLDivElement>('#app-content')!;
  
  appContainer.innerHTML = '';

  switch(hash) {
    case '#/':
      if (appState.currentUser) {
        window.location.hash = '#/shop';
        return;
      }
      renderLandingView(appContainer);
      updateNav('');
      break;
    case '#/shop':
      if (!appState.currentUser) { window.location.hash = '#/'; return; }
      renderShopView(appContainer);
      updateNav('shop');
      break;
    case '#/calibrate':
    case '#/ar':
      if (!appState.currentUser) { window.location.hash = '#/'; return; }
      renderCalibrationView(appContainer);
      updateNav('ar');
      break;
    case '#/test':
      renderTestView(appContainer);
      break;
    default:
      window.location.hash = '#/';
  }
}

function updateNav(activeId: string) {
  document.querySelectorAll('.nav-link').forEach(el => {
    el.classList.remove('active-nav');
    if (el.id === 'nav-' + activeId) {
      el.classList.add('active-nav');
    }
  });
}
