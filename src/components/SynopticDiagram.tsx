import React, { useState } from 'react';
import {
  ShieldAlert,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { MicrogridParameters, SimulationStepResult } from '../types';

interface SynopticDiagramProps {
  currentStep: SimulationStepResult;
  params: MicrogridParameters;
  totalHoursWithDeficit: number[];
}

export const SynopticDiagram: React.FC<SynopticDiagramProps> = ({
  currentStep,
  params,
  totalHoursWithDeficit
}) => {
  const [fitMode, setFitMode] = useState<'fit' | 'scroll'>('fit');
  const {
    label,
    loadKw,
    pvGenKw,
    batteryActualKw,
    batterySocKwh,
    batterySocPercent,
    gridImportKw,
    gridExportKw,
    spotPriceEurPerMwh,
    unservedLoadKw,
    isDeficit,
    batteryLimitedReason
  } = currentStep;

  // Status flags
  const isCharging = batteryActualKw > 0.05;
  const isDischarging = batteryActualKw < -0.05;
  const isGridImporting = gridImportKw > 0.05;
  const isGridExporting = gridExportKw > 0.05;
  const isPvProducing = pvGenKw > 0.05;

  return (
    <div className="w-full bg-black rounded-2xl p-2 sm:p-4 relative text-slate-100">
      {/* Top Controls: Zoom Mode Toggle (Hour and SPOT price moved to header) */}
      <div className="flex items-center justify-end mb-2 px-1">
        <button
          onClick={() => setFitMode(fitMode === 'fit' ? 'scroll' : 'fit')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors text-[11px] sm:text-xs font-sans touch-manipulation"
          title={fitMode === 'fit' ? 'Passer en zoom 100% avec défilement tactile' : 'Ajuster à la largeur de l\'écran'}
        >
          {fitMode === 'fit' ? (
            <>
              <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Zoom 100%</span>
            </>
          ) : (
            <>
              <Minimize2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ajuster</span>
            </>
          )}
        </button>
      </div>

      {/* Touch scroll hint on mobile when zoomed */}
      {fitMode === 'scroll' && (
        <div className="sm:hidden text-center text-[10px] text-cyan-400 bg-cyan-950/60 py-1 px-2 rounded-lg mb-2 border border-cyan-800 flex items-center justify-center gap-1.5 animate-pulse">
          <span>↔️ Défilez horizontalement pour explorer les flux</span>
        </div>
      )}

      {/* 2D ELECTRICAL SCHEMATIC ON PURE BLACK BACKGROUND */}
      <div className={`w-full ${fitMode === 'scroll' ? 'overflow-x-auto pb-2' : ''}`}>
        <div className={fitMode === 'scroll' ? 'min-w-[860px]' : 'w-full'}>
          <svg
            viewBox="0 0 1060 560"
            className="w-full h-auto select-none bg-black"
          >
            <defs>
              {/* CSS Animations inside SVG */}
              <style>{`
                @keyframes flowRight {
                  from { stroke-dashoffset: 24; }
                  to { stroke-dashoffset: 0; }
                }
                @keyframes flowLeft {
                  from { stroke-dashoffset: 0; }
                  to { stroke-dashoffset: 24; }
                }
                @keyframes alertGlow {
                  0%, 100% { stroke: #ef4444; filter: drop-shadow(0 0 4px rgba(239, 68, 68, 0.4)); }
                  50% { stroke: #f87171; filter: drop-shadow(0 0 10px rgba(239, 68, 68, 0.8)); }
                }
                .flow-active-right {
                  animation: flowRight 0.8s linear infinite;
                }
                .flow-active-left {
                  animation: flowLeft 0.8s linear infinite;
                }
                .deficit-glow {
                  animation: alertGlow 1.2s ease-in-out infinite;
                }
              `}</style>

              {/* Lighter, clearer gradients for cards */}
              <linearGradient id="gridCardLight" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0c162c" />
                <stop offset="100%" stopColor="#070c18" />
              </linearGradient>

              <linearGradient id="pvCardLight" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#241b07" />
                <stop offset="100%" stopColor="#120c02" />
              </linearGradient>

              <linearGradient id="batteryCardLight" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#062220" />
                <stop offset="100%" stopColor="#031211" />
              </linearGradient>

              <linearGradient id="loadCardLight" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#251206" />
                <stop offset="100%" stopColor="#130702" />
              </linearGradient>

              <linearGradient id="loadDeficitLight" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b0808" />
                <stop offset="100%" stopColor="#1c0303" />
              </linearGradient>
            </defs>

            {/* ========================================================
                1. CENTRAL AC BUSBAR (Barre épurée, sans texte ni détails lourds)
                X = 520, Y = 50 à Y = 510
                ======================================================== */}
            <g id="minimal-bus">
              {/* Clean luminous central bus rail */}
              <line
                x1="520"
                y1="50"
                x2="520"
                y2="510"
                stroke="#64748b"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <line
                x1="520"
                y1="52"
                x2="520"
                y2="508"
                stroke="#f1f5f9"
                strokeWidth="4"
                strokeLinecap="round"
              />

              {/* Minimal junction connection nodes */}
              <circle cx="520" cy="115" r="7" fill="#fde047" stroke="#000000" strokeWidth="2.5" />
              <circle cx="520" cy="280" r="7" fill="#38bdf8" stroke="#000000" strokeWidth="2.5" />
              <circle cx="520" cy="445" r="7" fill="#fb923c" stroke="#000000" strokeWidth="2.5" />
            </g>

            {/* ========================================================
                2. POWER FLOW CONDUITS (LIGNES DE FLUX SANS DISJONCTEURS)
                ======================================================== */}

            {/* A. LEFT SIDE: RÉSEAU <-> BUS (Y = 280) */}
            <g id="flow-branch-grid">
              {/* Base Line */}
              <line
                x1="300"
                y1="280"
                x2="520"
                y2="280"
                stroke="#1e293b"
                strokeWidth="6"
              />

              {/* Animated Power Flow in vibrant colors */}
              {isGridImporting && (
                <line
                  x1="300"
                  y1="280"
                  x2="520"
                  y2="280"
                  stroke="#60a5fa"
                  strokeWidth="5"
                  strokeDasharray="10 8"
                  className="flow-active-right"
                />
              )}
              {isGridExporting && (
                <line
                  x1="300"
                  y1="280"
                  x2="520"
                  y2="280"
                  stroke="#34d399"
                  strokeWidth="5"
                  strokeDasharray="10 8"
                  className="flow-active-left"
                />
              )}

              {/* Power Flow Badge directly centered on the wire */}
              <g transform="translate(325, 238)">
                <rect
                  x="0"
                  y="0"
                  width="170"
                  height="34"
                  rx="8"
                  fill="#030712"
                  stroke={isGridImporting ? '#60a5fa' : isGridExporting ? '#34d399' : '#334155'}
                  strokeWidth="1.8"
                />
                <text
                  x="85"
                  y="21"
                  fill={isGridImporting ? '#93c5fd' : isGridExporting ? '#6ee7b7' : '#94a3b8'}
                  fontSize="12"
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {isGridImporting && `Import +${gridImportKw.toFixed(1)} kW ➔`}
                  {isGridExporting && `⬅ Export -${gridExportKw.toFixed(1)} kW`}
                  {!isGridImporting && !isGridExporting && 'Neutre 0.0 kW'}
                </text>
              </g>
            </g>

            {/* B. RIGHT SIDE TOP: PV -> BUS (Y = 115) */}
            <g id="flow-branch-pv">
              {/* Base Line */}
              <line
                x1="520"
                y1="115"
                x2="740"
                y2="115"
                stroke="#1e293b"
                strokeWidth="6"
              />

              {/* Animated Flow */}
              {isPvProducing && (
                <line
                  x1="520"
                  y1="115"
                  x2="740"
                  y2="115"
                  stroke="#fbbf24"
                  strokeWidth="5"
                  strokeDasharray="10 8"
                  className="flow-active-left"
                />
              )}

              {/* Power Flow Badge */}
              <g transform="translate(545, 73)">
                <rect
                  x="0"
                  y="0"
                  width="170"
                  height="34"
                  rx="8"
                  fill="#030712"
                  stroke={isPvProducing ? '#fbbf24' : '#334155'}
                  strokeWidth="1.8"
                />
                <text
                  x="85"
                  y="21"
                  fill={isPvProducing ? '#fef08a' : '#94a3b8'}
                  fontSize="12"
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {isPvProducing ? `⬅ Solaire +${pvGenKw.toFixed(1)} kW` : 'Nuit (0.0 kW)'}
                </text>
              </g>
            </g>

            {/* C. RIGHT SIDE MIDDLE: BATTERY <-> BUS (Y = 280) */}
            <g id="flow-branch-battery">
              {/* Base Line */}
              <line
                x1="520"
                y1="280"
                x2="740"
                y2="280"
                stroke="#1e293b"
                strokeWidth="6"
              />

              {/* Animated Flow */}
              {isCharging && (
                <line
                  x1="520"
                  y1="280"
                  x2="740"
                  y2="280"
                  stroke="#2dd4bf"
                  strokeWidth="5"
                  strokeDasharray="10 8"
                  className="flow-active-right"
                />
              )}
              {isDischarging && (
                <line
                  x1="520"
                  y1="280"
                  x2="740"
                  y2="280"
                  stroke="#38bdf8"
                  strokeWidth="5"
                  strokeDasharray="10 8"
                  className="flow-active-left"
                />
              )}

              {/* Power Flow Badge */}
              <g transform="translate(545, 238)">
                <rect
                  x="0"
                  y="0"
                  width="170"
                  height="34"
                  rx="8"
                  fill="#030712"
                  stroke={isCharging ? '#2dd4bf' : isDischarging ? '#38bdf8' : '#334155'}
                  strokeWidth="1.8"
                />
                <text
                  x="85"
                  y="21"
                  fill={isCharging ? '#99f6e4' : isDischarging ? '#bae6fd' : '#94a3b8'}
                  fontSize="12"
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {isCharging && `Charge +${batteryActualKw.toFixed(1)} kW ➔`}
                  {isDischarging && `⬅ Décharge ${Math.abs(batteryActualKw).toFixed(1)} kW`}
                  {!isCharging && !isDischarging && 'Veille 0.0 kW'}
                </text>
              </g>
            </g>

            {/* D. RIGHT SIDE BOTTOM: BUS -> LOAD (Y = 445) */}
            <g id="flow-branch-load">
              {/* Base Line */}
              <line
                x1="520"
                y1="445"
                x2="740"
                y2="445"
                stroke="#1e293b"
                strokeWidth="6"
              />

              {/* Animated Flow */}
              <line
                x1="520"
                y1="445"
                x2="740"
                y2="445"
                stroke={isDeficit ? '#ef4444' : '#fb923c'}
                strokeWidth="5"
                strokeDasharray="10 8"
                className="flow-active-right"
              />

              {/* Power Flow Badge */}
              <g transform="translate(545, 403)">
                <rect
                  x="0"
                  y="0"
                  width="170"
                  height="34"
                  rx="8"
                  fill="#030712"
                  stroke={isDeficit ? '#ef4444' : '#fb923c'}
                  strokeWidth="1.8"
                />
                <text
                  x="85"
                  y="21"
                  fill={isDeficit ? '#fca5a5' : '#fed7aa'}
                  fontSize="12"
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  Charge -{(loadKw - unservedLoadKw).toFixed(1)} kW ➔
                </text>
              </g>
            </g>

            {/* ========================================================
                3. ASSET CARDS (CLEAR & LUMINOUS COLOR PALETTE)
                ======================================================== */}

            {/* --------------------------------------------------------
                ASSET 1 (LEFT): RÉSEAU PUBLIC
                X = 30, Y = 165, W = 270, H = 230
                -------------------------------------------------------- */}
            <g id="card-grid">
              <rect
                x="30"
                y="180"
                width="270"
                height="200"
                rx="14"
                fill="url(#gridCardLight)"
                stroke="#60a5fa"
                strokeWidth="2"
              />

              {/* Header */}
              <g transform="translate(48, 198)">
                <rect x="0" y="0" width="34" height="34" rx="8" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="1.5" />
                {/* Electric Grid Shape */}
                <path d="M 17 5 L 9 29 L 25 29 Z M 12 18 L 22 18 M 17 5 L 17 29" stroke="#93c5fd" strokeWidth="2" fill="none" />
                <text x="44" y="16" fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="sans-serif">
                  RÉSEAU PUBLIC
                </text>
                <text x="44" y="29" fill="#93c5fd" fontSize="11" fontFamily="sans-serif">
                  Raccordement Enedis
                </text>
              </g>

              {/* Parameters */}
              <g transform="translate(48, 255)">
                {/* Grid Subscription Limit */}
                <text x="0" y="14" fill="#94a3b8" fontSize="11" fontFamily="sans-serif">Souscription max :</text>
                <text x="234" y="14" fill="#ffffff" fontSize="12" fontWeight="bold" textAnchor="end" fontFamily="monospace">
                  {params.gridMaxPowerKw} kW
                </text>

                {/* Instant Flux */}
                <text x="0" y="38" fill="#94a3b8" fontSize="11" fontFamily="sans-serif">Flux instantané :</text>
                <text
                  x="234"
                  y="38"
                  fill={isGridImporting ? '#93c5fd' : isGridExporting ? '#6ee7b7' : '#94a3b8'}
                  fontSize="12"
                  fontWeight="bold"
                  textAnchor="end"
                  fontFamily="monospace"
                >
                  {isGridImporting && `+${gridImportKw.toFixed(1)} kW (Import)`}
                  {isGridExporting && `-${gridExportKw.toFixed(1)} kW (Export)`}
                  {!isGridImporting && !isGridExporting && '0.0 kW (Neutre)'}
                </text>

                {/* Grid Capacity Gauge */}
                <rect x="0" y="50" width="234" height="6" rx="3" fill="#1e293b" />
                <rect
                  x="0"
                  y="50"
                  width={`${Math.min(100, Math.max(0, (gridImportKw / Math.max(1, params.gridMaxPowerKw)) * 100)) * 2.34}`}
                  height="6"
                  rx="3"
                  fill={gridImportKw >= params.gridMaxPowerKw * 0.95 ? '#ef4444' : '#60a5fa'}
                />

                <line x1="0" y1="72" x2="234" y2="72" stroke="#334155" strokeWidth="1" />
                <text x="0" y="92" fill="#94a3b8" fontSize="11" fontFamily="sans-serif">Facture / Recette :</text>
                <text
                  x="234"
                  y="92"
                  fill={currentStep.costEur > 0 ? '#f8fafc' : '#4ade80'}
                  fontSize="13"
                  fontWeight="bold"
                  textAnchor="end"
                  fontFamily="monospace"
                >
                  {currentStep.costEur.toFixed(2)} €/h
                </text>
              </g>

              {/* Pin */}
              <circle cx="300" cy="280" r="5" fill="#60a5fa" stroke="#ffffff" strokeWidth="1.5" />
            </g>

            {/* --------------------------------------------------------
                ASSET 2 (RIGHT TOP): CENTRALE SOLAIRE PV
                X = 740, Y = 35, W = 290, H = 160
                -------------------------------------------------------- */}
            <g id="card-pv">
              <rect
                x="740"
                y="35"
                width="290"
                height="160"
                rx="14"
                fill="url(#pvCardLight)"
                stroke="#fbbf24"
                strokeWidth="2"
              />

              {/* Header */}
              <g transform="translate(758, 55)">
                <rect x="0" y="0" width="34" height="34" rx="8" fill="#78350f" stroke="#fbbf24" strokeWidth="1.5" />
                {/* Sun icon */}
                <circle cx="17" cy="17" r="6" fill="#fef08a" />
                <path d="M 17 4 L 17 8 M 17 26 L 17 30 M 4 17 L 8 17 M 26 17 L 30 17" stroke="#fef08a" strokeWidth="2" strokeLinecap="round" />
                <text x="44" y="16" fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="sans-serif">
                  CENTRALE SOLAIRE PV
                </text>
                <text x="44" y="29" fill="#fef08a" fontSize="11" fontFamily="sans-serif">
                  Champ photovoltaïque
                </text>
              </g>

              {/* Parameters */}
              <g transform="translate(758, 106)">
                <text x="0" y="12" fill="#94a3b8" fontSize="11" fontFamily="sans-serif">Puissance crête :</text>
                <text x="254" y="12" fill="#fef08a" fontSize="12" fontWeight="bold" textAnchor="end" fontFamily="monospace">
                  {params.pvInstalledKwc} kWc
                </text>

                <text x="0" y="34" fill="#94a3b8" fontSize="11" fontFamily="sans-serif">Production actuelle :</text>
                <text x="254" y="34" fill="#fde047" fontSize="15" fontWeight="bold" textAnchor="end" fontFamily="monospace">
                  {pvGenKw.toFixed(1)} kW
                </text>

                {/* Gen Bar */}
                <rect x="0" y="44" width="254" height="6" rx="3" fill="#1e293b" />
                <rect
                  x="0"
                  y="44"
                  width={`${Math.min(100, params.pvInstalledKwc > 0 ? (pvGenKw / params.pvInstalledKwc) * 100 : 0) * 2.54}`}
                  height="6"
                  rx="3"
                  fill="#fde047"
                />

                <line x1="0" y1="58" x2="254" y2="58" stroke="#334155" strokeWidth="1" />
                <text x="0" y="73" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">Rendement :</text>
                <text x="254" y="73" fill="#f8fafc" fontSize="10" textAnchor="end" fontFamily="monospace">
                  {(params.pvInstalledKwc > 0 ? pvGenKw / params.pvInstalledKwc : 0).toFixed(2)} kW/kWc
                </text>
              </g>

              {/* Pin */}
              <circle cx="740" cy="115" r="5" fill="#fde047" stroke="#ffffff" strokeWidth="1.5" />
            </g>

            {/* --------------------------------------------------------
                ASSET 3 (RIGHT MIDDLE): STOCKAGE BATTERIE (BESS)
                X = 740, Y = 205, W = 290, H = 175
                -------------------------------------------------------- */}
            <g id="card-battery">
              <rect
                x="740"
                y="205"
                width="290"
                height="175"
                rx="14"
                fill="url(#batteryCardLight)"
                stroke="#2dd4bf"
                strokeWidth="2"
              />

              {/* Header */}
              <g transform="translate(758, 225)">
                <rect x="0" y="0" width="34" height="34" rx="8" fill="#115e59" stroke="#2dd4bf" strokeWidth="1.5" />
                {/* Battery icon */}
                <rect x="7" y="10" width="18" height="14" rx="2" fill="none" stroke="#5eead4" strokeWidth="2" />
                <line x1="27" y1="14" x2="27" y2="20" stroke="#5eead4" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="14" x2="12" y2="20" stroke="#5eead4" strokeWidth="1.5" />
                <line x1="16" y1="14" x2="16" y2="20" stroke="#5eead4" strokeWidth="1.5" />
                <text x="44" y="16" fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="sans-serif">
                  STOCKAGE BATTERIE
                </text>
                <text x="44" y="29" fill="#5eead4" fontSize="11" fontFamily="sans-serif">
                  {params.batteryCapacityKwh} kWh • {params.batteryPowerKw} kW
                </text>
              </g>

              {/* Parameters & SOC Gauge */}
              <g transform="translate(758, 274)">
                <text x="0" y="12" fill="#94a3b8" fontSize="11" fontFamily="sans-serif">Niveau d'énergie (SOC) :</text>
                <text x="254" y="12" fill="#5eead4" fontSize="13" fontWeight="bold" textAnchor="end" fontFamily="monospace">
                  {batterySocPercent.toFixed(0)}% ({batterySocKwh.toFixed(1)} kWh)
                </text>

                {/* SOC Outer frame */}
                <rect x="0" y="20" width="254" height="14" rx="4" fill="#041211" stroke="#134e4a" strokeWidth="1" />
                {/* SOC Fill */}
                <rect
                  x="2"
                  y="22"
                  width={`${Math.min(100, Math.max(0, batterySocPercent)) * 2.5}`}
                  height="10"
                  rx="2"
                  fill={batterySocPercent < 20 ? '#fbbf24' : '#2dd4bf'}
                />

                <text x="0" y="46" fill="#64748b" fontSize="9" fontFamily="sans-serif">Min: {params.batterySocMinPercent}%</text>
                <text x="254" y="46" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="sans-serif">Max: {params.batterySocMaxPercent}%</text>

                <line x1="0" y1="54" x2="254" y2="54" stroke="#334155" strokeWidth="1" />
                <text x="0" y="72" fill="#94a3b8" fontSize="11" fontFamily="sans-serif">Flux de puissance :</text>
                <text
                  x="254"
                  y="72"
                  fill={isCharging ? '#2dd4bf' : isDischarging ? '#38bdf8' : '#94a3b8'}
                  fontSize="12"
                  fontWeight="bold"
                  textAnchor="end"
                  fontFamily="monospace"
                >
                  {isCharging && `+${batteryActualKw.toFixed(1)} kW (Charge)`}
                  {isDischarging && `${batteryActualKw.toFixed(1)} kW (Décharge)`}
                  {!isCharging && !isDischarging && '0.0 kW (Veille)'}
                </text>

                {/* Limitation text */}
                {batteryLimitedReason && batteryLimitedReason !== 'none' && (
                  <g transform="translate(0, 80)">
                    <rect x="0" y="0" width="254" height="18" rx="4" fill="#451a03" stroke="#b45309" strokeWidth="1" />
                    <text x="127" y="12" fill="#fef08a" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                      {batteryLimitedReason === 'full' && 'Plafond SOC Max atteint'}
                      {batteryLimitedReason === 'empty' && 'Seuil SOC Min atteint'}
                      {batteryLimitedReason === 'max_charge_power' && 'Puissance charge bridée au max kW'}
                      {batteryLimitedReason === 'max_discharge_power' && 'Puissance décharge bridée au max kW'}
                    </text>
                  </g>
                )}
              </g>

              {/* Pin */}
              <circle cx="740" cy="280" r="5" fill="#2dd4bf" stroke="#ffffff" strokeWidth="1.5" />
            </g>

            {/* --------------------------------------------------------
                ASSET 4 (RIGHT BOTTOM): CHARGE DU SITE
                X = 740, Y = 390, W = 290, H = 150
                -------------------------------------------------------- */}
            <g id="card-load">
              <rect
                x="740"
                y="390"
                width="290"
                height="150"
                rx="14"
                fill={isDeficit ? 'url(#loadDeficitLight)' : 'url(#loadCardLight)'}
                stroke={isDeficit ? '#ef4444' : '#fb923c'}
                strokeWidth="2"
                className={isDeficit ? 'deficit-glow' : ''}
              />

              {/* Header */}
              <g transform="translate(758, 410)">
                <rect
                  x="0"
                  y="0"
                  width="34"
                  height="34"
                  rx="8"
                  fill={isDeficit ? '#7f1d1d' : '#7c2d12'}
                  stroke={isDeficit ? '#fca5a5' : '#fb923c'}
                  strokeWidth="1.5"
                />
                {/* Zap shape */}
                <path d="M 18 6 L 10 18 L 17 18 L 16 28 L 24 16 L 17 16 Z" fill={isDeficit ? '#fee2e2' : '#fed7aa'} />
                <text x="44" y="16" fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="sans-serif">
                  CHARGE DU SITE
                </text>
                <text x="44" y="29" fill={isDeficit ? '#fca5a5' : '#fed7aa'} fontSize="11" fontFamily="sans-serif">
                  Consommation non pilotable
                </text>
              </g>

              {/* Parameters */}
              <g transform="translate(758, 458)">
                <text x="0" y="12" fill="#94a3b8" fontSize="11" fontFamily="sans-serif">Puissance appelée :</text>
                <text x="254" y="12" fill="#fed7aa" fontSize="15" fontWeight="bold" textAnchor="end" fontFamily="monospace">
                  {loadKw.toFixed(1)} kW
                </text>

                <text x="0" y="32" fill="#94a3b8" fontSize="11" fontFamily="sans-serif">Puissance alimentée :</text>
                <text x="254" y="32" fill="#ffffff" fontSize="12" fontWeight="bold" textAnchor="end" fontFamily="monospace">
                  {(loadKw - unservedLoadKw).toFixed(1)} kW
                </text>

                {isDeficit ? (
                  <g transform="translate(0, 42)">
                    <rect x="0" y="0" width="254" height="26" rx="6" fill="#7f1d1d" stroke="#ef4444" strokeWidth="1.5" />
                    <text x="127" y="17" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                      ⚠️ DÉFICIT : -{unservedLoadKw.toFixed(1)} kW non alimentés
                    </text>
                  </g>
                ) : (
                  <g transform="translate(0, 42)">
                    <line x1="0" y1="0" x2="254" y2="0" stroke="#334155" strokeWidth="1" />
                    <text x="0" y="17" fill="#94a3b8" fontSize="11" fontFamily="sans-serif">Statut alimentation :</text>
                    <text x="254" y="17" fill="#4ade80" fontSize="12" fontWeight="bold" textAnchor="end" fontFamily="sans-serif">
                      100% Satisfaite
                    </text>
                  </g>
                )}
              </g>

              {/* Pin */}
              <circle cx="740" cy="445" r="5" fill={isDeficit ? '#ef4444' : '#fb923c'} stroke="#ffffff" strokeWidth="1.5" />
            </g>

          </svg>
        </div>
      </div>

      {/* Global Deficit Warning if any hours have deficit */}
      {totalHoursWithDeficit.length > 0 && (
        <div className="mt-3 p-3 bg-rose-950/70 border border-rose-600 rounded-xl text-xs text-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-lg animate-pulse">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
            <span>
              <strong>Contrainte de raccordement dépassée :</strong> {totalHoursWithDeficit.length} heure(s) présentent un déficit de puissance sur la journée ({totalHoursWithDeficit.map(h => `${h}h`).join(', ')}).
            </span>
          </div>
          <span className="text-[11px] bg-rose-900 px-2.5 py-1 rounded-md font-mono font-bold text-white shrink-0 border border-rose-500">
            Augmenter la batterie ou la souscription réseau
          </span>
        </div>
      )}
    </div>
  );
};
