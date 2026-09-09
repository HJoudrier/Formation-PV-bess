#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generateur du jeu de donnees "prevision / mesure" de production photovoltaique.

Produit, pour une centrale PV fictive situee en Provence (France) :
  - la MESURE de production realisee, au pas de temps 1 minute, sur 1 an ;
  - une PREVISION toutes les 6 h (runs 00/06/12/18 UTC), horizon 24 h,
    au pas de temps 1 minute, soit 4 x 365 = 1460 fichiers.

Toutes les valeurs sont normalisees entre 0 et 1 (1 = 100 % de la puissance
de pointe de la centrale, cf. data/pv/README.md).

Aucune dependance externe : uniquement la bibliotheque standard Python.

Usage :
    python3 scripts/generer_dataset_pv.py [--sortie data/pv] [--annee 2025] [--graine 20250101]
"""

import argparse
import datetime as dt
import gzip
import json
import math
import os
import random
from array import array

# --------------------------------------------------------------------------
# 1. Site et centrale (parametres physiques)
# --------------------------------------------------------------------------

SITE = {
    "nom": "Centrale PV des Mees (fictive)",
    "commune": "Les Mees, Alpes-de-Haute-Provence (04), France",
    "latitude_deg": 43.94,
    "longitude_deg": 5.98,
    "altitude_m": 420,
    "fuseau": "Europe/Paris (UTC+1 hiver / UTC+2 ete)",
    "technologie": "Silicium cristallin, structure fixe",
    "inclinaison_deg": 25.0,
    "azimut_deg": 180.0,           # 180 = plein sud
    "albedo": 0.20,
}

TILT = math.radians(SITE["inclinaison_deg"])
LAT = math.radians(SITE["latitude_deg"])
LON = SITE["longitude_deg"]

C_DIFF = (1.0 + math.cos(TILT)) / 2.0            # facteur ciel diffus isotrope
C_GRND = SITE["albedo"] * (1.0 - math.cos(TILT)) / 2.0  # facteur albedo sol

NOCT = 45.0          # temperature nominale de cellule (degC)
GAMMA_P = -0.0036    # coefficient de puissance (/degC)
SYSTEM_LOSS = 0.955  # cablage, mismatch, connectique (hors salissure et onduleur)
SOLAR_CONST = 1367.0 # constante solaire (W/m2)

# Statistiques mensuelles de nebulosite (climat mediterraneen)
#   mois -> (probabilite de journee claire, probabilite de journee couverte)
CLOUD_CLIMATE = {
    1:  (0.40, 0.30), 2:  (0.42, 0.27), 3:  (0.45, 0.25), 4:  (0.40, 0.27),
    5:  (0.45, 0.22), 6:  (0.55, 0.15), 7:  (0.70, 0.08), 8:  (0.65, 0.10),
    9:  (0.55, 0.18), 10: (0.42, 0.28), 11: (0.35, 0.35), 12: (0.38, 0.33),
}

# Modele d'erreur de prevision (multiplicatif sur l'indice de ciel clair)
ERR_SIGMA_0 = 0.115      # niveau d'erreur a echeance nulle
ERR_SIGMA_24 = 0.46      # supplement d'erreur a 24 h d'echeance
ERR_SHIFT_MAX = 60.0     # erreur de calage temporel max (minutes) a 24 h
SMOOTH_WINDOWS = (21, 75, 165)  # lissage "modele meteo" (minutes)

MINUTES_PER_DAY = 1440


# --------------------------------------------------------------------------
# 2. Geometrie solaire et ciel clair
# --------------------------------------------------------------------------

def solar_geometry(n_minutes, start):
    """Precalcule, pour chaque minute, les grandeurs de ciel clair.

    Renvoie (ghi_cs, kt_cs, c_beam, sun_up) ou :
      ghi_cs  : irradiance globale horizontale par ciel clair (W/m2)
      kt_cs   : indice de clarte par ciel clair (GHI_cs / irradiance extraterrestre)
      c_beam  : facteur de transposition du direct sur le plan des modules
      sun_up  : 1 si le soleil est leve
    """
    ghi_cs = array("f", bytes(4 * n_minutes))
    kt_cs = array("f", bytes(4 * n_minutes))
    c_beam = array("f", bytes(4 * n_minutes))
    sun_up = bytearray(n_minutes)

    sin_lat, cos_lat = math.sin(LAT), math.cos(LAT)
    sin_tilt, cos_tilt = math.sin(TILT), math.cos(TILT)
    two_pi = 2.0 * math.pi

    for i in range(n_minutes):
        t = start + dt.timedelta(minutes=i)
        doy = t.timetuple().tm_yday
        utc_min = t.hour * 60.0 + t.minute

        # angle journalier (Spencer)
        g = two_pi * (doy - 1 + (utc_min / 60.0 - 12.0) / 24.0) / 365.0
        decl = (0.006918 - 0.399912 * math.cos(g) + 0.070257 * math.sin(g)
                - 0.006758 * math.cos(2 * g) + 0.000907 * math.sin(2 * g)
                - 0.002697 * math.cos(3 * g) + 0.001480 * math.sin(3 * g))
        eot = 229.18 * (0.000075 + 0.001868 * math.cos(g) - 0.032077 * math.sin(g)
                        - 0.014615 * math.cos(2 * g) - 0.040849 * math.sin(2 * g))

        solar_min = utc_min + 4.0 * LON + eot
        ha = math.radians(solar_min / 4.0 - 180.0)

        sin_decl, cos_decl = math.sin(decl), math.cos(decl)
        cosz = sin_lat * sin_decl + cos_lat * cos_decl * math.cos(ha)
        if cosz <= 0.015:            # soleil sous l'horizon (ou rasant)
            continue

        zen_deg = math.degrees(math.acos(min(1.0, cosz)))
        # masse d'air (Kasten & Young)
        am = 1.0 / (cosz + 0.50572 * (96.07995 - zen_deg) ** -1.6364)

        e0 = SOLAR_CONST * (1.0 + 0.033 * math.cos(two_pi * doy / 365.0))
        tau = 0.72 ** (am ** 0.678)          # transmission directe (Meinel)
        dni = e0 * tau
        dhi = 0.30 * (1.0 - tau) * e0 * cosz  # diffus par ciel clair
        ghi = dni * cosz + dhi

        # azimut solaire compte depuis le sud, positif vers l'ouest
        gamma_s = math.atan2(math.sin(ha),
                             math.cos(ha) * sin_lat - math.tan(decl) * cos_lat)
        sinz = math.sqrt(max(0.0, 1.0 - cosz * cosz))
        cos_aoi = cosz * cos_tilt + sinz * sin_tilt * math.cos(gamma_s)

        ghi_cs[i] = ghi
        kt_cs[i] = ghi / (e0 * cosz)
        c_beam[i] = max(0.0, cos_aoi) / cosz
        sun_up[i] = 1

    return ghi_cs, kt_cs, c_beam, sun_up


def diffuse_fraction(kt):
    """Correlation d'Erbs : fraction diffuse du rayonnement global."""
    if kt <= 0.22:
        return 1.0 - 0.09 * kt
    if kt <= 0.80:
        return (0.9511 - 0.1604 * kt + 4.388 * kt * kt
                - 16.638 * kt ** 3 + 12.336 * kt ** 4)
    return 0.165


