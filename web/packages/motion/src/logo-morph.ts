/**
 * Морф логотипа «карточка витрины ↔ обзор оффера» (View Transitions, ClientRouter).
 * Статический transition:name есть только у большого логотипа на обзоре (logo-<slug>).
 * Карточкам ([data-offer][data-slug] .logo-tile) имя ставим на лету и только одной:
 * - вперёд: кликнутой (astro:before-preparation, sourceElement) — до снимка старой страницы;
 * - назад/с обзора: карточке того же оффера в новом документе (astro:before-swap, newDocument);
 *   на главной оффер бывает в двух подборках — берём ту, по которой кликнули (from), иначе первую видимую.
 * Так на витрине нет 20+ имён (и <style> под каждое), а дубль имени (он отменяет весь переход) невозможен.
 * Вызывать один раз: слушатели на document переживают переходы.
 */
const PREFIX = 'logo-';
const cardsOf = (root: ParentNode, slug: string) => [...root.querySelectorAll<HTMLElement>(`[data-offer][data-slug="${CSS.escape(slug)}"]`)];
let from = 0; // номер кликнутой карточки среди карточек того же оффера

export function initLogoMorph(): void {
  document.addEventListener('astro:before-preparation', (e) => {
    const card = (e as Event & { sourceElement?: Element }).sourceElement?.closest<HTMLElement>('[data-offer][data-slug]');
    const tile = card?.querySelector<HTMLElement>('.logo-tile');
    if (!card || !tile) return;
    // Имя, оставшееся от прошлого «назад», + клик по тому же офферу в другой подборке = дубль.
    for (const t of document.querySelectorAll<HTMLElement>('[data-offer] .logo-tile')) t.style.viewTransitionName = '';
    tile.style.viewTransitionName = PREFIX + card.dataset.slug;
    from = Math.max(0, cardsOf(document, card.dataset.slug!).indexOf(card));
  });
  document.addEventListener('astro:before-swap', (e) => {
    const lg = document.querySelector('.logo-tile.lg');
    const name = lg ? getComputedStyle(lg).viewTransitionName : '';
    if (!name.startsWith(PREFIX)) return;
    const cards = cardsOf((e as Event & { newDocument: Document }).newDocument, name.slice(PREFIX.length));
    // Карточки скрытых подборок (hidden) не рендерятся.
    const card = [cards[from], ...cards].find((c) => c && !c.closest('[hidden]'));
    const tile = card?.querySelector<HTMLElement>('.logo-tile');
    if (tile) tile.style.viewTransitionName = name;
  });
}
