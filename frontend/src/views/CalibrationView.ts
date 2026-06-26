import { renderARWorkspace } from '../components/AR/ARWorkspace';

export function renderCalibrationView(container: HTMLElement) {
  container.innerHTML = `
    <div style="max-width: 800px; margin: 0 auto; width: 100%;">
      <div id="calibration-content"></div>
    </div>
  `;
  
  const calContainer = document.getElementById('calibration-content');
  if (calContainer) {
    renderARWorkspace(calContainer);
  }
}
