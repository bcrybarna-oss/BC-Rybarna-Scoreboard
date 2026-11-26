"""Read-only independent field verifier; no Firebase, writer, repository imports or credentials."""
import copy
import hashlib
import json
import pathlib
import sys

CONTENT = frozenset(('tournamentIds', 'scoringMode', 'placementTieBreak', 'bestCount',
                     'pointsTop', 'pointsBands', 'customPointsText', 'customPoints', 'updatedAt'))
CORE = frozenset(('id', 'createdByUid', 'managerUids'))

def normalized(value):
    # RTDB numeric maps and arrays are equivalent, but original indices are NEVER renumbered.
    if isinstance(value, list):
        value = {str(i): v for i, v in enumerate(value)}
    if isinstance(value, dict):
        result = {k: normalized(v) for k, v in value.items()}
        return {k: v for k, v in result.items() if v is not None} or None
    return value

def verify(source, target):
    assert target.get('schemaVersion') == 1
    assert set(target) <= {'schemaVersion', 'id', 'createdByUid', 'managerUids', 'content', 'preserved'}
    assert isinstance(target.get('content', {}), dict) and isinstance(target.get('preserved', {}), dict)
    assert set(target.get('content', {})) <= CONTENT
    assert not (set(target.get('preserved', {})) & (CONTENT | CORE))
    restored = {k: v for section in ('content', 'preserved') for k, v in target.get(section, {}).items()}
    restored.update({k: target[k] for k in CORE if k in target})
    assert normalized(source) == normalized(restored), 'Full source field/value mismatch'
    for k, value in source.items():
        section = target if k in CORE else target.get('content' if k in CONTENT else 'preserved', {})
        assert normalized(value) == normalized(section.get(k)), 'Field moved, removed or altered'
    assert normalized(source.get('tournamentIds')) == normalized(target.get('content', {}).get('tournamentIds')), 'Reference index/order mismatch'

def run(source_file, target_file, report_file):
    original = source_file.read_bytes()
    data = json.loads(original.decode('utf-8-sig'))
    target_data = json.loads(target_file.read_text(encoding='utf-8-sig'))
    if 'id' in data and 'createdByUid' in data:
        # Raw selected-series GET receipt and raw target GET receipt.
        records = [data]
        targets = {target_data['id']: target_data}
    else:
        series = data['data']['tournamentSeries']
        records = list(series.values()) if isinstance(series, dict) else series
        targets = target_data
    assert len(records) == len(targets) and len({s['id'] for s in records}) == len(records)
    links = 0
    for source in records:
        verify(source, targets[source['id']])
        links += len(source.get('tournamentIds', {}))
    assert source_file.read_bytes() == original
    report = {'mode': 'OFFLINE_PRELIMINARY_ONLY', 'series': len(records), 'links': links,
              'allIndicesAndUnknownValues': 'PASS', 'liveTargetVerified': False,
              'sourceSHA256': hashlib.sha256(original).hexdigest(),
              'proposedTargetSHA256': hashlib.sha256(target_file.read_bytes()).hexdigest(),
              'productionAuthorization': False}
    with report_file.open('x', encoding='utf-8') as output:
        output.write(json.dumps(report, indent=2))
    print(json.dumps(report))

def self_check():
    source = {'id':'s', 'createdByUid':'owner', 'managerUids':{'m':True},
              'tournamentIds':['a','b'], 'updatedAt':'now', 'future':{'nested':{'value':7}}}
    target = {'schemaVersion':1, 'id':'s', 'createdByUid':'owner', 'managerUids':{'m':True},
              'content':{'tournamentIds':['a','b'], 'updatedAt':'now'},
              'preserved':{'future':{'nested':{'value':7}}}}
    verify(source, target)
    for change in ('order', 'unknown', 'owner', 'index'):
        bad = copy.deepcopy(target)
        if change == 'order': bad['content']['tournamentIds'].reverse()
        elif change == 'unknown': del bad['preserved']['future']
        elif change == 'owner': bad['createdByUid'] = 'different'
        else: bad['content']['tournamentIds'] = {'1':'a', '2':'b'}
        try: verify(source, bad)
        except AssertionError: continue
        raise AssertionError('Verifier failed to detect '+change)
    print('PASS: verifier positive control and four corruption controls, entirely offline')

if __name__ == '__main__':
    if sys.argv[1:] == ['--self-check']: self_check()
    else: run(*(pathlib.Path(p) for p in sys.argv[1:]))
