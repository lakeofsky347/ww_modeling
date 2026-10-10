# Round 3 additions (exec'd from build_action_frames.py, shares its namespace). Offline only.
# Adds: Philipp-DI/WuWaSim (3.6 client-extracted timings, seconds) for resonators WuwaLAB lacks,
#       Riley31415/wuwa_calc (animFrames @60fps) for Suoming + Bell-Borne Geochelone + cross-checks,
#       WuWaSim-vs-WuwaLAB cross-check (basic chain + intro), missing recomputed against ww.json (64 ids).
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from riley_parse import parse as riley_parse

PHD = os.path.join(RAW, 'philipp_wuwasim'); RLD = os.path.join(RAW, 'riley_wuwa_calc')
def _commit(p):
    t = rd(os.path.join(p, 'COMMIT.txt'))
    return re.search(r'commit (\w+)', t).group(1), re.search(r'retrieved (\S+)', t).group(1)
PH_SHA, PH_RET = _commit(PHD); RL_SHA, RL_RET = _commit(RLD)
PH_REPO = 'https://github.com/Philipp-DI/WuWaSim'
U_PH = f'{PH_REPO}/blob/{PH_SHA}/data/actionable-times.json'
U_PH_TM = f'{PH_REPO}/blob/{PH_SHA}/docs/TIMING_MODEL.md'
RL_REPO = 'https://github.com/Riley31415/wuwa_calc'
U_RL = RL_REPO + '/blob/' + RL_SHA + '/src/{}'
PH_ALL = json.load(open(os.path.join(PHD, 'actionable-times.json')))
PH = PH_ALL['actionableTimes']; PH_GEN = PH_ALL['_meta']['generatedAt']
PH_GAMEVER = json.load(open(os.path.join(PHD, 'wuwa-data.meta.json')))['gameVersion']
assert 'branch_3.6_final' in rd(os.path.join(PHD, 'HISTORY_excerpt_2026-09-15.md'))
PH_VER = (f'{PH_GAMEVER}（WuWaSim 客户端资源导出 BuildInfo branch_3.6_final / PatchVersion=3.6.0，见其 HISTORY 2026-09-15；'
          f'actionable-times.json 生成于 {PH_GEN}；仓库 commit {PH_SHA[:7]}，2026-10-08 03:43 SGT）')
RL_VER = f'未标注游戏版本；Riley31415/wuwa_calc commit {RL_SHA[:7]}（2026-10-03 17:38 SGT）'
TOL_S = 0.05  # 3 frames @60fps
xc3 = {'wuwasim_vs_wuwalab': {'match': 0, 'mismatch': 0}, 'riley_vs_wuwasim': {'match': 0, 'mismatch': 0},
       'riley_vs_wuwa-calc-data(echo)': {'match': 0, 'mismatch': 0}}

ww_res = WW['resonators']
def ww_key(r): return f"{r['name']}（{r['nameEn']}）"
def keys_for(name): return [k for k in characters if k.split('（')[0] == name]
def has_src(name, frag): return any(frag in rec['source'] for k in keys_for(name) for rec in characters[k].values())

# ---------- WuWaSim records for resonators without WuwaLAB data ----------
def ph_cat(k):
    if k == '__tunebreak__': return '谐振破坏'
    if 'dodge_counter' in k: return '闪避反击'
    return {'basic': '普攻', 'heavy': '重击', 'midair': '普攻', 'skill': '共鸣技能', 'liberation': '共鸣解放',
            'intro': '变奏入场', 'forte': '共鸣回路'}.get(k.split('_')[0], '其他')
