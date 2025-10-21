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
			tooltipElement.className = `tooltip tooltip-${position}`;
			tooltipElement.textContent = content;
			tooltipElement.setAttribute('role', 'tooltip');

			// Add styles
			Object.assign(tooltipElement.style, {
				position: 'absolute',
				backgroundColor: 'rgba(0, 0, 0, 0.9)',
				color: 'white',
				padding: '0.5rem 0.75rem',
				borderRadius: '0.25rem',
				fontSize: '0.875rem',
				whiteSpace: 'nowrap',
				zIndex: '1000',
				pointerEvents: 'none',
				boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
			});

			// Position the tooltip
			positionTooltip(tooltipElement, element, position);

			// Add to DOM
			document.body.appendChild(tooltipElement);
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

	let top, left;

	switch (position) {
		case 'top':
			top = rect.top - tooltipRect.height - offset + window.scrollY;
			left = rect.left + rect.width / 2 - tooltipRect.width / 2 + window.scrollX;
			addArrow(tooltipElement, 'bottom', arrowSize);
			break;

		case 'bottom':
			top = rect.bottom + offset + window.scrollY;
			left = rect.left + rect.width / 2 - tooltipRect.width / 2 + window.scrollX;
			addArrow(tooltipElement, 'top', arrowSize);
			break;

		case 'left':
			top = rect.top + rect.height / 2 - tooltipRect.height / 2 + window.scrollY;
			left = rect.left - tooltipRect.width - offset + window.scrollX;

			// Ensure tooltip doesn't go off-screen to the left
			if (left < 8) {
				left = 8;
			}

			addArrow(tooltipElement, 'right', arrowSize);
			break;

		case 'right':
			top = rect.top + rect.height / 2 - tooltipRect.height / 2 + window.scrollY;
			left = rect.right + offset + window.scrollX;
			addArrow(tooltipElement, 'left', arrowSize);
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
 */
function addArrow(tooltipElement, side, size) {
	const arrow = document.createElement('span');
	arrow.style.position = 'absolute';
	arrow.style.width = '0';
	arrow.style.height = '0';
	arrow.style.border = `${size}px solid transparent`;

	switch (side) {
		case 'top':
			arrow.style.bottom = '100%';
			arrow.style.left = '50%';
			arrow.style.transform = 'translateX(-50%)';
			arrow.style.borderBottomColor = 'rgba(0, 0, 0, 0.9)';
			break;

		case 'bottom':
			arrow.style.top = '100%';
			arrow.style.left = '50%';
			arrow.style.transform = 'translateX(-50%)';
			arrow.style.borderTopColor = 'rgba(0, 0, 0, 0.9)';
			break;

		case 'left':
			arrow.style.right = '100%';
			arrow.style.top = '50%';
			arrow.style.transform = 'translateY(-50%)';
			arrow.style.borderRightColor = 'rgba(0, 0, 0, 0.9)';
			break;

		case 'right':
			arrow.style.left = '100%';
			arrow.style.top = '50%';
			arrow.style.transform = 'translateY(-50%)';
			arrow.style.borderLeftColor = 'rgba(0, 0, 0, 0.9)';
			break;
	}

	tooltipElement.appendChild(arrow);
}
