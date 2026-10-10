#!/usr/bin/env python3
"""Wuthering Waves (鸣潮) data pipeline -> out/ww.json

Primary source: Arikatsu/WutheringWaves_Data clone (BinData/*.json + Textmaps).
Supplement: encore.moe API (only for entities missing from the repo; cached, polite; see encore_fetch.py).
Every number is derived from tables; hand-typed constants live in CONSTANTS with a source note.

Usage: python3 build_ww.py [--src DIR] [--out FILE] [--no-encore]
"""
import argparse, datetime, glob, hashlib, json, os, re, subprocess, sys
from collections import defaultdict, OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

DEF_SRC = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'ww-WutheringWaves_Data')   # clone of Arikatsu/WutheringWaves_Data (not committed)
DEF_OUT = os.path.join(os.path.dirname(HERE), 'out', 'ww.json')
ENCORE_API = 'https://api-v2.encore.moe/api/zh-Hans/'

READ_FILES = []  # relpaths read, for digest


class Src:
    def __init__(self, root):
        self.root = root
        self._c = {}

    def t(self, rel):
        if rel not in self._c:
            p = os.path.join(self.root, 'BinData', rel)
            READ_FILES.append(os.path.relpath(p, self.root))
            self._c[rel] = json.load(open(p, encoding='utf-8'))
        return self._c[rel]

    def text(self, lang):
        d = {}
        for sub in ('multi_text', 'multi_text_1sthalf', 'multi_text_2ndhalf'):
            p = os.path.join(self.root, 'Textmaps', lang, sub, 'MultiText.json')
            if not os.path.exists(p):
                continue
            READ_FILES.append(os.path.relpath(p, self.root))
            for row in json.load(open(p, encoding='utf-8')):
                d.setdefault(row['Id'], row['Content'])
        return d


def digest(root):
    h = hashlib.sha256()
    for rel in sorted(set(READ_FILES)):
        h.update(rel.encode() + b'\0')
        h.update(open(os.path.join(root, rel), 'rb').read() + b'\0')
    return h.hexdigest()


# ---------------------------------------------------------------- text helpers
TAG_RE = re.compile(r'</?(?:color|size|te|b|i)(?:=[^>]*)?(?:\s+href=[^>]*)?>', re.I)


def clean(s):
    if s is None:
        return None
    s = TAG_RE.sub('', s)
    s = re.sub(r'<[^>]{0,40}>', '', s)
    return s.replace('\r', '').strip()


def subst(s, params):
    if s is None:
        return None
    def rep(m):
        i = int(m.group(1))
        return str(params[i]) if params is not None and i < len(params) else m.group(0)
    return re.sub(r'\{(\d+)\}', rep, s)


def num(s):
    try:
        return float(str(s).strip().rstrip('%'))
    except ValueError:
        return None


# ---------------------------------------------------------------- constants
# Only clearly documented constants; everything else is table-derived.
CONSTANTS = OrderedDict([
    ('ratioScale', {'value': 10000, 'source': 'all *Ratio / RateLv / percent property fields are x10000 (e.g. baseproperty.Crit=500 -> 5%, CritDamage=15000 -> 150%)', 'confidence': 'high'}),
    ('energyScale', {'value': 100, 'source': 'baseproperty.EnergyMax=10000 vs liberation desc "消耗共鸣能量 100" (1402); damage.Energy 75 shown by encore.moe as 0.75', 'confidence': 'high'}),
    ('concertoScale', {'value': 100, 'source': 'baseproperty.ElementEnergyMax=10000 -> 协奏能量上限 100; damage.ElementPower 240 shown by encore.moe as 2.4', 'confidence': 'medium'}),
    ('toughScale', {'value': 10000, 'source': 'damage.ToughLv/HardnessLv/WeaknessLvl as shown by encore.moe (ToughLv 3000 -> 0.3)', 'confidence': 'medium'}),
    ('charDefConst', {'value': {'a': 800, 'b': 8}, 'formula': 'DEF_mult = (800 + 8*Lv_atk) / (800 + 8*Lv_atk + DEF_enemy*(1-ignoreDef)*(1-defReduce))', 'source': 'community (see MECHANICS.md); consistent with enemy Def = 800*(1+0.01*(Lv-1)) = 792+8*Lv derived from baseproperty+monsterpropertygrowth', 'confidence': 'medium'}),
    ('resistance', {'formula': 'res<0: 1-res/2; 0<=res<0.8: 1-res; res>=0.8: 1/(1+5*res)', 'source': 'community (see MECHANICS.md); not in tables', 'confidence': 'medium'}),
])

DMG_TYPE = {0: ('普攻', 'Basic Attack', 'basic'), 1: ('重击', 'Heavy Attack', 'heavy'), 2: ('共鸣解放', 'Resonance Liberation', 'liberation'),
            3: ('变奏技能', 'Intro Skill', 'intro'), 4: ('共鸣技能', 'Resonance Skill', 'skill'), 5: ('声骸技能', 'Echo Skill', 'echo'),
            7: ('延奏技能', 'Outro Skill', 'outro'), 12: ('震谐·偏移', 'Tune Rupture / Shifting', 'tuneRupture')}
DMG_TYPE_CONF = {0: 'high', 1: 'high', 2: 'high', 3: 'high', 4: 'high', 5: 'high', 7: 'high', 12: 'medium'}
CALC_TYPE = {0: 'damage', 1: 'heal', 2: 'shield?'}
RELATED = {7: 'atk', 2: 'hp', 10: 'def', 3: 'life', 11: 'energyRegen'}
ELEMENT_KEYS = {0: 'physical', 1: 'glacio', 2: 'fusion', 3: 'electro', 4: 'aero', 5: 'spectro', 6: 'havoc'}
ELEM_ZH = {0: '物理', 1: '冷凝', 2: '热熔', 3: '导电', 4: '气动', 5: '衍射', 6: '湮灭'}
RES_FIELDS = {0: 'DamageResistancePhys', **{i: f'DamageResistanceElement{i}' for i in range(1, 7)}}

TERM_RE = re.compile(r'(\d+(?:\.\d+)?)%(?:\s*[*×xX]\s*(\d+))?')


def parse_expr(s):
    """'23.55%*2+39.81%' -> [(23.55,2),(39.81,1)], flats, leftover text.
    '575+2.90%' -> terms [(2.9,1)], flats [575]."""
    terms = [(float(m.group(1)), int(m.group(2) or 1)) for m in TERM_RE.finditer(s)]
    rest = TERM_RE.sub('', s)
    flats = []
    left = []
    for tok in re.split(r'\+', rest):
        tok = tok.strip()
        if not tok:
            continue
        if re.fullmatch(r'\d+(?:\.\d+)?', tok):
            flats.append(float(tok))
        else:
            left.append(tok)
    return terms, flats, ''.join(left)