def poa_irradiance(kc, i, ghi_cs, kt_cs, c_beam):
    """Irradiance dans le plan des modules (W/m2) pour un indice de ciel clair kc."""
    ghi = kc * ghi_cs[i]
    if ghi <= 0.0:
        return 0.0
    fd = diffuse_fraction(min(0.85, kc * kt_cs[i]))
    dhi = fd * ghi
    return (ghi - dhi) * c_beam[i] + dhi * C_DIFF + ghi * C_GRND


def dc_ac_power(poa, tamb, soiling):
    """Puissance AC (p.u. de la puissance crete DC) a partir de l'irradiance POA."""
    if poa <= 1.0:
        return 0.0
    tcell = tamb + poa * (NOCT - 20.0) / 800.0
    p = (poa / 1000.0) * (1.0 + GAMMA_P * (tcell - 25.0)) * SYSTEM_LOSS * soiling
    if p <= 0.006:
        return 0.0
    eff = 0.975 * (1.0 - 0.0065 / p - 0.0075 * p)   # rendement onduleur
    if eff <= 0.0:
        return 0.0
    return p * eff


# --------------------------------------------------------------------------
# 3. Nebulosite (indice de ciel clair minute par minute)
# --------------------------------------------------------------------------

def build_cloud_series(n_days, start_date, seed):
    """Genere l'indice de ciel clair kc a la minute, plus les caracteristiques
    journalieres (moyenne, indice de variabilite, pluie)."""
    kc = array("f", bytes(4 * n_days * MINUTES_PER_DAY))
    day_kc = []
    day_var = []
    day_rain = []

    rng_weather = random.Random(seed)
    x_prev = rng_weather.gauss(0.0, 1.0)
    rho = 0.55                                  # persistance meteo jour a jour

    for d in range(n_days):
        date = start_date + dt.timedelta(days=d)
        rng = random.Random((seed * 1000003 + date.toordinal()) & 0x7FFFFFFF)

        x = rho * x_prev + math.sqrt(1.0 - rho * rho) * rng_weather.gauss(0.0, 1.0)
        x_prev = x
        u = 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))   # quantile uniforme

        p_clear, p_over = CLOUD_CLIMATE[date.month]
        if u < p_over:                                   # journee couverte
            base = rng.uniform(0.13, 0.42)
            var = rng.uniform(0.15, 0.35)
            regime = "couvert"
        elif u > 1.0 - p_clear:                          # journee claire
            base = rng.uniform(0.90, 1.00)
            var = rng.uniform(0.01, 0.07)
            regime = "clair"
        else:                                            # journee variable
            base = rng.uniform(0.45, 0.88)
            var = rng.uniform(0.45, 1.00)
            regime = "variable"

        day_kc.append(base)
        day_var.append(var)
        day_rain.append(regime == "couvert" and base < 0.30)

        # composante lente (processus d'Ornstein-Uhlenbeck, tau = 90 min)
        off = d * MINUTES_PER_DAY
        alpha = math.exp(-1.0 / 90.0)
        amp = 0.11 * (0.35 + var)
        s = rng.gauss(0.0, amp)
        series = [0.0] * MINUTES_PER_DAY
        for m in range(MINUTES_PER_DAY):
            s = alpha * s + math.sqrt(1.0 - alpha * alpha) * rng.gauss(0.0, amp)
            series[m] = base + s

        # passages nuageux (evenements discrets, journees variables surtout)
        if var > 0.12:
            mean_gap = max(6.0, 55.0 / var)
            m = rng.expovariate(1.0 / mean_gap)
            while m < MINUTES_PER_DAY:
                dur = max(2.0, rng.lognormvariate(math.log(7.0), 0.85))
                depth = min(0.92, rng.uniform(0.20, 0.85) * (0.45 + var))
                m0, m1 = int(m), min(MINUTES_PER_DAY, int(m + dur))
                span = max(1, m1 - m0)
                for k in range(m0, m1):
                    # bord de nuage adouci (fenetre en cosinus sureleve)
                    w = 0.5 * (1.0 - math.cos(2.0 * math.pi * (k - m0 + 0.5) / span))
                    series[k] *= (1.0 - depth * w)
                # effet "bord de nuage" : surirradiance breve
                if depth > 0.35 and rng.random() < 0.45:
                    for k in range(max(0, m0 - 2), min(MINUTES_PER_DAY, m1 + 3)):
                        if k < m0 or k >= m1:
                            series[k] *= rng.uniform(1.02, 1.14)
                m += dur + rng.expovariate(1.0 / mean_gap)

        for m in range(MINUTES_PER_DAY):
            v = series[m]
            kc[off + m] = 0.04 if v < 0.04 else (1.12 if v > 1.12 else v)

    return kc, day_kc, day_var, day_rain


