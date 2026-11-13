#!/usr/bin/env bash
# Rilascio in produzione (SPEC §14.4).
# Uso: scripts/rilascia.sh [ramo] [--senza-riavvio] [--consenti-ramo] [--senza-push]
# Con un ramo: lo unisce in main (solo avanzamento), esegue i controlli, pubblica main su
# GitHub e rilascia. Lanciarlo è l'autorizzazione a merge, push, migrazioni e rilascio.
# Tutto lo script sta in una funzione: bash lo legge per intero prima di eseguirlo, quindi il
# merge può cambiare questo file senza effetti sull'esecuzione in corso.
source "$(dirname "$0")/comuni.sh"

rilascia() {
cd "$RADICE"

SENZA_RIAVVIO=0
CONSENTI_RAMO=0
SENZA_PUSH=0
DA_UNIRE=""
for a in "$@"; do
  case "$a" in
    --senza-riavvio) SENZA_RIAVVIO=1 ;;
    --consenti-ramo) CONSENTI_RAMO=1 ;;
    --senza-push) SENZA_PUSH=1 ;;
    -*) errore "Opzione sconosciuta: $a" ;;
    *) [[ -z "$DA_UNIRE" ]] || errore "Un solo ramo alla volta"; DA_UNIRE="$a" ;;
  esac
done

# 1. Verifiche
[[ -z "$(git status --porcelain)" ]] || errore "Albero Git non pulito"
if [[ -n "$DA_UNIRE" && "$DA_UNIRE" != "main" ]]; then
  git rev-parse -q --verify "refs/heads/$DA_UNIRE" >/dev/null || errore "Ramo inesistente: $DA_UNIRE"
  git switch -q main
  git merge -q --ff-only "$DA_UNIRE" || errore "$DA_UNIRE non è un avanzamento di main: niente unione"
  ok "$DA_UNIRE unito in main ($(git rev-parse --short HEAD))"
fi
ramo=$(git branch --show-current)
[[ "$ramo" == "main" || $CONSENTI_RAMO == 1 ]] || errore "Si rilascia da main (ramo attuale: $ramo)"
info "Controlli (lint, tipi, test, build)…"
npm run check >/dev/null || errore "npm run check non è verde"
ok "Controlli verdi"

# Pubblicazione di main su GitHub: solo se è avanti rispetto a origin/main (nessun push forzato).
if [[ "$ramo" == "main" && $SENZA_PUSH == 0 ]]; then
  git fetch -q origin main || errore "GitHub non raggiungibile: riprova o usa --senza-push"
  if [[ "$(git rev-list --count origin/main..HEAD)" -gt 0 ]]; then
    git merge-base --is-ancestor origin/main HEAD || errore "origin/main ha commit che main non ha: allinea prima di rilasciare"
    git push -q origin main || errore "Push su GitHub non riuscito"
    ok "main pubblicato su GitHub ($(git rev-parse --short HEAD))"
  else
    ok "main già pubblicato su GitHub"
  fi
fi

# 2. Costruzione del rilascio in una cartella temporanea
commit=$(git rev-parse --short HEAD)
id="$(date +%Y%m%d-%H%M)-$commit"
tmp=$(mktemp -d "$RADICE/.rilascio-XXXX")
trap 'rm -rf "$tmp"' EXIT
git archive HEAD | tar -x -C "$tmp"
(cd "$tmp" && npm ci --no-audit --no-fund >/dev/null && MENUAPP_COMMIT=$commit npx vite build >/dev/null && npm prune --omit=dev --no-audit --no-fund >/dev/null)
schema=$(versione_schema_codice "$tmp")
printf '{ "id": "%s", "commit": "%s", "versioneApp": "%s", "versioneSchema": %s, "creatoIl": "%s" }\n' \
  "$id" "$commit" "$(node -p "require('$tmp/package.json').version")" "$schema" "$(date -Iseconds)" > "$tmp/rilascio.json"
mkdir -p "$RILASCI"
mv "$tmp" "$RILASCI/$id"
trap - EXIT
ok "Rilascio preparato: rilasci/$id (schema v$schema)"

