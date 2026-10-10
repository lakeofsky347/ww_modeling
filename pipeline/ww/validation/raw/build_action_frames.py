#!/usr/bin/env python3
"""Rebuild action_frames.json from local snapshots only (no network).
Inputs: raw/frames/wuwalab/*.json (+ .retrieved), raw/frames/wuwalab_changelog.json,
        refs/wuwa-calc-data (read-only), raw/frames/wuwacalcsite_*.txt/ts (FPS + GAME_DEFAULTS evidence),
        /workspace/gamedata/cache/encore/3.7.8 character list (read-only, zh names),
        raw/frames/philipp_wuwasim/ (Philipp-DI/WuWaSim actionable-times.json, 3.6 client-extracted, seconds),
        raw/frames/riley_wuwa_calc/ (Riley31415/wuwa_calc .ts, animFrames @60fps),
        /workspace/gamedata/pipeline/out/ww.json (read-only; the 64-resonator roster + echo zh names).
Round 3 (2026-10-09): echoes moved to top-level `echoes`; 忲弦 removed from missing (confirmed typo)."""
import json, os, glob, re, datetime
V = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(V, 'raw', 'frames')
CALC = os.path.join(V, 'refs', 'wuwa-calc-data', 'data', 'mechanics')
ENC = '/workspace/gamedata/cache/encore/3.7.8/api-v2.encore.moe__api__zh-Hans__character'
TARGET_VER = '3.7.8'; RES_378_DATE = '2026-09-30'
rd = lambda p: open(p, encoding='utf-8').read()

# ---- evidence for fps / defaults (wuwa-calc-site) ----
frames_ts = rd(os.path.join(RAW, 'wuwacalcsite_Frames.ts'))
CALC_FPS = int(re.search(r'export const FPS = (\d+);', frames_ts).group(1))
gd = rd(os.path.join(RAW, 'wuwacalcsite_db_GAME_DEFAULTS.ts.txt'))
assert 'FRAMES @ 60fps' in gd
CALC_SWAP_DEFAULT = int(re.search(r'swapTime: (\d+)', gd).group(1))

# ---- zh names ----
zh = {c['Id']: c['Name'] for c in json.load(open(ENC))['roleList']}
SLUG_ZH = {'roverspectro': '漂泊者·衍射', 'roveraero': '漂泊者·气动', 'roverelectro': '漂泊者·导电', 'roverhavoc': '漂泊者·湮灭'}

# ---- WuwaLAB changelog: latest date mentioning each character ----
cl = json.load(open(os.path.join(RAW, 'wuwalab_changelog.json')))
cl_entries = [e for g in cl['groups'] for d in g['days'] for e in d['entries']]
def last_change(name):
    hits = [e['date'] for e in cl_entries if re.search(r'\b' + re.escape(name) + r'\b', e['title'] + ' ' + e['details'], re.I)]
    return max(hits) if hits else None
REMEASURE_ALL = '2026-09-15'  # "Cancel frames re-measured for 25 characters" (list not public in changelog)

def cat(a):
    g, lbl = a.get('genre'), a.get('group_label')
    if g == 'counter': return '闪避反击'
    if lbl == 'intro / outro':
        return {'intro': '变奏入场', 'outro': '延奏', 'echo': '声骸技能'}.get(g, '其他')
    return {'basic attack': '普攻', 'heavy attack': '重击', 'resonance skill': '共鸣技能', 'resonance liberation': '共鸣解放',
            'forte': '共鸣回路', 'tune break skill': '谐振破坏', 'dash': '冲刺'}.get(lbl, '其他')

U_WL = 'https://api.wuwalab.com/api/app/characters/{}'
U_WL_PAGE = 'https://wuwalab.com/characters/{}'
U_CALC = 'https://github.com/jjc-astra/wuwa-calc-data/blob/ac8ecba780f52b28d40035db7e2a1644a24292a5/data/mechanics/{}'
U_SITE_FPS = 'https://github.com/jjc-astra/wuwa-calc-site/blob/ec00eed424ce1bc14fe8ea939d2ba0de90f0deb7/site/src/utils/Frames.ts'

characters, echoes, stale, discrepancies, missing = {}, {}, [], [], []
s2 = lambda f, fps: None if f is None or fps is None else round(f / fps, 4)

