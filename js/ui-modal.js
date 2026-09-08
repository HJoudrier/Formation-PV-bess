/* ==========================================================================
   Modale de gestion des fichiers et donnees (100% local / hors-ligne).
   ========================================================================== */
(function (global) {
  'use strict';

  var esc = MGDom.esc;

  var SECTIONS = [
    {
      kind: 'load', title: 'Courbe de Consommation', unit: 'kW', tone: 'orange',
      desc: 'Charge non pilotable sur 24h (24 valeurs numériques, séparateur virgule ou point-virgule).',
      presetsLabel: 'Profils types :', btn: 'Importer fichier Charge (CSV)', btnCls: 'btn-orange',
      sample: 'modele_charge_consommation_24h.csv'
    },
    {
      kind: 'pv', title: 'Prévision PV Normalisée', unit: 'kW / kWc', tone: 'amber',
      desc: 'Génération unitaire par kWc installé (valeurs entre 0 et ~0.90 kW/kWc).',
      presetsLabel: 'Profils types météo :', btn: 'Importer fichier PV (CSV)', btnCls: 'btn-amber',
      sample: 'modele_pv_normalise_24h.csv'
    },
    {
      kind: 'spot', title: 'Prix SPOT Day-Ahead', unit: '€ / MWh', tone: 'indigo',
      desc: 'Prix horaire du marché spot pour les 24 pas de temps de planification.',
      presetsLabel: 'Profils marché SPOT :', btn: 'Importer fichier SPOT (CSV)', btnCls: 'btn-indigo',
      sample: 'modele_prix_spot_24h.csv'
    }
  ];

  function presetsOf(kind) {
    return kind === 'load' ? MGData.LOAD_PRESETS
      : kind === 'pv' ? MGData.PV_NORM_PRESETS
      : MGData.SPOT_PRICE_PRESETS;
  }

  function sampleOf(kind) {
    return kind === 'load' ? MGFiles.generateLoadSampleCsv()
      : kind === 'pv' ? MGFiles.generatePvNormSampleCsv()
      : MGFiles.generateSpotPriceSampleCsv();
  }

  function create(store) {
    var root = MGDom.el('<div class="modal-backdrop hidden"></div>');
    var feedback = null;

    root.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" aria-label="Gestion des fichiers et données">' +
      '<div class="modal-head">' +
      '<div class="panel-head-main">' + Icons.get('fileText', 't-emerald', 20) +
      '<div><h2 class="panel-title">Gestion des Fichiers &amp; Données (100% Local / Hors-Ligne)</h2>' +
      '<p class="panel-subtitle">Importez vos fichiers de prévisions (CSV/JSON), téléchargez des modèles ou exportez vos résultats.</p>' +
      '</div></div>' +
      '<button class="modal-close" data-action="close" aria-label="Fermer">' + Icons.get('x', '', 20) + '</button>' +
      '</div>' +
      '<div class="modal-body">' +
      '<div class="feedback-slot"></div>' +
      '<div class="grid grid-files">' +
      SECTIONS.map(function (sec) {
        var presets = presetsOf(sec.kind);
        return '<div class="file-card"><div>' +
          '<div class="file-card-head"><h3 class="t-' + sec.tone + '">' + esc(sec.title) + '</h3>' +
          '<span class="unit-tag ' + sec.tone + '">' + esc(sec.unit) + '</span></div>' +
          '<p class="text-xs t-slate" style="margin-bottom:0.75rem">' + esc(sec.desc) + '</p>' +
          '<span class="text-11 t-slate" style="display:block;margin-bottom:0.375rem;font-weight:500">' +
          esc(sec.presetsLabel) + '</span>' +
          '<div class="preset-list">' +
          Object.keys(presets).map(function (k) {
            return '<button class="preset-btn" data-preset="' + sec.kind + ':' + k + '" title="' +
              esc(presets[k].description) + '">' + esc(presets[k].name) + '</button>';
          }).join('') +
          '</div></div>' +
          '<div class="file-actions">' +
          '<input type="file" accept=".csv,.txt,.json" class="hidden" data-file="' + sec.kind + '">' +
          '<button class="btn btn-block ' + sec.btnCls + '" data-pick="' + sec.kind + '">' +
          Icons.get('upload', '', 14) + ' ' + esc(sec.btn) + '</button>' +
          '<button class="btn btn-block btn-ghost btn-sm" data-sample="' + sec.kind + '">' +
          Icons.get('download', '', 12) + ' Télécharger modèle CSV</button>' +
          '</div></div>';
      }).join('') +
      '</div>' +
      '<div class="export-bar">' +
      '<div><h4 class="panel-title" style="font-size:0.875rem">Sauvegarde du Projet &amp; Rapport Complet 24h</h4>' +
      '<p class="panel-subtitle">Exportez tous les résultats de la simulation (bilan énergétique, SOC, flux, coûts) ' +
      'ou sauvegardez l\'état complet du micro-réseau.</p></div>' +
      '<div class="export-actions">' +
      '<button class="btn btn-primary" data-action="export-csv">' + Icons.get('download', '', 15) +
      ' Exporter Résultats (CSV)</button>' +
      '<button class="btn" data-action="export-json">' + Icons.get('download', '', 15) +
      ' Sauvegarder Projet (JSON)</button>' +
      '<input type="file" accept=".json" class="hidden" data-file="project">' +
      '<button class="btn" data-pick="project">' + Icons.get('upload', '', 15) +
      ' Restaurer Projet (JSON)</button>' +
      '</div></div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn" data-action="close">Fermer</button></div>' +
      '</div>';

    var feedbackSlot = root.querySelector('.feedback-slot');

    function say(type, message) {
      feedback = { type: type, message: message };
      renderFeedback();
    }

    function renderFeedback() {
      if (!feedback) { feedbackSlot.innerHTML = ''; return; }
      feedbackSlot.innerHTML =
        '<div class="alert alert-' + feedback.type + '">' +
        Icons.get(feedback.type === 'success' ? 'checkCircle' : 'alertTriangle', '', 15) +
        '<span>' + esc(feedback.message) + '</span></div>';
    }

    function readCurve(file, kind) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var parsed = MGFiles.parseNumericArrayFromText(e.target.result);
        if (parsed.error || !parsed.values.length) {
          say('error', parsed.error || 'Erreur lors de la lecture du fichier.');
          return;
        }
        store.setCurve(kind, parsed.values);
        say('success', 'Fichier "' + file.name + '" importé avec succès pour ' +
          (kind === 'load' ? 'la consommation' : kind === 'pv' ? 'la production PV normalisée' : 'les prix SPOT') +
          ' (24 pas de temps).');
      };
      reader.onerror = function () { say('error', 'Impossible de lire le fichier.'); };
      reader.readAsText(file);
    }

    function readProject(file) {
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var json = JSON.parse(e.target.result);
          store.restoreProject(json);
          say('success', 'Projet "' + file.name + '" restauré avec succès !');
        } catch (err) {
          say('error', 'Fichier projet JSON invalide.');
        }
      };
      reader.onerror = function () { say('error', 'Impossible de lire le fichier.'); };
      reader.readAsText(file);
    }

    root.addEventListener('change', function (e) {
      var input = e.target.closest('[data-file]');
      if (!input || !input.files || !input.files[0]) return;
      var kind = input.getAttribute('data-file');
      if (kind === 'project') readProject(input.files[0]);
      else readCurve(input.files[0], kind);
      input.value = ''; // permet de re-importer le meme fichier
    });

    root.addEventListener('click', function (e) {
      if (e.target === root) { store.closeModal(); return; }

      var pick = e.target.closest('[data-pick]');
      if (pick) {
        root.querySelector('[data-file="' + pick.getAttribute('data-pick') + '"]').click();
        return;
      }

      var preset = e.target.closest('[data-preset]');
      if (preset) {
        var parts = preset.getAttribute('data-preset').split(':');
        var def = presetsOf(parts[0])[parts[1]];
        if (def) {
          store.setCurve(parts[0], def.values);
          say('success',
            (parts[0] === 'load' ? 'Profil charge "' : parts[0] === 'pv' ? 'Profil solaire "' : 'Profil de prix SPOT "') +
            def.name + '" appliqué.');
        }
        return;
      }

      var sample = e.target.closest('[data-sample]');
      if (sample) {
        var kind = sample.getAttribute('data-sample');
        var sec = SECTIONS.filter(function (x) { return x.kind === kind; })[0];
        MGFiles.triggerLocalDownload(sec.sample, sampleOf(kind));
        return;
      }

      if (e.target.closest('[data-action="close"]')) { store.closeModal(); return; }

      var st = store.state();
      if (e.target.closest('[data-action="export-csv"]')) {
        MGFiles.triggerLocalDownload('resultats_simulation_microreseau_24h.csv',
          MGFiles.generateSimulationResultsCsv(st.simulation.steps, st.simulation.summary, st.params));
        return;
      }
      if (e.target.closest('[data-action="export-json"]')) {
        MGFiles.triggerLocalDownload('microgrid_project_config.json', JSON.stringify({
          version: '1.0',
          timestamp: new Date().toISOString(),
          params: st.params,
          hourlyData: st.hourlyData
        }, null, 2), 'application/json');
      }
    });

    function update(state) {
      var open = state.isModalOpen;
      root.classList.toggle('hidden', !open);
      if (!open) { feedback = null; renderFeedback(); }
    }

    return { el: root, update: update };
  }

  global.MGModal = { create: create };
})(window);
