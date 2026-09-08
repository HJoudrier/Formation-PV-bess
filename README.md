# Microgrid Planner — Dimensionnement & Pilotage

Outil de formation pour dimensionner et piloter un micro-réseau électrique
(photovoltaïque, batterie BESS, charge non pilotable, raccordement réseau et
marché SPOT) sur un horizon de 24 heures.

## Utilisation

**Ouvrez `index.html` dans un navigateur.** C'est tout.

Aucune installation, aucune compilation, aucune connexion internet :
téléchargez le dépôt, double-cliquez sur `index.html`, l'application démarre.
Elle fonctionne aussi bien depuis le disque (`file://`) que servie par
n'importe quel serveur web statique, GitHub Pages compris.

## Contenu

| Fichier | Rôle |
| --- | --- |
| `index.html` | Page unique : charge le style puis les scripts |
| `css/styles.css` | Toute la mise en forme |
| `js/data.js` | Profils types (charge, PV, prix SPOT) et paramètres par défaut |
| `js/engine.js` | Moteur de simulation 24h : bilan de puissance, SOC, coûts |
| `js/strategies.js` | Stratégies automatiques de pilotage batterie |
| `js/files.js` | Import CSV/JSON, export des résultats, modèles de fichiers |
| `js/chart.js` | Moteur de graphiques SVG |
| `js/icons.js` | Jeu d'icônes SVG |
| `js/dom.js` | Utilitaires DOM partagés |
| `js/ui-*.js` | Composants d'interface |
| `js/app.js` | État applicatif et assemblage |

## Fonctionnalités

- **Synoptique animé** : flux de puissance instantanés entre réseau, PV,
  batterie et charge, heure par heure.
- **Graphiques 24h** : équilibre des puissances, état de charge de la
  batterie, prix SPOT et facturation.
- **Dimensionnement** : puissance PV, capacité et puissance batterie, limite
  de raccordement, avec calcul du CAPEX en direct.
- **Pilotage batterie** : consignes horaires manuelles ou stratégies
  automatiques (autoconsommation, arbitrage SPOT, écrêtage, zéro injection).
- **Import / export** : courbes au format CSV ou JSON, export des résultats,
  sauvegarde et restauration du projet — le tout en local.

## Notes techniques

Le code n'utilise aucune bibliothèque externe ni étape de build. Les scripts
sont des scripts classiques chargés dans l'ordre de leurs dépendances, ce qui
est indispensable pour que la page fonctionne en `file://` : les modules ES et
les requêtes `fetch` y sont bloqués par le navigateur.

Le pas de temps de la simulation est d'une heure. Le rendement aller-retour de
la batterie est réparti à parts égales entre charge et décharge (racine
carrée), et les bornes SOC min/max sont respectées à chaque pas.
