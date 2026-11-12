# Collaudo v1.0 — lista di controllo

## Automatico (`npm run check`, `npm run test:e2e`)

- [x] Dominio: porzioni, unità e conversioni vietate, parser (112 casi), spesa (6 classi, R1–R10), condivisione
- [x] Database reale: migrazioni, ogni vincolo, seed, backup con scritture concorrenti, ripristini falliti senza effetti
- [x] API: tutti i codici d'errore, conflitti di versione, idempotenza, Origin/Content-Type
- [x] E2E telefono e desktop: navigazione, sola lettura senza server, backup/ripristino, service worker
- [x] E2E menù e ricettario: inserimento rapido e multiriga, voci, «Crea nel ricettario», parser, vista cucina scalata
- [x] E2E collaudo di Natale da due dispositivi: evento, menù, ricette, spesa, acquisti, riconciliazione automatica, conflitto, piano, stampa, backup e ripristino verificato con la stessa impronta

## Manuale sul server di produzione (dopo l'installazione autorizzata)

- [ ] `https://loris-srv01.dala-tortoise.ts.net:9870/` da S23, tablet e PC; installazione PWA
- [ ] stessa modifica vista da due dispositivi entro 15 s
- [ ] Tailscale spento: banner e comandi disattivati; riacceso: tutto torna attivo
- [ ] condivisione della spesa su WhatsApp/Keep
- [ ] vista cucina con schermo sempre acceso sul tablet
- [ ] stampa / Salva come PDF da Android e da PC
- [ ] secondo rilascio: avviso «Nuova versione disponibile», nessun ricaricamento automatico
- [ ] riavvio del server: servizio e timer ripartono; backup notturno presente il mattino dopo
- [ ] `http://192.168.1.160:9870/` non risponde dalla LAN
