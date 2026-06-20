<script lang="ts">
	import type { Account, AccountMoveDirection } from '$lib/domain';

	let {
		title,
		description,
		accounts,
		onEdit,
		onMove,
		onArchive
	}: {
		title: string;
		description: string;
		accounts: readonly Account[];
		onEdit: (account: Account) => void;
		onMove: (account: Account, direction: AccountMoveDirection) => Promise<void>;
		onArchive: (account: Account) => Promise<void>;
	} = $props();

	let confirmingId = $state<string | null>(null);
	let busyId = $state<string | null>(null);

	async function move(account: Account, direction: AccountMoveDirection): Promise<void> {
		busyId = account.id;
		await onMove(account, direction);
		busyId = null;
	}

	async function archive(account: Account): Promise<void> {
		busyId = account.id;
		await onArchive(account);
		busyId = null;
		confirmingId = null;
	}
</script>

<section
	class="panel account-section"
	aria-labelledby={`${title.toLowerCase().replaceAll(' ', '-')}-title`}
>
	<div class="section-heading">
		<div>
			<h2 id={`${title.toLowerCase().replaceAll(' ', '-')}-title`}>{title}</h2>
			<p>{description}</p>
		</div>
		<span class="count-badge">{accounts.length}</span>
	</div>

	{#if accounts.length === 0}
		<p class="section-empty">No active {title.toLowerCase()} yet.</p>
	{:else}
		<ul class="account-list">
			{#each accounts as account, index (account.id)}
				<li>
					<div class="account-summary">
						<strong>{account.name}</strong>
						{#if account.type === 'asset'}
							<small>
								{account.thresholdPolicy.mode === 'inherit'
									? 'Uses app thresholds'
									: account.thresholdPolicy.mode === 'custom'
										? 'Custom thresholds'
										: 'No thresholds'}
							</small>
						{:else}
							<small>Liability</small>
						{/if}
					</div>

					<div class="account-actions">
						<button
							class="text-button"
							type="button"
							disabled={index === 0 || busyId === account.id}
							onclick={() => move(account, 'up')}
							aria-label={`Move ${account.name} up`}>&uarr;</button
						>
						<button
							class="text-button"
							type="button"
							disabled={index === accounts.length - 1 || busyId === account.id}
							onclick={() => move(account, 'down')}
							aria-label={`Move ${account.name} down`}>&darr;</button
						>
						<button class="text-button" type="button" onclick={() => onEdit(account)}>Edit</button>
						<button
							class="text-button danger-text"
							type="button"
							onclick={() => (confirmingId = account.id)}>Archive</button
						>
					</div>

					{#if confirmingId === account.id}
						<div class="archive-confirmation" role="group" aria-label={`Archive ${account.name}`}>
							<p>Hide <strong>{account.name}</strong> from new sit-downs?</p>
							<div>
								<button
									class="button secondary compact"
									type="button"
									onclick={() => (confirmingId = null)}>Keep active</button
								>
								<button
									class="button danger compact"
									type="button"
									disabled={busyId === account.id}
									onclick={() => archive(account)}>Archive account</button
								>
							</div>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
