import React, { useState, useRef } from 'react';
import { Upload, Download, FileText, CheckCircle2, AlertTriangle, X, RefreshCw } from 'lucide-react';
import { HourlyDataPoint, MicrogridParameters, SimulationStepResult, SimulationSummary } from '../types';
import {
  parseNumericArrayFromText,
  triggerLocalDownload,
  generateLoadSampleCsv,
  generatePvNormSampleCsv,
  generateSpotPriceSampleCsv,
  generateSimulationResultsCsv
} from '../utils/fileParsers';
import { LOAD_PRESETS, PV_NORM_PRESETS, SPOT_PRICE_PRESETS } from '../utils/defaultData';

interface DataFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  hourlyData: HourlyDataPoint[];
  onUpdateHourlyData: (data: HourlyDataPoint[]) => void;
  params: MicrogridParameters;
  onUpdateParams: (p: MicrogridParameters) => void;
  simulationSteps: SimulationStepResult[];
  simulationSummary: SimulationSummary;
}

export const DataFileModal: React.FC<DataFileModalProps> = ({
  isOpen,
  onClose,
  hourlyData,
  onUpdateHourlyData,
  params,
  onUpdateParams,
  simulationSteps,
  simulationSummary
}) => {
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadInputRef = useRef<HTMLInputElement | null>(null);
  const pvInputRef = useRef<HTMLInputElement | null>(null);
  const spotInputRef = useRef<HTMLInputElement | null>(null);
  const projectInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (
    file: File,
    type: 'load' | 'pv' | 'spot'
  ) => {
    setFeedback(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseNumericArrayFromText(text);

      if (parsed.error || !parsed.values || parsed.values.length === 0) {
        setFeedback({
          type: 'error',
          message: parsed.error || 'Erreur lors de la lecture du fichier.'
        });
        return;
      }

      const updated = hourlyData.map((pt, i) => {
        const val = parsed.values[i] ?? 0;
        if (type === 'load') return { ...pt, loadKw: Math.max(0, val) };
        if (type === 'pv') return { ...pt, pvNormKwPerKwc: Math.max(0, val) };
        if (type === 'spot') return { ...pt, spotPriceEurPerMwh: val };
        return pt;
      });

      onUpdateHourlyData(updated);
      setFeedback({
        type: 'success',
        message: `Fichier "${file.name}" importé avec succès pour ${
          type === 'load' ? 'la consommation' : type === 'pv' ? 'la production PV normalisée' : 'les prix SPOT'
        } (24 pas de temps).`
      });
    };
    reader.readAsText(file);
  };

  const handleLoadPreset = (category: 'load' | 'pv' | 'spot', key: string) => {
    setFeedback(null);
    if (category === 'load') {
      const preset = LOAD_PRESETS[key];
      if (preset) {
        const updated = hourlyData.map((pt, i) => ({ ...pt, loadKw: preset.values[i] }));
        onUpdateHourlyData(updated);
        setFeedback({ type: 'success', message: `Profil charge "${preset.name}" appliqué.` });
      }
    } else if (category === 'pv') {
      const preset = PV_NORM_PRESETS[key];
      if (preset) {
        const updated = hourlyData.map((pt, i) => ({ ...pt, pvNormKwPerKwc: preset.values[i] }));
        onUpdateHourlyData(updated);
        setFeedback({ type: 'success', message: `Profil solaire "${preset.name}" appliqué.` });
      }
    } else if (category === 'spot') {
      const preset = SPOT_PRICE_PRESETS[key];
      if (preset) {
        const updated = hourlyData.map((pt, i) => ({ ...pt, spotPriceEurPerMwh: preset.values[i] }));
        onUpdateHourlyData(updated);
        setFeedback({ type: 'success', message: `Profil de prix SPOT "${preset.name}" appliqué.` });
      }
    }
  };

  const handleExportProject = () => {
    const project = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      params,
      hourlyData
    };
    triggerLocalDownload('microgrid_project_config.json', JSON.stringify(project, null, 2), 'application/json');
  };

  const handleImportProject = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const json = JSON.parse(text);
        if (json.params) onUpdateParams(json.params);
        if (json.hourlyData && Array.isArray(json.hourlyData)) onUpdateHourlyData(json.hourlyData);
        setFeedback({ type: 'success', message: `Projet "${file.name}" restauré avec succès !` });
      } catch (err: unknown) {
        setFeedback({ type: 'error', message: 'Fichier projet JSON invalide.' });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                Gestion des Fichiers & Données (100% Local / Hors-Ligne)
              </h2>
              <p className="text-xs text-slate-400">
                Importez vos fichiers de prévisions (CSV/JSON), téléchargez des modèles ou exportez vos résultats.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback alert */}
        {feedback && (
          <div className={`mx-6 mt-4 p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60'
              : 'bg-rose-950/70 text-rose-300 border-rose-700/60'
          }`}>
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* 3 FILE SECTIONS: LOAD, PV, SPOT */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. LOAD FILE */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm text-orange-400">Courbe de Consommation</h3>
                  <span className="text-[10px] bg-orange-950/80 text-orange-300 px-1.5 py-0.5 rounded border border-orange-800/60">
                    kW
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  Charge non pilotable sur 24h (24 valeurs numériques, séparateur virgule ou point-virgule).
                </p>

                {/* Quick Presets */}
                <div className="space-y-1.5 mb-3">
                  <span className="text-[11px] text-slate-400 block font-medium">Profils types :</span>
                  <div className="flex flex-col gap-1 text-xs">
                    {Object.entries(LOAD_PRESETS).map(([k, p]) => (
                      <button
                        key={k}
                        onClick={() => handleLoadPreset('load', k)}
                        className="text-left px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] transition-colors border border-slate-800 hover:border-slate-700 truncate"
                        title={p.description}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-800">
                <input
                  type="file"
                  ref={loadInputRef}
                  accept=".csv,.txt,.json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f, 'load');
                  }}
                />
                <button
                  onClick={() => loadInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" /> Importer fichier Charge (CSV)
                </button>
                <button
                  onClick={() => triggerLocalDownload('modele_charge_consommation_24h.csv', generateLoadSampleCsv())}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-[11px] border border-slate-700 transition-colors"
                >
                  <Download className="w-3 h-3" /> Télécharger modèle CSV
                </button>
              </div>
            </div>

            {/* 2. PV NORM FILE */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm text-amber-400">Prévision PV Normalisée</h3>
                  <span className="text-[10px] bg-amber-950/80 text-amber-300 px-1.5 py-0.5 rounded border border-amber-800/60">
                    kW / kWc
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  Génération unitaire par kWc installé (valeurs entre 0 et ~0.90 kW/kWc).
                </p>

                {/* Quick Presets */}
                <div className="space-y-1.5 mb-3">
                  <span className="text-[11px] text-slate-400 block font-medium">Profils types météo :</span>
                  <div className="flex flex-col gap-1 text-xs">
                    {Object.entries(PV_NORM_PRESETS).map(([k, p]) => (
                      <button
                        key={k}
                        onClick={() => handleLoadPreset('pv', k)}
                        className="text-left px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] transition-colors border border-slate-800 hover:border-slate-700 truncate"
                        title={p.description}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-800">
                <input
                  type="file"
                  ref={pvInputRef}
                  accept=".csv,.txt,.json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f, 'pv');
                  }}
                />
                <button
                  onClick={() => pvInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" /> Importer fichier PV (CSV)
                </button>
                <button
                  onClick={() => triggerLocalDownload('modele_pv_normalise_24h.csv', generatePvNormSampleCsv())}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-[11px] border border-slate-700 transition-colors"
                >
                  <Download className="w-3 h-3" /> Télécharger modèle CSV
                </button>
              </div>
            </div>

            {/* 3. SPOT PRICES FILE */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm text-indigo-400">Prix SPOT Day-Ahead</h3>
                  <span className="text-[10px] bg-indigo-950/80 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-800/60">
                    € / MWh
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  Prix horaire du marché spot pour les 24 pas de temps de planification.
                </p>

                {/* Quick Presets */}
                <div className="space-y-1.5 mb-3">
                  <span className="text-[11px] text-slate-400 block font-medium">Profils marché SPOT :</span>
                  <div className="flex flex-col gap-1 text-xs">
                    {Object.entries(SPOT_PRICE_PRESETS).map(([k, p]) => (
                      <button
                        key={k}
                        onClick={() => handleLoadPreset('spot', k)}
                        className="text-left px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] transition-colors border border-slate-800 hover:border-slate-700 truncate"
                        title={p.description}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-800">
                <input
                  type="file"
                  ref={spotInputRef}
                  accept=".csv,.txt,.json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f, 'spot');
                  }}
                />
                <button
                  onClick={() => spotInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" /> Importer fichier SPOT (CSV)
                </button>
                <button
                  onClick={() => triggerLocalDownload('modele_prix_spot_24h.csv', generateSpotPriceSampleCsv())}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-[11px] border border-slate-700 transition-colors"
                >
                  <Download className="w-3 h-3" /> Télécharger modèle CSV
                </button>
              </div>
            </div>
          </div>

          {/* FULL EXPORT / IMPORT PROJECT & REPORT */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h4 className="font-semibold text-sm text-slate-200">
                Sauvegarde du Projet & Rapport Complet 24h
              </h4>
              <p className="text-xs text-slate-400">
                Exportez tous les résultats de la simulation (bilan énergétique, SOC, flux, coûts) ou sauvegardez l'état complet du micro-réseau.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => {
                  const csv = generateSimulationResultsCsv(simulationSteps, simulationSummary, params);
                  triggerLocalDownload('resultats_simulation_microreseau_24h.csv', csv);
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" /> Exporter Résultats (CSV)
              </button>

              <button
                onClick={handleExportProject}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
              >
                <Download className="w-4 h-4" /> Sauvegarder Projet (JSON)
              </button>

              <input
                type="file"
                ref={projectInputRef}
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportProject(f);
                }}
              />
              <button
                onClick={() => projectInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
              >
                <Upload className="w-4 h-4" /> Restaurer Projet (JSON)
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
