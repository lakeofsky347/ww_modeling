#!/usr/bin/env python3
"""只读数据交叉核对：ww.json vs wuwa-tools(encore 同步) vs wuwa-calc-data。输出 validation/out/data_crosscheck.json"""
import json, os, re
H = os.path.dirname(os.path.abspath(__file__)); V = os.path.dirname(H)
ww = json.load(open(os.path.join(V, '../../out/ww.json')))
WT = os.path.join(V, 'refs/wuwa-tools/src/lib/data/game')
CD = os.path.join(V, 'refs/wuwa-calc-data/data')
wt_chars = json.load(open(os.path.join(WT, 'characters.json')))
wt_weap = {w['id']: w for w in json.load(open(os.path.join(WT, 'weapons.json')))}
cd_chars = json.load(open(os.path.join(CD, 'db_characters.json')))
cd_weap = json.load(open(os.path.join(CD, 'db_weapons.json')))
TYPEMAP = {'Basic Attack': 'basic', 'Heavy Attack': 'heavy', 'Resonance Skill': 'skill', 'Resonance Liberation': 'liberation',
           'Intro Skill': 'intro', 'Outro Skill': 'outro', 'Echo Skill': 'echo', 'Tune Rupture - Shifting': 'tuneRupture'}
out = {'base': [], 'weapons': [], 'mv': {'compared': 0, 'mvMismatch': [], 'scalingMismatch': [], 'typeMismatch': [], 'onlyOurs': 0, 'onlyRef': 0, 'perChar': {}}, 'calcData': []}

res = {r['id']: r for r in ww['resonators']}
def lv90(r):
    f = r['levelStatsFields']; rows = [x for x in r['levelStats'] if x[0] == 90]
    row = rows[-1]; return dict(zip(f, row))
# 基础属性 lv90
for c in wt_chars:
    for cid in c['ids']:
        if cid not in res: continue
        s = lv90(res[cid]); b = c['base']
        d = {k: (round(s.get(k, 0), 2), b[k]) for k in ('atk', 'hp', 'def')}
        bad = {k: v for k, v in d.items() if abs(v[0] - v[1]) > 0.02}
        out['base'].append({'id': cid, 'name': res[cid]['name'], 'en': c['name'], 'ours_vs_wuwatools': d, 'mismatch': bad})
# calc-data 基础属性（按英文名）
en2id = {}
for r in ww['resonators']: en2id.setdefault(r['nameEn'], []).append(r['id'])
for name, v in cd_chars.items():
    key = name.replace('Rover (', 'Rover: ').replace(')', '')
    ids = en2id.get(key) or en2id.get(name)
    if not ids: out['calcData'].append({'name': name, 'note': 'ww.json 中找不到同名角色'}); continue
    s = lv90(res[ids[0]])
    d = {'atk': (round(s['atk'], 2), v.get('baseAtk')), 'hp': (round(s['hp'], 2), v.get('baseHP')), 'def': (round(s['def'], 2), v.get('baseDef'))}
    bad = {k: x for k, x in d.items() if x[1] is not None and abs(x[0] - float(x[1])) > 0.6}
    out['calcData'].append({'name': name, 'id': ids[0], 'cmp': d, 'mismatch': bad})
# 武器
wmap = {w['id']: w for w in ww['weapons']}
def wlv90(w):
    for k in ('atk90',):
        if k in w: return w[k]
    return None
for wid, w in wt_weap.items():
    o = wmap.get(wid)
    if not o: out['weapons'].append({'id': wid, 'note': 'ww.json 缺'}); continue
    rows90 = [x for x in o['levelStats'] if x[0] == 90]
    if not rows90: out['weapons'].append({'id': wid, 'note': '本武器无 90 级'}); continue
    row = rows90[-1]; f = dict(zip(o['levelStatsFields'], row))
    sec = f['sub'] * (100 if o['subStat'].get('isPercent') else 1)
    bad = abs(f['main'] - w['atk90']) > 0.06 or abs(sec - w['secondary']['value90']) > 0.06
    cdw = cd_weap.get(w['name'])
    cdbad = None
    if cdw: cdbad = abs(f['main'] - cdw['baseAtk']) > 0.6 or abs(sec - cdw['subStatValue']) > 0.06
    out['weapons'].append({'id': wid, 'name': o.get('name'), 'en': w['name'], 'ours': [round(f['main'],2), round(sec,2), o['subStat']['name']], 'wuwatools': [w['atk90'], w['secondary']], 'calcdata': cdw, 'mismatchA': bad, 'mismatchB': cdbad})
