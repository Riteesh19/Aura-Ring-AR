export interface CardProps {
  title?: string;
  subtitle?: string;
  children?: HTMLElement | HTMLElement[];
  className?: string;
  style?: string;
}

export function Card(props: CardProps): HTMLDivElement {
  const container = document.createElement('div');
  container.className = `glass-panel ${props.className || ''}`.trim();
  if (props.style) container.style.cssText = props.style;

  if (props.title) {
    const titleEl = document.createElement('h3');
    titleEl.style.color = 'var(--accent-gold)';
    titleEl.style.marginBottom = props.subtitle ? '0.2rem' : '1.2rem';
    titleEl.style.fontSize = '1.4rem';
    titleEl.innerText = props.title;
    container.appendChild(titleEl);
  }

  if (props.subtitle) {
    const subEl = document.createElement('p');
    subEl.style.color = 'var(--text-secondary)';
    subEl.style.fontSize = '0.8rem';
    subEl.style.marginBottom = '1.2rem';
    subEl.innerText = props.subtitle;
    container.appendChild(subEl);
  }

  if (props.children) {
    if (Array.isArray(props.children)) {
      props.children.forEach(child => container.appendChild(child));
    } else {
      container.appendChild(props.children);
    }
  }

  return container;
}
