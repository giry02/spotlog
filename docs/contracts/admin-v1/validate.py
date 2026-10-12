"""Validate committed administrator contracts and synthetic fixtures; no services called."""
from pathlib import Path
import copy
import json
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parent


def read(name):
    return json.loads((ROOT / name).read_text(encoding='utf-8'))


def check_local_references(document):
    def walk(value):
        if isinstance(value, dict):
            ref = value.get('$ref')
            if ref:
                assert ref.startswith('#/'), f'Unexpected external reference: {ref}'
                target = document
                for part in ref[2:].split('/'):
                    target = target[part.replace('~1', '/').replace('~0', '~')]
            for nested in value.values():
                walk(nested)
        elif isinstance(value, list):
            for nested in value:
                walk(nested)
    walk(document)


def validate():
    schemas = read('schemas.json')
    spec = read('openapi.json')
    fixtures = read('fixtures.json')
    Draft202012Validator.check_schema(schemas)
    check_local_references(schemas)
    check_local_references(spec)
    assert spec['openapi'] == '3.1.0'
    assert spec['servers'] == [{'url': '/api/admin/v1', 'description': 'Same-origin Spotlog server'}]
    expected_paths = {'/me': 'get', '/snapshot': 'get', '/resources/{resource}': 'get', '/commands': 'post'}
    assert set(spec['paths']) == set(expected_paths)
    operations = {spec['paths'][name][method]['operationId']: spec['paths'][name][method] for name, method in expected_paths.items()}
    assert len(operations) == 4
    assert fixtures['synthetic'] is True

    def validator(name):
        return Draft202012Validator({**schemas, '$ref': '#/$defs/' + name})

    count = 0
    for item in fixtures['dtoFixtures']:
        validator(item['schema']).validate(item['body'])
        count += 1
    for item in fixtures['responses']:
        validator(item['schema']).validate(item['body'])
        response = operations[item['operationId']]['responses'][str(item['status'])]
        assert response['content']['application/json']['schema']['$ref'] == '#/components/schemas/' + item['schema']
        count += 1
    kinds = set()
    for item in fixtures['commands']:
        validator('AdminCommand').validate(item['command'])
        assert item['command']['kind'] == item['name']
        assert item['name'] not in kinds
        kinds.add(item['name'])
        count += 1
    assert len(kinds) >= 40, 'Missing command fixtures'

    base = copy.deepcopy(fixtures['commands'][0]['command'])
    negative = []
    for field in ('expectedRevision', 'idempotencyKey'):
        bad = copy.deepcopy(base)
        bad.pop(field)
        negative.append(('AdminCommand', bad))
    negative.extend([
        ('AdminCommand', {**base, 'kind': 'unrecognized.command'}),
        ('AdminCommand', {**base, 'actor': {'role': 'ADMIN'}}),
        ('AdminCommand', {**base, 'apiKey': 'not-a-real-secret'}),
        ('AdminSession', {'operatorId': 'review-operator', 'name': '검수 운영자', 'role': 'SUPERUSER'}),
        ('AdminErrorEnvelope', {'error': {'message': 'missing code'}}),
        ('AiRequestSummary', {**next(item['body'] for item in fixtures['dtoFixtures'] if item['schema'] == 'AiRequestSummary'), 'customerPrompt': 'must never be accepted'}),
        ('AdminCommand', {**base, 'expectedRevision': 1.5}),
        ('AdminCommand', {**base, 'idempotencyKey': ''}),
        ('AdminQuery', {'resource': 'places', 'page': 1.5}),
        ('AdminQuery', {'resource': 'places', 'pageSize': 101}),
        ('PublicJournal', {**fixtures['responses'][1]['body']['ops']['journals'][0], 'ownerVisibility': 'PRIVATE'}),
    ])
    for name, value in negative:
        assert list(validator(name).iter_errors(value)), f'Invalid fixture unexpectedly accepted: {name}'

    # The old AI bundle now has actual artifacts; these checks are format-only.
    ai_root = ROOT.parent / 'ai-v1'
    ai_schema = json.loads((ai_root / 'schemas.json').read_text(encoding='utf-8'))
    ai_fixtures = json.loads((ai_root / 'fixtures.json').read_text(encoding='utf-8'))
    cases = [json.loads(line) for line in (ai_root / 'cases.ko.jsonl').read_text(encoding='utf-8').splitlines()]
    Draft202012Validator.check_schema(ai_schema)
    check_local_references(ai_schema)
    assert len(cases) == 100
    assert sum(case['split'] == 'development' for case in cases) == 70
    assert sum(case['split'] == 'holdout' for case in cases) == 30

    def validate_ai(name, value):
        Draft202012Validator({**ai_schema, '$ref': '#/$defs/' + name}).validate(value)

    for case in cases:
        validate_ai('GenerateRequest', case['input'])
        validate_ai('Normalized', case['expected'])
    for item in ai_fixtures['public']:
        validate_ai('GenerateRequest', item['request'])
        validate_ai('DraftResponse', item['response'])
    for name, types in {
        'rag': ('RagRequest', 'RagResponse'), 'interpret': ('InterpretRequest', 'InterpretResponse'),
        'explain': ('ExplainRequest', 'ExplainResponse'), 'revision': ('RevisionRequest', 'DraftResponse'),
        'apply': ('ApplyRequest', 'ApplyResponse'),
    }.items():
        for side, type_name in zip(('request', 'response'), types):
            validate_ai(type_name, ai_fixtures['internal'][name][side])

    print(f'PASS: {count} administrator fixtures, {len(negative)} invalid DTOs rejected, local references/routes valid; 100 AI expected cases and synthetic responses valid. No backend or model execution.')


if __name__ == '__main__':
    validate()
