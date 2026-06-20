<script lang="ts">
	import { untrack } from 'svelte';
	import {
		formatMoney,
		parseMoneyInput,
		validateAssetThresholds,
		type Account,
		type AssetThresholdPolicy
	} from '$lib/domain';

	type AccountFormValue = {
		readonly type: 'asset' | 'liability';
		readonly name: string;
		readonly thresholdPolicy?: AssetThresholdPolicy;
	};

	type SaveResult =
		| { readonly ok: true }
		| { readonly ok: false; readonly message: string; readonly field?: string };

	let {
		account = null,
		defaultsEnabled,
		onSave,
		onCancel
	}: {
		account?: Account | null;
		defaultsEnabled: boolean;
		onSave: (value: AccountFormValue) => Promise<SaveResult>;
		onCancel: () => void;
	} = $props();

	const initialAccount = untrack(() => account);
	let name = $state(initialAccount?.name ?? '');
	let accountType = $state<'asset' | 'liability'>(initialAccount?.type ?? 'asset');
	let thresholdMode = $state<'inherit' | 'custom' | 'off'>(
		initialAccount?.type === 'asset' ? initialAccount.thresholdPolicy.mode : 'inherit'
	);
	let warningBelow = $state(
		initialAccount?.type === 'asset' && initialAccount.thresholdPolicy.mode === 'custom'
			? formatMoney(initialAccount.thresholdPolicy.thresholds.warningBelow)
			: ''
	);
	let dangerBelow = $state(
		initialAccount?.type === 'asset' && initialAccount.thresholdPolicy.mode === 'custom'
			? formatMoney(initialAccount.thresholdPolicy.thresholds.dangerBelow)
			: ''
	);
	let errorMessage = $state('');
	let nameError = $state('');
	let warningError = $state('');
	let dangerError = $state('');
	let saving = $state(false);

	function clearErrors(): void {
		errorMessage = '';
		nameError = '';
		warningError = '';
		dangerError = '';
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		clearErrors();
		if (!name.trim()) {
			nameError = 'Enter an account name.';
			return;
		}

		let thresholdPolicy: AssetThresholdPolicy | undefined;
		if (accountType === 'asset') {
			if (thresholdMode === 'custom') {
				const warning = parseMoneyInput(warningBelow);
				const danger = parseMoneyInput(dangerBelow);
				if (!warning.ok) warningError = warning.message;
				if (!danger.ok) dangerError = danger.message;
				if (!warning.ok || !danger.ok) return;

				const thresholds = {
					warningBelow: warning.value,
					dangerBelow: danger.value
				};
				const validation = validateAssetThresholds(thresholds);
				if (!validation.ok) {
					dangerError = validation.errors[0].message;
					return;
				}
				thresholdPolicy = { mode: 'custom', thresholds };
			} else {
				thresholdPolicy = { mode: thresholdMode };
			}
		}

		saving = true;
		const result = await onSave({ type: accountType, name, thresholdPolicy });
		saving = false;
		if (!result.ok) {
			if (result.field === 'name') nameError = result.message;
			else if (result.field === 'dangerBelow') dangerError = result.message;
			else errorMessage = result.message;
		}
	}
</script>

<form class="panel editor" aria-labelledby="account-editor-title" onsubmit={submit}>
	<div class="section-heading">
		<div>
			<p class="eyebrow">{account ? 'Edit account' : 'New account'}</p>
			<h2 id="account-editor-title">{account ? account.name : 'Add an account'}</h2>
		</div>
		<button class="icon-button" type="button" onclick={onCancel} aria-label="Close account editor">
			x
		</button>
	</div>

	{#if errorMessage}
		<p class="form-message error" role="alert">{errorMessage}</p>
	{/if}

	<label>
		<span>Account name</span>
		<input
			name="accountName"
			autocomplete="off"
			bind:value={name}
			aria-invalid={nameError ? 'true' : undefined}
			aria-describedby={nameError ? 'account-name-error' : undefined}
		/>
	</label>
	{#if nameError}<p id="account-name-error" class="field-error">{nameError}</p>{/if}

	{#if account}
		<div class="read-only-field">
			<span>Account type</span>
			<strong>{account.type === 'asset' ? 'Asset' : 'Liability'}</strong>
			<small>Account type stays fixed so saved references remain trustworthy.</small>
		</div>
	{:else}
		<fieldset>
			<legend>Account type</legend>
			<label class="choice">
				<input type="radio" name="accountType" value="asset" bind:group={accountType} />
				<span><strong>Asset</strong><small>Money available to fund payments.</small></span>
			</label>
			<label class="choice">
				<input type="radio" name="accountType" value="liability" bind:group={accountType} />
				<span
					><strong>Liability</strong><small>An account whose balance can be paid down.</small></span
				>
			</label>
		</fieldset>
	{/if}

	{#if accountType === 'asset'}
		<label>
			<span>Balance warnings</span>
			<select name="thresholdMode" bind:value={thresholdMode}>
				<option value="inherit">Use app defaults</option>
				<option value="custom">Use custom thresholds</option>
				<option value="off">No threshold colors</option>
			</select>
			{#if thresholdMode === 'inherit' && !defaultsEnabled}
				<small>App defaults are currently off, so this account will have no threshold colors.</small
				>
			{/if}
		</label>

		{#if thresholdMode === 'custom'}
			<div class="field-grid">
				<label>
					<span>Warn below</span>
					<input
						name="warningBelow"
						inputmode="decimal"
						placeholder="$400.00"
						bind:value={warningBelow}
						aria-invalid={warningError ? 'true' : undefined}
					/>
					{#if warningError}<small class="field-error">{warningError}</small>{/if}
				</label>
				<label>
					<span>Danger below</span>
					<input
						name="dangerBelow"
						inputmode="decimal"
						placeholder="$100.00"
						bind:value={dangerBelow}
						aria-invalid={dangerError ? 'true' : undefined}
					/>
					{#if dangerError}<small class="field-error">{dangerError}</small>{/if}
				</label>
			</div>
		{/if}
	{/if}

	<div class="form-actions">
		<button class="button secondary" type="button" onclick={onCancel}>Cancel</button>
		<button class="button primary" type="submit" disabled={saving}>
			{saving ? 'Saving...' : account ? 'Save changes' : 'Add account'}
		</button>
	</div>
</form>
