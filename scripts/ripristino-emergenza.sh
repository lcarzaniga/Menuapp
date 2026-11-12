#!/usr/bin/env bash
# Ripristino d'emergenza quando il servizio non parte (SPEC §11.5). Uso: scripts/ripristino-emergenza.sh <nome-backup.db>
source "$(dirname "$0")/comuni.sh"
nome=${1:-}
sorgente="$DATI/backup/$nome"
[[ -n "$nome" && -f "$sorgente" ]] || { ls -1t "$DATI/backup" | grep '\.db$' | head -20; errore "Indica uno dei backup elencati"; }
"$NODE" -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync(process.argv[1],{readOnly:true});const r=d.prepare('PRAGMA integrity_check').get();if(r.integrity_check!=='ok'){console.error(r);process.exit(1)}" "$sorgente" \
  || errore "Il backup scelto non supera la verifica di integrità"
read -r -p "Sostituire il database di produzione con $nome? Scrivi «RIPRISTINA»: " r
[[ "$r" == "RIPRISTINA" ]] || errore "Annullato"
systemctl --user stop menuapp
copia="$DATI/backup/emergenza-$(date +%Y%m%d-%H%M%S).db"
[[ -f "$DATI/menuapp.db" ]] && cp "$DATI/menuapp.db" "$copia" && ok "Database attuale copiato in $copia"
rm -f "$DATI/menuapp.db-wal" "$DATI/menuapp.db-shm"
cp "$sorgente" "$DATI/menuapp.db"
systemctl --user start menuapp
sleep 2
curl -fsS "http://127.0.0.1:$PORTA/api/v1/salute" >/dev/null || errore "Il servizio non risponde: journalctl --user -u menuapp"
ok "Ripristino completato da $nome"
