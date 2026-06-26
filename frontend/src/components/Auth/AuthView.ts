import { ApiClient } from '../../api/apiClient';
import { appState } from '../../state/store';

export function renderAuthForm(container: HTMLElement, onLoginSuccess: () => void) {
  container.innerHTML = `
    <div class="glass-panel">
      <h2 style="margin-bottom: 1.5rem; text-align: center; color: var(--accent-gold);">Create Account or Login</h2>
      <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 1.5rem;">
        <button class="btn btn-primary" id="btn-tab-login">Login</button>
        <button class="btn btn-secondary" id="btn-tab-register">Register</button>
      </div>
      
      <form id="auth-form-submit" class="auth-form">
        <div class="form-group">
          <label for="auth-email">Email Address</label>
          <input type="email" id="auth-email" required placeholder="name@example.com" />
        </div>
        <div class="form-group">
          <label for="auth-password">Password</label>
          <input type="password" id="auth-password" required placeholder="••••••••" />
        </div>
        <button type="submit" class="btn btn-primary" style="margin-top: 1rem;" id="auth-submit-btn">Login</button>
      </form>
      <div id="auth-error-msg" style="color: #f87171; text-align: center; margin-top: 1rem; font-size: 0.9rem;"></div>
    </div>
  `;

  let isRegisterTab = false;
  const submitBtn = document.getElementById('auth-submit-btn');
  const errorMsg = document.getElementById('auth-error-msg');
  const form = document.getElementById('auth-form-submit') as HTMLFormElement;

  document.getElementById('btn-tab-login')?.addEventListener('click', () => {
    isRegisterTab = false;
    document.getElementById('btn-tab-login')?.setAttribute('class', 'btn btn-primary');
    document.getElementById('btn-tab-register')?.setAttribute('class', 'btn btn-secondary');
    if (submitBtn) submitBtn.innerText = 'Login';
    if (errorMsg) errorMsg.innerText = '';
  });

  document.getElementById('btn-tab-register')?.addEventListener('click', () => {
    isRegisterTab = true;
    document.getElementById('btn-tab-login')?.setAttribute('class', 'btn btn-secondary');
    document.getElementById('btn-tab-register')?.setAttribute('class', 'btn btn-primary');
    if (submitBtn) submitBtn.innerText = 'Register';
    if (errorMsg) errorMsg.innerText = '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('auth-email') as HTMLInputElement).value;
    const password = (document.getElementById('auth-password') as HTMLInputElement).value;

    if (errorMsg) errorMsg.innerText = '';

    if (appState.backendConnected) {
      const endpoint = isRegisterTab ? '/auth/register' : '/auth/login';
      try {
        const data = await ApiClient.post<any>(endpoint, { email, password });
        appState.setAuth(true, data.user);
        onLoginSuccess();
      } catch (err: any) {
        if (errorMsg) errorMsg.innerText = err.message || 'Authentication failed';
      }
    } else {
      // Mock login for offline mode
      const mockUser = { id: 1, email: email, role: 'USER' };
      localStorage.setItem('aura_mock_user', JSON.stringify(mockUser));
      appState.setAuth(false, mockUser);
      onLoginSuccess();
    }
  });
}
