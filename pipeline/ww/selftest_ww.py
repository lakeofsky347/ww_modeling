#!/usr/bin/env python3
"""Sanity + spot-check for out/ww.json.
- counts vs encore.moe lists, missing names, monotonic multipliers/stat curves
- spot checks vs encore.moe detail pages (cached under cache/encore/3.7.8; fetched politely via encore_fetch if absent)
Usage: python3 selftest_ww.py [--data out/ww.json] [--report out/ww_selftest.txt] [--offline]
"""
import argparse, glob, json, os, re, sys
from collections import defaultdict
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
API = 'https://api-v2.encore.moe/api/zh-Hans/'
SPOT = {'character': [1402, 1208, 1209, 1308, 1506, 1304], 'weapon': [21010074, 21020015], 'echo': [6000038, 6000053], 'monster': [310000010]}

ap = argparse.ArgumentParser()
ap.add_argument('--data', default=os.path.join(HERE, '..', 'out', 'ww.json'))
ap.add_argument('--report', default=os.path.join(HERE, '..', 'out', 'ww_selftest.txt'))
ap.add_argument('--offline', action='store_true', help='only use cached encore pages')
a = ap.parse_args()
D = json.load(open(a.data))
bucket = (D['meta'].get('encore') or {}).get('cacheBucket') or '3.7.8'
lines, fails = [], []


def log(s=''):
    lines.append(s)
    print(s)


def check(name, ok, detail=''):
    log(f"[{'PASS' if ok else 'FAIL'}] {name}{(' - ' + detail) if detail else ''}")
    if not ok:
        fails.append(name)


def enc(ep, i):
    import encore_fetch as E
    url = f'{API}{ep}/{i}'
    p = E.cache_path(url, bucket)
    if a.offline and not os.path.exists(p):
        return None
    return E.get(url, bucket, as_json=True)


def fnum(s):
    m = re.match(r'\s*(-?\d+(?:\.\d+)?)', str(s))
    return float(m.group(1)) if m else None


# ---------------- 1. counts
log('== counts')
m = D['meta']
for k, v in m['counts'].items():
    log(f'  {k}: {v}')
ec = (m.get('encore') or {}).get('encoreCounts') or {}
for k, v in ec.items():
    check(f'count {k} == encore list ({v})', m['counts'].get(k) == v, f"repo={m['counts'].get(k)}")
check('resonators == 64 playable (RoleType 1, non-trial)', m['counts']['resonators'] == 64)
check('every resonator has 6 chains', all(len(r['chains']) == 6 for r in D['resonators']))
check('every resonator has skill types 1,2,3,5,6,11', all({1, 2, 3, 5, 6, 11} <= {s['type'] for s in r['skills']} for r in D['resonators']),
      str([r['name'] for r in D['resonators'] if not {1, 2, 3, 5, 6, 11} <= {s['type'] for s in r['skills']}]))
check('every resonator has >=2 inherent skills', all(len(r['inherents']) >= 2 for r in D['resonators']),
      str([(r['name'], len(r['inherents'])) for r in D['resonators'] if len(r['inherents']) < 2]))
check('liberation cost == baseproperty.EnergyMax/100 for all', all(r['energy']['consistent'] for r in D['resonators']),
      str([(r['name'], r['energy']) for r in D['resonators'] if not r['energy']['consistent']][:5]))
check('every sonata has >=1 piece effect with text', all(s['pieces'] and all(p['desc'] for p in s['pieces'].values()) for s in D['sonatas']))
log('  sonata piece patterns: ' + str(sorted({tuple(sorted(s['pieces'])) for s in D['sonatas']})))

# ---------------- 2. names
log('== names')
miss = [(k, e['id']) for k in ('resonators', 'weapons', 'echoes', 'sonatas', 'enemies') for e in D[k] if not e.get('name')]
missen = [(k, e['id']) for k in ('resonators', 'weapons', 'echoes', 'sonatas', 'enemies') for e in D[k] if not e.get('nameEn')]
check('no missing zh names (resonators/weapons/sonatas)', not [x for x in miss if x[0] in ('resonators', 'weapons', 'sonatas')], str(miss))
log(f'  missing zh names overall: {miss}')
log(f'  missing en names overall: {len(missen)} {missen[:10]}')
nsk = [(r['name'], s['id']) for r in D['resonators'] for s in r['skills'] if not s.get('name') and not s.get('nonCombat')]
check('no missing skill names', not nsk, str(nsk[:5]))

