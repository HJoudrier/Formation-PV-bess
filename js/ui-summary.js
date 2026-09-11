/* ==========================================================================
   Bilan energetique et economique 24h.
   ========================================================================== */
(function (global) {
  'use strict';

  var esc = MGDom.esc;
  var eur = MGDom.eur;

  function create() {
    var root = MGDom.el('<div class="panel"></div>');

    function kpi(label, iconHtml, valueCls, value, foot, footProse) {
      return '<div class="kpi"><span class="kpi-label"><span>' + esc(label) + '</span>' + (iconHtml || '') + '</span>' +
        '<div class="kpi-value ' + valueCls + '">' + esc(value) + '</div>' +
        '<div class="kpi-foot' + (footProse ? ' prose' : '') + '">' + foot + '</div></div>';
    }

    function balanceCell(label, cls, value) {
      return '<div><span class="label">' + esc(label) + '</span>' +
        '<span class="value ' + cls + '">' + esc(value) + '</span></div>';
    }

    function update(state) {
      var sm = state.simulation.summary;
      var p = state.params;
      var hasDeficit = sm.hoursWithDeficit.length > 0;

      root.innerHTML =
        '<div class="panel-head">' +
        '<div class="panel-head-main">' + Icons.get('coins', 't-emerald', 20) +
        '<div><h2 class="panel-title">Bilan Énergétique &amp; Économique (24h)</h2>' +
        '<p class="panel-subtitle">Synthèse globale des investissements (CAPEX), des coûts d\'exploitation (OPEX) et de la performance.</p>' +
        '</div></div>' +
        (hasDeficit
          ? '<div class="status-chip danger">' + Icons.get('alertTriangle', 't-rose', 15) +
            '<span>Non-alimenté : ' + sm.totalUnservedKwh.toFixed(1) + ' kWh (' + sm.hoursWithDeficit.length + ' h)</span></div>'
          : '<div class="status-chip ok">' + Icons.get('checkCircle', 't-emerald', 15) +
            '<span>100% de la charge alimentée</span></div>') +
        '</div>' +

        '<div class="grid grid-kpi" style="margin-bottom:1.25rem">' +
        kpi('Investissement Total (CAPEX)', '', 't-emerald', eur(sm.totalCapexEur) + ' €',
          '<div>PV : ' + eur(sm.pvCapexEur) + ' € (' + esc(p.pvInstalledKwc) + ' kWc)</div>' +
          '<div>Batterie : ' + eur(sm.batteryTotalCapexEur) + ' € (' + esc(p.batteryCapacityKwh) +
          ' kWh / ' + esc(p.batteryPowerKw) + ' kW)</div>') +
        kpi('Facture Électricité Réseau (24h)', '',
          sm.dailyNetCostEur <= 0 ? 't-emerald' : '',
          sm.dailyNetCostEur.toFixed(2) + ' € / jour',
          '<div>Achats SPOT : +' + sm.dailyElectricityCostEur.toFixed(2) + ' €</div>' +
          '<div>Revente Surplus : -' + sm.dailyGridRevenueEur.toFixed(2) + ' €</div>') +
        kpi('Taux d\'Autoconsommation', Icons.get('pieChart', 't-amber', 14), 't-amber',
          sm.selfConsumptionRatePercent.toFixed(1) + '%',
          'Part de la production solaire PV consommée localement (directement ou via batterie).', true) +
        kpi('Taux d\'Autonomie (Solaire + Stock)', Icons.get('trendingUp', 't-teal', 14), 't-teal',
          sm.selfSufficiencyRatePercent.toFixed(1) + '%',
          'Part de la charge couverte par les actifs locaux sans dépendre du raccordement réseau.', true) +
        '</div>' +

        '<div class="balance-row grid-balance">' +
        balanceCell('Consommation Charge', 't-orange', sm.totalLoadKwh.toFixed(1) + ' kWh') +
        balanceCell('Production Solaire PV', 't-amber', sm.totalPvGenKwh.toFixed(1) + ' kWh') +
        balanceCell('Charge Batterie', 't-teal', sm.totalBatteryChargedKwh.toFixed(1) + ' kWh') +
        balanceCell('Décharge Batterie', 't-cyan', sm.totalBatteryDischargedKwh.toFixed(1) + ' kWh') +
        balanceCell('Énergie Soutirée Réseau', 't-indigo', sm.totalGridImportKwh.toFixed(1) + ' kWh') +
        balanceCell('Surplus Injecté Réseau', 't-emerald', sm.totalGridExportKwh.toFixed(1) + ' kWh') +
        '</div>';
    }

    return { el: root, update: update };
  }

  global.MGSummary = { create: create };
})(window);