def build_temperature(n_days, start_date, day_kc, seed):
    """Temperature ambiante a la minute (degC) : saison + cycle diurne + alea."""
    tamb = array("f", bytes(4 * n_days * MINUTES_PER_DAY))
    rng = random.Random(seed + 77)
    off_prev = rng.gauss(0.0, 2.4)
    two_pi = 2.0 * math.pi

    for d in range(n_days):
        date = start_date + dt.timedelta(days=d)
        doy = date.timetuple().tm_yday
        seasonal = 14.0 + 9.0 * math.cos(two_pi * (doy - 200) / 365.0)
        diurnal_amp = 5.5 + 1.8 * math.cos(two_pi * (doy - 200) / 365.0) * -1.0
        off_prev = 0.7 * off_prev + math.sqrt(1.0 - 0.49) * rng.gauss(0.0, 2.4)
        cloud_cool = -2.6 * (1.0 - min(1.0, day_kc[d]))
        base = seasonal + off_prev + cloud_cool
        off = d * MINUTES_PER_DAY
        for m in range(MINUTES_PER_DAY):
            t_local = (m / 60.0 + LON / 15.0) % 24.0
            tamb[off + m] = base + diurnal_amp * math.cos(two_pi * (t_local - 15.0) / 24.0)
    return tamb


