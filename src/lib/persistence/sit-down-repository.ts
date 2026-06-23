import type {
	AccountRecord,
	AuditEntry,
	DraftAccountRecord,
	DraftPaymentRecord,
	PaymentRecord,
	Session,
	SessionId
} from '$lib/domain';

/** One normalized unfinished sit-down and all of its flat child records. */
export type SitDownDraftSnapshot = {
	readonly session: Session & { readonly isDraft: true };
	readonly accountRecords: readonly DraftAccountRecord[];
	readonly paymentRecords: readonly DraftPaymentRecord[];
};

/** One completed sit-down and all resolved child snapshots. */
export type StoodUpSitDownSnapshot = {
	readonly session: Session & { readonly isDraft: false };
	readonly accountRecords: readonly AccountRecord[];
	readonly paymentRecords: readonly PaymentRecord[];
};

export type SitDownSnapshot = SitDownDraftSnapshot | StoodUpSitDownSnapshot;

export type StoodUpCorrectionResult = {
	readonly snapshot: StoodUpSitDownSnapshot;
	readonly auditEntries: readonly AuditEntry[];
};

export type SitDownRepositoryErrorCode =
	| 'storage-unavailable'
	| 'storage-failed'
	| 'corrupt-data'
	| 'invalid-session';

export class SitDownRepositoryError extends Error {
	readonly code: SitDownRepositoryErrorCode;

	constructor(code: SitDownRepositoryErrorCode, message: string) {
		super(message);
		this.name = 'SitDownRepositoryError';
		this.code = code;
	}
}

export interface SitDownRepository {
	listSessions(): Promise<readonly SitDownSnapshot[]>;
	loadSession(sessionId: SessionId): Promise<SitDownSnapshot | null>;
	loadLatestSession(): Promise<SitDownSnapshot | null>;
	saveDraft(snapshot: SitDownDraftSnapshot): Promise<SitDownDraftSnapshot>;
	standUp(snapshot: StoodUpSitDownSnapshot): Promise<StoodUpSitDownSnapshot>;
	saveStoodUpCorrection(snapshot: StoodUpSitDownSnapshot): Promise<StoodUpCorrectionResult>;
	discardDraft(sessionId: SessionId): Promise<void>;
}
