export type ChallengeTemplate = 'WALK' | 'READING' | 'FOOD' | 'TRAVEL_PHOTO' | 'CUSTOM';
export interface ChallengeScope { groupId: string; activityId?: string }
export interface ChallengePhoto { name: string; mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; size: number; dataUrl: string }
export interface ChallengeCertification { id: string; userId: string; date: string; text: string; photo?: ChallengePhoto; createdAt: string }
export interface TogetherChallenge extends ChallengeScope {
  id: string; template: ChallengeTemplate; title: string; description: string; startDate: string; endDate: string;
  frequency: 'WEEKLY'; weeklyTarget: number; participantIds: string[]; certifications: ChallengeCertification[];
  closed: boolean; createdBy: string; createdAt: string; closedAt?: string; revision: number;
}
export interface ChallengeCreateInput {
  id: string; template: ChallengeTemplate; title: string; description: string; startDate: string; endDate: string;
  frequency: 'WEEKLY'; weeklyTarget: number;
}
export interface ChallengeCertifyInput { text: string; photo?: ChallengePhoto }
