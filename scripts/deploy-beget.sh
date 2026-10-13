#!/usr/bin/env bash
# Выкладка web/apps/rencredit/dist на Beget (public_html домена).
#
#   bash scripts/deploy-beget.sh --check      проверить доступ и показать, что лежит на сервере
#   bash scripts/deploy-beget.sh --dry-run    показать, что будет залито
#   bash scripts/deploy-beget.sh              залить dist (без удаления файлов на сервере)
#   bash scripts/deploy-beget.sh --build      сначала собрать сайт, потом залить
#   bash scripts/deploy-beget.sh --archive-old --build
#                                             первая выкладка: ПЕРЕНЕСТИ всё старое из папки (WordPress)
#                                             в архив _old_site_<дата> (не удаляет), затем залить новый сайт
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
ARCHIVE=0
for a in "$@"; do
  case "$a" in
    --check) MODE=check ;;
    --dry-run) MODE=dry ;;
    --build) BUILD=1 ;;
    --archive-old) ARCHIVE=1 ;;
    -h|--help) sed -n 2,14p "$0"; exit 0 ;;
    *) echo "Неизвестный аргумент: $a" >&2; exit 2 ;;
  esac
done

# --- настройки ---
# Читаем KEY=VALUE как текст, без выполнения: в пароле могут быть &, $, ; и т.п.
load_conf() {
  local line key val
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*(#|$) ]] && continue
    [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}"; val="${BASH_REMATCH[2]}"
    if [[ "$val" =~ ^\"(.*)\"[[:space:]]*$ || "$val" =~ ^\'(.*)\'[[:space:]]*$ ]]; then val="${BASH_REMATCH[1]}"; fi
    printf -v "$key" '%s' "$val"
  done < "$1"
}
if [[ -f "$CONF" ]]; then
  load_conf "$CONF"
elif [[ -f "$ROOT/web/deploy-env.example" ]]; then
  # Без локального конфига берём пример (в нём нет секретов): подходит для входа по SSH-ключу.
  load_conf "$ROOT/web/deploy-env.example"
else
  echo "Нет $CONF — скопируйте web/deploy-env.example в web/.env.deploy и заполните." >&2
  exit 2
fi
# Отдельный ключ для деплоя (scripts/install-ssh-key.ps1 кладёт его на сервер).
BEGET_KEY="${BEGET_KEY:-$HOME/.ssh/beget_ed25519}"

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
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)
[[ -f "$BEGET_KEY" ]] && SSH_OPTS+=(-i "$BEGET_KEY" -o IdentitiesOnly=yes)
ssh_run() { ssh "${SSH_OPTS[@]}" "$BEGET_USER@$BEGET_HOST" "$@"; }

if [[ "$DEPLOY_METHOD" == ssh ]]; then
  case "$MODE" in
    check)
      ssh_run "cd '$BEGET_PATH' && pwd && ls -la | head -40" ;;
    dry)
      (cd "$DIST" && find . -type f | sort | head -50); echo "… всего $FILES файлов" ;;
    deploy)
      # Упаковываем локально, распаковываем на сервере одним потоком.
      # При --archive-old сначала переносим всё старое содержимое папки в _old_site_<дата>:
      # рядом с папкой, если есть доступ на запись, иначе внутрь неё (и закрываем архив от веба).
      PREP=""
      if [[ "$ARCHIVE" == 1 ]]; then
        STAMP=$(date +%Y%m%d-%H%M)
        PREP="cd '$BEGET_PATH' && D=\"\$(pwd)\" && P=\"\$(dirname \"\$D\")\" && \
if [ -w \"\$P\" ] && [ \"\$P\" != \"/\" ]; then A=\"\$P/_old_site_$STAMP\"; else A=\"\$D/_old_site_$STAMP\"; fi && \
mkdir -p \"\$A\" && \
find \"\$D\" -mindepth 1 -maxdepth 1 ! -name '_old_site_*' ! -name '.ssh' -exec mv {} \"\$A\"/ \; && \
{ [ \"\$(dirname \"\$A\")\" = \"\$D\" ] && printf 'Require all denied\nDeny from all\n' > \"\$A/.htaccess\" || true; } && \
echo \"Старое содержимое перенесено в \$A (\$(ls -A \"\$A\" | wc -l) объектов)\" && cd - >/dev/null && "
      fi
      tar -C "$DIST" -czf - . | ssh_run "${PREP}mkdir -p '$BEGET_PATH' && tar -xzf - -C '$BEGET_PATH' && echo OK: \$(find '$BEGET_PATH' -type f ! -path '*/_old_site_*' | wc -l) файлов нового сайта на сервере" ;;
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
  # Шифрование: пробуем FTPS (TLS 1.2 — schannel в Windows не дружит с TLS 1.3 у Beget), иначе обычный FTP.
  TLS=()
  for opts in "--ssl-reqd --tls-max 1.2" "--ssl-reqd"; do
    # shellcheck disable=SC2086
    if curl -sS --netrc-file "$NETRC" $opts --connect-timeout 15 --list-only "$BASE/" -o /dev/null 2>/dev/null; then
      read -r -a TLS <<< "$opts"; break
    fi
  done
  if [[ ${#TLS[@]} -eq 0 ]]; then echo "⚠ FTPS недоступен — используем обычный FTP (без шифрования)"; else echo "🔒 FTPS: ${TLS[*]}"; fi
  ftp_q() { curl -sS --netrc-file "$NETRC" "${TLS[@]}" --connect-timeout 15 "$@"; }
  case "$MODE" in
    check)
      ftp_q "$BASE/" ;;
    dry)
      (cd "$DIST" && find . -type f | sort | head -50); echo "… всего $FILES файлов" ;;
    deploy)
      if [[ "$ARCHIVE" == 1 ]]; then
        # Переносим (RNFR/RNTO) всё, что лежит в папке, в _old_site_<дата> и закрываем архив от веба.
        A="_old_site_$(date +%Y%m%d-%H%M)"
        ftp_q "$BASE/" -Q "MKD $A" -o /dev/null
        mapfile -t NAMES < <(ftp_q --list-only "$BASE/" | tr -d '\r' | grep -vE '^(\.|\.\.|_old_site_.*)$')
        # NLST часто скрывает dot-файлы — пробуем перенести их явно.
        for h in .htaccess .user.ini .well-known; do NAMES+=("$h"); done
        moved=0
        for name in "${NAMES[@]}"; do
          [[ -z "$name" ]] && continue
          if ftp_q "$BASE/" -Q "RNFR $name" -Q "RNTO $A/$name" -o /dev/null 2>/dev/null; then moved=$((moved+1)); fi
        done
        printf 'Require all denied\nDeny from all\n' | ftp_q -T - "$BASE/$A/.htaccess"
        echo "▶ Старое содержимое перенесено в $A ($moved объектов)"
      fi
      n=0
      while IFS= read -r f; do
        rel="${f#./}"
        curl -sS --netrc-file "$NETRC" "${TLS[@]}" --ftp-create-dirs --connect-timeout 15 --retry 2 \
          -T "$DIST/$rel" "$BASE/$rel" || { echo "Ошибка на $rel" >&2; exit 1; }
        n=$((n+1)); (( n % 25 == 0 )) && echo "  … $n/$FILES"
      done < <(cd "$DIST" && find . -type f | sort)
      echo "OK: залито $n файлов" ;;
  esac
  exit 0
fi

echo "DEPLOY_METHOD должен быть ssh или ftp" >&2; exit 2
