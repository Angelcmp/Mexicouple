(function () {
  'use strict';

  var STEPS = [
    {
      accent: 'rosa',
      title: '¡Hola, Mexicouple!',
      text: 'Este es tu mapa retro de vacaciones en México. Aquí van a decidir juntos cuál es la mejor ruta.'
    },
    {
      accent: 'mar',
      title: 'Explora el mapa',
      text: 'Haz clic en cualquier estado para ver los lugares recomendados que hay en esa zona.'
    },
    {
      accent: 'selva',
      title: 'Guarda tus ideas',
      text: 'Añade lugares con título, categoría, una imagen de referencia y quién lo recomienda.'
    },
    {
      accent: 'rosa',
      title: 'Decidan juntos',
      text: 'Comparen sus notas, marquen favoritos y elijan la ruta perfecta para sus vacaciones.'
    }
  ];

  var current = 0;

  function el(id) { return document.getElementById(id); }

  function renderStep() {
    var s = STEPS[current];
    var container = el('ob-steps');
    container.innerHTML =
      '<div class="ob-step" data-accent="' + s.accent + '">' +
        '<div class="ob-icon"></div>' +
        '<h3 class="ob-title">' + s.title + '</h3>' +
        '<p class="ob-text">' + s.text + '</p>' +
      '</div>';

    var dots = el('ob-dots');
    dots.innerHTML = '';
    STEPS.forEach(function (_, i) {
      var d = document.createElement('span');
      d.className = 'ob-dot' + (i === current ? ' active' : '');
      dots.appendChild(d);
    });

    el('ob-next').textContent = (current === STEPS.length - 1) ? 'Empezar' : 'Siguiente';
  }

  function finish() {
    Storage.markOnboardingSeen();
    el('onboarding').classList.add('hidden');
  }

  function show() {
    current = 0;
    renderStep();
    el('onboarding').classList.remove('hidden');
  }

  el('ob-next').addEventListener('click', function () {
    if (current < STEPS.length - 1) {
      current++;
      renderStep();
    } else {
      finish();
    }
  });

  el('ob-skip').addEventListener('click', finish);
  el('btn-help').addEventListener('click', show);

  if (!Storage.onboardingSeen()) {
    show();
  }
})();
