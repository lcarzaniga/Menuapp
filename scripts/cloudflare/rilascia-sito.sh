#!/usr/bin/env bash
# Rilascio manuale del sito del dominio principale (SPEC §34): pagina «Sito in costruzione»,
# Worker separato `ricettedifamiglia-sito`, nessun riferimento all'app.
# Uso: scripts/cloudflare/rilascia-sito.sh
# Prima controlla che l'app risponda su app.ricettedifamiglia.online: il dominio principale
# passa al sito solo quando il nuovo indirizzo è operativo.
source "$(dirname "$0")/../comuni.sh"

rilascia_sito() {
cd "$RADICE"
CREDENZIALI="$HOME/.config/menuapp/cloudflare.env"
[[ -f "$CREDENZIALI" && "$(stat -c %a "$CREDENZIALI")" == 600 ]] || errore "Credenziali mancanti o con permessi diversi da 600: $CREDENZIALI"
set -a
# shellcheck disable=SC1090
source "$CREDENZIALI"
set +a

APP=https://app.ricettedifamiglia.online
SITO=https://ricettedifamiglia.online
[[ "$(curl -fsS "$APP/api/v1/salute" 2>/dev/null)" == '{"ok":true,"versioneApi":1}' ]] || errore "L'app non risponde su $APP: il dominio principale resta com'è"
# Nessun riferimento all'app nei file del sito.
! grep -rqiE "app\.|ricette|menu|famiglia" sito/pubblico || errore "I file del sito contengono riferimenti all'app"

info "Pubblicazione del sito…"
npx wrangler deploy -c sito/wrangler.jsonc || errore "wrangler deploy del sito non riuscito (il dominio principale è ancora assegnato al Worker menuapp? vedi docs/CLOUDFLARE.md)"

for _ in $(seq 1 30); do
  pagina=$(curl -fsS "$SITO/" 2>/dev/null || true)
  [[ "$pagina" == *"Sito in costruzione"* ]] && break
  sleep 2
done
[[ "$pagina" == *"Sito in costruzione"* ]] || errore "$SITO non mostra la pagina in costruzione"
for p in /api/v1/salute /manifest.webmanifest /registerSW.js; do
  [[ "$(curl -s -o /dev/null -w '%{http_code}' "$SITO$p")" == 404 ]] || errore "$SITO$p non risponde 404"
done
[[ "$(curl -sI "$SITO/" | tr -d '\r' | grep -i '^x-robots-tag:')" == *noindex* ]] || errore "Manca X-Robots-Tag: noindex"
ok "Sito in costruzione attivo su $SITO; app solo su $APP"
}

rilascia_sito "$@"
