#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(__dirname, '..');
const DIST = resolve(SITE_ROOT, 'dist');
const envPath = resolve(SITE_ROOT, '.env');

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

function phpString(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

let fileEnv = {};
if (existsSync(envPath)) {
  fileEnv = parseEnv(readFileSync(envPath, 'utf8'));
}

const env = { ...fileEnv, ...process.env };
const siteName = env.PUBLIC_SITE_NAME || 'SEO Site';
const toEmail = env.PUBLIC_CONTACT_FORM_TO || env.PUBLIC_COMPANY_EMAIL || 'hello@example.test';
const defaultSubject = env.PUBLIC_CONTACT_FORM_SUBJECT || `Заявка с сайта ${siteName}`;

const php = `<?php
declare(strict_types=1);

$toEmail = ${phpString(toEmail)};
$defaultSubject = ${phpString(defaultSubject)};
$successPath = '/thanks/?status=sent';
$errorPath = '/thanks/?status=error';

function redirect_to(string $target): void {
    header('Location: ' . $target, true, 303);
    exit;
}

function clean_header(string $value): string {
    return trim(preg_replace('/[\\r\\n]+/', ' ', $value) ?? '');
}

function clean_body(string $value): string {
    return trim(str_replace(["\\r\\0", "\\0"], '', $value));
}

function safe_redirect_target(?string $target, string $fallback): string {
    if (!$target) {
        return $fallback;
    }

    $parts = parse_url($target);
    if ($parts === false) {
        return $fallback;
    }

    if (!isset($parts['host'])) {
        return substr($target, 0, 1) === '/' && substr($target, 0, 2) !== '//'
            ? $target
            : $fallback;
    }

    $currentHost = $_SERVER['HTTP_HOST'] ?? '';
    return strcasecmp($parts['host'], $currentHost) === 0 ? $target : $fallback;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    redirect_to('/');
}

$next = safe_redirect_target($_POST['_next'] ?? null, $successPath);

if (!empty($_POST['_gotcha'] ?? '')) {
    redirect_to($next);
}

$name = clean_header($_POST['name'] ?? '');
$phone = clean_header($_POST['phone'] ?? '');
$email = clean_header($_POST['email'] ?? '');
$message = clean_body($_POST['message'] ?? '');
$subject = clean_header($_POST['_subject'] ?? $defaultSubject);

$phoneDigits = preg_replace('/\\D/', '', $phone);
if (
    $name === '' ||
    $message === '' ||
    strlen($phoneDigits) !== 11 ||
    $phoneDigits[0] !== '7' ||
    ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL))
) {
    redirect_to($errorPath);
}

$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$from = 'no-reply@' . preg_replace('/[^A-Za-z0-9.-]/', '', $host);
$encodedSubject = function_exists('mb_encode_mimeheader')
    ? mb_encode_mimeheader($subject, 'UTF-8')
    : $subject;

$body = implode("\\n", [
    'Новая заявка с сайта',
    '',
    'Имя: ' . $name,
    'Телефон: ' . ($phone ?: 'не указан'),
    'Email: ' . $email,
    '',
    'Сообщение:',
    $message,
    '',
    'Страница отправки: ' . ($_SERVER['HTTP_REFERER'] ?? 'не указана'),
    'IP: ' . ($_SERVER['REMOTE_ADDR'] ?? 'не указан'),
]);

$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'From: ' . $from,
    'Reply-To: ' . $email,
    'X-Mailer: PHP/' . phpversion(),
];

$sent = mail($toEmail, $encodedSubject, $body, implode("\\r\\n", $headers), '-f ' . $from);
if (!$sent) {
    error_log('[mail.php] mail() failed: to=' . $toEmail . ' from=' . $from);
}
redirect_to($sent ? $next : '/thanks/?status=mail_error');
`;

writeFileSync(resolve(DIST, 'mail.php'), php, 'utf8');
console.log(`✓ mail.php written → ${resolve(DIST, 'mail.php')}`);
