<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	function retry(): void {
		location.reload();
	}
</script>

<svelte:head><title>Something went wrong - Stashy</title></svelte:head>

<section class="empty-state panel error-panel">
	<p class="eyebrow">Error {page.status}</p>
	<h1>{page.status === 404 ? 'That page is not in the stash.' : 'Stashy hit a snag.'}</h1>
	<p>
		{page.status === 404
			? 'The address may be out of date. Head home and choose one of the current Stashy areas.'
			: page.error?.message || 'Your saved local data has not been intentionally changed.'}
	</p>
	<div class="form-actions" style="justify-content: flex-start">
		<a class="button primary" href={resolve('/')}>Go home</a>
		<button class="button secondary" type="button" onclick={retry}>Try again</button>
	</div>
</section>
