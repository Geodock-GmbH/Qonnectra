/**
 * @typedef {'left' | 'right'} PanelSide
 */

/**
 * Manages drag-to-resize for sidebar/drawer panels.
 * Uses pointer capture for reliable tracking across the viewport.
 */
export class PanelResizeManager {
	/** @type {number} */
	width = $state(0);

	/** @type {boolean} */
	isResizing = $state(false);

	/** @type {HTMLElement | undefined} */
	handleElement = $state();

	/** @type {number} */
	#minWidth;

	/** @type {number} */
	#maxWidthRatio;

	/** @type {PanelSide} */
	#side;

	/** @type {number} */
	#startX = 0;

	/** @type {number} */
	#startWidth = 0;

	/** @type {number | null} */
	#activePointerId = null;

	/** @type {((width: number) => void) | undefined} */
	#onResize;

	/**
	 * @param {{
	 *   defaultWidth: number,
	 *   minWidth?: number,
	 *   maxWidthRatio?: number,
	 *   side: PanelSide,
	 *   onResize?: (width: number) => void
	 * }} options
	 */
	constructor({ defaultWidth, minWidth = 200, maxWidthRatio = 0.5, side, onResize }) {
		this.width = defaultWidth;
		this.#minWidth = minWidth;
		this.#maxWidthRatio = maxWidthRatio;
		this.#side = side;
		this.#onResize = onResize;
	}

	get minWidth() {
		return this.#minWidth;
	}

	/** @param {number} width */
	#clamp(width) {
		const maxWidth = Math.floor(window.innerWidth * this.#maxWidthRatio);
		return Math.max(this.#minWidth, Math.min(width, maxWidth));
	}

	/** @param {PointerEvent} event */
	start = (event) => {
		if (event.pointerType === 'mouse' && event.button !== 0) return;

		this.isResizing = true;
		this.#activePointerId = event.pointerId;
		this.#startX = event.clientX;
		this.#startWidth = this.width;

		event.preventDefault();
		this.handleElement?.setPointerCapture?.(event.pointerId);

		if (event.pointerType === 'mouse') {
			document.body.style.cursor = 'col-resize';
		}
		document.body.style.userSelect = 'none';
	};

	/** @param {PointerEvent} event */
	move = (event) => {
		if (!this.isResizing) return;
		if (this.#activePointerId !== null && event.pointerId !== this.#activePointerId) return;

		const deltaX =
			this.#side === 'right' ? this.#startX - event.clientX : event.clientX - this.#startX;

		this.width = this.#clamp(this.#startWidth + deltaX);
		this.#onResize?.(this.width);
	};

	/** @param {PointerEvent} [event] */
	end = (event) => {
		this.isResizing = false;
		if (event && this.#activePointerId !== null && event.pointerId === this.#activePointerId) {
			try {
				this.handleElement?.releasePointerCapture?.(this.#activePointerId);
			} catch {
				// ignore if capture is already released
			}
		}
		this.#activePointerId = null;
		document.body.style.cursor = '';
		document.body.style.userSelect = '';
	};

	/**
	 * Registers document-level pointer listeners. Call from onMount.
	 * @returns {() => void} Cleanup function
	 */
	listen() {
		document.addEventListener('pointermove', this.move);
		document.addEventListener('pointerup', this.end);
		document.addEventListener('pointercancel', this.end);

		return () => {
			document.removeEventListener('pointermove', this.move);
			document.removeEventListener('pointerup', this.end);
			document.removeEventListener('pointercancel', this.end);
		};
	}
}
