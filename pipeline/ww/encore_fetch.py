#!/usr/bin/env python3
"""Polite cached fetcher for encore.moe (single-threaded, >=1.2s between network requests,
descriptive UA, raw responses cached under cache/encore/<bucket>/, every request logged, never refetch cached)."""
import hashlib, json, os, re, sys, time, urllib.request, urllib.parse, datetime

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'cache', 'encore')   # local cache (not committed)
LOG = os.path.join(ROOT, 'requests.log')
UA = 'gamedata-pipeline/1.0 (Wuthering Waves damage-sim data research; single-threaded, cached; contact via encore.moe discord)'
MIN_GAP = 1.2
_last = [0.0]


def cache_path(url, bucket):
    u = urllib.parse.urlsplit(url)
    name = (u.netloc + u.path).strip('/').replace('/', '__')
    if u.query:
        name += '__' + hashlib.sha1(u.query.encode()).hexdigest()[:10]
    name = re.sub(r'[^A-Za-z0-9._\-]', '_', name)[:200]
    return os.path.join(ROOT, bucket, name)


def get(url, bucket='_site', as_json=False):
    p = cache_path(url, bucket)
    if os.path.exists(p):
        data = open(p, 'rb').read()
        return json.loads(data) if as_json else data
    if os.path.exists(p + '.404'):
        return None
    os.makedirs(os.path.dirname(p), exist_ok=True)
    wait = MIN_GAP - (time.time() - _last[0])
    if wait > 0:
        time.sleep(wait)
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json, text/plain, */*'})
    status, data = None, b''
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            status, data = r.status, r.read()
    except urllib.error.HTTPError as e:
        status = e.code
    finally:
        _last[0] = time.time()
        with open(LOG, 'a') as f:
            f.write(f"{datetime.datetime.now().isoformat(timespec='seconds')}\t{status}\t{len(data)}\t{url}\n")
    if status == 404:
        open(p + '.404', 'w').close()
        return None
    if status != 200:
        raise RuntimeError(f'HTTP {status} for {url}')
    open(p, 'wb').write(data)
    return json.loads(data) if as_json else data


if __name__ == '__main__':
    d = get(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else '_site')
    sys.stdout.write(d.decode('utf-8', 'replace') if d else 'None')
