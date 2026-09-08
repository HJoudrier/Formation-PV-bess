/* ==========================================================================
   Graphiques d'analyse 24h (puissances, SOC batterie, marche SPOT).
   ========================================================================== */
(function (global) {
  'use strict';

  var esc = MGDom.esc;
  var r1 = function (v) { return Math.round(v * 10) / 10; };

  var TABS = [
    { id: 'all', label: 'Vue Complète', icon: null, tone: '' },
    { id: 'balance', label: 'Puissances', icon: 'zap', tone: 'amber' },
    { id: 'soc', label: 'SOC Batterie', icon: 'battery', tone: 'teal' },
    { id: 'prices', label: 'Marché SPOT', icon: 'dollarSign', tone: 'indigo' }
  ];

  function toChartData(steps) {
    return steps.map(function (s) {
      return {
        hour: s.hour,
        label: s.label,
        load: r1(s.loadKw),
        pv: r1(s.pvGenKw),
        batteryCharge: s.batteryActualKw > 0 ? r1(s.batteryActualKw) : 0,
        batteryDischarge: s.batteryActualKw < 0 ? r1(Math.abs(s.batteryActualKw)) : 0,
        gridImport: r1(s.gridImportKw),
        gridExport: r1(s.gridExportKw),
        socPercent: r1(s.batterySocPercent),
        socKwh: r1(s.batterySocKwh),
        spotPrice: r1(s.spotPriceEurPerMwh),
        costEur: Math.round(s.costEur * 100) / 100,
        deficit: r1(s.unservedLoadKw)
      };
    });
  }

  function create(store) {
    var root = MGDom.el('<div class="panel"></div>');
    var activeTab = 'all';

    root.innerHTML =
      '<div class="panel-head" style="margin-bottom:1rem">' +
      '<div class="panel-head-main">' +
      '<div class="icon-tile emerald">' + Icons.get('layers', '', 18) + '</div>' +
      '<div><h3 class="panel-title">Graphiques d\'Analyse 24h &amp; Profils Temporels</h3>' +
      '<p class="panel-subtitle hide-sm">Cliquez sur un graphique pour positionner le repère temporel</p></div>' +
      '</div><div class="tabs"></div></div>' +
      '<div class="charts-body" style="display:flex;flex-direction:column;gap:1rem"></div>';

    var tabsEl = root.querySelector('.tabs');
    var body = root.querySelector('.charts-body');

    tabsEl.innerHTML = TABS.map(function (t) {
      return '<button class="tab ' + t.tone + '" data-tab="' + t.id + '">' +
        (t.icon ? Icons.get(t.icon, '', 14) : '') + esc(t.label) + '</button>';
    }).join('');

    tabsEl.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-tab]');
      if (!btn) return;
      activeTab = btn.getAttribute('data-tab');
      update(store.state());
    });

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

      Array.prototype.forEach.call(tabsEl.children, function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === activeTab);
      });

      var html = '';

      // --- 1. Equilibre des puissances --------------------------------------
      if (activeTab === 'all' || activeTab === 'balance') {
        var balanceSeries = [
          { type: 'area', key: 'pv', color: '#f59e0b', fill: 0.25, width: 2, label: 'Solaire PV (kW)' },
          { type: 'line', key: 'load', color: '#f97316', width: 2.5, dots: true, label: 'Charge (kW)' },
          { type: 'bar', key: 'gridImport', color: '#6366f1', opacity: 0.7, label: 'Import Réseau (kW)' },
          { type: 'bar', key: 'gridExport', color: '#10b981', opacity: 0.6, label: 'Export Réseau (kW)' },
          { type: 'bar', key: 'deficit', color: '#e11d48', opacity: 0.9, label: 'Déficit Charge (kW)' },
          { type: 'line', key: 'batteryCharge', color: '#14b8a6', width: 2, dash: '3 3', label: 'Charge Batt. (kW)' },
          { type: 'line', key: 'batteryDischarge', color: '#06b6d4', width: 2, label: 'Décharge Batt. (kW)' }
        ];
        html += chartCard({
          dot: '#fbbf24',
          title: 'Équilibre des Flux de Puissance (kW)',
          desc: 'Production PV, demande charge, cycles batterie et import/export réseau.',
          meta: 'Repère temporel actuel : <strong class="t-emerald">' + esc(currentLabel) + '</strong>',
          svg: MGChart.build({
            height: 300,
            data: d,
            currentHour: h,
            axes: { left: { keys: ['pv', 'load', 'gridImport', 'gridExport', 'batteryCharge', 'batteryDischarge', 'deficit'], unit: '' } },
            series: balanceSeries,
            refLinesY: [{ value: p.gridMaxPowerKw, color: '#f43f5e', label: 'Pmax Réseau (' + p.gridMaxPowerKw + ' kW)' }]
          }),
          legend: MGChart.legend(balanceSeries)
        });
      }

      // --- 2. Etat de charge batterie ---------------------------------------
      if (activeTab === 'all' || activeTab === 'soc') {
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
      }

      // --- 3. Marche SPOT ----------------------------------------------------
      if (activeTab === 'all' || activeTab === 'prices') {
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
      }

      body.innerHTML = html;
    }

    return { el: root, update: update };
  }

  global.MGCharts = { create: create };
})(window);
