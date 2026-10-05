<script lang="ts">
	type WarningAction = { controlId: string; label: string; reason: string };
	type Props = {
		exclusions: readonly WarningAction[];
		missingOpenings: readonly WarningAction[];
		structuralError: boolean;
		onFocus: (controlId: string) => void;
	};
	let { exclusions, missingOpenings, structuralError, onFocus }: Props = $props();
</script>

{#if structuralError || exclusions.length || missingOpenings.length}
	<div class="projection-warning projection-summary">
		<strong
			>{structuralError
				? 'Running balances unavailable — record errors'
				: exclusions.length
					? 'Incomplete — payments excluded'
					: 'Incomplete — opening balances missing'}</strong
		>
		<div class="projection-warning-actions">
			{#each [...exclusions, ...missingOpenings] as action, index (`${action.controlId}-${index}`)}
				<button
					type="button"
					class="button secondary"
					title={action.reason}
					onclick={() => onFocus(action.controlId)}>{action.label}</button
				>
			{/each}
		</div>
	</div>
{/if}
