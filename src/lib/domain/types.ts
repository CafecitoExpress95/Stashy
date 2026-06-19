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

export interface Timestamped {
	readonly createdAt: IsoTimestamp;
	readonly updatedAt: IsoTimestamp;
}

export interface AssetThresholds {
	readonly warningBelow: Money;
	readonly dangerBelow: Money;
}

export type AssetThresholdPolicy =
	| { readonly mode: 'inherit' }
	| { readonly mode: 'custom'; readonly thresholds: AssetThresholds }
	| { readonly mode: 'off' };

export interface AppSettings extends Timestamped {
	readonly id: AppSettingsId;
	readonly schemaVersion: 1;
	readonly currency: 'USD';
	readonly defaultAssetThresholds: AssetThresholds | null;
	readonly lastImportedAt: IsoTimestamp | null;
	readonly lastExportedAt: IsoTimestamp | null;
}

interface BaseAccount extends Timestamped {
	readonly id: AccountId;
	readonly name: string;
	readonly archived: boolean;
}

export interface AssetAccount extends BaseAccount {
	readonly type: 'asset';
	readonly thresholdPolicy: AssetThresholdPolicy;
}

export interface LiabilityAccount extends BaseAccount {
	readonly type: 'liability';
}

export type Account = AssetAccount | LiabilityAccount;

export interface Session extends Timestamped {
	readonly id: SessionId;
	readonly sitDownDate: SitDownDate;
	readonly isDraft: boolean;
}

export type PaymentMode = 'full-balance' | 'statement-balance' | 'custom';

export interface DraftPaymentRecord extends Timestamped {
	readonly id: PaymentRecordId;
	readonly sessionId: SessionId;
	readonly liabilityAccountId: AccountId;
	readonly sourceAssetAccountId?: AccountId;
	readonly paymentMode?: PaymentMode;
	readonly customPaymentAmount?: Money;
	readonly startingAccountBalance?: Money;
	readonly startingStatementBalance?: Money;
	readonly confirmationId: string | null;
	readonly notes: string | null;
}

export interface PaymentRecord extends Timestamped {
	readonly id: PaymentRecordId;
	readonly sessionId: SessionId;
	readonly liabilityAccountId: AccountId;
	readonly sourceAssetAccountId: AccountId;
	readonly paymentMode: PaymentMode;
	readonly paymentAmount: Money;
	readonly startingAccountBalance: Money;
	readonly startingStatementBalance: Money;
	readonly remainingAccountBalance: Money;
	readonly remainingStatementBalance: Money;
	readonly confirmationId: string | null;
	readonly notes: string | null;
}

export interface DraftAccountRecord extends Timestamped {
	readonly id: AccountRecordId;
	readonly sessionId: SessionId;
	readonly accountId: AccountId;
	readonly openingBalance?: Money;
	readonly finalBalance?: Money;
	readonly openingStatementBalance?: Money | null;
	readonly finalStatementBalance?: Money | null;
}

export interface AccountRecord extends Timestamped {
	readonly id: AccountRecordId;
	readonly sessionId: SessionId;
	readonly accountId: AccountId;
	readonly openingBalance: Money;
	readonly finalBalance: Money;
	readonly openingStatementBalance: Money | null;
	readonly finalStatementBalance: Money | null;
}

interface BaseAuditEntry extends Timestamped {
	readonly id: AuditEntryId;
	readonly notes: string | null;
}

export interface SessionAuditEntry extends BaseAuditEntry {
	readonly entityType: 'session';
	readonly entityId: SessionId;
	readonly before: Session;
	readonly after: Session;
}

export interface AccountRecordAuditEntry extends BaseAuditEntry {
	readonly entityType: 'account-record';
	readonly entityId: AccountRecordId;
	readonly before: AccountRecord;
	readonly after: AccountRecord;
}

export interface PaymentRecordAuditEntry extends BaseAuditEntry {
	readonly entityType: 'payment-record';
	readonly entityId: PaymentRecordId;
	readonly before: PaymentRecord;
	readonly after: PaymentRecord;
}

export type AuditEntry = SessionAuditEntry | AccountRecordAuditEntry | PaymentRecordAuditEntry;
