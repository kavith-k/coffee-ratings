import { describe, it, expect } from 'vitest';
import { isNavActive } from './nav';

/**
 * Bugs these tests catch:
 *   - Naive `startsWith` matching for the root href would mark every
 *     route as "Home active", since every pathname starts with '/'.
 *   - Substring matching (`/users/me` matching `/users/mentor`) would
 *     light up the wrong tab when usernames or slugs share a prefix.
 *   - Forgetting to treat the exact-match case for non-root tabs would
 *     break the active state on the tab's own index page.
 */
describe('isNavActive', () => {
	it('marks the root tab active on the root pathname', () => {
		expect(isNavActive('/', '/')).toBe(true);
	});

	it('does not mark the root tab active on a non-root pathname', () => {
		expect(isNavActive('/groups', '/')).toBe(false);
	});

	it('marks a non-root tab active on its exact pathname', () => {
		expect(isNavActive('/groups', '/groups')).toBe(true);
	});

	it('marks a non-root tab active on a nested child pathname', () => {
		expect(isNavActive('/groups/abc', '/groups')).toBe(true);
	});

	it('marks a non-root tab active on a sibling action route', () => {
		expect(isNavActive('/groups/new', '/groups')).toBe(true);
	});

	it('marks the feed tab active on its index', () => {
		expect(isNavActive('/feed', '/feed')).toBe(true);
	});

	it('marks the feed tab active on nested feed routes', () => {
		expect(isNavActive('/feed/items', '/feed')).toBe(true);
	});

	it('marks the map tab active on /map', () => {
		expect(isNavActive('/map', '/map')).toBe(true);
	});

	it('does not mark the map tab active on other routes', () => {
		expect(isNavActive('/groups', '/map')).toBe(false);
	});

	it('marks a dynamic profile tab active on its exact pathname', () => {
		expect(isNavActive('/users/me', '/users/me')).toBe(true);
	});

	it('does not confuse a sibling profile path for the active one', () => {
		expect(isNavActive('/users/other', '/users/me')).toBe(false);
	});

	it('marks the profile tab active on a nested edit route', () => {
		expect(isNavActive('/users/me/edit', '/users/me')).toBe(true);
	});
});
