#!/usr/bin/env python3
"""Build substat_tiers.json from locally saved raw pages (no network). Parses each source independently and cross-checks."""
import json, re, html, datetime, os
R = os.path.dirname(os.path.abspath(__file__))
rd = lambda f: open(os.path.join(R, f), encoding='utf-8').read()
ts = lambda f: rd(f).strip()

KEYS = ['暴击','暴击伤害','攻击%','固定攻击','生命%','固定生命','防御%','固定防御','共鸣效率','普攻伤害加成','重击伤害加成','共鸣技能伤害加成','共鸣解放伤害加成']
UNIT = {k: ('flat' if k.startswith('固定') else '%') for k in KEYS}
num = lambda s: float(s.replace('%','').replace(',',''))

# ---- 1. Official KR disclosure PDF ----
KR = {'크리티컬':'暴击','크리티컬 피해':'暴击伤害','공격력 보너스':'攻击%','고정 공격력':'固定攻击','HP 보너스':'生命%','고정 HP':'固定生命',
      '방어력 보너스':'防御%','고정 방어력':'固定防御','공명 효율':'共鸣效率','일반 공격 피해 보너스':'普攻伤害加成','강공격 피해 보너스':'重击伤害加成',
      '공명 스킬 피해 보너스':'共鸣技能伤害加成','공명 해방 피해 보너스':'共鸣解放伤害加成'}
t = rd('kuro_ko.txt'); sec = t[t.index('（5）'):]
blocks = re.split(r'「', sec)[1:]
official = {}
for b in blocks:
    name = b[:b.index('」')]
    rows = re.findall(r'^\s*(\d+(?:\.\d+)?%?)\s+(\d+\.\d{4})%\s*$', b, re.M)
    official[KR[name]] = {'tiers':[num(a) for a,_ in rows], 'probs_raw':[p+'%' for _,p in rows], 'probs':[float(p) for _,p in rows]}
type_prob = re.findall(r'^\s*(\S.*?)\s+(7\.6923)%', t[t.index('（2）'):t.index('（3）')], re.M)
assert len(type_prob)==13, type_prob

# ---- 2. Fandom Echo/Stats wikitext ----
FD = {'[[Crit. Rate]]':'暴击','[[Crit. DMG]]':'暴击伤害','[[ATK]]%':'攻击%','[[ATK]]':'固定攻击','[[HP]]%':'生命%','[[HP]]':'固定生命','[[DEF]]%':'防御%','[[DEF]]':'固定防御',
      '[[Energy Regen]]':'共鸣效率','[[Basic Attack]] DMG Bonus':'普攻伤害加成','[[Heavy Attack]] DMG Bonus':'重击伤害加成','[[Resonance Skill]] DMG Bonus':'共鸣技能伤害加成','[[Resonance Liberation]] DMG Bonus':'共鸣解放伤害加成'}
fj = json.loads(rd('fandom_echo_stats.json')); wt = fj['parse']['wikitext']; fandom_rev = fj['parse']['revid']
dist = wt[wt.index('==Detailed substat values distribution=='):wt.index('==Possible minimum')]
fandom = {}
for tbl in re.findall(r'\{\|.*?\|\}', dist, re.S):
    if 'Value1' not in tbl: continue
    rows = [r.strip() for r in tbl[:-2].split('|-')[1:]]
    statrows, chance = [], None
    for r in rows:
        cells = [c.strip() for c in re.split(r'\n\||\|\||\n!|!!', '\n'+r) if c.strip()]
        if cells[0].startswith("'''Chance"): chance = cells[1:]
        else: statrows.append(cells)
    for c in statrows:
        fandom[FD[c[0]]] = {'tiers_raw':c[1:], 'tiers':[num(x.replace('%%','%')) for x in c[1:]],
                            'probs_raw':chance, 'probs':[num(x) for x in chance]}

# ---- 3. wuwa.uk article ----
def txt(f):
    s = rd(f); s = re.sub(r'<script.*?</script>|<style.*?</style>','',s,flags=re.S)
    s = re.sub(r'</t[dh]>',' | ',s); s = re.sub(r'</tr>','\n',s); s = re.sub(r'<[^>]+>','',s); return html.unescape(s)
