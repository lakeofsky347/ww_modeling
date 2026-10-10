#!/usr/bin/env python3
"""Headless verification of dist/ww/index.html (served under the sub-path /sub/sim/).
Checks: no console errors, loader fades, every preset total == engine/cli.js for the same config (and for the
page's exported JSON), manual edit / invalid explanation / drag reorder / search + apply candidate, tier edit,
no-module picker → search disabled, localStorage persistence, mobile width, fetch failures (404 / bad JSON / version).
Screenshots: pipeline/out/screens/ww-*.png. Prints a JSON report."""
import json, os, subprocess, sys, time, socket, tempfile
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRV = '/tmp/srvww'; PORT = 8766
OUT = os.path.join(HERE, 'out', 'screens')
os.makedirs(os.path.join(SRV, 'sub'), exist_ok=True)
link = os.path.join(SRV, 'sub', 'sim')
if not os.path.islink(link):
    os.symlink(os.path.join(ROOT, 'dist'), link)
URL = f'http://127.0.0.1:{PORT}/sub/sim/ww/'
CLI = os.path.join(HERE, 'ww', 'engine', 'cli.js')
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '-d', SRV, '-b', '127.0.0.1'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(50):
    try: socket.create_connection(('127.0.0.1', PORT), 0.2).close(); break
    except OSError: time.sleep(0.1)
R = {'errors': [], 'checks': {}}


def ok(name, cond, info=None):
    R['checks'][name] = {'ok': bool(cond), **({'info': info} if info is not None else {})}


def cli_total(cfg):
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f:
        json.dump(cfg, f, ensure_ascii=False)
    out = f.name + '.out.json'
    subprocess.check_call(['node', CLI, f.name, '--json', out], stdout=subprocess.DEVNULL)
    r = json.load(open(out))[0]
    os.unlink(f.name); os.unlink(out)
    return round(r['total']), r['sequence']


WAIT_JOB = """(n) => { var u = window.__WW_UI__, l = window.__WW_LAST__; return !!(u && l && !u.S.running && !u.S.pending && l.jobId >= n); }"""


def settle(p, after=None):
    n = p.evaluate('() => (window.__WW_UI__ ? window.__WW_UI__.S.jobId : 0)') if after is None else after
    p.wait_for_function(WAIT_JOB, arg=n, timeout=120000)
    p.wait_for_timeout(50)
    return p.evaluate('() => window.__WW_LAST__')


def act(p, fn):
    """run fn (UI interaction) and wait for the job it starts"""
    n = p.evaluate('() => window.__WW_UI__.S.jobId')
    fn()
    p.wait_for_function('(n) => window.__WW_UI__.S.jobId > n', arg=n, timeout=10000)
    return settle(p)


def hero(p):
    return p.evaluate("() => { var v = document.querySelector('#ww-summary .ww-card.hero .v'); return v ? +v.textContent.replace(/,/g, '') : null; }")


def page(browser, errs, w=1600, h=1000, **kw):
    ctx = browser.new_context(viewport={'width': w, 'height': h}, **kw)
    p = ctx.new_page()
    p.on('console', lambda m: errs.append(f'console.{m.type}: {m.text}') if m.type == 'error' else None)
    p.on('pageerror', lambda e: errs.append(f'pageerror: {e}'))
    return ctx, p


