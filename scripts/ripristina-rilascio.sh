#!/usr/bin/env bash
# Torna a un rilascio precedente con lo stesso schema (SPEC §14.4). Uso: scripts/ripristina-rilascio.sh <id>
source "$(dirname "$0")/comuni.sh"
id=${1:-}
[[ -n "$id" && -d "$RILASCI/$id" ]] || { ls -1 "$RILASCI" | grep -v attuale; errore "Indica uno dei rilasci elencati"; }
attuale=$(readlink "$RILASCI/attuale")
s_att=$(versione_schema_codice "$RILASCI/$attuale")
s_new=$(versione_schema_codice "$RILASCI/$id")
[[ "$s_att" == "$s_new" ]] || errore "Schema diverso (v$s_att → v$s_new): serve il ripristino d'emergenza con il backup pre-migrazione (docs/OPERAZIONI.md)"
ln -sfn "$id" "$RILASCI/.attuale-nuovo"
mv -T "$RILASCI/.attuale-nuovo" "$RILASCI/attuale"
systemctl --user restart menuapp
sleep 2
curl -fsS "http://127.0.0.1:$PORTA/api/v1/salute" | grep -q "\"rilascio\":\"$id\"" || errore "Il servizio non risponde con il rilascio $id"
ok "Rilascio attivo: $id"
