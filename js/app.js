/* ==========================================================================
   Point d'entree : magasin d'etat et assemblage des composants.
   ========================================================================== */
(function (global) {
  'use strict';

  var CURVE_FIELDS = {
    load: 'loadKw',
    pv: 'pvNormKwPerKwc',
    spot: 'spotPriceEurPerMwh'
  };

  function createStore() {
    var state = {
      params: Object.assign({}, MGData.DEFAULT_MICROGRID_PARAMETERS),
      hourlyData: MGData.createInitialHourlyData(),
      currentHour: 12, // midi : soleil et batterie actifs
      isModalOpen: false,
      simulation: null
    };

    var listeners = [];

    function recompute() {
      state.simulation = MGEngine.runMicrogridSimulation(state.hourlyData, state.params);
    }

    function emit() {
      listeners.forEach(function (fn) { fn(state); });
    }

    function commit() { recompute(); emit(); }

    recompute();

    return {
      state: function () { return state; },
      subscribe: function (fn) { listeners.push(fn); },

      setHour: function (h) {
        var next = Math.max(0, Math.min(23, h));
        if (next === state.currentHour) return;
        state.currentHour = next;
        emit();
      },

      setParam: function (field, value) {
        if (state.params[field] === value) return;
        state.params = Object.assign({}, state.params);
        state.params[field] = value;
        commit();
      },

      resetParams: function () {
        state.params = Object.assign({}, MGData.DEFAULT_MICROGRID_PARAMETERS);
        commit();
      },

      setCommand: function (hour, value) {
        if (state.hourlyData[hour] && state.hourlyData[hour].batteryDispatchCmdKw === value) return;
        state.hourlyData = state.hourlyData.map(function (pt) {
          return pt.hour === hour ? Object.assign({}, pt, { batteryDispatchCmdKw: value }) : pt;
        });
        commit();
      },

      applyStrategy: function (strategy) {
        state.hourlyData = MGStrategies.applyDispatchStrategy(state.hourlyData, state.params, strategy);
        commit();
      },

      /** Remplace une des trois courbes 24h (charge, PV, prix SPOT). */
      setCurve: function (kind, values) {
        var field = CURVE_FIELDS[kind];
        if (!field) return;
        state.hourlyData = state.hourlyData.map(function (pt, i) {
          var v = values[i];
          if (typeof v !== 'number' || !isFinite(v)) v = 0;
          if (kind !== 'spot') v = Math.max(0, v); // charge et PV restent positifs
          var next = Object.assign({}, pt);
          next[field] = v;
          return next;
        });
        commit();
      },

      restoreProject: function (json) {
        if (json && json.params) state.params = Object.assign({}, MGData.DEFAULT_MICROGRID_PARAMETERS, json.params);
        if (json && Array.isArray(json.hourlyData) && json.hourlyData.length) state.hourlyData = json.hourlyData;
        commit();
      },

      openModal: function () { state.isModalOpen = true; emit(); },
      closeModal: function () { state.isModalOpen = false; emit(); }
    };
  }

  function mount() {
    var store = createStore();

    var scrubber = MGScrubber.create(store);
    var synoptic = MGSynoptic.create(store);
    var charts = MGCharts.create(store);
    var summary = MGSummary.create(store);
    var sizing = MGSizing.create(store);
    var dispatch = MGDispatch.create(store);
    var modal = MGModal.create(store);

    // --- En-tete -----------------------------------------------------------
    var header = MGDom.el(
      '<header class="header">' +
      '<div class="container header-bar">' +
      '<div class="brand">' +
      '<div class="brand-logo">' + Icons.get('cpu', '', 20) + '</div>' +
      '<div><div class="brand-title-row"><h1>Microgrid Planner</h1>' +
      '<span class="badge-pill">24h Horizon</span></div>' +
      '<p class="brand-subtitle hide-sm">Dimensionnement &amp; Pilotage de Micro-Réseau Électrique</p></div>' +
      '</div>' +
      '<div class="header-deficit"></div>' +
      '<div class="header-actions">' +
      '<button class="btn" data-action="open-files" title="Gérer les fichiers de courbes (Charge, PV, SPOT)">' +
      Icons.get('fileSpreadsheet', 't-emerald', 14) + '<span class="hide-sm">Fichiers &amp; Courbes</span></button>' +
      '<button class="btn btn-primary" data-action="export" title="Télécharger les résultats 24h au format CSV">' +
      Icons.get('download', '', 14) + '<span class="hide-sm">Exporter CSV</span></button>' +
      '</div></div>' +
      '<div class="header-scrubber"><div class="container"></div></div>' +
      '</header>'
    );

    header.querySelector('.header-scrubber .container').appendChild(scrubber.el);
    var headerDeficit = header.querySelector('.header-deficit');

    header.addEventListener('click', function (e) {
      if (e.target.closest('[data-action="open-files"]')) { store.openModal(); return; }
      if (e.target.closest('[data-action="export"]')) {
        var st = store.state();
        MGFiles.triggerLocalDownload('planification_microreseau_24h.csv',
          MGFiles.generateSimulationResultsCsv(st.simulation.steps, st.simulation.summary, st.params));
      }
    });

    // --- Corps -------------------------------------------------------------
    var main = MGDom.el('<main class="container main"></main>');
    [synoptic, charts, summary, sizing, dispatch].forEach(function (c) {
      main.appendChild(c.el);
    });

    var shell = MGDom.el('<div class="app-shell"></div>');
    shell.appendChild(header);
    shell.appendChild(main);
    shell.appendChild(modal.el);

    var root = document.getElementById('root');
    root.innerHTML = '';
    root.appendChild(shell);

    // --- Boucle de mise a jour ---------------------------------------------
    var components = [scrubber, synoptic, charts, summary, sizing, dispatch, modal];

    function render(state) {
      var deficitHours = state.simulation.summary.hoursWithDeficit;
      headerDeficit.innerHTML = deficitHours.length
        ? '<div class="status-chip danger hide-sm">' + Icons.get('alertTriangle', 't-rose', 15) +
          '<span>' + deficitHours.length + 'h de déficit de puissance sur le réseau !</span></div>'
        : '';
      components.forEach(function (c) { c.update(state); });
    }

    store.subscribe(render);
    render(store.state());

    // Echap ferme la modale
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && store.state().isModalOpen) store.closeModal();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})(window);
