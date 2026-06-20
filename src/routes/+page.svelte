<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head><title>Home - Stashy</title></svelte:head>

<section class="page-intro">
	<div>
		<p class="eyebrow">Your payment workspace</p>
		<h1>Make the money sit-down feel manageable.</h1>
		<p>
			Configure the accounts you use today. The guided sit-down, archive, and Whiteboard will join
			this workspace as MS-01 grows.
		</p>
	</div>
</section>

<div class="launch-grid" aria-label="Stashy areas">
	<a class="launch-card panel" href={resolve('/configuration/accounts/')}>
		<p class="eyebrow">Ready now</p>
		<h2>Set up your accounts</h2>
		<p>
			Add assets and liabilities, choose their order, and decide when balance colors should warn
			you.
		</p>
		<span class="card-kicker">Open accounts -></span>
	</a>
	<a class="launch-card panel" href={resolve('/sit-down/')}>
		<p class="eyebrow">Coming in Phase 3</p>
		<h2>Sit Down</h2>
		<p>Enter balances, plan payments, and watch source assets update immediately.</p>
		<span class="card-kicker">Preview area -></span>
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
