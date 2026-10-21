// node --test packages/core/src/*.test.ts (Node 24 убирает типы сам). Эталоны: docs/seo-rencredit/features/dive-refi-calc.md §1.2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { annuity, psk, pskCategory, refi, type Debt, type RefiOffer } from './finance.ts';

const kop = (x: number) => Math.round(x * 100) / 100;
const flows = (got: number, pay: number, n: number) => [got, ...Array<number>(n).fill(-pay)];

// Кредитка 150 000 / 34,9% / 24 мес. + кредит 300 000 / 24,9% / 36 мес.
const two: Debt[] = [
  { balance: 150_000, rate: 34.9, months: 24 },
  { balance: 300_000, rate: 24.9, months: 36 },
];
const offer = (o: Partial<RefiOffer>): RefiOffer => ({ rate: 21.9, months: 36, feePct: 0, insurance: 0, insMode: 'none', ...o });

test('аннуитет', () => {
  assert.equal(kop(annuity(300_000, 18, 36)), 10_845.72);
  assert.equal(kop(annuity(4_800_000, 16, 240)), 66_780.29);
  assert.equal(annuity(120_000, 0, 12), 10_000); // ставка 0 — без деления на ноль
  assert.equal(kop(annuity(100_000, 12, 1)), 101_000);
});

test('ПСК без удержаний равна ставке', () => {
  const pay = annuity(300_000, 18, 36);
  assert.equal(psk(flows(300_000, pay, 36)).toFixed(3), '18.000');
  assert.equal(psk(flows(120_000, 10_000, 12)), 0);
});

test('категория ПСК ЦБ по сумме', () => {
  assert.equal(pskCategory(100_000), '4.1');
  assert.equal(pskCategory(100_001), '4.2');
});

test('два долга → 21,9% на 36 мес.: выгодно', () => {
  const r = refi(two, offer({}));
  assert.equal(kop(r.oldPay), 20_681.97);
  assert.equal(kop(r.oldTotal), 639_312.29);
  assert.equal(kop(r.newPay), 17_162.43);
  assert.equal(kop(r.gain), 21_464.71);
  assert.equal(r.psk.toFixed(1), '21.9');
  assert.equal(r.verdict, 'green');
  assert.equal(r.cause, null);
  assert.equal(r.payback, null);
});

test('те же долги на 60 мес.: ловушка срока', () => {
  const r = refi(two, offer({ months: 60 }));
  assert.equal(kop(r.newPay), 12_402.94);
  assert.ok(r.newPay < r.oldPay);
  assert.equal(kop(r.newTotal), 744_176.3);
  assert.equal(kop(r.gain), -104_864.02);
  assert.equal(r.verdict, 'red');
  assert.equal(r.cause, 'term');
  assert.equal(r.trap, true);
});

test('страховка 45 000 в теле: расходы съели выгоду', () => {
  const r = refi(two, offer({ rate: 19.9, insurance: 45_000, insMode: 'body' }));
  assert.equal(r.principal, 495_000);
  assert.equal(kop(r.newPay), 18_370.76);
  assert.equal(kop(r.gain), -22_035.14);
  assert.equal(r.psk.toFixed(1), '27.0');
  assert.equal(r.verdict, 'red');
  assert.equal(r.cause, 'costs');
  assert.equal(r.trap, false);
});

test('комиссия 2% и страховка 15 000 отдельно: окупаемость на 7-м месяце', () => {
  const r = refi(two, offer({ rate: 19.9, feePct: 2, insurance: 15_000, insMode: 'separate' }));
  assert.equal(kop(r.newPay), 16_700.69);
  assert.equal(kop(r.newTotal), 625_224.93);
  assert.equal(kop(r.gain), 14_087.35);
  assert.equal(r.psk.toFixed(2), '23.94');
  assert.equal(r.payback, 7);
  assert.equal(r.verdict, 'green');
});

test('новая ставка выше старой: причина — ставка', () => {
  const r = refi([{ balance: 300_000, rate: 18, months: 36 }], offer({ rate: 24 }));
  assert.equal(r.verdict, 'red');
  assert.equal(r.cause, 'rate');
});

test('разница в пределах 1% остатка — «на грани»', () => {
  const r = refi([{ balance: 300_000, rate: 21.9, months: 36 }], offer({}));
  assert.ok(Math.abs(r.gain) < 0.01);
  assert.equal(r.verdict, 'yellow');
});
