/* ==========================================================================
   Moteur de graphiques SVG minimal (remplace Recharts).
   Repere categoriel de 24 heures, series aire / ligne / barres,
   lignes de reference, axes et survol.
   ========================================================================== */
(function (global) {
  'use strict';

  var esc = MGDom.esc;

  var W = 800;                                  // largeur du repere viewBox
  var M = { l: 46, r: 46, t: 20, b: 26 };       // marges

  function plotW() { return W - M.l - M.r; }
  function bandW(w) { return w / 24; }

  /** Centre de la bande horaire i. */
  function xAt(i, w) { return M.l + (i + 0.5) * bandW(w); }

  /** Choisit des bornes lisibles englobant [min, max]. */
  function niceBounds(min, max) {
    if (max - min < 1e-9) { max = min + 1; }
    var span = max - min;
    var step = Math.pow(10, Math.floor(Math.log10(span / 4)));
    var err = span / 4 / step;
    if (err >= 5) step *= 10; else if (err >= 2.5) step *= 5;
    else if (err >= 1.2) step *= 2;
    return {
      min: Math.floor(min / step) * step,
      max: Math.ceil(max / step) * step,
      step: step
    };
  }

  function ticksOf(b) {
    var out = [];
    // Tolerance pour absorber les erreurs d'arrondi flottant.
    for (var v = b.min; v <= b.max + b.step * 1e-6; v += b.step) out.push(v);
    return out;
  }

  function fmtTick(v) {
    if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return Math.abs(v % 1) < 1e-9 ? String(Math.round(v)) : v.toFixed(1);
  }

  /**
   * Construit un graphique complet.
   * cfg = {
   *   height, data (24 objets), currentHour,
   *   axes: { left: {keys, unit}, right?: {keys, unit, domain?} },
   *   series: [{type:'area'|'line'|'bar', key, color, axis, fill, dash, width, opacity, label}],
   *   refLinesY: [{value, axis, color, label}],
   *   legend: bool
   * }
   */
  function build(cfg) {
    var H = cfg.height;
    var ph = H - M.t - M.b;
    var w = plotW();
    var data = cfg.data;

    // --- Domaines verticaux -------------------------------------------------
    function domainFor(axis) {
      var spec = cfg.axes[axis];
      if (spec.domain) {
        return { min: spec.domain[0], max: spec.domain[1], step: (spec.domain[1] - spec.domain[0]) / 4 };
      }
      var vals = [];
      spec.keys.forEach(function (k) {
        data.forEach(function (d) { if (typeof d[k] === 'number' && isFinite(d[k])) vals.push(d[k]); });
      });
      (cfg.refLinesY || []).forEach(function (r) { if (r.axis === axis) vals.push(r.value); });
      if (!vals.length) vals = [0, 1];
      var mn = Math.min.apply(null, vals);
      var mx = Math.max.apply(null, vals);
      return niceBounds(Math.min(0, mn), Math.max(mx, mn + 1));
    }

    var domains = { left: domainFor('left') };
    if (cfg.axes.right) domains.right = domainFor('right');

    function yOf(v, axis) {
      var d = domains[axis || 'left'];
      var t = (v - d.min) / (d.max - d.min);
      return M.t + ph * (1 - Math.max(0, Math.min(1, t)));
    }

    var zeroLeft = yOf(0, 'left');
    var s = '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" ' +
            'data-chart="1" role="img">';

    // --- Grille et axe des ordonnees ---------------------------------------
    ticksOf(domains.left).forEach(function (v) {
      var y = yOf(v, 'left');
      s += '<line x1="' + M.l + '" y1="' + y.toFixed(1) + '" x2="' + (M.l + w) + '" y2="' + y.toFixed(1) +
           '" stroke="#334155" stroke-width="1" stroke-dasharray="3 3" opacity="0.4"/>';
      s += '<text x="' + (M.l - 6) + '" y="' + (y + 3).toFixed(1) + '" fill="#64748b" font-size="10" ' +
           'text-anchor="end" font-family="monospace">' + esc(fmtTick(v) + (cfg.axes.left.unit || '')) + '</text>';
    });

    if (cfg.axes.right) {
      ticksOf(domains.right).forEach(function (v) {
        var y = yOf(v, 'right');
        s += '<text x="' + (M.l + w + 6) + '" y="' + (y + 3).toFixed(1) + '" fill="#38bdf8" font-size="10" ' +
             'text-anchor="start" font-family="monospace">' + esc(fmtTick(v) + (cfg.axes.right.unit || '')) + '</text>';
      });
    }

    // --- Axe des abscisses (une etiquette sur trois) ------------------------
    data.forEach(function (d, i) {
      if (i % 3 !== 0) return;
      s += '<text x="' + xAt(i, w).toFixed(1) + '" y="' + (H - 8) + '" fill="#64748b" font-size="10" ' +
           'text-anchor="middle" font-family="monospace">' + esc(d.label) + '</text>';
    });

    // --- Series -------------------------------------------------------------
    var bars = (cfg.series || []).filter(function (x) { return x.type === 'bar'; });
    var barW = Math.max(2, bandW(w) * (bars.length > 1 ? 0.30 : 0.5));

    (cfg.series || []).forEach(function (ser) {
      var axis = ser.axis || 'left';

      if (ser.type === 'bar') {
        var slot = bars.indexOf(ser);
        var offset = (slot - (bars.length - 1) / 2) * barW;
        data.forEach(function (d, i) {
          var v = d[ser.key] || 0;
          if (Math.abs(v) < 1e-9) return;
          var y0 = yOf(0, axis);
          var y1 = yOf(v, axis);
          var top = Math.min(y0, y1);
          var h = Math.max(1, Math.abs(y1 - y0));
          s += '<rect x="' + (xAt(i, w) + offset - barW / 2).toFixed(1) + '" y="' + top.toFixed(1) +
               '" width="' + barW.toFixed(1) + '" height="' + h.toFixed(1) + '" fill="' + ser.color +
               '" opacity="' + (ser.opacity || 0.7) + '"/>';
        });
        return;
      }

      var pts = data.map(function (d, i) {
        return xAt(i, w).toFixed(1) + ',' + yOf(d[ser.key] || 0, axis).toFixed(1);
      });

      if (ser.type === 'area') {
        var base = yOf(Math.max(domains[axis].min, 0), axis).toFixed(1);
        s += '<polygon points="' + xAt(0, w).toFixed(1) + ',' + base + ' ' + pts.join(' ') + ' ' +
             xAt(23, w).toFixed(1) + ',' + base + '" fill="' + ser.color + '" opacity="' + (ser.fill || 0.25) + '"/>';
      }

      s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + ser.color +
           '" stroke-width="' + (ser.width || 2) + '"' +
           (ser.dash ? ' stroke-dasharray="' + ser.dash + '"' : '') +
           ' stroke-linejoin="round" stroke-linecap="round"/>';

      if (ser.dots) {
        data.forEach(function (d, i) {
          s += '<circle cx="' + xAt(i, w).toFixed(1) + '" cy="' + yOf(d[ser.key] || 0, axis).toFixed(1) +
               '" r="2.5" fill="' + ser.color + '"/>';
        });
      }
    });

    // --- Lignes de reference -------------------------------------------------
    (cfg.refLinesY || []).forEach(function (r) {
      var y = yOf(r.value, r.axis || 'left');
      s += '<line x1="' + M.l + '" y1="' + y.toFixed(1) + '" x2="' + (M.l + w) + '" y2="' + y.toFixed(1) +
           '" stroke="' + r.color + '" stroke-width="1.5" stroke-dasharray="4 4"/>';
      if (r.label) {
        s += '<text x="' + (M.l + 4) + '" y="' + (y - 4).toFixed(1) + '" fill="' + r.color +
             '" font-size="10" font-family="sans-serif">' + esc(r.label) + '</text>';
      }
    });

    // Ligne de zero si le domaine passe par le negatif
    if (domains.left.min < 0) {
      s += '<line x1="' + M.l + '" y1="' + zeroLeft.toFixed(1) + '" x2="' + (M.l + w) + '" y2="' +
           zeroLeft.toFixed(1) + '" stroke="#475569" stroke-width="1"/>';
    }

    // --- Repere temporel courant --------------------------------------------
    var cx = xAt(cfg.currentHour, w);
    s += '<line x1="' + cx.toFixed(1) + '" y1="' + M.t + '" x2="' + cx.toFixed(1) + '" y2="' + (M.t + ph) +
         '" stroke="#34d399" stroke-width="2" stroke-dasharray="4 4"/>';
    s += '<text x="' + cx.toFixed(1) + '" y="' + (M.t - 6) + '" fill="#34d399" font-size="11" ' +
         'text-anchor="middle" font-family="monospace">' + esc(data[cfg.currentHour].label) + '</text>';

    // --- Bandes de survol / clic ---------------------------------------------
    data.forEach(function (d, i) {
      s += '<rect class="hit" data-hour="' + i + '" x="' + (M.l + i * bandW(w)).toFixed(1) + '" y="' + M.t +
           '" width="' + bandW(w).toFixed(1) + '" height="' + ph + '" fill="transparent"/>';
    });

    s += '</svg>';
    return s;
  }

  function legend(series) {
    return '<div class="chart-legend">' + series.filter(function (s) { return s.label; }).map(function (s) {
      return '<span><i class="legend-swatch" style="background:' + s.color + '"></i>' + esc(s.label) + '</span>';
    }).join('') + '</div>';
  }

  global.MGChart = { build: build, legend: legend };
})(window);
