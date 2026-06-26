import { Button } from '../Button/Button';

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState(props: EmptyStateProps): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'empty-state';
  container.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    text-align: center;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed var(--glass-border);
    border-radius: var(--border-radius-md);
    color: var(--text-secondary);
  `;

  let html = '';
  if (props.icon) {
    html += `<div style="font-size: 2.5rem; margin-bottom: 1rem; opacity: 0.8;">${props.icon}</div>`;
  }
  
  html += `
    <h4 style="color: var(--text-primary); font-size: 1.1rem; margin-bottom: 0.5rem;">${props.title}</h4>
    <p style="font-size: 0.9rem; max-width: 300px; margin: 0 auto; line-height: 1.5;">${props.description}</p>
  `;

  container.innerHTML = html;

  if (props.actionLabel && props.onAction) {
    const actionBtnContainer = document.createElement('div');
    actionBtnContainer.style.marginTop = '1.5rem';
    const actionBtn = Button({
      variant: 'secondary',
      size: 'sm',
      label: props.actionLabel,
      onClick: props.onAction
    });
    actionBtnContainer.appendChild(actionBtn);
    container.appendChild(actionBtnContainer);
  }

  return container;
}