# ---- WuwaLAB ----
roster = json.load(open(os.path.join(RAW, 'wuwalab_api_characters.json')))
cards = [c for g in roster['groups'] for c in g['cards']]
wl_raw = {}
for c in cards:
    p = os.path.join(RAW, 'wuwalab', c['slug'] + '.json')
    if not os.path.exists(p):
        continue
    d = json.load(open(p)); wl_raw[c['slug']] = d
    name = SLUG_ZH.get(c['slug']) or zh.get(d['id']) or d['name']
    key = f"{name}（{d['name']}）"
    lc = last_change(d['name'].split()[0]) if not c['slug'].startswith('rover') else last_change('Rover')
    ver = f"未标注游戏版本；WuwaLAB 数据，最近一次相关 changelog {lc or '无'}，全站帧数复测 {REMEASURE_ALL}"
    recs = {}
    for a in d['abilities']:
        tot, C, ns = a['total_frames'], a['earliest_frame_cancel'], a['no_swap']
        notes = []
        if tot == 0:
            dur = None; notes.append('源数据 total_frames=0（延奏/被动/附属判定，不占独立动作时间），duration 记 null')
        else:
            dur = tot
        if C and tot and C > tot:
            discrepancies.append({'character': f"{SLUG_ZH.get(c['slug']) or zh.get(d['id']) or d['name']}（{d['name']}）", 'action': a['name'], 'field': 'earliest_frame_cancel > total_frames',
                                  'values': {'wuwalab': {'total': tot, 'earliest_cancel': C}}, 'sources': [U_WL.format(c['slug'])], 'detail': '源数据内部矛盾，cancel_s 记 null'})
            notes.append(f'源数据 earliest_frame_cancel({C}) > total_frames({tot})，内部矛盾，记 null')
        if C and tot and 0 < C < tot: canc = C
        else:
            canc = None
            if tot and C == tot: notes.append('earliest_frame_cancel = total_frames，无更早取消点')
            elif tot and C == 0: notes.append('源数据 earliest_frame_cancel=0（站点时间轴不显示取消点；含义不明，记 null）')
        if ns: notes.append(f'no_swap={ns}f：该帧前禁止切人')
        if a.get('time_stop'): notes.append(f"time_stop {a['time_stop_start']}–{a['time_stop']}f")
        if a.get('motion_stop'): notes.append(f"motion_stop {a['motion_stop_start']}–{a['motion_stop']}f")
        notes.append('fps 源站未明示，按 60 换算（见 discrepancies: wuwalab_fps）')
        k = f"{cat(a)}·{a['name']}"
        if k in recs: k += f" #{a['id']}"
        recs[k] = {'duration_s': s2(dur, 60), 'cancel_s': s2(canc, 60),
                   'frames': {'total': tot, 'earliest_cancel': C, 'no_swap': ns, 'chain': a.get('chain_frames'),
                              'go_down': a.get('go_down_frames'), 'qte_tag': a.get('qte_tag_frame'),
                              'time_stop': [a['time_stop_start'], a['time_stop']], 'motion_stop': [a['motion_stop_start'], a['motion_stop']]},
                   'fps': 60, 'fps_stated_by_source': False,
                   'version': ver, 'source': U_WL.format(c['slug']), 'source_page': U_WL_PAGE.format(c['slug']),
                   'retrieved_at': rd(p.replace('.json', '.retrieved')).strip(),
                   'cross_checked': False, 'notes': '；'.join(notes), '_wl_id': a['id']}
    characters[key] = recs
    stale.append({'character': key, 'source': U_WL.format(c['slug']),
                  'reason': (f'WuwaLAB 未标注测量版本；最近相关改动 {lc}，不早于 {TARGET_VER} 资源发布日 {RES_378_DATE}，但该改动只涉及部分机制，帧数本身仍无法确认按 3.7.8 复测'
                             if (lc or '') >= RES_378_DATE else
                             f'WuwaLAB 未标注测量版本；最近相关改动 {lc or "无记录"}，早于 {TARGET_VER} 资源发布日 {RES_378_DATE}，不能确认已按 3.7.8 复测')})

wl_404 = {c['slug']: c for c in cards if not os.path.exists(os.path.join(RAW, 'wuwalab', c['slug'] + '.json'))}

# ---- ww.json roster / echo names (read-only) ----
WW = json.load(open('/workspace/gamedata/pipeline/out/ww.json'))
ECHO_ZH = {}
for e in WW['echoes']:
    ECHO_ZH.setdefault(e['nameEn'], e['name'])

