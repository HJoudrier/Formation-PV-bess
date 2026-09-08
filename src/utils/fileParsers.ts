import { HourlyDataPoint, MicrogridParameters, SimulationStepResult, SimulationSummary } from '../types';

/**
 * Parses numeric values from CSV or text content.
 * Accepts 24 lines, or comma/semicolon-separated values, supporting French decimal comma.
 */
export function parseNumericArrayFromText(text: string): { values: number[]; error?: string } {
  try {
    const trimmed = text.trim();
    if (!trimmed) {
      return { values: [], error: 'Le fichier est vide.' };
    }

    // Try parsing as JSON first
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const json = JSON.parse(trimmed);
        if (Array.isArray(json)) {
          const numbers = json.map((item) => {
            if (typeof item === 'number') return item;
            if (typeof item === 'object' && item !== null) {
              const val = item.value ?? item.val ?? item.loadKw ?? item.pvNorm ?? item.price;
              return Number(val) || 0;
            }
            return Number(item) || 0;
          });
          if (numbers.length >= 24) {
            return { values: numbers.slice(0, 24) };
          } else if (numbers.length > 0) {
            // pad with last or zero up to 24
            while (numbers.length < 24) numbers.push(numbers[numbers.length - 1] || 0);
            return { values: numbers };
          }
        }
      } catch {
        // Fall through to CSV parser
      }
    }

    // CSV / text lines parsing
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const numbers: number[] = [];

    for (const line of lines) {
      // Split by semicolon, comma, or tab
      const parts = line.split(/[;,\t]/).map((p) => p.trim());
      // Look for a numeric token
      let foundNum: number | null = null;
      for (const part of parts) {
        // replace French comma with dot
        const sanitized = part.replace(',', '.');
        const num = parseFloat(sanitized);
        if (!isNaN(num) && isFinite(num)) {
          foundNum = num;
          // Prefer second column if first column is just index/hour (0 to 23)
          if (parts.length >= 2 && numbers.length < 24 && Math.abs(num - numbers.length) < 0.001) {
            // First column looks like index, check next column
            const secondPart = parts[1].replace(',', '.');
            const secondNum = parseFloat(secondPart);
            if (!isNaN(secondNum)) {
              foundNum = secondNum;
              break;
            }
          }
          break;
        }
      }

      if (foundNum !== null) {
        numbers.push(foundNum);
      }
    }

    if (numbers.length === 0) {
      return { values: [], error: 'Aucune valeur numérique valide détectée dans le fichier.' };
    }

    if (numbers.length < 24) {
      // Pad to 24
      while (numbers.length < 24) {
        numbers.push(numbers[numbers.length - 1]);
      }
    }

    return { values: numbers.slice(0, 24) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue de lecture';
    return { values: [], error: `Erreur lors de la lecture : ${message}` };
  }
}

/**
 * Downloads a file to client machine locally without any external network request.
 */
export function triggerLocalDownload(filename: string, content: string, mimeType: string = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates sample CSV template for Load Consumption
 */
export function generateLoadSampleCsv(): string {
  let csv = 'Heure;Consommation_kW\n';
  const defaults = [
    12.0, 11.5, 11.0, 11.0, 12.5, 15.0,
    22.0, 36.0, 48.0, 52.0, 50.0, 49.0,
    45.0, 47.0, 54.0, 55.0, 51.0, 42.0,
    30.0, 24.0, 20.0, 17.0, 14.5, 13.0
  ];
  defaults.forEach((val, idx) => {
    csv += `${idx}:00;${val.toFixed(1).replace('.', ',')}\n`;
  });
  return csv;
}

/**
 * Generates sample CSV template for Normalized Solar PV Production (kW/kWc)
 */
export function generatePvNormSampleCsv(): string {
  let csv = 'Heure;Production_Normalisee_kW_par_kWc\n';
  const defaults = [
    0.0, 0.0, 0.0, 0.0, 0.0, 0.02,
    0.10, 0.28, 0.48, 0.65, 0.78, 0.84,
    0.85, 0.81, 0.72, 0.58, 0.40, 0.22,
    0.08, 0.01, 0.0, 0.0, 0.0, 0.0
  ];
  defaults.forEach((val, idx) => {
    csv += `${idx}:00;${val.toFixed(2).replace('.', ',')}\n`;
  });
  return csv;
}

/**
 * Generates sample CSV template for SPOT Day-Ahead Prices (€/MWh)
 */
export function generateSpotPriceSampleCsv(): string {
  let csv = 'Heure;Prix_SPOT_EUR_MWh\n';
  const defaults = [
    54.2, 48.6, 45.1, 44.0, 46.8, 58.3,
    85.4, 115.8, 138.5, 122.0, 88.4, 62.5,
    42.1, 38.6, 46.5, 68.0, 92.4, 128.6,
    162.5, 175.4, 154.0, 112.5, 82.0, 64.0
  ];
  defaults.forEach((val, idx) => {
    csv += `${idx}:00;${val.toFixed(2).replace('.', ',')}\n`;
  });
  return csv;
}

/**
 * Generates full simulation report CSV for 24h
 */
export function generateSimulationResultsCsv(
  steps: SimulationStepResult[],
  summary: SimulationSummary,
  params: MicrogridParameters
): string {
  let csv = `# PLANIFICATION MICRO-RESEAU 24H\n`;
  csv += `# Dimensionnement PV: ${params.pvInstalledKwc} kWc (CAPEX: ${summary.pvCapexEur} €)\n`;
  csv += `# Dimensionnement Batterie: ${params.batteryCapacityKwh} kWh / ${params.batteryPowerKw} kW (CAPEX: ${summary.batteryTotalCapexEur} €)\n`;
  csv += `# Limite Reseau: ${params.gridMaxPowerKw} kW | Couts Electricite 24h: ${summary.dailyNetCostEur.toFixed(2)} €\n`;
  csv += `# Taux Autoconsommation: ${summary.selfConsumptionRatePercent.toFixed(1)}% | Taux Autonomie: ${summary.selfSufficiencyRatePercent.toFixed(1)}%\n\n`;

  csv += 'Heure;Charge_kW;Production_PV_kW;Consigne_Batterie_kW;Batterie_Reelle_kW;SOC_kWh;SOC_Pourcent;Import_Reseau_kW;Export_Reseau_kW;Prix_SPOT_EUR_MWh;Deficit_Non_Couvert_kW;Cout_Horaire_EUR\n';

  for (const s of steps) {
    const line = [
      s.label,
      s.loadKw.toFixed(2),
      s.pvGenKw.toFixed(2),
      s.batteryCmdKw.toFixed(2),
      s.batteryActualKw.toFixed(2),
      s.batterySocKwh.toFixed(2),
      s.batterySocPercent.toFixed(1),
      s.gridImportKw.toFixed(2),
      s.gridExportKw.toFixed(2),
      s.spotPriceEurPerMwh.toFixed(2),
      s.unservedLoadKw.toFixed(2),
      s.costEur.toFixed(2)
    ].join(';').replace(/\./g, ',');
    csv += line + '\n';
  }

  return csv;
}