# 倍率：按 damageId 对齐
for c in wt_chars:
    slug = c['slug']; p = os.path.join(WT, 'skills', slug + '.json')
    if not os.path.exists(p): continue
    sk = json.load(open(p)); refhits = {}
    for s in sk['skills']:
        for h in s.get('hits', []): refhits[h['id']] = h
    ours = {}
    for cid in c['ids']:
        if cid not in res: continue
        for s in res[cid]['skills']:
            for h in s['hits'] + s.get('unlinkedDamage', []):
                for did in (h.get('damageIds') or ([h['damageId']] if h.get('damageId') else [])):
                    ours.setdefault(did, (h, s['name'], cid))
    n = mm = 0
    for did, rh in refhits.items():
        if rh.get('kind') != 'Damage': continue
        if did not in ours: out['mv']['onlyRef'] += 1; continue
        h, sname, cid = ours[did]
        if h.get('calc') == 'heal' or not h.get('multiplier'): continue
        n += 1
        # 多 id 合并的 hit：multiplier 应等于该行 RateLv；只比 damageIds 首个或 hit 自身 damageId
        our = [round(x * 100, 2) for x in h['multiplier']]
        ref = [round(x, 2) for x in rh['mv']]
        primary = h.get('damageId') == did or (h.get('damageIds') or [None])[0] == did
        if primary and our != ref and max(abs(a - b) for a, b in zip(our, ref)) > 0.011:
            mm += 1; out['mv']['mvMismatch'].append({'char': slug, 'damageId': did, 'skill': sname, 'label': h.get('label'), 'ours_lv10': our[-1], 'ref_lv10': ref[-1]})
        sc = {'ATK': 'atk', 'HP': 'hp', 'DEF': 'def'}.get(rh['scaling'])
        if sc and h.get('scaling') and sc != h['scaling']:
            out['mv']['scalingMismatch'].append({'char': slug, 'damageId': did, 'label': h.get('label'), 'ours': h['scaling'], 'ref': rh['scaling']})
        t = TYPEMAP.get(rh['damageType'])
        if t and h.get('type') and t != h['type']:
            vt=[v.get('type') for v in h.get('variants',[]) if isinstance(v,dict)]
            out['mv']['typeMismatch'].append({'char': slug, 'damageId': did, 'label': h.get('label'), 'ours': h['type'], 'ref': rh['damageType'], 'primaryId': primary, 'oursVariantTypes': vt})
    out['mv']['compared'] += n; out['mv']['perChar'][slug] = {'compared': n, 'mvMismatch': mm}
os.makedirs(os.path.join(V, 'out'), exist_ok=True)
json.dump(out, open(os.path.join(V, 'out/data_crosscheck.json'), 'w'), ensure_ascii=False, indent=1)
print('base mismatches:', [b for b in out['base'] if b['mismatch']])
print('calcData base mismatches:', [b for b in out['calcData'] if b.get('mismatch') or b.get('note')])
m = out['mv']; print('mv compared', m['compared'], 'mvMismatch', len(m['mvMismatch']), 'scaling', len(m['scalingMismatch']), 'type', len(m['typeMismatch']), 'onlyRef', m['onlyRef'])
print(json.dumps(m['mvMismatch'][:15], ensure_ascii=False)); print(json.dumps(m['scalingMismatch'][:15], ensure_ascii=False)); print(json.dumps(m['typeMismatch'][:25], ensure_ascii=False))
print('weapons compared', len(out['weapons']), 'mismatch A', [x for x in out['weapons'] if x.get('mismatchA')][:5]); print('mismatch B', [ (x['name'],x['ours'],x['calcdata']) for x in out['weapons'] if x.get('mismatchB')])
# 敌人抗性（wuwa-tools monsters.json，按 id）
mons = json.load(open(os.path.join(WT, 'monsters.json'))); ours_e = {x['id']: x for x in ww['enemies']}
en = {'compared': 0, 'mismatch': [], 'missing': 0}
for x in mons:
    o = ours_e.get(x['id'])
    if not o: en['missing'] += 1; continue
    if not o.get('res') or not x.get('res'): continue
    en['compared'] += 1
    diff = {k: (o['res'].get(k), v) for k, v in x['res'].items() if o['res'].get(k) is not None and abs(o['res'][k] - v) > 1e-6}
    if diff: en['mismatch'].append({'id': x['id'], 'name': x['name'], 'diff': diff})
out['enemies'] = en
json.dump(out, open(os.path.join(V, 'out/data_crosscheck.json'), 'w'), ensure_ascii=False, indent=1)
print('enemies', en['compared'], 'mismatch', len(en['mismatch']), 'missing', en['missing'])
