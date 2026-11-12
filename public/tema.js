// Applica tema e dimensione del testo prima del primo disegno (preferenze del dispositivo).
;(function () {
  var tema = 'sistema'
  var testo = 'auto'
  try {
    tema = localStorage.getItem('menuapp.tema') || 'sistema'
    testo = localStorage.getItem('menuapp.testo') || 'auto'
  } catch {}
  var scuro = tema === 'scuro' || (tema === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', scuro)
  document.documentElement.setAttribute('data-testo', testo)
})()
