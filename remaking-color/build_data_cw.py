"""Builds remaking-color/cw-data.js from the poster dataset CSVs + Wikidata genres.
Run:  python3 -I remaking-color/build_data.py   (from poster-dataset/)"""
import csv, json, re, collections, statistics as st
raw = json.load(open('remaking-color/wikidata_genres_raw.json'))
posters = list(csv.DictReader(open('posters.csv')))
pairs = list(csv.DictReader(open('pair_differences.csv')))
notes = {r['pair']: r for r in csv.DictReader(open('remake_pairs_to_check.csv'))}
M = ['chroma','lightness','contrast','warmth','whiteness','greyness','texture']
# Broad genre groups: a film carries a group if ANY of its Wikidata genre labels matches.
GROUPS = [('Horror', r'horror|slasher|splatter|zombie'), ('Science fiction', r'science fiction|dystopian|cyberpunk'),
 ('Crime & thriller', r'crime|thriller|suspense|film noir'), ('Musical', r'musical'), ('Fantasy & family', r'fantasy|fairy|family|children'),
 ('Action & adventure', r'action|adventure|martial arts|sword-and-sandal|war film'), ('Drama & romance', r'drama|romance|melodrama'), ('Comedy', r'comedy')]
def tags(tid): return [n for n, rx in GROUPS if any(re.search(rx, g, re.I) for g in raw.get(tid, []))]
def poster_row(x):
    pal = [[x[f'palette_{i}_hex'], float(x[f'palette_{i}_pct'])] for i in range(1, 7)]
    hue = [float(x[k]) for k in x if k.startswith('hue_')]
    return {'file': x['file'], 'n': int(x['poster_number_for_film']), 'palette': pal, 'hue': hue, 'metrics': {k: float(x[k if k not in ('whiteness','greyness') else k + '_pct']) for k in M}}
distinct = [x for x in posters if not x['duplicate_of']]
sd = {k: st.pstdev([float(x[k if k not in ('whiteness','greyness') else k + '_pct']) for x in distinct]) for k in M}
byfilm = collections.defaultdict(list)
for x in distinct: byfilm[(x['title'], x['year'], x['role'])].append(poster_row(x))
tmdb = {(x['title'], x['year'], x['role']): x['tmdb_id'] for x in posters}
import numpy as np
from PIL import Image
def _sig(f): return np.asarray(Image.open('posters/' + f).convert('L').resize((24, 36), Image.BILINEAR), float)
def dedupe(ps):
    """Keep one poster per look: drop any poster whose image is (near) identical to one already kept."""
    kept = []
    for p in ps:
        sg = _sig(p['file'])
        if all(np.abs(sg - k[1]).mean() >= 1.0 for k in kept): kept.append((p, sg))
    return [k[0] for k in kept]
def film(t, y, role):
    ps = sorted(byfilm[(t, str(y), role)], key=lambda p: p['n']); tid = tmdb[(t, str(y), role)]
    ps = dedupe(ps)
    return {'title': t, 'year': int(y), 'tmdb': tid, 'genres': raw.get(tid, []), 'tags': tags(tid), 'posters': ps,
            'metrics': {k: round(sum(p['metrics'][k] for p in ps) / len(ps), 2) for k in M}}
out = []
for p in pairs:
    o, r = film(p['original'], p['original_year'], 'original'), film(p['remake'], p['remake_year'], 'remake')
    n = notes.get(p['pair'], {})
    shared = [g for g in o['tags'] if g in r['tags']]
    out.append({'id': int(p['pair']), 'orig': o, 'remake': r, 'rel': p['relationship'], 'note': n.get('note', ''), 'gap': int(p['remake_year']) - int(p['original_year']),
                'ch': {k: round(float(p[k + '_change']), 2) for k in M}, 'shared': shared})
cnt = collections.Counter(g for p in out for g in p['shared'])
print('pairs', len(out), 'shared-genre counts', dict(cnt), 'pairs with no shared group', sum(1 for p in out if not p['shared']))
changed = []
for p in out:  # changes are recomputed from the de-duplicated film averages; report where this differs from pair_differences.csv
    for k in M:
        d = round(p['remake']['metrics'][k] - p['orig']['metrics'][k], 2)
        if abs(d - p['ch'][k]) >= 0.05: changed.append((p['id'], p['orig']['title'], k, p['ch'][k], d))
        p['ch'][k] = d
print('pairs whose numbers moved after removing duplicate posters:', sorted({c[0] for c in changed}), changed[:6])
open('remaking-color/cw-data.js', 'w').write('window.RC = ' + json.dumps({'pairs': out, 'sd': sd, 'groups': [g for g, _ in GROUPS], 'groupRules': {g: rx for g, rx in GROUPS}}, separators=(',', ':')) + ';')

