/** Enhance a native select while keeping its value as the form's source of truth. */
export function enhanceSelect(select) {
  const wrap = select.parentElement;
  const label = select.form.querySelector(`label[for="${select.id}"]`);
  const options = Array.from(select.options).filter(option => !option.disabled && option.value);
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.id = `${select.id}-trigger`;
  trigger.className = 'select-trigger';
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-required', String(select.required));
  trigger.setAttribute('aria-describedby', select.getAttribute('aria-describedby') || '');
  const value = document.createElement('span');
  value.className = 'select-value';
  trigger.append(value);
  const caret = document.createElement('span');
  caret.className = 'select-caret';
  caret.setAttribute('aria-hidden', 'true');
  trigger.append(caret);
  if (label) {
    label.id ||= `${select.id}-label`;
    label.htmlFor = trigger.id;
    trigger.setAttribute('aria-labelledby', label.id);
  }
  const popup = document.createElement('div');
  popup.id = `${select.id}-listbox`;
  popup.className = 'select-popup';
  popup.hidden = true;
  popup.setAttribute('role', 'listbox');
  popup.setAttribute('aria-labelledby', label?.id || trigger.id);
  trigger.setAttribute('aria-controls', popup.id);
  const items = options.map((option, index) => {
    const item = document.createElement('div');
    item.id = `${select.id}-option-${index}`;
    item.className = 'select-option';
    item.setAttribute('role', 'option');
    item.textContent = option.textContent;
    item.addEventListener('pointermove', () => activate(index, false));
    item.addEventListener('pointerdown', event => event.preventDefault());
    item.addEventListener('click', () => choose(index));
    popup.append(item);
    return item;
  });
  wrap.append(trigger);
  document.body.append(popup);
  wrap.classList.add('enhanced-select');
  select.hidden = true;
  let active = 0;
  let search = '';
  let searchTimer;

  function position() {
    if (popup.hidden) return;
    const bounds = trigger.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportHeight = viewport?.height || innerHeight;
    const viewportTop = viewport?.offsetTop || 0;
    const below = viewportHeight + viewportTop - bounds.bottom - 16;
    const above = bounds.top - viewportTop - 16;
    const preferredHeight = Math.min(popup.scrollHeight, 290);
    const placeAbove = below < preferredHeight && above > below;
    const room = Math.max(72, placeAbove ? above : below);
    popup.style.width = `${bounds.width}px`;
    popup.style.left = `${Math.min(Math.max(12, bounds.left), innerWidth - bounds.width - 12)}px`;
    popup.style.maxHeight = `${Math.min(290, room)}px`;
    popup.dataset.side = placeAbove ? 'above' : 'below';
    popup.style.top = `${placeAbove ? bounds.top - Math.min(preferredHeight,room) - 8 : bounds.bottom + 8}px`;
  }
  function activate(index, scroll = true) {
    active = Math.max(0, Math.min(options.length - 1, index));
    items.forEach((item,i) => item.classList.toggle('is-active', i === active));
    trigger.setAttribute('aria-activedescendant', items[active].id);
    if (scroll) items[active].scrollIntoView({ block:'nearest' });
  }
  function sync() {
    const selected = options.findIndex(option => option.value === select.value);
    value.textContent = selected < 0 ? 'Select an option' : options[selected].textContent;
    trigger.classList.toggle('is-placeholder', selected < 0);
    trigger.disabled = select.disabled;
    trigger.setAttribute('aria-invalid', select.getAttribute('aria-invalid') || 'false');
    items.forEach((item,index) => item.setAttribute('aria-selected', String(index === selected)));
    if (select.disabled) close();
  }
  function open() {
    if (select.disabled || !popup.hidden) return;
    sync();
    popup.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    position();
    const selected = options.findIndex(option => option.value === select.value);
    activate(selected < 0 ? 0 : selected);
  }
  function close() {
    popup.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
  }
  function choose(index) {
    select.value = options[index].value;
    select.dispatchEvent(new Event('change', { bubbles:true }));
    sync();
    close();
    trigger.focus({ preventScroll:true });
  }
  trigger.addEventListener('click', () => popup.hidden ? open() : close());
  trigger.addEventListener('keydown', event => {
    const wasOpen = !popup.hidden;
    if (['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(event.key)) {
      event.preventDefault();
      if (!wasOpen) open();
      if (event.key === 'ArrowDown' && wasOpen) activate(active + 1);
      if (event.key === 'ArrowUp' && wasOpen) activate(active - 1);
      if (event.key === 'Home') activate(0);
      if (event.key === 'End') activate(options.length - 1);
      if ((event.key === 'Enter' || event.key === ' ') && wasOpen) choose(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      if (wasOpen) choose(active);
      close();
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      open();
      clearTimeout(searchTimer);
      search += event.key.toLowerCase();
      const repeated = Array.from(search).every(char => char === search[0]);
      const query = repeated ? search[0] : search;
      const start = repeated && search.length > 1 ? active + 1 : 0;
      for (let offset = 0; offset < options.length; offset++) {
        const index = (start + offset) % options.length;
        if (options[index].textContent.toLowerCase().startsWith(query)) { activate(index); break; }
      }
      searchTimer = setTimeout(() => { search = ''; }, 700);
    }
  });
  trigger.addEventListener('blur', close);
  document.addEventListener('pointerdown', event => {
    if (!wrap.contains(event.target) && !popup.contains(event.target)) close();
  });
  addEventListener('resize', position);
  addEventListener('scroll', position, { capture:true, passive:true });
  window.visualViewport?.addEventListener('resize', position);
  select.addEventListener('change', sync);
  select.form.addEventListener('reset', () => queueMicrotask(sync));
  new MutationObserver(sync).observe(select, { attributes:true, attributeFilter:['disabled','aria-invalid'] });
  sync();
  return { sync, focus:() => trigger.focus() };
}
