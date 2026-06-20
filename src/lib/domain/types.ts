/**
 * Flat domain records used throughout Stashy.
 *
 * The `&` operator composes small type fragments into one flat object. It does
 * not create a parent/child class relationship, and it does not add nested
 * objects to the stored data.
 */
import type {
	AccountId,
	AccountRecordId,
	AppSettingsId,
	AuditEntryId,
	IsoTimestamp,
	PaymentRecordId,
	SessionId,
	SitDownDate
} from './identity';
import type { Money } from './money';

/** Creation and last-edit timestamps shared by persisted records. */
export type RecordTimestamps = {
	readonly createdAt: IsoTimestamp;
	readonly updatedAt: IsoTimestamp;
};

/** The two balance boundaries used to color an asset account. */
export type AssetThresholds = {
	readonly warningBelow: Money;
	readonly dangerBelow: Money;
};

/**
 * How an asset obtains its thresholds: app defaults, account-specific values,
 * or no threshold coloring.
 */
export type AssetThresholdPolicy =
	| { readonly mode: 'inherit' }
	| { readonly mode: 'custom'; readonly thresholds: AssetThresholds }
	| { readonly mode: 'off' };

/** Application-wide settings for the first persisted schema. */
export type AppSettings = RecordTimestamps & {
	readonly id: AppSettingsId;
	readonly schemaVersion: 1;
	readonly currency: 'USD';
	readonly defaultAssetThresholds: AssetThresholds | null;
	readonly lastImportedAt: IsoTimestamp | null;
	readonly lastExportedAt: IsoTimestamp | null;
};

type AccountDetails = RecordTimestamps & {
	readonly id: AccountId;
	readonly name: string;
	readonly archived: boolean;
};

/** An account that can fund liability payments. */
export type AssetAccount = AccountDetails & {
	readonly type: 'asset';
	readonly thresholdPolicy: AssetThresholdPolicy;
};

/** An account whose balance can be paid down. */
export type LiabilityAccount = AccountDetails & {
	readonly type: 'liability';
};

/**
 * The `type` field is the discriminator: checking `account.type` lets
 * TypeScript safely reveal the fields for the matching account kind.
 */
export type Account = AssetAccount | LiabilityAccount;

/** A single payment-planning sit-down. Child records reference this ID. */
export type Session = RecordTimestamps & {
	readonly id: SessionId;
	readonly sitDownDate: SitDownDate;
	readonly isDraft: boolean;
};

/** The rule used to resolve a liability's payment amount. */
export type PaymentMode = 'full-balance' | 'statement-balance' | 'custom';

type PaymentRecordDetails = RecordTimestamps & {
	readonly id: PaymentRecordId;
	readonly sessionId: SessionId;
	readonly liabilityAccountId: AccountId;
	readonly confirmationId: string | null;
	readonly notes: string | null;
};

/**
 * An in-progress payment row. Optional fields may be absent while the session
 * is still being drafted.
 */
export type DraftPaymentRecord = PaymentRecordDetails & {
	readonly sourceAssetAccountId?: AccountId;
	readonly paymentMode?: PaymentMode;
	readonly customPaymentAmount?: Money;
	readonly startingAccountBalance?: Money;
	readonly startingStatementBalance?: Money;
};

/** A complete payment row with all resolved and remaining balances saved. */
export type PaymentRecord = PaymentRecordDetails & {
	readonly sourceAssetAccountId: AccountId;
	readonly paymentMode: PaymentMode;
	readonly paymentAmount: Money;
	readonly startingAccountBalance: Money;
	readonly startingStatementBalance: Money;
	readonly remainingAccountBalance: Money;
	readonly remainingStatementBalance: Money;
};

type AccountRecordDetails = RecordTimestamps & {
	readonly id: AccountRecordId;
	readonly sessionId: SessionId;
	readonly accountId: AccountId;
};

/** An account snapshot that may still be missing balances in a draft. */
export type DraftAccountRecord = AccountRecordDetails & {
	readonly openingBalance?: Money;
	readonly finalBalance?: Money;
	readonly openingStatementBalance?: Money | null;
	readonly finalStatementBalance?: Money | null;
};

/** The saved opening and final snapshot for one account in one session. */
export type AccountRecord = AccountRecordDetails & {
	readonly openingBalance: Money;
	readonly finalBalance: Money;
	readonly openingStatementBalance: Money | null;
	readonly finalStatementBalance: Money | null;
};

type AuditEntryDetails = RecordTimestamps & {
	readonly id: AuditEntryId;
	readonly notes: string | null;
};

/** Before-and-after snapshots for a session edit. */
export type SessionAuditEntry = AuditEntryDetails & {
	readonly entityType: 'session';
	readonly entityId: SessionId;
	readonly before: Session;
	readonly after: Session;
};

/** Before-and-after snapshots for an account-record edit. */
export type AccountRecordAuditEntry = AuditEntryDetails & {
	readonly entityType: 'account-record';
	readonly entityId: AccountRecordId;
	readonly before: AccountRecord;
	readonly after: AccountRecord;
};

/** Before-and-after snapshots for a payment-record edit. */
export type PaymentRecordAuditEntry = AuditEntryDetails & {
	readonly entityType: 'payment-record';
	readonly entityId: PaymentRecordId;
	readonly before: PaymentRecord;
	readonly after: PaymentRecord;
};

/** Every edit type that can appear in the audit trail. */
export type AuditEntry = SessionAuditEntry | AccountRecordAuditEntry | PaymentRecordAuditEntry;
