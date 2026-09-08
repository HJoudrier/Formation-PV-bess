import { HourlyDataPoint, MicrogridParameters, SimulationStepResult, SimulationSummary } from '../types';

export function runMicrogridSimulation(
  hourlyData: HourlyDataPoint[],
  params: MicrogridParameters
): {
  steps: SimulationStepResult[];
  summary: SimulationSummary;
} {
  const steps: SimulationStepResult[] = [];
  const hoursWithDeficit: number[] = [];

  // Efficiencies
  const roundTrip = Math.max(0.01, Math.min(1.0, params.batteryEfficiencyPercent / 100));
  const etaCharge = Math.sqrt(roundTrip);
  const etaDischarge = Math.sqrt(roundTrip);

  const eCap = Math.max(0.1, params.batteryCapacityKwh);
  const eMin = (Math.max(0, Math.min(100, params.batterySocMinPercent)) / 100) * eCap;
  const eMax = (Math.max(0, Math.min(100, params.batterySocMaxPercent)) / 100) * eCap;
  const pBattMax = Math.max(0, params.batteryPowerKw);

  // Initial battery energy
  let currentEnergyKwh = (Math.max(0, Math.min(100, params.batteryInitialSocPercent)) / 100) * eCap;
  currentEnergyKwh = Math.max(eMin, Math.min(eMax, currentEnergyKwh));

  let totalLoadKwh = 0;
  let totalPvGenKwh = 0;
  let totalBatteryChargedKwh = 0;
  let totalBatteryDischargedKwh = 0;
  let totalGridImportKwh = 0;
  let totalGridExportKwh = 0;
  let totalUnservedKwh = 0;
  let dailyElectricityCostEur = 0;
  let dailyGridRevenueEur = 0;

  for (let t = 0; t < hourlyData.length; t++) {
    const point = hourlyData[t];
    const loadKw = Math.max(0, point.loadKw);
    const pvGenKw = Math.max(0, point.pvNormKwPerKwc * params.pvInstalledKwc);
    const cmdKw = point.batteryDispatchCmdKw; // >0 charge, <0 discharge

    let actualBattKw = 0;
    let limitReason: SimulationStepResult['batteryLimitedReason'] = 'none';

    if (cmdKw > 0) {
      // Charge request
      const maxPowerLimit = pBattMax;
      const energyRoomKwh = Math.max(0, eMax - currentEnergyKwh);
      const maxEnergyLimitPower = energyRoomKwh / (etaCharge * 1.0); // 1h dt

      const achievableCharge = Math.min(cmdKw, maxPowerLimit, maxEnergyLimitPower);
      actualBattKw = Math.max(0, achievableCharge);

      if (actualBattKw < cmdKw) {
        if (cmdKw > maxPowerLimit && maxPowerLimit <= maxEnergyLimitPower) {
          limitReason = 'max_charge_power';
        } else {
          limitReason = 'full';
        }
      }

      const energyAdded = actualBattKw * etaCharge * 1.0;
      currentEnergyKwh = Math.min(eMax, currentEnergyKwh + energyAdded);
      totalBatteryChargedKwh += actualBattKw;
    } else if (cmdKw < 0) {
      // Discharge request
      const reqDischarge = Math.abs(cmdKw);
      const maxPowerLimit = pBattMax;
      const energyAvailKwh = Math.max(0, currentEnergyKwh - eMin);
      const maxEnergyLimitPower = energyAvailKwh * etaDischarge / 1.0; // delivered to AC bus

      const achievableDischarge = Math.min(reqDischarge, maxPowerLimit, maxEnergyLimitPower);
      actualBattKw = -Math.max(0, achievableDischarge);

      if (achievableDischarge < reqDischarge) {
        if (reqDischarge > maxPowerLimit && maxPowerLimit <= maxEnergyLimitPower) {
          limitReason = 'max_discharge_power';
        } else {
          limitReason = 'empty';
        }
      }

      const energyRemoved = (achievableDischarge / etaDischarge) * 1.0;
      currentEnergyKwh = Math.max(eMin, currentEnergyKwh - energyRemoved);
      totalBatteryDischargedKwh += achievableDischarge;
    } else {
      // Idle
      actualBattKw = 0;
      limitReason = 'none';
    }

    const socPercent = (currentEnergyKwh / eCap) * 100;

    // Power balance on AC bus:
    // Net demand from grid = Load + BatteryCharge - PV - BatteryDischarge
    // Notice actualBattKw > 0 is charge (demand), actualBattKw < 0 is discharge (supply)
    const netDemandKw = loadKw + actualBattKw - pvGenKw;

    let gridImportKw = 0;
    let gridExportKw = 0;
    let unservedLoadKw = 0;

    if (netDemandKw > 0) {
      // Need import from grid
      if (netDemandKw <= params.gridMaxPowerKw) {
        gridImportKw = netDemandKw;
      } else {
        // Grid connection is insufficient to supply the load!
        gridImportKw = params.gridMaxPowerKw;
        unservedLoadKw = netDemandKw - params.gridMaxPowerKw;
        hoursWithDeficit.push(t);
      }
    } else if (netDemandKw < 0) {
      // Surplus to export
      const surplus = -netDemandKw;
      gridExportKw = Math.min(surplus, params.gridMaxInjectionKw);
    }

    const spotEurPerMwh = point.spotPriceEurPerMwh;
    const spotEurPerKwh = spotEurPerMwh / 1000;
    const feedInPriceEurPerKwh = params.feedInMode === 'spot' 
      ? Math.max(0, spotEurPerKwh) 
      : (params.feedInTariffEurPerMwh / 1000);

    const importCost = gridImportKw * spotEurPerKwh;
    const exportRev = gridExportKw * feedInPriceEurPerKwh;
    const stepCostEur = importCost - exportRev;

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
      loadKw,
      pvGenKw,
      batteryCmdKw: cmdKw,
      batteryActualKw: actualBattKw,
      batterySocKwh: currentEnergyKwh,
      batterySocPercent: socPercent,
      gridImportKw,
      gridExportKw,
      spotPriceEurPerMwh: spotEurPerMwh,
      spotPriceEurPerKwh: spotEurPerKwh,
      costEur: stepCostEur,
      unservedLoadKw,
      isDeficit: unservedLoadKw > 0.05,
      batteryLimitedReason: limitReason
    });
  }

  // Financial calculations
  const pvCapexEur = params.pvInstalledKwc * params.pvCapexPerKwc;
  const batteryCapexCapacityEur = params.batteryCapacityKwh * params.batteryCapexPerKwh;
  const batteryCapexPowerEur = params.batteryPowerKw * params.batteryCapexPerKw;
  const batteryTotalCapexEur = batteryCapexCapacityEur + batteryCapexPowerEur;
  const totalCapexEur = pvCapexEur + batteryTotalCapexEur;
  const dailyNetCostEur = dailyElectricityCostEur - dailyGridRevenueEur;

  // Key Performance Indicators (KPIs)
  // Self-consumption: PV consumed locally (directly by load + stored into battery) vs total PV
  const pvExportedKwh = totalGridExportKwh;
  const pvLocallyUsedKwh = Math.max(0, totalPvGenKwh - pvExportedKwh);
  const selfConsumptionRate = totalPvGenKwh > 0 
    ? Math.min(100, Math.max(0, (pvLocallyUsedKwh / totalPvGenKwh) * 100))
    : 0;

  // Self-sufficiency: Load covered by local generation (PV direct + battery discharge) vs total load
  const loadCoveredByGridKwh = totalGridImportKwh;
  const loadCoveredLocallyKwh = Math.max(0, totalLoadKwh - loadCoveredByGridKwh - totalUnservedKwh);
  const selfSufficiencyRate = totalLoadKwh > 0
    ? Math.min(100, Math.max(0, (loadCoveredLocallyKwh / totalLoadKwh) * 100))
    : 0;

  const summary: SimulationSummary = {
    totalLoadKwh,
    totalPvGenKwh,
    totalBatteryChargedKwh,
    totalBatteryDischargedKwh,
    totalGridImportKwh,
    totalGridExportKwh,
    totalUnservedKwh,
    hoursWithDeficit,
    pvCapexEur,
    batteryCapexCapacityEur,
    batteryCapexPowerEur,
    batteryTotalCapexEur,
    totalCapexEur,
    dailyElectricityCostEur,
    dailyGridRevenueEur,
    dailyNetCostEur,
    selfConsumptionRatePercent: selfConsumptionRate,
    selfSufficiencyRatePercent: selfSufficiencyRate
  };

  return { steps, summary };
}
