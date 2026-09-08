import React from 'react';
import { Coins, TrendingUp, AlertTriangle, CheckCircle, PieChart } from 'lucide-react';
import { SimulationSummary, MicrogridParameters } from '../types';

interface CostSummaryCardProps {
  summary: SimulationSummary;
  params: MicrogridParameters;
}

export const CostSummaryCard: React.FC<CostSummaryCardProps> = ({ summary, params }) => {
  const hasDeficit = summary.hoursWithDeficit.length > 0;

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-5">
        <div className="flex items-center gap-2.5">
          <Coins className="w-5 h-5 text-emerald-400" />
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-slate-100">
              Bilan Énergétique & Économique (24h)
            </h2>
            <p className="text-xs text-slate-400">
              Synthèse globale des investissements (CAPEX), des coûts d'exploitation (OPEX) et de la performance.
            </p>
          </div>
        </div>

        {hasDeficit ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/80 border border-rose-700 text-rose-300 text-xs font-bold animate-pulse">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Non-alimenté : {summary.totalUnservedKwh.toFixed(1)} kWh ({summary.hoursWithDeficit.length} h)</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-xs font-medium">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>100% de la charge alimentée</span>
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        {/* CAPEX TOTAL */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 sm:p-3.5 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Investissement Total (CAPEX)</span>
          <div className="my-1 text-lg sm:text-2xl font-bold font-mono text-emerald-400">
            {summary.totalCapexEur.toLocaleString('fr-FR')} €
          </div>
          <div className="text-[11px] text-slate-400 space-y-0.5 border-t border-slate-800 pt-1.5 mt-1 font-mono">
            <div>PV : {summary.pvCapexEur.toLocaleString('fr-FR')} € ({params.pvInstalledKwc} kWc)</div>
            <div>Batterie : {summary.batteryTotalCapexEur.toLocaleString('fr-FR')} € ({params.batteryCapacityKwh} kWh / {params.batteryPowerKw} kW)</div>
          </div>
        </div>

        {/* OPEX NET 24H */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 sm:p-3.5 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Facture Électricité Réseau (24h)</span>
          <div className={`my-1 text-lg sm:text-2xl font-bold font-mono ${
            summary.dailyNetCostEur <= 0 ? 'text-emerald-400' : 'text-slate-100'
          }`}>
            {summary.dailyNetCostEur.toFixed(2)} € / jour
          </div>
          <div className="text-[11px] text-slate-400 space-y-0.5 border-t border-slate-800 pt-1.5 mt-1 font-mono">
            <div>Achats SPOT : +{summary.dailyElectricityCostEur.toFixed(2)} €</div>
            <div>Revente Surplus : -{summary.dailyGridRevenueEur.toFixed(2)} €</div>
          </div>
        </div>

        {/* AUTOCONSOMMATION */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 sm:p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Taux d'Autoconsommation</span>
            <PieChart className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="my-1 text-lg sm:text-2xl font-bold font-mono text-amber-400">
            {summary.selfConsumptionRatePercent.toFixed(1)}%
          </div>
          <p className="text-[11px] text-slate-400 border-t border-slate-800 pt-1.5 mt-1">
            Part de la production solaire PV consommée localement (directement ou via batterie).
          </p>
        </div>

        {/* AUTONOMIE / COUVERTURE */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 sm:p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Taux d'Autonomie (Solaire + Stock)</span>
            <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
          </div>
          <div className="my-1 text-lg sm:text-2xl font-bold font-mono text-teal-400">
            {summary.selfSufficiencyRatePercent.toFixed(1)}%
          </div>
          <p className="text-[11px] text-slate-400 border-t border-slate-800 pt-1.5 mt-1">
            Part de la charge couverte par les actifs locaux sans dépendre du raccordement réseau.
          </p>
        </div>
      </div>

      {/* DETAILED ENERGY BALANCE ROW */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 text-xs bg-slate-950/50 p-2.5 sm:p-3 rounded-xl border border-slate-800/80 font-mono">
        <div>
          <span className="text-slate-400 block text-[11px]">Consommation Charge</span>
          <span className="text-orange-400 font-bold text-sm">{summary.totalLoadKwh.toFixed(1)} kWh</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[11px]">Production Solaire PV</span>
          <span className="text-amber-400 font-bold text-sm">{summary.totalPvGenKwh.toFixed(1)} kWh</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[11px]">Charge Batterie</span>
          <span className="text-teal-400 font-bold text-sm">{summary.totalBatteryChargedKwh.toFixed(1)} kWh</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[11px]">Décharge Batterie</span>
          <span className="text-cyan-400 font-bold text-sm">{summary.totalBatteryDischargedKwh.toFixed(1)} kWh</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[11px]">Énergie Soutirée Réseau</span>
          <span className="text-indigo-400 font-bold text-sm">{summary.totalGridImportKwh.toFixed(1)} kWh</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[11px]">Surplus Injecté Réseau</span>
          <span className="text-emerald-400 font-bold text-sm">{summary.totalGridExportKwh.toFixed(1)} kWh</span>
        </div>
      </div>
    </div>
  );
};
