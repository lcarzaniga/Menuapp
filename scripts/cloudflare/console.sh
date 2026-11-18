#!/usr/bin/env bash
# Console amministrativa di Cloudflare in un comando (SPEC §32.4, docs/CLOUDFLARE.md).
#   scripts/cloudflare/console.sh attiva              segreto nuovo: in cloudflare.env (600) e sul Worker
#   scripts/cloudflare/console.sh collega [utente]    invito, attesa della richiesta, approvazione col codice
#   scripts/cloudflare/console.sh disattiva           toglie il segreto dal Worker e da cloudflare.env
# `collega` non può fare a meno del browser: il cookie della sessione lo riceve solo il browser che
# apre il link. Lo script mostra il link, aspetta la richiesta e approva dopo la conferma del codice.
source "$(dirname "$0")/../comuni.sh"

CREDENZIALI="${MENUAPP_CREDENZIALI:-$HOME/.config/menuapp/cloudflare.env}"
CONSOLE=(node "$RADICE/scripts/cloudflare/console.ts")

carica_credenziali() {
  [[ -f "$CREDENZIALI" && "$(stat -c %a "$CREDENZIALI")" == 600 ]] || errore "Credenziali mancanti o con permessi diversi da 600: $CREDENZIALI"
  set -a
  # shellcheck disable=SC1090
  source "$CREDENZIALI"
  set +a
}

senza_segreto() { grep -v '^MENUAPP_CODICE_CONSOLE=' "$CREDENZIALI" || true; }

attiva() {
  carica_credenziali
  local codice
  codice=$(openssl rand -hex 32)
  local nuovo
  nuovo=$(mktemp "$(dirname "$CREDENZIALI")/.cloudflare.env.XXXX")
  { senza_segreto; echo "MENUAPP_CODICE_CONSOLE=$codice"; } >"$nuovo"
  chmod 600 "$nuovo"
  cd "$RADICE"
  printf '%s' "$codice" | npx wrangler secret put MENUAPP_CODICE_CONSOLE >/dev/null || { rm -f "$nuovo"; errore "wrangler secret put non riuscito"; }
  mv "$nuovo" "$CREDENZIALI"
  export MENUAPP_CODICE_CONSOLE=$codice
  for _ in $(seq 1 30); do
    "${CONSOLE[@]}" stato >/dev/null 2>&1 && break
    sleep 2
  done
  "${CONSOLE[@]}" stato || errore "La console non risponde"
  ok "Console attiva (segreto in $CREDENZIALI). Spegnila con: scripts/cloudflare/console.sh disattiva"
}

collega() {
  carica_credenziali
  [[ -n "${MENUAPP_CODICE_CONSOLE:-}" ]] || errore "Console non attiva: scripts/cloudflare/console.sh attiva"
  local prima
  # Richieste già in attesa prima dell'invito: non sono quella del nuovo dispositivo.
  prima=$("${CONSOLE[@]}" stato | { grep -oE '^  [A-Z2-9]{3}-[A-Z2-9]{3}' || true; } | tr -d ' ' | sort)
  local invito
  invito=$("${CONSOLE[@]}" invito "$@") || errore "Invito non creato"
  local link
  link=$(grep -oE 'https?://\S+/#/attiva/\S+' <<<"$invito")
  echo
  info "Apri questo link sul dispositivo da collegare (una volta sola, valido 24 ore):"
  echo
  echo "  $link"
  echo
  info "Dai un nome al dispositivo e tocca «Richiedi l'accesso». Attendo la richiesta (10 minuti)…"
  local riga=""
  for _ in $(seq 1 200); do
    riga=$("${CONSOLE[@]}" stato | { grep -E '^  [A-Z2-9]{3}-[A-Z2-9]{3}' || true; } | while read -r c resto; do grep -qx "$c" <<<"$prima" || echo "$c $resto"; done | head -1)
    [[ -n "$riga" ]] && break
    sleep 3
  done
  [[ -n "$riga" ]] || errore "Nessuna richiesta arrivata: il link resta valido, rilancia «collega» per crearne un altro"
  local codice=${riga%% *}
  echo
  info "Richiesta: $riga"
  read -r -p "Il dispositivo mostra il codice $codice? Approvo? [s/N] " risposta
  if [[ "$risposta" =~ ^[sS]$ ]]; then
    "${CONSOLE[@]}" approva "$codice"
    ok "Dispositivo collegato: sul dispositivo l'app si apre da sola"
  else
    "${CONSOLE[@]}" rifiuta "$codice"
    errore "Richiesta rifiutata"
  fi
}

disattiva() {
  carica_credenziali
  cd "$RADICE"
  # wrangler chiede conferma: «y».
  yes | npx wrangler secret delete MENUAPP_CODICE_CONSOLE >/dev/null 2>&1 || info "Segreto già assente sul Worker"
  local nuovo
  nuovo=$(mktemp "$(dirname "$CREDENZIALI")/.cloudflare.env.XXXX")
  senza_segreto >"$nuovo"
  chmod 600 "$nuovo"
  mv "$nuovo" "$CREDENZIALI"
  unset MENUAPP_CODICE_CONSOLE
  # Con il segreto tolto la console risponde 404 (dopo qualche secondo).
  for _ in $(seq 1 30); do
    # Con pipefail il codice d'uscita della prova (1) nasconderebbe il grep: prima l'uscita, poi il controllo.
    local esito
    esito=$(MENUAPP_CODICE_CONSOLE=x "${CONSOLE[@]}" stato 2>&1 || true)
    [[ "$esito" == *"Console non attiva"* ]] && { ok "Console spenta"; return; }
    sleep 2
  done
  errore "La console risponde ancora: controlla con «npx wrangler secret list»"
}

case "${1:-}" in
  attiva) attiva ;;
  collega) shift; collega "$@" ;;
  disattiva) disattiva ;;
  *) errore "Uso: scripts/cloudflare/console.sh attiva | collega [utente] | disattiva" ;;
esac
