const menuToggle = document.querySelector<HTMLButtonElement>('.menu-toggle');
const mobileNav = document.querySelector<HTMLElement>('#mobile-nav');
const dropdown = document.querySelector<HTMLDetailsElement>('.trip-dropdown');
const siteHeader = document.querySelector<HTMLElement>('.site-header');
const skipLink = document.querySelector<HTMLAnchorElement>('.skip-link');
const mainContent = document.querySelector<HTMLElement>('#main');
const mobileTripGroup = document.querySelector<HTMLElement>(
  '[data-mobile-nav-group]',
);
const mobileTripToggle = document.querySelector<HTMLButtonElement>(
  '[data-mobile-nav-disclosure]',
);
const mobileTripSubmenu = document.querySelector<HTMLElement>(
  '[data-mobile-nav-submenu]',
);

if (mainContent && !mainContent.hasAttribute('tabindex')) {
  mainContent.tabIndex = -1;
}

skipLink?.addEventListener('click', () => {
  window.requestAnimationFrame(() =>
    mainContent?.focus({ preventScroll: true }),
  );
});

let scrollFrame = 0;

function syncHeaderState() {
  scrollFrame = 0;
  siteHeader?.classList.toggle('is-scrolled', window.scrollY > 24);
}

syncHeaderState();
window.addEventListener(
  'scroll',
  () => {
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(syncHeaderState);
  },
  { passive: true },
);

function setMobileTripOpen(isOpen: boolean) {
  if (!mobileTripGroup || !mobileTripToggle || !mobileTripSubmenu) return;
  mobileTripGroup.classList.toggle('is-open', isOpen);
  mobileTripToggle.setAttribute('aria-expanded', String(isOpen));
  mobileTripSubmenu.setAttribute('aria-hidden', String(!isOpen));
  mobileTripSubmenu.inert = !isOpen;
}

function closeMenu() {
  if (!menuToggle || !mobileNav) return;
  siteHeader?.classList.remove('menu-open');
  mobileNav.setAttribute('aria-hidden', 'true');
  mobileNav.inert = true;
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Buka menu navigasi');
}

menuToggle?.addEventListener('click', () => {
  if (!mobileNav) return;
  const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
  siteHeader?.classList.toggle('menu-open', !isOpen);
  mobileNav.setAttribute('aria-hidden', String(isOpen));
  mobileNav.inert = isOpen;
  menuToggle.setAttribute('aria-expanded', String(!isOpen));
  menuToggle.setAttribute(
    'aria-label',
    isOpen ? 'Buka menu navigasi' : 'Tutup menu navigasi',
  );
});
mobileTripToggle?.addEventListener('click', () => {
  setMobileTripOpen(mobileTripToggle.getAttribute('aria-expanded') !== 'true');
});
mobileNav
  ?.querySelectorAll('a')
  .forEach((link) => link.addEventListener('click', closeMenu));
dropdown?.querySelectorAll('a').forEach((link) =>
  link.addEventListener('click', () => {
    dropdown.open = false;
  }),
);
document.addEventListener('click', (event) => {
  if (!(event.target instanceof Node)) return;
  if (dropdown && !dropdown.contains(event.target)) dropdown.open = false;
  if (
    menuToggle?.getAttribute('aria-expanded') === 'true' &&
    siteHeader &&
    !siteHeader.contains(event.target)
  ) {
    closeMenu();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (dropdown?.open) {
    dropdown.open = false;
    dropdown.querySelector('summary')?.focus();
  }
  if (menuToggle?.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuToggle.focus();
  }
});
mobileNav?.removeAttribute('hidden');
closeMenu();

window.matchMedia('(min-width: 851px)').addEventListener('change', (event) => {
  if (event.matches) closeMenu();
});