WU = {'Crit Rate':'暴击','Crit DMG':'暴击伤害','ATK%':'攻击%','ATK (flat)':'固定攻击','HP%':'生命%','HP (flat)':'固定生命','DEF%':'防御%','DEF (flat)':'固定防御',
      'Energy Regen':'共鸣效率','Basic ATK DMG':'普攻伤害加成','Heavy ATK DMG':'重击伤害加成','Skill DMG':'共鸣技能伤害加成','Liberation DMG':'共鸣解放伤害加成'}
w = txt('wuwauk_substat_math.html'); w = w[w.index('Complete substat roll value table'):w.index('Effective stat weight per role')]
wuwauk = {}
for line in w.splitlines():
    cells = [c.strip() for c in line.split('|') if c.strip()]
    if cells and cells[0] in WU:
        vals = [c for c in cells[1:] if c not in ('—',) and not c.endswith('×')]
        wuwauk[WU[cells[0]]] = [num(v) for v in vals]

# ---- 4. Prydwen ranges ----
PR = {'CRIT Rate':'暴击','CRIT DMG':'暴击伤害','ATK%':'攻击%','ATK':'固定攻击','HP%':'生命%','HP':'固定生命','DEF%':'防御%','DEF':'固定防御','Energy Regen':'共鸣效率',
      'Basic Attack DMG Bonus':'普攻伤害加成','Heavy Attack DMG Bonus':'重击伤害加成','Resonance Skill DMG Bonus':'共鸣技能伤害加成','Resonance Liberation DMG Bonus':'共鸣解放伤害加成'}
p = txt('prydwen_echo_stats.html'); p = p[p.index('Sub-stats ranges'):]; p = p[:p.index('Resonance Liberation DMG Bonus |')+60]
prydwen = {}
for line in p.splitlines():
    cells = [c.strip() for c in line.split('|') if c.strip()]
    if len(cells)==2 and cells[0] in PR:
        a,b = cells[1].split(' - '); prydwen[PR[cells[0]]] = [num(a), num(b)]

# ---- 5. Local reference repo wuwa-tools (community, 4 buckets of 2 values) ----
wt_src = open('/workspace/gamedata/pipeline/ww/validation/refs/wuwa-tools/src/lib/data/substats.ts', encoding='utf-8').read()
WT = {'Crit Rate':['暴击'],'Crit DMG':['暴击伤害'],'DMG Bonus (semua tipe)':['普攻伤害加成','重击伤害加成','共鸣技能伤害加成','共鸣解放伤害加成'],
      'Energy Regen':['共鸣效率'],'DEF%':['防御%'],'Flat ATK':['固定攻击'],'Flat HP':['固定生命'],'Flat DEF':['固定防御']}
wuwatools = {}
for m in re.finditer(r"\{ stat: (?:'([^']+)'|\{ id: '([^']+)'[^}]*\}), low: '([^']+)', midLow: '([^']+)', midHigh: '([^']+)', high: '([^']+)' \}", wt_src):
    name = m.group(1) or m.group(2); vals = []
    for cell in m.groups()[2:]:
        cell = re.sub(r'\s*\(.*\)','',cell)
        vals += [num(x) for x in cell.replace('%','').split('–')]
    for k in WT[name]: wuwatools[k] = vals

for d,n in [(official,'official'),(fandom,'fandom'),(wuwauk,'wuwa.uk'),(prydwen,'prydwen')]:
    assert set(d)==set(KEYS), (n, set(KEYS)-set(d))

U_OFF='https://sdk-prod-cdn-aws.kurogame-service.com/pro/agreement/common/language_ko/product_info.pdf'
U_OFF_PAGE='https://wutheringwaves.kurogames.com/p/language_ko/product_info.html'
U_FD='https://wutheringwaves.fandom.com/wiki/Echo/Stats'
U_FD_API='https://wutheringwaves.fandom.com/api.php?action=parse&page=Echo/Stats&prop=wikitext|revid&format=json&formatversion=2'
U_WU='https://wuwa.uk/articles/echo-substat-math'
U_PR='https://www.prydwen.gg/wuthering-waves/guides/echo-stats'
U_WT='https://github.com/ahmdilhaam/wuwa-tools/blob/73e1961dd25b9cfc222c26076f768755ec3ca45f/src/lib/data/substats.ts'

