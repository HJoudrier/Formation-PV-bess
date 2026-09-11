/* ==========================================================================
   Profils types, parametres par defaut et donnees horaires initiales.
   ========================================================================== */
(function (global) {
  'use strict';

  // Profils de consommation (kW)
  var LOAD_PRESETS = {
    tertiary: {
      name: 'Tertiaire / Bureaux',
      description: 'Bureaux et commerces avec pic d’activité de 8h à 18h et climatisation l’après-midi',
      values: [
        12.0, 11.5, 11.0, 11.0, 12.5, 15.0,
        22.0, 36.0, 48.0, 52.0, 50.0, 49.0,
        45.0, 47.0, 54.0, 55.0, 51.0, 42.0,
        30.0, 24.0, 20.0, 17.0, 14.5, 13.0
      ]
    },
    industrial: {
      name: 'PME Industrielle (2x8)',
      description: 'Atelier de production avec rotation d’équipes de 06h à 22h et charges de base la nuit',
      values: [
        18.0, 18.0, 17.5, 17.5, 20.0, 28.0,
        52.0, 58.0, 60.0, 59.0, 57.0, 45.0,
        56.0, 58.0, 62.0, 60.0, 55.0, 50.0,
        42.0, 38.0, 32.0, 26.0, 20.0, 19.0
      ]
    },
    residential: {
      name: 'Éco-Quartier Résidentiel',
      description: 'Consommation résidentielle avec pic du matin (petit-déjeuner) et fort pic du soir',
      values: [
        14.0, 12.0, 11.0, 10.5, 11.0, 14.0,
        22.0, 38.0, 30.0, 22.0, 20.0, 21.0,
        24.0, 22.0, 21.0, 22.0, 26.0, 35.0,
        46.0, 54.0, 51.0, 40.0, 28.0, 18.0
      ]
    }
  };

  // Profils de production PV normalisée (kW / kWc)
  var PV_NORM_PRESETS = {
    sunny_summer: {
      name: 'Été Ensoleillé (Dégagé)',
      description: 'Journée estivale avec fort rayonnement zénithal, pic à 0.84 kW/kWc',
      values: [
        0.00, 0.00, 0.00, 0.00, 0.00, 0.02,
        0.10, 0.28, 0.48, 0.65, 0.78, 0.84,
        0.85, 0.81, 0.72, 0.58, 0.40, 0.22,
        0.08, 0.01, 0.00, 0.00, 0.00, 0.00
      ]
    },
    temperate_spring: {
      name: 'Printemps Tempéré (Idéal)',
      description: 'Journée printanière dégagée avec bon rendement thermique des panneaux',
      values: [
        0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
        0.04, 0.18, 0.38, 0.56, 0.68, 0.75,
        0.76, 0.70, 0.60, 0.46, 0.28, 0.12,
        0.02, 0.00, 0.00, 0.00, 0.00, 0.00
      ]
    },
    variable_cloudy: {
      name: 'Journée Nuageuse / Variable',
      description: 'Passages nuageux atténuant la production solaire en milieu de journée',
      values: [
        0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
        0.02, 0.11, 0.22, 0.38, 0.25, 0.45,
        0.52, 0.34, 0.48, 0.28, 0.18, 0.06,
        0.01, 0.00, 0.00, 0.00, 0.00, 0.00
      ]
    }
  };

  // Profils de prix SPOT day-ahead (€/MWh)
  var SPOT_PRICE_PRESETS = {
    standard_european: {
      name: 'Marché SPOT Typique (EPEX)',
      description: 'Creux nocturne, pic du matin (8h-10h), creux solaire à midi, fort pic de soirée (18h-21h)',
      values: [
        54.2, 48.6, 45.1, 44.0, 46.8, 58.3,
        85.4, 115.8, 138.5, 122.0, 88.4, 62.5,
        42.1, 38.6, 46.5, 68.0, 92.4, 128.6,
        162.5, 175.4, 154.0, 112.5, 82.0, 64.0
      ]
    },
    solar_negative_dip: {
      name: 'Forte Pénétration Renouvelable (Creux à midi)',
      description: 'Prix très bas voire quasi-nuls en milieu de journée causés par la surproduction solaire régionale',
      values: [
        48.0, 42.0, 38.0, 35.0, 40.0, 52.0,
        75.0, 98.0, 72.0, 40.0, 18.0, 5.0,
        -2.5, 4.0, 15.0, 38.0, 65.0, 105.0,
        155.0, 168.0, 142.0, 95.0, 68.0, 52.0
      ]
    },
    winter_tension: {
      name: 'Tension Hivernale (Prix élevés)',
      description: 'Moyenne élevée avec pointes prononcées le matin et le soir',
      values: [
        78.0, 72.0, 69.0, 70.0, 78.0, 95.0,
        145.0, 195.0, 220.0, 185.0, 140.0, 125.0,
        118.0, 115.0, 122.0, 138.0, 172.0, 225.0,
        250.0, 240.0, 210.0, 165.0, 120.0, 95.0
      ]
    }
  };

  var DEFAULT_MICROGRID_PARAMETERS = {
    // Photovoltaïque
    pvInstalledKwc: 45,
    pvCapexPerKwc: 1200,

    // Batterie BESS
    batteryCapacityKwh: 60,
    batteryPowerKw: 25,
    batteryCapexPerKwh: 350,
    batteryCapexPerKw: 150,
    batteryEfficiencyPercent: 92,
    batterySocMinPercent: 10,
    batterySocMaxPercent: 95,
    batteryInitialSocPercent: 40,

    // Raccordement réseau
    gridMaxPowerKw: 36,
    gridMaxInjectionKw: 36,
    feedInTariffEurPerMwh: 70,
    feedInMode: 'spot'
  };

  function createInitialHourlyData() {
    var loadValues = LOAD_PRESETS.tertiary.values;
    var pvValues = PV_NORM_PRESETS.sunny_summer.values;
    var spotValues = SPOT_PRICE_PRESETS.standard_european.values;
    var out = [];
    for (var i = 0; i < 24; i++) {
      out.push({
        hour: i,
        label: String(i).padStart(2, '0') + ':00',
        loadKw: loadValues[i],
        pvNormKwPerKwc: pvValues[i],
        spotPriceEurPerMwh: spotValues[i],
        batteryDispatchCmdKw: 0
      });
    }
    return out;
  }

  global.MGData = {
    LOAD_PRESETS: LOAD_PRESETS,
    PV_NORM_PRESETS: PV_NORM_PRESETS,
    SPOT_PRICE_PRESETS: SPOT_PRICE_PRESETS,
    DEFAULT_MICROGRID_PARAMETERS: DEFAULT_MICROGRID_PARAMETERS,
    createInitialHourlyData: createInitialHourlyData
  };
})(window);
