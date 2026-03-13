/**
 * Creates a tooltip attachment for use with the Svelte 5 `{@attach}` directive.
 * Manages tooltip lifecycle (show/hide/position) via mouse events.
 *
 * @param {string|undefined} content - The tooltip text content.
 * @param {Object} [options] - Tooltip configuration.
 * @param {'top' | 'bottom' | 'left' | 'right'} [options.position='top'] - Position relative to the target.
 * @param {number} [options.delay=200] - Delay in ms before showing the tooltip.
 * @param {boolean} [options.disabled=false] - Whether to disable the tooltip entirely.
 * @returns {(element: HTMLElement) => () => void} Svelte attachment function.
 *
 * @example
 * ```svelte
 * <button {@attach tooltip('Click me!')}>Button</button>
 * <button {@attach tooltip('Bottom tooltip', { position: 'bottom' })}>Button</button>
 * ```
 */
export function tooltip(content, options = {}) {
	const { position = 'top', delay = 200, disabled = false } = options;

	return (element) => {
		if (disabled) {
			return () => {};
		}

		/** @type {HTMLSpanElement | null} */
		let tooltipElement = null;
		/** @type {ReturnType<typeof setTimeout> | null} */
		let timeoutId = null;

		function showTooltip() {
			tooltipElement = document.createElement('span');
			tooltipElement.className = `tooltip tooltip-${position} bg-surface-100-900 text-surface-900-100 px-3 py-2 rounded text-sm whitespace-nowrap shadow-lg z-[1000] pointer-events-none`;
			tooltipElement.textContent = content ?? null;
			tooltipElement.setAttribute('role', 'tooltip');

			Object.assign(tooltipElement.style, {
				position: 'absolute',
				visibility: 'hidden'
			});

			document.body.appendChild(tooltipElement);
			positionTooltip(tooltipElement, element, position);
			tooltipElement.style.visibility = 'visible';
		}

		function hideTooltip() {
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
			if (tooltipElement) {
				tooltipElement.remove();
				tooltipElement = null;
			}
		}

		function handleMouseEnter() {
			timeoutId = setTimeout(showTooltip, delay);
		}

		function handleMouseLeave() {
			hideTooltip();
		}

		element.addEventListener('mouseenter', handleMouseEnter);
		element.addEventListener('mouseleave', handleMouseLeave);

		const originalPosition = window.getComputedStyle(element).position;
		if (originalPosition === 'static') {
			element.style.position = 'relative';
		}

		return () => {
			hideTooltip();
			element.removeEventListener('mouseenter', handleMouseEnter);
			element.removeEventListener('mouseleave', handleMouseLeave);
			if (originalPosition === 'static') {
				element.style.position = '';
			}
		};
	};
}

/**
 * Positions the tooltip element relative to the target, clamping to viewport edges.
 * @param {HTMLElement} tooltipElement - The tooltip DOM element.
 * @param {HTMLElement} targetElement - The element the tooltip is attached to.
 * @param {'top' | 'bottom' | 'left' | 'right'} position - Desired tooltip position.
 */
