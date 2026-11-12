// Reparti iniziali (SPEC §7.6), con id stabili.
export const REPARTI_INIZIALI: { id: string; nome: string }[] = [
  { id: 'rep-ortofrutta', nome: 'Ortofrutta' },
  { id: 'rep-macelleria', nome: 'Macelleria' },
  { id: 'rep-pescheria', nome: 'Pescheria' },
  { id: 'rep-salumi-formaggi', nome: 'Salumi e formaggi' },
  { id: 'rep-latte-uova-frigo', nome: 'Latte, uova e frigo' },
  { id: 'rep-pane-forno', nome: 'Pane e forno' },
  { id: 'rep-pasta-riso-farine', nome: 'Pasta, riso e farine' },
  { id: 'rep-dispensa', nome: 'Dispensa' },
  { id: 'rep-spezie-condimenti', nome: 'Spezie e condimenti' },
  { id: 'rep-dolci', nome: 'Dolci' },
  { id: 'rep-surgelati', nome: 'Surgelati' },
  { id: 'rep-bevande', nome: 'Bevande' },
  { id: 'rep-casa-tavola', nome: 'Casa e tavola' },
  { id: 'rep-altro', nome: 'Altro' },
]

export const PORTATE_PREDEFINITE_INIZIALI = [
  'Antipasti',
  'Primi',
  'Secondi',
  'Contorni',
  'Dolci',
  'Frutta e caffè',
  'Bevande',
]
