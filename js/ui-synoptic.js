/* ==========================================================================
   Schema synoptique 2D du micro-reseau (SVG anime).
   ========================================================================== */
(function (global) {
  'use strict';

  var esc = MGDom.esc;

  var LIMIT_LABELS = {
    full: 'Plafond SOC Max atteint',
    empty: 'Seuil SOC Min atteint',
    max_charge_power: 'Puissance charge bridée au max kW',
    max_discharge_power: 'Puissance décharge bridée au max kW'
  };

  var DEFS = [
    '<defs>',
    '<style>',
    '@keyframes flowRight { from { stroke-dashoffset: 24; } to { stroke-dashoffset: 0; } }',
    '@keyframes flowLeft { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 24; } }',
    '@keyframes alertGlow {',
    '  0%, 100% { stroke: #ef4444; filter: drop-shadow(0 0 4px rgba(239,68,68,0.4)); }',
    '  50% { stroke: #f87171; filter: drop-shadow(0 0 10px rgba(239,68,68,0.8)); }',
    '}',
    '.flow-active-right { animation: flowRight 0.8s linear infinite; }',
    '.flow-active-left { animation: flowLeft 0.8s linear infinite; }',
    '.deficit-glow { animation: alertGlow 1.2s ease-in-out infinite; }',
    '</style>',
    '<linearGradient id="gridCardLight" x1="0%" y1="0%" x2="100%" y2="100%">',
    '<stop offset="0%" stop-color="#0c162c"/><stop offset="100%" stop-color="#070c18"/></linearGradient>',
    '<linearGradient id="pvCardLight" x1="0%" y1="0%" x2="100%" y2="100%">',
    '<stop offset="0%" stop-color="#241b07"/><stop offset="100%" stop-color="#120c02"/></linearGradient>',
    '<linearGradient id="batteryCardLight" x1="0%" y1="0%" x2="100%" y2="100%">',
    '<stop offset="0%" stop-color="#062220"/><stop offset="100%" stop-color="#031211"/></linearGradient>',
    '<linearGradient id="loadCardLight" x1="0%" y1="0%" x2="100%" y2="100%">',
    '<stop offset="0%" stop-color="#251206"/><stop offset="100%" stop-color="#130702"/></linearGradient>',
    '<linearGradient id="loadDeficitLight" x1="0%" y1="0%" x2="100%" y2="100%">',
    '<stop offset="0%" stop-color="#3b0808"/><stop offset="100%" stop-color="#1c0303"/></linearGradient>',
    '</defs>'
  ].join('');

  /** Badge de flux pose sur un cable. */
  function flowBadge(x, y, stroke, fill, text) {
    return '<g transform="translate(' + x + ', ' + y + ')">' +
      '<rect x="0" y="0" width="170" height="34" rx="8" fill="#030712" stroke="' + stroke + '" stroke-width="1.8"/>' +
      '<text x="85" y="21" fill="' + fill + '" font-size="12" font-weight="bold" text-anchor="middle" ' +
      'font-family="monospace">' + esc(text) + '</text></g>';
  }

  function animatedLine(x1, y1, x2, y2, color, dir) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + color +
      '" stroke-width="5" stroke-dasharray="10 8" class="flow-active-' + dir + '"/>';
  }

  function baseLine(x1, y1, x2, y2) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#1e293b" stroke-width="6"/>';
  }

  function buildSvg(step, params) {
    var isCharging = step.batteryActualKw > 0.05;
    var isDischarging = step.batteryActualKw < -0.05;
    var isImporting = step.gridImportKw > 0.05;
    var isExporting = step.gridExportKw > 0.05;
    var isProducing = step.pvGenKw > 0.05;
    var isDeficit = step.isDeficit;

    var s = '<svg viewBox="0 0 1060 560" role="img" aria-label="Schéma synoptique du micro-réseau">';
    s += DEFS;

    // 1. Jeu de barres AC central
    s += '<g>' +
      '<line x1="520" y1="50" x2="520" y2="510" stroke="#64748b" stroke-width="8" stroke-linecap="round"/>' +
      '<line x1="520" y1="52" x2="520" y2="508" stroke="#f1f5f9" stroke-width="4" stroke-linecap="round"/>' +
      '<circle cx="520" cy="115" r="7" fill="#fde047" stroke="#000" stroke-width="2.5"/>' +
      '<circle cx="520" cy="280" r="7" fill="#38bdf8" stroke="#000" stroke-width="2.5"/>' +
      '<circle cx="520" cy="445" r="7" fill="#fb923c" stroke="#000" stroke-width="2.5"/>' +
      '</g>';

    // 2a. Reseau <-> bus
    s += '<g>' + baseLine(300, 280, 520, 280);
    if (isImporting) s += animatedLine(300, 280, 520, 280, '#60a5fa', 'right');
    if (isExporting) s += animatedLine(300, 280, 520, 280, '#34d399', 'left');
    s += flowBadge(325, 238,
      isImporting ? '#60a5fa' : isExporting ? '#34d399' : '#334155',
      isImporting ? '#93c5fd' : isExporting ? '#6ee7b7' : '#94a3b8',
      isImporting ? 'Import +' + step.gridImportKw.toFixed(1) + ' kW ➔'
        : isExporting ? '⬅ Export -' + step.gridExportKw.toFixed(1) + ' kW'
        : 'Neutre 0.0 kW');
    s += '</g>';

    // 2b. PV -> bus
    s += '<g>' + baseLine(520, 115, 740, 115);
    if (isProducing) s += animatedLine(520, 115, 740, 115, '#fbbf24', 'left');
    s += flowBadge(545, 73,
      isProducing ? '#fbbf24' : '#334155',
      isProducing ? '#fef08a' : '#94a3b8',
      isProducing ? '⬅ Solaire +' + step.pvGenKw.toFixed(1) + ' kW' : 'Nuit (0.0 kW)');
    s += '</g>';

    // 2c. Batterie <-> bus
    s += '<g>' + baseLine(520, 280, 740, 280);
    if (isCharging) s += animatedLine(520, 280, 740, 280, '#2dd4bf', 'right');
    if (isDischarging) s += animatedLine(520, 280, 740, 280, '#38bdf8', 'left');
    s += flowBadge(545, 238,
      isCharging ? '#2dd4bf' : isDischarging ? '#38bdf8' : '#334155',
      isCharging ? '#99f6e4' : isDischarging ? '#bae6fd' : '#94a3b8',
      isCharging ? 'Charge +' + step.batteryActualKw.toFixed(1) + ' kW ➔'
        : isDischarging ? '⬅ Décharge ' + Math.abs(step.batteryActualKw).toFixed(1) + ' kW'
        : 'Veille 0.0 kW');
    s += '</g>';

    // 2d. Bus -> charge
    s += '<g>' + baseLine(520, 445, 740, 445);
    s += animatedLine(520, 445, 740, 445, isDeficit ? '#ef4444' : '#fb923c', 'right');
    s += flowBadge(545, 403,
      isDeficit ? '#ef4444' : '#fb923c',
      isDeficit ? '#fca5a5' : '#fed7aa',
      'Charge -' + (step.loadKw - step.unservedLoadKw).toFixed(1) + ' kW ➔');
    s += '</g>';

    // 3a. Carte RESEAU PUBLIC
    var gridGauge = Math.min(100, Math.max(0, (step.gridImportKw / Math.max(1, params.gridMaxPowerKw)) * 100)) * 2.34;
    s += '<g>' +
      '<rect x="30" y="180" width="270" height="200" rx="14" fill="url(#gridCardLight)" stroke="#60a5fa" stroke-width="2"/>' +
      '<g transform="translate(48, 198)">' +
      '<rect x="0" y="0" width="34" height="34" rx="8" fill="#1e3a8a" stroke="#60a5fa" stroke-width="1.5"/>' +
      '<path d="M 17 5 L 9 29 L 25 29 Z M 12 18 L 22 18 M 17 5 L 17 29" stroke="#93c5fd" stroke-width="2" fill="none"/>' +
      '<text x="44" y="16" fill="#fff" font-size="14" font-weight="bold" font-family="sans-serif">RÉSEAU PUBLIC</text>' +
      '<text x="44" y="29" fill="#93c5fd" font-size="11" font-family="sans-serif">Raccordement Enedis</text></g>' +
      '<g transform="translate(48, 255)">' +
      '<text x="0" y="14" fill="#94a3b8" font-size="11" font-family="sans-serif">Souscription max :</text>' +
      '<text x="234" y="14" fill="#fff" font-size="12" font-weight="bold" text-anchor="end" font-family="monospace">' +
      esc(params.gridMaxPowerKw) + ' kW</text>' +
      '<text x="0" y="38" fill="#94a3b8" font-size="11" font-family="sans-serif">Flux instantané :</text>' +
      '<text x="234" y="38" fill="' + (isImporting ? '#93c5fd' : isExporting ? '#6ee7b7' : '#94a3b8') +
      '" font-size="12" font-weight="bold" text-anchor="end" font-family="monospace">' +
      esc(isImporting ? '+' + step.gridImportKw.toFixed(1) + ' kW (Import)'
        : isExporting ? '-' + step.gridExportKw.toFixed(1) + ' kW (Export)'
        : '0.0 kW (Neutre)') + '</text>' +
      '<rect x="0" y="50" width="234" height="6" rx="3" fill="#1e293b"/>' +
      '<rect x="0" y="50" width="' + gridGauge + '" height="6" rx="3" fill="' +
      (step.gridImportKw >= params.gridMaxPowerKw * 0.95 ? '#ef4444' : '#60a5fa') + '"/>' +
      '<line x1="0" y1="72" x2="234" y2="72" stroke="#334155" stroke-width="1"/>' +
      '<text x="0" y="92" fill="#94a3b8" font-size="11" font-family="sans-serif">Facture / Recette :</text>' +
      '<text x="234" y="92" fill="' + (step.costEur > 0 ? '#f8fafc' : '#4ade80') +
      '" font-size="13" font-weight="bold" text-anchor="end" font-family="monospace">' +
      step.costEur.toFixed(2) + ' €/h</text></g>' +
      '<circle cx="300" cy="280" r="5" fill="#60a5fa" stroke="#fff" stroke-width="1.5"/></g>';

    // 3b. Carte CENTRALE SOLAIRE
    var pvRatio = params.pvInstalledKwc > 0 ? step.pvGenKw / params.pvInstalledKwc : 0;
    s += '<g>' +
      '<rect x="740" y="35" width="290" height="160" rx="14" fill="url(#pvCardLight)" stroke="#fbbf24" stroke-width="2"/>' +
      '<g transform="translate(758, 55)">' +
      '<rect x="0" y="0" width="34" height="34" rx="8" fill="#78350f" stroke="#fbbf24" stroke-width="1.5"/>' +
      '<circle cx="17" cy="17" r="6" fill="#fef08a"/>' +
      '<path d="M 17 4 L 17 8 M 17 26 L 17 30 M 4 17 L 8 17 M 26 17 L 30 17" stroke="#fef08a" stroke-width="2" stroke-linecap="round"/>' +
      '<text x="44" y="16" fill="#fff" font-size="14" font-weight="bold" font-family="sans-serif">CENTRALE SOLAIRE PV</text>' +
      '<text x="44" y="29" fill="#fef08a" font-size="11" font-family="sans-serif">Champ photovoltaïque</text></g>' +
      '<g transform="translate(758, 106)">' +
      '<text x="0" y="12" fill="#94a3b8" font-size="11" font-family="sans-serif">Puissance crête :</text>' +
      '<text x="254" y="12" fill="#fef08a" font-size="12" font-weight="bold" text-anchor="end" font-family="monospace">' +
      esc(params.pvInstalledKwc) + ' kWc</text>' +
      '<text x="0" y="34" fill="#94a3b8" font-size="11" font-family="sans-serif">Production actuelle :</text>' +
      '<text x="254" y="34" fill="#fde047" font-size="15" font-weight="bold" text-anchor="end" font-family="monospace">' +
      step.pvGenKw.toFixed(1) + ' kW</text>' +
      '<rect x="0" y="44" width="254" height="6" rx="3" fill="#1e293b"/>' +
      '<rect x="0" y="44" width="' + (Math.min(100, pvRatio * 100) * 2.54) + '" height="6" rx="3" fill="#fde047"/>' +
      '<line x1="0" y1="58" x2="254" y2="58" stroke="#334155" stroke-width="1"/>' +
      '<text x="0" y="73" fill="#94a3b8" font-size="10" font-family="sans-serif">Rendement :</text>' +
      '<text x="254" y="73" fill="#f8fafc" font-size="10" text-anchor="end" font-family="monospace">' +
      pvRatio.toFixed(2) + ' kW/kWc</text></g>' +
      '<circle cx="740" cy="115" r="5" fill="#fde047" stroke="#fff" stroke-width="1.5"/></g>';

    // 3c. Carte BATTERIE
    var limited = step.batteryLimitedReason && step.batteryLimitedReason !== 'none';
    s += '<g>' +
      '<rect x="740" y="205" width="290" height="175" rx="14" fill="url(#batteryCardLight)" stroke="#2dd4bf" stroke-width="2"/>' +
      '<g transform="translate(758, 225)">' +
      '<rect x="0" y="0" width="34" height="34" rx="8" fill="#115e59" stroke="#2dd4bf" stroke-width="1.5"/>' +
      '<rect x="7" y="10" width="18" height="14" rx="2" fill="none" stroke="#5eead4" stroke-width="2"/>' +
      '<line x1="27" y1="14" x2="27" y2="20" stroke="#5eead4" stroke-width="2" stroke-linecap="round"/>' +
      '<line x1="12" y1="14" x2="12" y2="20" stroke="#5eead4" stroke-width="1.5"/>' +
      '<line x1="16" y1="14" x2="16" y2="20" stroke="#5eead4" stroke-width="1.5"/>' +
      '<text x="44" y="16" fill="#fff" font-size="14" font-weight="bold" font-family="sans-serif">STOCKAGE BATTERIE</text>' +
      '<text x="44" y="29" fill="#5eead4" font-size="11" font-family="sans-serif">' +
      esc(params.batteryCapacityKwh) + ' kWh • ' + esc(params.batteryPowerKw) + ' kW</text></g>' +
      '<g transform="translate(758, 274)">' +
      '<text x="0" y="12" fill="#94a3b8" font-size="11" font-family="sans-serif">Niveau d\'énergie (SOC) :</text>' +
      '<text x="254" y="12" fill="#5eead4" font-size="13" font-weight="bold" text-anchor="end" font-family="monospace">' +
      step.batterySocPercent.toFixed(0) + '% (' + step.batterySocKwh.toFixed(1) + ' kWh)</text>' +
      '<rect x="0" y="20" width="254" height="14" rx="4" fill="#041211" stroke="#134e4a" stroke-width="1"/>' +
      '<rect x="2" y="22" width="' + (Math.min(100, Math.max(0, step.batterySocPercent)) * 2.5) +
      '" height="10" rx="2" fill="' + (step.batterySocPercent < 20 ? '#fbbf24' : '#2dd4bf') + '"/>' +
      '<text x="0" y="46" fill="#64748b" font-size="9" font-family="sans-serif">Min: ' + esc(params.batterySocMinPercent) + '%</text>' +
      '<text x="254" y="46" fill="#64748b" font-size="9" text-anchor="end" font-family="sans-serif">Max: ' + esc(params.batterySocMaxPercent) + '%</text>' +
      '<line x1="0" y1="54" x2="254" y2="54" stroke="#334155" stroke-width="1"/>' +
      '<text x="0" y="72" fill="#94a3b8" font-size="11" font-family="sans-serif">Flux de puissance :</text>' +
      '<text x="254" y="72" fill="' + (isCharging ? '#2dd4bf' : isDischarging ? '#38bdf8' : '#94a3b8') +
      '" font-size="12" font-weight="bold" text-anchor="end" font-family="monospace">' +
      esc(isCharging ? '+' + step.batteryActualKw.toFixed(1) + ' kW (Charge)'
        : isDischarging ? step.batteryActualKw.toFixed(1) + ' kW (Décharge)'
        : '0.0 kW (Veille)') + '</text>' +
      (limited
        ? '<g transform="translate(0, 80)">' +
          '<rect x="0" y="0" width="254" height="18" rx="4" fill="#451a03" stroke="#b45309" stroke-width="1"/>' +
          '<text x="127" y="12" fill="#fef08a" font-size="9" font-weight="bold" text-anchor="middle" font-family="monospace">' +
          esc(LIMIT_LABELS[step.batteryLimitedReason] || '') + '</text></g>'
        : '') +
      '</g><circle cx="740" cy="280" r="5" fill="#2dd4bf" stroke="#fff" stroke-width="1.5"/></g>';

    // 3d. Carte CHARGE DU SITE
    s += '<g>' +
      '<rect x="740" y="390" width="290" height="150" rx="14" fill="' +
      (isDeficit ? 'url(#loadDeficitLight)' : 'url(#loadCardLight)') + '" stroke="' +
      (isDeficit ? '#ef4444' : '#fb923c') + '" stroke-width="2"' +
      (isDeficit ? ' class="deficit-glow"' : '') + '/>' +
      '<g transform="translate(758, 410)">' +
      '<rect x="0" y="0" width="34" height="34" rx="8" fill="' + (isDeficit ? '#7f1d1d' : '#7c2d12') +
      '" stroke="' + (isDeficit ? '#fca5a5' : '#fb923c') + '" stroke-width="1.5"/>' +
      '<path d="M 18 6 L 10 18 L 17 18 L 16 28 L 24 16 L 17 16 Z" fill="' + (isDeficit ? '#fee2e2' : '#fed7aa') + '"/>' +
      '<text x="44" y="16" fill="#fff" font-size="14" font-weight="bold" font-family="sans-serif">CHARGE DU SITE</text>' +
      '<text x="44" y="29" fill="' + (isDeficit ? '#fca5a5' : '#fed7aa') +
      '" font-size="11" font-family="sans-serif">Consommation non pilotable</text></g>' +
      '<g transform="translate(758, 458)">' +
      '<text x="0" y="12" fill="#94a3b8" font-size="11" font-family="sans-serif">Puissance appelée :</text>' +
      '<text x="254" y="12" fill="#fed7aa" font-size="15" font-weight="bold" text-anchor="end" font-family="monospace">' +
      step.loadKw.toFixed(1) + ' kW</text>' +
      '<text x="0" y="32" fill="#94a3b8" font-size="11" font-family="sans-serif">Puissance alimentée :</text>' +
      '<text x="254" y="32" fill="#fff" font-size="12" font-weight="bold" text-anchor="end" font-family="monospace">' +
      (step.loadKw - step.unservedLoadKw).toFixed(1) + ' kW</text>' +
      (isDeficit
        ? '<g transform="translate(0, 42)">' +
          '<rect x="0" y="0" width="254" height="26" rx="6" fill="#7f1d1d" stroke="#ef4444" stroke-width="1.5"/>' +
          '<text x="127" y="17" fill="#fff" font-size="10" font-weight="bold" text-anchor="middle" font-family="sans-serif">' +
          '⚠️ DÉFICIT : -' + step.unservedLoadKw.toFixed(1) + ' kW non alimentés</text></g>'
        : '<g transform="translate(0, 42)">' +
          '<line x1="0" y1="0" x2="254" y2="0" stroke="#334155" stroke-width="1"/>' +
          '<text x="0" y="17" fill="#94a3b8" font-size="11" font-family="sans-serif">Statut alimentation :</text>' +
          '<text x="254" y="17" fill="#4ade80" font-size="12" font-weight="bold" text-anchor="end" font-family="sans-serif">' +
          '100% Satisfaite</text></g>') +
      '</g><circle cx="740" cy="445" r="5" fill="' + (isDeficit ? '#ef4444' : '#fb923c') +
      '" stroke="#fff" stroke-width="1.5"/></g>';

    s += '</svg>';
    return s;
  }

  function create(store) {
    var root = MGDom.el('<div class="synoptic"></div>');
    var fitMode = 'fit';

    root.innerHTML =
      '<div class="synoptic-toolbar">' +
      '<button class="btn btn-sm" data-action="toggle-fit"></button>' +
      '</div>' +
      '<div class="synoptic-canvas"><div class="synoptic-inner"></div></div>' +
      '<div class="deficit-slot"></div>';

    var toolbarBtn = root.querySelector('[data-action="toggle-fit"]');
    var canvas = root.querySelector('.synoptic-canvas');
    var inner = root.querySelector('.synoptic-inner');
    var deficitSlot = root.querySelector('.deficit-slot');

    toolbarBtn.addEventListener('click', function () {
      fitMode = fitMode === 'fit' ? 'scroll' : 'fit';
      update(store.state());
    });

    function update(state) {
      var step = state.simulation.steps[state.currentHour] || state.simulation.steps[0];
      var deficitHours = state.simulation.summary.hoursWithDeficit;

      toolbarBtn.innerHTML = fitMode === 'fit'
        ? Icons.get('maximize', 't-cyan', 14) + '<span>Zoom 100%</span>'
        : Icons.get('minimize', 't-emerald', 14) + '<span>Ajuster</span>';
      toolbarBtn.title = fitMode === 'fit'
        ? 'Passer en zoom 100% avec défilement tactile'
        : 'Ajuster à la largeur de l\'écran';
      canvas.classList.toggle('scroll', fitMode === 'scroll');

      inner.innerHTML = buildSvg(step, state.params);

      if (deficitHours.length > 0) {
        deficitSlot.innerHTML =
          '<div class="deficit-banner">' +
          '<div class="deficit-banner-main">' + Icons.get('shieldAlert', 't-rose', 20) +
          '<span><strong>Contrainte de raccordement dépassée :</strong> ' + deficitHours.length +
          ' heure(s) présentent un déficit de puissance sur la journée (' +
          esc(deficitHours.map(function (h) { return h + 'h'; }).join(', ')) + ').</span></div>' +
          '<span class="deficit-banner-hint">Augmenter la batterie ou la souscription réseau</span></div>';
      } else {
        deficitSlot.innerHTML = '';
      }
    }

    return { el: root, update: update };
  }

  global.MGSynoptic = { create: create };
})(window);
