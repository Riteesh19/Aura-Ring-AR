import './index.css';
import { appState } from './state/store';
import { ApiClient } from './api/apiClient';
import { initRouter } from './router';

const appContainer = document.querySelector<HTMLDivElement>('#app')!;

/**
 * Bootstrap the Application Shell
 */
async function bootstrap() {
  appContainer.innerHTML = `
    <header style="display: flex; justify-content: space-between; align-items: center;">
      <div class="logo">AURA Ring AR</div>
      <nav style="display: flex; gap: 1rem;">
        <a href="#/shop" class="nav-link" id="nav-shop" style="color: var(--text-primary); text-decoration: none; font-weight: 600;">Shop</a>
        <a href="#/calibrate" class="nav-link" id="nav-calibrate" style="color: var(--text-primary); text-decoration: none; font-weight: 600;">AR Calibration</a>
      </nav>
      <div class="auth-status" id="auth-status-display">Checking session...</div>
    </header>
    
    <div class="app-container" id="app-content" style="padding-top: 2rem;">
      <!-- Router Views injected here -->
    </div>

    <!-- Privacy Disclosure Modal -->
    <div class="modal-overlay" id="privacy-modal">
      <div class="modal-content glass-panel">
        <h3>Privacy & Camera Access</h3>
        <p>Aura Ring AR needs access to your camera to measure your finger size and show you a virtual ring.</p>
        <div class="modal-features">
          <div class="modal-feature">
            <span class="modal-feature-icon">✓</span>
            <span>All biometric processing is done <strong>locally on your device</strong>. No images are sent to our servers.</span>
          </div>
          <div class="modal-feature">
            <span class="modal-feature-icon">✓</span>
            <span>Only mathematical coordinate data (finger width in mm) is saved to your profile if you choose to "Save to Profile".</span>
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1rem;">
          <button class="btn btn-secondary" onclick="document.getElementById('privacy-modal').classList.remove('active')">Cancel</button>
          <button class="btn btn-primary" id="btn-accept-privacy">Accept & Continue</button>
        </div>
      </div>
    </div>
  `;

  await checkSession();
  
  // Load History
  if (appState.currentUser) {
    await fetchSavedSizes();
  }

  // Boot Router
  initRouter();
}

/**
 * Check Authentication Session
 */
export async function checkSession() {
  const statusDisplay = document.getElementById('auth-status-display');
  try {
    const data = await ApiClient.checkAuth();
    appState.setAuth(true, data.user);
    if (statusDisplay) {
      statusDisplay.innerHTML = `Connected as <strong>\${data.user.email}</strong> <button id="btn-logout" style="margin-left:10px; background:transparent; border:1px solid #ff4444; color:#ff4444; border-radius:4px; padding:2px 8px; cursor:pointer;">Logout</button>`;
      document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
    }
  } catch (err) {
    const mockUserStr = localStorage.getItem('aura_mock_user');
    if (mockUserStr) {
      const u = JSON.parse(mockUserStr);
      appState.setAuth(false, u);
      if (statusDisplay) {
        statusDisplay.innerHTML = `Offline Mock User: <strong>\${u.email}</strong> <button id="btn-logout" style="margin-left:10px; background:transparent; border:1px solid #ff4444; color:#ff4444; border-radius:4px; padding:2px 8px; cursor:pointer;">Logout</button>`;
        document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
      }
    } else {
      appState.setAuth(false, null);
      if (statusDisplay) statusDisplay.innerHTML = `Not logged in`;
    }
  }
}

/**
 * Fetch past sizing history
 */
async function fetchSavedSizes() {
  if (appState.backendConnected) {
    try {
      const data = await ApiClient.getSavedSizes();
      appState.setSizes(data.sizes);
    } catch (e) {
      console.error('Failed to fetch sizes');
    }
  } else {
    const s = JSON.parse(localStorage.getItem('aura_mock_sizes') || '[]');
    appState.setSizes(s);
  }
}

/**
 * Handle Logout
 */
async function handleLogout() {
  if (appState.backendConnected) {
    try {
      await ApiClient.post('/auth/logout', {});
    } catch (e) {}
  }
  localStorage.removeItem('aura_mock_user');
  appState.setAuth(false, null);
  await checkSession();
}

// Start app
bootstrap();
