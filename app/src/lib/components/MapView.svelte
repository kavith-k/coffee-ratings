<script lang="ts">
	import { onMount } from 'svelte';
	import 'leaflet/dist/leaflet.css';
	import { getRatingHex, MAP_DEFAULTS } from '$lib/utils/map';
	import { getRatingClasses } from '$lib/utils/rating-colour';

	type Cafe = {
		cafe_id: string;
		cafe_name: string;
		area: string | null;
		lat: number;
		lng: number;
		avg_rating: number | null;
		num_ratings: number;
		num_raters: number;
	};

	let { cafes }: { cafes: Cafe[] } = $props();

	let mapContainer: HTMLDivElement;
	let selectedCafe: Cafe | null = $state(null);

	function dismissCard(e: PointerEvent) {
		if (e.target === e.currentTarget) selectedCafe = null;
	}

	onMount(async () => {
		const L = await import('leaflet');

		const map = L.map(mapContainer, { zoomControl: false }).setView(
			MAP_DEFAULTS.centre,
			MAP_DEFAULTS.zoom
		);

		L.control.zoom({ position: 'topright' }).addTo(map);

		L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
			subdomains: 'abcd',
			maxZoom: 20
		}).addTo(map);

		// Create a shadow pane rendered beneath the marker pane so drop shadows
		// don't overlap neighbouring markers.
		const shadowPane = map.createPane('shadow');
		shadowPane.style.zIndex = '450';

		const markers: L.CircleMarker[] = [];

		for (const cafe of cafes) {
			const colour = getRatingHex(cafe.avg_rating);

			// Shadow circle -- slightly offset, blurred via CSS
			L.circleMarker([cafe.lat, cafe.lng], {
				pane: 'shadow',
				radius: 12,
				fillColor: '#000',
				fillOpacity: 0.15,
				stroke: false,
				interactive: false
			}).addTo(map);

			const marker = L.circleMarker([cafe.lat, cafe.lng], {
				radius: 11,
				fillColor: colour,
				fillOpacity: 0.9,
				color: '#fff',
				weight: 2.5,
				bubblingMouseEvents: false
			})
				.addTo(map)
				.bindTooltip(escapeHtml(cafe.cafe_name), {
					direction: 'top',
					offset: [0, -12],
					className: 'cafe-tooltip'
				});

			marker.on('click', () => {
				selectedCafe = cafe;
			});

			markers.push(marker);
		}

		// Auto-fit to marker bounds with padding so nothing sits behind edges.
		if (markers.length > 0) {
			const group = L.featureGroup(markers);
			map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 15 });
		}

		// Dismiss the bottom card when the user clicks the map background.
		map.on('click', () => {
			selectedCafe = null;
		});

		return () => {
			map.remove();
		};
	});

	// Cafe names and areas are user-supplied. Leaflet's bindTooltip renders raw
	// HTML, so we must escape to prevent XSS.
	function escapeHtml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}
</script>

<div class="relative h-full w-full">
	<div bind:this={mapContainer} class="h-full w-full"></div>

	{#if selectedCafe}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="absolute inset-x-0 bottom-0 z-[1000] p-3"
			onpointerdown={dismissCard}
		>
			<a
				href="/cafes/{selectedCafe.cafe_id}"
				class="mx-auto flex max-w-md items-center gap-4 rounded-xl border bg-card p-4 shadow-lg transition hover:bg-accent"
			>
				<span
					class="inline-flex h-14 w-16 shrink-0 items-center justify-center rounded-md text-2xl font-semibold tabular-nums {getRatingClasses(selectedCafe.avg_rating)}"
				>
					{selectedCafe.avg_rating !== null ? selectedCafe.avg_rating.toFixed(1) : '—'}
				</span>
				<div class="min-w-0 flex-1">
					<p class="truncate font-medium">{selectedCafe.cafe_name}</p>
					{#if selectedCafe.area}
						<p class="truncate text-sm text-muted-foreground">{selectedCafe.area}</p>
					{/if}
					<p class="text-xs text-muted-foreground">
						{#if selectedCafe.num_ratings === 0}
							No ratings yet
						{:else}
							{selectedCafe.num_ratings}
							{selectedCafe.num_ratings === 1 ? 'rating' : 'ratings'} from {selectedCafe.num_raters}
							{selectedCafe.num_raters === 1 ? 'person' : 'people'}
						{/if}
					</p>
				</div>
				<svg
					class="size-5 shrink-0 text-muted-foreground"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 20 20"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						fill-rule="evenodd"
						d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
						clip-rule="evenodd"
					/>
				</svg>
			</a>
		</div>
	{/if}
</div>

<style>
	:global(.cafe-tooltip) {
		font-family: inherit;
		font-size: 0.8125rem;
		font-weight: 500;
		padding: 4px 8px;
		border-radius: 6px;
		border: none;
		box-shadow: 0 2px 6px rgb(0 0 0 / 0.15);
	}
</style>
