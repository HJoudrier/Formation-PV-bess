import React, { useState, useMemo } from 'react';
import {
  Zap,
  UploadCloud,
  Download,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  Cpu
} from 'lucide-react';
import {
  HourlyDataPoint,
  MicrogridParameters
} from './types';
import {
  createInitialHourlyData,
  DEFAULT_MICROGRID_PARAMETERS
} from './utils/defaultData';
import { runMicrogridSimulation } from './utils/microgridEngine';
import { SynopticDiagram } from './components/SynopticDiagram';
import { TimelineScrubber } from './components/TimelineScrubber';
import { MicrogridCharts } from './components/MicrogridCharts';
import { SizingControlPanel } from './components/SizingControlPanel';
import { BatteryDispatchEditor } from './components/BatteryDispatchEditor';
import { CostSummaryCard } from './components/CostSummaryCard';
import { DataFileModal } from './components/DataFileModal';
import { generateSimulationResultsCsv, triggerLocalDownload } from './utils/fileParsers';

export default function App() {
  // Microgrid Parameters
  const [params, setParams] = useState<MicrogridParameters>(DEFAULT_MICROGRID_PARAMETERS);

  // Hourly Data Points (24 hours)
  const [hourlyData, setHourlyData] = useState<HourlyDataPoint[]>(() => createInitialHourlyData());

  // Current Scrubber Hour (0 to 23)
  const [currentHour, setCurrentHour] = useState<number>(12); // Default to noon to show solar & active battery

  // File Manager Modal state
  const [isDataModalOpen, setIsDataModalOpen] = useState<boolean>(false);

  // Run full simulation engine
  const simulation = useMemo(() => {
    return runMicrogridSimulation(hourlyData, params);
  }, [hourlyData, params]);

  const currentStep = simulation.steps[currentHour] || simulation.steps[0];
  const hasDeficit = simulation.summary.hoursWithDeficit.length > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl shadow-md text-slate-950">
              <Cpu className="w-5 h-5 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  Microgrid Planner
                </h1>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold tracking-wider">
                  24h Horizon
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Dimensionnement & Pilotage de Micro-Réseau Électrique
              </p>
            </div>
          </div>

          {/* Alert status badge if power deficit */}
          {hasDeficit && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-rose-950/80 border border-rose-600 rounded-lg text-rose-300 text-xs font-bold animate-pulse">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>{simulation.summary.hoursWithDeficit.length}h de déficit de puissance sur le réseau !</span>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsDataModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors shadow-sm"
              title="Gérer les fichiers de courbes (Charge, PV, SPOT)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Fichiers & Courbes</span>
              <span className="sm:hidden">Fichiers</span>
            </button>

            <button
              onClick={() => {
                const csv = generateSimulationResultsCsv(simulation.steps, simulation.summary, params);
                triggerLocalDownload('planification_microreseau_24h.csv', csv);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
              title="Télécharger les résultats 24h au format CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exporter CSV</span>
            </button>
          </div>
        </div>

        {/* Bottom of Header: Puissances par composant & Timeline Scrubber 24h */}
        <div className="border-t border-slate-800/80 bg-slate-950/95 px-4 sm:px-6 lg:px-8 py-2">
          <div className="max-w-7xl mx-auto">
            <TimelineScrubber
              currentHour={currentHour}
              onHourChange={setCurrentHour}
              steps={simulation.steps}
              hoursWithDeficit={simulation.summary.hoursWithDeficit}
            />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* 1. SYNOPTIC MICROGRID DIAGRAM */}
        <section aria-label="Schéma synoptique">
          <SynopticDiagram
            currentStep={currentStep}
            params={params}
            totalHoursWithDeficit={simulation.summary.hoursWithDeficit}
          />
        </section>

        {/* 2. INTERACTIVE 24H CHARTS */}
        <section aria-label="Graphiques temporels">
          <MicrogridCharts
            steps={simulation.steps}
            currentHour={currentHour}
            onHourSelect={setCurrentHour}
            params={params}
          />
        </section>

        {/* 4. FINANCIAL & ENERGY SUMMARY */}
        <section aria-label="Bilan financier et énergétique">
          <CostSummaryCard
            summary={simulation.summary}
            params={params}
          />
        </section>

        {/* 5. SIZING & CAPEX CONTROLS */}
        <section aria-label="Dimensionnement et paramètres">
          <SizingControlPanel
            params={params}
            onChangeParams={setParams}
            pvCapexEur={simulation.summary.pvCapexEur}
            batteryTotalCapexEur={simulation.summary.batteryTotalCapexEur}
            totalCapexEur={simulation.summary.totalCapexEur}
          />
        </section>

        {/* 6. BATTERY DISPATCH SCHEDULE EDITOR */}
        <section aria-label="Pilotage de la batterie">
          <BatteryDispatchEditor
            hourlyData={hourlyData}
            steps={simulation.steps}
            params={params}
            onUpdateHourlyData={setHourlyData}
            selectedHour={currentHour}
            onSelectHour={setCurrentHour}
          />
        </section>
      </main>

      {/* File Management & Data Import Modal */}
      <DataFileModal
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
        hourlyData={hourlyData}
        onUpdateHourlyData={setHourlyData}
        params={params}
        onUpdateParams={setParams}
        simulationSteps={simulation.steps}
        simulationSummary={simulation.summary}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Microgrid Planner — Modélisation des flux énergétiques, dimensionnement et pilotage au pas horaire.</span>
          <span className="font-mono text-slate-400">Horizon 24 pas de temps • Pas de 1h</span>
        </div>
      </footer>
    </div>
  );
}
