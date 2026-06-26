import { renderStoreAndSizes } from '../components/Shop/Customizer';

export function renderShopView(container: HTMLElement) {
  container.innerHTML = `
    <div style="max-width: 800px; margin: 0 auto; width: 100%;">
      <div id="shop-content"></div>
    </div>
  `;
  
  const shopContainer = document.getElementById('shop-content');
  if (shopContainer) {
    renderStoreAndSizes(shopContainer);
  }
}
