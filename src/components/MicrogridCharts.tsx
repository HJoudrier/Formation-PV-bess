import React, { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  CartesianGrid
} from 'recharts';
import { SimulationStepResult, MicrogridParameters } from '../types';
import { Zap, Battery, DollarSign, Layers } from 'lucide-react';

interface MicrogridChartsProps {
  steps: SimulationStepResult[];
  currentHour: number;
  onHourSelect: (hour: number) => void;
  params: MicrogridParameters;
}

export const MicrogridCharts: React.FC<MicrogridChartsProps> = ({
  steps,
  currentHour,
  onHourSelect,
  params
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'balance' | 'soc' | 'prices'>('all');

  // Prepare dataset for charts
  const chartData = steps.map((s) => ({
    hour: s.hour,
    label: s.label,
    load: Math.round(s.loadKw * 10) / 10,
    pv: Math.round(s.pvGenKw * 10) / 10,
    batteryCharge: s.batteryActualKw > 0 ? Math.round(s.batteryActualKw * 10) / 10 : 0,
    batteryDischarge: s.batteryActualKw < 0 ? Math.round(Math.abs(s.batteryActualKw) * 10) / 10 : 0,
    batteryNet: Math.round(s.batteryActualKw * 10) / 10,
    gridImport: Math.round(s.gridImportKw * 10) / 10,
    gridExport: Math.round(s.gridExportKw * 10) / 10,
    socPercent: Math.round(s.batterySocPercent * 10) / 10,
    socKwh: Math.round(s.batterySocKwh * 10) / 10,
    spotPrice: Math.round(s.spotPriceEurPerMwh * 10) / 10,
    costEur: Math.round(s.costEur * 100) / 100,
    deficit: Math.round(s.unservedLoadKw * 10) / 10
  }));

  const currentLabel = steps[currentHour]?.label || '00:00';

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-6 shadow-xl text-slate-100 space-y-4 sm:space-y-6">
      {/* Chart Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30 shrink-0">
            <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-sm sm:text-base">
              Graphiques d'Analyse 24h & Profils Temporels
            </h3>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Cliquez sur un point du graphique pour positionner le repère temporel
            </p>
          </div>
        </div>

        {/* Scrollable tabs container for mobile screens */}
        <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700 text-xs overflow-x-auto no-scrollbar whitespace-nowrap self-start sm:self-auto max-w-full">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors font-medium touch-manipulation ${
              activeTab === 'all' ? 'bg-slate-700 text-white shadow-sm font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Vue Complète
          </button>
          <button
            onClick={() => setActiveTab('balance')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5 touch-manipulation ${
              activeTab === 'balance' ? 'bg-slate-700 text-amber-300 shadow-sm font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" /> Puissances
          </button>
          <button
            onClick={() => setActiveTab('soc')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5 touch-manipulation ${
              activeTab === 'soc' ? 'bg-slate-700 text-teal-300 shadow-sm font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Battery className="w-3.5 h-3.5" /> SOC Batterie
          </button>
          <button
            onClick={() => setActiveTab('prices')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5 touch-manipulation ${
              activeTab === 'prices' ? 'bg-slate-700 text-indigo-300 shadow-sm font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" /> Marché SPOT
          </button>
        </div>
      </div>

      {/* CHART 1: POWER BALANCE (ÉQUILIBRE DES PUISSANCES 24H) */}
      {(activeTab === 'all' || activeTab === 'balance') && (
        <div className="bg-slate-950/60 rounded-xl p-3 sm:p-4 border border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                Équilibre des Flux de Puissance (kW)
              </h4>
              <p className="text-xs text-slate-400">
                Production PV, demande charge, cycles batterie et import/export réseau.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Repère temporel actuel : <strong className="text-emerald-400">{currentLabel}</strong>
            </span>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload.length > 0) {
                    const h = e.activePayload[0].payload?.hour;
                    if (typeof h === 'number') onHourSelect(h);
                  }
                }}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 10 }} minTickGap={14} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit=" kW" width={45} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#f8fafc',
                    fontSize: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                  }}
                  formatter={(val: number | string | undefined, name: string | undefined) => [
                    `${val} kW`,
                    name === 'load' ? 'Charge Non Pilotable' :
                    name === 'pv' ? 'Production PV' :
                    name === 'batteryCharge' ? 'Charge Batterie (+)' :
                    name === 'batteryDischarge' ? 'Décharge Batterie (-)' :
                    name === 'gridImport' ? 'Import Réseau' :
                    name === 'gridExport' ? 'Export Réseau' :
                    name === 'deficit' ? 'Déficit Non Couvert (!)' : name
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  formatter={(value) => {
                    const labels: Record<string, string> = {
                      load: 'Charge (kW)',
                      pv: 'Solaire PV (kW)',
                      batteryCharge: 'Charge Batt. (kW)',
                      batteryDischarge: 'Décharge Batt. (kW)',
                      gridImport: 'Import Réseau (kW)',
                      gridExport: 'Export Réseau (kW)',
                      deficit: 'Déficit Charge (kW)'
                    };
                    return labels[value] || value;
                  }}
                />

                {/* Vertical cursor showing current scrubber position */}
                <ReferenceLine
                  x={currentLabel}
                  stroke="#34d399"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  label={{
                    value: `Actuel: ${currentLabel}`,
                    fill: '#34d399',
                    fontSize: 11,
                    position: 'top'
                  }}
                />

                {/* Subscribed grid limit horizontal lines */}
                <ReferenceLine
                  y={params.gridMaxPowerKw}
                  stroke="#f43f5e"
                  strokeDasharray="3 3"
                  label={{ value: `Pmax Réseau (${params.gridMaxPowerKw} kW)`, fill: '#f43f5e', fontSize: 10 }}
                />

                {/* Areas and Lines */}
                <Area type="monotone" dataKey="pv" fill="#f59e0b" fillOpacity={0.25} stroke="#f59e0b" strokeWidth={2} />
                <Line type="monotone" dataKey="load" stroke="#f97316" strokeWidth={2.5} dot={{ r: 2 }} />
                <Bar dataKey="gridImport" fill="#6366f1" opacity={0.7} />
                <Bar dataKey="gridExport" fill="#10b981" opacity={0.6} />
                <Line type="monotone" dataKey="batteryCharge" stroke="#14b8a6" strokeWidth={2} strokeDasharray="3 3" />
                <Line type="monotone" dataKey="batteryDischarge" stroke="#06b6d4" strokeWidth={2} />
                <Bar dataKey="deficit" fill="#e11d48" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* CHART 2: BATTERY STATE OF CHARGE (SOC % & KWH) */}
      {(activeTab === 'all' || activeTab === 'soc') && (
        <div className="bg-slate-950/60 rounded-xl p-3 sm:p-4 border border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400" />
                État de Charge Batterie SOC (%) & Capacité Stockée (kWh)
              </h4>
              <p className="text-xs text-slate-400">
                Évolution temporelle du stock avec respect des bornes [{params.batterySocMinPercent}% - {params.batterySocMaxPercent}%].
              </p>
            </div>
            <div className="text-xs font-mono text-slate-300">
              Stock à {currentLabel} : <strong className="text-teal-400">{chartData[currentHour]?.socPercent}% ({chartData[currentHour]?.socKwh} kWh)</strong>
            </div>
          </div>

          <div className="h-56 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload.length > 0) {
                    const h = e.activePayload[0].payload?.hour;
                    if (typeof h === 'number') onHourSelect(h);
                  }
                }}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 10 }} minTickGap={14} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" width={40} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#f8fafc',
                    fontSize: '12px'
                  }}
                  formatter={(val: number | string | undefined, name: string | undefined) => [
                    name === 'socPercent' ? `${val}%` : `${val} kWh`,
                    name === 'socPercent' ? 'État de Charge (SOC)' : 'Énergie Stockée'
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  formatter={(value) => (value === 'socPercent' ? 'SOC (%)' : 'Énergie en stock (kWh)')}
                />

                {/* Min / Max SOC Reference Lines */}
                <ReferenceLine
                  y={params.batterySocMinPercent}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: `SOC Min (${params.batterySocMinPercent}%)`, fill: '#ef4444', fontSize: 10 }}
                />
                <ReferenceLine
                  y={params.batterySocMaxPercent}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: `SOC Max (${params.batterySocMaxPercent}%)`, fill: '#ef4444', fontSize: 10, position: 'insideTopLeft' }}
                />

                {/* Current scrubber position */}
                <ReferenceLine
                  x={currentLabel}
                  stroke="#34d399"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />

                <Area
                  type="monotone"
                  dataKey="socPercent"
                  fill="#0d9488"
                  fillOpacity={0.3}
                  stroke="#14b8a6"
                  strokeWidth={2.5}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* CHART 3: SPOT DAY-AHEAD PRICES (€/MWh) & HOURLY COST */}
      {(activeTab === 'all' || activeTab === 'prices') && (
        <div className="bg-slate-950/60 rounded-xl p-3 sm:p-4 border border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                Marché Électrique SPOT Day-Ahead (€/MWh) & Facturation Réseau
              </h4>
              <p className="text-xs text-slate-400">
                Prix horaire de l'électricité sur le marché de gros et coût net horaire résultant.
              </p>
            </div>
            <div className="text-xs font-mono text-slate-300">
              Prix à {currentLabel} : <strong className="text-indigo-400">{chartData[currentHour]?.spotPrice} €/MWh</strong>
            </div>
          </div>

          <div className="h-56 sm:h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload.length > 0) {
                    const h = e.activePayload[0].payload?.hour;
                    if (typeof h === 'number') onHourSelect(h);
                  }
                }}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 10 }} minTickGap={14} />
                <YAxis yAxisId="price" stroke="#818cf8" tick={{ fontSize: 10 }} unit=" €" width={40} />
                <YAxis yAxisId="cost" orientation="right" stroke="#38bdf8" tick={{ fontSize: 10 }} unit=" €" width={35} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#f8fafc',
                    fontSize: '12px'
                  }}
                  formatter={(val: number | string | undefined, name: string | undefined) => [
                    name === 'spotPrice' ? `${val} €/MWh` : `${val} €/h`,
                    name === 'spotPrice' ? 'Prix Marché SPOT' : 'Coût Net Facturé'
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  formatter={(value) => (value === 'spotPrice' ? 'Prix SPOT (€/MWh)' : 'Coût net horaire (€/h)')}
                />

                <ReferenceLine
                  yAxisId="price"
                  x={currentLabel}
                  stroke="#34d399"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />

                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="spotPrice"
                  stroke="#818cf8"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Bar yAxisId="cost" dataKey="costEur" fill="#38bdf8" opacity={0.6} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
