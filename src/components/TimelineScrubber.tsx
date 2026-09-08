import React, { useEffect, useState, useRef } from 'react';
import { Play, Pause, AlertCircle, Clock, Zap, Sun, Battery, Activity } from 'lucide-react';
import { SimulationStepResult } from '../types';

interface TimelineScrubberProps {
  currentHour: number;
  onHourChange: React.Dispatch<React.SetStateAction<number>> | ((hour: number) => void);
  steps: SimulationStepResult[];
  hoursWithDeficit: number[];
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  currentHour,
  onHourChange,
  steps,
  hoursWithDeficit
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed] = useState<number>(1000); // 1 sec per step
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        onHourChange((prev: number) => (prev + 1) % 24);
      }, playSpeed);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying, playSpeed, onHourChange]);

  const togglePlay = () => setIsPlaying(!isPlaying);

  const activeStep = steps[currentHour] || steps[0];

  return (
    <div className="w-full text-slate-100 select-none">
      {/* 1. COMPONENT POWERS ROW (AU-DESSUS DE LA TIMELINE - STRICTEMENT SUR UNE SEULE LIGNE) */}
      <div className="flex flex-nowrap items-center justify-between gap-2 sm:gap-3 text-xs font-mono mb-2 overflow-x-auto whitespace-nowrap scrollbar-none py-0.5">
        {/* Current Time Badge & Deficit Warning */}
        <div className="flex flex-nowrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-emerald-950/90 border border-emerald-600/70 px-2.5 py-1 rounded-lg text-emerald-300 font-bold text-xs shadow-sm shrink-0 whitespace-nowrap">
            <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{activeStep?.label || '00:00'}</span>
            <span className="text-[10px] text-emerald-400/80 font-normal">({currentHour + 1}/24)</span>
          </div>

          {activeStep?.isDeficit && (
            <div className="bg-rose-950 text-rose-200 px-2.5 py-1 rounded-lg border border-rose-600 flex items-center gap-1.5 font-bold text-[11px] animate-pulse shadow-sm shrink-0 whitespace-nowrap">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>Déficit : -{activeStep.unservedLoadKw.toFixed(1)} kW</span>
            </div>
          )}
        </div>

        {/* Real-time Powers by Component in Sleek Chips (Strictly Single Row) */}
        <div className="flex flex-nowrap items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Charge */}
          <div className="bg-slate-900/90 border border-orange-500/40 text-orange-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm shrink-0 whitespace-nowrap">
            <Zap className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <span className="text-slate-400 text-[11px]">Charge:</span>
            <span className="font-bold font-mono text-orange-300">
              {activeStep ? activeStep.loadKw.toFixed(1) : '0.0'} kW
            </span>
          </div>

          {/* Solaire PV */}
          <div className="bg-slate-900/90 border border-amber-500/40 text-amber-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm shrink-0 whitespace-nowrap">
            <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-slate-400 text-[11px]">PV:</span>
            <span className="font-bold font-mono text-amber-300">
              {activeStep ? activeStep.pvGenKw.toFixed(1) : '0.0'} kW
            </span>
          </div>

          {/* Batterie BESS */}
          <div className="bg-slate-900/90 border border-teal-500/40 text-teal-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm shrink-0 whitespace-nowrap">
            <Battery className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="text-slate-400 text-[11px]">
              Bat ({activeStep ? activeStep.batterySocPercent.toFixed(0) : '0'}%):
            </span>
            <span className="font-bold font-mono text-teal-300">
              {activeStep && activeStep.batteryActualKw > 0
                ? `+${activeStep.batteryActualKw.toFixed(1)}`
                : activeStep
                ? `${activeStep.batteryActualKw.toFixed(1)}`
                : '0.0'}{' '}
              kW
            </span>
          </div>

          {/* Réseau */}
          <div className="bg-slate-900/90 border border-blue-500/40 text-blue-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm shrink-0 whitespace-nowrap">
            <Activity className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-slate-400 text-[11px]">Réseau:</span>
            <span className="font-bold font-mono text-blue-300">
              {activeStep && activeStep.gridImportKw > 0.05
                ? `+${activeStep.gridImportKw.toFixed(1)}`
                : activeStep && activeStep.gridExportKw > 0.05
                ? `-${activeStep.gridExportKw.toFixed(1)}`
                : '0.0'}{' '}
              kW
            </span>
          </div>
        </div>
      </div>

      {/* 2. TIMELINE ROW (AVEC PETIT BOUTON PLAY/PAUSE SUR LE CÔTÉ) */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Petit bouton Play / Pause sur le côté */}
        <button
          onClick={togglePlay}
          title={isPlaying ? 'Pause' : 'Lecture automatique'}
          className={`h-8 w-8 rounded-lg border transition-all shrink-0 flex items-center justify-center touch-manipulation cursor-pointer ${
            isPlaying
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-sm shadow-emerald-500/30'
              : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700'
          }`}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current translate-x-0.5" />
          )}
        </button>

        {/* Barre de timeline interactive et repères d'heures */}
        <div className="flex-1 min-w-0">
          <input
            type="range"
            min="0"
            max="23"
            step="1"
            value={currentHour}
            onChange={(e) => {
              setIsPlaying(false);
              onHourChange(parseInt(e.target.value, 10));
            }}
            className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 touch-manipulation"
          />

          {/* 24 Heures & Marqueurs */}
          <div className="flex justify-between items-center text-[9px] sm:text-[10px] text-slate-400 font-mono mt-0.5 px-0.5">
            {Array.from({ length: 24 }).map((_, i) => {
              const hasDeficit = hoursWithDeficit.includes(i);
              const isSelected = i === currentHour;
              const isMajorHour = i % 6 === 0 || i === 12 || i === 23;
              const isMediumHour = i % 3 === 0;

              return (
                <button
                  key={i}
                  onClick={() => {
                    setIsPlaying(false);
                    onHourChange(i);
                  }}
                  className={`relative flex flex-col items-center group transition-all py-0.5 px-0.5 touch-manipulation cursor-pointer ${
                    isSelected ? 'text-emerald-400 font-bold scale-110' : 'hover:text-slate-200'
                  }`}
                  title={`Heure ${i}:00`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full mb-0.5 transition-colors ${
                      hasDeficit
                        ? 'bg-rose-500 ring-2 ring-rose-950 animate-ping'
                        : isSelected
                        ? 'bg-emerald-400 ring-2 ring-emerald-900'
                        : isMajorHour
                        ? 'bg-slate-400'
                        : 'bg-slate-700'
                    }`}
                  />
                  <span
                    className={`text-[9px] sm:text-[10px] ${
                      isSelected ? 'text-emerald-300 font-bold' : 'hidden sm:inline'
                    } ${isMajorHour ? '!inline' : isMediumHour ? 'hidden md:inline' : 'hidden lg:inline'}`}
                  >
                    {i}h
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
