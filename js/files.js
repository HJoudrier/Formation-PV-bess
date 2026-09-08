/* ==========================================================================
   Lecture / ecriture de fichiers, 100% local (aucune requete reseau).
   ========================================================================== */
(function (global) {
  'use strict';

  /**
   * Extrait 24 valeurs numeriques d'un contenu CSV, texte ou JSON.
   * Accepte la virgule decimale francaise et les separateurs ; , tabulation.
   */
  function parseNumericArrayFromText(text) {
    try {
      var trimmed = String(text || '').trim();
      if (!trimmed) return { values: [], error: 'Le fichier est vide.' };

      // Tentative JSON en premier
      if (trimmed.charAt(0) === '[' || trimmed.charAt(0) === '{') {
        try {
          var json = JSON.parse(trimmed);
          if (Array.isArray(json)) {
            var numbers = json.map(function (item) {
              if (typeof item === 'number') return item;
              if (typeof item === 'object' && item !== null) {
                var val = item.value;
                if (val === undefined || val === null) val = item.val;
                if (val === undefined || val === null) val = item.loadKw;
                if (val === undefined || val === null) val = item.pvNorm;
                if (val === undefined || val === null) val = item.price;
                return Number(val) || 0;
              }
              return Number(item) || 0;
            });
            if (numbers.length >= 24) return { values: numbers.slice(0, 24) };
            if (numbers.length > 0) {
              while (numbers.length < 24) numbers.push(numbers[numbers.length - 1] || 0);
              return { values: numbers };
            }
          }
        } catch (e) {
          // On bascule sur l'analyse CSV
        }
      }

      // Analyse ligne a ligne
      var lines = trimmed.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
      var out = [];

      for (var i = 0; i < lines.length; i++) {
        var parts = lines[i].split(/[;,\t]/).map(function (p) { return p.trim(); });
        var foundNum = null;

        for (var j = 0; j < parts.length; j++) {
          var num = parseFloat(parts[j].replace(',', '.'));
          if (!isNaN(num) && isFinite(num)) {
            foundNum = num;
            // Si la 1re colonne ressemble a un index d'heure, on prend la 2e
            if (parts.length >= 2 && out.length < 24 && Math.abs(num - out.length) < 0.001) {
              var secondNum = parseFloat(parts[1].replace(',', '.'));
              if (!isNaN(secondNum)) foundNum = secondNum;
            }
            break;
          }
        }

        if (foundNum !== null) out.push(foundNum);
      }

      if (out.length === 0) {
        return { values: [], error: 'Aucune valeur numérique valide détectée dans le fichier.' };
      }
      while (out.length < 24) out.push(out[out.length - 1]);

      return { values: out.slice(0, 24) };
    } catch (err) {
      return { values: [], error: 'Erreur lors de la lecture : ' + (err && err.message ? err.message : 'inconnue') };
    }
  }

  /** Declenche un telechargement local, sans aucun appel reseau. */
  function triggerLocalDownload(filename, content, mimeType) {
    var blob = new Blob([content], { type: mimeType || 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function buildSampleCsv(header, values, decimals) {
    var csv = header + '\n';
    values.forEach(function (val, idx) {
      csv += idx + ':00;' + val.toFixed(decimals).replace('.', ',') + '\n';
    });
    return csv;
  }

  function generateLoadSampleCsv() {
    return buildSampleCsv('Heure;Consommation_kW', [
      12.0, 11.5, 11.0, 11.0, 12.5, 15.0,
      22.0, 36.0, 48.0, 52.0, 50.0, 49.0,
      45.0, 47.0, 54.0, 55.0, 51.0, 42.0,
      30.0, 24.0, 20.0, 17.0, 14.5, 13.0
    ], 1);
  }

  function generatePvNormSampleCsv() {
    return buildSampleCsv('Heure;Production_Normalisee_kW_par_kWc', [
      0.0, 0.0, 0.0, 0.0, 0.0, 0.02,
      0.10, 0.28, 0.48, 0.65, 0.78, 0.84,
      0.85, 0.81, 0.72, 0.58, 0.40, 0.22,
      0.08, 0.01, 0.0, 0.0, 0.0, 0.0
    ], 2);
  }

  function generateSpotPriceSampleCsv() {
    return buildSampleCsv('Heure;Prix_SPOT_EUR_MWh', [
      54.2, 48.6, 45.1, 44.0, 46.8, 58.3,
      85.4, 115.8, 138.5, 122.0, 88.4, 62.5,
      42.1, 38.6, 46.5, 68.0, 92.4, 128.6,
      162.5, 175.4, 154.0, 112.5, 82.0, 64.0
    ], 2);
  }

  /** Rapport complet 24h au format CSV (separateur ; et virgule decimale). */
  function generateSimulationResultsCsv(steps, summary, params) {
    var csv = '# PLANIFICATION MICRO-RESEAU 24H\n';
    csv += '# Dimensionnement PV: ' + params.pvInstalledKwc + ' kWc (CAPEX: ' + summary.pvCapexEur + ' EUR)\n';
    csv += '# Dimensionnement Batterie: ' + params.batteryCapacityKwh + ' kWh / ' + params.batteryPowerKw +
           ' kW (CAPEX: ' + summary.batteryTotalCapexEur + ' EUR)\n';
    csv += '# Limite Reseau: ' + params.gridMaxPowerKw + ' kW | Couts Electricite 24h: ' +
           summary.dailyNetCostEur.toFixed(2) + ' EUR\n';
    csv += '# Taux Autoconsommation: ' + summary.selfConsumptionRatePercent.toFixed(1) +
           '% | Taux Autonomie: ' + summary.selfSufficiencyRatePercent.toFixed(1) + '%\n\n';

    csv += 'Heure;Charge_kW;Production_PV_kW;Consigne_Batterie_kW;Batterie_Reelle_kW;SOC_kWh;SOC_Pourcent;' +
           'Import_Reseau_kW;Export_Reseau_kW;Prix_SPOT_EUR_MWh;Deficit_Non_Couvert_kW;Cout_Horaire_EUR\n';

    steps.forEach(function (s) {
      csv += [
        s.label,
        s.loadKw.toFixed(2),
        s.pvGenKw.toFixed(2),
        s.batteryCmdKw.toFixed(2),
        s.batteryActualKw.toFixed(2),
        s.batterySocKwh.toFixed(2),
        s.batterySocPercent.toFixed(1),
        s.gridImportKw.toFixed(2),
        s.gridExportKw.toFixed(2),
        s.spotPriceEurPerMwh.toFixed(2),
        s.unservedLoadKw.toFixed(2),
        s.costEur.toFixed(2)
      ].join(';').replace(/\./g, ',') + '\n';
    });

    return csv;
  }

  global.MGFiles = {
    parseNumericArrayFromText: parseNumericArrayFromText,
    triggerLocalDownload: triggerLocalDownload,
    generateLoadSampleCsv: generateLoadSampleCsv,
    generatePvNormSampleCsv: generatePvNormSampleCsv,
    generateSpotPriceSampleCsv: generateSpotPriceSampleCsv,
    generateSimulationResultsCsv: generateSimulationResultsCsv
  };
})(window);