# ---------------- 3. monotonic
log('== monotonic')
bad = []
for r in D['resonators']:
    for s in r['skills']:
        for h in s['hits']:
            mm = h.get('multiplier')
            if mm and any(mm[i + 1] < mm[i] - 1e-9 for i in range(len(mm) - 1)):
                bad.append((r['name'], s['name'], h['label']))
check('resonator hit multipliers non-decreasing across skill levels', not bad, f'{len(bad)} {bad[:5]}')
bad = [(e['name'], h['label']) for e in D['echoes'] for h in (e.get('skill') or {}).get('hits', []) if h.get('multiplier') and any(h['multiplier'][i + 1] < h['multiplier'][i] - 1e-9 for i in range(len(h['multiplier']) - 1))]
check('echo hit multipliers non-decreasing across echo ranks', not bad, str(bad[:5]))
bad = []
for r in D['resonators']:
    ls = r['levelStats']
    for i in range(len(ls) - 1):
        if any(ls[i + 1][j] < ls[i][j] for j in (2, 3, 4)):
            bad.append(r['name'])
            break
check('resonator HP/ATK/DEF non-decreasing over (level,breach)', not bad, str(bad[:5]))
bad = [w['name'] for w in D['weapons'] if any(w['levelStats'][i + 1][2] < w['levelStats'][i][2] or w['levelStats'][i + 1][3] < w['levelStats'][i][3] for i in range(len(w['levelStats']) - 1))]
check('weapon main/sub non-decreasing', not bad, str(bad[:5]))
check('enemy DEF = 792+8*Lv on growth curve 0', m['enemyDefFormulaCheck']['holdsForCurve0'])
nh = m['counts']['resonatorHits']
log(f"  resonator hits: {nh}, high {m['counts']['resonatorHitsHigh']} ({100 * m['counts']['resonatorHitsHigh'] / nh:.1f}%)")
log(f"  echo hits: {m['counts']['echoHits']}, high {m['counts']['echoHitsHigh']}")

# ---------------- 4. encore spot checks
log('== encore.moe spot checks (cache bucket %s)' % bucket)
R = {r['id']: r for r in D['resonators']}
W = {w['id']: w for w in D['weapons']}
EC = {e['id']: e for e in D['echoes']}
EN = {e['id']: e for e in D['enemies']}
tally = defaultdict(lambda: [0, 0])


def cmp(cat, ok):
    tally[cat][1] += 1
    tally[cat][0] += bool(ok)


for cid in SPOT['character']:
    c = enc('character', cid)
    if not c:
        log(f'  character {cid}: not cached/offline, skipped')
        continue
    r = R[cid]
    # base stats curve (encore GrowthValues indexed by growth row id order == our levelStats order)
    for p in c['Properties']:
        col = {'生命': 2, '攻击': 3, '防御': 4}.get(p['Name'])
        if col is None:
            continue
        gv = p['GrowthValues']
        ok = len(gv) == len(r['levelStats']) and all(abs(float(g['value']) - r['levelStats'][i][col]) < 0.01 for i, g in enumerate(gv))
        cmp('char base stats (96 lv/breach points x HP/ATK/DEF)', ok)
        if not ok:
            log(f"   MISMATCH {r['name']} {p['Name']}")
    skmap = {s['id']: s for s in r['skills']}
    for es in c['Skills']:
        s = skmap.get(es['SkillId'])
        if not s:
            cmp('skill present', False)
            log(f"   missing skill {es['SkillId']} {es['SkillName']}")
            continue
        cmp('skill present', True)
        cmp('skill name', s['name'] == re.sub(r'<[^>]+>', '', es['SkillName']))
        ours = {p['label']: p['values'] for p in s['params']}
        for at in es.get('SkillAttributes', []):
            mine = ours.get(at['attributeName'])
            ok = mine is not None and [str(x) for x in mine] == [str(x) for x in at['values'][:len(mine)]]
            cmp('skill param display strings (all levels)', ok)
            if not ok:
                log(f"   MISMATCH {r['name']}/{s['name']}/{at['attributeName']}: ours={mine and mine[:3]} encore={at['values'][:3]}")
        # damage rows: encore RateLv shown as strings, Energy/ElementPower/ToughLv/WeaknessLvl normalised
        ours_d = {}
        for h in s['hits'] + s.get('unlinkedDamage', []):
            if 'damageId' in h:
                ours_d.setdefault(h['damageId'], h)
            for v in h.get('variants', []):
                ours_d.setdefault(v['damageId'], dict(h, **v))
        for ed in es.get('DamageList', []):
            h = ours_d.get(ed['Id'])
            if not h:
                cmp('damage row exported', False)
                continue
            cmp('damage row exported', True)
            if 'rate' in h:
                rates = h['rate']
            else:
                rates = None
            er = [fnum(x) / 100 for x in ed['RateLv']]
            if rates is not None:
                cmp('damage RateLv (per level) vs encore', all(abs(er[i] - rates[i]) < 1e-6 for i in range(min(len(er), len(rates)))))
            elif 'multiplier' in h:
                cmp('damage RateLv (per level) vs encore', all(abs(er[i] - h['multiplier'][i]) < 1e-6 for i in range(min(len(er), len(h['multiplier'])))))
            for f_enc, f_our in (('Energy', 'energy'), ('ElementPower', 'concerto'), ('ToughLv', 'toughness'), ('WeaknessLvl', 'offTune')):
                if f_our in h and ed.get(f_enc) is not None:
                    cmp(f'damage {f_enc} units (ours {f_our})', [round(x, 6) for x in ed[f_enc]] == [round(x, 6) for x in h[f_our]])
            et = ed.get('Type')
            if et and 'typeName' in h:
                ok = (h['typeName'] or '') in et or et in (h['typeName'] or '')
                cmp('damage Type label vs encore', ok)
                if not ok:
                    log(f"   TYPE {ed['Id']} ours={h['typeName']} encore={et}")
    # chains
    for ch, ec in zip(r['chains'], sorted(c['ResonantChain'], key=lambda x: x['GroupIndex'])):
        cmp('chain name', ch['name'] == ec['NodeName'])
        cmp('chain desc text (tags stripped)', re.sub(r'\s', '', ch['desc']) == re.sub(r'\s', '', re.sub(r'<[^>]+>', '', ec['AttributesDescription'])))

