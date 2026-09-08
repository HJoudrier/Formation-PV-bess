/* ==========================================================================
   Pilotage et planification 24h de la batterie.
   Les 24 lignes du tableau sont creees une fois puis mises a jour en place,
   afin de ne jamais interrompre une saisie ou un glissement de curseur.
   ========================================================================== */
(function (global) {
  'use strict';

  var esc = MGDom.esc;

  var LIMIT_TAGS = {
    full: 'Plafond SOC Max',
    empty: 'Seuil SOC Min',
    max_charge_power: 'Bride P_charge',
    max_discharge_power: 'Bride P_décharge'
  };

  var STRATEGIES = [
    { id: 'self_consumption', cls: 'emerald', label: '☀️ Autoconsommation' },
    { id: 'spot_arbitrage', cls: 'indigo', label: '📉 Arbitrage SPOT' },
    { id: 'peak_shaving', cls: 'sky', label: '⚡ Écrêtage Réseau' },
    { id: 'zero_injection', cls: 'amber', label: '🚫 Zéro Injection' },
    { id: 'reset', cls: '', label: 'Mise en veille (0 kW)' }
  ];

  function cmdText(v) {
    if (v > 0) return '+' + v.toFixed(1) + ' kW (Charge)';
    if (v < 0) return v.toFixed(1) + ' kW (Décharge)';
    return '0.0 kW (Veille)';
  }

  function create(store) {
    var root = MGDom.el('<div class="panel"></div>');
    var isExpanded = true;

    root.innerHTML =
      '<div class="panel-head" style="margin-bottom:1rem">' +
      '<div class="panel-head-main">' +
      '<div class="icon-tile teal">' + Icons.get('batteryCharging', '', 18) + '</div>' +
      '<div><h2 class="panel-title">Pilotage &amp; Planification de la Batterie</h2>' +
      '<p class="panel-subtitle">Consignes 24h en kW (&gt;0 charge, &lt;0 décharge) respectant les limites physiques et de puissance.</p>' +
      '</div></div>' +
      '<button class="btn" data-action="toggle-table"></button></div>' +

      '<div class="strategy-bar">' +
      '<div class="strategy-bar-title">' + Icons.get('sparkles', 't-emerald', 15) +
      '<span>Stratégies automatiques de pilotage assisté :</span></div>' +
      '<div class="strategy-buttons">' +
      STRATEGIES.map(function (s) {
        return '<button class="strat ' + s.cls + '" data-strategy="' + s.id + '">' + s.label + '</button>';
      }).join('') + '</div></div>' +

      '<div class="quick-card">' +
      '<div class="quick-head">' +
      '<div style="display:flex;align-items:center;gap:0.5rem">' +
      '<button class="icon-btn" data-action="prev-hour" title="Heure précédente">' + Icons.get('chevronLeft', '', 15) + '</button>' +
      '<span class="quick-hour" data-out="hour"></span>' +
      '<button class="icon-btn" data-action="next-hour" title="Heure suivante">' + Icons.get('chevronRight', '', 15) + '</button>' +
      '</div>' +
      '<div class="mono text-xs" style="display:flex;gap:0.5rem;align-items:center">' +
      '<span class="t-slate">SOC :</span><span class="t-teal bold" data-out="soc"></span>' +
      '<span class="t-muted text-11" data-out="socKwh"></span></div></div>' +

      '<div class="quick-metrics">' +
      '<div class="quick-metric"><div class="k">Consommation</div><div class="v t-orange" data-out="qLoad"></div></div>' +
      '<div class="quick-metric"><div class="k">Solaire PV</div><div class="v t-amber" data-out="qPv"></div></div>' +
      '<div class="quick-metric"><div class="k">Prix SPOT</div><div class="v t-indigo" data-out="qSpot"></div></div>' +
      '</div>' +

      '<div class="field">' +
      '<div class="field-row"><span class="field-label">Consigne de puissance batterie :</span>' +
      '<span class="mono bold" data-out="cmd"></span></div>' +
      '<div class="field-inline">' +
      '<span class="mono text-xs t-cyan" style="width:3rem;text-align:right" data-out="minP"></span>' +
      '<input type="range" class="accent-teal" data-cmd="quick" step="1">' +
      '<span class="mono text-xs t-teal" style="width:3rem" data-out="maxP"></span>' +
      '<input type="number" class="num-tiny" data-cmd="quick" step="1">' +
      '</div>' +
      '<div class="quick-steps">' +
      '<div style="display:flex;gap:0.25rem">' +
      '<button class="step-btn cyan" data-step="min" data-out="btnMin"></button>' +
      '<button class="step-btn" data-step="-5">-5 kW</button></div>' +
      '<button class="step-btn" data-step="0">Veille (0 kW)</button>' +
      '<div style="display:flex;gap:0.25rem">' +
      '<button class="step-btn" data-step="+5">+5 kW</button>' +
      '<button class="step-btn teal" data-step="max" data-out="btnMax"></button></div>' +
      '</div></div></div>' +

      '<div class="table-wrap"><table class="dispatch"><thead><tr>' +
      '<th>Heure</th><th>Charge (kW)</th><th>PV (kW)</th><th>Prix SPOT</th>' +
      '<th style="min-width:200px">Consigne Pilotage (-Décharge / +Charge)</th>' +
      '<th>Puissance Réelle</th><th>SOC Fin Heure</th><th>Statut Physique</th>' +
      '</tr></thead><tbody></tbody></table></div>';

    var tbody = root.querySelector('tbody');
    var tableWrap = root.querySelector('.table-wrap');
    var toggleBtn = root.querySelector('[data-action="toggle-table"]');

    // Construction unique des 24 lignes
    var rows = [];
    for (var i = 0; i < 24; i++) {
      var tr = MGDom.el(
        '<tr data-hour="' + i + '">' +
        '<td><span class="rowlabel"></span></td>' +
        '<td class="t-orange" data-c="load"></td>' +
        '<td class="t-amber" data-c="pv"></td>' +
        '<td class="t-indigo" data-c="spot"></td>' +
        '<td><div class="cmd-cell">' +
        '<span class="bound t-cyan" style="text-align:right" data-c="min"></span>' +
        '<input type="range" class="accent-teal slim" data-cmd="row" step="1">' +
        '<span class="bound t-teal" data-c="max"></span>' +
        '<input type="number" class="num-tiny" data-cmd="row" step="1">' +
        '</div></td>' +
        '<td class="bold" data-c="actual"></td>' +
        '<td data-c="soc"></td>' +
        '<td data-c="status"></td>' +
        '</tr>'
      );
      tbody.appendChild(tr);
      rows.push({
        tr: tr,
        label: tr.querySelector('.rowlabel'),
        load: tr.querySelector('[data-c="load"]'),
        pv: tr.querySelector('[data-c="pv"]'),
        spot: tr.querySelector('[data-c="spot"]'),
        min: tr.querySelector('[data-c="min"]'),
        max: tr.querySelector('[data-c="max"]'),
        actual: tr.querySelector('[data-c="actual"]'),
        soc: tr.querySelector('[data-c="soc"]'),
        status: tr.querySelector('[data-c="status"]'),
        inputs: tr.querySelectorAll('[data-cmd="row"]')
      });
    }

    var quickInputs = root.querySelectorAll('[data-cmd="quick"]');
    var outs = {};
    Array.prototype.forEach.call(root.querySelectorAll('[data-out]'), function (n) {
      outs[n.getAttribute('data-out')] = n;
    });

    // --- Evenements ---------------------------------------------------------
    root.addEventListener('input', function (e) {
      var input = e.target.closest('[data-cmd]');
      if (!input) return;
      var pMax = store.state().params.batteryPowerKw;
      var val = parseFloat(input.value);
      if (isNaN(val)) val = 0;
      val = Math.max(-pMax, Math.min(pMax, val));
      var kind = input.getAttribute('data-cmd');
      var hour = kind === 'quick'
        ? store.state().currentHour
        : parseInt(input.closest('tr').getAttribute('data-hour'), 10);
      store.setCommand(hour, val);
    });

    root.addEventListener('click', function (e) {
      var st = store.state();

      var strat = e.target.closest('[data-strategy]');
      if (strat) { store.applyStrategy(strat.getAttribute('data-strategy')); return; }

      if (e.target.closest('[data-action="toggle-table"]')) {
        isExpanded = !isExpanded;
        update(store.state());
        return;
      }
      if (e.target.closest('[data-action="prev-hour"]')) {
        store.setHour(st.currentHour === 0 ? 23 : st.currentHour - 1); return;
      }
      if (e.target.closest('[data-action="next-hour"]')) {
        store.setHour(st.currentHour === 23 ? 0 : st.currentHour + 1); return;
      }

      var step = e.target.closest('[data-step]');
      if (step) {
        var pMax = st.params.batteryPowerKw;
        var cur = st.hourlyData[st.currentHour].batteryDispatchCmdKw;
        var spec = step.getAttribute('data-step');
        var next = spec === 'min' ? -pMax
          : spec === 'max' ? pMax
          : spec === '0' ? 0
          : Math.max(-pMax, Math.min(pMax, cur + parseFloat(spec)));
        store.setCommand(st.currentHour, next);
        return;
      }

      // Clic sur une ligne (hors champs) -> selectionne l'heure
      var tr = e.target.closest('tr[data-hour]');
      if (tr && !e.target.closest('.cmd-cell')) {
        store.setHour(parseInt(tr.getAttribute('data-hour'), 10));
      }
    });

    function update(state) {
      var steps = state.simulation.steps;
      var p = state.params;
      var pMax = p.batteryPowerKw;
      var h = state.currentHour;
      var active = steps[h] || steps[0];

      toggleBtn.innerHTML = isExpanded
        ? 'Masquer tableau 24h ' + Icons.get('chevronUp', '', 15)
        : 'Afficher tableau 24h ' + Icons.get('chevronDown', '', 15);
      tableWrap.classList.toggle('hidden', !isExpanded);

      // Carte de l'heure active
      MGDom.setText(outs.hour, 'Heure ' + active.label);
      MGDom.setText(outs.soc, active.batterySocPercent.toFixed(0) + '%');
      MGDom.setText(outs.socKwh, '(' + active.batterySocKwh.toFixed(1) + ' kWh)');
      MGDom.setText(outs.qLoad, active.loadKw.toFixed(1) + ' kW');
      MGDom.setText(outs.qPv, active.pvGenKw.toFixed(1) + ' kW');
      MGDom.setText(outs.qSpot, active.spotPriceEurPerMwh.toFixed(1) + ' €');
      MGDom.setText(outs.minP, '-' + pMax);
      MGDom.setText(outs.maxP, '+' + pMax);
      MGDom.setText(outs.btnMin, 'Max Déch (-' + pMax + ')');
      MGDom.setText(outs.btnMax, 'Max Chg (+' + pMax + ')');

      MGDom.setText(outs.cmd, cmdText(active.batteryCmdKw));
      outs.cmd.className = 'mono bold ' +
        (active.batteryCmdKw > 0 ? 't-teal' : active.batteryCmdKw < 0 ? 't-cyan' : 't-slate');

      Array.prototype.forEach.call(quickInputs, function (input) {
        input.min = -pMax;
        input.max = pMax;
        MGDom.setVal(input, active.batteryCmdKw);
      });

      if (!isExpanded) return;

      // Tableau 24h
      for (var i = 0; i < 24; i++) {
        var s = steps[i];
        var r = rows[i];
        if (!s) continue;

        r.tr.classList.toggle('selected', i === h);
        MGDom.setText(r.label, (i === h ? '● ' : '') + s.label);
        MGDom.setText(r.load, s.loadKw.toFixed(1));
        MGDom.setText(r.pv, s.pvGenKw.toFixed(1));
        MGDom.setText(r.spot, s.spotPriceEurPerMwh.toFixed(1) + ' €');
        MGDom.setText(r.min, '-' + pMax);
        MGDom.setText(r.max, '+' + pMax);

        Array.prototype.forEach.call(r.inputs, function (input) {
          input.min = -pMax;
          input.max = pMax;
          MGDom.setVal(input, s.batteryCmdKw);
        });

        MGDom.setText(r.actual,
          (s.batteryActualKw > 0 ? '+' : '') + s.batteryActualKw.toFixed(1) + ' kW');
        r.actual.className = 'bold ' +
          (s.batteryActualKw > 0 ? 't-teal' : s.batteryActualKw < 0 ? 't-cyan' : 't-muted');

        MGDom.setHtml(r.soc, '<span class="t-slate2">' + s.batterySocPercent.toFixed(0) + '%</span> ' +
          '<span class="text-10 t-slate">(' + s.batterySocKwh.toFixed(1) + ' kWh)</span>');

        var limited = s.batteryLimitedReason && s.batteryLimitedReason !== 'none';
        MGDom.setHtml(r.status, limited
          ? '<span class="tag limited">' + Icons.get('alertCircle', '', 11) +
            esc(LIMIT_TAGS[s.batteryLimitedReason] || '') + '</span>'
          : '<span class="tag nominal">' + Icons.get('checkCircle', '', 11) + ' Nominal</span>');
      }
    }

    return { el: root, update: update };
  }

  global.MGDispatch = { create: create };
})(window);
