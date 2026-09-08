/* ==========================================================================
   Moteur de simulation 24h du micro-reseau.
   Portage direct de l'ancien microgridEngine.ts (memes formules).
   ========================================================================== */
(function (global) {
  'use strict';

  function runMicrogridSimulation(hourlyData, params) {
    var steps = [];
    var hoursWithDeficit = [];

    // Rendements : la racine repartit le rendement aller-retour sur charge et decharge.
    var roundTrip = Math.max(0.01, Math.min(1.0, params.batteryEfficiencyPercent / 100));
    var etaCharge = Math.sqrt(roundTrip);
    var etaDischarge = Math.sqrt(roundTrip);

    var eCap = Math.max(0.1, params.batteryCapacityKwh);
    var eMin = (Math.max(0, Math.min(100, params.batterySocMinPercent)) / 100) * eCap;
    var eMax = (Math.max(0, Math.min(100, params.batterySocMaxPercent)) / 100) * eCap;
    var pBattMax = Math.max(0, params.batteryPowerKw);

    var currentEnergyKwh = (Math.max(0, Math.min(100, params.batteryInitialSocPercent)) / 100) * eCap;
    currentEnergyKwh = Math.max(eMin, Math.min(eMax, currentEnergyKwh));

    var totalLoadKwh = 0;
    var totalPvGenKwh = 0;
    var totalBatteryChargedKwh = 0;
    var totalBatteryDischargedKwh = 0;
    var totalGridImportKwh = 0;
    var totalGridExportKwh = 0;
    var totalUnservedKwh = 0;
    var dailyElectricityCostEur = 0;
    var dailyGridRevenueEur = 0;

    for (var t = 0; t < hourlyData.length; t++) {
      var point = hourlyData[t];
      var loadKw = Math.max(0, point.loadKw);
      var pvGenKw = Math.max(0, point.pvNormKwPerKwc * params.pvInstalledKwc);
      var cmdKw = point.batteryDispatchCmdKw; // >0 charge, <0 decharge

      var actualBattKw = 0;
      var limitReason = 'none';

      if (cmdKw > 0) {
        // Demande de charge
        var energyRoomKwh = Math.max(0, eMax - currentEnergyKwh);
        var maxEnergyLimitPowerC = energyRoomKwh / (etaCharge * 1.0); // pas de temps = 1h

        var achievableCharge = Math.min(cmdKw, pBattMax, maxEnergyLimitPowerC);
        actualBattKw = Math.max(0, achievableCharge);

        if (actualBattKw < cmdKw) {
          if (cmdKw > pBattMax && pBattMax <= maxEnergyLimitPowerC) {
            limitReason = 'max_charge_power';
          } else {
            limitReason = 'full';
          }
        }

        currentEnergyKwh = Math.min(eMax, currentEnergyKwh + actualBattKw * etaCharge * 1.0);
        totalBatteryChargedKwh += actualBattKw;
      } else if (cmdKw < 0) {
        // Demande de decharge
        var reqDischarge = Math.abs(cmdKw);
        var energyAvailKwh = Math.max(0, currentEnergyKwh - eMin);
        var maxEnergyLimitPowerD = (energyAvailKwh * etaDischarge) / 1.0; // livre sur le bus AC

        var achievableDischarge = Math.min(reqDischarge, pBattMax, maxEnergyLimitPowerD);
        actualBattKw = -Math.max(0, achievableDischarge);

        if (achievableDischarge < reqDischarge) {
          if (reqDischarge > pBattMax && pBattMax <= maxEnergyLimitPowerD) {
            limitReason = 'max_discharge_power';
          } else {
            limitReason = 'empty';
          }
        }

        currentEnergyKwh = Math.max(eMin, currentEnergyKwh - (achievableDischarge / etaDischarge) * 1.0);
        totalBatteryDischargedKwh += achievableDischarge;
      }

      var socPercent = (currentEnergyKwh / eCap) * 100;

      // Bilan de puissance sur le bus AC :
      // demande nette = charge + charge batterie - PV - decharge batterie
      var netDemandKw = loadKw + actualBattKw - pvGenKw;

      var gridImportKw = 0;
      var gridExportKw = 0;
      var unservedLoadKw = 0;

      if (netDemandKw > 0) {
        if (netDemandKw <= params.gridMaxPowerKw) {
          gridImportKw = netDemandKw;
        } else {
          // Raccordement insuffisant pour alimenter la charge
          gridImportKw = params.gridMaxPowerKw;
          unservedLoadKw = netDemandKw - params.gridMaxPowerKw;
          hoursWithDeficit.push(t);
        }
      } else if (netDemandKw < 0) {
        gridExportKw = Math.min(-netDemandKw, params.gridMaxInjectionKw);
      }

      var spotEurPerMwh = point.spotPriceEurPerMwh;
      var spotEurPerKwh = spotEurPerMwh / 1000;
      var feedInPriceEurPerKwh = params.feedInMode === 'spot'
        ? Math.max(0, spotEurPerKwh)
        : params.feedInTariffEurPerMwh / 1000;

      var importCost = gridImportKw * spotEurPerKwh;
      var exportRev = gridExportKw * feedInPriceEurPerKwh;

      totalLoadKwh += loadKw;
      totalPvGenKwh += pvGenKw;
      totalGridImportKwh += gridImportKw;
      totalGridExportKwh += gridExportKw;
      totalUnservedKwh += unservedLoadKw;
      dailyElectricityCostEur += importCost;
      dailyGridRevenueEur += exportRev;

      steps.push({
        hour: t,
        label: point.label,
        loadKw: loadKw,
        pvGenKw: pvGenKw,
        batteryCmdKw: cmdKw,
        batteryActualKw: actualBattKw,
        batterySocKwh: currentEnergyKwh,
        batterySocPercent: socPercent,
        gridImportKw: gridImportKw,
        gridExportKw: gridExportKw,
        spotPriceEurPerMwh: spotEurPerMwh,
        spotPriceEurPerKwh: spotEurPerKwh,
        costEur: importCost - exportRev,
        unservedLoadKw: unservedLoadKw,
        isDeficit: unservedLoadKw > 0.05,
        batteryLimitedReason: limitReason
      });
    }

    // Investissements
    var pvCapexEur = params.pvInstalledKwc * params.pvCapexPerKwc;
    var batteryCapexCapacityEur = params.batteryCapacityKwh * params.batteryCapexPerKwh;
    var batteryCapexPowerEur = params.batteryPowerKw * params.batteryCapexPerKw;
    var batteryTotalCapexEur = batteryCapexCapacityEur + batteryCapexPowerEur;

    // Indicateurs de performance
    var pvLocallyUsedKwh = Math.max(0, totalPvGenKwh - totalGridExportKwh);
    var selfConsumptionRate = totalPvGenKwh > 0
      ? Math.min(100, Math.max(0, (pvLocallyUsedKwh / totalPvGenKwh) * 100))
      : 0;

    var loadCoveredLocallyKwh = Math.max(0, totalLoadKwh - totalGridImportKwh - totalUnservedKwh);
    var selfSufficiencyRate = totalLoadKwh > 0
      ? Math.min(100, Math.max(0, (loadCoveredLocallyKwh / totalLoadKwh) * 100))
      : 0;

    var summary = {
      totalLoadKwh: totalLoadKwh,
      totalPvGenKwh: totalPvGenKwh,
      totalBatteryChargedKwh: totalBatteryChargedKwh,
      totalBatteryDischargedKwh: totalBatteryDischargedKwh,
      totalGridImportKwh: totalGridImportKwh,
      totalGridExportKwh: totalGridExportKwh,
      totalUnservedKwh: totalUnservedKwh,
      hoursWithDeficit: hoursWithDeficit,
      pvCapexEur: pvCapexEur,
      batteryCapexCapacityEur: batteryCapexCapacityEur,
      batteryCapexPowerEur: batteryCapexPowerEur,
      batteryTotalCapexEur: batteryTotalCapexEur,
      totalCapexEur: pvCapexEur + batteryTotalCapexEur,
      dailyElectricityCostEur: dailyElectricityCostEur,
      dailyGridRevenueEur: dailyGridRevenueEur,
      dailyNetCostEur: dailyElectricityCostEur - dailyGridRevenueEur,
      selfConsumptionRatePercent: selfConsumptionRate,
      selfSufficiencyRatePercent: selfSufficiencyRate
    };

    return { steps: steps, summary: summary };
  }

  global.MGEngine = { runMicrogridSimulation: runMicrogridSimulation };
})(window);
