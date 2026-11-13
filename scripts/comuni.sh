# Funzioni comuni agli script di Menù & Co. (da includere con «source»).
set -euo pipefail

RADICE=/srv/apps/menuapp
NODE=/home/loris/.nvm/versions/node/v24.18.0/bin/node
NPM_DIR=/home/loris/.nvm/versions/node/v24.18.0/bin
DATI="$RADICE/dati"
RILASCI="$RADICE/rilasci"
HOST_TS=loris-srv01.dala-tortoise.ts.net
PORTA=9870
URL_PUBBLICO="https://$HOST_TS:$PORTA"
# Accesso dalla rete di casa in HTTP, senza Tailscale (Echo Show e ospiti del Wi-Fi).
PORTA_LAN=9880
# Ingresso pubblico per Tailscale Funnel (solo loopback), attivo se configurato in dati/server.json.
PORTA_PUBBLICA=9873
# Porta della prova del rilascio su una copia dei dati.
PORTA_PROVA=9872
IP_LAN=$(ip -4 -br addr show eno1 2>/dev/null | awk '{print $3}' | cut -d/ -f1)
export PATH="$NPM_DIR:$PATH"

info() { printf '\033[1;34m▸\033[0m %s\n' "$*"; }
ok() { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
errore() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# Stato dei servizi esterni a Menù & Co., per verificare che non cambino.
fotografia_esterni() {
  {
    systemctl --user is-active dailymeals kidscalendar dailymeals-backup.timer 2>&1 || true
    systemctl is-active apache2 2>&1 || true
    ls ~/.config/systemd/user | grep -v '^menuapp' || true
    tailscale serve status 2>&1 | grep -v -e ":$PORTA" -e "^\s*$" || true
  } | sha256sum | cut -c1-16
}

versione_schema_codice() {
  ls "$1/server/db/migrazioni/" | grep -cE '^[0-9]{4}_.*\.sql$'
}
