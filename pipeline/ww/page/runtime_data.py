"""Runtime data bundled into dist/data/ww.json for the ww page (key `runtime`).
Trims validation/action_frames.json to the fields the engine reads (frameEntry / indexScraperFrames)."""
import json, re

KEEP_FR = ('total', 'earliest_cancel', 'no_swap', 'swap_resolved', 'time_stop')  # time_stop: timeStop exclude (default) needs it
NOTE_RE = re.compile(r'核对：不一致|内部矛盾')


def trim_acts(acts):
    return trim_frames({'characters': {'x': acts}})['characters']['x']


def trim_frames(fr):
    chars = {}
    for cname, acts in fr.get('characters', {}).items():
        out = {}
        for lab, e in acts.items():
            if e is None:
                out[lab] = None
                continue
            t = {'duration_s': e.get('duration_s'), 'cancel_s': e.get('cancel_s'), 'fps': e.get('fps') or 60}
            mk = e.get('markers_s')
            if mk:  # WuWaSim: keep the markers the engine reads
                t['markers_s'] = {k: mk[k] for k in ('freezeTime', 'nextAttAt', 'skillEndAt') if mk.get(k) is not None}
            f = e.get('frames') or {}
            t['frames'] = {k: f[k] for k in KEEP_FR if k in f and f[k] is not None}
            if e.get('source'):
                t['source'] = e['source']
            if e.get('version'):
                t['version'] = e['version']
            for k in ('tsVerified', 'tsSource'):  # measured time-stop flag (toa semantics: non-liberation stops excluded only when verified)
                if e.get(k):
                    t[k] = e[k]
            notes = e.get('notes') or ''
            if e.get('duration_s') is None or NOTE_RE.search(notes):
                t['notes'] = notes
            out[lab] = t
        chars[cname] = out
    return {'target_version': fr.get('target_version'), 'generated_at': fr.get('generated_at'),
            'sources': [{'name': s.get('name'), 'url': s.get('url'), 'version': s.get('version')} for s in fr.get('sources', [])],
            'missing': fr.get('missing', []), 'characters': chars,
            'echoes': {n: trim_acts(a) for n, a in (fr.get('echoes') or {}).items()} if 'echoes' in fr else {},
            'discrepancies': [{k: x[k] for k in ('character', 'echo', 'action', 'field', 'detail') if k in x} for x in fr.get('discrepancies', [])
                              if isinstance(x, dict) and (x.get('character') or x.get('echo'))]}


def runtime(tiers_path, frames_path):
    tiers = json.load(open(tiers_path, encoding='utf-8'))
    fr = json.load(open(frames_path, encoding='utf-8'))
    return {'schema': 'ww-runtime-1', 'substatTiers': tiers, 'actionFrames': trim_frames(fr),
            'framesInfo': {'source': (fr.get('sources') or [{}])[0].get('name'), 'target_version': fr.get('target_version'),
                           'generated_at': fr.get('generated_at'), 'characters': len(fr.get('characters', {}))}}
