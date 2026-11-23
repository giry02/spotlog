import { configuredPlanningAiEndpoint } from './planningAiService';

export const planningAiAvailable = Boolean(configuredPlanningAiEndpoint(import.meta.env.VITE_PLANNING_AI_ENDPOINT));
export const placeSearchActionLabel = planningAiAvailable ? 'AI로 장소 찾기' : '조건으로 장소 찾기';
