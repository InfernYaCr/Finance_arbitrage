/**
 * Цели Метрики и метка места клика для /go/. Делегирование на document: модуль выполняется
 * один раз и переживает ClientRouter. fkGoal задаёт BaseLayout и шлёт цель только после согласия.
 * Клик по /go/-ссылке дописывает ?p=<слот>&s=<sid>; /go/ переносит их в utm_content/utm_term.
 */
type Goal = (name: string, params?: Record<string, string>) => void;
const goal: Goal = (n, p) => (window as Window & { fkGoal?: Goal }).fkGoal?.(n, p);

const hex = (n: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');

function slotOf(a: Element): string {
  const el = a.closest<HTMLElement>('[data-cta-slot], [data-showcase], [data-cta-sticky], section[id]');
  const raw = !el ? '' : el.dataset.ctaSlot ?? ('showcase' in el.dataset ? 'showcase' : 'ctaSticky' in el.dataset ? 'sticky' : el.id);
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32) || 'inline';
}

function onClick(e: MouseEvent) {
  if (e.type === 'auxclick' && e.button !== 1) return; // только средняя кнопка
  const t = e.target as Element;
  const a = t.closest<HTMLAnchorElement>('a[href^="/go/"]');
  if (a) {
    const path = a.getAttribute('href')!.split('?')[0];
    const slot = slotOf(a);
    const sid = hex(6); // 12 hex, случайный, без ПДн
    a.setAttribute('href', `${path}?p=${slot}&s=${sid}`); // браузер берёт href после обработчиков
    goal('offer_go', { offer: path.split('/')[2], slot, page: location.pathname, sid });
    return;
  }
  const act = t.closest<HTMLElement>('[data-mascot] [data-act]')?.dataset.act;
  if (act === 'pick') return goal('mascot_pick');
  // Слушатель маскота висит на его корне и уже отработал: state='talk' значит «открыли».
  if (act === 'toggle' && t.closest<HTMLElement>('[data-mascot]')?.dataset.state === 'talk') return goal('mascot_open');
  if (t.closest('[data-hp-all]')) return goal('picker_all');
  const g = t.closest<HTMLElement>('[data-goal]')?.dataset.goal; // задел для будущих целей
  if (g) goal(g);
}

document.addEventListener('click', onClick);
document.addEventListener('auxclick', onClick);
