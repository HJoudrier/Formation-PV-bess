/* ==========================================================================
   Graphiques d'analyse 24h (puissances, SOC batterie, marche SPOT).
   ========================================================================== */
(function (global) {
  'use strict';

  var esc = MGDom.esc;
  var r1 = function (v) { return Math.round(v * 10) / 10; };

  /**
   * Convention de signe du graphique des puissances : ce qui ALIMENTE le bus
   * est positif, ce qui le CONSOMME est négatif. La somme des séries est donc
   * nulle à chaque heure (bilan de puissance du bus alternatif).
   *
   * Les valeurs de ce bilan ne sont volontairement pas arrondies : arrondir
   * chaque série séparément décalerait la somme de quelques dixièmes.
   */
  function toChartData(steps) {
    return steps.map(function (s) {
      // Surplus solaire que la limite d'injection empêche d'évacuer.
      var net = s.loadKw + s.batteryActualKw - s.pvGenKw;
      var curtailed = net < 0 ? Math.max(0, -net - s.gridExportKw) : 0;

      return {
        hour: s.hour,
        label: s.label,

        // Séries du bilan (somme nulle)
        pv: s.pvGenKw,                                   // source
        load: -s.loadKw,                                 // consommation
        grid: s.gridImportKw - s.gridExportKw,           // + soutirage / − injection
        battery: -s.batteryActualKw,                     // + décharge / − charge
        deficit: s.unservedLoadKw,                       // charge non servie
        curtailed: -curtailed,                           // surplus écrêté

        // Séries des autres graphiques (affichage seul)
        socPercent: r1(s.batterySocPercent),
        socKwh: r1(s.batterySocKwh),
        spotPrice: r1(s.spotPriceEurPerMwh),
        costEur: Math.round(s.costEur * 100) / 100
      };
    });
  }

  function create(store) {
    var root = MGDom.el('<div class="panel"></div>');

    root.innerHTML =
      '<div class="panel-head" style="margin-bottom:1rem">' +
      '<div class="panel-head-main">' +
      '<div class="icon-tile emerald">' + Icons.get('layers', '', 18) + '</div>' +
      '<div><h3 class="panel-title">Graphiques d\'Analyse 24h &amp; Profils Temporels</h3>' +
      '<p class="panel-subtitle hide-sm">Cliquez sur un graphique pour positionner le repère temporel</p></div>' +
      '</div></div>' +
      '<div class="charts-body" style="display:flex;flex-direction:column;gap:1rem"></div>';

    var body = root.querySelector('.charts-body');

    // Clic sur une bande horaire d'un graphique -> deplace le repere temporel
    body.addEventListener('click', function (e) {
      var hit = e.target.closest('.hit');
      if (!hit) return;
      store.setHour(parseInt(hit.getAttribute('data-hour'), 10));
    });

    function chartCard(opts) {
      return '<div class="chart-card">' +
      '<div class="chart-head"><div>' +
      '<h4 class="chart-title"><span class="dot-legend" style="background:' + opts.dot + '"></span>' +
      esc(opts.title) + '</h4>' +
      '<p class="chart-desc">' + esc(opts.desc) + '</p></div>' +
      '<div class="chart-meta">' + opts.meta + '</div></div>' +
      opts.svg + (opts.legend || '') + '</div>';
    }

    function update(state) {
      var steps = state.simulation.steps;
      var p = state.params;
      var d = toChartData(steps);
      var h = state.currentHour;
      var currentLabel = steps[h] ? steps[h].label : '00:00';

      var html = '';

      // --- 1. Equilibre des puissances --------------------------------------
      var balanceSeries = [
        { type: 'area', key: 'pv', color: '#f59e0b', fill: 0.22, width: 2, label: 'Solaire PV (+)' },
        { type: 'line', key: 'load', color: '#f97316', width: 2.5, label: 'Charge du site (−)' },
        { type: 'line', key: 'grid', color: '#6366f1', width: 2.5, dots: true, label: 'Réseau (+ soutirage / − injection)' },
        { type: 'line', key: 'battery', color: '#14b8a6', width: 2.5, label: 'Batterie (+ décharge / − charge)' },
        { type: 'bar', key: 'deficit', color: '#e11d48', opacity: 0.9, label: 'Déficit non couvert (+)' },
        { type: 'bar', key: 'curtailed', color: '#a855f7', opacity: 0.8, label: 'Surplus écrêté (−)' }
      ];
      html += chartCard({
        dot: '#fbbf24',
        title: 'Équilibre des Flux de Puissance (kW)',
        desc: 'Convention : ce qui alimente le bus est positif, ce qui le consomme est négatif. ' +
              'À chaque heure, la somme des courbes est nulle.',
        meta: 'Repère temporel actuel : <strong class="t-emerald">' + esc(currentLabel) + '</strong>',
        svg: MGChart.build({
          height: 300,
          data: d,
          currentHour: h,
          axes: { left: { keys: ['pv', 'load', 'grid', 'battery', 'deficit', 'curtailed'], unit: '' } },
          series: balanceSeries,
          refLinesY: [
            { value: p.gridMaxPowerKw, color: '#f43f5e', label: 'Soutirage max (' + p.gridMaxPowerKw + ' kW)' },
            { value: -p.gridMaxInjectionKw, color: '#f43f5e', label: 'Injection max (' + p.gridMaxInjectionKw + ' kW)' }
          ]
        }),
        legend: MGChart.legend(balanceSeries)
      });

      // --- 2. Etat de charge batterie ---------------------------------------
      var socSeries = [
        { type: 'area', key: 'socPercent', color: '#14b8a6', fill: 0.3, width: 2.5, label: 'SOC (%)' }
      ];
      html += chartCard({
        dot: '#2dd4bf',
        title: 'État de Charge Batterie SOC (%) & Capacité Stockée (kWh)',
        desc: 'Évolution temporelle du stock avec respect des bornes [' +
              p.batterySocMinPercent + '% - ' + p.batterySocMaxPercent + '%].',
        meta: 'Stock à ' + esc(currentLabel) + ' : <strong class="t-teal">' +
              (d[h] ? d[h].socPercent : 0) + '% (' + (d[h] ? d[h].socKwh : 0) + ' kWh)</strong>',
        svg: MGChart.build({
          height: 250,
          data: d,
          currentHour: h,
          axes: { left: { keys: ['socPercent'], unit: '%', domain: [0, 100] } },
          series: socSeries,
          refLinesY: [
            { value: p.batterySocMinPercent, color: '#ef4444', label: 'SOC Min (' + p.batterySocMinPercent + '%)' },
            { value: p.batterySocMaxPercent, color: '#ef4444', label: 'SOC Max (' + p.batterySocMaxPercent + '%)' }
          ]
        }),
        legend: MGChart.legend(socSeries)
      });

      // --- 3. Marche SPOT ----------------------------------------------------
      var priceSeries = [
        { type: 'bar', key: 'costEur', color: '#38bdf8', axis: 'right', opacity: 0.6, label: 'Coût net horaire (€/h)' },
        { type: 'line', key: 'spotPrice', color: '#818cf8', width: 2.5, dots: true, label: 'Prix SPOT (€/MWh)' }
      ];
      html += chartCard({
        dot: '#818cf8',
        title: 'Marché Électrique SPOT Day-Ahead (€/MWh) & Facturation Réseau',
        desc: 'Prix horaire de l\'électricité sur le marché de gros et coût net horaire résultant.',
        meta: 'Prix à ' + esc(currentLabel) + ' : <strong class="t-indigo">' +
              (d[h] ? d[h].spotPrice : 0) + ' €/MWh</strong>',
        svg: MGChart.build({
          height: 250,
          data: d,
          currentHour: h,
          axes: {
            left: { keys: ['spotPrice'], unit: '' },
            right: { keys: ['costEur'], unit: '' }
          },
          series: priceSeries
        }),
        legend: MGChart.legend(priceSeries)
      });

      body.innerHTML = html;
    }

    return { el: root, update: update };
  }

  global.MGCharts = { create: create };
})(window);