# 3. Prova su una copia del database di produzione
if [[ -f "$DATI/menuapp.db" ]]; then
  prova=$(mktemp -d)
  "$NODE" -e "const {DatabaseSync,backup}=require('node:sqlite');const d=new DatabaseSync(process.argv[1],{readOnly:true});backup(d,process.argv[2]).then(()=>d.close())" "$DATI/menuapp.db" "$prova/menuapp.db"
  MENUAPP_PORTA=$PORTA_PROVA MENUAPP_DATI="$prova" MENUAPP_STATICI="$RILASCI/$id/dist" "$NODE" "$RILASCI/$id/server/main.ts" >"$prova/log" 2>&1 &
  pid=$!
  for _ in $(seq 1 20); do curl -fsS http://127.0.0.1:$PORTA_PROVA/api/v1/salute >/dev/null 2>&1 && break; sleep 0.5; done
  if ! curl -fsS http://127.0.0.1:$PORTA_PROVA/api/v1/salute >/dev/null; then
    kill $pid 2>/dev/null || true
    cat "$prova/log"
    rm -rf "$prova"
    errore "Il rilascio non parte sulla copia dei dati di produzione: nulla è stato cambiato"
  fi
  kill $pid; wait $pid 2>/dev/null || true
  rm -rf "$prova"
  ok "Prova sulla copia del database riuscita"
  # 4. Backup manuale dei dati di produzione
  MENUAPP_DATI="$DATI" "$NODE" "$RILASCI/$id/server/backup/cli.ts" manuale
fi

# 5. Cambio atomico del rilascio attivo
precedente=$(readlink "$RILASCI/attuale" 2>/dev/null || true)
ln -sfn "$id" "$RILASCI/.attuale-nuovo"
mv -T "$RILASCI/.attuale-nuovo" "$RILASCI/attuale"
ok "rilasci/attuale → $id"

if [[ $SENZA_RIAVVIO == 1 ]] || ! systemctl --user cat menuapp.service >/dev/null 2>&1; then
  info "Servizio non riavviato (non installato o --senza-riavvio)"
  exit 0
fi
systemctl --user restart menuapp

# 6. Controlli
controlla() {
  local s
  s=$(curl -fsS "http://127.0.0.1:$PORTA/api/v1/salute") || return 1
  grep -q "\"rilascio\":\"$id\"" <<<"$s" || return 1
  curl -fsSI "http://127.0.0.1:$PORTA/sw.js" | grep -qi '^cache-control: no-cache' || return 1
  ! ss -tlnH | awk '{print $4}' | grep -qE "^(0\.0\.0\.0|\*|\[::\]):$PORTA\$" || return 1
  # Rete di casa in HTTP: risponde ma non dà dati (le API 403, le pagine rimandano all'HTTPS).
  if systemctl --user cat menuapp 2>/dev/null | grep -q MENUAPP_PORTA_LAN; then
    [[ "$(curl -s -o /dev/null -w '%{http_code}' "http://$IP_LAN:$PORTA_LAN/api/v1/salute")" == 403 ]] || return 1
  fi
  # Ingresso pubblico (Funnel), se configurato: niente funzioni di sistema.
  if grep -q MENUAPP_PORTA_PUBBLICA "$DATI/server.json" 2>/dev/null; then
    curl -fsS "http://127.0.0.1:$PORTA_PUBBLICA/api/v1/salute" | grep -q '"ok":true' || return 1
    [[ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORTA_PUBBLICA/api/v1/backup")" == 404 ]] || return 1
    ! ss -tlnH | awk '{print $4}' | grep -qE "^(0\.0\.0\.0|\*|\[::\]):$PORTA_PUBBLICA\$" || return 1
  fi
  if tailscale serve status 2>/dev/null | grep -q ":$PORTA"; then
    curl -fsS "$URL_PUBBLICO/api/v1/salute" | grep -q "\"rilascio\":\"$id\"" || return 1
  fi
}
for _ in $(seq 1 20); do controlla && break; sleep 0.5; done
if ! controlla; then
  schema_prec=$( [[ -n "$precedente" ]] && jq -r .versioneSchema "$RILASCI/$precedente/rilascio.json" 2>/dev/null || echo "")
  if [[ -n "$precedente" && "$schema_prec" == "$schema" ]]; then
    ln -sfn "$precedente" "$RILASCI/.attuale-nuovo" && mv -T "$RILASCI/.attuale-nuovo" "$RILASCI/attuale"
    systemctl --user restart menuapp
    errore "Controlli falliti: ripristinato il rilascio $precedente"
  fi
  errore "Controlli falliti e schema cambiato: vedi docs/OPERAZIONI.md (ripristino d'emergenza)"
fi
ok "Rilascio $id attivo e verificato"

# 7. Conserva gli ultimi 5 rilasci
ls -1d "$RILASCI"/2* 2>/dev/null | sort | head -n -5 | while read -r vecchio; do
  [[ "$(basename "$vecchio")" == "$id" ]] || rm -rf "$vecchio"
done
}

rilascia "$@"
exit $?