function positionTooltip(tooltipElement, targetElement, position) {
	const rect = targetElement.getBoundingClientRect();
	const tooltipRect = tooltipElement.getBoundingClientRect();
	const offset = 12;
	const arrowSize = 4;
	const viewportMargin = 8;

	let top, left;
	/** @type {number | null} */
	let arrowOffset = null;

	switch (position) {
		case 'top':
			top = rect.top - tooltipRect.height - offset + window.scrollY;
			left = rect.left + rect.width / 2 - tooltipRect.width / 2 + window.scrollX;

			const maxLeft = window.innerWidth - tooltipRect.width - viewportMargin + window.scrollX;
			const minLeft = viewportMargin + window.scrollX;

			if (left < minLeft) {
				arrowOffset = left - minLeft;
				left = minLeft;
			} else if (left > maxLeft) {
				arrowOffset = left - maxLeft;
				left = maxLeft;
			}

			addArrow(tooltipElement, 'bottom', arrowSize, arrowOffset);
			break;

		case 'bottom':
			top = rect.bottom + offset + window.scrollY;
			left = rect.left + rect.width / 2 - tooltipRect.width / 2 + window.scrollX;

			const maxLeftBottom = window.innerWidth - tooltipRect.width - viewportMargin + window.scrollX;
			const minLeftBottom = viewportMargin + window.scrollX;

			if (left < minLeftBottom) {
				arrowOffset = left - minLeftBottom;
				left = minLeftBottom;
			} else if (left > maxLeftBottom) {
				arrowOffset = left - maxLeftBottom;
				left = maxLeftBottom;
			}

			addArrow(tooltipElement, 'top', arrowSize, arrowOffset);
			break;

		case 'left':
			top = rect.top + rect.height / 2 - tooltipRect.height / 2 + window.scrollY;
			left = rect.left - tooltipRect.width - offset + window.scrollX;

			if (left < viewportMargin) {
				left = viewportMargin;
			}

			const maxTop = window.innerHeight - tooltipRect.height - viewportMargin;
			if (top < viewportMargin) {
				arrowOffset = top - viewportMargin;
				top = viewportMargin;
			} else if (top > maxTop) {
				arrowOffset = top - maxTop;
				top = maxTop;
			}

			addArrow(tooltipElement, 'right', arrowSize, arrowOffset);
			break;

		case 'right':
			top = rect.top + rect.height / 2 - tooltipRect.height / 2 + window.scrollY;
			left = rect.right + offset + window.scrollX;

			const maxLeftRight = window.innerWidth - tooltipRect.width - viewportMargin;
			if (left > maxLeftRight) {
				left = maxLeftRight;
			}

			const maxTopRight = window.innerHeight - tooltipRect.height - viewportMargin;
			if (top < viewportMargin) {
				arrowOffset = top - viewportMargin;
				top = viewportMargin;
			} else if (top > maxTopRight) {
				arrowOffset = top - maxTopRight;
				top = maxTopRight;
			}

			addArrow(tooltipElement, 'left', arrowSize, arrowOffset);
			break;
	}

	tooltipElement.style.top = `${top}px`;
	tooltipElement.style.left = `${left}px`;
}

/**
 * Appends a CSS-border-based arrow to the tooltip pointing toward the target element.
 * @param {HTMLElement} tooltipElement - The tooltip DOM element.
 * @param {'top' | 'bottom' | 'left' | 'right'} side - Which side of the tooltip the arrow appears on.
 * @param {number} size - Arrow size in pixels.
 * @param {number | null} [offset=null] - Pixel offset to shift the arrow when the tooltip was clamped to viewport.
 */
function addArrow(tooltipElement, side, size, offset = null) {
	const arrow = document.createElement('span');
	arrow.style.position = 'absolute';
	arrow.style.width = '0';
	arrow.style.height = '0';
	arrow.style.border = `${size}px solid transparent`;

	const tooltipBgColor = window.getComputedStyle(tooltipElement).backgroundColor;

	switch (side) {
		case 'top':
			arrow.style.bottom = '100%';
			arrow.style.left = '50%';
			if (offset !== null) {
				arrow.style.transform = `translateX(calc(-50% + ${offset}px))`;
			} else {
				arrow.style.transform = 'translateX(-50%)';
			}
			arrow.style.borderBottomColor = tooltipBgColor;
			break;

		case 'bottom':
			arrow.style.top = '100%';
			arrow.style.left = '50%';
			if (offset !== null) {
				arrow.style.transform = `translateX(calc(-50% + ${offset}px))`;
			} else {
				arrow.style.transform = 'translateX(-50%)';
			}
			arrow.style.borderTopColor = tooltipBgColor;
			break;

		case 'left':
			arrow.style.right = '100%';
			arrow.style.top = '50%';
			if (offset !== null) {
				arrow.style.transform = `translateY(calc(-50% + ${offset}px))`;
			} else {
				arrow.style.transform = 'translateY(-50%)';
			}
			arrow.style.borderRightColor = tooltipBgColor;
			break;

		case 'right':
			arrow.style.left = '100%';
			arrow.style.top = '50%';
			if (offset !== null) {
				arrow.style.transform = `translateY(calc(-50% + ${offset}px))`;
			} else {
				arrow.style.transform = 'translateY(-50%)';
			}
			arrow.style.borderLeftColor = tooltipBgColor;
			break;
	}

	tooltipElement.appendChild(arrow);
}
