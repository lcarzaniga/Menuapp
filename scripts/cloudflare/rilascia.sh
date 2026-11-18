#!/usr/bin/env bash
# Rilascio manuale dell'installazione Cloudflare (SPEC §32.7, docs/CLOUDFLARE.md).
# Uso: scripts/cloudflare/rilascia.sh [--senza-prove] [--transizione]
# Rilascia il commit attuale di main (già pubblicato su GitHub da scripts/rilascia.sh): controlli,
# prove sul Worker in locale, build, `wrangler deploy`, verifica su app.ricettedifamiglia.online.
# --transizione: l'app risponde anche sul dominio principale (dove c'era prima), finché i
# dispositivi non sono collegati al nuovo indirizzo; poi un rilascio normale lo toglie (SPEC §34).
# Non tocca il server Debian, il suo database né i suoi servizi.
# Credenziali in ~/.config/menuapp/cloudflare.env (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID).
source "$(dirname "$0")/../comuni.sh"

rilascia_cloudflare() {
cd "$RADICE"
SENZA_PROVE=0
TRANSIZIONE=0
for a in "$@"; do
  case "$a" in
    --senza-prove) SENZA_PROVE=1 ;;
    --transizione) TRANSIZIONE=1 ;;
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

APP=https://app.ricettedifamiglia.online
PRINCIPALE=https://ricettedifamiglia.online
# Verifiche col DNS di Cloudflare: quello di casa può ricordare per un po' che un nome nuovo non esisteva.
risolvi() { local h=${1#https://}; local ip; ip=$(dig +short @1.1.1.1 "$h" A | grep -E '^[0-9.]+$' | head -1); [[ -n "$ip" ]] && echo "--resolve $h:443:$ip"; }
info "Pubblicazione del Worker ($id)…"
if [[ $TRANSIZIONE == 1 ]]; then
  # Stesso Worker su entrambi i nomi; inviti e PWA già sul nuovo indirizzo.
  npx wrangler deploy --var "MENUAPP_RILASCIO:$id" --var "MENUAPP_ORIGINI:$PRINCIPALE" \
    --domain app.ricettedifamiglia.online --domain ricettedifamiglia.online || errore "wrangler deploy non riuscito"
else
  npx wrangler deploy --var "MENUAPP_RILASCIO:$id" || errore "wrangler deploy non riuscito"
fi

# Il certificato di un nome nuovo può richiedere qualche minuto.
for _ in $(seq 1 60); do
  salute=$(curl -fsS $(risolvi "$APP") "$APP/api/v1/salute" 2>/dev/null || true)
  [[ "$salute" == '{"ok":true,"versioneApi":1}' ]] && break
  sleep 5
done
[[ "$salute" == '{"ok":true,"versioneApi":1}' ]] || errore "$APP non risponde come previsto: $salute"
[[ "$(curl -s $(risolvi "$APP") -o /dev/null -w '%{http_code}' "$APP/api/v1/eventi")" == 401 ]] || errore "Dati raggiungibili senza sessione"
ok "Rilascio Cloudflare $id attivo su $APP"
if [[ $TRANSIZIONE == 1 ]]; then
  ok "Transizione: l'app risponde anche su $PRINCIPALE finché non rilasci il sito (scripts/cloudflare/rilascia-sito.sh)"
fi
}

rilascia_cloudflare "$@"
