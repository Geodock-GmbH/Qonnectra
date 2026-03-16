<script>
	import Fuse from 'fuse.js';

	let {
		data = [],
		value = $bindable(''),
		placeholder = '',
		disabled = false,
		loading = false,
		noDataMessage = '',
		error = '',
		fuseOptions = {},
		onValueChange = undefined,
		renderInPlace = false,
		itemHeight = 40,
		maxVisibleItems = 8
	} = $props();

	const OVERSCAN = 3;

	let isOpen = $state(false);
	let searchQuery = $state('');
	let highlightedIndex = $state(-1);
	let scrollTop = $state(0);

	/** @type {HTMLInputElement|null} */
	let inputEl = $state(null);
	/** @type {HTMLDivElement|null} */
	let listContainerEl = $state(null);
	/** @type {HTMLDivElement|null} */
	let wrapperEl = $state(null);

	const instanceId = `vcb-${Math.random().toString(36).slice(2, 9)}`;
	const listboxId = `${instanceId}-listbox`;

	const fuse = $derived(
		new Fuse(data, {
			keys: ['label', 'value'],
			threshold: 0.3,
			...fuseOptions
		})
	);

	const filteredItems = $derived.by(() => {
		if (!searchQuery) return data;
		const results = fuse.search(searchQuery);
		return results.length > 0 ? results.map((r) => r.item) : [];
	});

	const totalItems = $derived(filteredItems.length);

	/** Label of the currently selected item */
	const selectedLabel = $derived(data.find((item) => item.value === value)?.label ?? '');

	/* ── Virtual scroll range ── */
	const visibleStart = $derived(Math.max(0, Math.floor(scrollTop / itemHeight) - OVERSCAN));
	const visibleEnd = $derived(
		Math.min(totalItems, Math.floor(scrollTop / itemHeight) + maxVisibleItems + OVERSCAN)
	);
	const visibleItems = $derived(filteredItems.slice(visibleStart, visibleEnd));
	const topSpacerHeight = $derived(visibleStart * itemHeight);
	const bottomSpacerHeight = $derived((totalItems - visibleEnd) * itemHeight);
	const containerMaxHeight = $derived(maxVisibleItems * itemHeight);

	/* ── Fixed position for dropdown ── */
	/** @type {{ top: number, left: number, width: number }} */
	let fixedPosition = $state({ top: 0, left: 0, width: 0 });

	/** Recalculates the fixed dropdown position based on the input element's bounding rect. */
	function updateFixedPosition() {
		if (!inputEl || renderInPlace) return;
		const rect = inputEl.getBoundingClientRect();
		fixedPosition = {
			top: rect.bottom + 4,
			left: rect.left,
			width: rect.width
		};
	}

	/** Attach/detach scroll and resize listeners when dropdown is open in fixed mode. */
	$effect(() => {
		if (isOpen && !renderInPlace) {
			updateFixedPosition();
			window.addEventListener('scroll', updateFixedPosition, true);
			window.addEventListener('resize', updateFixedPosition);
			return () => {
				window.removeEventListener('scroll', updateFixedPosition, true);
				window.removeEventListener('resize', updateFixedPosition);
			};
		}
	});

	/* ── Open / close / selection ── */

	/** Opens the dropdown, resets search state, and scrolls to the currently selected item. */
	function open() {
		if (disabled) return;
		isOpen = true;
		searchQuery = '';
		highlightedIndex = -1;
		scrollTop = 0;
		updateFixedPosition();

		if (value) {
			const selectedIdx = data.findIndex((item) => item.value === value);
			if (selectedIdx >= 0) {
				highlightedIndex = selectedIdx;
				queueMicrotask(() => scrollToIndex(selectedIdx, true));
			}
		}
	}

	let closedBySelection = false;

	/** Closes the dropdown and resets search/highlight state. */
	function close() {
		isOpen = false;
		searchQuery = '';
		highlightedIndex = -1;
	}

	/**
	 * Selects an item, updates the bound value, fires the callback, and closes the dropdown.
	 * @param {{ label: string, value: string }} item - The item to select.
	 */
	function selectItem(item) {
		value = item.value;
		onValueChange?.({ value: item.value });
		closedBySelection = true;
		close();
	}

	/**
	 * Scrolls the list container so the item at the given index is visible.
	 * @param {number} index - Absolute index of the target item.
	 */
	function scrollToIndex(index, center = false) {
		if (!listContainerEl) return;
		const targetTop = index * itemHeight;
		const containerHeight = containerMaxHeight;
		if (center) {
			listContainerEl.scrollTop = targetTop - (containerHeight - itemHeight) / 2;
		} else if (targetTop < listContainerEl.scrollTop) {
			listContainerEl.scrollTop = targetTop;
		} else if (targetTop + itemHeight > listContainerEl.scrollTop + containerHeight) {
			listContainerEl.scrollTop = targetTop + itemHeight - containerHeight;
		}
	}

	/**
	 * Updates the virtual scroll offset from the list container's scroll position.
	 * @param {Event} e - Scroll event from the list container.
	 */
	function handleScroll(e) {
		scrollTop = /** @type {HTMLDivElement} */ (e.target).scrollTop;
	}

	function handleInputFocus() {
		if (closedBySelection) {
			closedBySelection = false;
			return;
		}
		if (!isOpen) open();
	}

	/**
	 * Handles search input changes, resets scroll and highlights the first match.
	 * @param {Event} e - Input event from the search field.
	 */
	function handleSearchInput(e) {
		searchQuery = /** @type {HTMLInputElement} */ (e.target).value;
		highlightedIndex = filteredItems.length > 0 ? 0 : -1;
		scrollTop = 0;
		if (listContainerEl) listContainerEl.scrollTop = 0;
	}

	/**
	 * Closes the dropdown when clicking outside the wrapper element.
	 * @param {MouseEvent} e - Window click event.
	 */
	function handleWindowClick(e) {
		if (isOpen && wrapperEl && !wrapperEl.contains(/** @type {Node} */ (e.target))) {
			close();
		}
	}

	/* ── Keyboard navigation ── */

	/**
	 * Handles keyboard navigation (ArrowUp/Down, Enter, Escape, Tab) within the combobox.
	 * @param {KeyboardEvent} e - Keydown event from the input element.
	 */
	function handleKeydown(e) {
		if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
			e.preventDefault();
			open();
			return;
		}

		if (!isOpen) return;

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				highlightedIndex = Math.min(highlightedIndex + 1, totalItems - 1);
				scrollToIndex(highlightedIndex);
				break;
			case 'ArrowUp':
				e.preventDefault();
				highlightedIndex = Math.max(highlightedIndex - 1, 0);
				scrollToIndex(highlightedIndex);
				break;
			case 'Enter':
				e.preventDefault();
				if (highlightedIndex >= 0 && highlightedIndex < totalItems) {
					selectItem(filteredItems[highlightedIndex]);
				}
				break;
			case 'Escape':
				e.preventDefault();
				close();
				inputEl?.focus();
				break;
			case 'Tab':
				close();
				break;
		}
	}
