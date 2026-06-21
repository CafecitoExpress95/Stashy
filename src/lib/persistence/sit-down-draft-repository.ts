import type { DraftAccountRecord, DraftPaymentRecord, Session } from '$lib/domain';

/** One normalized unfinished sit-down and all of its flat child records. */
export type SitDownDraftSnapshot = {
	readonly session: Session;
	readonly accountRecords: readonly DraftAccountRecord[];
	readonly paymentRecords: readonly DraftPaymentRecord[];
};

export type SitDownDraftRepositoryErrorCode =
	| 'storage-unavailable'
	| 'storage-failed'
	| 'corrupt-data'
	| 'invalid-draft';

export class SitDownDraftRepositoryError extends Error {
	readonly code: SitDownDraftRepositoryErrorCode;

	constructor(code: SitDownDraftRepositoryErrorCode, message: string) {
		super(message);
		this.name = 'SitDownDraftRepositoryError';
		this.code = code;
	}
}

export interface SitDownDraftRepository {
	loadLatestDraft(): Promise<SitDownDraftSnapshot | null>;
	saveDraft(snapshot: SitDownDraftSnapshot): Promise<SitDownDraftSnapshot>;
}
