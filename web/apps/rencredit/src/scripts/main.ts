import { markJs, initReveal, animateCounters, initTilt } from '@pbn/motion';
import { initHeader, initSeoToggle, initMascotOnce, initStickyCta } from './chrome';
import { initOffers } from './offers-ui';

/**
 * Единая точка входа клиентского JS. С <ClientRouter /> модуль выполняется один раз,
 * а инициализация страницы — на каждое событие astro:page-load.
 */
markJs();
document.addEventListener('astro:page-load', () => {
  initHeader();
  initSeoToggle();
  initMascotOnce();
  initStickyCta();
  initOffers();
  initReveal();
  animateCounters();
  initTilt();
});
