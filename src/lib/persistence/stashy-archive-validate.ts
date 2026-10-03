import { strFromU8, unzipSync } from 'fflate';
import { isoTimestampFromString, type Account, type AuditEntry } from '$lib/domain';
import {
	parseStoredAccountRecord,
	parseStoredAccounts,
	parseStoredAppSettings,
	parseStoredAuditEntry,
	parseStoredDraftAccountRecord,
	parseStoredDraftPaymentRecord,
	parseStoredPaymentRecord,
	parseStoredSession
} from './records';
import { getSessionRelationshipIssues } from './session-relationships';
import {
	STASHY_APP_NAME,
	STASHY_ARCHIVE_FORMAT,
	STASHY_ARCHIVE_FORMAT_VERSION,
	STASHY_ARCHIVE_PATHS,
	STASHY_MILESTONE
} from './stashy-archive-constants';
import { STASHY_DATABASE_NAME, STASHY_DATABASE_VERSION } from './schema';
import { countStashyArchiveData } from './stashy-archive-export';
import type {
	StashyArchiveCounts,
	StashyArchiveData,
	StashyArchiveExportInfo,
	StashyArchiveImport,
	StashyArchiveManifest,
	StashyArchiveValidationResult
} from './stashy-archive-types';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJson(files: Record<string, Uint8Array>, path: string): unknown {
	const bytes = files[path];
	if (!bytes) throw new Error(`${path} is missing.`);
	try {
		return JSON.parse(strFromU8(bytes));
	} catch {
		throw new Error(`${path} does not contain valid JSON.`);
	}
}

function readNonnegativeInteger(value: unknown, label: string): number {
	if (!Number.isSafeInteger(value) || (value as number) < 0) {
		throw new Error(`${label} must be a nonnegative integer.`);
	}
	return value as number;
}

function readCounts(value: unknown): StashyArchiveCounts {
	if (!isRecord(value)) throw new Error('manifest.json counts are invalid.');
	if (value.settings !== 1) throw new Error('manifest.json must describe one settings record.');
	return {
		settings: 1,
		accounts: readNonnegativeInteger(value.accounts, 'Account count'),
		archivedAccounts: readNonnegativeInteger(value.archivedAccounts, 'Archived account count'),
		sessions: readNonnegativeInteger(value.sessions, 'Session count'),
		drafts: readNonnegativeInteger(value.drafts, 'Draft count'),
		accountRecords: readNonnegativeInteger(value.accountRecords, 'Account-record count'),
		paymentRecords: readNonnegativeInteger(value.paymentRecords, 'Payment-record count'),
		auditEntries: readNonnegativeInteger(value.auditEntries, 'Audit-entry count')
	};
}

function readManifest(value: unknown): StashyArchiveManifest {
	if (!isRecord(value)) throw new Error('manifest.json must contain an object.');
	if (value.format !== STASHY_ARCHIVE_FORMAT) throw new Error('This is not a Stashy backup.');
	if (typeof value.formatVersion !== 'number') throw new Error('Backup format version is missing.');
	if (value.formatVersion > STASHY_ARCHIVE_FORMAT_VERSION) {
		throw new Error('This backup was created by a newer Stashy archive format.');
	}
	if (value.formatVersion !== STASHY_ARCHIVE_FORMAT_VERSION) {
		throw new Error('This Stashy backup format is not supported.');
	}
	if (
		!isRecord(value.app) ||
		value.app.name !== STASHY_APP_NAME ||
		value.app.milestone !== STASHY_MILESTONE
	) {
		throw new Error('Backup app metadata is invalid.');
	}
	if (typeof value.app.version !== 'string' || !value.app.version.trim()) {
		throw new Error('Backup app version is invalid.');
	}
	if (!isRecord(value.database) || value.database.name !== STASHY_DATABASE_NAME) {
		throw new Error('Backup database metadata is invalid.');
	}
	if (typeof value.database.schemaVersion !== 'number') {
		throw new Error('Backup database schema version is missing.');
	}
	if (value.database.schemaVersion > STASHY_DATABASE_VERSION) {
		throw new Error('This backup uses a newer Stashy database schema.');
	}
	if (value.database.schemaVersion !== STASHY_DATABASE_VERSION) {
		throw new Error('This backup database schema is not supported.');
	}
	if (value.encrypted !== false) throw new Error('Encrypted backups are not supported in MS-01.');
	let exportedAt;
	try {
		exportedAt = isoTimestampFromString(String(value.exportedAt));
	} catch {
		throw new Error('Backup export timestamp is invalid.');
	}
	return {
		format: STASHY_ARCHIVE_FORMAT,
		formatVersion: STASHY_ARCHIVE_FORMAT_VERSION,
		app: { name: STASHY_APP_NAME, version: value.app.version, milestone: STASHY_MILESTONE },
		database: { name: STASHY_DATABASE_NAME, schemaVersion: STASHY_DATABASE_VERSION },
		exportedAt,
		encrypted: false,
		counts: readCounts(value.counts)
	};
}

