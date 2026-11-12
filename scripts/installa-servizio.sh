#!/usr/bin/env bash
# Installa i servizi systemd utente di Menù & Co. (SPEC §14.3). Non tocca altre unità.
# Uso: scripts/installa-servizio.sh   (richiede almeno un rilascio in rilasci/attuale)
source "$(dirname "$0")/comuni.sh"

[[ -e "$RILASCI/attuale/server/main.ts" ]] || errore "Nessun rilascio installato: esegui prima scripts/rilascia.sh --senza-riavvio"
[[ -x "$NODE" ]] || errore "Node non trovato in $NODE"
if ss -tlnH | awk '{print $4}' | grep -qE "(^|:)$PORTA\$" && ! systemctl --user is-active -q menuapp; then
  errore "La porta $PORTA è già occupata da un altro processo"
fi

prima=$(fotografia_esterni)
UNITA=~/.config/systemd/user
mkdir -p "$UNITA" "$DATI/backup"

cat > "$UNITA/menuapp.service" <<UNIT
[Unit]
Description=Menù & Co. (frontend e API)
Documentation=file://$RADICE/docs/SPEC.md
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=300
StartLimitBurst=5

[Service]
Type=simple
WorkingDirectory=$RADICE
Environment=NODE_ENV=production
Environment=MENUAPP_HOST=127.0.0.1
Environment=MENUAPP_PORTA=$PORTA
Environment=MENUAPP_DATI=$DATI
Environment=MENUAPP_STATICI=$RILASCI/attuale/dist
Environment=MENUAPP_ORIGINI=$URL_PUBBLICO
ExecStart=$NODE $RILASCI/attuale/server/main.ts
Restart=on-failure
RestartSec=3
RestartPreventExitStatus=78
TimeoutStopSec=15
NoNewPrivileges=yes
PrivateTmp=yes

[Install]
WantedBy=default.target
UNIT

cat > "$UNITA/menuapp-backup.service" <<UNIT
[Unit]
Description=Menù & Co. — backup giornaliero verificato

[Service]
Type=oneshot
WorkingDirectory=$RADICE
Environment=MENUAPP_DATI=$DATI
ExecStart=$NODE $RILASCI/attuale/server/backup/cli.ts giornaliero
UNIT

cat > "$UNITA/menuapp-backup.timer" <<UNIT
[Unit]
Description=Menù & Co. — backup ogni giorno alle 03:45

[Timer]
OnCalendar=*-*-* 03:45:00
Persistent=true

[Install]
WantedBy=timers.target
UNIT

systemctl --user daemon-reload
systemctl --user enable --now menuapp.service menuapp-backup.timer
sleep 2
curl -fsS "http://127.0.0.1:$PORTA/api/v1/salute" >/dev/null || errore "Il servizio non risponde: journalctl --user -u menuapp"
ok "Servizio menuapp attivo su 127.0.0.1:$PORTA; timer di backup programmato"

if ! tailscale serve status 2>/dev/null | grep -q ":$PORTA"; then
  echo
  info "Per l'accesso HTTPS dal tailnet serve: tailscale serve --bg --https=$PORTA http://127.0.0.1:$PORTA"
  read -r -p "Eseguirlo ora? Scrivi «sì» per confermare: " risposta
  if [[ "$risposta" == "sì" ]]; then
    tailscale serve --bg --https=$PORTA "http://127.0.0.1:$PORTA"
    ok "tailscale serve attivo: $URL_PUBBLICO/"
  else
    info "tailscale serve non configurato: l'app è raggiungibile solo dal server."
  fi
fi

dopo=$(fotografia_esterni)
[[ "$prima" == "$dopo" ]] || errore "Lo stato dei servizi esterni è cambiato durante l'installazione: controlla prima di proseguire"
ok "Altri servizi del server invariati"