for wid in SPOT['weapon']:
    w = enc('weapon', wid)
    if not w:
        continue
    ours = W[wid]
    for i, p in enumerate(w['Properties']):
        col = 2 + i
        vals = [fnum(g['Value']) for g in p['GrowthValues']]
        pct = '%' in p['GrowthValues'][0]['Value']
        mine = [x[col] * (100 if pct else 1) for x in ours['levelStats']]
        ok = len(vals) == len(mine) and all(abs(a_ - b_) < 0.011 for a_, b_ in zip(vals, mine))
        cmp('weapon stat curve (96 points)', ok)
        if not ok:
            log(f"   MISMATCH weapon {ours['name']} {p['Name']}: ours={mine[:3]}..{mine[-1]} encore={vals[:3]}..{vals[-1]}")
    cmp('weapon passive params', [d['ArrayString'] for d in w['DescParams']] == ours['passive']['params'])

for eid in SPOT['echo']:
    e = enc('echo', eid)
    if not e:
        continue
    ours = EC[eid]
    cmp('echo cooldown', e['Skill']['SkillCD'] == ours['skill']['cooldown'])
    cmp('echo rank params', [x['ArrayString'] for x in e['Skill']['LevelDescStrArray']] == ours['skill']['params'])
    cmp('echo cost', {0: 1, 1: 3, 2: 4, 3: 4}[e['Rarity']] == ours['cost'])
    names = set(e.get('FetterDetails', {}).keys())
    sn = {s['id']: s['name'] for s in D['sonatas']}
    cmp('echo sonata groups', names == {sn[g] for g in ours['sonataGroups']})
    S = {s['name']: s for s in D['sonatas']}
    for nm, fd in (e.get('FetterDetails') or {}).items():
        for key, txt in zip(fd['EffectKeys'], fd['EffectDescriptions']):
            mine = S[nm]['pieces'].get(str(key), {}).get('desc')
            cmp('sonata piece text', re.sub(r'\s', '', mine or '') == re.sub(r'\s', '', re.sub(r'<[^>]+>', '', txt)))

for mid in SPOT['monster']:
    mo = enc('monster', mid)
    if not mo:
        continue
    ours = EN[mid]
    cmp('monster PropertyId link', mo['AttributeComponent']['PropertyId'] == ours['propertyId'])
    for k, kk in (('LifeMax', 'hp'), ('Atk', 'atk'), ('Def', 'def')):
        cmp('monster base stat', mo['Properties'][k]['Value'] == ours['base'][kk])

log('')
for k, (ok, n) in tally.items():
    log(f'  {k}: {ok}/{n}')
tot_ok = sum(v[0] for v in tally.values())
tot = sum(v[1] for v in tally.values())
check(f'encore spot checks all matched ({tot_ok}/{tot})', tot_ok == tot)
log('')
log(f'RESULT: {len(fails)} failing checks' + (': ' + ', '.join(fails) if fails else ''))
open(a.report, 'w').write('\n'.join(lines) + '\n')
