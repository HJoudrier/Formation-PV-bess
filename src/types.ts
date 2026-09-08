export interface HourlyDataPoint {
  hour: number; // 0 to 23
  label: string; // "00:00", "01:00", etc.
  loadKw: number; // Consumption of unmanaged load (kW)
  pvNormKwPerKwc: number; // Normalized solar production (kW/kWc)
  spotPriceEurPerMwh: number; // Day-ahead SPOT price (€/MWh)
  batteryDispatchCmdKw: number; // Commanded battery power (>0 charge, <0 discharge, 0 idle)
}

export interface SimulationStepResult {
  hour: number;
  label: string;
  loadKw: number;
  pvGenKw: number; // pvNorm * installedPvKwc
  batteryCmdKw: number;
  batteryActualKw: number; // Actual applied power after physical constraints (>0 charge, <0 discharge)
  batterySocKwh: number; // Stored energy at end of hour (kWh)
  batterySocPercent: number; // SOC in % (0 - 100)
  gridImportKw: number; // Power drawn from the grid (>= 0)
  gridExportKw: number; // Surplus injected into grid (>= 0)
  spotPriceEurPerMwh: number;
  spotPriceEurPerKwh: number;
  costEur: number; // Net electricity cost for this hour (import * spot - export * feedIn)
  unservedLoadKw: number; // Load power deficit if grid limit exceeded (kW)
  isDeficit: boolean;
  batteryLimitedReason?: 'max_charge_power' | 'max_discharge_power' | 'full' | 'empty' | 'none';
}

export interface SimulationSummary {
  totalLoadKwh: number;
  totalPvGenKwh: number;
  totalBatteryChargedKwh: number;
  totalBatteryDischargedKwh: number;
  totalGridImportKwh: number;
  totalGridExportKwh: number;
  totalUnservedKwh: number;
  hoursWithDeficit: number[];
  
  // Financials
  pvCapexEur: number;
  batteryCapexCapacityEur: number;
  batteryCapexPowerEur: number;
  batteryTotalCapexEur: number;
  totalCapexEur: number;
  
  dailyElectricityCostEur: number; // OPEX day-ahead
  dailyGridRevenueEur: number;
  dailyNetCostEur: number;

  // Key performance indicators (KPIs)
  selfConsumptionRatePercent: number; // Part of PV consumed locally (direct + battery)
  selfSufficiencyRatePercent: number; // Part of load supplied locally (PV + battery)
}

export interface MicrogridParameters {
  // Photovoltaic
  pvInstalledKwc: number; // kWc
  pvCapexPerKwc: number; // €/kWc (default 1200)

  // Battery Storage (BESS)
  batteryCapacityKwh: number; // Capacity (kWh)
  batteryPowerKw: number; // Max charge & discharge power (kW)
  batteryCapexPerKwh: number; // €/kWh (default e.g. 350)
  batteryCapexPerKw: number; // €/kW (default e.g. 150)
  batteryEfficiencyPercent: number; // Round-trip or charge/discharge efficiency (default 92%)
  batterySocMinPercent: number; // Min SOC (e.g. 10%)
  batterySocMaxPercent: number; // Max SOC (e.g. 95%)
  batteryInitialSocPercent: number; // Initial SOC at t=0 (e.g. 50%)

  // Grid Connection
  gridMaxPowerKw: number; // Max import limit from grid (kW)
  gridMaxInjectionKw: number; // Max export limit to grid (kW)
  feedInTariffEurPerMwh: number; // Grid injection compensation (€/MWh, or SPOT)
  feedInMode: 'spot' | 'fixed'; // Sell at SPOT price or fixed tariff
}

export type DispatchStrategy = 
  | 'manual'
  | 'self_consumption' // Charge on solar excess, discharge on deficit
  | 'peak_shaving'     // Discharge when grid power would exceed a threshold
  | 'spot_arbitrage'   // Charge during cheapest hours, discharge during highest SPOT hours
  | 'zero_injection';  // Maximize battery storage when PV would be injected