with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--enable-unsafe-swiftshader'])
    errs = []
    ctx, p = page(b, errs)
    t0 = time.time()
    p.goto(URL)
    p.wait_for_function("() => window.__WW_LAST__ && window.__WW_LAST__.total", timeout=120000)
    last = settle(p)
    R['first_result_s'] = round(time.time() - t0, 2)
    p.wait_for_timeout(900)
    ok('loader faded', p.evaluate("() => !document.getElementById('loader') || getComputedStyle(document.getElementById('loader')).opacity === '0'"))
    ok('worker used', p.evaluate('() => !!(window.__WW_UI__.S.worker && window.__WW_UI__.S.workerReady)'))
    presets = p.evaluate('() => window.__WW_UI__.presets')
    # ---- every preset: page total == CLI total
    rows = []
    for i, pr in enumerate(presets):
        if i:
            last = act(p, lambda: p.select_option('#ww-preset', str(i)))
        exp, seq = cli_total(pr['config'])
        rows.append({'preset': pr['name'], 'page': round(last['total']), 'hero': hero(p), 'cli': exp, 'ms': last['ms'],
                     'seqEqual': last['sequence'] == seq, 'tailFreezePct': p.evaluate("() => (window.__WW_LAST__.tailFreeze || {}).pct || 0")})
        if i == 0:
            p.screenshot(path=os.path.join(OUT, 'ww-desktop.png'), full_page=True)
    R['presets'] = rows
    ok('presets == CLI', all(r['page'] == r['cli'] == r['hero'] and r['seqEqual'] for r in rows))
    # expected preset totals (engine ww-engine-0.2, data 3.7.8, runtime frames); a change here must be explained
    # 2026-10-09 16:3x (stream A): heal/shield triggers (星序协响 / 隐世回光 now fire), residual guidance default for teams (search only),
    # team presets 40 s (卡提希娅 stays 25 s), action_frames round 3. Old → new: 351587→327390 (residual: −7.1%), 529354→702683 (25→40 s),
    # 368865→696660 (25→40 s), 399462 unchanged, 460196→505515 (30→40 s), 414298→444369 (30→40 s). See MECHANICS.md §10.
    # 2026-10-09 16:5x (stream A): page runtime frames now keep time_stop (KEEP_FR) → page applies timeStop='exclude' like the CLI (was silently 'include'):
    # 327390→511109, 702683→483567, 696660→453831, 399462→542382, 505515→700115, 444369→546007 (all == CLI; timeStopSaved shown in summary).
    # 2026-10-09 16:58 SGT (stream A, B12a hold + B12b support cycle in search): 511109→524056, 483567→504211; others unchanged.
    # 2026-10-09 17:2x SGT (stream A, lead benchmark → WuWaSim toa): timeStop='exclude' now only excludes energy-consuming liberation (R, cost>0)
    # cutscenes (or frame entries flagged tsVerified; none shipped). Kept at full duration now: 今汐 惊龙破空 / 守岸人 洞悉 / 珂莱塔 zhisi / 卡提希娅 看潮 /
    # 爱弥斯 gyM / 奥古斯塔 赫日威临 / 清宵 天钧荡煞. Old → new (timeStopScope:'all' reproduces old): 524056→516794, 504211→458629, 453831 unchanged,
    # 542382→460077, 700115→500029, 546007→496412 (奥古斯塔 567878→420089, 清宵 650776→621789 — not in EXPECT).
    # 2026-10-09 18:xx SGT (stream A follow-ups, not in EXPECT; page == CLI): 奥古斯塔 赫日威临 tsVerified（游戏文本「时间暂时停止」）420089→567878；
    # 安可 hold 黑咩（狂热内失序满 100）455218→438692；绯雪 霜冻 修正（穗穗 上限 +3 不叠加、雪锈 额外段平 102%）872640→634519。EXPECT presets unchanged.
    EXPECT = {'今汐/折枝/守岸人 · 满协奏开局（默认）': 516794, '珂莱塔/折枝/守岸人 · 自动搜索': 458629, '菲比/守岸人 · 自动搜索（光噪由队友维持）': 453831,
              '卡提希娅/守岸人 · 自动搜索（风蚀效应）': 460077, '今汐/心/守岸人 · 同奏 自动搜索': 500029, '爱弥斯/长离/守岸人 · 聚爆 自动搜索': 496412}
    ok('preset totals as expected', all(next((r['cli'] for r in rows if r['preset'] == k), None) == v for k, v in EXPECT.items()),
       {k: next((r['cli'] for r in rows if r['preset'] == k), None) for k in EXPECT})
    ok('new module presets present', len(rows) >= 12 and all(k in [r['preset'] for r in rows] for k in EXPECT), [r['preset'] for r in rows])
    DEF = rows[0]['cli']
    pidx = {r['preset']: i for i, r in enumerate(rows)}

    # ---- batch 5: anomaly lanes / status rows / stamina / off-field / on-field
    def batch5(name, shot):
        act(p, lambda: p.select_option('#ww-preset', str(pidx[name])))
        p.wait_for_timeout(100)
        r = p.evaluate("""() => ({
          statusLanes: document.querySelectorAll('#ww-timeline .ww-lane.status').length,
          statusSegs: document.querySelectorAll('#ww-timeline .ww-lane.status .ww-status[data-stk]').length,
          ticks: document.querySelectorAll('#ww-timeline .ww-lane.status .ww-tick:not(.burst)').length,
          bursts: document.querySelectorAll('#ww-timeline .ww-lane.status .ww-tick.burst').length,
          statusRows: document.querySelectorAll('#ww-breakdown tr.status .ww-tag.status').length,
          stamina: document.querySelectorAll('#ww-team .ww-slot .ww-stamina').length,
          slots: document.querySelectorAll('#ww-team .ww-slot:not(.empty)').length,
          staminaLane: !!document.querySelector('#ww-timeline .ww-lane.res.stamina svg path'),
          onfield: document.querySelectorAll('#ww-timeline .ww-lane .track > .onfield > i').length,
          offfield: document.querySelectorAll('#ww-timeline .ww-act.offfield').length,
          shareStatus: document.querySelectorAll('#ww-share .ww-tag.status').length })""")
        p.locator('#ww-timeline').screenshot(path=os.path.join(OUT, shot))
        return r
    b5 = {}
    b5['cartethyia'] = batch5('卡提希娅/守岸人 · 自动搜索（风蚀效应）', 'ww-status-cartethyia.png')
    c = b5['cartethyia']
    ok('anomaly lane + ticks (卡提希娅 风蚀)', c['statusLanes'] >= 1 and c['statusSegs'] > 0 and c['ticks'] > 0 and c['statusRows'] > 0 and c['shareStatus'] > 0, c)
    ok('stamina bar per card + lane', c['stamina'] == c['slots'] and c['staminaLane'], c)
    # 0.3: 卡提希娅 preset now stays on field after the opening swap (R/芙露德莉斯 window) → on-field segments checked on the 3-member 心 preset below
    p.locator('#ww-breakdown').screenshot(path=os.path.join(OUT, 'ww-status-breakdown.png'))
    b5['aemeath'] = batch5('爱弥斯/长离/守岸人 · 聚爆 自动搜索', 'ww-status-aemeath.png')
    ok('burst detonation markers (爱弥斯 聚爆)', b5['aemeath']['bursts'] > 0, b5['aemeath'])
    b5['hsin'] = batch5('今汐/心/守岸人 · 同奏 自动搜索', 'ww-onfield-hsin.png')
    ok('on-field segments', b5['hsin']['onfield'] >= 2, b5['hsin'])
    # 0.3: the searched 心 team no longer spends 心's field time on 转相 → off-field 飞阙 checked on a manual sequence (心 转相 → 今汐 attacks)
    def offseq():
        p.evaluate("() => { var S = window.__WW_UI__.S; S.config.rotation = { mode: 'manual', start: 2, sequence: 'S2 A H A H A H A H A H A H R S1 A A A A E A A' }; window.__WW_UI__.run(); }")
    act(p, offseq)
    off = p.evaluate("() => ({ offfield: document.querySelectorAll('#ww-timeline .ww-act.offfield').length, invalid: document.querySelectorAll('#ww-seq .ww-step.invalid').length })")
    b5['hsinManual'] = off
    ok('off-field coordinated attacks', off['offfield'] > 0 and off['invalid'] == 0, off)

    # ---- residual guidance (search heuristic, teams default) + steady-state start (COMPONENTS.md: .ww-tag.mode / i.residual / .ww-carry)
    act(p, lambda: p.select_option('#ww-preset', str(pidx['今汐/心/守岸人 · 同奏 自动搜索'])))
    rm = p.evaluate("""() => ({ tag: !!document.querySelector('#ww-summary .ww-tag.mode.residual'), title: (document.querySelector('#ww-summary .ww-tag.mode') || {}).title || '',
      residual: document.querySelectorAll('#ww-timeline .ww-buffbar i.residual').length, carry: document.querySelectorAll('#ww-timeline .ww-carry').length,
      total: window.__WW_LAST__.total })""")
    R['residualMode'] = rm
    ok('residual mode tag + i.residual segments (team preset)', rm['tag'] and '残值' in rm['title'] and rm['residual'] > 0 and rm['carry'] == 0, rm)
    p.screenshot(path=os.path.join(OUT, 'ww-mode-residual.png'), full_page=False)
    def steady():
        p.evaluate("() => { var S = window.__WW_UI__.S; S.config.start = Object.assign({}, S.config.start, { steady: true }); window.__WW_UI__.run(); }")
    act(p, steady)
    sm = p.evaluate("""() => ({ tag: !!document.querySelector('#ww-summary .ww-tag.mode.steady'), title: (document.querySelector('#ww-summary .ww-tag.mode') || {}).title || '',
      carry: document.querySelectorAll('#ww-timeline .ww-lane:not(.status):not(.res) .track > i.ww-carry').length,
      lanes: document.querySelectorAll('#ww-timeline .ww-lane:not(.status):not(.res)').length, carryTitle: (document.querySelector('#ww-timeline .ww-carry') || {}).title || '' })""")
    R['steadyMode'] = sm
    ok('steady mode tag + .ww-carry per lane', sm['tag'] and '稳态' in sm['title'] and sm['carry'] == sm['lanes'] and sm['lanes'] >= 3 and '承接上一轮' in sm['carryTitle'], sm)
    p.locator('#ww-timeline').screenshot(path=os.path.join(OUT, 'ww-mode-steady.png'))
    p.locator('#ww-timeline').screenshot(path=os.path.join(OUT, 'ww-offfield-hsin.png'))
    # manual heavy spam on the preset's starting member (守岸人, 重击 25 耐力) → rejected for stamina
    act(p, lambda: p.select_option('#ww-preset', str(pidx['卡提希娅/守岸人 · 自动搜索（风蚀效应）'])))
    def spam():
        p.evaluate("() => { var S = window.__WW_UI__.S; S.config.rotation = { mode: 'manual', start: S.config.rotation.start || 0, sequence: Array(16).fill('H').join(' ') }; window.__WW_UI__.run(); }")
    act(p, spam)
    ns = p.evaluate("() => ({ acts: document.querySelectorAll('#ww-timeline .ww-act.no-stamina').length, steps: document.querySelectorAll('#ww-seq .ww-step.no-stamina').length, low: !!document.querySelector('#ww-team .ww-stamina.low') })")
    b5['noStamina'] = ns
    ok('no-stamina rejections shown', ns['acts'] > 0 and ns['steps'] > 0 and ns['low'], ns)
    p.locator('#ww-timeline').screenshot(path=os.path.join(OUT, 'ww-no-stamina.png'))
    R['batch5'] = b5
    # ---- 0.3: 卡提希娅 R / 芙露德莉斯 used by the search; settings toggles (电磁减半续时 / 窗口末尾按比例)
    act(p, lambda: p.select_option('#ww-preset', str(pidx['卡提希娅/守岸人 · 自动搜索（风蚀效应）'])))
    ck = p.evaluate("() => { var k = []; (((window.__WW_UI__.S.view || {}).timeline || {}).lanes || []).forEach(function (l) { (l.actions || []).forEach(function (a) { k.push(a.key); }); }); return { R: k.filter(function (x) { return x === 'R'; }).length, kanchao: k.filter(function (x) { return x === 'kanchao'; }).length, form: k.filter(function (x) { return /^f[A-Z]/.test(x || ''); }).length, total: window.__WW_LAST__.total }; }")
    ok('卡提希娅 search casts R → 芙露德莉斯 → 看潮', ck['R'] >= 1 and ck['kanchao'] >= 1 and ck['form'] >= 4, ck)
    pr = hero(p)
    tr = p.evaluate("() => { var a = document.querySelector('#ww-timeline .ww-act[data-truncated]'); var l0 = document.querySelector('#ww-timeline .ww-lane'); var we = l0 ? l0.querySelectorAll('.ww-window-end') : []; return { act: !!a, credit: a ? +a.getAttribute('data-credit') : null, title: a ? /计入/.test(a.getAttribute('title') || '') : false, row: document.querySelectorAll('#ww-breakdown tr[data-truncated]').length, windowEnd: document.querySelectorAll('#ww-timeline .ww-window-end').length, firstLane: we.length, left: we.length ? we[0].style.left : null }; }")
    ok('truncated action + breakdown row (prorate default)', tr['act'] and 0 < tr['credit'] < 1 and tr['title'] and tr['row'] > 0, tr)
    ok('window-end marker in first lane', tr['windowEnd'] == 1 and tr['firstLane'] == 1 and tr['left'] == '100%', tr)
    p.locator('#ww-timeline').screenshot(path=os.path.join(OUT, 'ww-window-end.png'))
    act(p, lambda: p.click('#ww-endcredit button[data-v=full]'))
    full = hero(p)
    ok('endCredit full option raises total', full > pr and p.evaluate("() => window.__WW_UI__.S.config.endCredit === 'full'"), [pr, full])
    act(p, lambda: p.click('#ww-endcredit button[data-v=prorate]'))
    act(p, lambda: p.click('#ww-electro button[data-v=on]'))
    eo = p.evaluate("() => ({ cfg: window.__WW_UI__.S.config.electroRefreshOnHalve === true, mech: !!document.querySelector('#ww-settings .ww-mech.unsolved'), total: window.__WW_LAST__.total })")
    ok('electroRefreshOnHalve toggle', eo['cfg'] and eo['mech'] and hero(p) == pr, eo)
    act(p, lambda: p.click('#ww-electro button[data-v=off]'))
    p.locator('#ww-settings').screenshot(path=os.path.join(OUT, 'ww-settings-anomaly.png'))
    R['v03'] = {'cartethyia': ck, 'full': full, 'prorate': pr, 'truncated': tr}
    # back to default
    act(p, lambda: p.select_option('#ww-preset', '0'))
    ok('default == preset 0', hero(p) == DEF, [hero(p), DEF])
    # ---- chains above chainModeled (field result.members[i].chainModeled; COMPONENTS: i.on.unmodeled + .ww-tag.chain-cap)
    sk = p.evaluate("() => window.__WW_UI__.S.config.team.findIndex(function (m) { return m && m.id === 1505; })")
    p.click(f'.ww-slot[data-slot="{sk}"]'); p.wait_for_timeout(100)
    base1 = act(p, lambda: p.select_option(f'select[data-path="team.{sk}.chain"]', '1'))['total']
    r6 = act(p, lambda: p.select_option(f'select[data-path="team.{sk}.chain"]', '6'))
    ch = p.evaluate(f"""() => {{ var s = document.querySelector('.ww-slot[data-slot="{sk}"]'), t = s && s.querySelector('.ww-tag.chain-cap'), u = document.querySelector('#ww-member .ww-tag.chain-cap, #ww-config .ww-tag.chain-cap, .ww-field .ww-tag.chain-cap');
        var L = window.__WW_LAST__, m = L.members ? L.members[{sk}] : null;
        return {{ on: s.querySelectorAll('.ww-chain i.on').length, unm: s.querySelectorAll('.ww-chain i.on.unmodeled').length, tag: t ? t.textContent : null, title: t ? t.title : null,
          field: u ? u.textContent : null, chainModeled: m ? m.chainModeled : null, chainCfg: m ? m.chainCfg : null,
          warn: (L.warnings || []).filter(function (w) {{ return w.code === 'chain-unmodeled'; }}).map(function (w) {{ return w.text; }}) }}; }}""")
    ok('chain-unmodeled: 守岸人 6 链 → 按 1 链', ch['on'] == 6 and ch['unm'] == 5 and ch['tag'] == '按 1 链' and ch['title'] == '共鸣链未建模，按 1 链计算' and ch['field'] == '按 1 链'
       and ch['chainModeled'] == 1 and ch['chainCfg'] == 6 and len(ch['warn']) == 1 and '共鸣链未建模，按 1 链计算' in ch['warn'][0] and r6['total'] == base1, dict(ch, t1=base1, t6=r6['total']))
    p.locator(f'.ww-slot[data-slot="{sk}"]').screenshot(path=os.path.join(OUT, 'ww-chain-cap.png'))
    act(p, lambda: p.select_option(f'select[data-path="team.{sk}.chain"]', '0'))
    ok('chain reset == default', hero(p) == DEF, [hero(p), DEF])
    # ---- time stop (cfg.timeStop; result.timeStopSaved): summary tag, .timestop-seg toggle, .ww-freeze markers — 清宵 preset
    act(p, lambda: p.select_option('#ww-preset', str(pidx['清宵/琳奈/守岸人 · 自动搜索（时停）'])))
    def tsinfo():
        return p.evaluate("""() => { var t = document.querySelector('#ww-summary .ww-tag.timestop'), g = document.querySelector('#ww-settings .ww-seg.timestop-seg');
            return { tag: t ? t.textContent : null, zero: t ? t.classList.contains('zero') : null, seg: g ? Array.prototype.map.call(g.querySelectorAll('button'), function (b) { return b.textContent + (b.classList.contains('on') ? '*' : ''); }) : [],
              freeze: document.querySelectorAll('#ww-timeline .ww-freeze').length, fw: Array.prototype.map.call(document.querySelectorAll('#ww-timeline .ww-freeze'), function (x) { return x.style.width || ''; }),
              ftitle: (document.querySelector('#ww-timeline .ww-freeze') || {}).title || null, ftitles: Array.prototype.map.call(document.querySelectorAll('#ww-timeline .ww-freeze'), function (x) { return x.title || ''; }), saved: window.__WW_LAST__.timeStopSaved, total: window.__WW_LAST__.total }; }""")
    tx = tsinfo()
    p.locator('#ww-summary').screenshot(path=os.path.join(OUT, 'ww-timestop-tag.png'))
    act(p, lambda: p.click('#ww-timestop button[data-v=include]'))
    ti = tsinfo()
    ok('timeStop tag (exclude)', tx['saved'] > 0 and not tx['zero'] and tx['tag'] == '时停 +%.2f 秒' % tx['saved'] and tx['seg'] == ['时停不计时*', '按完整动画'] and tx['freeze'] > 0
       # 17:20 toa semantics: only energy-consuming liberations are excluded (zero-width marker, 不计战斗时间); non-liberation stops (清宵 天钧荡煞) keep width + 按完整动画计时
       and all((w == '' and '不计战斗时间' in t) or (w != '' and '按完整动画计时' in t) for w, t in zip(tx['fw'], tx['ftitles']))
       and any(w == '' for w in tx['fw']), tx)
    ok('timeStop toggle → include flips total', ti['saved'] == 0 and ti['zero'] and ti['seg'] == ['时停不计时', '按完整动画*'] and ti['total'] != tx['total']
       and p.evaluate("() => window.__WW_UI__.S.config.timeStop === 'include'") and round(ti['total']) == cli_total(p.evaluate('() => window.__WW_UI__.S.config'))[0], ti)
    act(p, lambda: p.click('#ww-timestop button[data-v=exclude]'))
    ok('timeStop back to exclude', p.evaluate("() => window.__WW_UI__.S.config.timeStop === undefined") and round(p.evaluate('() => window.__WW_LAST__.total')) == round(tx['total']))
    R['timeStop'] = {'exclude': {k: tx[k] for k in ('tag', 'saved', 'total', 'freeze')}, 'include': {k: ti[k] for k in ('tag', 'saved', 'total', 'freeze')}}
    # ---- tail-freeze (summary.tailFreeze / warning ts-window-edge): no shipped preset ends mid time-stop ult (all 0 %, 18:0x SGT audit);
    # 奥古斯塔 preset forced to 11 s → 赫日威临 starts in the last ~0.7 s → .ww-tag.tail-freeze + data-tail-freeze on that action
    ok('presets: no tail-freeze bonus', all(r['tailFreezePct'] == 0 for r in rows), {r['preset']: r['tailFreezePct'] for r in rows if r['tailFreezePct']})
    act(p, lambda: p.select_option('#ww-preset', str(pidx['奥古斯塔/守岸人 · 自动搜索'])))
    act(p, lambda: p.evaluate("() => { var S = window.__WW_UI__.S; S.config.duration = 11; window.__WW_UI__.run(); }"))
    tf = p.evaluate("""() => { var t = document.querySelector('#ww-summary .ww-tag.tail-freeze'), L = window.__WW_LAST__;
        return { tag: t ? t.textContent : null, title: t ? t.title : null, marked: Array.prototype.map.call(document.querySelectorAll('#ww-timeline .ww-act[data-tail-freeze]'), function (x) { return x.textContent; }),
          pct: (L.tailFreeze || {}).pct, warn: (L.warnings || []).filter(function (w) { return w.code === 'ts-window-edge'; }).length, total: L.total }; }""")
    ok('tail-freeze tag (奥古斯塔 @11 s)', tf['pct'] and tf['pct'] > 3 and tf['tag'] == '尾段时停 %.1f%%' % tf['pct'] and '窗口最后' in (tf['title'] or '') and len(tf['marked']) == 1
       and '赫日威临' in tf['marked'][0] and tf['warn'] == 1 and round(tf['total']) == cli_total(p.evaluate('() => window.__WW_UI__.S.config'))[0], tf)
    p.locator('#ww-summary').screenshot(path=os.path.join(OUT, 'ww-tail-freeze-tag.png'))
    R['tailFreeze'] = tf
    act(p, lambda: p.select_option('#ww-preset', '0'))
    ok('timeline est/data-dur', p.evaluate("""() => { var a = document.querySelectorAll('#ww-timeline .ww-act'); var n = 0, bad = 0;
        a.forEach(function (x) { var d = x.getAttribute('data-dur'); if (d) n++; if (d === 'config' && x.classList.contains('est')) bad++; if ((d === 'frames' || d === 'default') && !x.classList.contains('est')) bad++; }); return n > 0 && bad === 0; }"""))
    ok('resource svg', p.evaluate("""() => !!document.querySelector('#ww-timeline .ww-lane.res svg[viewBox="0 0 100 10"][preserveAspectRatio=none] path.area')"""))
    ok('mech legend + badges', p.evaluate("() => document.querySelectorAll('#ww-breakdown .ww-mech-legend span').length === 4 && document.querySelectorAll('#ww-breakdown .z[data-mech=corroborated]').length > 0"))
    ok('search candidates', p.evaluate("() => document.querySelectorAll('#ww-search .ww-cand').length"), p.evaluate("() => document.querySelectorAll('#ww-search .ww-cand').length"))
    # ---- export → CLI
    p.click('#ww-export')
    exported = json.loads(p.input_value('#ww-exp-text'))
    p.click('.ww-modal [data-close]')
    ok('export == CLI', cli_total(exported)[0] == DEF, cli_total(exported)[0])
    # ---- apply 2nd candidate
    c2 = p.evaluate("() => { var c = document.querySelectorAll('#ww-search .ww-cand')[1]; return c ? +c.querySelector('.num.total').textContent.replace(/,/g,'') : null; }")
    act(p, lambda: p.click('#ww-search .ww-cand:nth-of-type(3)'))  # .hd is first child
    ok('apply candidate', hero(p) == c2 and p.evaluate("() => window.__WW_UI__.S.config.rotation.mode === 'manual' && !!document.querySelector('#ww-search .ww-cand.cur')"), [hero(p), c2])
    p.screenshot(path=os.path.join(OUT, 'ww-candidate.png'), full_page=True)
    # ---- manual edit: delete, add via palette, drag reorder, invalid explanation
    seq0 = p.evaluate('() => window.__WW_UI__.S.config.rotation.sequence')
    n0 = len(seq0.split())
    act(p, lambda: p.click('#ww-seq-list .ww-step:last-child .del'))
    ok('delete step', len(p.evaluate('() => window.__WW_UI__.S.config.rotation.sequence').split()) == n0 - 1)
    act(p, lambda: p.click('#ww-seq .ww-palette button[data-add="0:R"]'))
    act(p, lambda: p.click('#ww-seq .ww-palette button[data-add="0:R"]'))
    inv = p.evaluate("() => ({ steps: document.querySelectorAll('#ww-seq .ww-step.invalid').length, err: (document.querySelector('#ww-seq .ww-err') || {}).textContent || '' })")
    ok('invalid explained', inv['steps'] >= 1 and '非法' in inv['err'], inv)
    p.screenshot(path=os.path.join(OUT, 'ww-manual-invalid.png'), full_page=False, clip=None)
    p.locator('#ww-seq').screenshot(path=os.path.join(OUT, 'ww-seq-editor.png'))
    before = p.evaluate('() => window.__WW_UI__.S.config.rotation.sequence')
    act(p, lambda: p.drag_and_drop('#ww-seq-list .ww-step:last-child', '#ww-seq-list .ww-step:nth-child(3)'))
    after = p.evaluate('() => window.__WW_UI__.S.config.rotation.sequence')
    bt, at = before.split(), after.split()
    ok('drag reorder', sorted(bt) == sorted(at) and bt != at and at[2] == bt[-1], [before, after])
    # ---- run search again
    act(p, lambda: p.click('#ww-do-search'))
    ok('search again == default', hero(p) == DEF, hero(p))
    # ---- tier edit changes total; persisted
    act(p, lambda: p.click('#ww-build .ww-subs .ww-sub-row:first-child .ww-tiers button:last-child'))
    t_tier = hero(p)
    ok('tier edit changes total', t_tier != DEF, t_tier)
    p.reload()
    p.wait_for_function("() => window.__WW_LAST__ && window.__WW_LAST__.total", timeout=120000)
    settle(p)
    ok('localStorage persists', hero(p) == t_tier, [hero(p), t_tier])
    # ---- picker: no-module character → manual only / search disabled
    p.click('#ww-team .ww-slot.sel')
    npick = p.evaluate("() => document.querySelectorAll('.ww-pick .it').length")
    ok('picker lists 64', npick == 64, npick)  # coverage: every resonator in the picker; modules 64/64 as of 17:2x
    p.fill('#ww-pick-q', '炽霞')
    p.wait_for_timeout(100)
    p.screenshot(path=os.path.join(OUT, 'ww-picker.png'))
    act(p, lambda: p.click('.ww-pick .it:not([hidden])'))
    # 17:2x: all 64 resonators now have modules (炽霞 1202 included) → exercise the same no-module path via 角色模块 = 停用（仅手动）
    _sel = p.evaluate('() => window.__WW_UI__.S.sel')
    if p.evaluate("() => !document.querySelector('#ww-team .ww-slot.no-module')"):
        act(p, lambda: p.select_option(f'select[data-path="team.{_sel}.module"]', 'off'))
    st = p.evaluate("() => ({ noModule: !!document.querySelector('#ww-team .ww-slot.no-module'), note: (document.querySelector('#ww-search .ww-disabled-note') || {}).textContent || '', disabled: !!document.querySelector('#ww-search .ww-disabled'), total: window.__WW_LAST__.total, err: window.__WW_LAST__.error })")
    ok('no-module → search disabled', st['noModule'] and st['disabled'] and st['note'], st)
    p.screenshot(path=os.path.join(OUT, 'ww-no-module.png'), full_page=True)
    ctx.close()
    # ---- mobile
    ctx, p = page(b, errs, 390, 844, device_scale_factor=2, is_mobile=True, has_touch=True)
    p.goto(URL)
    p.wait_for_function("() => window.__WW_LAST__ && window.__WW_LAST__.total", timeout=120000)
    settle(p); p.wait_for_timeout(800)
    ov = p.evaluate('() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })')
    ok('mobile no horizontal overflow', ov['sw'] <= ov['cw'] + 1, ov)
    ok('mobile default total', hero(p) == DEF, hero(p))
    p.screenshot(path=os.path.join(OUT, 'ww-mobile.png'), full_page=True)
    ctx.close()
    # ---- avatars (.gava, frontend assets/theme/avatar.js): slot cards (.ww-slot .ava > .gava) + timeline lanes (.who > .gava); with images
    # blocked (route abort assets/avatars/*) every .gava falls back to the badge (.gava-err + .gava-t glyph), totals unchanged
    GAVA = """() => { var q = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
        var slot = q('#ww-team .ww-slot .ava > .gava'), lane = q('#ww-timeline .ww-lane .who > .gava'), all = q('.gava');
        return { slot: slot.length, slotIcon: slot.filter(function (x) { return x.hasAttribute('data-icon'); }).length, oldEl: q('#ww-team .ww-slot .ava > .ww-el').length,
          lane: lane.length, laneIcon: lane.filter(function (x) { return x.hasAttribute('data-icon'); }).length,
          loaded: all.filter(function (x) { return x.classList.contains('gava-loaded'); }).length, err: all.filter(function (x) { return x.classList.contains('gava-err'); }).length,
          badge: all.filter(function (x) { var t = x.querySelector('.gava-t'); return t && t.textContent && t.textContent !== '?'; }).length, n: all.length,
          inner: slot.concat(lane).filter(function (x) { return !x.getAttribute('data-gava'); }).length, total: window.__WW_LAST__.total }; }"""
    for _mode in ('images', 'blocked'):
        ctx, p = page(b, errs)
        if _mode == 'blocked':
            p.route('**/assets/avatars/**', lambda r: r.abort())
        p.goto(URL)
        p.wait_for_function("() => window.__WW_LAST__ && window.__WW_LAST__.total", timeout=120000)
        settle(p); p.wait_for_timeout(1200)
        gv = p.evaluate(GAVA)
        R['avatars_' + _mode] = gv
        if _mode == 'images':
            ok('avatars: .gava in slot cards + timeline lanes', gv['slot'] == 3 and gv['oldEl'] == 0 and gv['lane'] >= 3 and gv['inner'] == 0 and gv['total'] and round(gv['total']) == DEF, gv)
            if gv['slotIcon']:
                ok('avatars: images load', gv['loaded'] >= gv['slotIcon'] and gv['err'] == 0, gv)
            p.locator('#ww-team').screenshot(path=os.path.join(OUT, 'ww-avatars.png'))
        else:
            ok('avatars: blocked images fall back to badge', gv['loaded'] == 0 and gv['n'] > 0 and gv['badge'] == gv['n'] and gv['err'] >= gv['slotIcon'], gv)
            ok('avatars: totals unchanged without images', round(gv['total']) == DEF, gv)
            p.locator('#ww-team').screenshot(path=os.path.join(OUT, 'ww-avatars-fallback.png'))
        ctx.close()
    # aborted image requests log console errors (net::ERR_FAILED) — not page errors
    errs[:] = [e for e in errs if 'ERR_FAILED' not in e and 'avatars/' not in e]
    R['console_errors'] = list(errs)
    ok('no console errors', not errs, errs[:5])
    # ---- fetch failures
    fails = {}
    for name, handler in [('404', lambda r: r.fulfill(status=404, body='nf')),
                          ('badjson', lambda r: r.fulfill(status=200, body='{"meta":', content_type='application/json')),
                          ('version', None)]:
        e2 = []
        ctx, p = page(b, e2)
        if name == 'version':
            def h(route):
                d = json.loads(route.fetch().text()); d['meta']['version'] = '0.0.0'
                route.fulfill(status=200, body=json.dumps(d), content_type='application/json')
            handler = h
        p.route('**/data/ww.json*', handler)
        p.goto(URL)
        p.wait_for_selector('#loader.error .ld-err', timeout=30000)
        fails[name] = p.text_content('#loader.error .ld-err')
        if name == '404':
            p.screenshot(path=os.path.join(OUT, 'ww-error.png'))
        ctx.close()
    R['fetch_failures'] = fails
    ok('fetch failures shown', all(fails.values()))
    b.close()
srv.terminate()
R['all_ok'] = all(c['ok'] for c in R['checks'].values())
print(json.dumps(R, ensure_ascii=False, indent=1))
