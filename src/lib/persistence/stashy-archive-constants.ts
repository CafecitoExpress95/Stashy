export const STASHY_ARCHIVE_FORMAT = 'stashy-backup';
export const STASHY_ARCHIVE_FORMAT_VERSION = 1;
export const STASHY_ARCHIVE_EXTENSION = '.stashy';
export const STASHY_ARCHIVE_MIME_TYPE = 'application/zip';
export const STASHY_APP_NAME = 'Stashy';
export const STASHY_MILESTONE = 'MS-01';

export const STASHY_ARCHIVE_PATHS = {
	manifest: 'manifest.json',
	exportInfo: 'metadata/export-info.json',
	settings: 'settings/app-settings.json',
	readme: 'README.txt',
	accounts: 'accounts/',
	sessions: 'sessions/',
	audits: 'audit-entries/'
} as const;

export const STASHY_ARCHIVE_README = `Stashy full local backup

This ZIP-compatible .stashy archive contains a complete local Stashy backup.
Its versioned manifest and individual JSON files preserve settings, accounts,
sit-down sessions, account snapshots, payment records, and audit history.

Restore it from Configuration > Save & Restore. Restoring replaces all current
local Stashy data; it does not merge records. Keep an unmodified copy somewhere
outside your browser's download folder.
`;
