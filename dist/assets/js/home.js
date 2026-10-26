// Keep the layout in sync with embedded browsers as their visible viewport resizes.
const root = document.documentElement;
let viewportFrame = 0;
function updateViewportHeight() {
  viewportFrame = 0;
  const viewport = window.visualViewport;
  const height = viewport && viewport.scale === 1 ? viewport.height : window.innerHeight;
  root.style.setProperty('--home-viewport-height', `${height}px`);
}
function scheduleViewportUpdate() {
  if (!viewportFrame) viewportFrame = requestAnimationFrame(updateViewportHeight);
}
updateViewportHeight();
window.addEventListener('resize', scheduleViewportUpdate, { passive: true });
window.addEventListener('pageshow', scheduleViewportUpdate);
window.visualViewport?.addEventListener('resize', scheduleViewportUpdate, { passive: true });

const button = document.querySelector('#dashboard-button');
const dialog = document.querySelector('#dashboard-dialog');
button.addEventListener('click', () => dialog.showModal());
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
});
