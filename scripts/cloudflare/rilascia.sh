#!/usr/bin/env bash
# Rilascio manuale dell'installazione Cloudflare (SPEC §32.7, docs/CLOUDFLARE.md).
# Uso: scripts/cloudflare/rilascia.sh [--senza-prove]
# Rilascia il commit attuale di main (già pubblicato su GitHub da scripts/rilascia.sh): controlli,
# prove sul Worker in locale, build, `wrangler deploy`, verifica su ricettedifamiglia.online.
# Non tocca il server Debian, il suo database né i suoi servizi.
# Credenziali in ~/.config/menuapp/cloudflare.env (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID).
source "$(dirname "$0")/../comuni.sh"

rilascia_cloudflare() {
cd "$RADICE"
SENZA_PROVE=0
for a in "$@"; do
  case "$a" in
    --senza-prove) SENZA_PROVE=1 ;;
    *) errore "Opzione sconosciuta: $a" ;;
  esac
done

CREDENZIALI="$HOME/.config/menuapp/cloudflare.env"
[[ -f "$CREDENZIALI" ]] || errore "Mancano le credenziali: $CREDENZIALI (vedi docs/CLOUDFLARE.md)"
[[ "$(stat -c %a "$CREDENZIALI")" == 600 ]] || errore "$CREDENZIALI deve avere permessi 600"
set -a
# shellcheck disable=SC1090
source "$CREDENZIALI"
set +a
[[ -n "${CLOUDFLARE_API_TOKEN:-}" && -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]] || errore "CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID obbligatori"

[[ -z "$(git status --porcelain)" ]] || errore "Albero Git non pulito"
[[ "$(git branch --show-current)" == main ]] || errore "Si rilascia da main"
git fetch -q origin main || errore "GitHub non raggiungibile"
[[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] || errore "main non coincide con origin/main: rilascia prima con scripts/rilascia.sh"

info "Controlli (lint, tipi, test, build)…"
npm run check >/dev/null || errore "npm run check non è verde"
ok "Controlli verdi"
if [[ $SENZA_PROVE == 0 ]]; then
  info "Prove sul Worker in locale…"
  npm run test:cloudflare >/dev/null 2>&1 || errore "npm run test:cloudflare non è verde"
  ok "Prove Cloudflare verdi"
fi

commit=$(git rev-parse --short HEAD)
id="$(date +%Y%m%d-%H%M)-$commit"
info "Build dei file dell'app…"
MENUAPP_COMMIT=$commit npm run build:cloudflare >/dev/null || errore "Build non riuscita"

# Il bucket R2 (privato) va creato una volta sola.
if ! npx wrangler r2 bucket list 2>/dev/null | grep -q "menuapp-foto"; then
  npx wrangler r2 bucket create menuapp-foto >/dev/null || errore "Creazione del bucket R2 non riuscita"
  ok "Bucket R2 menuapp-foto creato"
fi

info "Pubblicazione del Worker ($id)…"
npx wrangler deploy --var "MENUAPP_RILASCIO:$id" || errore "wrangler deploy non riuscito"

for _ in $(seq 1 30); do
  salute=$(curl -fsS https://ricettedifamiglia.online/api/v1/salute 2>/dev/null || true)
  [[ "$salute" == '{"ok":true,"versioneApi":1}' ]] && break
  sleep 2
done
[[ "$salute" == '{"ok":true,"versioneApi":1}' ]] || errore "ricettedifamiglia.online non risponde come previsto: $salute"
[[ "$(curl -s -o /dev/null -w '%{http_code}' https://ricettedifamiglia.online/api/v1/eventi)" == 401 ]] || errore "Dati raggiungibili senza sessione"
ok "Rilascio Cloudflare $id attivo su https://ricettedifamiglia.online"
}

rilascia_cloudflare "$@"
