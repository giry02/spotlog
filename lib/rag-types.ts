export type RagEvidence = {
  evidenceId: string;
  placeId: string;
  documentId: string;
  chunkId: string;
  sourceVersion: string;
  text: string;
  sourceKind: 'authored-demo-data' | 'curated-official-summary';
  title?: string;
  sourceUrl?: string;
  checkedAt?: string;
};
export type RagRetrieval = {
  dataMode: 'authored-demo-data' | 'curated-travel-data';
  indexVersion: string;
  embeddingModel: string;
  results: RagEvidence[];
};

export type AnswerContext = {
  retrievalStatus: 'available' | 'empty' | 'unavailable' | 'not-needed' | 'disabled';
  modelRouting?: {
    tier: 'local' | 'large';
    provider: string;
    model?: string;
    reason: 'rag-insufficient' | 'primary-failed' | 'primary';
    status: 'ready' | 'unavailable' | 'not-configured';
  };
  weather?: {
    status: 'ready' | 'asked-location' | 'unsupported-location' | 'unsupported-date' | 'unavailable';
    retrievedAt: string;
    location?: string;
    dates?: string[];
  };
};
