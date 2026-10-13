import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Источник правды по полям контента сайта. Опечатка во frontmatter роняет сборку —
 * так и задумано. Поля продукта зеркалят Product из @pbn/core/types.
 */

const FEATURES = [
  'zero_percent', 'no_refusal', 'bad_history', 'to_card', 'cash',
  'no_photo', 'with_overdue', 'long_term', 'round_the_clock', 'new',
] as const;

const offers = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/offers' }),
  schema: z.object({
    poolId: z.string().regex(/^saleads-[0-9a-f]{8}$/),
    kind: z.enum(['mfo', 'card', 'credit']),
    name: z.string(),
    logo: z.string().optional(),
    brandColor: z.string().optional(),
    amountMin: z.number().int().positive(),
    amountMax: z.number().int().positive(),
    termMinDays: z.number().int().positive(),
    termMaxDays: z.number().int().positive(),
    rateDayPct: z.number().min(0).max(0.8),
    freeDays: z.number().int().optional(),
    pskMin: z.number().min(0).optional(),
    pskMax: z.number().max(292).optional(),
    approvalPct: z.number().min(0).max(100).optional(),
    decisionMinutes: z.number().optional(),
    ageMin: z.number().int().min(18),
    ageMax: z.number().int().max(100),
    features: z.array(z.enum(FEATURES)),
    rating: z.number().min(0).max(5).optional(),
    reviewsCount: z.number().int().optional(),
    cbrLicense: z.string().optional(),
    legalName: z.string().optional(),
    erid: z.string().optional(),
    verified: z.boolean().default(false),
    priority: z.number().default(0),
    summary: z.string().optional(),     // 1–2 предложения для карточки/обзора
    pros: z.array(z.string()).default([]),
    cons: z.array(z.string()).default([]),
  }),
});

const baseArticle = {
  title: z.string(),
  description: z.string().max(200),
  publishDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  author: z.string().default('Редакция'),
  tags: z.array(z.string()).default([]),
  cover: z.string().optional(),
  draft: z.boolean().default(false),
  /** Старый URL на rencredit-online.ru (для 301), заполняется на последнем этапе. */
  legacyUrl: z.string().optional(),
};

const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: z.object({
    ...baseArticle,
    category: z.enum(['zaimy', 'kredity', 'karty', 'refinansirovanie', 'kreditnaya-istoriya', 'fingramotnost']),
    /** Какие продукты показывать в блоке офферов внутри статьи. */
    offerKind: z.enum(['mfo', 'card', 'credit']).optional(),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  }),
});

const news = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/news' }),
  schema: z.object({
    ...baseArticle,
    source: z.url().optional(),
    sourceName: z.string().optional(),
  }),
});

/** Посадочные «Займы без отказа», «Займы на карту» и т.д. — фильтр витрины + SEO-текст. */
const guides = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),          // H1
    navLabel: z.string(),       // «Без отказа»
    description: z.string().max(200),
    kind: z.enum(['mfo', 'card', 'credit']).default('mfo'),
    feature: z.enum(FEATURES).optional(),  // предустановленный фильтр витрины
    order: z.number().default(0),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  }),
});

/**
 * Некредитные продукты: страхование, дебетовые карты, вклады, РКО. Отдельно от offers,
 * потому что у них нет суммы/срока/ставки займа — калькулятор и фильтры займов их не видят.
 * Ключевые условия — в highlights (каждое подтверждается источником при verified=true).
 */
export const SERVICE_CATEGORIES = [
  'osago', 'kasko', 'strahovanie-ipoteki', 'strahovanie-puteshestvennikov', 'strahovanie-kvartiry',
  'strahovanie-drugoe', 'debetovye-karty', 'vklady', 'rko',
] as const;

const services = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/services' }),
  schema: z.object({
    poolId: z.string().regex(/^saleads-[0-9a-f]{8}$/),
    kind: z.enum(['insurance', 'debit', 'deposit', 'rko']),
    category: z.enum(SERVICE_CATEGORIES),
    name: z.string(),
    logo: z.string().optional(),
    brandColor: z.string().optional(),
    /** 2–4 ключевых условия для карточки: «Кешбэк» → «до 30%», «Обслуживание» → «0 ₽». */
    highlights: z.array(z.object({ label: z.string(), value: z.string() })).max(4).default([]),
    /** Ставка вклада, % годовых (для kind=deposit) — для сортировки. */
    ratePct: z.number().min(0).max(100).optional(),
    /** Стоимость: обслуживание ₽/мес (debit, rko) или «полис от» ₽ (insurance) — для сортировки. */
    priceFrom: z.number().min(0).optional(),
    cbrLicense: z.string().optional(),   // лицензия ЦБ банка / страховщика
    legalName: z.string().optional(),    // рекламодатель: банк, страховщик или сервис-агрегатор
    erid: z.string().optional(),
    verified: z.boolean().default(false),
    priority: z.number().default(0),
    summary: z.string().optional(),
    pros: z.array(z.string()).default([]),
    cons: z.array(z.string()).default([]),
  }),
});

/** SEO-тексты посадочных /osago/, /debetovye-karty/ … (id файла = category). */
const servicePages = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/service-pages' }),
  schema: z.object({
    title: z.string(),          // H1
    navLabel: z.string(),       // «ОСАГО»
    description: z.string().max(200),
    lead: z.string().optional(),   // 1–2 предложения под H1
    updatedDate: z.coerce.date().optional(),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  }),
});

export const collections = { offers, articles, news, guides, services, servicePages };