def ph_rec(rid, k, v):
    rule = v['stepDurationRule']
    notes = [f'stepDuration 取自动画标记 {rule}' + {'nextAtt': '（TsAnimNotifyStateNextAtt 开启＝可预输入下一技能的时刻）',
             'skillEnd': '（TsAnimNotifyEndSkill）', 'idleReturn': '（FightStand 回待机）',
             'sequenceLength': '（蒙太奇全长，含回待机尾巴，源作者说明"不是时长"→ duration_s 记 null）'}[rule]]
    notes.append('源数据单位为秒（从游戏客户端动画 notify 时间提取），不是帧数，未做 60 帧换算')
    notes.append('口径：可接下一动作的时间，不等同 WuwaLAB total_frames；源无“最早取消帧”等价字段，cancel_s 记 null')
    if v.get('sourceSkillName'): notes.append(f"技能表名：{v['sourceSkillName']}")
    if v.get('freezeTime'): notes.append(f"freezeTime={v['freezeTime']}s（副本计时/冷却冻结）")
    if v.get('resolvesAt') and v.get('stepDuration') and v['resolvesAt'] > v['stepDuration']:
        notes.append(f"伤害在 {v['resolvesAt']}s 才全部结算，晚于 stepDuration")
    for f, t in [('needsStateModel', '源标注需状态模型'), ('isLoop', '循环动作'), ('isPhaseOnly', '仅为阶段片段'),
                 ('genderMirroredFrom', '性别镜像自 {}'), ('pinnedByOverride', '候选蒙太奇由人工指定')]:
        if v.get(f): notes.append(t.format(v[f]) if '{}' in t else t)
    if v.get('provenance') != 'extracted': notes.append(f"provenance={v.get('provenance')}")
    if v.get('variants'): notes.append(f"{len(v['variants'])} 个候选蒙太奇，取源选定项")
    return {'duration_s': None if rule == 'sequenceLength' else v['stepDuration'], 'cancel_s': None,
            'frames': None,
            'markers_s': {k2: v.get(k2) for k2 in ['stepDuration', 'nextAttAt', 'nextAttDuration', 'skillEndAt', 'idleReturnAt',
                                                   'sequenceLength', 'firstDamageAt', 'resolvesAt', 'freezeTime', 'freezeAnimationTime']},
            'step_duration_rule': rule, 'source_montage': v.get('sourceMontage'),
            'fps': None, 'fps_stated_by_source': False,
            'version': PH_VER, 'source': U_PH, 'source_page': U_PH_TM, 'retrieved_at': PH_RET,
            'cross_checked': False, 'notes': '；'.join(notes), '_ph': (rid, k)}

ph_added = {}
for r in ww_res:
    if has_src(r['name'], 'wuwalab.com'): continue
    rid = str(r['id'])
    if rid not in PH:
        alt = [str(x['id']) for x in ww_res if x['name'] == r['name'] and str(x['id']) in PH]
        if not alt: continue
        rid = alt[0]
    key = ww_key(r)
    if key in ph_added: continue
    recs = characters.setdefault(key, {})
    for k, v in PH[rid].items():
        ak = f"{ph_cat(k)}·{k}" + (f" {v['sourceSkillName']}" if v.get('sourceSkillName') else '') + ' [WuWaSim]'
        recs[ak] = ph_rec(rid, k, v)
        if rid != str(r['id']):
            recs[ak]['notes'] += f"；数据取自 {rid}（同名另一性别/版本 id），{r['id']} 未单独提取，是否完全一致未核实"
    ph_added[key] = rid
    stale.append({'character': key, 'source': U_PH, 'reason': f'WuWaSim 时间数据提取自 {PH_GAMEVER} 客户端，早于 {TARGET_VER}，3.7.x 改动未覆盖'})

# ---------- Riley31415/wuwa_calc ----------
RL_FILES = {'锁暝': 'suoming.ts', '漂泊者·湮灭': 'rover_havoc.ts', '布兰特': 'brant.ts', '嘉贝莉娜': 'galbrena.ts', '忌炎': 'jiyan.ts',
            '鉴心': 'jianxin.ts', '相里要': 'xiangli_yao.ts', '吟霖': 'yinlin.ts'}
RL_DIR = {'suoming.ts': 'electro', 'rover_havoc.ts': 'havoc', 'brant.ts': 'fusion', 'galbrena.ts': 'fusion', 'jiyan.ts': 'aero',
          'jianxin.ts': 'aero', 'xiangli_yao.ts': 'electro', 'yinlin.ts': 'electro'}
RL_CAT = {'Basic': '普攻', 'Heavy': '重击', 'Skill': '共鸣技能', 'Liberation': '共鸣解放', 'Intro': '变奏入场', 'Outro': '延奏',
          'DodgeCounter': '闪避反击', 'Echo': '声骸技能'}
RL_NOTE = ('源仓库 CLAUDE.md 写明 animFrames 为 60 帧/秒下的总帧数（对应 WuwaLAB total_frames），已按 60 换算；'
           '该仓库称帧数取自 WuwaLAB 或“用户粘贴的帧数表”，具体出处未注明，可信度低')
def rl_cat(x):
    if x['cast']: return RL_CAT.get(x['cast'], '其他')
    return RL_CAT.get(x['name'].split(' - ')[0].split()[-1], '其他')
