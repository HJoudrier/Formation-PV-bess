# Jeu de données PV — prévisions à 6 h d'intervalle + production mesurée

Jeu de données **synthétique mais physiquement réaliste** de production
photovoltaïque, destiné aux exercices de la formation (dimensionnement PV/BESS,
pilotage sur prévision, calcul d'erreur de prévision, arbitrage day-ahead /
intraday).

| | |
|---|---|
| Site | Centrale PV fictive des Mées — Alpes-de-Haute-Provence (04), France |
| Coordonnées | 43,94 °N / 5,98 °E, 420 m |
| Configuration | Silicium cristallin, structure fixe, inclinaison 25°, plein sud |
| Période | 1<sup>er</sup> janvier → 31 décembre 2025 (365 jours) |
| Pas de temps | **1 minute** |
| Prévisions | **4 runs par jour** (00, 06, 12, 18 UTC), horizon **24 h** → 1 460 fichiers |
| Mesures | 525 600 points, 12 fichiers mensuels |
| Unité | **valeur normalisée entre 0 et 1** (1 = 100 % de la puissance PV installée) |

---

## 1. Arborescence

```
data/pv/
├── site.json                              métadonnées du site et du jeu de données
├── mesures/
│   └── pv_mesure_2025-01.csv.gz … 2025-12.csv.gz      12 fichiers, 1 par mois
├── previsions/
│   ├── index.csv                          catalogue des 1 460 runs (+ scores)
│   ├── 2025-01/
│   │   ├── pv_prev_20250101T00Z.csv.gz    run du 01/01 à 00:00 UTC, horizon 24 h
│   │   ├── pv_prev_20250101T06Z.csv.gz
│   │   ├── pv_prev_20250101T12Z.csv.gz
│   │   └── pv_prev_20250101T18Z.csv.gz    (4 fichiers par jour)
│   └── … 2025-12/
└── exemples/                              journée du 21/06/2025 en CSV **non compressé**
    ├── pv_mesure_2025-06-21.csv           (ouvrable directement dans un tableur)
    └── pv_prev_20250621T{00,06,12,18}Z.csv
```

Les fichiers sont compressés en `gzip` (20 Mo au total, ~80 Mo décompressés).
Le dossier `exemples/` contient une journée en clair pour inspection rapide.

## 2. Format des fichiers

