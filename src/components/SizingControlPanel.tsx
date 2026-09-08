import React from 'react';
import { Sun, Battery, Activity, Settings2, RotateCcw, Info } from 'lucide-react';
import { MicrogridParameters } from '../types';
import { DEFAULT_MICROGRID_PARAMETERS } from '../utils/defaultData';

interface SizingControlPanelProps {
  params: MicrogridParameters;
  onChangeParams: (newParams: MicrogridParameters) => void;
  pvCapexEur: number;
  batteryTotalCapexEur: number;
  totalCapexEur: number;
}

export const SizingControlPanel: React.FC<SizingControlPanelProps> = ({
  params,
  onChangeParams,
  pvCapexEur,
  batteryTotalCapexEur,
  totalCapexEur
}) => {
  const update = <K extends keyof MicrogridParameters>(field: K, value: MicrogridParameters[K]) => {
    onChangeParams({
      ...params,
      [field]: value
    });
  };

  const resetDefaults = () => {
    onChangeParams({ ...DEFAULT_MICROGRID_PARAMETERS });
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-6">
        <div className="flex items-center gap-2.5">
          <Settings2 className="w-5 h-5 text-emerald-400" />
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-slate-100">
              Dimensionnement Technique & Économique (CAPEX)
            </h2>
            <p className="text-xs text-slate-400">
              Ajustez les capacités installées, les limites physiques et les coûts d'investissement.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs text-slate-400">Total Investissement CAPEX</div>
            <div className="text-sm sm:text-base font-mono font-bold text-emerald-400">
              {totalCapexEur.toLocaleString('fr-FR')} €
            </div>
          </div>
          <button
            onClick={resetDefaults}
            title="Rétablir les valeurs par défaut"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 text-xs transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Réinitialiser
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PV SIZING */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <Sun className="w-4 h-4" /> Centrale Photovoltaïque (PV)
            </div>
            <span className="text-xs font-mono text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/60">
              CAPEX: {pvCapexEur.toLocaleString('fr-FR')} €
            </span>
          </div>

          {/* PV Installed capacity slider & input */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <label htmlFor="pv-installed-input" className="text-slate-300 font-medium">Puissance PV Installée :</label>
              <span className="font-mono font-bold text-amber-400">{params.pvInstalledKwc} kWc</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="pv-installed-slider"
                type="range"
                min="0"
                max="150"
                step="5"
                value={params.pvInstalledKwc}
                onChange={(e) => update('pvInstalledKwc', parseFloat(e.target.value) || 0)}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <input
                id="pv-installed-input"
                type="number"
                min="0"
                max="500"
                step="1"
                value={params.pvInstalledKwc}
                onChange={(e) => update('pvInstalledKwc', Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-right text-slate-100"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              La prévision de production 24h est recalculée en direct selon la courbe normalisée.
            </p>
          </div>

          {/* PV Cost per kWc */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
            <div className="flex justify-between text-xs">
              <label htmlFor="pv-capex-input" className="text-slate-300">Coût d'installation PV :</label>
              <span className="font-mono text-slate-300">{params.pvCapexPerKwc} € / kWc</span>
            </div>
            <input
              id="pv-capex-input"
              type="number"
              min="200"
              max="3000"
              step="50"
              value={params.pvCapexPerKwc}
              onChange={(e) => update('pvCapexPerKwc', Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-100"
            />
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Info className="w-3 h-3 shrink-0" /> Valeur par défaut : 1 200 €/kWc (paramétrable).
            </span>
          </div>
        </div>

        {/* BATTERY SIZING */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2 text-teal-400 font-semibold text-sm">
              <Battery className="w-4 h-4" /> Système Batterie (BESS)
            </div>
            <span className="text-xs font-mono text-teal-300 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800/60">
              CAPEX: {batteryTotalCapexEur.toLocaleString('fr-FR')} €
            </span>
          </div>

          {/* Battery Capacity (kWh) */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <label htmlFor="battery-capacity-input" className="text-slate-300 font-medium">Capacité Stockage :</label>
              <span className="font-mono font-bold text-teal-400">{params.batteryCapacityKwh} kWh</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="battery-capacity-slider"
                type="range"
                min="0"
                max="200"
                step="5"
                value={params.batteryCapacityKwh}
                onChange={(e) => update('batteryCapacityKwh', parseFloat(e.target.value) || 0)}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
              />
              <input
                id="battery-capacity-input"
                type="number"
                min="0"
                max="500"
                step="5"
                value={params.batteryCapacityKwh}
                onChange={(e) => update('batteryCapacityKwh', Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-right text-slate-100"
              />
            </div>
          </div>

          {/* Battery Max Power (kW) */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <label htmlFor="battery-power-input" className="text-slate-300 font-medium">Puissance Max Onduleur :</label>
              <span className="font-mono font-bold text-teal-400">{params.batteryPowerKw} kW</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="battery-power-slider"
                type="range"
                min="0"
                max="100"
                step="2"
                value={params.batteryPowerKw}
                onChange={(e) => update('batteryPowerKw', parseFloat(e.target.value) || 0)}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
              />
              <input
                id="battery-power-input"
                type="number"
                min="0"
                max="250"
                step="1"
                value={params.batteryPowerKw}
                onChange={(e) => update('batteryPowerKw', Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-right text-slate-100"
              />
            </div>
          </div>

          {/* Efficiency & Unit Costs */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/60">
            <div>
              <label htmlFor="battery-capex-kwh-input" className="text-[11px] text-slate-400 block mb-1">Coût Capacité (€/kWh) :</label>
              <input
                id="battery-capex-kwh-input"
                type="number"
                min="50"
                max="1000"
                step="25"
                value={params.batteryCapexPerKwh}
                onChange={(e) => update('batteryCapexPerKwh', Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="battery-capex-kw-input" className="text-[11px] text-slate-400 block mb-1">Coût Puissance (€/kW) :</label>
              <input
                id="battery-capex-kw-input"
                type="number"
                min="30"
                max="600"
                step="10"
                value={params.batteryCapexPerKw}
                onChange={(e) => update('batteryCapexPerKw', Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-100"
              />
            </div>
          </div>

          {/* Efficiency & SOC initial */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="battery-efficiency-input" className="text-[11px] text-slate-400 block mb-1">Rendement global (%) :</label>
              <input
                id="battery-efficiency-input"
                type="number"
                min="50"
                max="99"
                step="1"
                value={params.batteryEfficiencyPercent}
                onChange={(e) => update('batteryEfficiencyPercent', Math.min(99, Math.max(50, parseFloat(e.target.value) || 90)))}
                className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="battery-initial-soc-input" className="text-[11px] text-slate-400 block mb-1">SOC Initial t=0 (%) :</label>
              <input
                id="battery-initial-soc-input"
                type="number"
                min="0"
                max="100"
                step="5"
                value={params.batteryInitialSocPercent}
                onChange={(e) => update('batteryInitialSocPercent', Math.min(100, Math.max(0, parseFloat(e.target.value) || 40)))}
                className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-100"
              />
            </div>
          </div>
        </div>

        {/* GRID LIMIT & CONSTRAINTS */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
              <Activity className="w-4 h-4" /> Raccordement Réseau
            </div>
            <span className="text-xs font-mono text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/60">
              Max {params.gridMaxPowerKw} kW
            </span>
          </div>

          {/* Grid max import power limit */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <label htmlFor="grid-max-power-input" className="text-slate-300 font-medium">Puissance Max de Raccordement :</label>
              <span className="font-mono font-bold text-indigo-400">{params.gridMaxPowerKw} kW</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="grid-max-power-slider"
                type="range"
                min="5"
                max="120"
                step="2"
                value={params.gridMaxPowerKw}
                onChange={(e) => update('gridMaxPowerKw', parseFloat(e.target.value) || 0)}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400"
              />
              <input
                id="grid-max-power-input"
                type="number"
                min="1"
                max="250"
                step="1"
                value={params.gridMaxPowerKw}
                onChange={(e) => update('gridMaxPowerKw', Math.max(1, parseFloat(e.target.value) || 10))}
                className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-right text-slate-100"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Si la somme (PV + batterie + raccordement) est inférieure à la charge, un message d'alerte s'affiche sur la charge.
            </p>
          </div>

          {/* Grid injection limit */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
            <div className="flex justify-between text-xs">
              <label htmlFor="grid-max-injection-input" className="text-slate-300">Limite d'injection Réseau :</label>
              <span className="font-mono text-slate-300">{params.gridMaxInjectionKw} kW</span>
            </div>
            <input
              id="grid-max-injection-input"
              type="number"
              min="0"
              max="150"
              step="5"
              value={params.gridMaxInjectionKw}
              onChange={(e) => update('gridMaxInjectionKw', Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-100"
            />
          </div>

          {/* Feed-in Tariff compensation mode */}
          <div className="space-y-1.5">
            <label htmlFor="feed-in-mode-select" className="text-xs text-slate-300 block">Rémunération du surplus injecté :</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => update('feedInMode', 'spot')}
                className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                  params.feedInMode === 'spot'
                    ? 'bg-indigo-600 text-white border-indigo-500 font-medium'
                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                Vente au SPOT
              </button>
              <button
                type="button"
                onClick={() => update('feedInMode', 'fixed')}
                className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                  params.feedInMode === 'fixed'
                    ? 'bg-indigo-600 text-white border-indigo-500 font-medium'
                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                Tarif fixe (70 €/MWh)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
