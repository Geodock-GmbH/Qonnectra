/**
 * Viewport width in px from which the desktop app shell applies (sidebar,
 * side drawer, floating map panels). Below it phones and portrait tablets get
 * the phone layout. Mirrors `--breakpoint-desktop` in app.css.
 */
export const DESKTOP_LAYOUT_MIN_WIDTH = 1024;

/**
 * Tells whether a viewport width gets the phone layout.
 * @param width - Viewport width in px; undefined (server render) counts as phone.
 * @returns True below the desktop breakpoint.
 */
export function isPhoneLayout(width: number | undefined): boolean {
	return (width ?? 0) < DESKTOP_LAYOUT_MIN_WIDTH;
}
