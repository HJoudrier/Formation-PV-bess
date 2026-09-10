/* ==========================================================================
   Barre temporelle 24h de l'en-tete : lecture automatique, curseur d'heure
   et rappel de l'heure courante.
   ========================================================================== */
(function (global) {
  'use strict';

  var esc = MGDom.esc;

  function create(store) {
    var root = MGDom.el(
      '<div class="scrubber">' +
      '<div class="scrubber-row">' +
      '<button class="play-btn" data-action="play"></button>' +
      '<input type="range" min="0" max="23" step="1" class="hour-range" aria-label="Heure affichée">' +
      '<div class="scrubber-now"></div>' +
      '</div></div>'
    );

    var playBtn = root.querySelector('[data-action="play"]');
    var range = root.querySelector('.hour-range');
    var now = root.querySelector('.scrubber-now');

    var isPlaying = false;
    var timer = null;

    function stop() {
      isPlaying = false;
      if (timer) { clearInterval(timer); timer = null; }
    }

    playBtn.addEventListener('click', function () {
      if (isPlaying) {
        stop();
      } else {
        isPlaying = true;
        timer = setInterval(function () {
          store.setHour((store.state().currentHour + 1) % 24);
        }, 1000);
      }
      update(store.state());
    });

    range.addEventListener('input', function () {
      stop();
      store.setHour(parseInt(range.value, 10));
    });

    function update(state) {
      var steps = state.simulation.steps;
      var h = state.currentHour;
      var s = steps[h] || steps[0];

      playBtn.innerHTML = isPlaying ? Icons.filled('pause', '', 16) : Icons.filled('play', '', 16);
      playBtn.title = isPlaying ? 'Pause' : 'Lecture automatique';
      playBtn.classList.toggle('playing', isPlaying);

      MGDom.setVal(range, h);

      // Alerte de deficit sur l'heure courante, puis l'heure elle-meme.
      now.innerHTML =
        (s.isDeficit
          ? '<div class="chip deficit">' + Icons.get('alertCircle', 't-rose', 14) +
            '<span>Déficit : -' + s.unservedLoadKw.toFixed(1) + ' kW</span></div>'
          : '') +
        '<div class="chip clock">' + Icons.get('clock', 't-emerald', 14) +
        '<span>' + esc(s.label) + '</span>' +
        '<span class="text-10" style="opacity:.8;font-weight:400">(' + (h + 1) + '/24)</span></div>';
    }

    return { el: root, update: update };
  }

  global.MGScrubber = { create: create };
})(window);
