import { flipUpdate, warmup, prefersReduced } from '@pbn/motion';
import { rub, plural } from '../lib/format';

interface Card {
  el: HTMLElement;
  sumMin: number; sumMax: number; termMin: number; termMax: number;
  rate: number; free: number; appr: number;
  ageMin: number; ageMax: number; prio: number; idx: number;
  features: string[];
}
interface Crit { sum: number | null; term: number | null; age: number | null; f: string[] }

const readCard = (el: HTMLElement): Card => {
  const d = el.dataset;
  return {
    el,
    sumMin: +d.sumMin!, sumMax: +d.sumMax!, termMin: +d.termMin!, termMax: +d.termMax!,
    // нет data-rate (оффер без ПСК) -> Infinity: в конец при сортировке по ставке, вне расчёта переплаты
    rate: d.rate ? +d.rate : Infinity, free: +d.free!, appr: +d.appr!,
    ageMin: +d.ageMin!, ageMax: d.ageMax ? +d.ageMax : Infinity, prio: +d.prio!, idx: +d.idx!,
    features: (d.features ?? '').split(',').filter(Boolean),
  };
};

const match = (c: Card, k: Crit) =>
  (k.sum == null || (k.sum >= c.sumMin && k.sum <= c.sumMax)) &&
  (k.term == null || (k.term >= c.termMin && k.term <= c.termMax)) &&
  (k.age == null || (k.age >= c.ageMin && k.age <= c.ageMax)) &&
  k.f.every((x) => c.features.includes(x));

const SORTS: Record<string, (a: Card, b: Card) => number> = {
  rec: (a, b) => b.prio - a.prio || a.idx - b.idx,
  rate: (a, b) => a.rate - b.rate || b.prio - a.prio,
  sum: (a, b) => b.sumMax - a.sumMax || b.prio - a.prio,
  appr: (a, b) => b.appr - a.appr || b.prio - a.prio,
};

const pct = (el: HTMLInputElement) => `${((+el.value - +el.min) / (+el.max - +el.min)) * 100}%`;
const syncRange = (el: HTMLInputElement) => el.style.setProperty('--p', pct(el));
const smooth = () => (prefersReduced() ? 'auto' : 'smooth') as ScrollBehavior;