# ---- wuwa-calc-data (60fps stated in wuwa-calc-site) ----
def resolve_swap(v):
    if v is None: return None, None
    if v == '@Default.SwapTime': return CALC_SWAP_DEFAULT, f'swapTiming=@Default.SwapTime → {CALC_SWAP_DEFAULT}f（wuwa-calc-site GAME_DEFAULTS）'
    if isinstance(v, (int, float)): return v, None
    return None, f'swapTiming 为表达式 {v!r}，未解析'
CALC_CAT = {'Basic Attack': '普攻', 'Resonance Skill': '共鸣技能', 'Resonance Liberation': '共鸣解放', 'Forte Circuit': '共鸣回路',
            'Intro': '变奏入场', 'Outro': '延奏', 'Echo Skill': '声骸技能'}
CALC_NAME = {'Sanhua': '散华（Sanhua）', 'Mornye': '莫宁（Mornye）', 'Lumi': '灯灯（Lumi）'}
calc_recs = {}
for f in sorted(glob.glob(os.path.join(CALC, 'characters', '*.json'))) + sorted(glob.glob(os.path.join(CALC, 'echoes', '*.json'))) + [os.path.join(CALC, 'system', 'system.json')]:
    rel = os.path.relpath(f, CALC); d = json.load(open(f))
    for k, v in d.items():
        if not isinstance(v, dict) or 'actionDuration' not in v: continue
        who = k.split('_')[0]
        if 'echoes' in rel: charkey = None
        elif who == 'System': charkey = '通用动作（System）'
        else: charkey = CALC_NAME.get(who, who)
        dur = v['actionDuration'] if isinstance(v['actionDuration'], (int, float)) else None
        sw, swnote = resolve_swap(v.get('swapTiming'))
        notes = []
        if swnote: notes.append(swnote)
        if v.get('swapTiming') is None: notes.append('无 swapTiming（该动作内不可切人或未给出）')
        if v.get('freezeTime'): notes.append(f"freezeTime={v['freezeTime']}f")
        if dur == 0: notes.append('actionDuration=0（延奏不占动作时间）'); 
        c = v.get('category') or ('声骸技能' if 'echoes' in rel else '通用')
        name = v.get('name') or k
        akey = (f"{CALC_CAT.get(c, c)}·{name}" if 'echoes' not in rel else f"声骸技能·{who}: {name}") + ' [wuwa-calc-data]'
        rec = {'duration_s': s2(dur if dur else None, CALC_FPS), 'cancel_s': s2(sw, CALC_FPS) if sw else None,
               'frames': {'total': v['actionDuration'], 'swap': v.get('swapTiming'), 'swap_resolved': sw,
                          'freeze': v.get('freezeTime'), 'motion_stop': v.get('motionStop')},
               'fps': CALC_FPS, 'fps_stated_by_source': True,
               'version': '未标注游戏版本；wuwa-calc-data commit ac8ecba (2026-10-09 12:49 SGT, 浅克隆无历史)',
               'source': U_CALC.format(rel), 'cross_checked': False,
               'notes': '；'.join(notes + ['cancel_s 口径为最早切人帧(swapTiming)，与 WuwaLAB 的 earliest_frame_cancel 口径不同'])}
        if charkey is None:
            ezh = ECHO_ZH.get(who.replace('NM ', 'Nightmare: '), '?')
            ekey = f"{ezh}（{who.replace('NM ', 'Nightmare: ')}）"
            echoes.setdefault(ekey, {})[f"{name} [wuwa-calc-data]"] = rec
            calc_recs[(who, name)] = (ekey, name, rec)
        else:
            characters.setdefault(charkey, {})[akey] = rec
            calc_recs[(who, name)] = (charkey, akey, rec)
stale.append({'character': '散华/莫宁/灯灯/通用动作 + echoes 中的 4 个声骸（wuwa-calc-data）', 'source': 'https://github.com/jjc-astra/wuwa-calc-data',
              'reason': '未标注测量版本；本地为浅克隆，无法确认数据录入日期是否晚于 3.7.8'})

