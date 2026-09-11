/* ==========================================================================
   Dimensionnement technique et economique (CAPEX).
   Le squelette est construit une seule fois : les champs ne sont jamais
   recrees, ce qui preserve la saisie en cours et le glissement des curseurs.
   ========================================================================== */
(function (global) {
  'use strict';

  var eur = MGDom.eur;

  /**
   * Champ curseur + saisie numerique lies au meme parametre.
   * min/max s'appliquent au curseur, nmin/nmax a la saisie libre.
   */
  function sliderField(o) {
    return '<div class="field">' +
      '<div class="field-row"><label class="field-label">' + o.label + '</label>' +
      '<span class="field-value ' + o.tone + '" data-out="' + o.field + '"></span></div>' +
      '<div class="field-inline">' +
      '<input type="range" class="' + o.accent + '" data-field="' + o.field + '" ' +
      'min="' + o.min + '" max="' + o.max + '" step="' + o.step + '" ' +
      'data-cmin="' + o.nmin + '" data-cmax="' + o.nmax + '">' +
      '<input type="number" class="num-narrow" data-field="' + o.field + '" ' +
      'min="' + o.nmin + '" max="' + o.nmax + '" step="' + (o.nstep || 1) + '" ' +
      'data-cmin="' + o.nmin + '" data-cmax="' + o.nmax + '"' +
      (o.fallback !== undefined ? ' data-fallback="' + o.fallback + '"' : '') + '>' +
      '</div>' +
      (o.hint ? '<p class="field-hint">' + o.hint + '</p>' : '') +
      '</div>';
  }

  function numberField(o) {
    return '<div>' +
      '<label class="text-11 t-slate" style="display:block;margin-bottom:0.25rem">' + o.label + '</label>' +
      '<input type="number" data-field="' + o.field + '" min="' + o.min + '" max="' + o.max +
      '" step="' + o.step + '" data-cmin="' + o.min + '" data-cmax="' + o.max + '"' +
      (o.fallback !== undefined ? ' data-fallback="' + o.fallback + '"' : '') + '>' +
      '</div>';
  }

  function create(store) {
    var root = MGDom.el('<div class="panel"></div>');

    root.innerHTML =
      '<div class="panel-head">' +
      '<div class="panel-head-main">' + Icons.get('settings', 't-emerald', 20) +
      '<div><h2 class="panel-title">Dimensionnement Technique &amp; Économique (CAPEX)</h2>' +
      '<p class="panel-subtitle">Ajustez les capacités installées, les limites physiques et les coûts d\'investissement.</p>' +
      '</div></div>' +
      '<div style="display:flex;align-items:center;gap:0.75rem">' +
      '<div style="text-align:right" class="hide-sm">' +
      '<div class="text-xs t-slate">Total Investissement CAPEX</div>' +
      '<div class="mono bold t-emerald" data-out="totalCapex"></div></div>' +
      '<button class="btn" data-action="reset" title="Rétablir les valeurs par défaut">' +
      Icons.get('rotate', '', 14) + ' Réinitialiser</button>' +
      '</div></div>' +

      '<div class="grid grid-sizing">' +

      // ---- Photovoltaique ----
      '<div class="subpanel">' +
      '<div class="field-row" style="border-bottom:1px solid rgba(30,41,59,.8);padding-bottom:0.5rem;margin-bottom:1rem">' +
      '<span class="bold t-amber" style="display:flex;align-items:center;gap:0.5rem">' +
      Icons.get('sun', '', 15) + ' Centrale Photovoltaïque (PV)</span>' +
      '<span class="mono text-xs" style="color:var(--amber-300);background:rgba(69,26,3,.8);padding:0.125rem 0.5rem;' +
      'border-radius:4px;border:1px solid rgba(146,64,14,.6)" data-out="pvCapex"></span></div>' +
      '<div style="display:flex;flex-direction:column;gap:1rem">' +
      sliderField({
        label: 'Puissance PV Installée :', field: 'pvInstalledKwc', tone: 't-amber', accent: 'accent-amber',
        min: 0, max: 150, step: 5, nmin: 0, nmax: 500,
        hint: 'La prévision de production 24h est recalculée en direct selon la courbe normalisée.'
      }) +
      '<div class="field field-sep">' +
      '<div class="field-row"><label class="field-label">Coût d\'installation PV :</label>' +
      '<span class="mono t-slate2" data-out="pvCapexPerKwc"></span></div>' +
      '<input type="number" data-field="pvCapexPerKwc" min="200" max="3000" step="50" data-cmin="0" data-cmax="100000">' +
      '<span class="field-hint">' + Icons.get('info', '', 12) + ' Valeur par défaut : 1 200 €/kWc (paramétrable).</span>' +
      '</div></div></div>' +

      // ---- Batterie ----
      '<div class="subpanel">' +
      '<div class="field-row" style="border-bottom:1px solid rgba(30,41,59,.8);padding-bottom:0.5rem;margin-bottom:1rem">' +
      '<span class="bold t-teal" style="display:flex;align-items:center;gap:0.5rem">' +
      Icons.get('battery', '', 15) + ' Système Batterie (BESS)</span>' +
      '<span class="mono text-xs" style="color:var(--teal-300);background:rgba(4,47,46,.8);padding:0.125rem 0.5rem;' +
      'border-radius:4px;border:1px solid rgba(17,94,89,.6)" data-out="battCapex"></span></div>' +
      '<div style="display:flex;flex-direction:column;gap:1rem">' +
      sliderField({
        label: 'Capacité Stockage :', field: 'batteryCapacityKwh', tone: 't-teal', accent: 'accent-teal',
        min: 0, max: 200, step: 5, nmin: 0, nmax: 500, nstep: 5
      }) +
      sliderField({
        label: 'Puissance Max Onduleur :', field: 'batteryPowerKw', tone: 't-teal', accent: 'accent-teal',
        min: 0, max: 100, step: 2, nmin: 0, nmax: 250
      }) +
      '<div class="grid grid-2 field-sep">' +
      numberField({ label: 'Coût Capacité (€/kWh) :', field: 'batteryCapexPerKwh', min: 0, max: 1000, step: 25 }) +
      numberField({ label: 'Coût Puissance (€/kW) :', field: 'batteryCapexPerKw', min: 0, max: 600, step: 10 }) +
      '</div>' +
      '<div class="grid grid-2">' +
      numberField({ label: 'Rendement global (%) :', field: 'batteryEfficiencyPercent', min: 50, max: 99, step: 1, fallback: 90 }) +
      numberField({ label: 'SOC Initial t=0 (%) :', field: 'batteryInitialSocPercent', min: 0, max: 100, step: 5, fallback: 40 }) +
      '</div></div></div>' +

      // ---- Raccordement reseau ----
      '<div class="subpanel">' +
      '<div class="field-row" style="border-bottom:1px solid rgba(30,41,59,.8);padding-bottom:0.5rem;margin-bottom:1rem">' +
      '<span class="bold t-indigo" style="display:flex;align-items:center;gap:0.5rem">' +
      Icons.get('activity', '', 15) + ' Raccordement Réseau</span>' +
      '<span class="mono text-xs" style="color:var(--indigo-300);background:rgba(30,27,75,.8);padding:0.125rem 0.5rem;' +
      'border-radius:4px;border:1px solid rgba(55,48,163,.6)" data-out="gridMax"></span></div>' +
      '<div style="display:flex;flex-direction:column;gap:1rem">' +
      sliderField({
        label: 'Puissance Max de Raccordement :', field: 'gridMaxPowerKw', tone: 't-indigo', accent: 'accent-indigo',
        min: 5, max: 120, step: 2, nmin: 1, nmax: 250, fallback: 10,
        hint: 'Si la somme (PV + batterie + raccordement) est inférieure à la charge, une alerte s\'affiche sur la charge.'
      }) +
      '<div class="field field-sep">' +
      '<div class="field-row"><label class="field-label">Limite d\'injection Réseau :</label>' +
      '<span class="mono t-slate2" data-out="gridMaxInjectionKw"></span></div>' +
      '<input type="number" data-field="gridMaxInjectionKw" min="0" max="150" step="5" data-cmin="0" data-cmax="100000">' +
      '</div>' +
      '<div class="field">' +
      '<label class="text-xs t-slate2">Rémunération du surplus injecté :</label>' +
      '<div class="grid grid-2">' +
      '<button class="btn btn-sm" data-feedin="spot">Vente au SPOT</button>' +
      '<button class="btn btn-sm" data-feedin="fixed">Tarif fixe (70 €/MWh)</button>' +
      '</div></div>' +
      '</div></div>' +

      '</div>';

    // --- Evenements (delegation : les champs ne sont jamais recrees) --------
    root.addEventListener('input', function (e) {
      var input = e.target.closest('[data-field]');
      if (!input) return;
      var field = input.getAttribute('data-field');
      var raw = parseFloat(input.value);
      var fallback = input.getAttribute('data-fallback');

      if (isNaN(raw)) raw = fallback !== null ? parseFloat(fallback) : 0;

      var cmin = parseFloat(input.getAttribute('data-cmin'));
      var cmax = parseFloat(input.getAttribute('data-cmax'));
      if (!isNaN(cmin)) raw = Math.max(cmin, raw);
      if (!isNaN(cmax)) raw = Math.min(cmax, raw);

      store.setParam(field, raw);
    });

    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-action="reset"]')) { store.resetParams(); return; }
      var fi = e.target.closest('[data-feedin]');
      if (fi) store.setParam('feedInMode', fi.getAttribute('data-feedin'));
    });

    // Index des champs pour un rafraichissement rapide
    var fields = {};
    Array.prototype.forEach.call(root.querySelectorAll('[data-field]'), function (input) {
      var k = input.getAttribute('data-field');
      (fields[k] = fields[k] || []).push(input);
    });
    var outs = {};
    Array.prototype.forEach.call(root.querySelectorAll('[data-out]'), function (n) {
      outs[n.getAttribute('data-out')] = n;
    });
    var feedInBtns = root.querySelectorAll('[data-feedin]');

    function update(state) {
      var p = state.params;
      var sm = state.simulation.summary;

      Object.keys(fields).forEach(function (k) {
        fields[k].forEach(function (input) { MGDom.setVal(input, p[k]); });
      });

      MGDom.setText(outs.pvInstalledKwc, p.pvInstalledKwc + ' kWc');
      MGDom.setText(outs.batteryCapacityKwh, p.batteryCapacityKwh + ' kWh');
      MGDom.setText(outs.batteryPowerKw, p.batteryPowerKw + ' kW');
      MGDom.setText(outs.gridMaxPowerKw, p.gridMaxPowerKw + ' kW');
      MGDom.setText(outs.pvCapexPerKwc, p.pvCapexPerKwc + ' € / kWc');
      MGDom.setText(outs.gridMaxInjectionKw, p.gridMaxInjectionKw + ' kW');

      MGDom.setText(outs.totalCapex, eur(sm.totalCapexEur) + ' €');
      MGDom.setText(outs.pvCapex, 'CAPEX: ' + eur(sm.pvCapexEur) + ' €');
      MGDom.setText(outs.battCapex, 'CAPEX: ' + eur(sm.batteryTotalCapexEur) + ' €');
      MGDom.setText(outs.gridMax, 'Max ' + p.gridMaxPowerKw + ' kW');

      Array.prototype.forEach.call(feedInBtns, function (btn) {
        var on = btn.getAttribute('data-feedin') === p.feedInMode;
        btn.classList.toggle('btn-indigo', on);
      });
    }

    return { el: root, update: update };
  }

  global.MGSizing = { create: create };
})(window);
