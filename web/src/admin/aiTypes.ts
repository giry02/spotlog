export type AiChannel = 'SIMPLE' | 'SAVED' | 'REVISION' | 'GUIDE' | 'CHATBOT';
export type AiStage = 'INTERPRET' | 'SEARCH' | 'COMPOSE' | 'EXPLAIN' | 'VALIDATE' | 'TOOL';
export type AiErrorCode = 'NONE' | 'INPUT_MISSING' | 'DATA_MISSING' | 'COORDINATES_MISSING' | 'CONNECTION_FAILED' | 'MODEL_FORMAT' | 'MODEL_INTERPRETATION' | 'MODEL_EXPLANATION' | 'REVISION_CONFLICT' | 'RIGHTS_REVOKED';
export type AiKind = 'LANDMARK' | 'FOOD' | 'CAFE' | 'STAY' | 'SHOP';

export interface AiDocumentRef {
  placeId: string;
  version: number;
  fingerprint: string;
}

export interface AiIndexVersion {
  indexId: string;
  label: string;
  embeddingProfile: string;
  state: 'CANDIDATE' | 'VERIFIED' | 'ACTIVE' | 'ARCHIVED' | 'FAILED';
  documents: AiDocumentRef[];
  createdAt: string;
  verifiedAt?: string;
  appliedAt?: string;
  localSimulation: boolean;
  validationErrors: string[];
}

export interface AiIndexJob {
  jobId: string;
  mode: 'FULL' | 'DOCUMENT' | 'REMOVAL';
  placeId?: string;
  indexId: string;
  state: 'QUEUED' | 'RUNNING' | 'VALIDATION_PENDING' | 'APPLIED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
  attempts: number;
  error?: string;
  localSimulation: boolean;
}

export interface AiPolicy {
  policyId: string;
  label: string;
  version: number;
  state: 'DRAFT' | 'TESTED' | 'ACTIVE' | 'ARCHIVED';
  smallLocalProfile: string;
  embeddingProfile: string;
  externalProfile: string;
  flowiseProfile: string;
  promptVersion: string;
  regions: string[];
  channels: AiChannel[];
  externalEnabled: boolean;
  externalMaxCalls: number;
  timeoutMs: number | null;
  externalBudgetKrw: number | null;
  createdAt: string;
  testedAt?: string;
  testedFingerprint?: string;
  validationErrors: string[];
}

export interface AiTestFixture {
  fixtureId: string;
  title: string;
  prompt: string;
  channel: AiChannel;
  region: string;
  dayCount: number;
  includeFood: boolean;
  includeStay: boolean;
  expectedPlaceIds: string[];
  scenario: 'NORMAL' | 'MISSING_DATA' | 'CONNECTION_FAILURE' | 'MODEL_FORMAT' | 'STALE_REVISION';
  source: 'OPERATOR_SYNTHETIC';
  revision: number;
}

export interface AiTestVisit {
  visitId: string;
  placeId: string;
  kind: AiKind;
  name: string;
  day: number;
  slot: 'MORNING' | 'LUNCH' | 'AFTERNOON' | 'DINNER' | 'LODGING';
  bookingFixed: boolean;
}

export interface AiTestCheck {
  label: string;
  passed: boolean;
  detail: string;
}

export interface AiTestResult {
  resultId: string;
  fixtureId: string;
  fixtureRevision: number;
  policyId: string;
  indexId: string;
  createdAt: string;
  outcome: 'PASS' | 'FAIL' | 'BLOCKED';
  errorCode: AiErrorCode;
  checks: AiTestCheck[];
  sources: AiDocumentRef[];
  visits: AiTestVisit[];
  originalVisits: AiTestVisit[];
  guideEvidence: { placeId: string; text: string; sourceUrl: string; english: string }[];
  messages: { role: 'USER' | 'ASSISTANT'; text: string }[];
  proposedRevision: number;
  expectedRevision: number;
  externalCalls: 0 | 1;
  externalEligibility: boolean;
  externalReason: string;
  localSimulation: boolean;
  saved: false;
}

/** Request summaries deliberately exclude customer prompts, conversations and private trips. */
export interface AiRequestSummary {
  requestId: string;
  channel: AiChannel;
  state: 'SUCCESS' | 'FAILED' | 'PENDING';
  stage: AiStage;
  modelProfile: string;
  policyId: string;
  indexId: string;
  errorCode: AiErrorCode;
  sourcePlaceIds: string[];
  latencyMs: number | null;
  externalCostKrw: number | null;
  fallbackReason: string;
  createdAt: string;
  localSimulation: boolean;
}

export interface AiFeedback {
  feedbackId: string;
  resultId: string;
  category: 'MISSING_PLACE' | 'WRONG_ORDER' | 'GROUNDING' | 'REVISION' | 'OTHER';
  note: string;
  state: 'OPEN' | 'RESOLVED';
  createdAt: string;
}

export interface AiState {
  indices: AiIndexVersion[];
  jobs: AiIndexJob[];
  policies: AiPolicy[];
  fixtures: AiTestFixture[];
  results: AiTestResult[];
  requests: AiRequestSummary[];
  feedback: AiFeedback[];
  activeIndexId: string;
  activePolicyId: string;
  paused: boolean;
}

export type AiPolicyInput = Pick<AiPolicy, 'label' | 'smallLocalProfile' | 'embeddingProfile' | 'externalProfile' | 'flowiseProfile' | 'promptVersion' | 'regions' | 'channels' | 'externalEnabled' | 'externalMaxCalls' | 'timeoutMs' | 'externalBudgetKrw'>;
export type AiFixtureInput = Omit<AiTestFixture, 'fixtureId' | 'source' | 'revision'>;

export type AiCommand =
  | { kind: 'ai.index.queue'; mode: 'FULL' | 'DOCUMENT' | 'REMOVAL'; placeId?: string; embeddingProfile?: string }
  | { kind: 'ai.index.run'; jobId: string; simulateFailure?: boolean }
  | { kind: 'ai.index.retry'; jobId: string }
  | { kind: 'ai.index.verify'; indexId: string }
  | { kind: 'ai.index.activate'; indexId: string }
  | { kind: 'ai.index.rollback'; indexId: string }
  | { kind: 'ai.fixture.save'; fixtureId?: string; fixture: AiFixtureInput; entityRevision?: number }
  | { kind: 'ai.fixture.run'; fixtureId: string; policyId?: string; indexId?: string }
  | { kind: 'ai.feedback.add'; resultId: string; category: AiFeedback['category']; note: string }
  | { kind: 'ai.feedback.resolve'; feedbackId: string }
  | { kind: 'ai.policy.save'; policyId?: string; policy: AiPolicyInput; entityRevision?: number }
  | { kind: 'ai.policy.test'; policyId: string }
  | { kind: 'ai.policy.activate'; policyId: string }
  | { kind: 'ai.policy.rollback'; policyId: string }
  | { kind: 'ai.pause'; paused: boolean };
