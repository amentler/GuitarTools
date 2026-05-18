export function wireLoadMenu(ui) {
  if (!ui.loadMenuBtn || !ui.loadMenuPanel) return;
  ui.loadMenuBtn.addEventListener('click', () => {
    const open = ui.loadMenuPanel.classList.toggle('u-hidden') === false;
    ui.loadMenuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('click', (e) => {
    if (ui.loadMenuPanel.classList.contains('u-hidden')) return;
    if (e.target === ui.loadMenuBtn || ui.loadMenuPanel.contains(e.target)) return;
    closeLoadMenu(ui);
  });
}

export function closeLoadMenu(ui) {
  ui.loadMenuPanel?.classList.add('u-hidden');
  ui.loadMenuBtn?.setAttribute('aria-expanded', 'false');
}
