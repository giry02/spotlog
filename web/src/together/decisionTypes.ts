export interface DecisionScope { groupId: string; activityId: string }
export interface DecisionCandidateInput { placeId: string; referenceCostKrw?: number }
export interface DecisionDateOption { id: string; date: string; time?: string }
export interface DecisionCreateInput {
  title: string; candidates: DecisionCandidateInput[]; dateOptions: DecisionDateOption[]; expectedActivityRevision: number;
  /** Starting again explicitly closes the previous comparison without changing the appointment. */
  replaceDecisionId?: string; expectedDecisionRevision?: number;
}
export interface DecisionResponse {
  userId: string; availablePlaceIds: string[]; preferredPlaceId?: string; availableDateIds: string[];
  budgetMaxKrw?: number; originPlaceId?: string; revision: number; updatedAt: string;
}
/** No exclusion reason, free-form private note or precise device location belongs in a shared response. */
export interface DecisionResponseInput {
  availablePlaceIds: string[]; preferredPlaceId?: string; availableDateIds: string[];
  budgetMaxKrw?: number; originPlaceId?: string; expectedRevision: number;
}
export interface TogetherDecision extends DecisionScope {
  id: string; title: string; creatorId: string; candidates: DecisionCandidateInput[]; dateOptions: DecisionDateOption[];
  expectedMemberIds: string[]; responses: DecisionResponse[]; revision: number; status: 'OPEN' | 'APPLIED' | 'CANCELLED';
  createdAt: string; updatedAt: string; applied?: { placeId: string; dateOptionId?: string; actorId: string; appliedAt: string; acknowledgedMissingMemberIds: string[] };
}
export interface DecisionCandidateComparison {
  placeId: string; availableCount: number; blockedCount: number; preferredCount: number; allAvailable: boolean; sourceAvailable: boolean;
  referenceCostKrw?: number; withinBudgetCount: number; overBudgetCount: number; unknownBudgetCount: number;
  distance: { knownOriginCount: number; unknownOriginCount: number; minKm?: number; maxKm?: number; meanKm?: number; spreadKm?: number };
}
export interface DecisionComparison {
  key: string; responseCount: number; expectedMemberCount: number; missingMemberIds: string[]; membershipChanged: boolean;
  rows: DecisionCandidateComparison[]; dates: Array<DecisionDateOption & { availableCount: number; blockedCount: number; allAvailable: boolean }>;
  budgetKnownCount: number; budgetMinKrw?: number; budgetMaxKrw?: number;
}
export interface DecisionSelection { placeId: string; dateOptionId?: string; acknowledgeMissing: boolean }
export interface DecisionApplicationPreview extends DecisionScope {
  decisionId: string; actorId: string; key: string; selection: DecisionSelection;
  before: { venueLabel: string; dateLabel: string }; after: { venueLabel: string; dateLabel: string }; notes: string[];
}
