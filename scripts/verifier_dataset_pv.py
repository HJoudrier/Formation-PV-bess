#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Verification et statistiques du jeu de donnees PV (mesures + previsions).

Controle la coherence des fichiers produits par generer_dataset_pv.py :
  - completude (nombre de points, continuite des horodatages, pas de 1 min) ;
  - domaine de valeurs (toutes les valeurs dans [0, 1], nuit a 0) ;
  - couverture (chaque minute de l'annee vue par 4 previsions) ;
  - qualite de prevision : MAE / RMSE / biais par tranche d'echeance et par mois.

Aucune dependance externe.

Usage :
    python3 scripts/verifier_dataset_pv.py [--donnees data/pv] [--rapide]
"""

import argparse
import csv
import datetime as dt
import gzip
import io
import json
import math
import os

MINUTES_PER_DAY = 1440


def read_csv(path):
    """Lit un CSV eventuellement gzippe et renvoie (entetes, lignes)."""
    if path.endswith(".gz"):
        with gzip.open(path, "rt", encoding="ascii") as fh:
            rows = list(csv.reader(fh))
    else:
        with open(path, "r", encoding="ascii") as fh:
            rows = list(csv.reader(fh))
    return rows[0], rows[1:]


def parse_ts(s):
    return dt.datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--donnees", default="data/pv", help="repertoire du jeu de donnees")
    ap.add_argument("--rapide", action="store_true",
                    help="ne verifier qu'un run de prevision sur 20")
    args = ap.parse_args()

    root = args.donnees
    with open(os.path.join(root, "site.json"), encoding="utf-8") as fh:
        site = json.load(fh)
    year = site["annee"]
    errors = []

    # ------------------------------------------------------------------
    # 1. Mesures
    # ------------------------------------------------------------------
    print(f"== Mesures {year} ==")
    meas = {}
    total_points = 0
    for month in range(1, 13):
        cands = [os.path.join(root, "mesures", f"pv_mesure_{year}-{month:02d}{e}")
                 for e in (".csv.gz", ".csv")]
        path = next((c for c in cands if os.path.exists(c)), None)
        if path is None:
            errors.append(f"fichier de mesure manquant pour {year}-{month:02d}")
            continue
        header, rows = read_csv(path)
        if header != ["timestamp_utc", "pv_mesure_norm"]:
            errors.append(f"{path}: entete inattendue {header}")
        prev_t = None
        for ts, val in rows:
            t = parse_ts(ts)
            v = float(val)
            if not (0.0 <= v <= 1.0):
                errors.append(f"{path}: valeur hors [0,1] a {ts} ({v})")
            if prev_t is not None and (t - prev_t).total_seconds() != 60:
                errors.append(f"{path}: pas de temps != 60 s a {ts}")
            prev_t = t
            meas[t] = v
        total_points += len(rows)
        peak = max(float(r[1]) for r in rows)
        energy = sum(float(r[1]) for r in rows) / 60.0
        print(f"  {os.path.basename(path):26s} {len(rows):6d} pts  "
              f"pic={peak:.3f}  energie={energy:7.1f} h eq. pleine puissance")

    expected = ((dt.date(year + 1, 1, 1) - dt.date(year, 1, 1)).days) * MINUTES_PER_DAY
    print(f"  total : {total_points} points (attendu {expected})")
    if total_points != expected:
        errors.append(f"nombre de points de mesure {total_points} != {expected}")

    vals = sorted(meas.values())
    nz = [v for v in vals if v > 0]
    print(f"  min={vals[0]:.4f}  max={vals[-1]:.4f}  "
          f"moyenne={sum(vals) / len(vals):.4f}  "
          f"part de minutes productives={100 * len(nz) / len(vals):.1f} %")
    print(f"  energie annuelle : {sum(vals) / 60.0:.0f} h equivalent pleine puissance")

    # ------------------------------------------------------------------
    # 2. Previsions
    # ------------------------------------------------------------------
    print(f"\n== Previsions {year} (runs toutes les 6 h, horizon 24 h) ==")
    with open(os.path.join(root, "previsions", "index.csv"), encoding="ascii") as fh:
        index = list(csv.DictReader(fh))
    print(f"  runs references dans index.csv : {len(index)}")

    files = []
    for d in sorted(os.listdir(os.path.join(root, "previsions"))):
        sub = os.path.join(root, "previsions", d)
        if os.path.isdir(sub):
            files += [os.path.join(sub, f) for f in sorted(os.listdir(sub))]
    print(f"  fichiers de prevision presents  : {len(files)}")
    if len(files) != len(index):
        errors.append("index.csv et fichiers de prevision desynchronises")

    step = 20 if args.rapide else 1
    buckets = [[0.0, 0.0, 0.0, 0] for _ in range(4)]        # MAE, MSE, biais, n
    per_month = {m: [0.0, 0.0, 0] for m in range(1, 13)}
    coverage = {}
    checked = 0

    for k, path in enumerate(files):
        if k % step:
            continue
        header, rows = read_csv(path)
        if header != ["timestamp_utc", "horizon_min", "pv_prev_norm"]:
            errors.append(f"{path}: entete inattendue {header}")
        if len(rows) != MINUTES_PER_DAY:
            errors.append(f"{path}: {len(rows)} lignes au lieu de {MINUTES_PER_DAY}")
        t0 = parse_ts(rows[0][0])
        if t0.hour not in (0, 6, 12, 18) or t0.minute:
            errors.append(f"{path}: heure de run inattendue {t0}")
        for ts, lead, val in rows:
            t = parse_ts(ts)
            lead = int(lead)
            v = float(val)
            if not (0.0 <= v <= 1.0):
                errors.append(f"{path}: valeur hors [0,1] a {ts} ({v})")
            if t != t0 + dt.timedelta(minutes=lead):
                errors.append(f"{path}: horodatage incoherent avec l'echeance a {ts}")
            m = meas.get(t)
            if m is None:                       # echeances debordant sur l'annee n+1
                continue
            coverage[t] = coverage.get(t, 0) + 1
            if m == 0.0 and v == 0.0:           # nuit : exclue des statistiques
                continue
            e = v - m
            b = min(3, lead // 360)
            buckets[b][0] += abs(e)
            buckets[b][1] += e * e
            buckets[b][2] += e
            buckets[b][3] += 1
            pm = per_month[t.month]
            pm[0] += abs(e)
            pm[1] += e * e
            pm[2] += 1
        checked += 1

    print(f"  fichiers verifies : {checked}")

    if not args.rapide:
        counts = {}
        for c in coverage.values():
            counts[c] = counts.get(c, 0) + 1
        print(f"  couverture des minutes de l'annee : {counts} "
              f"(4 = chaque minute prevue par 4 runs)")
        if set(counts) - {4}:
            n_bad = sum(v for c, v in counts.items() if c != 4)
            if n_bad > MINUTES_PER_DAY:         # tolerance : bords de periode
                errors.append(f"{n_bad} minutes ne sont pas couvertes par 4 runs")

    print("\n  Erreur de prevision par tranche d'echeance "
          "(% de la puissance installee, hors nuit) :")
    labels = ["0-6 h", "6-12 h", "12-18 h", "18-24 h"]
    for b in range(4):
        sae, sse, sbias, n = buckets[b]
        if n:
            print(f"    {labels[b]:8s} MAE={100 * sae / n:5.2f} %  "
                  f"RMSE={100 * math.sqrt(sse / n):5.2f} %  "
                  f"biais={100 * sbias / n:+5.2f} %  ({n} points)")

    print("\n  RMSE par mois (% de la puissance installee, hors nuit) :")
    line = "   "
    for m in range(1, 13):
        sae, sse, n = per_month[m]
        line += f" {m:02d}:{100 * math.sqrt(sse / n) if n else 0:5.2f}"
    print(line)

    # ------------------------------------------------------------------
    print("\n== Bilan ==")
    if errors:
        print(f"  {len(errors)} anomalie(s) :")
        for e in errors[:20]:
            print(f"   - {e}")
        return 1
    print("  Aucune anomalie detectee.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
