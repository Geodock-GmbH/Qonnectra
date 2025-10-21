/**
 * Creates a tooltip attachment that can be used with {@attach} directive
 * Based on Svelte 5 {@attach} pattern
 *
 * @param {string} content - The tooltip text content
 * @param {Object} [options] - Tooltip options
 * @param {'top' | 'bottom' | 'left' | 'right'} [options.position='top'] - Position of the tooltip
 * @param {number} [options.delay=200] - Delay in milliseconds before showing tooltip
 * @returns {import('svelte/attachments').Attachment}
 *
 * @example
 * ```svelte
 * <button {@attach tooltip('Click me!')}>Button</button>
 * <button {@attach tooltip('Bottom tooltip', { position: 'bottom' })}>Button</button>
 * ```
 */
export function tooltip(content, options = {}) {
	const { position = 'top', delay = 200 } = options;

	return (element) => {
		let tooltipElement = null;
		let timeoutId = null;

		/**
		 * Creates and shows the tooltip
		 */
		function showTooltip() {
			// Create tooltip element
			tooltipElement = document.createElement('span');
			tooltipElement.className = `tooltip tooltip-${position} bg-surface-100-900 text-surface-900-100 px-3 py-2 rounded text-sm whitespace-nowrap shadow-lg z-[1000] pointer-events-none`;
			tooltipElement.textContent = content;
			tooltipElement.setAttribute('role', 'tooltip');

			// Add minimal required styles for positioning
			Object.assign(tooltipElement.style, {
				position: 'absolute',
				visibility: 'hidden' // Hide initially to get accurate dimensions
			});

			// Add to DOM first to get accurate dimensions
			document.body.appendChild(tooltipElement);

			// Position the tooltip after it's in the DOM
			positionTooltip(tooltipElement, element, position);

			// Make visible after positioning
			tooltipElement.style.visibility = 'visible';
		}

		/**
		 * Removes the tooltip from DOM
		 */
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

		/**
		 * Mouse enter handler
		 */
		function handleMouseEnter() {
			timeoutId = setTimeout(showTooltip, delay);
		}

		/**
		 * Mouse leave handler
		 */
		function handleMouseLeave() {
			hideTooltip();
		}

		// Add event listeners
		element.addEventListener('mouseenter', handleMouseEnter);
		element.addEventListener('mouseleave', handleMouseLeave);

		// Ensure element has relative positioning context
		const originalPosition = window.getComputedStyle(element).position;
		if (originalPosition === 'static') {
			element.style.position = 'relative';
		}

		// Cleanup function
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
 * Positions the tooltip element relative to the target element
 * @param {HTMLElement} tooltipElement
 * @param {HTMLElement} targetElement
 * @param {'top' | 'bottom' | 'left' | 'right'} position
 */
function positionTooltip(tooltipElement, targetElement, position) {
	const rect = targetElement.getBoundingClientRect();
	const tooltipRect = tooltipElement.getBoundingClientRect();
	const offset = 12;
	const arrowSize = 4;
	const viewportMargin = 8; // Minimum distance from viewport edge

	let top, left;
	let arrowOffset = null; // Track if arrow needs repositioning

	switch (position) {
		case 'top':
			top = rect.top - tooltipRect.height - offset + window.scrollY;
			left = rect.left + rect.width / 2 - tooltipRect.width / 2 + window.scrollX;

			// Ensure tooltip doesn't go off-screen horizontally
			const maxLeft = window.innerWidth - tooltipRect.width - viewportMargin + window.scrollX;
			const minLeft = viewportMargin + window.scrollX;

			if (left < minLeft) {
				arrowOffset = left - minLeft; // Track how much we shifted
				left = minLeft;
			} else if (left > maxLeft) {
				arrowOffset = left - maxLeft; // Track how much we shifted
				left = maxLeft;
			}

			addArrow(tooltipElement, 'bottom', arrowSize, arrowOffset);
			break;

		case 'bottom':
			top = rect.bottom + offset + window.scrollY;
			left = rect.left + rect.width / 2 - tooltipRect.width / 2 + window.scrollX;

			// Ensure tooltip doesn't go off-screen horizontally
			const maxLeftBottom = window.innerWidth - tooltipRect.width - viewportMargin + window.scrollX;
			const minLeftBottom = viewportMargin + window.scrollX;

			if (left < minLeftBottom) {
				arrowOffset = left - minLeftBottom; // Track how much we shifted
				left = minLeftBottom;
			} else if (left > maxLeftBottom) {
				arrowOffset = left - maxLeftBottom; // Track how much we shifted
				left = maxLeftBottom;
			}

			addArrow(tooltipElement, 'top', arrowSize, arrowOffset);
			break;

		case 'left':
			top = rect.top + rect.height / 2 - tooltipRect.height / 2 + window.scrollY;
			left = rect.left - tooltipRect.width - offset + window.scrollX;

			// Ensure tooltip doesn't go off-screen horizontally
			if (left < viewportMargin) {
				left = viewportMargin;
			}

			// Ensure tooltip doesn't go off-screen vertically
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

			// Ensure tooltip doesn't go off-screen horizontally
			const maxLeftRight = window.innerWidth - tooltipRect.width - viewportMargin;
			if (left > maxLeftRight) {
				left = maxLeftRight;
			}

			// Ensure tooltip doesn't go off-screen vertically
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
 * Adds an arrow to the tooltip
 * @param {HTMLElement} tooltipElement
 * @param {'top' | 'bottom' | 'left' | 'right'} side
 * @param {number} size
 * @param {number|null} offset - Offset in pixels to shift the arrow (used when tooltip is repositioned to stay in viewport)
 */
function addArrow(tooltipElement, side, size, offset = null) {
	const arrow = document.createElement('span');
	arrow.style.position = 'absolute';
	arrow.style.width = '0';
	arrow.style.height = '0';
	arrow.style.border = `${size}px solid transparent`;

	// Get the computed background color from the tooltip to match theme
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
