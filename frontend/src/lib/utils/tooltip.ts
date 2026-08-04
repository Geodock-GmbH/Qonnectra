type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipOptions {
	position?: TooltipPosition;
	delay?: number;
	disabled?: boolean;
}

/**
 * Creates a tooltip attachment for use with the Svelte 5 `{@attach}` directive.
 * Manages tooltip lifecycle (show/hide/position) via mouse events.
 *
 * @example
 * ```svelte
 * <button {@attach tooltip('Click me!')}>Button</button>
 * <button {@attach tooltip('Bottom tooltip', { position: 'bottom' })}>Button</button>
 * ```
 */
export function tooltip(
	content: string | undefined,
	options: TooltipOptions = {}
): (element: HTMLElement) => () => void {
	const { position = 'top', delay = 200, disabled = false } = options;

	return (element) => {
		if (disabled) {
			return () => {};
		}

		let tooltipElement: HTMLSpanElement | null = null;
		let timeoutId: ReturnType<typeof setTimeout> | null = null;

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
 */
function positionTooltip(
	tooltipElement: HTMLElement,
	targetElement: HTMLElement,
	position: TooltipPosition
): void {
	const rect = targetElement.getBoundingClientRect();
	const tooltipRect = tooltipElement.getBoundingClientRect();
	const offset = 12;
	const arrowSize = 4;
	const viewportMargin = 8;

	let top: number, left: number;
	let arrowOffset: number | null = null;

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
 */
function addArrow(
	tooltipElement: HTMLElement,
	side: TooltipPosition,
	size: number,
	offset: number | null = null
): void {
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
