/**
 * Фраза-подборщик главной (components/home/HomeHero.astro).
 * Без JS hero показывает топ-3 под значения по умолчанию; со скриптом — пересчитывает на лету.
 * Перестановка талонов — GSAP Flip из @pbn/motion (грузится лениво), только transform/opacity.
 */
import { flipUpdate, prefersReduced } from '@pbn/motion';
import { num, rub, plural, daysWord } from '../lib/format';
import {
  DEFAULT_STATE, SUM, TERM, TOP_N, clamp, pick, quote, overText, nearest, needleAngle,
  type Ki, type PickOffer, type PickState,
} from './home-logic';

interface Row extends PickOffer { el: HTMLElement; back: HTMLElement | null; over: HTMLElement | null }
type Field = 'sum' | 'term';

const offersWord = (n: number) => plural(n, ['предложение', 'предложения', 'предложений']);
const nb = (s: string) => s.replace(' ', ' ');
const KIS: Ki[] = ['good', 'none', 'bad'];
const RANGE = { sum: SUM, term: TERM } as const;
const STEP = { sum: 1000, term: 1 } as const;
const isSheet = () => matchMedia('(max-width: 767px)').matches;

export function initHomePicker() {
  const root = document.querySelector<HTMLElement>('[data-hp]');
  if (!root || root.dataset.hpReady) return;
  root.dataset.hpReady = '1';

  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const $$ = <T extends Element = HTMLElement>(s: string) => [...root.querySelectorAll<T>(s)];
  const list = $('[data-hp-list]');
  const editor = $('[data-hp-editor]');
  const ask = $('.hp-ask');
  const needle = root.querySelector<SVGGElement>('[data-hp-needle]');
  const kiSel = $<HTMLSelectElement>('[data-hp-ki]');
  const inputs = { sum: $<HTMLInputElement>('[data-hp-in="sum"]'), term: $<HTMLInputElement>('[data-hp-in="term"]') };
  const total = Number(root.dataset.total) || 0;

  const rows: Row[] = $$('[data-hp-offer]').map((el) => {
    const d = el.dataset;
    return {
      el, back: el.querySelector<HTMLElement>('[data-t-back]'), over: el.querySelector<HTMLElement>('[data-t-over]'), // нет у офферов без ПСК
      sumMin: +d.sumMin!, sumMax: +d.sumMax!, termMin: +d.termMin!, termMax: +d.termMax!,
      rate: +d.rate!, free: +d.free!, prio: +d.prio!, idx: +d.idx!,
      features: (d.features ?? '').split(',').filter(Boolean),
    };
  });

  // ---- состояние (сумму и срок можно передать ссылкой, как и на витрине) ----
  const sp = new URLSearchParams(location.search);
  const fromUrl = (k: Field) => {
    const v = Number(sp.get(k));
    return sp.get(k) && Number.isFinite(v) ? clamp(Math.round(v), RANGE[k].min, RANGE[k].max) : null;
  };
  const state: PickState = { ...DEFAULT_STATE };
  state.sum = fromUrl('sum') ?? state.sum;
  state.term = fromUrl('term') ?? state.term;
  const kiUrl = sp.get('ki') as Ki | null;
  if (kiUrl && KIS.includes(kiUrl)) state.ki = kiUrl;

  let shownKey = rows.filter((r) => !r.el.hidden).map((r) => r.idx).join(',');

  // ---- отрисовка: мгновенная часть (тексты, контролы) ----
  const paintControls = () => {
    $('[data-hp-out="sum"]').textContent = nb(`${num(state.sum)} ₽`);
    $('[data-hp-out="term"]').textContent = nb(daysWord(state.term));
    $('[data-hp-val="sum"]').textContent = rub(state.sum);
    $('[data-hp-val="term"]').textContent = daysWord(state.term);
    (['sum', 'term'] as Field[]).forEach((k) => {
      const el = inputs[k];
      el.value = String(state[k]);
      el.style.setProperty('--p', `${((state[k] - RANGE[k].min) / (RANGE[k].max - RANGE[k].min)) * 100}%`);
    });
    $$<HTMLButtonElement>('[data-hp-set]').forEach((b) =>
      b.setAttribute('aria-pressed', String(+b.dataset.v! === state[b.dataset.hpSet as Field])));
    $$<HTMLButtonElement>('[data-hp-step]').forEach((b) => {
      const k = b.dataset.hpStep as Field;
      b.disabled = +b.dataset.d! < 0 ? state[k] <= RANGE[k].min : state[k] >= RANGE[k].max;
    });
    kiSel.value = state.ki;
    $$<HTMLButtonElement>('[data-hp-scenario]').forEach((b) => {
      const d = b.dataset;
      b.setAttribute('aria-pressed', String(+d.sum! === state.sum && +d.term! === state.term && d.ki === state.ki));
    });
    if (needle) needle.style.setProperty('--a', `${needleAngle(state)}deg`);
  };

  // ---- отрисовка: список (с Flip) ----
  const paintList = async (animate = true) => {
    const matched = pick(rows, state);
    const top = matched.slice(0, TOP_N);
    const n = matched.length;

    top.forEach((r) => {
      if (!r.back || !r.over) return;
      const q = quote(r, state);
      r.back.textContent = rub(q.back);
      r.over.textContent = overText(q, rub);
    });

    const key = top.map((r) => r.idx).join(',');
    if (key !== shownKey) {
      const mutate = () => {
        const topSet = new Set(top);
        [...top, ...rows.filter((r) => !topSet.has(r))].forEach((r) => list.appendChild(r.el));
        rows.forEach((r) => { r.el.hidden = !topSet.has(r); });
      };
      shownKey = key;
      if (animate) await flipUpdate(rows.map((r) => r.el), mutate, { duration: 0.45 });
      else mutate();
    }

    $('[data-hp-n]').textContent = String(n);
    $('[data-hp-lead]').textContent = n > TOP_N ? 'Первые три:' : n ? 'Вот они:' : '';
    $('[data-hp-done]').textContent = n ? `Готово: ${n} ${offersWord(n)}` : 'Готово';
    $('[data-hp-all-label]').textContent = n > TOP_N ? `Все ${n} ${offersWord(n)} с фильтрами` : `Вся витрина: ${total} ${offersWord(total)}`;

    const empty = $('[data-hp-empty]');
    empty.hidden = n > 0;
    const fix = $<HTMLButtonElement>('[data-hp-fix]');
    const near = n ? null : nearest(rows, state);
    fix.hidden = !near;
    if (near) {
      fix.dataset.sum = String(near.sum);
      fix.dataset.term = String(near.term);
      fix.textContent = `Показать для ${num(near.sum)} ₽ на ${daysWord(near.term)}`;
      $('[data-hp-empty-hint]').textContent = state.ki === 'bad'
        ? 'С просрочками в истории организации обычно выдают меньшие суммы на короткий срок.'
        : 'Попробуйте сумму поменьше или другой срок.';
    }
  };

  let timer = 0;
  const update = (opts: { now?: boolean } = {}) => {
    paintControls();
    clearTimeout(timer);
    if (opts.now) void paintList();
    else timer = window.setTimeout(() => void paintList(), 140);
  };

  // ---- редактор: поповер на десктопе, нижняя шторка на мобильном ----
  let openField: Field | null = null;
  let opener: HTMLElement | null = null;
  const tokens = $$<HTMLButtonElement>('[data-hp-open]');

  const place = (btn: HTMLElement) => {
    if (isSheet()) { editor.style.removeProperty('--x'); return; }
    const a = ask.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    const w = editor.offsetWidth || 380;
    const x = clamp(b.left - a.left + b.width / 2 - w / 2, 0, Math.max(0, a.width - w));
    editor.style.setProperty('--x', `${Math.round(x)}px`);
    editor.style.setProperty('--y', `${Math.round(b.bottom - a.top + 12)}px`);
  };

  const open = (field: Field, btn: HTMLElement) => {
    openField = field;
    opener = btn;
    editor.dataset.panel = field;
    tokens.forEach((t) => t.setAttribute('aria-expanded', String(t === btn)));
    place(btn);
    editor.inert = false;
    root.dataset.editing = field;
    requestAnimationFrame(() => inputs[field].focus({ preventScroll: true }));
  };
  const close = (restoreFocus = true) => {
    if (!openField) return;
    openField = null;
    editor.inert = true;
    delete root.dataset.editing;
    tokens.forEach((t) => t.setAttribute('aria-expanded', 'false'));
    if (restoreFocus) opener?.focus({ preventScroll: true });
  };

  tokens.forEach((t) => t.addEventListener('click', () => {
    const f = t.dataset.hpOpen as Field;
    if (openField === f) close();
    else open(f, t);
  }));
  $('[data-hp-close]').addEventListener('click', () => close());
  $('[data-hp-scrim]').addEventListener('click', () => close());

  (['sum', 'term'] as Field[]).forEach((k) => inputs[k].addEventListener('input', () => {
    state[k] = +inputs[k].value;
    update();
  }));
  $$<HTMLButtonElement>('[data-hp-step]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.hpStep as Field;
    const step = STEP[k];
    const v = state[k] + Number(b.dataset.d) * step;
    state[k] = clamp(Math.round(v / step) * step, RANGE[k].min, RANGE[k].max);
    update();
  }));
  $$<HTMLButtonElement>('[data-hp-set]').forEach((b) => b.addEventListener('click', () => {
    state[b.dataset.hpSet as Field] = +b.dataset.v!;
    update({ now: true });
  }));
  kiSel.addEventListener('change', () => {
    state.ki = kiSel.value as Ki;
    update({ now: true });
  });
  $$<HTMLButtonElement>('[data-hp-scenario]').forEach((b) => b.addEventListener('click', () => {
    const d = b.dataset;
    state.sum = +d.sum!; state.term = +d.term!; state.ki = d.ki as Ki;
    close(false);
    update({ now: true });
  }));
  $('[data-hp-fix]').addEventListener('click', (e) => {
    const d = (e.currentTarget as HTMLElement).dataset;
    state.sum = +d.sum!; state.term = +d.term!;
    update({ now: true });
  });

  // «Все предложения»: передаём сумму и срок витрине ниже (offers-ui.ts слушает fk:calc и сам прокручивает).
  $('[data-hp-all]').addEventListener('click', (e) => {
    const showcase = document.querySelector<HTMLElement>('[data-showcase]');
    if (!showcase) return;
    e.preventDefault();
    close(false);
    const chip = showcase.querySelector<HTMLButtonElement>('[data-chip="bad_history"]');
    const want = state.ki === 'bad';
    if (chip && (chip.getAttribute('aria-pressed') === 'true') !== want) chip.click();
    showcase.dispatchEvent(new CustomEvent('fk:calc', { detail: { sum: state.sum, term: state.term } }));
  });

  // ---- глобальные слушатели (снимаем при уходе со страницы) ----
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && openField) close(); };
  const onDown = (e: PointerEvent) => {
    if (!openField || isSheet()) return;
    const t = e.target as Node;
    if (editor.contains(t) || tokens.some((b) => b.contains(t))) return;
    close(false);
  };
  const onResize = () => { if (openField && opener) place(opener); };
  document.addEventListener('keydown', onKey);
  document.addEventListener('pointerdown', onDown);
  window.addEventListener('resize', onResize, { passive: true });
  document.addEventListener('astro:before-swap', () => {
    clearTimeout(timer);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('pointerdown', onDown);
    window.removeEventListener('resize', onResize);
  }, { once: true });

  if (prefersReduced()) root.dataset.still = '';
  paintControls();
  void paintList(false);
}
