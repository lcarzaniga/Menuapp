// Applica il tema prima del primo disegno (preferenza del dispositivo, SPEC §5).
;(function () {
  var preferenza = 'sistema'
  try {
    preferenza = localStorage.getItem('menuapp.tema') || 'sistema'
  } catch {}
  var scuro = preferenza === 'scuro' || (preferenza === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', scuro)
})()