# ---- cross-check WuwaLAB vs wuwa-calc-data (total frames; intro: no_swap vs swapTiming) ----
PAIRS = {
 ('Mornye', 'Ground State Calibration 1'): ('mornye', 'Basic: Ground State Calibration 1'),
 ('Mornye', 'Ground State Calibration 2'): ('mornye', 'Basic: Ground State Calibration 2'),
 ('Mornye', 'Ground State Calibration 3'): ('mornye', 'Basic: Ground State Calibration 3'),
 ('Mornye', 'Ground State Calibration 4'): ('mornye', 'Basic: Ground State Calibration 4'),
 ('Mornye', 'Ground State Calibration: Heavy Attack'): ('mornye', 'Heavy: Ground State Calibration'),
 ('Mornye', 'Ground State Calibration: Mid-air Attack'): ('mornye', 'Basic: Ground State Calibration (Mid-air)'),
 ('Mornye', 'Wide Field Observation 1'): ('mornye', 'Basic: Wide Field Observation Mode 1'),
 ('Mornye', 'Wide Field Observation 2'): ('mornye', 'Basic: Wide Field Observation Mode 2'),
 ('Mornye', 'Wide Field Observation 3'): ('mornye', 'Basic: Wide Field Observation Mode 3'),
 ('Mornye', 'Expectation Error'): ('mornye', 'Skill: Expectation Error'),
 ('Mornye', 'Optimal Solution'): ('mornye', 'Skill: Optimal Solution (Parry)'),
 ('Mornye', 'Distributed Array'): ('mornye', 'Skill: Distributed Array'),
 ('Mornye', 'Geopotential Shift'): ('mornye', 'Forte: Geopotential Shift'),
 ('Mornye', 'Inversion'): ('mornye', 'Forte: Inversion'),
 ('Mornye', 'Critical Protocol'): ('mornye', 'Liberation: Critical Protocol'),
 ('Mornye', 'Intro: Convergence'): ('mornye', 'Intro: Convergence'),
 ('Sanhua', 'Basic Attack 1'): ('sanhua', 'Basic: Frigid Light 1'),
 ('Sanhua', 'Basic Attack 2'): ('sanhua', 'Basic: Frigid Light 2'),
 ('Sanhua', 'Basic Attack 3'): ('sanhua', 'Basic: Frigid Light 3'),
 ('Sanhua', 'Basic Attack 4'): ('sanhua', 'Basic: Frigid Light 4'),
 ('Sanhua', 'Basic Attack 5'): ('sanhua', 'Basic: Frigid Light 5'),
 ('Sanhua', 'Heavy Attack'): ('sanhua', 'Heavy: Frigid Light'),
 ('Sanhua', 'Mid-air Attack'): ('sanhua', 'Basic: Frigid Light (Mid-Air)'),
 ('Sanhua', 'Resonance Skill'): ('sanhua', 'Skill: Eternal Frost'),
 ('Sanhua', 'Glacial Gaze'): ('sanhua', 'Liberation: Glacial Gaze'),
 ('Sanhua', 'Intro Skill'): ('sanhua', 'Intro: Freezing Thorns'),
}
xc = {'match': 0, 'mismatch': 0}
for (who, cname), (slug, wname) in PAIRS.items():
    ck, ak, crec = calc_recs[(who, cname)]
    wa = next(a for a in wl_raw[slug]['abilities'] if a['name'] == wname)
    wkey_char = next(k for k in characters if k.endswith(f"（{wl_raw[slug]['name']}）") and k in characters and any(r.get('_wl_id') == wa['id'] for r in characters[k].values()))
    wkey, wrec = next((k, r) for k, r in characters[wkey_char].items() if r.get('_wl_id') == wa['id'])
    ok = crec['frames']['total'] == wa['total_frames']
    if 'Intro' in cname:
        ok = ok and crec['frames']['swap_resolved'] == wa['no_swap']
    for r in (crec, wrec):
        r['cross_checked'] = ok
        r['notes'] += f"；与{'wuwa-calc-data' if r is wrec else 'WuwaLAB'}核对：{'一致' if ok else '不一致'}"
    xc['match' if ok else 'mismatch'] += 1
    if not ok:
        discrepancies.append({'character': wkey_char, 'action': wkey, 'field': 'total_frames' + ('/swap' if 'Intro' in cname else ''),
                              'values': {'wuwalab': {'total': wa['total_frames'], 'no_swap': wa['no_swap'], 'earliest_cancel': wa['earliest_frame_cancel']},
                                         'wuwa-calc-data': {'actionDuration': crec['frames']['total'], 'swap': crec['frames']['swap_resolved']}},
                              'sources': [wrec['source'], crec['source']]})
