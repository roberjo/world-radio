export function initShortcutsHelp(): void {
  const overlay = document.getElementById('shortcuts-overlay')!;
  const closeBtn = document.getElementById('shortcuts-close')!;

  const toggle = (): void => { overlay.classList.toggle('visible'); };
  const close = (): void => overlay.classList.remove('visible');

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === '?') {
      e.preventDefault();
      toggle();
      return;
    }
    if (e.key === 'Escape' && overlay.classList.contains('visible')) close();
  });
}