class Builder:
    def __init__(self, args):
        self.a = args
        self.S = Src(args.src)
        self.zh = self.S.text('zh-Hans')
        self.en = self.S.text('en')
        self.warn = defaultdict(int)
        self.assumptions = []
        self.pi = {r['Id']: r for r in self.S.t('property/propertyindex.json')}
        self.bp = {r['Id']: r for r in self.S.t('property/baseproperty.json')}
        self.dmg = {r['Id']: r for r in self.S.t('damage/damage.json')}

    def T(self, k, lang='zh'):
        if not k:
            return None
        return (self.zh if lang == 'zh' else self.en).get(k)

    # ------------------------------------------------ properties
    def prop_key(self, pid, ratio):
        if pid >= 10000:
            base = self.pi.get(pid - 10000)
            return (base['Key'] if base else str(pid)) + ('%' if ratio else '')
        p = self.pi.get(pid)
        return p['Key'] if p else str(pid)

    def norm_prop(self, pid, value, ratio):
        """-> {key, value (fraction for percent stats), raw}"""
        if pid >= 10000:
            if ratio:
                v = value if abs(value) < 5 else value / 10000.0
            else:
                v = value
            base = self.pi.get(pid - 10000)
            name = self.T(base['Name']) if base else None
            return {'key': self.prop_key(pid, ratio), 'propId': pid, 'value': round(v, 6), 'isPercent': bool(ratio), 'name': (name + ('%' if ratio else '')) if name else None}
        p = self.pi.get(pid) or {}
        pct = bool(p.get('IsPercent'))
        v = value / 10000.0 if pct else value
        return {'key': self.prop_key(pid, ratio), 'propId': pid, 'value': round(v, 6), 'isPercent': pct, 'name': self.T(p.get('Name'))}

    def properties_meta(self):
        out = {}
        for i, p in sorted(self.pi.items()):
            out[p['Key']] = {'id': i, 'zh': self.T(p['Name']), 'en': self.T(p['Name'], 'en'), 'isPercent': bool(p['IsPercent'])}
        return out

    # ------------------------------------------------ damage rows
    @staticmethod
    def rate_of(d):
        """multiplier series x10000: RateLv, or FormulaParam7 for FormulaType 1 rows whose RateLv is zero."""
        rl = d['RateLv']
        if d['FormulaType'] == 1 and not any(rl) and any(d.get('FormulaParam7') or []):
            return d['FormulaParam7'], 'FormulaParam7'
        return rl, 'RateLv'

    @staticmethod
    def flat_of(d):
        if d['CalculateType'] == 1 and any(d.get('CureBaseValue') or []):
            return d['CureBaseValue'], 'CureBaseValue'
        if d['FormulaType'] == 1 and any(d.get('FormulaParam10') or []):
            return d['FormulaParam10'], 'FormulaParam10'
        return None, None

    def hit_info(self, did, nlev):
        d = self.dmg[did]
        t = d['Type']
        tn = DMG_TYPE.get(t)
        el = d['Element']
        return OrderedDict([
            ('damageId', did),
            ('type', tn[2] if tn else f'unknown{t}'), ('typeId', t), ('typeName', tn[0] if tn else None),
            ('calc', CALC_TYPE.get(d['CalculateType'], str(d['CalculateType']))),
            ('element', ELEMENT_KEYS.get(el, str(el))), ('elementId', el),
            ('scaling', RELATED.get(d['RelatedProperty'], f"prop{d['RelatedProperty']}")),
            ('rate', [round(x / 10000.0, 6) for x in self.rate_of(d)[0][:nlev]]),
            ('rateField', self.rate_of(d)[1]),
            ('flat', (self.flat_of(d)[0] or [])[:nlev] or None),
            ('energy', [x / 100.0 for x in d['Energy']]),
            ('concerto', [x / 100.0 for x in d['ElementPower']]), ('elementPowerType', d['ElementPowerType']),
            ('toughness', [x / 10000.0 for x in d['ToughLv']]),
            ('offTune', [x / 10000.0 for x in d['WeaknessLvl']]),
            ('hardness', [x / 10000.0 for x in d['HardnessLv']]),
            ('formulaType', d['FormulaType']),
            ('subType', d['SubType']),
        ])

    def match_terms(self, rows_terms, cand_ids, nlev, flats=None):
        """rows_terms: list of per-level [value%] -> list of matching damage ids (flats: per-level flat addend)."""
        res = []
        for did in cand_ids:
            d = self.dmg.get(did)
            if not d:
                continue
            rl = self.rate_of(d)[0]
            if not rl:
                continue
            if flats:
                fl = self.flat_of(d)[0]
                if not fl or any(abs((fl[l] if l < len(fl) else fl[0]) - f) > 1 for l, f in enumerate(flats)):
                    continue
            ok = True
            for l, v in enumerate(rows_terms):
                ref = rl[l] if l < len(rl) else (rl[0] if len(rl) == 1 else None)
                if ref is None or abs(round(v * 100) - ref) > 1:
                    ok = False
                    break
            if ok:
                res.append(did)
        return res

    NONDMG = re.compile(r'(盾|减伤|减免|提升|加成|增加|倍率|速度|生命值|治疗|回复|恢复|上限|降低|概率|效率)')

    def damage_like(self, label, context=None):
        if context is not None:  # echo templates: text right after the placeholder
            return '伤害' in context[:12] and not self.NONDMG.search(context[:12])
        return '伤害' in label and not self.NONDMG.search(label.replace('伤害', ''))

    def parse_rows(self, rows, cand_ids, wide_ids, nlev, label_key='label'):
        """rows: list of dict(label, labelEn, values[str per level]). Returns params, hits, used ids."""
        params, hits, used = [], [], set()
        for r in rows:
            vals = r['values'][:nlev] if r['values'] else []
            pr = OrderedDict([('label', r['label']), ('labelEn', r.get('labelEn')), ('values', vals)])
            params.append(pr)
            if not vals or '%' not in vals[0]:
                continue
            parsed = [parse_expr(v) for v in vals]
            shapes = {(tuple(c for _, c in p[0]), len(p[1])) for p in parsed}
            leftovers = {p[2] for p in parsed if p[2]}
            flat_series = [p[1][0] for p in parsed] if parsed and len(parsed[0][1]) == 1 and len(parsed[0][0]) == 1 else None
            if len(shapes) != 1:
                hits.append({'label': r['label'], 'confidence': 'low', 'lowReason': 'expression shape differs across levels', 'raw': vals})
                self.warn['hit_shape'] += 1
                continue
            nterm = len(parsed[0][0])
            for ti in range(nterm):
                series = [p[0][ti][0] for p in parsed]
                count = parsed[0][0][ti][1]
                m = self.match_terms(series, cand_ids, nlev, flat_series)
                where = 'skill'
                if not m:
                    m = self.match_terms(series, wide_ids, nlev, flat_series)
                    where = 'role'
                if len(m) > 1 and r.get('context'):
                    els = [k for k, v in ELEM_ZH.items() if v in r['context'][:16]]
                    if els:
                        m2 = [x for x in m if self.dmg[x]['Element'] in els]
                        if m2:
                            m = m2
                h = OrderedDict([('label', r['label']), ('labelEn', r.get('labelEn')), ('term', ti), ('count', count),
                                 ('multiplier', [round(x / 100.0, 6) for x in series])])
                if leftovers:
                    h['exprNote'] = sorted(leftovers)
                if flat_series:
                    h['flatAdd'] = flat_series
                if m:
                    used.update(m)
                    infos = [self.hit_info(x, nlev) for x in m]
                    # split by (type, element, scaling, calc): each group becomes its own hit carrying its own type.
                    # The first group stays the primary hit; later groups are emitted as alternative hits
                    # (alt=True: same description term, different damage rows/type; engines exclude them from default sums).
                    groups = OrderedDict()
                    for i in infos:
                        groups.setdefault((i['typeId'], i['elementId'], i['scaling'], i['calc']), []).append(i)
                    gl = list(groups.values())
                    for gi, ginfos in enumerate(gl):
                        hh = OrderedDict(h) if gi else h
                        first = ginfos[0]
                        for k, v in first.items():
                            if k not in ('rate',):
                                hh[k] = v
                        hh['damageIds'] = [i['damageId'] for i in ginfos]
                        hh.pop('variants', None)
                        if len(ginfos) > 1:
                            hh['variants'] = [{k: v for k, v in i.items() if k in ('damageId', 'type', 'typeId', 'element', 'scaling', 'energy', 'concerto', 'toughness', 'offTune', 'flat')} for i in ginfos[1:]]
                        lows = []
                        if len(gl) > 1:
                            hh['splitGroup'] = gi
                            hh['splitOf'] = len(gl)
                            if gi:
                                hh['alt'] = True
                                lows.append('alternative damage rows for the same description term (type %s); excluded from default sums' % first.get('type'))
                            else:
                                self.warn['hit_split'] += 1
                        if leftovers:
                            lows.append('description expression contains text: ' + '|'.join(sorted(leftovers)))
                        if where == 'role':
                            hh['matchedOutsideSkill'] = True
                        if first['typeId'] not in DMG_TYPE:
                            lows.append(f"damage Type {first['typeId']} has no known bonus category")
                        hh['confidence'] = 'low' if lows else 'high'
                        if lows:
                            hh['lowReason'] = '; '.join(lows)
                            self.warn['hit_low'] += 1
                        else:
                            hh.pop('lowReason', None)
                        if gi:
                            hits.append(hh)
                    if len(gl) > 1:
                        # keep primary before its alternatives
                        alts = hits[len(hits) - (len(gl) - 1):]
                        del hits[len(hits) - (len(gl) - 1):]
                        hits.append(h)
                        hits.extend(alts)
                        continue
                else:
                    lab = r['label'] or ''
                    damage_like = self.damage_like(lab, r.get('context'))
                    if not damage_like:
                        pr['kind'] = 'nonDamagePercent'
                        continue
                    h['confidence'] = 'low'
                    h['lowReason'] = 'no damage.json row reproduces the displayed multiplier at every level; type/element must be inferred'
                    self.warn['hit_unmatched'] += 1
                hits.append(h)
        return params, hits, used

    def link_outro(self, sk_out):
        """Outro (type 11) skills whose description multiplier matched no damage row: link the role's unlinked outro-type rows."""
        cand = [(s, u) for s in sk_out for u in s.get('unlinkedDamage', []) if u.get('type') == 'outro']
        if not cand:
            return
        for o in [s for s in sk_out if s['type'] == 11 and not s['hits']]:
            m = re.search(r'造成[^。]*?(\d+(?:\.\d+)?)%', o.get('desc') or '')
            want = float(m.group(1)) / 100 if m else None
            exact = [(s, u) for s, u in cand if want is not None and u['rate'] and abs(u['rate'][-1] - want) < 1e-3]
            s, u = (exact or cand)[0]
            h = OrderedDict([('label', o['name'] + '伤害'), ('labelEn', (o.get('nameEn') or '') + ' DMG'), ('term', 0), ('count', 1)])
            mult = u['rate'][-1] if exact else want if want is not None else u['rate'][-1]
            h['multiplier'] = [round(mult, 6)] * max(1, o.get('maxLevel') or 1)
            for k in ('damageId', 'type', 'typeId', 'typeName', 'calc', 'element', 'elementId', 'scaling', 'rateField', 'flat', 'energy', 'concerto', 'elementPowerType', 'toughness', 'offTune', 'hardness', 'formulaType', 'subType'):
                h[k] = u.get(k)
            h['linkedFrom'] = s['id']
            h['rate'] = u['rate']  # raw row RateLv (/100), kept for traceability; multiplier may be the description value (low)
            if exact:
                h['confidence'] = 'high'
            else:
                h['confidence'] = 'low'
                h['lowReason'] = 'outro row linked by damage type (no row rate equals the description %%); multiplier = description value %s%%, element/type from damage row %s (rate %s)' % (round(mult * 100, 2), u['damageId'], u['rate'][-1])
                self.warn['outro_link_low'] += 1
            self.warn['outro_linked'] += 1
            o['hits'] = [h]
            s['unlinkedDamage'] = [x for x in s['unlinkedDamage'] if x is not u]
            if not s['unlinkedDamage']:
                s.pop('unlinkedDamage')

    # ------------------------------------------------ resonators
    def resonators(self):
        S = self.S
        roles = [r for r in S.t('role/roleinfo.json') if r['RoleType'] == 1 and not r['IsTrial']]
        growth = S.t('property/rolepropertygrowth.json')
        breach = defaultdict(list)
        for b in S.t('role_level/rolebreach.json'):
            breach[b['BreachGroupId']].append(b)
        skills = defaultdict(list)
        for s in S.t('skill/skill.json'):
            skills[s['SkillGroupId']].append(s)
        sdesc = defaultdict(list)
        for d in S.t('skill/skilldescription.json'):
            sdesc[d['SkillLevelGroupId']].append(d)
        stypes = {r['Id']: r for r in S.t('skill/skilltype.json')}
        tree = defaultdict(list)
        for n in S.t('skillTree/skilltree.json'):
            tree[n['NodeGroup']].append(n)
        chains = defaultdict(list)
        for c in S.t('resonate_chain/resonantchain.json'):
            chains[c['GroupId']].append(c)
        elem = {r['Id']: r for r in S.t('element_info/elementinfo.json')}
        out = []
        for r in sorted(roles, key=lambda x: x['Id']):
            rid = r['Id']
            bp = self.bp.get(r['PropertyId'])
            ent = OrderedDict()
            ent['id'] = rid
            ent['name'] = self.T(r['Name'])
            ent['nameEn'] = self.T(r['Name'], 'en')
            if not ent['name']:
                self.warn['missing_name'] += 1
            ent['rarity'] = r['QualityId']
            ent['element'] = ELEMENT_KEYS.get(r['ElementId'])
            ent['elementId'] = r['ElementId']
            ent['elementName'] = self.T(elem[r['ElementId']]['Name']) if r['ElementId'] in elem else None
            ent['weaponType'] = r['WeaponType']
            ent['maxLevel'] = r['MaxLevel']
            base = OrderedDict([('hp', bp['LifeMax']), ('atk', bp['Atk']), ('def', bp['Def']),
                                ('critRate', bp['Crit'] / 10000.0), ('critDmg', bp['CritDamage'] / 10000.0),
                                ('energyRegen', bp['EnergyEfficiency'] / 10000.0), ('energyMax', bp['EnergyMax'] / 100.0),
                                ('concertoMax', bp['ElementEnergyMax'] / 100.0)])
            ent['base'] = base
            ent['breaches'] = [{'breach': b['BreachLevel'], 'maxLevel': b['MaxLevel']} for b in sorted(breach[r['BreachId']], key=lambda x: x['BreachLevel'])]
            ent['levelStats'] = [[g['Level'], g['BreachLevel'], round(bp['LifeMax'] * g['LifeMaxRatio'] / 10000.0, 4), round(bp['Atk'] * g['AtkRatio'] / 10000.0, 4), round(bp['Def'] * g['DefRatio'] / 10000.0, 4)] for g in growth]
            ent['levelStatsFields'] = ['level', 'breach', 'hp', 'atk', 'def']
            # skills
            role_skills = sorted(skills[r['SkillId']], key=lambda s: s['Id'])
            wide = []
            for s in role_skills:
                wide += [d for d in s['DamageList'] if d in self.dmg]
            sk_out, all_used = [], set()
            for s in role_skills:
                nlev = s['MaxSkillLevel']
                rows = []
                for d in sorted(sdesc[s['SkillLevelGroupId']], key=lambda x: (x['Order'], x['Id'])):
                    vals = d['SkillDetailNum'][0]['ArrayString'] if d['SkillDetailNum'] else []
                    rows.append({'label': clean(self.T(d['AttributeName'])), 'labelEn': clean(self.T(d['AttributeName'], 'en')), 'values': vals})
                cand = [d for d in s['DamageList'] if d in self.dmg]
                params, hits, used = self.parse_rows(rows, cand, wide, nlev)
                all_used |= used
                st = stypes.get(s['SkillType'])
                so = OrderedDict([('id', s['Id']), ('type', s['SkillType']), ('typeName', self.T(st['TypeName']) if st else None),
                                  ('typeNameEn', self.T(st['TypeName'], 'en') if st else None),
                                  ('name', clean(self.T(s['SkillName']))), ('nameEn', clean(self.T(s['SkillName'], 'en'))),
                                  ('maxLevel', nlev),
                                  ('desc', clean(subst(self.T(s['SkillDescribe']), s['SkillDetailNum']))),
                                  ('descEn', clean(subst(self.T(s['SkillDescribe'], 'en'), s['SkillDetailNum']))),
                                  ('params', params), ('hits', hits)])
                for p in params:
                    lab = p['label'] or ''
                    if '共鸣能量' in lab and ('消耗' in lab) and p['values']:
                        so['energyCost'] = num(p['values'][0])
                    if '协奏能量' in lab and p['values']:
                        so['concertoGain'] = num(p['values'][0])
                    if lab.startswith('冷却') and p['values']:
                        so['cooldown'] = num(p['values'][0])
                unl = [d for d in cand if d not in used]
                if unl:
                    so['unlinkedDamage'] = [dict(self.hit_info(d, nlev), confidence='low', lowReason='damage row not referenced by any description multiplier (conditional/variant hit or non-damage effect)') for d in unl]
                    self.warn['unlinked_damage'] += len(unl)
                rated = [h for h in hits]
                so['confidence'] = 'high' if all(h.get('confidence') == 'high' for h in rated) else 'low'
                if so['confidence'] == 'low':
                    so['lowReason'] = 'some description multipliers could not be tied to damage rows'
                if s['SkillType'] == 7:
                    so['nonCombat'] = True  # life skill (cooking etc.)
                sk_out.append(so)
            ent['skills'] = sk_out
            self.link_outro(sk_out)
            lib = [s for s in sk_out if s['type'] == 3 and 'energyCost' in s]
            cost_ = lib[0]['energyCost'] if lib else (0.0 if base['energyMax'] == 0 else None)
            ent['energy'] = OrderedDict([('liberationCost', cost_),
                                         ('energyMaxTable', base['energyMax']),
                                         ('consistent', cost_ == base['energyMax'] if cost_ is not None else None),
                                         ('concertoMax', base['concertoMax'])])
            if not lib and base['energyMax'] == 0:
                ent['energy']['note'] = 'no resonance-energy cost (EnergyMax=0, liberation uses a character-specific resource)'
            # skill tree: inherent + stat nodes
            inh, stat_nodes, totals = [], [], defaultdict(float)
            skmap = {s['id']: s for s in sk_out}
            for n in sorted(tree[r['SkillTreeGroupId']], key=lambda x: x['NodeIndex']):
                if n['NodeType'] == 4:
                    props = [self.norm_prop(p['Id'], p['Value'], p['IsRatio']) for p in n['Property']]
                    for p in props:
                        totals[p['key']] += p['value']
                    stat_nodes.append({'node': n['NodeIndex'], 'title': self.T(n['PropertyNodeTitle']), 'props': props})
                elif n['NodeType'] == 3 and n['SkillId'] in skmap:
                    inh.append({'node': n['NodeIndex'], 'skillId': n['SkillId'], 'type': skmap[n['SkillId']]['type']})
            ent['inherents'] = [dict(name=skmap[i['skillId']]['name'], nameEn=skmap[i['skillId']]['nameEn'], desc=skmap[i['skillId']]['desc'], **i) for i in inh if skmap[i['skillId']]['type'] in (4, 8, 9, 10)]
            ent['statNodes'] = stat_nodes
            ent['statNodeTotals'] = {k: round(v, 6) for k, v in totals.items()}
            ch = []
            for c in sorted(chains[r['ResonantChainGroupId']], key=lambda x: x['GroupIndex']):
                prm = c['AttributesDescriptionParams']
                ch.append(OrderedDict([('index', c['GroupIndex']), ('name', self.T(c['NodeName'])), ('nameEn', self.T(c['NodeName'], 'en')),
                                       ('desc', clean(subst(self.T(c['AttributesDescription']), prm))),
                                       ('descEn', clean(subst(self.T(c['AttributesDescription'], 'en'), prm))),
                                       ('params', prm), ('buffIds', c['BuffIds']),
                                       ('addProp', [self.norm_prop(p['Id'], p['Value'], p['IsRatio']) for p in c['AddProp']])]))
            ent['chains'] = ch
            if len(ch) != 6:
                self.warn['chain_count_not_6'] += 1
            out.append(ent)
        return out

    # ------------------------------------------------ text effect parsing (weapons/sonatas)
    STAT_WORDS = [
        ('全属性伤害加成', 'DamageChangeAllElement'), ('属性伤害加成', 'DamageChangeAllElement'),
        ('共鸣技能伤害加成', 'DamageChangeNormalSkill'), ('共鸣技能伤害', 'DamageChangeNormalSkill'),
        ('共鸣解放伤害加成', 'DamageChangeUltra'), ('共鸣解放伤害', 'DamageChangeUltra'),
        ('普攻伤害加成', 'DamageChangeAuto'), ('普攻伤害', 'DamageChangeAuto'),
        ('重击伤害加成', 'DamageChangeCast'), ('重击伤害', 'DamageChangeCast'),
        ('变奏技能伤害', 'DamageChangeQTE'), ('延奏技能伤害', 'DamageChangeOutro'), ('声骸技能伤害', 'DamageChangePhantom'),
        ('冷凝伤害', 'DamageChangeElement1'), ('热熔伤害', 'DamageChangeElement2'), ('导电伤害', 'DamageChangeElement3'),
        ('气动伤害', 'DamageChangeElement4'), ('衍射伤害', 'DamageChangeElement5'), ('湮灭伤害', 'DamageChangeElement6'),
        ('物理伤害', 'DamageChangePhys'),
        ('暴击伤害', 'CritDamage'), ('暴击', 'Crit'), ('共鸣效率', 'EnergyEfficiency'), ('治疗效果加成', 'HealChange'),
        ('攻击', 'Atk%'), ('生命', 'LifeMax%'), ('防御', 'Def%'),
    ]
    COND_RE = re.compile(r'(时|后|期间|命中|施放|释放|造成|处于|拥有|当|每|若|如果|登场|退场|切换|附近|叠加)')

    def parse_effects(self, desc_tpl, params_by_rank):
        """desc_tpl with {i}; params_by_rank[r][i]. Returns list of effects with confidence."""
        if not desc_tpl:
            return []
        tpl = clean(desc_tpl)
        sentences = re.split(r'(?<=[。；;])', tpl)
        effs = []
        for sent in sentences:
            for m in re.finditer(r'([^，。；;、]*?)(提升|增加|提高|加深)\s*\{(\d+)\}', sent):
                head = m.group(1)
                key = None
                for w, k in self.STAT_WORDS:
                    if w in head:
                        key = k
                        break
                idx = int(m.group(3))
                vals = [num(p[idx]) if idx < len(p) else None for p in params_by_rank]
                pre = sent[:m.start()]
                cond = bool(self.COND_RE.search(pre + head))
                e = OrderedDict([('stat', key), ('verb', m.group(2)), ('values', [None if v is None else round(v / 100.0, 6) for v in vals]),
                                 ('isPercentText', all(idx < len(p) and '%' in str(p[idx]) for p in params_by_rank)),
                                 ('conditional', cond), ('text', clean(sent).strip())])
                st = re.search(r'可叠加\{(\d+)\}层', sent)
                if st:
                    e['maxStacks'] = [num(p[int(st.group(1))]) for p in params_by_rank]
                du = re.search(r'持续\{(\d+)\}秒', sent)
                if du:
                    e['duration'] = [num(p[int(du.group(1))]) for p in params_by_rank]
                lows = []
                if key is None:
                    lows.append('stat not recognised from text')
                if cond:
                    lows.append('conditional/triggered effect parsed from text; trigger not machine-modelled')
                if m.group(2) == '加深':
                    lows.append('加深 (deepen/amplify) is a separate multiplier zone')
                if not e['isPercentText']:
                    lows.append('value is not a percentage')
                e['confidence'] = 'low' if lows else 'high'
                if lows:
                    e['lowReason'] = '; '.join(lows)
                effs.append(e)
        return effs

    # ------------------------------------------------ weapons
    def weapons(self):
        S = self.S
        curve = {(g['CurveId'], g['Level'], g['BreachLevel']): g['CurveValue'] for g in S.t('property/weaponpropertygrowth.json')}
        levels = sorted({(g['Level'], g['BreachLevel']) for g in S.t('property/weaponpropertygrowth.json')})
        wb = defaultdict(list)
        for b in S.t('weapon/weaponbreach.json'):
            wb[b['BreachId']].append(b)
        reson = defaultdict(list)
        for x in S.t('weapon/weaponreson.json'):
            reson[x['ResonId']].append(x)
        out = []
        for w in sorted(S.t('weapon/weaponconf.json'), key=lambda x: x['ItemId']):
            e = OrderedDict()
            e['id'] = w['ItemId']
            e['name'] = self.T(w['WeaponName'])
            e['nameEn'] = self.T(w['WeaponName'], 'en')
            if not e['name']:
                self.warn['missing_name'] += 1
            e['rarity'] = w['QualityId']
            e['weaponType'] = w['WeaponType']
            fp, sp = w['FirstPropId'], w['SecondPropId']
            e['mainStat'] = self.norm_prop(fp['Id'], fp['Value'], fp['IsRatio'])
            e['subStat'] = self.norm_prop(sp['Id'], sp['Value'], sp['IsRatio'])
            e['curves'] = [w['FirstCurve'], w['SecondCurve']]
            maxb = {b['Level']: b['LevelLimit'] for b in wb[w['BreachId']]}
            e['breaches'] = [{'breach': k, 'maxLevel': v} for k, v in sorted(maxb.items())]
            maxlv = max(maxb.values()) if maxb else 90
            ls = []
            for (lv, br) in levels:
                if lv > maxlv or (br in maxb and False):
                    continue
                c1, c2 = curve.get((w['FirstCurve'], lv, br)), curve.get((w['SecondCurve'], lv, br))
                if c1 is None or c2 is None:
                    continue
                ls.append([lv, br, round(e['mainStat']['value'] * c1 / 10000.0, 6), round(e['subStat']['value'] * c2 / 10000.0, 6)])
            e['levelStats'] = ls
            e['levelStatsFields'] = ['level', 'breach', 'main', 'sub']
            params = [p['ArrayString'] for p in w['DescParams']]
            nr = max((len(p) for p in params), default=0)
            by_rank = [[p[r] if r < len(p) else p[-1] for p in params] for r in range(nr)]
            rs = sorted(reson.get(w['ResonId'], []), key=lambda x: x['Level'])
            e['passive'] = OrderedDict([
                ('name', self.T(rs[0]['Name']) if rs else None), ('nameEn', self.T(rs[0]['Name'], 'en') if rs else None),
                ('descTemplate', clean(self.T(w['Desc']))),
                ('params', params),
                ('descByRank', [clean(subst(self.T(w['Desc']), p)) for p in by_rank]),
                ('descEnRank1', clean(subst(self.T(w['Desc'], 'en'), by_rank[0])) if by_rank else None),
                ('buffIdsByRank', [x['Effect'] for x in rs]),
                ('effects', self.parse_effects(self.T(w['Desc']), by_rank)),
            ])
            out.append(e)
        return out

    # ------------------------------------------------ echoes
    def echo_tables(self):
        S = self.S
        growth = defaultdict(dict)
        for g in S.t('phantom/phantomgrowth.json'):
            growth[g['GrowthId']][g['Level']] = g['Value']
        items = {x['Id']: x for x in S.t('phantom/phantommainpropitem.json')}
        groups = defaultdict(list)
        for x in S.t('phantom/phantommainproperty.json'):
            groups[x['RandGroupId']].append(x)
        main = OrderedDict()
        for gid in sorted(groups):
            opts = []
            for row in groups[gid]:
                pg = row['PropGroup']
                prim = items[pg[0]]
                sec = items[pg[1]] if len(pg) > 1 else None
                def one(it):
                    ratio = it['AddType'] == 2
                    p = self.norm_prop(it['PropId'], it['StandardProperty'], ratio) if it['PropId'] >= 10000 else self.norm_prop(it['PropId'], it['StandardProperty'], False)
                    g = growth[it['GrowthId']]
                    p['byLevel'] = [round(p['value'] * g[l] / 10000.0, 6) for l in sorted(g)]
                    return p
                opts.append({'main': one(prim), 'fixed': one(sec) if sec else None})
            main[str(gid)] = opts
        sub = []
        for x in S.t('phantom/phantomsubproperty.json'):
            ratio = x['AddType'] == 2
            p = self.norm_prop(x['PropId'], x['SubStandardProperty'], ratio)
            p['addType'] = x['AddType']
            p['id'] = x['Id']
            sub.append(p)
        cost = {r['Rare']: r['Cost'] for r in S.t('phantom/phantomrarity.json')}
        qual = {q['Quality']: q['LevelLimit'] for q in S.t('phantom/phantomquality.json')}
        return main, sub, cost, qual

    def echoes(self, cost, qual):
        S = self.S
        sk = {x['PhantomSkillId']: x for x in S.t('phantom/phantomskill.json')}
        by_m = defaultdict(list)
        for x in S.t('phantom/phantomitem.json'):
            by_m[x['MonsterId']].append(x)
        out = []
        for mid in sorted(by_m):
            its = sorted(by_m[mid], key=lambda x: x['QualityId'])
            top = its[-1]
            e = OrderedDict()
            e['id'] = mid
            e['name'] = self.T(top['MonsterName'])
            e['nameEn'] = self.T(top['MonsterName'], 'en')
            if not e['name']:
                self.warn['missing_name'] += 1
            e['rarity'] = top['Rarity']
            e['cost'] = cost.get(top['Rarity'])
            e['phantomType'] = top['PhantomType']
            e['elements'] = [ELEMENT_KEYS.get(x) for x in top['ElementType']]
            e['sonataGroups'] = sorted({g for it in its for g in it['FetterGroup']})
            e['items'] = [{'itemId': it['ItemId'], 'quality': it['QualityId'], 'maxLevel': qual.get(it['QualityId']), 'mainPropGroup': it['MainProp']['RandGroupId']} for it in its]
            s = sk.get(top['SkillId'])
            if s:
                ranks = [x['ArrayString'] for x in s['LevelDescStrArray']]
                tpl = self.T(s['DescriptionEx'])
                rows = []
                if ranks:
                    for i in range(len(ranks[0])):
                        ctx = ''
                        mm = re.search(r'\{%d\}([^{]*)' % i, clean(tpl) or '')
                        if mm:
                            ctx = mm.group(1)
                        rows.append({'label': f'{{{i}}}', 'values': [r[i] if i < len(r) else r[-1] for r in ranks], 'context': ctx})
                cand = [d for d in s['SettleIds'] if d in self.dmg]
                params, hits, used = self.parse_rows(rows, cand, cand, len(ranks))
                e['skill'] = OrderedDict([('id', s['PhantomSkillId']), ('cooldown', s['SkillCD']),
                                          ('descTemplate', clean(tpl)),
                                          ('descByRank', [clean(subst(tpl, r)) for r in ranks]),
                                          ('descEnRank5', clean(subst(self.T(s['DescriptionEx'], 'en'), ranks[-1])) if ranks else None),
                                          ('simple', clean(self.T(s['SimplyDescription']))),
                                          ('params', ranks), ('hits', hits)])
                unl = [d for d in cand if d not in used]
                if unl:
                    e['skill']['unlinkedDamage'] = [dict(self.hit_info(d, len(ranks)), confidence='low', lowReason='damage row not referenced by a description multiplier') for d in unl]
                    self.warn['unlinked_damage_echo'] += len(unl)
                e['skill']['confidence'] = 'high' if all(h.get('confidence') == 'high' for h in hits) else 'low'
                if e['skill']['confidence'] == 'low':
                    e['skill']['lowReason'] = 'some description multipliers could not be tied to damage rows'
            else:
                self.warn['echo_no_skill'] += 1
            out.append(e)
        return out

    def sonatas(self):
        S = self.S
        fet = {x['Id']: x for x in S.t('phantom/phantomfetter.json')}
        out = []
        for g in sorted(S.t('phantom/phantomfettergroup.json'), key=lambda x: x['Id']):
            pieces = OrderedDict()
            for kv in sorted(g['FetterMap'], key=lambda x: x['Key']):
                f = fet.get(kv['Value'])
                if not f:
                    continue
                prm = f['EffectDescriptionParam']
                static = [self.norm_prop(p['Id'], p['Value'], p['IsRatio']) for p in f['AddProp']]
                desc = self.T(f['EffectDescription'])
                txt = self.parse_effects(desc, [prm]) if '{' in (desc or '') else []
                for t in txt:
                    t['values'] = t['values'][0] if t['values'] else None
                pieces[str(kv['Key'])] = OrderedDict([('fetterId', f['Id']), ('name', self.T(f['Name'])),
                                                      ('desc', clean(subst(desc, prm))), ('descEn', clean(subst(self.T(f['EffectDescription'], 'en'), prm))),
                                                      ('params', prm), ('addProp', static), ('buffIds', f['BuffIds']),
                                                      ('effects', [dict(p, confidence='high', source='AddProp') for p in static] + ([] if static else txt))])
            out.append(OrderedDict([('id', g['Id']), ('name', self.T(g['FetterGroupName'])), ('nameEn', self.T(g['FetterGroupName'], 'en')),
                                    ('pieces', pieces)]))
        return out

    # ------------------------------------------------ enemies
    def enemies(self):
        S = self.S
        hb = {x['Id']: x for x in S.t('handbook/monsterhandbook.json')}
        by_bp = defaultdict(list)  # BlueprintType -> [(templateId, attributeComponent)]
        for x in S.t('template/templateconfig.json'):
            ac = (x.get('ComponentsData') or {}).get('AttributeComponent')
            if ac and ac.get('PropertyId') in self.bp:
                by_bp[x.get('BlueprintType')].append((x['Id'], ac))
        rar = {r['Id']: self.T(r['RarityDesc']) for r in S.t('monster_Info/monsterrarity.json')}
        out = []
        for m in sorted(S.t('monster_Info/monsterinfo.json'), key=lambda x: x['Id']):
            e = OrderedDict([('id', m['Id']), ('name', self.T(m['Name'])), ('nameEn', self.T(m['Name'], 'en')),
                             ('rarity', m['RarityId']), ('rarityName', rar.get(m['RarityId'])),
                             ('elements', [ELEMENT_KEYS.get(x) for x in m['ElementIdArray']]),
                             ('blueprint', m['MonsterEntityID'])])
            if not e['name']:
                self.warn['missing_name'] += 1
            tpls = sorted(by_bp.get(m['MonsterEntityID'], []), key=lambda x: x[0])
            if tpls:
                pids = []
                for _, ac in tpls:
                    if ac['PropertyId'] not in pids:
                        pids.append(ac['PropertyId'])
                pid = tpls[0][1]['PropertyId']
                e['propertyId'] = pid
                b = self.bp[pid]
                e['base'] = OrderedDict([('level', b['Lv']), ('hp', b['LifeMax']), ('atk', b['Atk']), ('def', b['Def']),
                                         ('toughMax', b['ToughMax']), ('hardnessMax', b['HardnessMax']), ('rageMax', b['RageMax']),
                                         ('offTuneMax', b['WeaknessBuildUpMax'] / 10000.0)])
                e['res'] = OrderedDict((ELEMENT_KEYS[i], b[f] / 10000.0) for i, f in RES_FIELDS.items())
                curves = sorted({ac.get('MonsterPropGrowthId', 0) for _, ac in tpls})
                e['growthCurves'] = curves
                e['spawnLevels'] = sorted({ac['Level'] for _, ac in tpls})
                variants = []
                for v in pids:
                    bv = self.bp[v]
                    variants.append({'propertyId': v, 'hp': bv['LifeMax'], 'atk': bv['Atk'], 'def': bv['Def'],
                                     'res': [bv[f] / 10000.0 for _, f in sorted(RES_FIELDS.items())]})
                e['propertyVariants'] = variants
                res_same = len({tuple(v['res']) for v in variants}) == 1
                def_same = len({v['def'] for v in variants}) == 1
                e['statsLink'] = 'monsterinfo.MonsterEntityID == templateconfig.BlueprintType -> AttributeComponent.PropertyId (lowest template id)'
                lows = []
                if not res_same:
                    lows.append(f'{len(variants)} property variants with different resistances across spawn templates; primary = lowest template id')
                if not def_same:
                    lows.append('base DEF differs across variants')
                e['confidence'] = 'low' if lows else 'high'
                if lows:
                    e['lowReason'] = '; '.join(lows)
                    self.warn['enemy_variant_res_differs'] += 1
            else:
                e['propertyId'] = None
                e['confidence'] = 'low'
                e['lowReason'] = 'no spawn template with an AttributeComponent for this blueprint'
                self.warn['enemy_no_stats'] += 1
            if m['Id'] in hb:
                e['handbookResistanceElement'] = hb[m['Id']]['ResistanceElement']
                e['echoMonsterId'] = hb[m['Id']]['MonsterId'] or None
            out.append(e)
        return out

    def enemy_growth(self):
        cur = defaultdict(list)
        for g in self.S.t('property/monsterpropertygrowth.json'):
            cur[g['CurveId']].append(g)
        out = OrderedDict()
        for c, rows in sorted(cur.items()):
            rows.sort(key=lambda x: x['Level'])
            out[str(c)] = {'fields': ['level', 'hpRatio', 'atkRatio', 'defRatio', 'toughRatio'],
                           'rows': [[r['Level'], r['LifeMaxRatio'] / 10000.0, r['AtkRatio'] / 10000.0, r['DefRatio'] / 10000.0, r['HardnessMaxRatio'] / 10000.0] for r in rows]}
        return out

    # ------------------------------------------------ encore comparison / supplement
    def encore(self, data):
        info = OrderedDict([('api', ENCORE_API), ('cacheBucket', None), ('newestVersion', None), ('missingInRepo', {}), ('supplemented', 0)])
        if self.a.no_encore:
            info['skipped'] = True
            return info
        import encore_fetch as E
        vl = E.get(ENCORE_API + 'diff/inline?gameVer=list', '3.7.8', as_json=True)
        vers = []
        def walk(o):
            if isinstance(o, str) and re.match(r'^(Release|Beta)_\d', o):
                vers.append(o)
            elif isinstance(o, dict):
                for v in o.values():
                    walk(v)
                for k in o.keys():
                    walk(k)
            elif isinstance(o, list):
                for v in o:
                    walk(v)
        walk(vl)
        rel = sorted({v for v in vers if v.startswith('Release_')}, key=lambda v: [int(x) for x in re.findall(r'\d+', v)])
        info['newestVersion'] = rel[-1] if rel else None
        bucket = (rel[-1].split('_', 1)[1] if rel else 'unknown')
        info['cacheBucket'] = bucket
        lists = {'resonators': ('character', 'roleList', 'Id'), 'weapons': ('weapon', 'weapons', 'Id'),
                 'echoes': ('echo', 'Echo', 'Id'), 'enemies': ('monster', 'monsterList', 'Id')}
        for key, (ep, field, idf) in lists.items():
            d = E.get(ENCORE_API + ep, bucket, as_json=True) or {}
            rows = d.get(field, [])
            ids = {r[idf] for r in rows if isinstance(r, dict) and idf in r}
            if key == 'resonators':
                ids = {r[idf] for r in rows if r.get('RoleType', 1) == 1 and not r.get('IsTrial', False)} if rows and 'RoleType' in rows[0] else ids
            have = {e['id'] for e in data[key]}
            missing = sorted(ids - have)
            info['missingInRepo'][key] = missing
            info.setdefault('encoreCounts', {})[key] = len(ids)
            for mid in missing:
                det = E.get(f'{ENCORE_API}{ep}/{mid}', bucket, as_json=True)
                if not det:
                    continue
                ent = self.from_encore(key, mid, det)
                if ent:
                    data[key].append(ent)
                    info['supplemented'] += 1
        return info

    def from_encore(self, key, mid, det):
        """Minimal supplement entity built from an encore.moe detail payload (raw game fields)."""
        name = det.get('Name')
        if isinstance(name, dict):
            name = name.get('Content')
        base = OrderedDict([('id', mid), ('name', name or det.get('WeaponName') or det.get('MonsterName')), ('nameEn', None),
                            ('_source', 'encore.moe ' + ENCORE_API + key), ('confidence', 'low'),
                            ('lowReason', 'supplemented from encore.moe; not present in repo snapshot')])
        if key == 'resonators':
            base['rarity'] = det.get('QualityId')
            base['elementId'] = det.get('ElementId')
            base['element'] = ELEMENT_KEYS.get(det.get('ElementId'))
            base['skills'] = []
            for s in det.get('Skills', []):
                hits = []
                for a in s.get('SkillAttributes', []):
                    if a.get('values') and '%' in a['values'][0]:
                        hits.append({'label': a.get('attributeName'), 'raw': a['values'][:10], 'confidence': 'low', 'lowReason': 'encore display string only'})
                base['skills'].append({'id': s.get('SkillId'), 'typeName': s.get('SkillType'), 'name': s.get('SkillName'), 'hits': hits, 'confidence': 'low'})
        return base

    # ------------------------------------------------ anomalies (negative statuses / 异常效应)
    def anomalies(self):
        """Per-status GE fields from buff.json + per-level base from AbnormalDamage. Enum interpretation (UE GAS mirror) is an assumption."""
        buffs = {r['Id']: r for r in self.S.t('buff/buff.json')}
        lvl = self.S.t('AbnormalDamage/abnormaldamageconfig.json')
        def table(s):
            out = {}
            for part in str(s).split('|'):
                if '#' in part:
                    k, v = part.strip().split('#')
                    out[int(k)] = int(v)
            return [out[k] for k in sorted(out)] if out else None
        spec = [  # key, abnormal column id, buff id, element
            ('chafe', 1003, 10011000, 'glacio'), ('burst', 1004, 10020000, 'fusion'), ('flare', 1002, 10030000, 'electro'),
            ('erosion', 1001, 10040000, 'aero'), ('frazzle', 1005, 10050000, 'spectro'), ('bane', 1006, 10060000, 'havoc')]
        types = OrderedDict()
        for key, aid, bid, el in spec:
            b = buffs[bid]
            params = b['ExtraEffectParameters']
            tabs = [table(x) for x in params]
            e = OrderedDict([('abnormalId', aid), ('buffId', bid), ('zh', b['GrantedTags'][0].split('.')[-1] if b['GrantedTags'] else key), ('element', el),
                             ('duration', round(b['DurationMagnitude'][0], 3) if b['DurationMagnitude'] else None), ('period', b['Period']),
                             ('tickOnApply', b['bExecutePeriodicEffectOnApplication']), ('cap', b['StackLimitCount']),
                             ('stackDurationRefreshPolicy', b['StackDurationRefreshPolicy']), ('stackPeriodResetPolicy', b['StackPeriodResetPolicy']),
                             ('stackExpirationRemoveNumber', b['StackExpirationRemoveNumber']), ('clearOnOverflow', b['bClearStackOnOverflow']),
                             ('extraEffectCd', b['ExtraEffectCD'][0] if b['ExtraEffectCD'] else -1), ('params', params)])
            if key == 'chafe':
                e['table'] = tabs[2]; e['slowTable'] = tabs[0]; e['freezeTable'] = tabs[1]
                e['tableVariants'] = {'10010000': table(buffs[10010000]['ExtraEffectParameters'][2]), '10011000': tabs[2]}
            elif key == 'flare':
                e['table'] = tabs[3]; e['burstTable'] = tabs[4]; e['decayRatio'] = int(params[0]) / 10000.0; e['burstBuffId'] = int(params[2])
            elif key == 'bane':
                e['defReduceTable'] = [-x / 10000.0 for x in tabs[0]]
            else:
                e['table'] = tabs[0]
            types[key] = e
        return OrderedDict([('levelBase', [r['Abnormal1001'] for r in sorted(lvl, key=lambda r: r['Level'])]),
                            ('levelBaseNote', 'AbnormalDamage/abnormaldamageconfig Abnormal1001..1006 (identical columns) indexed by level-1; used with the applier level'),
                            ('tableNote', 'per-stack multiplier tables (ExtraEffectParameters "stack#value", /10000), index = stacks-1'),
                            ('enumNote', 'StackDurationRefreshPolicy 0=refresh on apply; StackPeriodResetPolicy 1=never reset; StackExpirationRemoveNumber 0=clear all, 1=remove one and refresh (UE GAS mirror, assumption)'),
                            ('types', types)])

    # ------------------------------------------------ main
    def run(self):
        data = OrderedDict()
        data['resonators'] = self.resonators()
        data['weapons'] = self.weapons()
        main, sub, cost, qual = self.echo_tables()
        data['echoes'] = self.echoes(cost, qual)
        data['echoMainStats'] = main
        data['echoMainStatsNote'] = 'key = phantomitem.MainProp.RandGroupId; byLevel index = echo level 0..25; value fraction for % stats'
        data['echoSubStats'] = sub
        data['echoSubStatsNote'] = 'SubStandardProperty only; per-roll tier values are encoded in phantomsubpropaction.BinData (not decoded) - see MECHANICS.md open questions'
        data['echoCost'] = cost
        data['sonatas'] = self.sonatas()
        data['enemies'] = self.enemies()
        data['enemyGrowth'] = self.enemy_growth()
        data['anomalies'] = self.anomalies()
        enc = self.encore(data)
        # validation: enemy DEF formula
        g0 = data['enemyGrowth']['0']['rows']
        def_ok = all(abs(800 * r[3] - (792 + 8 * r[0])) < 1e-6 for r in g0)
        try:
            commit = subprocess.check_output(['git', '-C', self.a.src, 'rev-parse', 'HEAD'], text=True).strip()
            cdate = subprocess.check_output(['git', '-C', self.a.src, 'log', '-1', '--format=%cI'], text=True).strip()
        except Exception:
            commit, cdate = None, None
        readme = open(os.path.join(self.a.src, 'README.md'), encoding='utf-8').read()
        gv = re.search(r'Game Version:\s*([\d.]+)', readme)
        rv = re.search(r'Resource Version:\s*([\d.]+)', readme)
        meta = OrderedDict()
        meta['game'] = 'Wuthering Waves'
        meta['schema'] = 'ww-1'
        meta['source_repo'] = 'Arikatsu/WutheringWaves_Data'
        meta['source_commit'] = commit
        meta['source_commit_date'] = cdate
        meta['version'] = rv.group(1) if rv else None
        meta['game_version'] = gv.group(1) if gv else None
        meta['resource_version'] = rv.group(1) if rv else None
        meta['digest_method'] = 'sha256 over sorted(relpath + "\\0" + file bytes + "\\0") of every repo file read'
        meta['source_digest'] = digest(self.a.src)
        meta['files_read'] = sorted(set(READ_FILES))
        meta['generated_at'] = datetime.datetime.now().astimezone().isoformat(timespec='seconds')
        meta['encore'] = enc
        meta['counts'] = {k: len(v) for k, v in data.items() if isinstance(v, list)}
        nh = [h for r in data['resonators'] for s in r['skills'] for h in s['hits']]
        meta['counts']['resonatorHits'] = len(nh)
        meta['counts']['resonatorHitsHigh'] = sum(1 for h in nh if h.get('confidence') == 'high')
        eh = [h for e in data['echoes'] for h in (e.get('skill') or {}).get('hits', [])]
        meta['counts']['echoHits'] = len(eh)
        meta['counts']['echoHitsHigh'] = sum(1 for h in eh if h.get('confidence') == 'high')
        meta['warnings'] = dict(self.warn)
        meta['constants'] = CONSTANTS
        meta['enemyDefFormulaCheck'] = {'formula': 'Def(Lv) = 800 * DefRatio(Lv) = 792 + 8*Lv', 'holdsForCurve0': def_ok}
        meta['damageTypes'] = {str(k): {'zh': v[0], 'en': v[1], 'key': v[2], 'confidence': DMG_TYPE_CONF[k]} for k, v in DMG_TYPE.items()}
        meta['damageTypesNote'] = 'damage.Type -> bonus category; mapping verified against encore.moe DamageList labels (cached 3.7.8 character pages). Types 6,9,10,11,14 unlabeled.'
        meta['elements'] = {str(k): {'key': v} for k, v in ELEMENT_KEYS.items()}
        for r in self.S.t('element_info/elementinfo.json'):
            meta['elements'][str(r['Id'])].update(zh=self.T(r['Name']), en=self.T(r['Name'], 'en'))
        meta['skillTypes'] = {str(r['Id']): {'zh': self.T(r['TypeName']), 'en': self.T(r['TypeName'], 'en')} for r in self.S.t('skill/skilltype.json')}
        meta['weaponTypes'] = {}
        meta['properties'] = self.properties_meta()
        meta['assumptions'] = [
            'Playable resonator = roleinfo.RoleType==1 and not IsTrial (includes each Rover element variant as its own entry).',
            'Hit attribution: a description multiplier term x%*n is tied to damage.json rows whose RateLv equals round(x*100) (+-1) at every skill level; ties within the same skill first, then anywhere in the role. Matched -> confidence high; else low with lowReason.',
            'damage rows listed in a skill but not referenced by any multiplier are exported under unlinkedDamage (confidence low).',
            'Energy = damage.Energy/100 resonance energy per hit; concerto = damage.ElementPower/100 per hit (ElementPowerType equals the attacker element in 93% of hits - treated as a tag, not a unit). Resonance skill / liberation / intro rows usually carry ElementPower 0: their concerto gain is the skill-level param 回复协奏能量 (exported as skill.concertoGain), presumably granted on cast by a buff - see MECHANICS.md.',
            'toughness/offTune/hardness = damage.ToughLv/WeaknessLvl/HardnessLv /10000 (scale per encore.moe display; game semantics of 共振度/偏谐值 not verified).',
            'Weapon stat at (level,breach) = base * weaponpropertygrowth.CurveValue/10000; resonator stat = base * rolepropertygrowth ratio/10000.',
            'Echo main stat at level L = StandardProperty * phantomgrowth(GrowthId,L)/10000; AddType 2 = percent, 1 = flat (percent-type props are /10000).',
            'Enemy stats at level L = baseproperty * monsterpropertygrowth(curve, L)/10000; curve 0 unless template sets MonsterPropGrowthId (encore.moe uses 3001 for some). DEF is identical on curves 0 and 3001.',
            'Weapon/sonata text effects parsed with a keyword lexicon; conditional ones are low confidence. Sonata AddProp effects are table-exact (high).',
        ]
        data_out = OrderedDict([('meta', meta)])
        data_out.update(data)
        os.makedirs(os.path.dirname(self.a.out), exist_ok=True)
        with open(self.a.out, 'w', encoding='utf-8') as f:
            json.dump(data_out, f, ensure_ascii=False, separators=(',', ':'))
        print(json.dumps({'out': self.a.out, 'counts': meta['counts'], 'warnings': meta['warnings'], 'encore': {k: (v if k != 'missingInRepo' else {a: len(b) for a, b in v.items()}) for k, v in enc.items()}}, ensure_ascii=False, indent=1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=DEF_SRC)
    ap.add_argument('--out', default=DEF_OUT)
    ap.add_argument('--no-encore', action='store_true')
    a = ap.parse_args()
    Builder(a).run()


if __name__ == '__main__':
    main()