CSV, séparateur `,`, décimale `.`, encodage ASCII, horodatage **ISO 8601 UTC**
(heure locale = UTC+1 en hiver, UTC+2 en été — l'UTC évite l'ambiguïté des
changements d'heure).

**Mesure** — `mesures/pv_mesure_AAAA-MM.csv.gz`

```
timestamp_utc,pv_mesure_norm
2025-05-01T11:58:00Z,0.6187
2025-05-01T11:59:00Z,0.6006
```

**Prévision** — `previsions/AAAA-MM/pv_prev_AAAAMMJJTHHZ.csv.gz`
(la date/heure du run est dans le nom du fichier)

```
timestamp_utc,horizon_min,pv_prev_norm
2025-06-21T12:00:00Z,0,0.9153
2025-06-21T12:01:00Z,1,0.9137
```

* `horizon_min` : échéance en minutes depuis l'heure du run (0 → 1439).
* Chaque fichier contient exactement 1 440 lignes = 24 h au pas minute.
* Chaque minute de l'année est ainsi couverte par **4 prévisions** d'échéances
  différentes (utile pour comparer intraday et day-ahead).

**Catalogue** — `previsions/index.csv` : une ligne par run
(`run_utc`, `fichier`, `horizon_min`, `pas_min`, `energie_prevue_h`,
`energie_mesuree_h`, `mae`, `rmse`). Les trois dernières colonnes sont
calculées *a posteriori* par comparaison à la mesure : elles servent à
sélectionner rapidement des cas d'étude (bonne / mauvaise prévision), pas à
alimenter un modèle.

## 3. Normalisation

`valeur = puissance AC injectée / puissance de pointe de la centrale`

* `0.0` = production nulle (nuit, ou occultation totale) ;
* `1.0` = 100 % de la puissance PV installée.

La référence est le maximum annuel de production par ciel clair (panneaux
propres, module froid). La valeur 1,0 est effectivement atteinte quelques
minutes dans l'année (avril, mai, août) ; les valeurs sont écrêtées à 1,0, ce
qui reproduit la limitation par l'onduleur.

Pour obtenir des kW, multiplier par la puissance crête : une centrale de
500 kWc donne `0.6187 × 500 = 309 kW`. Le productible annuel du jeu de données
est de **1 573 h équivalent pleine puissance** (≈ 1 573 kWh par kW de puissance
de pointe), cohérent avec un site méditerranéen.

Répartition mensuelle (h équivalent pleine puissance) :

| Jan | Fév | Mar | Avr | Mai | Juin | Juil | Août | Sep | Oct | Nov | Déc |
|----:|----:|----:|----:|----:|-----:|-----:|-----:|----:|----:|----:|----:|
| 76 | 99 | 96 | 151 | 191 | 169 | 213 | 198 | 165 | 100 | 51 | 65 |

## 4. Comment les données ont été construites

Tout est produit par `scripts/generer_dataset_pv.py` (Python, bibliothèque
standard uniquement, tirages aléatoires **reproductibles**, graine 20250101).

**Production mesurée**

1. Géométrie solaire à la minute (déclinaison et équation du temps de Spencer,
   angle horaire, masse d'air de Kasten & Young).
2. Irradiance par ciel clair (transmission directe de Meinel + diffus).
3. Nébulosité stochastique : régime journalier tiré selon une climatologie
   mensuelle méditerranéenne (journée claire / variable / couverte, avec
   persistance d'un jour sur l'autre), modulation lente (processus
   d'Ornstein-Uhlenbeck, τ = 90 min) et **passages nuageux** discrets (arrivées
   poissonniennes, durées log-normales, bords adoucis, surirradiance de bord de
   nuage). C'est ce qui crée la variabilité minute caractéristique du PV.
4. Décomposition direct / diffus (corrélation d'Erbs) et transposition sur le
   plan des modules (modèle isotrope + albédo 0,20).
5. Conversion en puissance : température de cellule (modèle NOCT), coefficient
   de puissance −0,36 %/°C, pertes système 4,5 %, salissure évolutive (lavée
   par les journées de pluie), rendement d'onduleur dépendant de la charge.

**Prévisions**

Chaque run est construit à partir d'une version **lissée** de la nébulosité —
un modèle météo ne résout pas les fluctuations minute — dégradée par trois
erreurs qui croissent avec l'échéance :

1. lissage croissant (fenêtre 21 → 165 min) : les passages nuageux fins
   disparaissent de la prévision ;
2. erreur de calage temporel (jusqu'à ± 60 min à 24 h) : le système nuageux
   arrive trop tôt ou trop tard ;
3. biais multiplicatif sur l'indice de ciel clair (marche aléatoire lente),
   modulé par la **prédictibilité de la journée** : une journée anticyclonique
   claire est bien mieux prévue qu'une journée à passages nuageux.

Conséquence pédagogique : les 4 runs qui couvrent une même journée
**convergent** vers la réalité à mesure que l'échéance se réduit.

## 5. Qualité de prévision obtenue

Erreurs en % de la puissance installée, heures de jour uniquement, sur l'année :

| Échéance | MAE | RMSE | Biais |
|---|---:|---:|---:|
| 0 – 6 h | 2,34 % | 4,04 % | −0,04 % |
| 6 – 12 h | 3,98 % | 6,49 % | −0,12 % |
| 12 – 18 h | 5,35 % | 8,61 % | −0,38 % |
| 18 – 24 h | 6,75 % | 10,87 % | −1,24 % |

Ordres de grandeur conformes à ce qu'on observe sur une centrale unique
(intraday nettement meilleur que le day-ahead, léger biais bas à longue
échéance). L'erreur est maximale au printemps et à l'automne (mars : RMSE
9,9 %) et minimale en été (juin : 6,3 %).

## 6. Utilisation

```python
import pandas as pd, glob

# Mesure de l'année complète (gzip lu directement par pandas)
mes = pd.concat(
    pd.read_csv(f, parse_dates=["timestamp_utc"])
    for f in sorted(glob.glob("data/pv/mesures/pv_mesure_2025-*.csv.gz"))
).set_index("timestamp_utc")

# Un run de prévision
prev = pd.read_csv("data/pv/previsions/2025-06/pv_prev_20250621T06Z.csv.gz",
                   parse_dates=["timestamp_utc"]).set_index("timestamp_utc")

# Erreur de prévision par échéance
cmp = prev.join(mes)
cmp["erreur"] = cmp["pv_prev_norm"] - cmp["pv_mesure_norm"]
print(cmp.groupby(cmp["horizon_min"] // 360)["erreur"].agg(
    mae=lambda s: s.abs().mean(), rmse=lambda s: (s**2).mean()**0.5))
```

En ligne de commande : `zcat data/pv/mesures/pv_mesure_2025-07.csv.gz | head`.
Pour un tableur, utiliser `data/pv/exemples/` (déjà décompressé) ou
`gunzip -k` sur le fichier voulu.

Régénérer ou vérifier le jeu de données :

```bash
python3 scripts/generer_dataset_pv.py --sortie data/pv    # ~20 s, reproductible
python3 scripts/verifier_dataset_pv.py --donnees data/pv  # contrôles + statistiques
```

Options utiles : `--annee`, `--graine` (autre tirage météo),
`--sans-compression` (CSV bruts), `--jour-exemple AAAA-MM-JJ`.

## 7. Points d'attention

* Données **synthétiques** : elles reproduisent la physique et la statistique
  d'une centrale méditerranéenne, mais ne correspondent à aucune installation
  réelle et ne remplacent pas des mesures d'exploitation.
* La série de mesure ne contient **ni panne, ni écrêtement réseau, ni
  maintenance** : tout écart prévision/mesure est d'origine météorologique.
* Les runs des 1<sup>er</sup> janvier 00, 06 et 12 UTC sont les seuls dont
  certaines minutes ne sont pas couvertes par 4 prévisions (début de période).
* Les 24 dernières heures prévues par le run du 31/12 18 UTC débordent sur 2026
  et n'ont donc pas de mesure associée.
* Toutes les valeurs sont bornées à l'intervalle [0 ; 1] et arrondies à 4
  décimales (résolution 0,01 % de la puissance installée).