export function initOffers() {
  const root = document.querySelector<HTMLElement>('[data-showcase]');
  if (!root) return;
  const grid = root.querySelector<HTMLElement>('[data-offers]')!;
  const cards = [...grid.querySelectorAll<HTMLElement>('[data-offer]')].map(readCard);
  const preset = root.dataset.preset || '';
  const pageSize = Number(root.dataset.page) || 9;
  const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const sumIn = q<HTMLInputElement>('[data-in="sum"]');
  const termIn = root.querySelector<HTMLInputElement>('[data-in="term"]'); // нет у кредитов и карт
  const ageIn = q<HTMLSelectElement>('[data-in="age"]');
  const sortIn = q<HTMLSelectElement>('[data-in="sort"]');
  const sumOut = q<HTMLElement>('[data-out="sum"]');
  const termOut = root.querySelector<HTMLElement>('[data-out="term"]');
  const chips = [...root.querySelectorAll<HTMLButtonElement>('[data-chip]')];
  const resetEls = [...root.querySelectorAll<HTMLElement>('[data-reset]')];
  const empty = q('[data-empty]');
  const moreWrap = q('[data-more-wrap]');

  // ---- состояние из URL ----
  const sp = new URLSearchParams(location.search);
  const state = {
    sum: null as number | null,
    term: null as number | null,
    age: null as number | null,
    f: new Set<string>(),
    sort: 'rec',
    view: 'grid',
    shown: pageSize,
  };
  const num0 = (v: string | null, min: number, max: number) => {
    const n = Number(v);
    return v && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : null;
  };
  state.sum = num0(sp.get('sum'), +sumIn.min, +sumIn.max);
  state.term = termIn ? num0(sp.get('term'), +termIn.min, +termIn.max) : null;
  state.age = num0(sp.get('age'), 18, 100);
  (sp.get('f') ?? '').split(',').filter(Boolean).forEach((x) => state.f.add(x));
  if (preset) state.f.add(preset);
  if (SORTS[sp.get('sort') ?? '']) state.sort = sp.get('sort')!;
  if (sp.get('view') === 'list') state.view = 'list';

  const crit = (): Crit => ({ sum: state.sum, term: state.term, age: state.age, f: [...state.f] });
  const userFilters = () => [...state.f].filter((x) => x !== preset);

  const writeUrl = () => {
    const u = new URL(location.href);
    const set = (k: string, v: string | null) => (v ? u.searchParams.set(k, v) : u.searchParams.delete(k));
    set('sum', state.sum ? String(state.sum) : null);
    set('term', state.term ? String(state.term) : null);
    set('age', state.age ? String(state.age) : null);
    set('f', userFilters().join(',') || null);
    set('sort', state.sort !== 'rec' ? state.sort : null);
    set('view', state.view !== 'grid' ? state.view : null);
    history.replaceState(history.state, '', u);
  };

  const paintControls = () => {
    if (state.sum != null) sumIn.value = String(state.sum);
    syncRange(sumIn);
    sumOut.textContent = state.sum != null ? rub(state.sum) : 'любая';
    sumOut.classList.toggle('is-off', state.sum == null);
    if (termIn && termOut) {
      if (state.term != null) termIn.value = String(state.term);
      syncRange(termIn);
      termOut.textContent = state.term != null ? `${state.term} дн.` : 'любой';
      termOut.classList.toggle('is-off', state.term == null);
    }
    ageIn.value = state.age != null ? String(state.age) : '';
    sortIn.value = state.sort;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(state.f.has(c.dataset.chip!))));
    root.querySelectorAll<HTMLButtonElement>('button[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    const active = state.sum != null || state.term != null || state.age != null || userFilters().length > 0;
    resetEls.forEach((r) => { if (r.classList.contains('link-btn')) r.hidden = !active; });
  };

  let first = true;
  const apply = async (animate = true, opts: { scale?: boolean } = {}) => {
    const k = crit();
    const matched = cards.filter((c) => match(c, k)).sort(SORTS[state.sort]);
    const rest = cards.filter((c) => !matched.includes(c));
    const visible = new Set(matched.slice(0, state.shown));
    const mutate = () => {
      grid.dataset.view = state.view;
      [...matched, ...rest].forEach((c) => grid.appendChild(c.el));
      cards.forEach((c) => { c.el.hidden = !visible.has(c); });
    };
    if (animate && !first) await flipUpdate(cards.map((c) => c.el), mutate, opts);
    else mutate();
    first = false;
    const n = matched.length;
    q('[data-count-out]').textContent = String(n);
    q('[data-count-word]').textContent = plural(n, ['предложение', 'предложения', 'предложений']);
    empty.hidden = n > 0;
    moreWrap.hidden = matched.length <= state.shown;
    root.dataset.f = [...state.f].join(',');
    root.dataset.age = state.age != null ? String(state.age) : '';
    paintControls();
    writeUrl();
    root.dispatchEvent(new CustomEvent('fk:filters', { detail: { sum: state.sum, term: state.term } }));
  };

  // ---- события ----
  let t = 0;
  const later = (fn: () => void, ms = 140) => { clearTimeout(t); t = window.setTimeout(fn, ms); };
  const resetShown = () => { state.shown = pageSize; };

  sumIn.addEventListener('input', () => {
    state.sum = +sumIn.value; resetShown();
    syncRange(sumIn); sumOut.textContent = rub(state.sum); sumOut.classList.remove('is-off');
    later(() => apply());
  });
  if (termIn && termOut) termIn.addEventListener('input', () => {
    state.term = +termIn.value; resetShown();
    syncRange(termIn); termOut.textContent = `${state.term} дн.`; termOut.classList.remove('is-off');
    later(() => apply());
  });
  ageIn.addEventListener('change', () => { state.age = ageIn.value ? +ageIn.value : null; resetShown(); apply(); });
  sortIn.addEventListener('change', () => { state.sort = sortIn.value; resetShown(); apply(); });
  chips.forEach((c) => c.addEventListener('click', () => {
    const f = c.dataset.chip!;
    state.f.has(f) ? state.f.delete(f) : state.f.add(f);
    resetShown();
    apply();
  }));
  root.querySelectorAll<HTMLButtonElement>('button[data-view]').forEach((b) => b.addEventListener('click', () => {
    if (state.view === b.dataset.view) return;
    state.view = b.dataset.view!;
    apply(true, { scale: true });
  }));
  root.querySelector('[data-more]')?.addEventListener('click', () => { state.shown += pageSize; apply(); });
  resetEls.forEach((r) => r.addEventListener('click', () => {
    state.sum = state.term = state.age = null;
    state.f = new Set(preset ? [preset] : []);
    state.sort = 'rec';
    resetShown();
    apply();
  }));
  root.querySelector('[data-panel-toggle]')?.addEventListener('click', (e) => {
    const btn = e.currentTarget as HTMLElement;
    const panel = q('[data-panel]');
    const open = panel.toggleAttribute('data-open');
    btn.setAttribute('aria-expanded', String(open));
  });
  // Калькулятор из hero передаёт сумму/срок
  root.addEventListener('fk:calc', (e) => {
    const d = (e as CustomEvent<{ sum: number; term: number }>).detail;
    state.sum = d.sum; state.term = d.term; resetShown();
    apply().then(() => {
      root.scrollIntoView({ behavior: smooth(), block: 'start' });
    });
  });

  paintControls();
  apply(false);
  warmup();
}
