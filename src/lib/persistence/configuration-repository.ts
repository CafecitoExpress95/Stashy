import type {
	Account,
	AccountId,
	AccountMoveDirection,
	AppSettings,
	AssetThresholdPolicy,
	AssetThresholds
} from '$lib/domain';

export type ConfigurationSnapshot = {
	readonly settings: AppSettings;
	readonly accounts: readonly Account[];
};

export type CreateAccountInput =
	| {
			readonly type: 'asset';
			readonly name: string;
			readonly thresholdPolicy?: AssetThresholdPolicy;
	  }
	| {
			readonly type: 'liability';
			readonly name: string;
	  };

export type UpdateAccountInput = {
	readonly name: string;
	readonly thresholdPolicy?: AssetThresholdPolicy;
};

export type ConfigurationRepositoryErrorCode =
	| 'storage-unavailable'
	| 'storage-failed'
	| 'corrupt-data'
	| 'account-not-found'
	| 'account-name-required'
	| 'duplicate-account-name'
	| 'invalid-thresholds'
	| 'invalid-account-type'
	| 'invalid-sort-order'
	| 'archived-account-cannot-move';

export class ConfigurationRepositoryError extends Error {
	readonly code: ConfigurationRepositoryErrorCode;
	readonly field?: string;

	constructor(code: ConfigurationRepositoryErrorCode, message: string, field?: string) {
		super(message);
		this.name = 'ConfigurationRepositoryError';
		this.code = code;
		this.field = field;
	}
}

export interface ConfigurationRepository {
	loadConfiguration(): Promise<ConfigurationSnapshot>;
	createAccount(input: CreateAccountInput): Promise<Account>;
	updateAccount(accountId: AccountId, input: UpdateAccountInput): Promise<Account>;
	setAccountArchived(accountId: AccountId, archived: boolean): Promise<Account>;
	moveAccount(accountId: AccountId, direction: AccountMoveDirection): Promise<readonly Account[]>;
	updateDefaultAssetThresholds(thresholds: AssetThresholds | null): Promise<AppSettings>;
}
