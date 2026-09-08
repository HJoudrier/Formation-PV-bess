import React, { useState } from 'react';
import { Sliders, Sparkles, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, BatteryCharging, Zap } from 'lucide-react';
import { HourlyDataPoint, MicrogridParameters, SimulationStepResult } from '../types';
import { applyDispatchStrategy } from '../utils/dispatchStrategies';

interface BatteryDispatchEditorProps {
  hourlyData: HourlyDataPoint[];
  steps: SimulationStepResult[];
  params: MicrogridParameters;
  onUpdateHourlyData: (data: HourlyDataPoint[]) => void;
  selectedHour: number;
  onSelectHour: (h: number) => void;
}

export const BatteryDispatchEditor: React.FC<BatteryDispatchEditorProps> = ({
  hourlyData,
  steps,
  params,
  onUpdateHourlyData,
  selectedHour,
  onSelectHour
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const applyStrategy = (strat: 'self_consumption' | 'peak_shaving' | 'spot_arbitrage' | 'zero_injection' | 'reset') => {
    const updated = applyDispatchStrategy(hourlyData, params, strat);
    onUpdateHourlyData(updated);
  };

  const handleCommandChange = (hour: number, value: number) => {
    const updated = hourlyData.map((pt) => {
      if (pt.hour === hour) {
        return {
          ...pt,
          batteryDispatchCmdKw: value
        };
      }
      return pt;
    });
    onUpdateHourlyData(updated);
  };

  const activeStep = steps[selectedHour] || steps[0];
  const pMax = params.batteryPowerKw;

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-6 shadow-xl text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-teal-500/20 text-teal-400 rounded-lg border border-teal-500/30 shrink-0">
            <BatteryCharging className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-slate-100">
              Pilotage & Planification de la Batterie
            </h2>
            <p className="text-xs text-slate-400">
              Consignes 24h en kW (&gt;0 charge, &lt;0 décharge) respectant les limites physiques et de puissance.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="self-start sm:self-center flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 touch-manipulation transition-colors"
        >
          {isExpanded ? (
            <>
              Masquer tableau 24h <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              Afficher tableau 24h <ChevronDown className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* STRATEGY PRESET BUTTONS */}
      <div className="bg-slate-950/80 p-3 sm:p-4 rounded-xl border border-slate-800 mb-4">
        <div className="flex items-center gap-2 mb-2.5 text-xs text-slate-300 font-medium">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Stratégies automatiques de pilotage assisté :</span>
        </div>

        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <button
            onClick={() => applyStrategy('self_consumption')}
            className="px-2.5 sm:px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-700/60 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 touch-manipulation"
          >
            ☀️ Autoconsommation
          </button>
          <button
            onClick={() => applyStrategy('spot_arbitrage')}
            className="px-2.5 sm:px-3 py-1.5 bg-indigo-950/80 hover:bg-indigo-900/90 text-indigo-300 border border-indigo-700/60 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 touch-manipulation"
          >
            📉 Arbitrage SPOT
          </button>
          <button
            onClick={() => applyStrategy('peak_shaving')}
            className="px-2.5 sm:px-3 py-1.5 bg-sky-950/80 hover:bg-sky-900/90 text-sky-300 border border-sky-700/60 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 touch-manipulation"
          >
            ⚡ Écrêtage Réseau
          </button>
          <button
            onClick={() => applyStrategy('zero_injection')}
            className="px-2.5 sm:px-3 py-1.5 bg-amber-950/80 hover:bg-amber-900/90 text-amber-300 border border-amber-700/60 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 touch-manipulation"
          >
            🚫 Zéro Injection
          </button>
          <button
            onClick={() => applyStrategy('reset')}
            className="px-2.5 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium transition-colors touch-manipulation"
          >
            Mise en veille (0 kW)
          </button>
        </div>
      </div>

      {/* MOBILE & TACTILE QUICK-DISPATCH CARD FOR ACTIVE HOUR */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-3.5 sm:p-4 rounded-xl border border-teal-800/40 mb-4 shadow-lg">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelectHour(selectedHour === 0 ? 23 : selectedHour - 1)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 touch-manipulation"
              title="Heure précédente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-sm sm:text-base font-bold text-teal-300 bg-teal-950/80 px-2.5 py-0.5 rounded-md border border-teal-800/80">
              Heure {activeStep.label}
            </span>
            <button
              onClick={() => onSelectHour(selectedHour === 23 ? 0 : selectedHour + 1)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 touch-manipulation"
              title="Heure suivante"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">SOC :</span>
            <span className="text-teal-300 font-bold">{activeStep.batterySocPercent.toFixed(0)}%</span>
            <span className="text-slate-500 text-[11px] hidden xs:inline">({activeStep.batterySocKwh.toFixed(1)} kWh)</span>
          </div>
        </div>

        {/* Snapshot metrics for the active hour */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono mb-3">
          <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400">Consommation</div>
            <div className="font-bold text-orange-400">{activeStep.loadKw.toFixed(1)} kW</div>
          </div>
          <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400">Solaire PV</div>
            <div className="font-bold text-amber-400">{activeStep.pvGenKw.toFixed(1)} kW</div>
          </div>
          <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400">Prix SPOT</div>
            <div className="font-bold text-indigo-300">{activeStep.spotPriceEurPerMwh.toFixed(1)} €</div>
          </div>
        </div>

        {/* Large Tactile Slider for the Command */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium">Consigne de puissance batterie :</span>
            <div className="flex items-center gap-2 font-mono">
              <span className={`font-bold ${activeStep.batteryCmdKw > 0 ? 'text-teal-400' : activeStep.batteryCmdKw < 0 ? 'text-cyan-400' : 'text-slate-400'}`}>
                {activeStep.batteryCmdKw > 0 ? `+${activeStep.batteryCmdKw.toFixed(1)} kW (Charge)` : activeStep.batteryCmdKw < 0 ? `${activeStep.batteryCmdKw.toFixed(1)} kW (Décharge)` : '0.0 kW (Veille)'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-cyan-400 w-12 text-right">-{pMax}</span>
            <input
              type="range"
              min={-pMax}
              max={pMax}
              step={1}
              value={activeStep.batteryCmdKw}
              onChange={(e) => handleCommandChange(selectedHour, parseFloat(e.target.value) || 0)}
              className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400 touch-manipulation"
            />
            <span className="text-xs font-mono text-teal-400 w-12">+{pMax}</span>
            <input
              type="number"
              min={-pMax}
              max={pMax}
              step={1}
              value={activeStep.batteryCmdKw}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                handleCommandChange(selectedHour, isNaN(val) ? 0 : Math.max(-pMax, Math.min(pMax, val)));
              }}
              className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-xs font-mono text-slate-100"
            />
          </div>

          {/* Tactile quick-step buttons (ideal for mobile phone thumbs!) */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
            <div className="flex items-center gap-1 text-xs">
              <button
                onClick={() => handleCommandChange(selectedHour, -pMax)}
                className="px-2 py-1 bg-cyan-950 text-cyan-300 hover:bg-cyan-900 border border-cyan-800/80 rounded text-[11px] font-mono touch-manipulation"
              >
                Max Déch (-{pMax})
              </button>
              <button
                onClick={() => handleCommandChange(selectedHour, Math.max(-pMax, activeStep.batteryCmdKw - 5))}
                className="px-2 py-1 bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 rounded text-[11px] font-mono touch-manipulation"
              >
                -5 kW
              </button>
            </div>

            <button
              onClick={() => handleCommandChange(selectedHour, 0)}
              className="px-2.5 py-1 bg-slate-800 text-slate-300 hover:text-white border border-slate-700 rounded text-[11px] font-mono touch-manipulation"
            >
              Veille (0 kW)
            </button>

            <div className="flex items-center gap-1 text-xs">
              <button
                onClick={() => handleCommandChange(selectedHour, Math.min(pMax, activeStep.batteryCmdKw + 5))}
                className="px-2 py-1 bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 rounded text-[11px] font-mono touch-manipulation"
              >
                +5 kW
              </button>
              <button
                onClick={() => handleCommandChange(selectedHour, pMax)}
                className="px-2 py-1 bg-teal-950 text-teal-300 hover:bg-teal-900 border border-teal-800/80 rounded text-[11px] font-mono touch-manipulation"
              >
                Max Chg (+{pMax})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 24-HOUR HOURLY DISPATCH MATRIX */}
      {isExpanded && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs border-collapse font-mono min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/70">
                <th className="py-2.5 px-3">Heure</th>
                <th className="py-2.5 px-2">Charge (kW)</th>
                <th className="py-2.5 px-2">PV (kW)</th>
                <th className="py-2.5 px-2">Prix SPOT</th>
                <th className="py-2.5 px-3 min-w-[200px]">Consigne Pilotage (-Décharge / +Charge)</th>
                <th className="py-2.5 px-2">Puissance Réelle</th>
                <th className="py-2.5 px-2">SOC Fin Heure</th>
                <th className="py-2.5 px-2">Statut Physique</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {steps.map((s) => {
                const isSelected = s.hour === selectedHour;
                const isLimited = s.batteryLimitedReason && s.batteryLimitedReason !== 'none';
                const pMax = params.batteryPowerKw;

                return (
                  <tr
                    key={s.hour}
                    onClick={() => onSelectHour(s.hour)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-emerald-950/40 text-emerald-200'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <td className="py-2 px-3 font-semibold text-slate-200 flex items-center gap-1.5">
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                      {s.label}
                    </td>
                    <td className="py-2 px-2 text-orange-400">{s.loadKw.toFixed(1)}</td>
                    <td className="py-2 px-2 text-amber-400">{s.pvGenKw.toFixed(1)}</td>
                    <td className="py-2 px-2 text-indigo-300">{s.spotPriceEurPerMwh.toFixed(1)} €</td>

                    {/* Interactive Slider & Number Input for Command */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[10px] text-cyan-400 w-8 text-right">-{pMax}</span>
                        <input
                          type="range"
                          min={-pMax}
                          max={pMax}
                          step={1}
                          value={s.batteryCmdKw}
                          onChange={(e) => handleCommandChange(s.hour, parseFloat(e.target.value) || 0)}
                          className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-teal-400"
                        />
                        <span className="text-[10px] text-teal-400 w-8">+{pMax}</span>
                        <input
                          type="number"
                          min={-pMax}
                          max={pMax}
                          step={1}
                          value={s.batteryCmdKw}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            handleCommandChange(s.hour, isNaN(val) ? 0 : Math.max(-pMax, Math.min(pMax, val)));
                          }}
                          className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-center text-xs text-slate-100"
                        />
                      </div>
                    </td>

                    {/* Actual Physical Power */}
                    <td className="py-2 px-2 font-bold">
                      {s.batteryActualKw > 0 ? (
                        <span className="text-teal-400">+{s.batteryActualKw.toFixed(1)} kW</span>
                      ) : s.batteryActualKw < 0 ? (
                        <span className="text-cyan-400">{s.batteryActualKw.toFixed(1)} kW</span>
                      ) : (
                        <span className="text-slate-500">0.0 kW</span>
                      )}
                    </td>

                    {/* Resulting SOC */}
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-200">{s.batterySocPercent.toFixed(0)}%</span>
                        <span className="text-[10px] text-slate-400">({s.batterySocKwh.toFixed(1)} kWh)</span>
                      </div>
                    </td>

                    {/* Constraint badge */}
                    <td className="py-2 px-2">
                      {isLimited ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-950/80 text-amber-300 border border-amber-800/60">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          {s.batteryLimitedReason === 'full' && 'Plafond SOC Max'}
                          {s.batteryLimitedReason === 'empty' && 'Seuil SOC Min'}
                          {s.batteryLimitedReason === 'max_charge_power' && 'Bride P_charge'}
                          {s.batteryLimitedReason === 'max_discharge_power' && 'Bride P_décharge'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400/80">
                          <CheckCircle2 className="w-3 h-3" /> Nominal
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
