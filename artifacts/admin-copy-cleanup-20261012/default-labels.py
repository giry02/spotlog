from pathlib import Path
p=Path('web/src/admin/AIPage.tsx');s=p.read_text(encoding='utf-8')
anchor="const emptyFixture = (): AiFixtureInput"
helper="""function displayAiLabel(value: string): string {
  if (value === '소형 로컬 우선 · 검수용') return '소형 LLM 우선';
  if (value === '검수용 초기 색인 · 자료 0건') return '초기 색인 · 자료 0건';
  return /^(전체 재구성|자료 제거|문서 갱신) · 검수용$/.test(value) ? value.replace(' · 검수용', '') : value;
}
"""
assert anchor in s;s=s.replace(anchor,helper+anchor)
for before,after in [('{index.label}', '{displayAiLabel(index.label)}'),('{policy.label}', '{displayAiLabel(policy.label)}'),('value={input.label}', 'value={displayAiLabel(input.label)}')]:
 assert before in s;s=s.replace(before,after)
p.write_text(s,encoding='utf-8')
p=Path('web/src/admin/aiSeed.ts');s=p.read_text(encoding='utf-8').replace("label: '소형 로컬 우선 · 검수용'", "label: '소형 LLM 우선'").replace("label: '검수용 초기 색인 · 자료 0건'", "label: '초기 색인 · 자료 0건'");p.write_text(s,encoding='utf-8')
p=Path('web/src/admin/aiDomain.ts');s=p.read_text(encoding='utf-8').replace("'문서 갱신'} · 검수용`", "'문서 갱신'}`");p.write_text(s,encoding='utf-8')
p=Path('web/tests/adminOperationsRecheckBrowser.cjs');s=p.read_text(encoding='utf-8').replace('/v1 · 소형 로컬 우선/', '/v1 · 소형 LLM 우선/');p.write_text(s,encoding='utf-8')
