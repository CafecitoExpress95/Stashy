import type {
	Account,
	AccountRecord,
	AppSettings,
	AuditEntry,
	DraftAccountRecord,
	DraftPaymentRecord,
	IsoTimestamp,
	PaymentRecord,
	Session
} from '$lib/domain';

export type StashyArchiveCounts = {
	readonly settings: 1;
	readonly accounts: number;
	readonly archivedAccounts: number;
	readonly sessions: number;
	readonly drafts: number;
	readonly accountRecords: number;
	readonly paymentRecords: number;
	readonly auditEntries: number;
};

export type StashyArchiveManifest = {
	readonly format: 'stashy-backup';
	readonly formatVersion: 1;
	readonly app: {
		readonly name: 'Stashy';
		readonly version: string;
		readonly milestone: 'MS-01';
	};
	readonly database: {
		readonly name: 'stashy';
		readonly schemaVersion: number;
	};
	readonly exportedAt: IsoTimestamp;
	readonly encrypted: false;
	readonly counts: StashyArchiveCounts;
};

export type StashyArchiveExportInfo = {
	readonly title: 'Stashy full local backup';
	readonly exportedAt: IsoTimestamp;
	readonly appVersion: string;
	readonly replacementMode: 'full-restore';
	readonly encrypted: false;
	readonly description: string;
};

export type StashyArchiveData = {
	readonly settings: AppSettings;
	readonly accounts: readonly Account[];
	readonly sessions: readonly Session[];
	readonly accountRecords: readonly (DraftAccountRecord | AccountRecord)[];
	readonly paymentRecords: readonly (DraftPaymentRecord | PaymentRecord)[];
	readonly auditEntries: readonly AuditEntry[];
};

export type StashyArchiveExport = {
	readonly bytes: Uint8Array;
	readonly filename: string;
	readonly manifest: StashyArchiveManifest;
};

export type StashyArchiveImport = {
	readonly manifest: StashyArchiveManifest;
	readonly exportInfo: StashyArchiveExportInfo;
	readonly data: StashyArchiveData;
};

export type StashyArchiveValidationResult =
	| { readonly ok: true; readonly archive: StashyArchiveImport }
	| { readonly ok: false; readonly errors: readonly string[] };
