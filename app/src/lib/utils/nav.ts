/**
 * Returns true when the given pathname should mark the tab whose link
 * target is `tabHref` as active.
 *
 * Rules:
 *   - For the root tab (`/`) we require an exact match. Otherwise every
 *     pathname would light up the home tab, since every URL begins with
 *     a slash.
 *   - For any other tab we accept either an exact match or a strict
 *     child path (i.e. `tabHref + '/'`). The trailing-slash check stops
 *     `/users/me` from accidentally matching `/users/mentor`.
 */
export function isNavActive(pathname: string, tabHref: string): boolean {
	if (tabHref === '/') {
		return pathname === '/';
	}
	return pathname === tabHref || pathname.startsWith(tabHref + '/');
}