function readExportInfo(value: unknown, manifest: StashyArchiveManifest): StashyArchiveExportInfo {
	if (
		!isRecord(value) ||
		value.title !== 'Stashy full local backup' ||
		value.exportedAt !== manifest.exportedAt ||
		value.appVersion !== manifest.app.version ||
		value.replacementMode !== 'full-restore' ||
		value.encrypted !== false ||
		typeof value.description !== 'string'
	) {
		throw new Error('metadata/export-info.json does not match the backup manifest.');
	}
	return {
		title: 'Stashy full local backup',
		exportedAt: manifest.exportedAt,
		appVersion: manifest.app.version,
		replacementMode: 'full-restore',
		encrypted: false,
		description: value.description
	};
}

function assertUniqueIds(values: readonly { readonly id: string }[], label: string): void {
	const ids = new Set<string>();
	for (const value of values) {
		if (ids.has(value.id)) throw new Error(`Backup contains duplicate ${label} IDs.`);
		ids.add(value.id);
	}
}

function assertCounts(actual: StashyArchiveCounts, expected: StashyArchiveCounts): void {
	for (const key of Object.keys(actual) as Array<keyof StashyArchiveCounts>) {
		if (actual[key] !== expected[key]) {
			throw new Error(`manifest.json ${key} count does not match the archive contents.`);
		}
	}
}

function assertRecordReferences(
	record: { readonly sessionId: string; readonly accountId: string },
	accountIds: ReadonlySet<string>,
	sessionIds: ReadonlySet<string>,
	label: string
): void {
	if (!sessionIds.has(record.sessionId)) throw new Error(`${label} references a missing session.`);
	if (!accountIds.has(record.accountId)) throw new Error(`${label} references a missing account.`);
}

function assertPaymentReferences(
	record: {
		readonly sessionId: string;
		readonly liabilityAccountId: string;
		readonly sourceAssetAccountId?: string;
	},
	accountsById: ReadonlyMap<string, Account>,
	sessionIds: ReadonlySet<string>,
	label: string
): void {
	if (!sessionIds.has(record.sessionId)) throw new Error(`${label} references a missing session.`);
	if (accountsById.get(record.liabilityAccountId)?.type !== 'liability') {
		throw new Error(`${label} liability does not reference a liability account.`);
	}
	if (
		record.sourceAssetAccountId !== undefined &&
		accountsById.get(record.sourceAssetAccountId)?.type !== 'asset'
	) {
		throw new Error(`${label} source does not reference an asset account.`);
	}
}

function assertAuditReferences(
	audit: AuditEntry,
	accountsById: ReadonlyMap<string, Account>,
	sessionIds: ReadonlySet<string>,
	accountRecordIds: ReadonlySet<string>,
	paymentRecordIds: ReadonlySet<string>
): void {
	if (audit.entityType === 'session') {
		if (!sessionIds.has(audit.entityId))
			throw new Error('Audit entry references a missing session.');
		return;
	}
	if (audit.entityType === 'account-record') {
		if (!accountRecordIds.has(audit.entityId)) {
			throw new Error('Audit entry references a missing account record.');
		}
		assertRecordReferences(
			audit.before,
			new Set(accountsById.keys()),
			sessionIds,
			'Audit snapshot'
		);
		assertRecordReferences(audit.after, new Set(accountsById.keys()), sessionIds, 'Audit snapshot');
		return;
	}
	if (!paymentRecordIds.has(audit.entityId)) {
		throw new Error('Audit entry references a missing payment record.');
	}
	assertPaymentReferences(audit.before, accountsById, sessionIds, 'Audit snapshot');
	assertPaymentReferences(audit.after, accountsById, sessionIds, 'Audit snapshot');
}