rl_excluded = []
def rl_usable(x, who):
    if x['animFrames'] is None: return False
    if x['placeholder']: rl_excluded.append((who, x['name'], x['animFrames'], '源码标注 PLACEHOLDER FRAMES')); return False
    if x['animFrames'] == 60: rl_excluded.append((who, x['name'], 60, '恰为 60 帧：源仓库说明“未测量的动作用 60 作一秒占位”，疑似占位值')); return False
    return True
rl_parsed = {zhn: riley_parse(rd(os.path.join(RLD, 'resonators', f))) for zhn, f in RL_FILES.items()}

for r in ww_res:
    if keys_for(r['name']) or r['name'] not in RL_FILES: continue
    f = RL_FILES[r['name']]; recs = characters.setdefault(ww_key(r), {})
    for x in rl_parsed[r['name']]:
        if not rl_usable(x, r['name']): continue
        af = x['animFrames']
        recs[f"{rl_cat(x)}·{x['name']} [Riley31415/wuwa_calc]"] = {
            'duration_s': s2(af, 60) if af else None, 'cancel_s': None, 'frames': {'total': af},
            'fps': 60, 'fps_stated_by_source': True, 'version': RL_VER,
            'source': U_RL.format(f"resonators/{RL_DIR[f]}/{f}") + f"#L{x['line']}", 'source_page': RL_REPO, 'retrieved_at': RL_RET,
            'cross_checked': False,
            'notes': '；'.join([RL_NOTE] + (['animFrames=0（延奏不占动作时间），duration 记 null'] if af == 0 else []) + ['源无取消帧字段，cancel_s 记 null'])}
    stale.append({'character': ww_key(r), 'source': RL_REPO, 'reason': '版本未知（仓库未标注游戏版本），仅有单一来源'})

# Riley vs WuWaSim cross-check (only characters newly filled from WuWaSim)
def _ph_lookup(key, k): return next(((ak, rec) for ak, rec in characters[key].items() if rec.get('_ph', (None, None))[1] == k), (None, None))
for zhn, parsed in rl_parsed.items():
    keys = [k for k in ph_added if k.split('（')[0] == zhn]
    if not keys: continue
    key = keys[0]; rid = ph_added[key]
    usable = [x for x in parsed if x['animFrames'] is not None and not x['placeholder'] and x['animFrames'] != 60]
    pairs = []
    basics = [x for x in parsed if x['node'] == 'Normal' and x['cast'] == 'Basic' and re.match(r'^Basic - (.+) (\d)$', x['name'])]
    stems = {re.match(r'^Basic - (.+) (\d)$', x['name']).group(1) for x in basics}
    if len(stems) == 1:
        for x in basics:
            if x in usable: pairs.append((x, f"basic_{x['name'][-1]}"))
    for x in usable:
        if x['name'].startswith('Intro - ') and sum(1 for y in parsed if y['name'].startswith('Intro - ')) == 1: pairs.append((x, 'intro'))
        if x['cast'] == 'Liberation' and x['node'] == 'Liberation' and sum(1 for y in parsed if y['cast'] == 'Liberation' and y['node'] == 'Liberation') == 1:
            pairs.append((x, 'liberation'))
    for x, pk in pairs:
        if pk not in PH[rid]: continue
        ak, rec = _ph_lookup(key, pk)
        if rec is None or rec['duration_s'] is None: continue
        rv = round(x['animFrames'] / 60, 4); ok = abs(rv - rec['duration_s']) <= TOL_S
        xc3['riley_vs_wuwasim']['match' if ok else 'mismatch'] += 1
        if ok: rec['cross_checked'] = True
        rec['notes'] += f"；与 Riley31415/wuwa_calc「{x['name']}」{x['animFrames']}f={rv}s 核对：{'一致（±0.05s）' if ok else '不一致'}"
        if not ok:
            discrepancies.append({'character': key, 'action': ak, 'field': 'duration_s',
                                  'values': {'WuWaSim(3.6 提取, stepDuration)': rec['duration_s'], 'Riley31415/wuwa_calc(animFrames@60)': rv},
                                  'sources': [U_PH, U_RL.format(f"resonators/{RL_DIR[RL_FILES[zhn]]}/{RL_FILES[zhn]}") + f"#L{x['line']}"],
                                  'detail': '两者口径可能不同（可接下一动作 vs 总帧数），且 Riley 帧数出处不明；未覆盖任何值'})

