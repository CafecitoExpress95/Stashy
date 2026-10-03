<script lang="ts">
	import { onMount } from 'svelte';
	import {
		DataPortabilityError,
		createBrowserDataPortabilityService,
		type IndexedDbDataPortabilityService,
		type StashyArchiveCounts,
		type StashyArchiveImport
	} from '$lib/persistence';
	import { STASHY_ARCHIVE_MIME_TYPE } from '$lib/persistence/stashy-archive-constants';

	let service = $state<IndexedDbDataPortabilityService | null>(null);
	let localCounts = $state<StashyArchiveCounts | null>(null);
	let loading = $state(true);
	let exporting = $state(false);
	let readingFile = $state(false);
	let restoring = $state(false);
	let errorMessage = $state('');
	let selectedFileName = $state('');
	// Keep immutable validated records plain for IndexedDB's structured clone.
	let preparedArchive = $state.raw<StashyArchiveImport | null>(null);
	let confirmed = $state(false);
	let success = $state<StashyArchiveImport | null>(null);
	let fileInput = $state<HTMLInputElement>();

	onMount(() => {
		try {
			service = createBrowserDataPortabilityService();
			void refreshCounts();
		} catch (error) {
			loading = false;
			errorMessage = messageFromError(error);
		}
	});

	function messageFromError(error: unknown): string {
		return error instanceof DataPortabilityError || error instanceof Error
			? error.message
			: 'Stashy could not access local backup storage.';
	}

	async function refreshCounts(): Promise<void> {
		if (!service) return;
		loading = true;
		errorMessage = '';
		try {
			localCounts = await service.getLocalCounts();
		} catch (error) {
			errorMessage = messageFromError(error);
		} finally {
			loading = false;
		}
	}

	async function exportBackup(): Promise<void> {
		if (!service || exporting) return;
		exporting = true;
		errorMessage = '';
		success = null;
		try {
			const archive = await service.exportArchive();
			const blob = new Blob([new Uint8Array(archive.bytes).buffer], {
				type: STASHY_ARCHIVE_MIME_TYPE
			});
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = archive.filename;
			document.body.append(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(url);
			localCounts = archive.manifest.counts;
		} catch (error) {
			errorMessage = messageFromError(error);
		} finally {
			exporting = false;
		}
	}

	async function chooseBackup(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		cancelPreparedImport(false);
		if (!file || !service) return;
		selectedFileName = file.name;
		readingFile = true;
		try {
			const validation = service.validateArchive(new Uint8Array(await file.arrayBuffer()));
			if (!validation.ok) {
				errorMessage = validation.errors.join(' ');
				return;
			}
			preparedArchive = validation.archive;
		} catch (error) {
			errorMessage = messageFromError(error);
		} finally {
			readingFile = false;
		}
	}

	function cancelPreparedImport(clearInput = true): void {
		preparedArchive = null;
		selectedFileName = '';
		confirmed = false;
		errorMessage = '';
		success = null;
		if (clearInput && fileInput) fileInput.value = '';
	}

	async function restoreBackup(): Promise<void> {
		if (!service || !preparedArchive || !confirmed || restoring) return;
		restoring = true;
		errorMessage = '';
		try {
			await service.restoreArchive(preparedArchive);
			success = preparedArchive;
			localCounts = preparedArchive.manifest.counts;
			preparedArchive = null;
			confirmed = false;
			selectedFileName = '';
			if (fileInput) fileInput.value = '';
		} catch (error) {
			errorMessage = messageFromError(error);
		} finally {
			restoring = false;
		}
	}

	function formatTimestamp(timestamp: string): string {
		return new Intl.DateTimeFormat(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(timestamp));
	}
</script>

<section class="page-intro">
	<div>
		<p class="eyebrow">Configuration</p>
		<h1>Save & Restore</h1>
		<p>
			Create one portable backup of every local Stashy record, or validate and restore a previous
			backup.
		</p>
	</div>
</section>

{#if errorMessage}
	<div class="panel message error" role="alert">
		<strong>Stashy did not change your data.</strong>
		<p>{errorMessage}</p>
	</div>
{/if}

{#if success}
	<div class="panel message success" role="status">
		<strong>Backup restored.</strong>
		<p>
			Your local data now matches the backup from {formatTimestamp(success.manifest.exportedAt)}. No
			reload is needed.
		</p>
	</div>
{/if}

{#if loading}
	<section class="panel loading" aria-live="polite">
		<h2>Reading local data...</h2>
		<p>Stashy is counting settings, accounts, sessions, records, and audit history.</p>
	</section>
{:else}
	<div class="data-layout">
		<section class="panel workspace" aria-labelledby="export-title">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Save</p>
					<h2 id="export-title">Create a full backup</h2>
				</div>
				<span class="format-badge">.stashy</span>
			</div>
			<p>
				The downloaded archive contains a versioned manifest and separate, readable JSON files for
				each stored item.
			</p>
			{#if localCounts}
				<dl class="count-grid" aria-label="Current local data">
					<div>
						<dt>Accounts</dt>
						<dd>{localCounts.accounts}</dd>
					</div>
					<div>
						<dt>Archived</dt>
						<dd>{localCounts.archivedAccounts}</dd>
					</div>
					<div>
						<dt>Sessions</dt>
						<dd>{localCounts.sessions}</dd>
					</div>
					<div>
						<dt>Drafts</dt>
						<dd>{localCounts.drafts}</dd>
					</div>
					<div>
						<dt>Records</dt>
						<dd>{localCounts.accountRecords + localCounts.paymentRecords}</dd>
					</div>
					<div>
						<dt>Audits</dt>
						<dd>{localCounts.auditEntries}</dd>
					</div>
				</dl>
			{/if}
			<button class="button primary" type="button" onclick={exportBackup} disabled={exporting}>
				{exporting ? 'Creating backup...' : 'Download backup'}
			</button>
		</section>

		<section class="panel workspace" aria-labelledby="restore-title">
			<p class="eyebrow">Restore</p>
			<h2 id="restore-title">Open a Stashy backup</h2>
			<p>The selected file is fully checked before Stashy offers to replace any local data.</p>
			<label class="file-picker" for="stashy-backup">
				<span>{selectedFileName || 'Choose a .stashy file'}</span>
				<input
					bind:this={fileInput}
					id="stashy-backup"
					type="file"
					accept=".stashy,application/zip"
					onchange={chooseBackup}
					disabled={readingFile || restoring}
				/>
			</label>
			{#if readingFile}<p class="reading" role="status">Validating every archive record...</p>{/if}
		</section>
	</div>
{/if}

{#if preparedArchive}
	<section class="panel restore-confirmation" aria-labelledby="confirmation-title">
		<p class="eyebrow">Validated backup</p>
		<h2 id="confirmation-title">Review before full restore</h2>
		<p>
			Created {formatTimestamp(preparedArchive.manifest.exportedAt)} with Stashy
			{preparedArchive.manifest.app.version}.
		</p>
		<dl class="count-grid import-counts" aria-label="Backup contents">
			<div>
				<dt>Accounts</dt>
				<dd>{preparedArchive.manifest.counts.accounts}</dd>
			</div>
			<div>
				<dt>Sessions</dt>
				<dd>{preparedArchive.manifest.counts.sessions}</dd>
			</div>
			<div>
				<dt>Drafts</dt>
				<dd>{preparedArchive.manifest.counts.drafts}</dd>
			</div>
			<div>
				<dt>Audits</dt>
				<dd>{preparedArchive.manifest.counts.auditEntries}</dd>
			</div>
		</dl>
		<div class="replacement-warning">
			<strong>This is a full replacement, not a merge.</strong>
			<p>
				All current settings, accounts, sessions, records, and audits in this browser will be
				removed and replaced by this backup.
			</p>
		</div>
		<label class="confirmation-check">
			<input type="checkbox" bind:checked={confirmed} />
			<span>I understand this replaces all current local Stashy data.</span>
		</label>
		<div class="actions">
			<button
				class="button secondary"
				type="button"
				onclick={() => cancelPreparedImport()}
				disabled={restoring}
			>
				Cancel
			</button>
			<button
				class="button danger"
				type="button"
				onclick={restoreBackup}
				disabled={!confirmed || restoring}
			>
				{restoring ? 'Restoring...' : 'Replace and restore'}
			</button>
		</div>
	</section>
{/if}

<style>
	.data-layout {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 20px;
		align-items: start;
	}

	.workspace,
	.restore-confirmation,
	.loading,
	.message {
		padding: 24px;
	}

	.workspace h2,
	.restore-confirmation h2,
	.loading h2 {
		margin-bottom: 8px;
	}

	.format-badge {
		padding: 6px 9px;
		border: 1px solid var(--line);
		border-radius: 6px;
		background: var(--paper-strong);
		color: var(--brand-dark);
		font-size: 0.78rem;
		font-weight: 800;
	}

	.count-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1px;
		margin: 22px 0;
		border: 1px solid var(--line);
		background: var(--line);
	}

	.count-grid div {
		min-width: 0;
		padding: 12px;
		background: var(--paper-strong);
	}

	.count-grid dt {
		color: var(--muted);
		font-size: 0.73rem;
		font-weight: 750;
	}

	.count-grid dd {
		margin: 4px 0 0;
		color: var(--ink);
		font-size: 1.35rem;
		font-weight: 850;
	}

	.file-picker {
		display: grid;
		gap: 10px;
		margin-top: 20px;
		color: var(--ink);
		font-weight: 750;
	}

	.file-picker span {
		overflow-wrap: anywhere;
	}

	.file-picker input {
		width: 100%;
		padding: 10px;
		border: 1px solid var(--line);
		border-radius: 6px;
		background: var(--paper-strong);
	}

	.reading {
		margin: 16px 0 0;
		font-weight: 700;
	}

	.restore-confirmation {
		max-width: 780px;
		margin-top: 20px;
		border-color: rgb(157 53 47 / 36%);
	}

	.import-counts {
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}

	.replacement-warning {
		padding: 16px;
		border-left: 4px solid var(--red);
		background: var(--red-soft);
	}

	.replacement-warning p {
		margin: 5px 0 0;
		color: #6c2925;
	}

	.confirmation-check {
		display: grid;
		grid-template-columns: 20px minmax(0, 1fr);
		gap: 10px;
		align-items: start;
		margin-top: 20px;
		color: var(--ink);
		font-weight: 700;
		line-height: 1.45;
	}

	.confirmation-check input {
		width: 18px;
		height: 18px;
		margin-top: 2px;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 22px;
	}

	.message {
		margin-bottom: 20px;
		box-shadow: none;
	}

	.message p {
		margin: 4px 0 0;
	}

	.message.error {
		border-color: rgb(157 53 47 / 38%);
		background: var(--red-soft);
	}

	.message.success {
		border-color: rgb(82 100 20 / 35%);
		background: #edf3d5;
	}

	@media (max-width: 760px) {
		.data-layout {
			grid-template-columns: 1fr;
		}

		.import-counts,
		.count-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.actions {
			flex-direction: column-reverse;
		}

		.actions .button {
			width: 100%;
		}
	}
</style>