function parseArchive(files: Record<string, Uint8Array>): StashyArchiveImport {
	const paths = Object.keys(files);
	for (const path of paths) {
		if (path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')) {
			throw new Error('Backup contains an unsafe archive path.');
		}
	}
	for (const folder of [
		STASHY_ARCHIVE_PATHS.accounts,
		STASHY_ARCHIVE_PATHS.sessions,
		STASHY_ARCHIVE_PATHS.audits
	]) {
		if (!paths.some((path) => path.startsWith(folder))) throw new Error(`${folder} is missing.`);
	}
	const manifest = readManifest(parseJson(files, STASHY_ARCHIVE_PATHS.manifest));
	const exportInfo = readExportInfo(parseJson(files, STASHY_ARCHIVE_PATHS.exportInfo), manifest);
	const settings = parseStoredAppSettings(parseJson(files, STASHY_ARCHIVE_PATHS.settings));
	if (!files[STASHY_ARCHIVE_PATHS.readme]) throw new Error('README.txt is missing.');

	const accountPaths = paths.filter((path) => /^accounts\/[^/]+\.json$/.test(path));
	const accounts = parseStoredAccounts(accountPaths.map((path) => parseJson(files, path)));
	const sessionPaths = paths.filter((path) => /^sessions\/[^/]+\/session\.json$/.test(path));
	const sessions = sessionPaths.map((path) => parseStoredSession(parseJson(files, path)));
	assertUniqueIds(accounts, 'account');
	assertUniqueIds(sessions, 'session');

	const accountRecords: Array<StashyArchiveData['accountRecords'][number]> = [];
	const paymentRecords: Array<StashyArchiveData['paymentRecords'][number]> = [];
	for (const session of sessions) {
		const root = `${STASHY_ARCHIVE_PATHS.sessions}${session.sitDownDate}_${session.id}/`;
		if (!files[`${root}session.json`]) {
			throw new Error(`Session ${session.id} is stored in the wrong archive folder.`);
		}
		const rawAccounts = paths
			.filter((path) => path.startsWith(`${root}account-records/`) && path.endsWith('.json'))
			.map((path) => parseJson(files, path));
		const rawPayments = paths
			.filter((path) => path.startsWith(`${root}payment-records/`) && path.endsWith('.json'))
			.map((path) => parseJson(files, path));
		if (session.isDraft) {
			const sessionAccounts = rawAccounts.map(parseStoredDraftAccountRecord);
			const sessionPayments = rawPayments.map(parseStoredDraftPaymentRecord);
			const [issue] = getSessionRelationshipIssues(
				{
					session: { ...session, isDraft: true },
					accountRecords: sessionAccounts,
					paymentRecords: sessionPayments
				},
				true
			);
			if (issue) throw new Error(`Session ${session.id}: ${issue}`);
			accountRecords.push(...sessionAccounts);
			paymentRecords.push(...sessionPayments);
		} else {
			const sessionAccounts = rawAccounts.map(parseStoredAccountRecord);
			const sessionPayments = rawPayments.map(parseStoredPaymentRecord);
			const [issue] = getSessionRelationshipIssues(
				{
					session: { ...session, isDraft: false },
					accountRecords: sessionAccounts,
					paymentRecords: sessionPayments
				},
				false
			);
			if (issue) throw new Error(`Session ${session.id}: ${issue}`);
			accountRecords.push(...sessionAccounts);
			paymentRecords.push(...sessionPayments);
		}
	}

	const auditPaths = paths.filter((path) => /^audit-entries\/[^/]+\.json$/.test(path));
	const auditEntries = auditPaths.map((path) => parseStoredAuditEntry(parseJson(files, path)));
	assertUniqueIds(accountRecords, 'account-record');
	assertUniqueIds(paymentRecords, 'payment-record');
	assertUniqueIds(auditEntries, 'audit-entry');

	const knownFiles = new Set([
		STASHY_ARCHIVE_PATHS.manifest,
		STASHY_ARCHIVE_PATHS.exportInfo,
		STASHY_ARCHIVE_PATHS.settings,
		STASHY_ARCHIVE_PATHS.readme,
		...accountPaths,
		...sessionPaths,
		...auditPaths
	]);
	for (const path of paths) {
		if (path.endsWith('/')) continue;
		if (/^sessions\/[^/]+\/(account-records|payment-records)\/[^/]+\.json$/.test(path)) continue;
		if (!knownFiles.has(path)) throw new Error(`Backup contains an unexpected file: ${path}.`);
	}

	const accountsById = new Map(accounts.map((account) => [account.id, account]));
	const accountIds = new Set(accountsById.keys());
	const sessionIds = new Set(sessions.map((session) => session.id));
	for (const record of accountRecords) {
		assertRecordReferences(record, accountIds, sessionIds, 'Account record');
	}
	for (const record of paymentRecords) {
		assertPaymentReferences(record, accountsById, sessionIds, 'Payment record');
	}
	const accountRecordIds = new Set(accountRecords.map((record) => record.id));
	const paymentRecordIds = new Set(paymentRecords.map((record) => record.id));
	for (const audit of auditEntries) {
		assertAuditReferences(audit, accountsById, sessionIds, accountRecordIds, paymentRecordIds);
	}

	const data = { settings, accounts, sessions, accountRecords, paymentRecords, auditEntries };
	assertCounts(manifest.counts, countStashyArchiveData(data));
	return { manifest, exportInfo, data };
}

export function validateStashyArchive(bytes: Uint8Array): StashyArchiveValidationResult {
	try {
		return { ok: true, archive: parseArchive(unzipSync(bytes)) };
	} catch (error) {
		return {
			ok: false,
			errors: [
				error instanceof Error ? error.message : 'The selected file is not a valid Stashy backup.'
			]
		};
	}
}
