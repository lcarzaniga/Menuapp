// Catalogo iniziale degli ingredienti (SPEC §7.5).
// Formato: nome | reparto | unità preferita | sinonimi separati da «;» | «f» se di solito a quantità fissa.

export const CATALOGO = `
patate|ortofrutta|kg|patata
cipolle|ortofrutta|pz|cipolla;cipolle dorate;cipolla dorata
cipolle rosse|ortofrutta|pz|cipolla rossa;cipolla di tropea;cipolle di tropea
scalogno|ortofrutta|pz|scalogni
porro|ortofrutta|pz|porri
aglio|ortofrutta|spicchio|spicchio d'aglio;spicchi d'aglio
carote|ortofrutta|pz|carota
sedano|ortofrutta|pz|costa di sedano;coste di sedano;gambo di sedano
pomodori|ortofrutta|kg|pomodoro;pomodori ramati
pomodorini|ortofrutta|g|pomodorini ciliegino;pomodori ciliegino;pomodorini datterini
zucchine|ortofrutta|pz|zucchina
melanzane|ortofrutta|pz|melanzana
peperoni|ortofrutta|pz|peperone
funghi champignon|ortofrutta|g|champignon;funghi
funghi porcini freschi|ortofrutta|g|porcini freschi
spinaci|ortofrutta|g|spinaci freschi
bietole|ortofrutta|g|bieta;erbette
cavolfiore|ortofrutta|pz|cavolfiori
broccoli|ortofrutta|pz|broccolo
cavolo nero|ortofrutta|g|
cavolo cappuccio|ortofrutta|pz|verza;cavolo verza
cavolini di bruxelles|ortofrutta|g|cavoletti di bruxelles
carciofi|ortofrutta|pz|carciofo
finocchi|ortofrutta|pz|finocchio
radicchio|ortofrutta|pz|radicchio rosso;radicchio trevisano
insalata|ortofrutta|pz|lattuga;insalata verde;cespo di lattuga
rucola|ortofrutta|g|rucola selvatica
zucca|ortofrutta|kg|zucca delica;zucca mantovana
fagiolini|ortofrutta|g|cornetti
piselli freschi|ortofrutta|g|
asparagi|ortofrutta|g|asparago
cetrioli|ortofrutta|pz|cetriolo
castagne|ortofrutta|g|castagna;marroni
limoni|ortofrutta|pz|limone
arance|ortofrutta|pz|arancia
mandarini|ortofrutta|pz|mandarino;clementine;clementina
mele|ortofrutta|pz|mela
pere|ortofrutta|pz|pera
uva|ortofrutta|g|
fragole|ortofrutta|g|fragola
frutti di bosco|ortofrutta|g|mirtilli;lamponi
melagrana|ortofrutta|pz|melograno
kiwi|ortofrutta|pz|
ananas|ortofrutta|pz|
prezzemolo|ortofrutta|mazzetto|prezzemolo fresco|f
basilico|ortofrutta|mazzetto|basilico fresco;foglie di basilico
rosmarino|ortofrutta|rametto|rosmarino fresco;rametto di rosmarino|f
salvia|ortofrutta|foglia|foglie di salvia;salvia fresca|f
timo|ortofrutta|rametto|timo fresco|f
menta|ortofrutta|foglia|menta fresca;foglie di menta|f
erba cipollina|ortofrutta|mazzetto||f
zenzero|ortofrutta|g|zenzero fresco
peperoncino fresco|ortofrutta|pz||f
manzo|macelleria|kg|carne di manzo;polpa di manzo
vitello|macelleria|kg|carne di vitello;fesa di vitello
macinato di manzo|macelleria|g|carne macinata;macinato;trito di manzo
macinato misto|macelleria|g|trito misto
maiale|macelleria|kg|carne di maiale;lonza di maiale;lonza
salsiccia|macelleria|g|salsicce;salsiccia fresca
pollo|macelleria|kg|petto di pollo;pollo intero
tacchino|macelleria|kg|fesa di tacchino;petto di tacchino
cappone|macelleria|pz|
faraona|macelleria|pz|
anatra|macelleria|pz|
agnello|macelleria|kg|abbacchio;cosciotto d'agnello
coniglio|macelleria|pz|
arrosto di vitello|macelleria|kg|
carne per brodo|macelleria|g|biancostato;muscolo di manzo;muscolo
ossobuco|macelleria|pz|ossibuchi
cotechino|macelleria|pz|
zampone|macelleria|pz|
salmone|pescheria|g|salmone fresco;filetto di salmone
salmone affumicato|pescheria|g|
gamberi|pescheria|g|gamberetti;gamberoni
mazzancolle|pescheria|g|
calamari|pescheria|g|calamaro
seppie|pescheria|g|seppia
polpo|pescheria|kg|
cozze|pescheria|kg|
vongole|pescheria|kg|vongole veraci
baccalà|pescheria|g|stoccafisso
orata|pescheria|pz|orate
branzino|pescheria|pz|spigola
tonno fresco|pescheria|g|
alici fresche|pescheria|g|acciughe fresche
capesante|pescheria|pz|capasanta
prosciutto crudo|salumi-formaggi|g|crudo;prosciutto di parma;prosciutto san daniele
prosciutto cotto|salumi-formaggi|g|cotto
mortadella|salumi-formaggi|g|
salame|salumi-formaggi|g|salame milano;salamino
speck|salumi-formaggi|g|
pancetta|salumi-formaggi|g|pancetta dolce;pancetta tesa;pancetta affumicata
guanciale|salumi-formaggi|g|
bresaola|salumi-formaggi|g|
coppa|salumi-formaggi|g|capocollo
lardo|salumi-formaggi|g|
parmigiano reggiano|salumi-formaggi|g|parmigiano;parmigiano grattugiato;grana;grana padano;formaggio grattugiato
pecorino romano|salumi-formaggi|g|pecorino;pecorino grattugiato
mozzarella|salumi-formaggi|g|fiordilatte;fior di latte
mozzarella di bufala|salumi-formaggi|g|bufala
burrata|salumi-formaggi|pz|
stracchino|salumi-formaggi|g|crescenza
gorgonzola|salumi-formaggi|g|
fontina|salumi-formaggi|g|
taleggio|salumi-formaggi|g|
provola|salumi-formaggi|g|provola affumicata;scamorza;scamorza affumicata
asiago|salumi-formaggi|g|
emmental|salumi-formaggi|g|groviera;gruyère
caprino|salumi-formaggi|g|formaggio di capra
latte|latte-uova-frigo|l|latte intero;latte parzialmente scremato
panna fresca|latte-uova-frigo|ml|panna;panna liquida;panna da montare
panna da cucina|latte-uova-frigo|ml|panna da cucina uht
burro|latte-uova-frigo|g|burro morbido;burro fuso
uova|latte-uova-frigo|pz|uovo;uova intere
tuorli|latte-uova-frigo|pz|tuorlo;rosso d'uovo;rossi d'uovo
albumi|latte-uova-frigo|pz|albume;bianco d'uovo;chiare d'uovo
yogurt|latte-uova-frigo|g|yogurt bianco;yogurt greco
mascarpone|latte-uova-frigo|g|
ricotta|latte-uova-frigo|g|ricotta vaccina;ricotta di pecora
philadelphia|latte-uova-frigo|g|formaggio spalmabile;formaggio fresco spalmabile
pasta sfoglia|latte-uova-frigo|confezione|sfoglia;rotolo di pasta sfoglia
pasta brisée|latte-uova-frigo|confezione|brisée
pasta frolla pronta|latte-uova-frigo|confezione|
gnocchi di patate|latte-uova-frigo|g|gnocchi
pasta fresca all'uovo|latte-uova-frigo|g|tagliatelle fresche;pasta fresca
tortellini|latte-uova-frigo|g|tortellini freschi
ravioli|latte-uova-frigo|g|ravioli freschi
pane|pane-forno|g|pane comune;pagnotta
pane in cassetta|pane-forno|confezione|pancarrè;pan carré
pangrattato|pane-forno|g|pane grattugiato
grissini|pane-forno|confezione|
crostini|pane-forno|confezione|
baguette|pane-forno|pz|filone
focaccia|pane-forno|g|
spaghetti|pasta-riso-farine|g|spaghettoni
penne|pasta-riso-farine|g|penne rigate
rigatoni|pasta-riso-farine|g|
fusilli|pasta-riso-farine|g|
paccheri|pasta-riso-farine|g|
linguine|pasta-riso-farine|g|bavette
tagliatelle secche|pasta-riso-farine|g|fettuccine;pappardelle
lasagne|pasta-riso-farine|g|sfoglie per lasagne;pasta per lasagne
cannelloni|pasta-riso-farine|g|
pasta corta|pasta-riso-farine|g|pasta
pastina|pasta-riso-farine|g|pasta per brodo;stelline
riso carnaroli|pasta-riso-farine|g|riso;carnaroli;riso per risotti;riso arborio;arborio
riso basmati|pasta-riso-farine|g|basmati
farina 00|pasta-riso-farine|g|farina;farina bianca
farina 0|pasta-riso-farine|g|farina manitoba;manitoba
farina integrale|pasta-riso-farine|g|
semola rimacinata|pasta-riso-farine|g|semola;semola di grano duro
fecola di patate|pasta-riso-farine|g|fecola
amido di mais|pasta-riso-farine|g|maizena
farina di mais|pasta-riso-farine|g|polenta;farina per polenta
lievito di birra|pasta-riso-farine|g|lievito di birra fresco;lievito di birra secco
lievito per dolci|pasta-riso-farine|bustina|lievito vanigliato;lievito chimico;lievito in polvere
olio extravergine d'oliva|dispensa|ml|olio evo;olio extravergine;olio d'oliva;olio
olio di semi|dispensa|ml|olio di semi di girasole;olio per friggere;olio di arachidi
aceto di vino|dispensa|ml|aceto;aceto bianco;aceto di vino bianco
aceto balsamico|dispensa|ml|balsamico;aceto balsamico di modena
passata di pomodoro|dispensa|g|passata;salsa di pomodoro
pomodori pelati|dispensa|g|pelati
polpa di pomodoro|dispensa|g|pomodoro a pezzi;pomodori a pezzetti
concentrato di pomodoro|dispensa|g|doppio concentrato;estratto di pomodoro
tonno in scatola|dispensa|g|tonno;tonno sott'olio
acciughe sott'olio|dispensa|g|acciughe;alici sott'olio;filetti di acciuga
capperi|dispensa|g|capperi sotto sale;capperi sott'aceto
olive verdi|dispensa|g|
olive nere|dispensa|g|olive taggiasche;olive
funghi porcini secchi|dispensa|g|porcini secchi
fagioli borlotti|dispensa|g|borlotti
fagioli cannellini|dispensa|g|cannellini;fagioli
ceci|dispensa|g|
lenticchie|dispensa|g|
mais in scatola|dispensa|g|mais
brodo vegetale|dispensa|ml|brodo
dado da brodo|dispensa|pz|dado
noci|dispensa|g|gherigli di noce
mandorle|dispensa|g|mandorle pelate;farina di mandorle
nocciole|dispensa|g|
pinoli|dispensa|g|
pistacchi|dispensa|g|pistacchio
uvetta|dispensa|g|uva passa;uva sultanina
datteri|dispensa|g|
miele|dispensa|g|
marmellata|dispensa|g|confettura
maionese|dispensa|g|
vino bianco da cucina|dispensa|ml|vino bianco secco
vino rosso da cucina|dispensa|ml|
marsala|dispensa|ml|
sale|spezie-condimenti|qb|sale fino;sale marino|f
sale grosso|spezie-condimenti|g||f
pepe nero|spezie-condimenti|qb|pepe;pepe macinato|f
peperoncino|spezie-condimenti|qb|peperoncino secco;peperoncino in polvere|f
noce moscata|spezie-condimenti|qb||f
cannella|spezie-condimenti|qb|cannella in polvere;stecca di cannella|f
chiodi di garofano|spezie-condimenti|pz|chiodo di garofano|f
alloro|spezie-condimenti|foglia|foglie di alloro;foglia di alloro|f
origano|spezie-condimenti|qb|origano secco|f
zafferano|spezie-condimenti|bustina|pistilli di zafferano
paprika|spezie-condimenti|qb|paprika dolce|f
curry|spezie-condimenti|qb||f
cumino|spezie-condimenti|qb||f
bacche di ginepro|spezie-condimenti|pz|ginepro|f
senape|spezie-condimenti|g|senape di digione
salsa di soia|spezie-condimenti|ml|soia
zucchero|dolci|g|zucchero semolato;zucchero bianco
zucchero a velo|dolci|g|
zucchero di canna|dolci|g|
cioccolato fondente|dolci|g|cioccolato;cioccolato nero
cioccolato al latte|dolci|g|
cioccolato bianco|dolci|g|
cacao amaro|dolci|g|cacao;cacao in polvere
savoiardi|dolci|g|
amaretti|dolci|g|
biscotti secchi|dolci|g|biscotti
panettone|dolci|pz|
pandoro|dolci|pz|
torrone|dolci|g|
canditi|dolci|g|frutta candita;scorze candite
vanillina|dolci|bustina|vaniglia;baccello di vaniglia;estratto di vaniglia|f
colla di pesce|dolci|g|gelatina in fogli;gelatina
granella di nocciole|dolci|g|granella
caffè|dolci|g|caffè in polvere;caffè macinato
piselli surgelati|surgelati|g|piselli
spinaci surgelati|surgelati|g|
verdure grigliate surgelate|surgelati|g|
gamberi surgelati|surgelati|g|code di gambero
gelato|surgelati|g|
acqua naturale|bevande|l|acqua;acqua minerale
acqua frizzante|bevande|l|acqua gassata
vino rosso|bevande|pz|
vino bianco|bevande|pz|
prosecco|bevande|pz|spumante
birra|bevande|pz|
succo di frutta|bevande|l|succo
aranciata|bevande|l|
limoncello|bevande|pz|
amaro|bevande|pz|digestivo
tovaglioli|casa-tavola|confezione|tovaglioli di carta
tovaglia|casa-tavola|pz|tovaglia di carta
carta forno|casa-tavola|confezione|carta da forno
alluminio|casa-tavola|confezione|carta stagnola;stagnola
pellicola|casa-tavola|confezione|pellicola trasparente
candele|casa-tavola|pz|candela
ghiaccio|casa-tavola|confezione|cubetti di ghiaccio
piatti di carta|casa-tavola|confezione|
bicchieri di plastica|casa-tavola|confezione|bicchieri usa e getta
`