def build_soiling(n_days, day_rain):
    """Facteur de salissure journalier (encrassement puis lavage par la pluie)."""
    soil = []
    since_rain = 3
    for d in range(n_days):
        if day_rain[d]:
            since_rain = 0
        else:
            since_rain += 1
        soil.append(1.0 - 0.035 * (1.0 - math.exp(-since_rain / 20.0)))
    return soil


# --------------------------------------------------------------------------
# 4. Lissage (resolution effective d'un modele meteo)
# --------------------------------------------------------------------------

def moving_average(src, window):
    """Moyenne glissante centree, O(n)."""
    n = len(src)
    out = array("f", bytes(4 * n))
    half = window // 2
    acc = 0.0
    for i in range(min(half + 1, n)):
        acc += src[i]
    count = min(half + 1, n)
    for i in range(n):
        out[i] = acc / count
        add = i + half + 1
        sub = i - half
        if add < n:
            acc += src[add]
            count += 1
        if sub >= 0:
            acc -= src[sub]
            count -= 1
    return out


# --------------------------------------------------------------------------
# 5. Modele de prevision
# --------------------------------------------------------------------------

def make_forecast(i0, seed, ctx):
    """Construit une prevision de 1440 valeurs (1 min) a partir du run demarrant
    a la minute i0.

    Le previsionniste ne connait pas la realite minute par minute : la prevision
    est batie sur une version LISSEE de la nebulosite (resolution effective d'un
    modele meteo), degradee par trois erreurs qui croissent avec l'echeance :
      1. lissage croissant (les passages nuageux fins deviennent invisibles) ;
      2. erreur de calage temporel (le systeme nuageux arrive trop tot / tard) ;
      3. biais multiplicatif sur l'indice de ciel clair (marche aleatoire lente),
         module par la predictibilite de la journee visee (une journee
         anticyclonique claire est bien plus previsible qu'une journee a
         passages nuageux).
    """
    (ghi_cs, kt_cs, c_beam, sun_up, smooth, pred, tamb, soil, p_ref, n_min) = ctx

    rng = random.Random((seed * 7919 + i0) & 0x7FFFFFFF)
    a_run = rng.gauss(0.0, 1.0)          # biais global du run
    z_shift = rng.gauss(0.0, 1.0)        # sens de l'erreur de calage temporel
    nodes = [0.0]
    for _ in range(96):                  # marche aleatoire, un noeud / 15 min
        nodes.append(nodes[-1] + rng.gauss(0.0, 1.0 / math.sqrt(96.0)))
    t_err = rng.gauss(0.0, 1.2)          # erreur sur la temperature prevue (degC)

    values = [0.0] * MINUTES_PER_DAY
    for lead in range(MINUTES_PER_DAY):
        i = i0 + lead
        if not sun_up[i]:
            continue

        f = lead / float(MINUTES_PER_DAY)

        # 1) lissage croissant avec l'echeance
        if f < 0.5:
            a = 2.0 * f
            s_lo, s_hi = smooth[0], smooth[1]
        else:
            a = 2.0 * f - 1.0
            s_lo, s_hi = smooth[1], smooth[2]

        # 2) erreur de calage temporel
        j = i + int(round(ERR_SHIFT_MAX * z_shift * f))
        if j < 0:
            j = 0
        elif j >= n_min:
            j = n_min - 1
        kc_s = (1.0 - a) * s_lo[j] + a * s_hi[j]

        # 3) biais multiplicatif croissant avec l'echeance
        node = lead / 15.0
        k = int(node)
        w = node - k
        walk = nodes[k] * (1.0 - w) + nodes[min(96, k + 1)] * w
        sigma = (ERR_SIGMA_0 + ERR_SIGMA_24 * (f ** 0.7)) * pred[i]
        kc_f = kc_s * (1.0 + sigma * (0.55 * a_run + 0.85 * walk))
        if kc_f < 0.03:
            kc_f = 0.03
        elif kc_f > 1.05:
            kc_f = 1.05

        poa = poa_irradiance(kc_f, i, ghi_cs, kt_cs, c_beam)
        p = dc_ac_power(poa, tamb[i] + t_err, soil[i // MINUTES_PER_DAY]) / p_ref
        values[lead] = 1.0 if p > 1.0 else p

    return values


# --------------------------------------------------------------------------
# 6. Ecriture des fichiers
# --------------------------------------------------------------------------

def open_csv(path, compress):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if compress:
        return gzip.GzipFile(path, "wb", compresslevel=9, mtime=0)
    return open(path, "wb")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sortie", default="data/pv", help="repertoire de sortie")
    ap.add_argument("--annee", type=int, default=2025, help="annee couverte")
    ap.add_argument("--graine", type=int, default=20250101, help="graine aleatoire")
    ap.add_argument("--sans-compression", action="store_true",
                    help="ecrire des .csv au lieu de .csv.gz (volume x8)")
    ap.add_argument("--jour-exemple", default=None,
                    help="journee copiee en clair dans exemples/ (AAAA-MM-JJ, "
                         "defaut : 21 juin de l'annee)")
    args = ap.parse_args()

    compress = not args.sans_compression
    ext = ".csv.gz" if compress else ".csv"
    out = args.sortie
    year = args.annee
    seed = args.graine

    start = dt.datetime(year, 1, 1, tzinfo=dt.timezone.utc)
    year_days = (dt.date(year + 1, 1, 1) - dt.date(year, 1, 1)).days
    n_days = year_days + 2                      # +2 j pour les echeances du 31/12 18Z
    n_min = n_days * MINUTES_PER_DAY
    year_min = year_days * MINUTES_PER_DAY

    print(f"Site      : {SITE['nom']} - {SITE['commune']}")
    print(f"Periode   : {year} ({year_days} jours, pas de temps 1 min)")
    print("1/6 Geometrie solaire et ciel clair...")
    ghi_cs, kt_cs, c_beam, sun_up = solar_geometry(n_min, start)

    print("2/6 Nebulosite, temperature, salissure...")
    kc, day_kc, day_var, day_rain = build_cloud_series(n_days, start.date(), seed)
    tamb = build_temperature(n_days, start.date(), day_kc, seed)
    soil = build_soiling(n_days, day_rain)

    # Puissance de reference = maximum annuel par ciel clair (panneaux propres)
    p_ref = 0.0
    for i in range(year_min):
        if not sun_up[i]:
            continue
        poa = poa_irradiance(1.0, i, ghi_cs, kt_cs, c_beam)
        p = dc_ac_power(poa, tamb[i], 1.0)
        if p > p_ref:
            p_ref = p
    print(f"    puissance de reference (ciel clair) = {p_ref:.4f} p.u. DC")

    print("3/6 Serie de production mesuree...")
    meas = array("f", bytes(4 * n_min))
    for i in range(n_min):
        if not sun_up[i]:
            continue
        d = i // MINUTES_PER_DAY
        poa = poa_irradiance(kc[i], i, ghi_cs, kt_cs, c_beam)
        p = dc_ac_power(poa, tamb[i], soil[d]) / p_ref
        meas[i] = 1.0 if p > 1.0 else p

    print("4/6 Ecriture des mesures (12 fichiers mensuels)...")
    os.makedirs(os.path.join(out, "mesures"), exist_ok=True)
    energy_month = {}
    for month in range(1, 13):
        m_start = dt.datetime(year, month, 1, tzinfo=dt.timezone.utc)
        m_end = (dt.datetime(year + 1, 1, 1, tzinfo=dt.timezone.utc) if month == 12
                 else dt.datetime(year, month + 1, 1, tzinfo=dt.timezone.utc))
        i0 = int((m_start - start).total_seconds() // 60)
        i1 = int((m_end - start).total_seconds() // 60)
        path = os.path.join(out, "mesures", f"pv_mesure_{year}-{month:02d}{ext}")
        buf = ["timestamp_utc,pv_mesure_norm\n"]
        tot = 0.0
        for i in range(i0, i1):
            t = start + dt.timedelta(minutes=i)
            v = meas[i]
            tot += v
            buf.append(f"{t:%Y-%m-%dT%H:%M:%SZ},{v:.4f}\n")
        with open_csv(path, compress) as fh:
            fh.write("".join(buf).encode("ascii"))
        energy_month[month] = tot / 60.0
        print(f"    {os.path.basename(path)} : {i1 - i0} points, "
              f"{tot / 60.0:8.1f} h equivalent pleine puissance")

    print("5/6 Ecriture des previsions (4 runs/jour, horizon 24 h)...")
    smooth = [moving_average(kc, w) for w in SMOOTH_WINDOWS]

    # facteur de predictibilite par minute (issu du regime de la journee visee)
    pred = array("f", bytes(4 * n_min))
    for d in range(n_days):
        v = day_var[d]
        f = 0.30 + 0.85 * min(1.0, v)
        off = d * MINUTES_PER_DAY
        for m in range(MINUTES_PER_DAY):
            pred[off + m] = f

    ctx = (ghi_cs, kt_cs, c_beam, sun_up, smooth, pred, tamb, soil, p_ref, n_min)

    index_rows = ["run_utc,fichier,horizon_min,pas_min,energie_prevue_h,"
                  "energie_mesuree_h,mae,rmse\n"]
    n_runs = 0
    err_stats = [[0.0, 0.0, 0] for _ in range(4)]   # par tranche de 6 h : sum|e|, sum e^2, n

    for d in range(year_days):
        for hh in (0, 6, 12, 18):
            run_time = start + dt.timedelta(days=d, hours=hh)
            i0 = d * MINUTES_PER_DAY + hh * 60
            values = make_forecast(i0, seed, ctx)

            fname = f"pv_prev_{run_time:%Y%m%dT%H}Z{ext}"
            path = os.path.join(out, "previsions", f"{run_time:%Y-%m}", fname)

            buf = ["timestamp_utc,horizon_min,pv_prev_norm\n"]
            tot_prev = tot_meas = sae = sse = 0.0
            nday = 0
            for lead in range(MINUTES_PER_DAY):
                i = i0 + lead
                t = start + dt.timedelta(minutes=i)
                p = values[lead]
                buf.append(f"{t:%Y-%m-%dT%H:%M:%SZ},{lead},{p:.4f}\n")
                if not sun_up[i]:
                    continue
                e = p - meas[i]
                tot_prev += p
                tot_meas += meas[i]
                sae += abs(e)
                sse += e * e
                nday += 1
                b = min(3, lead // 360)
                err_stats[b][0] += abs(e)
                err_stats[b][1] += e * e
                err_stats[b][2] += 1

            with open_csv(path, compress) as fh:
                fh.write("".join(buf).encode("ascii"))

            mae = sae / nday if nday else 0.0
            rmse = math.sqrt(sse / nday) if nday else 0.0
            index_rows.append(
                f"{run_time:%Y-%m-%dT%H:%M:%SZ},previsions/{run_time:%Y-%m}/{fname},"
                f"1440,1,{tot_prev / 60.0:.3f},{tot_meas / 60.0:.3f},{mae:.4f},{rmse:.4f}\n")
            n_runs += 1
        if (d + 1) % 60 == 0:
            print(f"    {n_runs} runs ecrits ({d + 1}/{year_days} jours)")

    with open(os.path.join(out, "previsions", "index.csv"), "w", encoding="ascii") as fh:
        fh.write("".join(index_rows))

    # ---------------------------------------------------------------------
    # Exemples en clair (CSV non compresses) pour une journee de reference
    # ---------------------------------------------------------------------
    print("6/6 Copie en clair d'une journee exemple...")
    if args.jour_exemple:
        ex_date = dt.date.fromisoformat(args.jour_exemple)
    else:
        ex_date = dt.date(year, 6, 21)
    ex_d = (ex_date - start.date()).days
    ex_dir = os.path.join(out, "exemples")
    os.makedirs(ex_dir, exist_ok=True)

    i0 = ex_d * MINUTES_PER_DAY
    with open(os.path.join(ex_dir, f"pv_mesure_{ex_date}.csv"), "w", encoding="ascii") as fh:
        fh.write("timestamp_utc,pv_mesure_norm\n")
        for m in range(MINUTES_PER_DAY):
            t = start + dt.timedelta(minutes=i0 + m)
            fh.write(f"{t:%Y-%m-%dT%H:%M:%SZ},{meas[i0 + m]:.4f}\n")

    for hh in (0, 6, 12, 18):
        run_time = start + dt.timedelta(days=ex_d, hours=hh)
        values = make_forecast(ex_d * MINUTES_PER_DAY + hh * 60, seed, ctx)
        name = f"pv_prev_{run_time:%Y%m%dT%H}Z.csv"
        with open(os.path.join(ex_dir, name), "w", encoding="ascii") as fh:
            fh.write("timestamp_utc,horizon_min,pv_prev_norm\n")
            for lead in range(MINUTES_PER_DAY):
                t = run_time + dt.timedelta(minutes=lead)
                fh.write(f"{t:%Y-%m-%dT%H:%M:%SZ},{lead},{values[lead]:.4f}\n")
    print(f"    exemples/ : mesure + 4 runs du {ex_date} (CSV non compresses)")

    # Metadonnees du site
    meta = dict(SITE)
    meta.update({
        "annee": year,
        "graine_aleatoire": seed,
        "pas_de_temps_s": 60,
        "normalisation": ("valeur = puissance AC / puissance de pointe de reference ; "
                          "1.0 = 100 % de la puissance PV installee (Pmax de la centrale)"),
        "nb_runs_prevision": n_runs,
        "horizon_prevision_min": MINUTES_PER_DAY,
        "cadence_runs_h": 6,
        "energie_annuelle_h_equivalent_pleine_puissance": round(sum(energy_month.values()), 1),
        "energie_mensuelle_h_equivalent_pleine_puissance":
            {f"{m:02d}": round(v, 1) for m, v in energy_month.items()},
    })
    with open(os.path.join(out, "site.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    print("\n--- Qualite des previsions (jour uniquement, en % de la puissance installee) ---")
    labels = ["0-6 h", "6-12 h", "12-18 h", "18-24 h"]
    for b in range(4):
        sae, sse, n = err_stats[b]
        if n:
            print(f"  echeance {labels[b]:8s} : MAE = {100 * sae / n:5.2f} %   "
                  f"RMSE = {100 * math.sqrt(sse / n):5.2f} %   ({n} points)")
    print(f"\nProductible annuel : {sum(energy_month.values()):.0f} h equivalent pleine puissance")
    print(f"Fichiers ecrits dans : {out}")


if __name__ == "__main__":
    main()
