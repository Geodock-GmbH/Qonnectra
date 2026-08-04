type PanelSide = 'left' | 'right';

/**
 * Manages drag-to-resize for sidebar/drawer panels.
 * Uses pointer capture for reliable tracking across the viewport.
 */
export class PanelResizeManager {
	width: number = $state(0);
	isResizing: boolean = $state(false);
	handleElement: HTMLElement | undefined = $state();

	#minWidth: number;
	#maxWidthRatio: number;
	#side: PanelSide;
	#startX: number = 0;
	#startWidth: number = 0;
	#activePointerId: number | null = null;
	#onResize: ((width: number) => void) | undefined;

	constructor({
		defaultWidth,
		minWidth = 200,
		maxWidthRatio = 0.5,
		side,
		onResize
	}: {
		defaultWidth: number;
		minWidth?: number;
		maxWidthRatio?: number;
		side: PanelSide;
		onResize?: (width: number) => void;
	}) {
		this.width = defaultWidth;
		this.#minWidth = minWidth;
		this.#maxWidthRatio = maxWidthRatio;
		this.#side = side;
		this.#onResize = onResize;
	}

	get minWidth(): number {
		return this.#minWidth;
	}

	#clamp(width: number): number {
		const maxWidth = Math.floor(window.innerWidth * this.#maxWidthRatio);
		return Math.max(this.#minWidth, Math.min(width, maxWidth));
	}

	start = (event: PointerEvent): void => {
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

	move = (event: PointerEvent): void => {
		if (!this.isResizing) return;
		if (this.#activePointerId !== null && event.pointerId !== this.#activePointerId) return;

		const deltaX =
			this.#side === 'right' ? this.#startX - event.clientX : event.clientX - this.#startX;

		this.width = this.#clamp(this.#startWidth + deltaX);
		this.#onResize?.(this.width);
	};

	end = (event?: PointerEvent): void => {
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
	 * @returns Cleanup function
	 */
	listen(): () => void {
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
