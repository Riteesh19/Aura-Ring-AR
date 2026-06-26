import { renderAuthForm } from '../components/Auth/AuthView';
import { checkSession } from '../main';

export function renderLandingView(container: HTMLElement) {
  container.innerHTML = `
    <div style="display: flex; gap: 2rem; max-width: 1200px; margin: 0 auto; width: 100%;">
      <div id="landing-auth" style="flex: 1;"></div>
      <div id="landing-hero" style="flex: 1; display: flex; align-items: center; justify-content: center;">
        <div class="glass-panel" style="text-align: center; width: 100%;">
          <h2 style="color: var(--accent-gold); margin-bottom: 1rem; font-size: 2rem;">Aura AR Try-On</h2>
          <p style="color: var(--text-secondary); font-size: 1.1rem; line-height: 1.6;">Sign in or create a local account to calibrate your size and purchase custom-made bands using our advanced computer vision measuring system.</p>
          <img src="/solitaire_diamond_ring.png" style="width: 200px; margin-top: 2rem; border-radius: 50%; box-shadow: 0 0 40px rgba(212,175,55,0.2);" />
        </div>
      </div>
    </div>
  `;
  
  const authContainer = document.getElementById('landing-auth');
  if (authContainer) {
    renderAuthForm(authContainer, checkSession);
  }
}
