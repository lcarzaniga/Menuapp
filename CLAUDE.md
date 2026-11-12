# Menù & Co. (menuapp)

PWA React + TypeScript + Vite, dati locali nel browser con Dexie (IndexedDB).
Repo pubblico `github.com/lcarzaniga/Menuapp`, pubblicata su
https://lcarzaniga.github.io/Menuapp/ da una GitHub Action a ogni push su `main`.

## Chi la usa e come

- L'utente è Loris e scrive in **italiano**. Anche interfaccia, commenti, messaggi e
  documentazione sono in italiano.
- Si usa soprattutto da smartphone Android, installata come PWA.

## Ambiente

- Node 24 via nvm (`.nvmrc`), minimo 22.12. Non usare il Node di sistema in
  `/usr/bin` (v20, troppo vecchio).
- `base: '/Menuapp/'` in `vite.config.ts`, anche in sviluppo: l'app sta sempre sotto
  `/Menuapp/`.
- Icone PWA generate da `public/logo.svg` con `npm run generate-pwa-assets`.
- Identità Git solo locale, email noreply di GitHub. Push via SSH.

## Sviluppo

- Sessione tmux `menuapp`, finestra `dev` con `npm run dev`. Vite ascolta solo su
  `127.0.0.1:5173`: il server non ha firewall, quindi niente `--host`.
- Dal PC: `ssh -L 5173:localhost:5173 loris@loris-srv01.dala-tortoise.ts.net`, poi
  http://localhost:5173/Menuapp/
- Dal telefono (solo tailnet, mai `funnel`):
  `tailscale serve --bg --https=8443 http://127.0.0.1:5173` →
  https://loris-srv01.dala-tortoise.ts.net:8443/Menuapp/
- Il service worker non è attivo in `dev`. Per provare installazione e offline:
  `npm run build && npm run preview` (porta 4173), esposta con
  `tailscale serve --bg --https=8444 http://127.0.0.1:4173`.
- Prima di un commit: `npm run lint` e `npm run build`.
