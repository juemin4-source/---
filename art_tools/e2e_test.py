#!/usr/bin/env python3
"""E2E test: drive the full PixelBench API in mock mode."""
import json, time, urllib.request, sys

BASE = 'http://127.0.0.1:8321'

def req(path, data=None, method=None):
    body = json.dumps(data).encode() if data is not None else None
    m = method or ('POST' if body else 'GET')
    r = urllib.request.Request(BASE + path, data=body, method=m)
    if body:
        r.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(r, timeout=30) as resp:
        b = resp.read()
        return b if b[:1] == b'P' or resp.headers.get('Content-Type', '').startswith('application/zip') else json.loads(b)

# 1. status
s = req('/api/status')
print('status:', s)
assert s['mock'] and s['comfy'] is not None

# 2. create entity (delete first if exists)
try:
    req('/api/entities/knight_test', method='DELETE')
except Exception:
    pass
ent = req('/api/entities', {'name': 'knight_test'})
print('created:', ent['name'], ent['spec']['animations'])

# 3. generate 3 frames for idle (sequential)
for i in range(3):
    r = req('/api/entities/knight_test/frames/idle/%d/generate' % i,
            {'prompt': 'test knight idle', 'seed': 100 + i, 'quality': 'fast'})
    tid = r['task_id']
    for _ in range(30):
        time.sleep(0.5)
        t = req('/api/tasks')
        tt = [x for x in t if x['id'] == tid]
        if tt and tt[0]['status'] in ('completed', 'failed', 'timeout'):
            break
    t = [x for x in req('/api/tasks') if x['id'] == tid][0]
    print('frame %d -> %s progress=%s cands=%s' % (i, t['status'], t.get('progress'), t.get('candidates')))
    assert t['status'] == 'completed', t

# 4. adopt frame 0 (first candidate)
st = req('/api/entities/knight_test')
cand0 = st['frames']['idle']['candidates']['0']
print('candidates idle/0:', cand0)
a = req('/api/entities/knight_test/frames/idle/0/adopt', {'candidate': cand0[0]})
print('adopted, idle adopted count:', a['frames']['idle']['adopted'])
assert a['frames']['idle']['adopted'] == 1

# 5. normalize
n = req('/api/entities/knight_test/normalize', {})
print('normalize:', n)
assert len(n['normalized']) >= 1

# 6. pack (only idle adopted so far; pack needs frames present)
p = req('/api/entities/knight_test/pack', {})
print('pack:', p)
assert 'idle' in p['animations']

# 7. validate
v = req('/api/entities/knight_test/validate')
print('validate ok=%s animations=%s' % (v['ok'], {k: len(d['problems']) for k, d in v['animations'].items()}))

# 8. export zip
z = req('/api/entities/knight_test/export', {}, 'POST')
open('e2e_export.zip', 'wb').write(z)
import zipfile
names = zipfile.ZipFile('e2e_export.zip').namelist()
print('export zip: %d files, sample: %s' % (len(names), names[:5]))
assert any('index' in x for x in names)

# 9. spec update
su = req('/api/entities/knight_test/spec', {'animations': ['idle', 'walk', 'atkA'], 'fps': 12, 'notes': 'e2e'})
print('spec updated:', su['spec']['animations'])

print('\nE2E PASS')
