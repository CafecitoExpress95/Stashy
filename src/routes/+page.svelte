<script lang="ts">
	import { asset, resolve } from '$app/paths';
</script>

<svelte:head><title>Home - Stashy</title></svelte:head>

<section class="page-intro home-intro">
	<div>
		<p class="eyebrow">Your payment workspace</p>
		<h1>Make the money sit-down feel manageable.</h1>
		<p>
			Set up your accounts, then use the live payment cockpit to plan a sit-down without losing
			sight of the money available in each source asset.
		</p>
	</div>
	<img
		class="home-logo"
		src={asset('/logo.png')}
		alt="Stashy squirrel holding an acorn beside stacks of cash"
		width="980"
		height="899"
		fetchpriority="high"
	/>
</section>

<div class="launch-grid" aria-label="Stashy areas">
	<a class="launch-card panel" href={resolve('/sit-down/')}>
		<p class="eyebrow">Ready now</p>
		<h2>Sit Down</h2>
		<p>Enter balances, plan payments, save a draft, and watch source assets update immediately.</p>
		<span class="card-kicker">Start a sit-down -&gt;</span>
	</a>
	<a class="launch-card panel" href={resolve('/configuration/accounts/')}>
		<p class="eyebrow">Ready now</p>
		<h2>Set up your accounts</h2>
		<p>
			Add assets and liabilities, choose their order, and decide when balance colors should warn
			you.
		</p>
		<span class="card-kicker">Open accounts -></span>
	</a>
	<a class="launch-card panel" href={resolve('/archive/')}>
		<p class="eyebrow">Coming later</p>
		<h2>Check Archive</h2>
		<p>Replay past sit-downs without rewriting what happened afterward.</p>
		<span class="card-kicker">Preview area -></span>
	</a>
	<a class="launch-card panel" href={resolve('/whiteboard/')}>
		<p class="eyebrow">Coming later</p>
		<h2>Visit Whiteboard</h2>
		<p>See the latest state and follow each account's saved balance history.</p>
		<span class="card-kicker">Preview area -></span>
	</a>
	<a class="launch-card panel" href={resolve('/configuration/data/')}>
		<p class="eyebrow">Coming later</p>
		<h2>Save & Restore</h2>
		<p>Export every local record and restore it safely from a validated file.</p>
		<span class="card-kicker">Preview area -></span>
	</a>
</div>