# ---------- WuWaSim vs WuwaLAB cross-check (existing characters; basic chain + intro) ----------
name_to_rids = {}
for r in ww_res: name_to_rids.setdefault(r['name'], []).append(str(r['id']))
for slug, d in wl_raw.items():
    zhn = SLUG_ZH.get(slug) or zh.get(d['id']) or d['name']; ckey = f"{zhn}（{d['name']}）"
    rid = str(d['id']) if str(d['id']) in PH else next((x for x in name_to_rids.get(zhn, []) if x in PH), None)
    if rid is None: continue
    def wl_key(a):
        k = f"{cat(a)}·{a['name']}"
        return k if k in characters[ckey] and characters[ckey][k]['source'].endswith('/' + slug) and characters[ckey][k]['frames']['total'] == a['total_frames'] else (k + f" #{a['id']}")
    pairs = []
    bas = [(a, re.match(r'^Basic: (.+) (\d)$', a['name'])) for a in d['abilities'] if cat(a) == '普攻']
    bas = [(a, m) for a, m in bas if m]
    if len({m.group(1) for a, m in bas}) == 1 and len({m.group(2) for a, m in bas}) == len(bas):
        pairs += [(a, f"basic_{m.group(2)}") for a, m in bas]
    intros = [a for a in d['abilities'] if cat(a) == '变奏入场' and a['total_frames']]
    if len(intros) == 1: pairs.append((intros[0], 'intro'))
    for a, pk in pairs:
        v = PH[rid].get(pk)
        if not v or v['stepDurationRule'] == 'sequenceLength': continue
        k = wl_key(a); rec = characters[ckey].get(k)
        if rec is None: continue
        wv = rec['duration_s']; pv = v['stepDuration']; ok = abs(wv - pv) <= TOL_S
        xc3['wuwasim_vs_wuwalab']['match' if ok else 'mismatch'] += 1
        rec['notes'] += f"；与 WuWaSim({PH_GAMEVER} 提取) {pk} stepDuration={pv}s（{v['stepDurationRule']}）核对：{'一致（±0.05s）' if ok else '不一致'}"
        if ok: rec['cross_checked'] = True
        else:
            discrepancies.append({'character': ckey, 'action': k, 'field': 'duration_s',
                                  'values': {'wuwalab(total_frames/60)': wv, f'WuWaSim {pk} stepDuration': pv, 'WuWaSim rule': v['stepDurationRule'],
                                             'WuWaSim skillEndAt': v.get('skillEndAt')},
                                  'sources': [rec['source'], U_PH],
                                  'detail': f'差 {round(wv - pv, 4)}s；WuWaSim 为 {PH_GAMEVER} 客户端动画标记（可接下一动作），WuwaLAB 为实测总帧，口径与版本均可能不同；保留 WuwaLAB 原值未覆盖'})

# ---------- echoes: Riley ----------
rl_echo = {}
for f in sorted(glob.glob(os.path.join(RLD, 'echoes', '*.ts'))):
    for x in riley_parse(rd(f)):
        if x['cast'] == 'Echo' and x['animFrames'] is not None:
            rl_echo[x['name'].replace('Echo - ', '')] = (x, os.path.basename(f))
n8 = sum(1 for x, _ in rl_echo.values() if x['animFrames'] == 8); n60 = sum(1 for x, _ in rl_echo.values() if x['animFrames'] == 60)
for en, (x, f) in rl_echo.items():
    if x['animFrames'] in (8, 60) or x['placeholder']: continue
    if en not in ('Bell-Borne Geochelone',): continue  # only the requested priority echo; other non-template values are not requested
    echoes.setdefault(f"{ECHO_ZH.get(en, '?')}（{en}）", {})[f"Echo Skill [Riley31415/wuwa_calc]"] = {
        'duration_s': s2(x['animFrames'], 60), 'cancel_s': None, 'frames': {'total': x['animFrames']},
        'fps': 60, 'fps_stated_by_source': True, 'version': RL_VER,
        'source': U_RL.format(f'echoes/{f}') + f"#L{x['line']}", 'source_page': RL_REPO, 'retrieved_at': RL_RET, 'cross_checked': False,
        'notes': RL_NOTE + f'；该仓库 {len(rl_echo)} 个声骸动作中 {n8} 个为 8 帧、{n60} 个为 60 帧（明显是模板值），本条 16 帧不属于模板值但同样无出处，仅供参考'}
    stale.append({'character': f"声骸：{ECHO_ZH.get(en, '?')}（{en}）", 'source': RL_REPO, 'reason': '版本未知，单一来源'})
