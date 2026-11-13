#!/usr/bin/env bash
# Console di amministrazione di Menù & Co. sul server (utenti, inviti, approvazioni, sessioni).
# Esempi:  scripts/amministra.sh stato
#          scripts/amministra.sh invito            # nuovo dispositivo per l'amministratore
#          scripts/amministra.sh approva K7P-M2Q
source "$(dirname "$0")/comuni.sh"
export MENUAPP_DATI="$DATI"
export MENUAPP_URL_PRIVATO="${MENUAPP_URL_PRIVATO:-$URL_PUBBLICO}"
exec "$NODE" "$RILASCI/attuale/server/amministrazione.ts" "$@"
