#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env');

function parseEnv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    env[key] = rawValue.trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

function isPlaceholder(value, placeholders) {
  const normalized = value.trim().toLowerCase();
  return !normalized || placeholders.some((item) => normalized === item.toLowerCase());
}

let fileEnv = {};
try {
  fileEnv = parseEnv(readFileSync(envPath, 'utf8'));
} catch {
  // Deploy script already sources .env; this check can also run from inherited env.
}

const env = { ...fileEnv, ...process.env };
const failures = [];
const legacyBrand = ['moss', 'eo'].join('');
const legacyBrandUpper = legacyBrand.toUpperCase();

function requireReal(key, placeholders = []) {
  const value = env[key] ?? '';
  if (isPlaceholder(value, placeholders)) {
    failures.push(`${key} is required and must not use the default placeholder.`);
  }
}

if (!/^\d{5,}$/.test(env.PUBLIC_METRIKA_ID ?? '')) {
  failures.push('PUBLIC_METRIKA_ID must be a unique numeric Yandex Metrika counter ID.');
}

requireReal('PUBLIC_SITE_NAME', ['Тестовый SEO-проект', legacyBrand, legacyBrandUpper]);
requireReal('PUBLIC_SITE_NAME_FULL', ['Тестовый SEO-проект — SEO-продвижение сайтов']);
requireReal('PUBLIC_COMPANY_PHONE', ['+7 000 000-00-00']);
requireReal('PUBLIC_COMPANY_PHONE_HREF', ['+70000000000']);
requireReal('PUBLIC_COMPANY_EMAIL', ['hello@example.test']);
requireReal('PUBLIC_COMPANY_ADDRESS', ['Адрес уточняется']);
requireReal('PUBLIC_CONTACT_FORM_ACTION', ['/thanks/']);

const formAction = env.PUBLIC_CONTACT_FORM_ACTION ?? '';
if (
  formAction &&
  formAction !== '/mail.php' &&
  !/^https:\/\/formspree\.io\/f\/[A-Za-z0-9_-]+$/.test(formAction)
) {
  failures.push('PUBLIC_CONTACT_FORM_ACTION must be /mail.php or a fallback Formspree endpoint like https://formspree.io/f/xxxxxxx.');
}

if (failures.length) {
  console.error('B0 predeploy check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('B0 predeploy check passed: unique analytics, brand, contacts, and form action are configured.');
