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
    tailscale serve status 2>&1 | grep -v ":$PORTA" || true
  } | sha256sum | cut -c1-16
}

versione_schema_codice() {
  ls "$1/server/db/migrazioni/" | grep -cE '^[0-9]{4}_.*\.sql$'
}
