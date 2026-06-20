<script lang="ts">
	import { untrack } from 'svelte';
	import {
		formatMoney,
		parseMoneyInput,
		validateAssetThresholds,
		type AssetThresholds
	} from '$lib/domain';

	type SaveResult =
		| { readonly ok: true }
		| { readonly ok: false; readonly message: string; readonly field?: string };

	let {
		thresholds,
		onSave
	}: {
		thresholds: AssetThresholds | null;
		onSave: (value: AssetThresholds | null) => Promise<SaveResult>;
	} = $props();

	const initialThresholds = untrack(() => thresholds);
	let enabled = $state(initialThresholds !== null);
	let warningBelow = $state(initialThresholds ? formatMoney(initialThresholds.warningBelow) : '');
	let dangerBelow = $state(initialThresholds ? formatMoney(initialThresholds.dangerBelow) : '');
	let warningError = $state('');
	let dangerError = $state('');
	let message = $state('');
	let messageKind = $state<'error' | 'success'>('success');
	let saving = $state(false);

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		warningError = '';
		dangerError = '';
		message = '';
		let value: AssetThresholds | null = null;

		if (enabled) {
			const warning = parseMoneyInput(warningBelow);
			const danger = parseMoneyInput(dangerBelow);
			if (!warning.ok) warningError = warning.message;
			if (!danger.ok) dangerError = danger.message;
			if (!warning.ok || !danger.ok) return;
			value = { warningBelow: warning.value, dangerBelow: danger.value };
			const validation = validateAssetThresholds(value);
			if (!validation.ok) {
				dangerError = validation.errors[0].message;
				return;
			}
		}

		saving = true;
		const result = await onSave(value);
		saving = false;
		if (result.ok) {
			messageKind = 'success';
			message = enabled ? 'Default thresholds saved.' : 'Default thresholds turned off.';
		} else {
			messageKind = 'error';
			message = result.message;
		}
	}
</script>

<form class="panel defaults-form" aria-labelledby="defaults-title" onsubmit={submit}>
	<div class="section-heading">
		<div>
			<p class="eyebrow">App settings</p>
			<h2 id="defaults-title">Default asset thresholds</h2>
			<p>New assets inherit these values unless you choose custom thresholds or turn them off.</p>
		</div>
	</div>

	<label class="switch-row">
		<span
			><strong>Use app defaults</strong><small
				>Apply passive warning colors to inheriting assets.</small
			></span
		>
		<input type="checkbox" bind:checked={enabled} />
	</label>

	{#if enabled}
		<div class="field-grid">
			<label>
				<span>Warn below</span>
				<input
					name="defaultWarningBelow"
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
					name="defaultDangerBelow"
					inputmode="decimal"
					placeholder="$100.00"
					bind:value={dangerBelow}
					aria-invalid={dangerError ? 'true' : undefined}
				/>
				{#if dangerError}<small class="field-error">{dangerError}</small>{/if}
			</label>
		</div>
	{:else}
		<p class="soft-note">
			Inheriting assets will show no threshold color until defaults are enabled.
		</p>
	{/if}

	<div class="form-actions split-actions">
		{#if message}
			<p
				class:success={messageKind === 'success'}
				class:error={messageKind === 'error'}
				role="status"
			>
				{message}
			</p>
		{:else}
			<span></span>
		{/if}
		<button class="button secondary" type="submit" disabled={saving}>
			{saving ? 'Saving...' : 'Save defaults'}
		</button>
	</div>
</form>
