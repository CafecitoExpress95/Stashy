<script lang="ts">
	import { resolve } from '$app/paths';
	type ActionHref =
		| '/'
		| '/configuration/accounts/'
		| '/sit-down/'
		| '/archive/'
		| '/whiteboard/'
		| '/configuration/data/';

	let {
		eyebrow = 'MS-01',
		title,
		description,
		actionHref,
		actionLabel
	}: {
		eyebrow?: string;
		title: string;
		description: string;
		actionHref?: ActionHref;
		actionLabel?: string;
	} = $props();
</script>

<section class="empty-state panel" aria-labelledby="empty-state-title">
	<p class="eyebrow">{eyebrow}</p>
	<h1 id="empty-state-title">{title}</h1>
	<p>{description}</p>
	{#if actionHref && actionLabel}
		<a class="button primary" href={resolve(actionHref)}>{actionLabel}</a>
	{/if}
</section>
