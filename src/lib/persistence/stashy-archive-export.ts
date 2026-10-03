import { strToU8, zipSync, type Zippable } from 'fflate';
import { isoTimestampFromString, type Account, type Session } from '$lib/domain';
import {
	STASHY_APP_NAME,
	STASHY_ARCHIVE_FORMAT,
	STASHY_ARCHIVE_FORMAT_VERSION,
	STASHY_ARCHIVE_PATHS,
	STASHY_ARCHIVE_README,
	STASHY_MILESTONE
} from './stashy-archive-constants';
import { STASHY_DATABASE_NAME, STASHY_DATABASE_VERSION } from './schema';
import type {
	StashyArchiveCounts,
	StashyArchiveData,
	StashyArchiveExport,
	StashyArchiveExportInfo,
	StashyArchiveManifest
} from './stashy-archive-types';

function jsonFile(value: unknown): Uint8Array {
	return strToU8(`${JSON.stringify(value, null, 2)}\n`);
}

function slug(value: string): string {
	const result = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
	return result || 'account';
}

function fileSafeTimestamp(value: string): string {
	return value.replace(/[:.]/g, '-');
}

function compareAccounts(left: Account, right: Account): number {
	return (
		left.type.localeCompare(right.type) ||
		left.sortOrder - right.sortOrder ||
		left.id.localeCompare(right.id)
	);
}

function compareSessions(left: Session, right: Session): number {
	return left.sitDownDate.localeCompare(right.sitDownDate) || left.id.localeCompare(right.id);
}

export function countStashyArchiveData(data: StashyArchiveData): StashyArchiveCounts {
	return {
		settings: 1,
		accounts: data.accounts.length,
		archivedAccounts: data.accounts.filter((account) => account.archived).length,
		sessions: data.sessions.length,
		drafts: data.sessions.filter((session) => session.isDraft).length,
		accountRecords: data.accountRecords.length,
		paymentRecords: data.paymentRecords.length,
		auditEntries: data.auditEntries.length
	};
}

export function createStashyArchive(
	data: StashyArchiveData,
	options: { readonly appVersion: string; readonly now?: Date }
): StashyArchiveExport {
	const exportedAt = isoTimestampFromString((options.now ?? new Date()).toISOString());
	const counts = countStashyArchiveData(data);
	const manifest: StashyArchiveManifest = {
		format: STASHY_ARCHIVE_FORMAT,
		formatVersion: STASHY_ARCHIVE_FORMAT_VERSION,
		app: { name: STASHY_APP_NAME, version: options.appVersion, milestone: STASHY_MILESTONE },
		database: { name: STASHY_DATABASE_NAME, schemaVersion: STASHY_DATABASE_VERSION },
		exportedAt,
		encrypted: false,
		counts
	};
	const exportInfo: StashyArchiveExportInfo = {
		title: 'Stashy full local backup',
		exportedAt,
		appVersion: options.appVersion,
		replacementMode: 'full-restore',
		encrypted: false,
		description: 'Complete local Stashy data. Restore replaces current local data.'
	};
	const files: Zippable = {
		[STASHY_ARCHIVE_PATHS.manifest]: jsonFile(manifest),
		[STASHY_ARCHIVE_PATHS.exportInfo]: jsonFile(exportInfo),
		[STASHY_ARCHIVE_PATHS.settings]: jsonFile(data.settings),
		[STASHY_ARCHIVE_PATHS.readme]: strToU8(STASHY_ARCHIVE_README),
		[STASHY_ARCHIVE_PATHS.accounts]: new Uint8Array(),
		[STASHY_ARCHIVE_PATHS.sessions]: new Uint8Array(),
		[STASHY_ARCHIVE_PATHS.audits]: new Uint8Array()
	};

	for (const [index, account] of [...data.accounts].sort(compareAccounts).entries()) {
		const position = String(index + 1).padStart(3, '0');
		files[
			`${STASHY_ARCHIVE_PATHS.accounts}${position}_${account.type}_${slug(account.name)}_${account.id}.json`
		] = jsonFile(account);
	}
	for (const session of [...data.sessions].sort(compareSessions)) {
		const root = `${STASHY_ARCHIVE_PATHS.sessions}${session.sitDownDate}_${session.id}/`;
		files[root] = new Uint8Array();
		files[`${root}session.json`] = jsonFile(session);
		files[`${root}account-records/`] = new Uint8Array();
		files[`${root}payment-records/`] = new Uint8Array();
		for (const record of data.accountRecords.filter((item) => item.sessionId === session.id)) {
			files[`${root}account-records/${record.id}.json`] = jsonFile(record);
		}
		for (const record of data.paymentRecords.filter((item) => item.sessionId === session.id)) {
			files[`${root}payment-records/${record.id}.json`] = jsonFile(record);
		}
	}
	for (const audit of data.auditEntries) {
		files[`${STASHY_ARCHIVE_PATHS.audits}${fileSafeTimestamp(audit.updatedAt)}_${audit.id}.json`] =
			jsonFile(audit);
	}

	return {
		bytes: zipSync(files, { level: 6 }),
		filename: `stashy-backup-${exportedAt.slice(0, 10)}.stashy`,
		manifest
	};
}