substats, discrepancies = {}, []
for k in KEYS:
    o, f, w_, pr = official[k], fandom[k], wuwauk[k], prydwen[k]
    tiers_ok = o['tiers']==f['tiers']==w_
    range_ok = [o['tiers'][0], o['tiers'][-1]]==pr
    probs_ok = o['probs']==f['probs']
    srcs = [U_OFF, U_FD, U_WU, U_PR]
    notes = []
    if k in wuwatools:
        srcs.append(U_WT)
        if sorted(set(wuwatools[k]))==o['tiers']: notes.append('wuwa-tools 本地参考库（4 档区间写法）数值一致。')
        else: discrepancies.append({'substat':k,'field':'tiers','values':{'official_kr':o['tiers'],'wuwa-tools':wuwatools[k]}})
    if not tiers_ok:
        discrepancies.append({'substat':k,'field':'tiers','values':{'official_kr':o['tiers'],'fandom':f['tiers'],'wuwa.uk':w_}})
    if not range_ok:
        discrepancies.append({'substat':k,'field':'range','values':{'official_kr':[o['tiers'][0],o['tiers'][-1]],'prydwen':pr}})
    if not probs_ok:
        discrepancies.append({'substat':k,'field':'probabilities','values':{'official_kr':o['probs'],'fandom':f['probs']}})
    if k=='共鸣效率': notes.append("Fandom 原表第 3 档写作 '8.4%%'（多一个 %），按 8.4 处理，与官方一致。")
    if k=='暴击': notes.append("Fandom 原表第 8 档写作 '10.5'（缺 %），按 10.5% 处理，与官方一致。")
    if k=='暴击伤害': notes.append("Prydwen 上限写作 '21%'，官方为 '21.0%'，数值相同。")
    s = sum(o['probs'])
    notes.append(f'档位概率为“出现该副词条类型后”各数值的条件概率；官方四舍五入到小数点后 4 位，合计 {s:.4f}%。')
    substats[k] = {
        'tiers': [int(x) for x in o['tiers']] if UNIT[k]=='flat' else o['tiers'], 'unit': UNIT[k],
        'probabilities': o['probs'], 'probabilities_raw': o['probs_raw'], 'probability_unit': '%',
        'probability_source': {'type':'官方公示','url':U_OFF,'sample_size':None,
            'notes':'库洛按韩国法规公示的《상품 정보 제공》第 2 节(5)；Fandom Echo/Stats 转载数值一致。非抽样统计，无样本量。'},
        'type_probability': {'value':7.6923,'unit':'%','formula':'P = 100% / (13 - 已激活或已锁定的副词条数) × 该数值的档位概率','source':U_OFF},
        'sources': srcs,
        'cross_checked': bool(tiers_ok and range_ok and probs_ok),
        'notes': ' '.join(notes),
    }

discrepancies += [
  {'substat':'固定攻击','field':'probabilities',
   'values':{'official_kr':[6.7961,52.4272,37.8641,2.9126],'wuwa-tools(社区统计: Chasey 数据集 ~5300 样本, 2026-06-26)':[19,42,31,8]},
   'resolution':'采用官方公示值；社区样本分布与官方差异明显，原因未知（样本口径/时间不同）。', 'sources':[U_OFF, U_WT]},
  {'substat':'全部','field':'probabilities',
   'values':{'official_kr':'各档非均匀（见 probabilities）','wuwa.uk':'文章假设各档等概率（8 档各 12.5%）'},
   'resolution':'wuwa.uk 的等概率是作者假设，与官方公示矛盾，不采用。', 'sources':[U_OFF, U_WU]},
  {'substat':'全部','field':'mechanics_text',
   'values':{'wuwa.uk':'称已有副词条会在里程碑时随机强化（Genshin 式）','official_kr/fandom':'副词条在调谐时一次性随机，之后不变'},
   'resolution':'仅为机制描述错误，不影响档位数值；wuwa.uk 只用于数值交叉核对。', 'sources':[U_WU, U_FD]},
  {'substat':'全部','field':'probabilities_text',
   'values':{'fandom':"Substats 小节写 'The weight of sub stats drop rate are currently unknown'，但下方小节已引用官方公示"},
   'resolution':'Fandom 页面内部陈旧表述，以官方公示为准。', 'sources':[U_FD]},
  {'substat':'全部','field':'version',
   'values':{'official_kr_pdf':'无游戏版本号；PDF 创建 2026-07-02 (+08)，HTTP Last-Modified 2026-07-13 06:45 UTC','fandom':f'revid {fandom_rev}, 页面最后编辑 2026-07-07 17:57 UTC','wuwa.uk':'Updated 2026-07-23','client datamine':'ResVer 3.7.8, 2026-09-30'},
   'resolution':'所有公开来源均未标注 3.7.8；均早于 3.7.8 资源发布日期。客户端数据不含档位表，无法直接对 3.7.8 做版本验证，默认副词条档位未变更（自 1.x 以来各站数值一致）。','sources':[U_OFF,U_FD,U_WU]},
]