for en, (x, f) in rl_echo.items():
    calc = [(k2, r2) for ek, recs in echoes.items() if ek.endswith(f"（{en}）") for k2, r2 in recs.items() if '[wuwa-calc-data]' in k2]
    if not calc: continue
    if x['animFrames'] in (8, 60):
        discrepancies.append({'echo': en, 'field': 'duration_s（未计入核对）', 'values': {'wuwa-calc-data': {k2: r2['duration_s'] for k2, r2 in calc}, 'Riley31415/wuwa_calc': s2(x['animFrames'], 60)},
                              'sources': [calc[0][1]['source'], U_RL.format(f'echoes/{f}') + f"#L{x['line']}"],
                              'detail': f"Riley 值 {x['animFrames']}f 属该仓库模板值（{n8} 个 8f、{n60} 个 60f），不作为独立来源，不计入一致/不一致；保留 wuwa-calc-data 值"})
        continue
    if len(calc) == 1:
        k2, r2 = calc[0]; rv = s2(x['animFrames'], 60); ok = abs(rv - r2['duration_s']) <= TOL_S
        xc3['riley_vs_wuwa-calc-data(echo)']['match' if ok else 'mismatch'] += 1
        r2['notes'] += f"；与 Riley31415/wuwa_calc {x['animFrames']}f 核对：{'一致' if ok else '不一致（Riley 值疑似模板）'}"
        if not ok:
            discrepancies.append({'echo': en, 'action': k2, 'field': 'duration_s', 'values': {'wuwa-calc-data': r2['duration_s'], 'Riley31415/wuwa_calc': rv},
                                  'sources': [r2['source'], U_RL.format(f'echoes/{f}') + f"#L{x['line']}"], 'detail': '保留 wuwa-calc-data 值，Riley 值未采用'})
    else:
        discrepancies.append({'echo': en, 'field': '动作结构', 'values': {'wuwa-calc-data': {k2: r2['duration_s'] for k2, r2 in calc}, 'Riley31415/wuwa_calc': s2(x['animFrames'], 60)},
                              'sources': [calc[0][1]['source'], U_RL.format(f'echoes/{f}') + f"#L{x['line']}"],
                              'detail': 'wuwa-calc-data 分 3 段，Riley 只有 1 个 60 帧动作（模板值），无法逐段比对；未采用 Riley 值'})

for ch in characters.values():
    for r in ch.values(): r.pop('_ph', None)

# ---------- coverage & missing vs ww.json ----------
covered_ids = [r['id'] for r in ww_res if keys_for(r['name'])]
COVERAGE = f"{len(covered_ids)}/{len(ww_res)} ww.json ids"
for r in ww_res:
    if not keys_for(r['name']):
        missing.append({'character': ww_key(r), 'id': r['id'], 'detail': 'WuwaLAB、wuwa-calc-data、WuWaSim、Riley31415/wuwa_calc 均无数据'})
for zhn, nm, af, why in rl_excluded:
    if any(k.split('（')[0] == zhn for k in characters if any('[Riley31415/wuwa_calc]' in a for a in characters[k])):
        missing.append({'character': zhn, 'action': nm, 'detail': f'Riley31415/wuwa_calc 值 {af}f 未采用：{why}'})
if not any('（Suoming）' in k for k in characters): pass
missing += [
 {'echo': '无妄者（Dreamless）', 'detail': '未找到公开可采的帧数来源：WuwaLAB /echoes robots 禁止；wuwa-calc-data 无；Riley31415/wuwa_calc 未实现（源码 “TODO implement dreamless”）；WuWaSim 未提取任何声骸动画（其 HISTORY 2026-09-21 说明 Monster 资源从未导出）'},
 {'echo': '飞廉之猩 / 梦魇·飞廉之猩（Feilian Beringal）', 'detail': f'仅 Riley31415/wuwa_calc 有 8 帧，属模板值（该仓库 {n8} 个声骸都是 8 帧），未采用；其他来源同上均无'},
 {'echo': '哀声鸷 / 梦魇·哀声鸷（Mourning Aix）', 'detail': '仅 Riley31415/wuwa_calc 有 8 帧，属模板值，未采用；其他来源同上均无'},
 {'echo': '其余声骸', 'detail': f"ww.json 共 {len(WW['echoes'])} 条声骸，echoes 字段只覆盖 {len(echoes)} 个"},
 {'source': 'NGA 华胥研究院《角色动作数据汇总表》 https://bbs.nga.cn/read.php?tid=41749703', 'detail': 'HTTP 403 Access denied，已跳过（第二轮记录，第三轮未再请求）'},
 {'source': 'WuwaLAB /api/app/sim/catalog', 'detail': 'HTTP 401 需要登录，已跳过'},
 {'source': 'WuwaLAB /echoes、/abilities', 'detail': 'wuwalab.com robots.txt 禁止，未访问'},
 {'source': 'Discord / 浏览器 / YouTube 视频', 'detail': '按规则未使用 Discord 与浏览器；未下载视频、未自行数帧'},
 {'source': 'WuWaSim ECHO_CAST_TIME=1.20s', 'detail': '源码注释为“typical echo-skill animation length”，是全局默认值不是测量值，未采用'},
]