for r in (r for ch in characters.values() for r in ch.values()): r.pop('_wl_id', None)

discrepancies.insert(0, {'field': 'wuwalab_fps', 'detail':
    'WuwaLAB 页面、API 与 changelog 均未写明帧率，duration_s/cancel_s 按 60fps 换算。依据：莫宁 16 个动作的帧数与 wuwa-calc-data（其站点代码明确 FPS=60）逐项相同；但两站可能同源，不算独立证明。WuwaLAB changelog 还出现过小数帧（折枝 Skill 3 “67.50、79.02”），说明其测量精度可能高于整帧。',
    'sources': [U_SITE_FPS, 'https://api.wuwalab.com/api/app/changelog']})
discrepancies.append({'field': 'cancel 口径', 'detail': 'WuwaLAB cancel_s=earliest_frame_cancel（最早可被其他动作取消）；wuwa-calc-data cancel_s=swapTiming（最早切人，默认 9f）。两者不可直接比较，只比较了总时长和入场切人帧。'})

exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'build_action_frames_round3.py'), encoding='utf-8').read())

out = {
 'generated_at': datetime.datetime.now().astimezone().isoformat(timespec='seconds'),
 'target_version': TARGET_VER,
 'sources': [
  {'name': 'WuwaLAB 角色帧数 API', 'url': 'https://api.wuwalab.com/api/app/characters/<slug>', 'retrieved_at': rd(os.path.join(RAW, 'wuwalab_api_characters.retrieved')).strip(),
   'version': '未标注；最近改动 2026-10-02（changelog V7）', 'notes': f'wuwalab.com 角色页背后的公开 JSON（无需登录）。字段 total_frames / earliest_frame_cancel / no_swap 等。{len(wl_raw)} 个角色 200，未实装角色 404。api 子域 robots.txt 不存在(404)；主站 robots 禁止 /echoes /abilities 等，均未访问。'},
  {'name': 'WuwaLAB changelog API', 'url': 'https://api.wuwalab.com/api/app/changelog', 'retrieved_at': rd(os.path.join(RAW, 'wuwalab_changelog.retrieved')).strip(), 'version': 'V1–V7 (2026-08-03 ~ 2026-10-02)', 'notes': '用于判断各角色数据最近改动日期'},
  {'name': 'wuwa-calc-data（本地只读）', 'url': 'https://github.com/jjc-astra/wuwa-calc-data', 'retrieved_at': None, 'version': 'commit ac8ecba, 2026-10-09 12:49 SGT', 'notes': '本机 refs/wuwa-calc-data；只有 散华/莫宁/灯灯 + 5 个声骸 + 闪避/跳跃/谐振破坏 的 actionDuration（帧）'},
  {'name': 'wuwa-calc-site 源码（帧率与默认值依据）', 'url': U_SITE_FPS, 'retrieved_at': rd(os.path.join(RAW, 'wuwacalcsite.retrieved')).strip(), 'version': 'commit ec00eed', 'notes': f'Frames.ts: FPS = {CALC_FPS}；db.ts GAME_DEFAULTS: swapTime {CALC_SWAP_DEFAULT}f, comboWindow 30f (“FRAMES @ 60fps”)'},
  {'name': 'wuwa-tools（本地只读）', 'url': 'https://github.com/ahmdilhaam/wuwa-tools', 'retrieved_at': None, 'version': 'commit 73e1961', 'notes': '无帧数数据'},
  *SOURCES_R3,
  {'name': 'encore.moe 本地缓存（只读）', 'url': ENC, 'retrieved_at': None, 'version': '3.7.8', 'notes': '仅用于角色中文名映射'},
 ],
 'characters': characters,
 'echoes': echoes,
 'notes': NOTES,
 'missing': missing, 'stale': stale, 'discrepancies': discrepancies,
 'cross_check_summary': xc,
}
dst = os.path.join(V, 'action_frames.json')
json.dump(out, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('echoes', len(echoes), sum(len(v) for v in echoes.values()), 'covered', COVERAGE)
print('chars', len(characters), 'records', sum(len(v) for v in characters.values()), 'xc', xc, 'disc', len(discrepancies), 'missing', len(missing), 'stale', len(stale))
