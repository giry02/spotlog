import { getSocialSample } from './social-samples';
import { normalizeSocialTarget, type SocialTarget } from './social-target';

/** Only authored public fixtures cross the model boundary. The browser's own
 * comments, reactions and saved copies are never arguments to this projection. */
export function socialModelSample(target: SocialTarget) {
  const canonical = normalizeSocialTarget(target);
  if (!canonical) return null;
  const sample = getSocialSample(canonical);
  if (!sample) return null;
  const roots = sample.threads.filter(thread => thread.parentId === null).length;
  return {
    target: canonical,
    source: 'SAMPLE' as const,
    copies: sample.copies,
    reactions: {
      LIKE: sample.reactions.LIKE,
      LOVE: sample.reactions.LOVE,
      BEST: sample.reactions.BEST,
      HELPFUL: sample.reactions.HELPFUL,
    },
    threads: { total: sample.threads.length, roots, replies: sample.threads.length - roots },
  };
}

/** Ambiguous requests retain every target candidate for clarification, while
 * the ancillary fixture metrics stay bounded. No comment text is transmitted. */
export function socialModelSamples(candidates: readonly { target: SocialTarget }[]) {
  return candidates.slice(0, 8).flatMap(({ target }) => {
    const sample = socialModelSample(target);
    return sample ? [sample] : [];
  });
}