NOTES = [
 '忲弦：已确认是笔误，没有这个角色；已从 missing 中移除（2026-10-09 第三轮）。',
 '声骸技能动作时长已移到顶层 echoes 字段（原 characters["声骸（通用，wuwa-calc-data）"] 不再存在）。',
 f'WuWaSim（{PH_REPO}）记录：单位为秒，来自游戏 {PH_GAMEVER} 客户端动画 notify 的离线解析；duration_s=stepDuration（可接下一动作的时刻），与 WuwaLAB 的 total_frames 口径不同；其余标记见 markers_s。fps 字段为 null（非帧数据，未做 60 帧换算）。仓库无 LICENSE 文件。',
 'Riley31415/wuwa_calc 记录：源码说明 60fps；标 PLACEHOLDER FRAMES 的和恰为 60 帧（源仓库称作一秒占位）的值都未采用。仓库无 LICENSE 文件。',
 f'交叉核对容差 ±{TOL_S}s（60fps 下 3 帧）；不一致只写入 discrepancies，不覆盖已有值。',
 '第三轮检索：网页搜索 B站/NGA/英文 Google Sheets/YouTube 简介未找到卡卡罗、相里要、漂泊者·湮灭或声骸的公开帧数表；GitHub 公开仓库检索（未登录 API，间隔 7s）找到 WuWaSim 与 Riley31415/wuwa_calc，快照存于 raw/frames/philipp_wuwasim、raw/frames/riley_wuwa_calc，检索结果存于 raw/frames/gh/。',
 f'覆盖：{COVERAGE}（漂泊者四系各有男女两个 id，共用同一角色键）。',
]
SOURCES_R3 = [
 {'name': 'WuWaSim actionable-times.json（Philipp-DI/WuWaSim）', 'url': U_PH, 'retrieved_at': PH_RET, 'version': PH_VER,
  'notes': '公开 GitHub 仓库，git clone 无需登录。客户端动画标记离线解析，单位秒。用于补 WuwaLAB 缺失角色，并与 WuwaLAB 交叉核对普攻段与变奏入场。'},
 {'name': 'Riley31415/wuwa_calc', 'url': f'{RL_REPO}/tree/{RL_SHA}', 'retrieved_at': RL_RET, 'version': RL_VER,
  'notes': 'animFrames@60fps（源码注明）。只用于锁暝、鸣钟之龟及交叉核对；PLACEHOLDER 与 60 帧占位值不采用。'},
 {'name': 'ww.json（本地只读）', 'url': '/workspace/gamedata/pipeline/out/ww.json', 'retrieved_at': None, 'version': TARGET_VER, 'notes': '64 个共鸣者 id 名单与声骸中文名'},
]
xc.update(xc3)

_D = [d for d in discrepancies if 'wuwalab(total_frames/60)' in d.get('values', {})]
if _D:
    _df = sorted(d['values']['wuwalab(total_frames/60)'] - next(v for k, v in d['values'].items() if k.startswith('WuWaSim ') and 'stepDuration' in k) for d in _D)
    discrepancies.append({'field': 'WuWaSim vs WuwaLAB 系统性偏差', 'detail':
        f"{len(_D)} 条不一致中 WuwaLAB 比 WuWaSim 长的有 {sum(1 for x in _df if x > 0)} 条，差值中位数 {round(_df[len(_df)//2], 3)}s，范围 {round(_df[0], 3)}～{round(_df[-1], 3)}s。"
        "方向一致，符合口径差异（WuWaSim=可预输入下一技能的时刻；WuwaLAB=实测总帧），也可能叠加 3.6→3.7.x 的改动；因此 WuWaSim 补的 15 个角色的 duration_s 偏短，用于排轴时需注意。",
        'sources': [U_PH_TM, 'https://api.wuwalab.com/api/app/characters/<slug>']})
