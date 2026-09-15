type PhotoAttribution = { owner: string; author: string; license: string };

/** Hide only the known legacy suffix when the same image has a source disclosure.
 * Stored captions and unrelated/user-authored credit text are never rewritten.
 */
export function photoCaptionWithoutDuplicateCredit(caption: string | undefined, source?: PhotoAttribution): string {
  if (!caption || !source) return caption ?? '';
  const owner = source.author === source.owner || source.author === '개별 촬영자 미표기'
    ? source.owner : `${source.owner} · ${source.author}`;
  const credit = `사진: ${owner} · ${source.license}`;
  for (const newline of ['\r\n', '\n']) {
    const suffix = `${newline}${credit}`;
    if (caption.endsWith(suffix)) return caption.slice(0, -suffix.length);
  }
  return caption;
}