</script>

<svelte:window onclick={handleWindowClick} />

{#if loading}
	<div class="placeholder animate-pulse size-10"></div>
{:else if error}
	<div class="alert variant-filled-error text-sm sm:text-base">{error}</div>
{:else}
	<div
		class="relative"
		class:opacity-50={disabled}
		class:cursor-not-allowed={disabled}
		bind:this={wrapperEl}
	>
		<div class="relative flex min-h-[48px] items-center sm:min-h-[40px]">
			<input
				bind:this={inputEl}
				type="text"
				class="input w-full pr-8"
				role="combobox"
				aria-expanded={isOpen}
				aria-controls={listboxId}
				aria-activedescendant={highlightedIndex >= 0
					? `${instanceId}-item-${highlightedIndex}`
					: undefined}
				aria-autocomplete="list"
				{placeholder}
				{disabled}
				value={isOpen ? searchQuery : selectedLabel}
				onfocus={handleInputFocus}
				oninput={handleSearchInput}
				onkeydown={handleKeydown}
			/>
			<button
				type="button"
				class="absolute right-1 p-1 text-surface-500"
				tabindex="-1"
				aria-label="Toggle dropdown"
				{disabled}
				onclick={() => (isOpen ? close() : open())}
			>
				<svg
					class="size-4 transition-transform {isOpen ? 'rotate-180' : ''}"
					viewBox="0 0 20 20"
					fill="currentColor"
				>
					<path
						fill-rule="evenodd"
						d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
						clip-rule="evenodd"
					/>
				</svg>
			</button>
		</div>

		{#if isOpen}
			<div
				class="z-50 mt-1 rounded-md border border-surface-200-800 bg-surface-50-950 shadow-lg"
				style={!renderInPlace
					? `position: fixed; top: ${fixedPosition.top}px; left: ${fixedPosition.left}px; width: ${fixedPosition.width}px;`
					: 'position: absolute; left: 0; right: 0;'}
			>
				{#if totalItems === 0}
					<div class="px-3 py-2 text-sm text-surface-500">
						{noDataMessage || 'No results found'}
					</div>
				{:else}
					<div
						bind:this={listContainerEl}
						role="listbox"
						id={listboxId}
						class="overflow-y-auto"
						style="max-height: {containerMaxHeight}px;"
						onscroll={handleScroll}
					>
						<!-- Top spacer -->
						<div style="height: {topSpacerHeight}px;" aria-hidden="true"></div>

						{#each visibleItems as item, i (item.value)}
							{@const absoluteIndex = visibleStart + i}
							<div
								id="{instanceId}-item-{absoluteIndex}"
								role="option"
								tabindex="-1"
								aria-selected={item.value === value}
								class="cursor-pointer rounded-md px-3 py-2"
								class:bg-primary-500={item.value === value && absoluteIndex !== highlightedIndex}
								class:bg-surface-200-800={absoluteIndex === highlightedIndex &&
									item.value !== value}
								class:bg-primary-600={absoluteIndex === highlightedIndex && item.value === value}
								class:text-white={item.value === value || absoluteIndex === highlightedIndex}
								style="height: {itemHeight}px; display: flex; align-items: center;"
								onclick={() => selectItem(item)}
								onkeydown={(e) => e.key === 'Enter' && selectItem(item)}
								onmouseenter={() => (highlightedIndex = absoluteIndex)}
							>
								{item.label}
							</div>
						{/each}

						<!-- Bottom spacer -->
						<div style="height: {bottomSpacerHeight}px;" aria-hidden="true"></div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
