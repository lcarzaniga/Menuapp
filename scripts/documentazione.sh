#!/usr/bin/env bash
# Porta su main rami di sola documentazione (docs/*.md) senza rilascio su TEST (docs/RILASCI.md,
# decisione di Loris del 24/11/2026). Claude lo usa appena prima di un rilascio in PRODUZIONE.
# Uso: scripts/documentazione.sh <ramo> [<ramo>…]
# Ogni ramo deve essere un avanzamento di main che cambia solo file docs/*.md; poi main va su GitHub.
# Lo script di PRODUZIONE accetta main avanti rispetto a TEST solo per questi file.
source "$(dirname "$0")/comuni.sh"

cd "$RADICE"
[[ $# -gt 0 ]] || errore "Indica almeno un ramo di documentazione"
[[ -z "$(git status --porcelain)" ]] || errore "Albero Git non pulito"
git switch -q main
git fetch -q origin main || errore "GitHub non raggiungibile"
[[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] || errore "main non coincide con origin/main"

for ramo in "$@"; do
  git rev-parse -q --verify "refs/heads/$ramo" >/dev/null || errore "Ramo inesistente: $ramo"
  altri=$(git diff --name-only "main...$ramo" | grep -vE '^docs/[^/]+\.md$' || true)
  [[ -z "$altri" ]] || errore "$ramo cambia anche file fuori da docs/*.md: va su TEST con scripts/rilascia.sh ($altri)"
  git merge -q --ff-only "$ramo" || errore "$ramo non è un avanzamento di main: niente unione"
  ok "$ramo unito in main ($(git rev-parse --short HEAD))"
done

git push -q origin main || errore "Push su GitHub non riuscito"
ok "main pubblicato su GitHub ($(git rev-parse --short HEAD)), nessun rilascio"
