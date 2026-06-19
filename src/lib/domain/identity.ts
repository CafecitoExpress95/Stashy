declare const entityIdBrand: unique symbol;
declare const isoTimestampBrand: unique symbol;
declare const sitDownDateBrand: unique symbol;

export type EntityId<Kind extends string> = string & {
	readonly [entityIdBrand]: Kind;
};

export type AppSettingsId = EntityId<'AppSettings'>;
export type AccountId = EntityId<'Account'>;
export type SessionId = EntityId<'Session'>;
export type PaymentRecordId = EntityId<'PaymentRecord'>;
export type AccountRecordId = EntityId<'AccountRecord'>;
export type AuditEntryId = EntityId<'AuditEntry'>;

export type IsoTimestamp = string & {
	readonly [isoTimestampBrand]: true;
};

export type SitDownDate = string & {
	readonly [sitDownDateBrand]: true;
};

export class IdentityFormatError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'IdentityFormatError';
	}
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UTC_ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SIT_DOWN_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function entityIdFromString<Kind extends string>(value: string, label: string): EntityId<Kind> {
	if (!UUID_PATTERN.test(value)) {
		throw new IdentityFormatError(`${label} must be a UUID.`);
	}

	return value as EntityId<Kind>;
}

export function appSettingsIdFromString(value: string): AppSettingsId {
	return entityIdFromString(value, 'App settings ID');
}

export function accountIdFromString(value: string): AccountId {
	return entityIdFromString(value, 'Account ID');
}

export function sessionIdFromString(value: string): SessionId {
	return entityIdFromString(value, 'Session ID');
}

export function paymentRecordIdFromString(value: string): PaymentRecordId {
	return entityIdFromString(value, 'Payment record ID');
}

export function accountRecordIdFromString(value: string): AccountRecordId {
	return entityIdFromString(value, 'Account record ID');
}

export function auditEntryIdFromString(value: string): AuditEntryId {
	return entityIdFromString(value, 'Audit entry ID');
}

export function isoTimestampFromString(value: string): IsoTimestamp {
	if (!UTC_ISO_TIMESTAMP_PATTERN.test(value)) {
		throw new IdentityFormatError('Timestamp must be an ISO-8601 UTC value with milliseconds.');
	}

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
		throw new IdentityFormatError('Timestamp must identify a real UTC instant.');
	}

	return value as IsoTimestamp;
}

export function sitDownDateFromString(value: string): SitDownDate {
	if (!SIT_DOWN_DATE_PATTERN.test(value)) {
		throw new IdentityFormatError('Sit-down date must use YYYY-MM-DD.');
	}

	const parsed = new Date(`${value}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
		throw new IdentityFormatError('Sit-down date must identify a real calendar date.');
	}

	return value as SitDownDate;
}
