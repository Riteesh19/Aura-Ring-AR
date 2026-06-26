export interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  label: string;
  icon?: string;
  id?: string;
  style?: string;
  className?: string;
  isLoading?: boolean;
  isDisabled?: boolean;
  ariaLabel?: string;
  onClick?: (e: MouseEvent) => void;
  type?: 'button' | 'submit' | 'reset';
}

export function Button(props: ButtonProps): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = props.type || 'button';
  
  if (props.id) btn.id = props.id;
  if (props.ariaLabel) btn.setAttribute('aria-label', props.ariaLabel);

  // Styling
  let cssClass = `btn btn-${props.variant}`;
  if (props.size === 'sm') cssClass += ' btn-sm';
  if (props.size === 'lg') cssClass += ' btn-lg';
  if (props.className) cssClass += ` ${props.className}`;
  btn.className = cssClass;

  if (props.style) btn.style.cssText = props.style;

  // Content
  let contentHtml = props.label;
  if (props.icon) {
    contentHtml = `<span style="margin-right:0.5rem">${props.icon}</span>${contentHtml}`;
  }
  btn.innerHTML = contentHtml;

  // State Handling
  if (props.isDisabled) {
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
  }

  if (props.isLoading) {
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
    btn.setAttribute('aria-busy', 'true');
    btn.innerHTML = `<span class="spinner" style="width:1rem;height:1rem;display:inline-block;border:2px solid rgba(255,255,255,0.3);border-radius:50%;border-top-color:#fff;animation:spin 1s ease-in-out infinite;margin-right:0.5rem;"></span> Loading...`;
  }

  // Event
  if (props.onClick && !props.isDisabled && !props.isLoading) {
    btn.addEventListener('click', props.onClick);
  }

  return btn;
}

export function injectGlobalButtonStyles() {
  if (document.getElementById('ui-button-styles')) return;
  const style = document.createElement('style');
  style.id = 'ui-button-styles';
  style.innerHTML = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .btn-sm { padding: 0.4rem 0.8rem; font-size: 0.8rem; }
    .btn-lg { padding: 1rem 2rem; font-size: 1.1rem; }
  `;
  document.head.appendChild(style);
}
