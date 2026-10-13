#!/usr/bin/env bash
# Выкладка web/apps/rencredit/dist на Beget (public_html домена).
#
#   bash scripts/deploy-beget.sh --check      проверить доступ и показать, что лежит на сервере
#   bash scripts/deploy-beget.sh --dry-run    показать, что будет залито
#   bash scripts/deploy-beget.sh              залить dist (без удаления файлов на сервере)
#   bash scripts/deploy-beget.sh --build      сначала собрать сайт, потом залить
#
# Настройки — web/.env.deploy (пример: web/deploy-env.example). Файл в .gitignore, в git не попадает.
# Способы: DEPLOY_METHOD=ssh (по умолчанию; ключ или пароль спросит сам ssh) или ftp (пароль из BEGET_PASS).
# Скрипт ничего не удаляет на сервере: старые файлы остаются, совпадающие перезаписываются.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/web/apps/rencredit"
DIST="$APP/dist"
CONF="$ROOT/web/.env.deploy"

MODE=deploy
BUILD=0
for a in "$@"; do
  case "$a" in
    --check) MODE=check ;;
    --dry-run) MODE=dry ;;
    --build) BUILD=1 ;;
    -h|--help) sed -n 2,11p "$0"; exit 0 ;;
    *) echo "Неизвестный аргумент: $a" >&2; exit 2 ;;
  esac
done

# --- настройки ---
if [[ -f "$CONF" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$CONF"
  set +a
else
  echo "Нет $CONF — скопируйте web/deploy-env.example в web/.env.deploy и заполните." >&2
  exit 2
fi

DEPLOY_METHOD="${DEPLOY_METHOD:-ssh}"
: "${BEGET_HOST:?BEGET_HOST не задан в web/.env.deploy}"
: "${BEGET_USER:?BEGET_USER не задан в web/.env.deploy}"
BEGET_PATH="${BEGET_PATH:-.}"   # для FTP-аккаунта с корнем в public_html — "."

# --- сборка ---
if [[ "$BUILD" == 1 ]]; then
  echo "▶ Сборка сайта"
  npm --prefix "$APP" run build
  node "$ROOT/web/scripts/check-links.mjs"
  node "$ROOT/web/scripts/check-legacy.mjs"
fi

if [[ "$MODE" != check ]]; then
  [[ -f "$DIST/index.html" ]] || { echo "Нет $DIST/index.html — запустите с --build" >&2; exit 2; }
  [[ -f "$DIST/.htaccess" ]] || { echo "В dist нет .htaccess — редиректы не заработают, прерываю" >&2; exit 2; }
  FILES=$(cd "$DIST" && find . -type f | wc -l | tr -d ' ')
  SIZE=$(du -sh "$DIST" | cut -f1)
  echo "▶ dist: $FILES файлов, $SIZE → $DEPLOY_METHOD://$BEGET_USER@$BEGET_HOST/$BEGET_PATH"
fi

# --- SSH ---
ssh_run() { ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 "$BEGET_USER@$BEGET_HOST" "$@"; }

if [[ "$DEPLOY_METHOD" == ssh ]]; then
  case "$MODE" in
    check)
      ssh_run "cd '$BEGET_PATH' && pwd && ls -la | head -40" ;;
    dry)
      (cd "$DIST" && find . -type f | sort | head -50); echo "… всего $FILES файлов" ;;
    deploy)
      # Упаковываем локально, распаковываем на сервере одним потоком.
      tar -C "$DIST" -czf - . | ssh_run "mkdir -p '$BEGET_PATH' && tar -xzf - -C '$BEGET_PATH' && echo OK: \$(find '$BEGET_PATH' -type f | wc -l) файлов на сервере" ;;
  esac
  exit 0
fi

# --- FTP (curl) ---
if [[ "$DEPLOY_METHOD" == ftp ]]; then
  : "${BEGET_PASS:?BEGET_PASS не задан в web/.env.deploy (нужен для ftp)}"
  # Пароль передаём через временный netrc, а не в аргументах команды (их видно в списке процессов).
  NETRC="$(mktemp)"; trap 'rm -f "$NETRC"' EXIT; chmod 600 "$NETRC"
  printf 'machine %s login %s password %s\n' "$BEGET_HOST" "$BEGET_USER" "$BEGET_PASS" > "$NETRC"
  BASE="ftp://$BEGET_HOST/${BEGET_PATH#./}"; BASE="${BASE%/}"; [[ "$BEGET_PATH" == "." ]] && BASE="ftp://$BEGET_HOST"
  case "$MODE" in
    check)
      curl -sS --netrc-file "$NETRC" --ssl-reqd --connect-timeout 15 "$BASE/" || curl -sS --netrc-file "$NETRC" --connect-timeout 15 "$BASE/" ;;
    dry)
      (cd "$DIST" && find . -type f | sort | head -50); echo "… всего $FILES файлов" ;;
    deploy)
      SSL=(--ssl)   # FTPS, если сервер умеет; иначе обычный FTP
      n=0
      while IFS= read -r f; do
        rel="${f#./}"
        curl -sS --netrc-file "$NETRC" "${SSL[@]}" --ftp-create-dirs --connect-timeout 15 --retry 2 \
          -T "$DIST/$rel" "$BASE/$rel" || { echo "Ошибка на $rel" >&2; exit 1; }
        n=$((n+1)); (( n % 25 == 0 )) && echo "  … $n/$FILES"
      done < <(cd "$DIST" && find . -type f | sort)
      echo "OK: залито $n файлов" ;;
  esac
  exit 0
fi

echo "DEPLOY_METHOD должен быть ssh или ftp" >&2; exit 2
