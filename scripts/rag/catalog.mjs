import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RagError } from './ollama.mjs';
import { authoredPlaceText } from '../../lib/rag-source.ts';
import { registerHooks } from 'node:module';

// Node's native TS loader requires explicit extensions. Keep this resolution
// limited to our own typed catalog modules; Vite uses its normal resolver.
const localLibRoot = new URL('../../lib/', import.meta.url).href;
registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.startsWith(localLibRoot) && specifier.startsWith('./') && !/\.[a-z]+$/.test(specifier))
    return next(new URL(specifier + '.ts', context.parentURL).href, context);
  return next(specifier, context);
} });

// trip-data.ts intentionally re-exports these canonical descriptions. Import the
// underlying typed module using Node's native type stripping; no source rewriting.
// Never ingest external URLs, personal conversations, plans, bookings or reviews.
export async function authoredDemoDocuments(projectRoot) {
  const source = await readFile(resolve(projectRoot, 'lib/trip-data.ts'), 'utf8');
  if (!source.includes("from './connected-data'") || !source.includes('connectedPlaces')) throw new RagError('catalog_source_changed');
  const { places } = await import(pathToFileURL(resolve(projectRoot, 'lib/connected-data.ts')).href);
  const { jejuKnowledgeDocuments } = await import(pathToFileURL(resolve(projectRoot, 'lib/jeju-knowledge.ts')).href);
  const { registeredKnowledgeDocuments } = await import(pathToFileURL(resolve(projectRoot, 'lib/registered-knowledge.ts')).href);
  return [...places.map((place) => ({
    placeId: place.id,
    text: authoredPlaceText(place),
    sourceKind: 'authored-demo-data',
    rightsStatus: 'approved',
  })), ...jejuKnowledgeDocuments.map((doc) => ({
    documentId: `moa-knowledge:${doc.id}`,
    placeId: doc.placeId,
    text: `${doc.title}\n지역: 제주\n${doc.text}\n공식 자료 확인일: ${doc.checkedAt}`,
    sourceKind: 'curated-official-summary',
    rightsStatus: 'approved',
    title: doc.title,
    sourceUrl: doc.sourceUrl,
    checkedAt: doc.checkedAt,
  })), ...registeredKnowledgeDocuments.map((doc) => ({
    documentId: `moa-knowledge:${doc.id}`,
    placeId: doc.placeId, text: doc.text, sourceKind: 'curated-official-summary', rightsStatus: 'approved',
    title: doc.title, sourceUrl: doc.sourceUrl, checkedAt: doc.checkedAt,
  }))];
}
