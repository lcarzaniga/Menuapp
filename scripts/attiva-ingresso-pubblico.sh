#!/usr/bin/env bash
# Prepara l'ingresso pubblico di Menù & Co. per Tailscale Funnel (SPEC §19.5, docs/OPERAZIONI.md).
# 1. scrive dati/server.json (porta pubblica su loopback e indirizzo dei link d'invito);
# 2. riavvia il servizio e verifica che l'ingresso pubblico risponda senza funzioni di sistema;
# 3. stampa il comando Funnel da eseguire (questo script NON cambia la configurazione Tailscale).
source "$(dirname "$0")/comuni.sh"

URL_ESTERNO="https://$HOST_TS"
CONFIG="$DATI/server.json"
if [[ -f "$CONFIG" ]]; then
  info "Esiste già $CONFIG:"
  cat "$CONFIG"
else
  printf '{\n  "MENUAPP_PORTA_PUBBLICA": %s,\n  "MENUAPP_URL_PUBBLICO": "%s",\n  "MENUAPP_URL_PRIVATO": "%s"\n}\n' "$PORTA_PUBBLICA" "$URL_ESTERNO" "$URL_PUBBLICO" >"$CONFIG"
  ok "Scritto $CONFIG"
fi

systemctl --user restart menuapp
for _ in $(seq 1 20); do curl -fsS "http://127.0.0.1:$PORTA_PUBBLICA/api/v1/salute" >/dev/null 2>&1 && break; sleep 0.5; done
[[ "$(curl -fsS "http://127.0.0.1:$PORTA_PUBBLICA/api/v1/salute")" == '{"ok":true,"versioneApi":1}' ]] || errore "L'ingresso pubblico non risponde come previsto"
for p in backup esportazione admin/utenti; do
  [[ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORTA_PUBBLICA/api/v1/$p")" == 404 ]] || errore "/$p raggiungibile dall'ingresso pubblico"
done
[[ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORTA_PUBBLICA/api/v1/eventi")" == 401 ]] || errore "Dati raggiungibili senza sessione"
! ss -tlnH | awk '{print $4}' | grep -qE "^(0\.0\.0\.0|\*|\[::\]):$PORTA_PUBBLICA\$" || errore "La porta pubblica non deve ascoltare su tutte le interfacce"
ok "Ingresso pubblico pronto su 127.0.0.1:$PORTA_PUBBLICA (solo loopback, funzioni di sistema assenti)"

cat <<FINE

Per esporlo su Internet con Tailscale Funnel (porta 443, accanto ai serve esistenti):

  tailscale funnel --bg --https=443 http://127.0.0.1:$PORTA_PUBBLICA

Indirizzo pubblico: $URL_ESTERNO
Per spegnerlo:      tailscale funnel --https=443 off
Mai «tailscale funnel reset» o «tailscale serve reset»: cancellerebbero anche gli altri serve.
FINE
