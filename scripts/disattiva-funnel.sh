#!/usr/bin/env bash
# Spegne il solo Tailscale Funnel di Menù & Co. (Debian diventa l'ambiente TEST, docs/RILASCI.md).
# Uso: scripts/disattiva-funnel.sh
# Tocca solo la 443 pubblica verso l'ingresso pubblico (127.0.0.1:$PORTA_PUBBLICA). Restano invariati
# Tailscale, i serve solo tailnet (9870 per TEST, 8443 per lo sviluppo), il servizio e i suoi dati.
# Mai `tailscale funnel reset` / `tailscale serve reset`: cancellerebbero anche gli altri serve.
source "$(dirname "$0")/comuni.sh"

stato() { tailscale serve status --json; }
# Porte in Funnel e destinazione della 443, dal JSON di `tailscale serve status`.
leggi() {
  node -e '
    let t = ""; process.stdin.on("data", (x) => (t += x)).on("end", () => {
      const j = t.trim() ? JSON.parse(t) : {}
      const funnel = Object.keys(j.AllowFunnel ?? {}).filter((k) => j.AllowFunnel[k])
      const web = j.Web ?? {}
      const altri = Object.keys(web).filter((k) => !k.endsWith(":443")).sort().map((k) => `${k} ${JSON.stringify(web[k])}`)
      const h443 = Object.entries(web).find(([k]) => k.endsWith(":443"))?.[1]?.Handlers?.["/"]?.Proxy ?? ""
      console.log(JSON.stringify({ funnel, h443, altri }))
    })'
}
campo() { node -e 'const j = JSON.parse(process.argv[1]); const v = j[process.argv[2]]; console.log(Array.isArray(v) ? v.join("\n") : v)' "$1" "$2"; }

prima=$(stato | leggi)
funnel=$(campo "$prima" funnel)
if [[ -z "$funnel" ]]; then
  ok "Funnel già spento: nulla da fare"
  exit 0
fi
# Si spegne solo il Funnel atteso: la 443 verso l'ingresso pubblico di Menù & Co.
[[ "$funnel" == "$HOST_TS:443" ]] || errore "Funnel attivo su porte inattese ($funnel): non lo tocco, controlla «tailscale funnel status»"
[[ "$(campo "$prima" h443)" == "http://127.0.0.1:$PORTA_PUBBLICA" ]] || errore "La 443 non porta all'ingresso pubblico di Menù & Co.: non la tocco"

info "Spegnimento del Funnel sulla 443…"
tailscale funnel --https=443 off || errore "tailscale funnel --https=443 off non riuscito"

dopo=$(stato | leggi)
[[ -z "$(campo "$dopo" funnel)" ]] || errore "Il Funnel risulta ancora attivo: $(campo "$dopo" funnel)"
[[ "$(campo "$dopo" altri)" == "$(campo "$prima" altri)" ]] || errore "Gli altri serve sono cambiati: controlla «tailscale serve status»"
tailscale status >/dev/null || errore "Tailscale non risulta collegato"
[[ "$(curl -fsS "$URL_PUBBLICO/api/v1/salute")" == '{"ok":true,'* ]] || errore "TEST non risponde su $URL_PUBBLICO"
ok "Funnel spento. TEST resta su $URL_PUBBLICO (solo tailnet); Tailscale e gli altri serve invariati"
tailscale serve status