missing = [
  {'item':'encore.moe 缓存中的副词条档位/概率','detail':'缓存 /workspace/gamedata/cache/encore/3.7.8/ 中 phantom 接口存的是 SPA HTML 空壳；echo 详情只有 MainProp.RandGroupId（主词条随机组），没有副词条档位或概率。注意：缓存实际位置是 /workspace/gamedata/cache/encore/3.7.8/，不是任务里写的 /workspace/gamedata/pipeline/ww/cache/encore/3.7.8/（该路径不存在）。'},
  {'item':'客户端数据中的副词条档位表','detail':'ww-WutheringWaves_Data(ResVer 3.7.8) BinData/phantom/phantomsubproperty.json 只有 PropId/AddType/SubStandardProperty（基准值，非档位），phantomsubpropaction.json 为 base64 BinData；档位与权重应在服务端，客户端无法验证。'},
  {'item':'社区统计样本量（除固定攻击外）','detail':'Fandom 引用的社区表格（~9000 次副词条记录）与官方分布“相关”，但未给出逐档统计；该 Google 表格未抓取（需登录/非静态页面风险，且官方值已足够）。'},
]

def src(name,url,f,notes): return {'name':name,'url':url,'retrieved_at':ts(f) if f else None,'notes':notes}
out = {
 'version':'3.7.8',
 'generated_at': datetime.datetime.now().astimezone().isoformat(timespec='seconds'),
 'sources':[
  src('库洛官方 韩国版商品信息/概率公示（주파수 조정기 및 튜너 확률 공시）',U_OFF,'kuro_ko_pdf.retrieved',f'入口页 {U_OFF_PAGE} 302 到 sdk-global SPA，SPA 加载此 PDF。10 页，Last-Modified 2026-07-13 06:45 UTC，ETag 783113e5a2c48c9af82721730cd1f33e。含 13 种副词条全部档位及各档概率。官方公示。'),
  src('Wuthering Waves Fandom Wiki: Echo/Stats',U_FD,'fandom_echo_stats.retrieved',f'经 MediaWiki API 获取 wikitext（{U_FD_API}），revid {fandom_rev}。含全部档位与概率（转载官方韩国公示）。robots.txt 返回 Cloudflare 403 挑战页，无法读取，已记录；API 本身 200 正常返回，仅请求 2 次（search + parse）。'),
  src('wuwa.uk: Echo Substat Range & Roll Values',U_WU,'wuwauk.retrieved','社区站，完整 8/4 档数值表；概率部分为作者等概率假设（不采用）。robots 允许。'),
  src('Prydwen: Echo Stats',U_PR,'prydwen.retrieved','社区站，只有每种副词条的最小-最大区间，用于核对首末档。robots 允许（Crawl-delay 10，仅请求 1 次）。'),
  src('wuwa-tools 本地参考库 substats.ts',U_WT,None,'本机 /workspace/gamedata/pipeline/ww/validation/refs/wuwa-tools（commit 73e1961, 2026-10-06）。8 种副词条的 4 组区间写法，固定攻击带社区概率（Chasey 数据集 ~5300 样本）。未覆盖 攻击%/生命% 的独立行（并入 DMG Bonus 行未标注）。'),
  src('Game8: All Echo Stats and Substats','https://game8.co/games/Wuthering-Waves/archives/456278','game8.retrieved','只列副词条名称，无数值，未用于核对。'),
  src('encore.moe API 本地缓存','/workspace/gamedata/cache/encore/3.7.8/',None,'只读检查，无副词条数据。'),
 ],
 'substats': substats,
 'discrepancies': discrepancies,
 'missing': missing,
}
json.dump(out, open('/workspace/gamedata/pipeline/ww/validation/substat_tiers.json','w',encoding='utf-8'), ensure_ascii=False, indent=2)
for k in KEYS:
    s=substats[k]; print(k, len(s['tiers']), s['tiers'][0], s['tiers'][-1], s['cross_checked'], round(sum(s['probabilities']),4))
print('discrepancies', len(discrepancies))
