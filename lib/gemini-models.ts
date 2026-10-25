/** Text-only Gemini selection shared by runtime prediction and setup checks. */
export function isGeminiTextModel(model: string): boolean {
  return /^gemini-[a-z0-9.-]{1,110}$/.test(model) &&
    /(?:^|-)(?:pro|flash)(?:-|$)/.test(model) &&
    !/image|audio|tts|live|vision|robotics|computer-use|embedding|transcrib|speech|video/.test(model);
}

export function selectGeminiTextModel(models: readonly unknown[], selected: string) {
  if (!isGeminiTextModel(selected)) return;
  return models.find((value): value is { name: string; supportedGenerationMethods: string[] } => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const entry = value as Record<string, unknown>;
    return entry.name === `models/${selected}` && Array.isArray(entry.supportedGenerationMethods) && entry.supportedGenerationMethods.includes('generateContent');
  });
}

/** Gemini 3+ rejects legacy sampling/count parameters; 2.x remains supported.
 * https://ai.google.dev/gemini-api/docs/generate-content/whats-new-gemini-3.8
 */
export function geminiGenerationConfig(model: string, maxOutputTokens = 4096, legacyTemperature = 0.1) {
  const major = Number(model.match(/^gemini-(\d+)(?:\.|-)/)?.[1]);
  const common = { responseMimeType: 'application/json', maxOutputTokens };
  return major >= 3
    ? { ...common, thinkingConfig: { thinkingLevel: 'LOW' as const } }
    : { ...common, temperature: legacyTemperature, candidateCount: 1 };
}
