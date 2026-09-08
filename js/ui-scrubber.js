/* ==========================================================================
   Barre temporelle 24h : puissances instantanees + lecture automatique.
   ========================================================================== */
(function (global) {
  'use strict';

  var esc = MGDom.esc;

  function create(store) {
    var root = MGDom.el('<div class="scrubber"></div>');
    var isPlaying = false;
    var timer = null;

    root.innerHTML =
      '<div class="scrubber-chips"></div>' +
      '<div class="scrubber-row">' +
      '<button class="play-btn" data-action="play"></button>' +
      '<div class="scrubber-track">' +
      '<input type="range" min="0" max="23" step="1" class="hour-range" aria-label="Heure affichée">' +
      '<div class="hour-marks"></div>' +
      '</div></div>';

    var chips = root.querySelector('.scrubber-chips');
    var playBtn = root.querySelector('[data-action="play"]');
    var range = root.querySelector('.hour-range');
    var marks = root.querySelector('.hour-marks');

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

    marks.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-hour]');
      if (!btn) return;
      stop();
      store.setHour(parseInt(btn.getAttribute('data-hour'), 10));
    });

    // Les 24 reperes sont crees une seule fois, puis seulement reclasses.
    for (var i = 0; i < 24; i++) {
      marks.appendChild(MGDom.el(
        '<button class="hour-mark" data-hour="' + i + '" title="Heure ' + i + ':00">' +
        '<span class="dot"></span><span class="hour-label">' + i + 'h</span></button>'
      ));
    }

    function chip(cls, icon, iconCls, label, value) {
      return '<div class="chip ' + cls + '">' + Icons.get(icon, iconCls, 14) +
        (label ? '<span class="chip-label">' + esc(label) + '</span>' : '') +
        '<span class="chip-value">' + esc(value) + '</span></div>';
    }

    function update(state) {
      var steps = state.simulation.steps;
      var h = state.currentHour;
      var s = steps[h] || steps[0];
      var deficitHours = state.simulation.summary.hoursWithDeficit;

      // Bandeau de puissances instantanees
      var html = '<div style="display:flex;gap:0.5rem;flex-shrink:0">';
      html += '<div class="chip clock">' + Icons.get('clock', 't-emerald', 14) +
        '<span>' + esc(s.label) + '</span>' +
        '<span class="text-10" style="opacity:.8;font-weight:400">(' + (h + 1) + '/24)</span></div>';
      if (s.isDeficit) {
        html += '<div class="chip deficit">' + Icons.get('alertCircle', 't-rose', 14) +
          '<span>Déficit : -' + s.unservedLoadKw.toFixed(1) + ' kW</span></div>';
      }
      html += '</div><div style="display:flex;gap:0.375rem;flex-shrink:0">';
      html += chip('load', 'zap', 't-orange', 'Charge:', s.loadKw.toFixed(1) + ' kW');
      html += chip('pv', 'sun', 't-amber', 'PV:', s.pvGenKw.toFixed(1) + ' kW');
      html += chip('batt', 'battery', 't-teal',
        'Bat (' + s.batterySocPercent.toFixed(0) + '%):',
        (s.batteryActualKw > 0 ? '+' : '') + s.batteryActualKw.toFixed(1) + ' kW');
      html += chip('grid', 'activity', 't-blue', 'Réseau:',
        (s.gridImportKw > 0.05 ? '+' + s.gridImportKw.toFixed(1)
          : s.gridExportKw > 0.05 ? '-' + s.gridExportKw.toFixed(1)
          : '0.0') + ' kW');
      html += '</div>';
      chips.innerHTML = html;

      playBtn.innerHTML = isPlaying
        ? Icons.filled('pause', '', 16)
        : Icons.filled('play', '', 16);
      playBtn.title = isPlaying ? 'Pause' : 'Lecture automatique';
      playBtn.classList.toggle('playing', isPlaying);

      MGDom.setVal(range, h);

      for (var i = 0; i < 24; i++) {
        var btn = marks.children[i];
        var dot = btn.firstElementChild;
        var selected = i === h;
        btn.classList.toggle('selected', selected);
        dot.className = 'dot' +
          (deficitHours.indexOf(i) !== -1 ? ' deficit' : selected ? ' selected' : (i % 6 === 0 ? ' major' : ''));
      }
    }

    return { el: root, update: update };
  }

  global.MGScrubber = { create: create };
})(window);
