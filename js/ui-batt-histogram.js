/* ==========================================================================
   Histogramme editable des consignes batterie sur 24h.
   On saisit une barre au pointeur (souris ou tactile) et on ajuste sa valeur
   en glissant verticalement. Convention de l'editeur de consignes :
   au-dessus de zero = charge, en dessous = decharge.
   ========================================================================== */
(function (global) {
  'use strict';

  var esc = MGDom.esc;

  var W = 800, H = 210;
  var M = { l: 44, r: 38, t: 18, b: 22 };  // marge droite : axe des SOC
  var PW = W - M.l - M.r;
  var PH = H - M.t - M.b;
  var BAND = PW / 24;
  var HALF = PH / 2;

  var SNAP = 1;        // pas d'ajustement, en kW
  var DEAD_ZONE = 0.75; // en deca, la consigne retombe a zero (veille)

  function yOf(v, pMax) {
    return M.t + HALF * (1 - v / (pMax || 1));
  }

  var SOC_COLOR = '#c084fc';

  /** Ordonnee d'un etat de charge, en pourcentage (0% en bas, 100% en haut). */
  function socY(pct) {
    return M.t + PH * (1 - Math.max(0, Math.min(100, pct)) / 100);
  }

  function clamp(v, mn, mx) {
    return Math.max(mn, Math.min(mx, v));
  }

  /** Rectangle d'une barre, de la ligne zero jusqu'a la valeur. */
  function barRect(x, bw, y0, value, pMax, attrs) {
    var yv = yOf(value, pMax);
    return '<rect x="' + x.toFixed(1) + '" y="' + Math.min(y0, yv).toFixed(1) +
           '" width="' + bw.toFixed(1) + '" height="' + Math.max(1.5, Math.abs(yv - y0)).toFixed(1) +
           '" rx="2" ' + attrs + '/>';
  }

  function valueAt(y, pMax) {
    var v = (pMax || 1) * (1 - (y - M.t) / HALF);
    v = Math.max(-pMax, Math.min(pMax, v));
    v = Math.round(v / SNAP) * SNAP;
    return Math.abs(v) < DEAD_ZONE ? 0 : v;
  }

  function create(store) {
    var root = MGDom.el(
      '<div class="batt-histo">' +
      '<div class="batt-histo-head">' +
      '<span class="batt-histo-title">' + Icons.get('sliders', 't-teal', 14) +
      ' Consignes 24h — saisissez une barre et glissez pour ajuster</span>' +
      '<span class="batt-histo-meta">' +
      '<span class="batt-histo-soc-key"><i></i>SOC batterie</span>' +
      '<span class="batt-histo-readout mono" data-out="readout"></span></span>' +
      '</div>' +
      '<svg class="batt-histo-svg" role="img" ' +
      'aria-label="Histogramme des consignes de puissance batterie sur 24 heures"></svg>' +
      '</div>'
    );

    // Selecteur de classe obligatoire : le titre contient deja une icone SVG,
    // qu'un simple querySelector('svg') attraperait en premier.
    var svg = root.querySelector('.batt-histo-svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var readout = root.querySelector('[data-out="readout"]');

    var dragHour = null;   // heure en cours d'edition, null hors glissement

    // --- Conversion pointeur -> repere du SVG ------------------------------
    function toViewBox(e) {
      var r = svg.getBoundingClientRect();
      var scale = r.width / W;               // ratio uniforme : le viewBox suit la largeur
      return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
    }

    function hourAt(x) {
      return Math.max(0, Math.min(23, Math.floor((x - M.l) / BAND)));
    }

    function applyAt(e, hour) {
      var pt = toViewBox(e);
      var pMax = store.state().params.batteryPowerKw;
      var h = hour === null || hour === undefined ? hourAt(pt.x) : hour;
      store.setCommand(h, valueAt(pt.y, pMax));
      return h;
    }

    svg.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      var pt = toViewBox(e);
      dragHour = hourAt(pt.x);
      svg.setPointerCapture(e.pointerId);
      store.setHour(dragHour);              // saisir une barre selectionne aussi l'heure
      applyAt(e, dragHour);
    });

    svg.addEventListener('pointermove', function (e) {
      if (dragHour === null) return;
      e.preventDefault();
      applyAt(e, dragHour);                 // l'heure reste celle saisie au depart
    });

    function endDrag(e) {
      if (dragHour === null) return;
      dragHour = null;
      if (e.pointerId !== undefined && svg.hasPointerCapture(e.pointerId)) {
        svg.releasePointerCapture(e.pointerId);
      }
      update(store.state());
    }
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);

    // --- Rendu --------------------------------------------------------------
    function update(state) {
      var steps = state.simulation.steps;
      var pMax = Math.max(1, state.params.batteryPowerKw);
      var sel = state.currentHour;
      var y0 = yOf(0, pMax);
      var s = '';

      // Colonne mise en avant pour l'heure selectionnee
      s += '<rect x="' + (M.l + sel * BAND).toFixed(1) + '" y="' + M.t + '" width="' + BAND.toFixed(1) +
           '" height="' + PH + '" fill="#134e4a" opacity="0.28"/>';

      // Graduations horizontales
      [pMax, pMax / 2, 0, -pMax / 2, -pMax].forEach(function (v) {
        var y = yOf(v, pMax);
        var zero = Math.abs(v) < 1e-9;
        s += '<line x1="' + M.l + '" y1="' + y.toFixed(1) + '" x2="' + (M.l + PW) + '" y2="' + y.toFixed(1) +
             '" stroke="' + (zero ? '#64748b' : '#334155') + '" stroke-width="' + (zero ? 1.5 : 1) + '"' +
             (zero ? '' : ' stroke-dasharray="3 3" opacity="0.5"') + '/>';
        s += '<text x="' + (M.l - 6) + '" y="' + (y + 3).toFixed(1) + '" fill="#64748b" font-size="9.5" ' +
             'text-anchor="end" font-family="monospace">' +
             (v > 0 ? '+' : '') + (Math.round(v * 10) / 10) + '</text>';
      });

      // Barres
      steps.forEach(function (st, i) {
        var v = st.batteryCmdKw;
        var x = M.l + i * BAND + BAND * 0.16;
        var bw = BAND * 0.68;
        var isSel = i === sel;

        // Zone de saisie : toute la colonne reste attrapable, meme a 0 kW
        s += '<rect x="' + (M.l + i * BAND).toFixed(1) + '" y="' + M.t + '" width="' + BAND.toFixed(1) +
             '" height="' + PH + '" fill="transparent"/>';

        var a = st.batteryActualKw;
        var clipped = Math.abs(a - v) > 0.05; // limites physiques : SOC en butée ou puissance bridée

        // Consigne non tenue : contour pointillé ambre de ce qui était demandé,
        // barre pleine de ce qui passe réellement. L'écart se lit d'un coup d'œil.
        if (clipped && Math.abs(v) > 1e-9) {
          s += barRect(x, bw, y0, v, pMax, 'fill="none" stroke="#fbbf24" stroke-width="1.2" stroke-dasharray="3 2" opacity="0.9"');
        }

        if (Math.abs(a) > 1e-9) {
          s += barRect(x, bw, y0, a, pMax, 'fill="' + (a > 0 ? '#14b8a6' : '#06b6d4') + '" opacity="' + (isSel ? 1 : 0.68) + '"');
        } else if (!clipped) {
          // Talon discret : l'heure est en veille mais reste saisissable
          s += '<rect x="' + x.toFixed(1) + '" y="' + (y0 - 1).toFixed(1) + '" width="' + bw.toFixed(1) +
               '" height="2" rx="1" fill="#475569" opacity="' + (isSel ? 0.95 : 0.5) + '"/>';
        }
      });

      // --- Etat de charge, superpose aux barres -----------------------------
      var pr = state.params;
      var socMin = clamp(pr.batterySocMinPercent, 0, 100);
      var socMax = clamp(pr.batterySocMaxPercent, 0, 100);

      // Bornes SOC : elles expliquent les consignes non tenues ci-dessus.
      [socMin, socMax].forEach(function (pct) {
        var y = socY(pct);
        s += '<line x1="' + M.l + '" y1="' + y.toFixed(1) + '" x2="' + (M.l + PW) + '" y2="' + y.toFixed(1) +
             '" stroke="' + SOC_COLOR + '" stroke-width="1" stroke-dasharray="2 4" opacity="0.45"/>';
      });

      // Le moteur rend le SOC de FIN d'heure : chaque point se place donc au
      // bord droit de sa bande, precede du SOC initial a l'origine.
      var pts = [M.l.toFixed(1) + ',' +
                 socY(clamp(pr.batteryInitialSocPercent, socMin, socMax)).toFixed(1)];
      steps.forEach(function (st, i) {
        pts.push((M.l + (i + 1) * BAND).toFixed(1) + ',' + socY(st.batterySocPercent).toFixed(1));
      });
      s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + SOC_COLOR +
           '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';

      // Point sur l'heure selectionnee
      var selStep = steps[sel];
      if (selStep) {
        s += '<circle cx="' + (M.l + (sel + 1) * BAND).toFixed(1) + '" cy="' +
             socY(selStep.batterySocPercent).toFixed(1) + '" r="3" fill="' + SOC_COLOR +
             '" stroke="#020617" stroke-width="1.5"/>';
      }

      // Axe des SOC, a droite
      [0, 50, 100].forEach(function (pct) {
        s += '<text x="' + (M.l + PW + 6) + '" y="' + (socY(pct) + 3).toFixed(1) + '" fill="' + SOC_COLOR +
             '" font-size="9.5" text-anchor="start" font-family="monospace" opacity="0.85">' + pct + '%</text>';
      });

      // Etiquettes horaires, toutes les 3h
      steps.forEach(function (st, i) {
        if (i % 3 !== 0) return;
        s += '<text x="' + (M.l + i * BAND + BAND / 2).toFixed(1) + '" y="' + (H - 7) +
             '" fill="#64748b" font-size="9.5" text-anchor="middle" font-family="monospace">' +
             esc(st.label.slice(0, 2)) + 'h</text>';
      });

      svg.innerHTML = s;

      var cur = steps[sel];
      var v = cur ? cur.batteryCmdKw : 0;
      readout.textContent = (cur ? cur.label : '00:00') + ' · ' +
        (v > 0 ? '+' + v.toFixed(1) + ' kW (charge)'
          : v < 0 ? v.toFixed(1) + ' kW (décharge)'
          : '0.0 kW (veille)') +
        (cur ? ' · SOC ' + cur.batterySocPercent.toFixed(0) + '%' : '');
      readout.className = 'batt-histo-readout mono ' +
        (v > 0 ? 't-teal' : v < 0 ? 't-cyan' : 't-slate');
    }

    return { el: root, update: update };
  }

  global.MGBattHistogram = { create: create };
})(window);
