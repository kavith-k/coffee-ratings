import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Admin client bypasses RLS
const admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY);

// Track created users for cleanup
const createdUserIds: string[] = [];

async function createTestUser(email: string): Promise<{
	id: string;
	client: SupabaseClient<Database>;
}> {
	const {
		data: { user },
		error
	} = await admin.auth.admin.createUser({
		email,
		email_confirm: true,
		password: 'test-password-123'
	});
	if (error || !user) throw new Error(`Failed to create user ${email}: ${error?.message}`);
	createdUserIds.push(user.id);

	// Create authenticated client for this user
	const client = createClient<Database>(SUPABASE_URL, ANON_KEY);
	const { error: signInError } = await client.auth.signInWithPassword({
		email,
		password: 'test-password-123'
	});
	if (signInError) throw new Error(`Failed to sign in ${email}: ${signInError.message}`);

	return { id: user.id, client };
}

// Shared test state
let alice: { id: string; client: SupabaseClient<Database> };
let bob: { id: string; client: SupabaseClient<Database> };
let charlie: { id: string; client: SupabaseClient<Database> };
let groupABId: string;
let groupABInviteCode: string;
let cafeId: string;

beforeAll(async () => {
	// Create three test users
	[alice, bob, charlie] = await Promise.all([
		createTestUser('alice@test.local'),
		createTestUser('bob@test.local'),
		createTestUser('charlie@test.local')
	]);

	// Alice creates a group (via admin to also insert as admin member)
	const { data: group } = await admin
		.from('groups')
		.insert({ name: 'Test Group AB', created_by: alice.id })
		.select()
		.single();
	if (!group) throw new Error('Failed to create group');
	groupABId = group.id;
	groupABInviteCode = group.invite_code;

	// Add Alice as admin and Bob as member
	await admin.from('group_members').insert([
		{ group_id: groupABId, user_id: alice.id, role: 'admin' },
		{ group_id: groupABId, user_id: bob.id, role: 'member' }
	]);

	// Create a test cafe (via admin)
	const { data: cafe } = await admin
		.from('cafes')
		.insert({ name: 'Test Cafe', area: 'Test Area', lat: 53.34, lng: -6.26, created_by: alice.id })
		.select()
		.single();
	if (!cafe) throw new Error('Failed to create cafe');
	cafeId = cafe.id;

	// Alice and Bob each rate the cafe
	await admin.from('ratings').insert([
		{ user_id: alice.id, cafe_id: cafeId, rating: 5.0 },
		{ user_id: bob.id, cafe_id: cafeId, rating: 3.0 }
	]);

	// Charlie rates the cafe too (but is not in any group with Alice/Bob)
	await admin.from('ratings').insert({ user_id: charlie.id, cafe_id: cafeId, rating: 7.0 });
}, 30000);

afterAll(async () => {
	// Clean up: delete test data, then users
	await admin.from('ratings').delete().in('user_id', createdUserIds);
	await admin.from('group_members').delete().in('user_id', createdUserIds);
	await admin.from('cafes').delete().eq('id', cafeId);
	await admin.from('groups').delete().eq('id', groupABId);
	await Promise.all(createdUserIds.map((id) => admin.auth.admin.deleteUser(id)));
}, 30000);

// ---------------------------------------------------------------------------
// RLS: Profiles
// ---------------------------------------------------------------------------
describe('RLS: profiles', () => {
	it('alice can see her own profile', async () => {
		const { data } = await alice.client.from('profiles').select().eq('id', alice.id);
		expect(data).toHaveLength(1);
		expect(data![0].display_name).toBe('alice');
	});

	it('alice can see bob (same group)', async () => {
		const { data } = await alice.client.from('profiles').select().eq('id', bob.id);
		expect(data).toHaveLength(1);
	});

	it('alice cannot see charlie (no shared group)', async () => {
		const { data } = await alice.client.from('profiles').select().eq('id', charlie.id);
		expect(data).toHaveLength(0);
	});

	it('charlie cannot see alice or bob', async () => {
		const { data } = await charlie.client.from('profiles').select().in('id', [alice.id, bob.id]);
		expect(data).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// RLS: Ratings
// ---------------------------------------------------------------------------
describe('RLS: ratings', () => {
	it('alice sees her own and bob ratings (same group)', async () => {
		const { data } = await alice.client.from('ratings').select().eq('cafe_id', cafeId);
		expect(data).toHaveLength(2);
		const userIds = data!.map((r) => r.user_id);
		expect(userIds).toContain(alice.id);
		expect(userIds).toContain(bob.id);
	});

	it('alice does not see charlie rating', async () => {
		const { data } = await alice.client.from('ratings').select().eq('cafe_id', cafeId);
		const userIds = data!.map((r) => r.user_id);
		expect(userIds).not.toContain(charlie.id);
	});

	it('charlie sees only own rating', async () => {
		const { data } = await charlie.client.from('ratings').select().eq('cafe_id', cafeId);
		expect(data).toHaveLength(1);
		expect(data![0].user_id).toBe(charlie.id);
	});
});

// ---------------------------------------------------------------------------
// RLS: Groups
// ---------------------------------------------------------------------------
describe('RLS: groups', () => {
	it('alice can see her group', async () => {
		const { data } = await alice.client.from('groups').select().eq('id', groupABId);
		expect(data).toHaveLength(1);
	});

	it('charlie cannot see the group', async () => {
		const { data } = await charlie.client.from('groups').select().eq('id', groupABId);
		expect(data).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// RPC: join_group_by_invite_code
// ---------------------------------------------------------------------------
describe('RPC: join_group_by_invite_code', () => {
	it('charlie can join the group via invite code', async () => {
		const { data: returnedGroupId, error } = await charlie.client.rpc('join_group_by_invite_code', {
			code: groupABInviteCode
		});
		expect(error).toBeNull();
		expect(returnedGroupId).toBe(groupABId);

		// Verify charlie is now a member
		const { data: members } = await admin
			.from('group_members')
			.select()
			.eq('group_id', groupABId)
			.eq('user_id', charlie.id);
		expect(members).toHaveLength(1);
		expect(members![0].role).toBe('member');
	});

	it('joining again is idempotent', async () => {
		const { data: returnedGroupId, error } = await charlie.client.rpc('join_group_by_invite_code', {
			code: groupABInviteCode
		});
		expect(error).toBeNull();
		expect(returnedGroupId).toBe(groupABId);
	});

	it('invalid invite code raises an error', async () => {
		const { error } = await charlie.client.rpc('join_group_by_invite_code', {
			code: 'nonexistent'
		});
		expect(error).not.toBeNull();
		expect(error!.message).toContain('Invalid invite code');
	});

	it('after joining, alice can now see charlie ratings', async () => {
		// Charlie joined in the test above, so now Alice should see all 3 ratings
		const { data } = await alice.client.from('ratings').select().eq('cafe_id', cafeId);
		expect(data).toHaveLength(3);
	});
});

// ---------------------------------------------------------------------------
// RPC: get_group_preview_by_invite_code
// ---------------------------------------------------------------------------
describe('RPC: get_group_preview_by_invite_code', () => {
	it('returns group name and member count', async () => {
		const { data, error } = await alice.client.rpc('get_group_preview_by_invite_code', {
			code: groupABInviteCode
		});
		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data![0].name).toBe('Test Group AB');
		// Alice, Bob, and Charlie (who joined in previous test)
		expect(data![0].member_count).toBe(3);
	});

	it('returns empty for invalid code', async () => {
		const { data, error } = await alice.client.rpc('get_group_preview_by_invite_code', {
			code: 'badcode'
		});
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// RPC: get_personalised_cafe_list
// ---------------------------------------------------------------------------
describe('RPC: get_personalised_cafe_list', () => {
	it('returns cafes with personalised averages', async () => {
		const { data, error } = await alice.client.rpc('get_personalised_cafe_list');
		expect(error).toBeNull();
		expect(data!.length).toBeGreaterThan(0);

		const testCafe = data!.find((c) => c.cafe_id === cafeId);
		expect(testCafe).toBeDefined();
		// Alice(5) + Bob(3) + Charlie(7) = 15/3 = 5.0 (all in same group now)
		expect(Number(testCafe!.avg_rating)).toBe(5.0);
		expect(Number(testCafe!.num_ratings)).toBe(3);
		expect(Number(testCafe!.num_raters)).toBe(3);
	});

	it('filters by area', async () => {
		const { data, error } = await alice.client.rpc('get_personalised_cafe_list', {
			p_area: 'Test Area'
		});
		expect(error).toBeNull();
		expect(data!.every((c) => c.area === 'Test Area')).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// RPC: search_cafes
// ---------------------------------------------------------------------------
describe('RPC: search_cafes', () => {
	it('finds cafes by fuzzy name match', async () => {
		const { data, error } = await alice.client.rpc('search_cafes', { query: 'Test Caf' });
		expect(error).toBeNull();
		expect(data!.length).toBeGreaterThan(0);
		expect(data![0].name).toBe('Test Cafe');
	});

	it('returns empty for nonsense query', async () => {
		const { data, error } = await alice.client.rpc('search_cafes', {
			query: 'xyzzynotacafe999'
		});
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// RPC: get_activity_feed
// ---------------------------------------------------------------------------
describe('RPC: get_activity_feed', () => {
	it('returns recent ratings from visible users', async () => {
		const { data, error } = await alice.client.rpc('get_activity_feed');
		expect(error).toBeNull();
		expect(data!.length).toBeGreaterThan(0);

		// All entries should have display names and cafe names
		for (const entry of data!) {
			expect(entry.display_name).toBeTruthy();
			expect(entry.cafe_name).toBeTruthy();
		}
	});

	it('respects cursor pagination', async () => {
		const { data: page1 } = await alice.client.rpc('get_activity_feed', { p_limit: 1 });
		expect(page1).toHaveLength(1);

		const { data: page2 } = await alice.client.rpc('get_activity_feed', {
			p_limit: 1,
			p_cursor: page1![0].created_at
		});
		expect(page2).toHaveLength(1);
		expect(page2![0].rating_id).not.toBe(page1![0].rating_id);
	});
});

// ---------------------------------------------------------------------------
// RPC: create_group
// ---------------------------------------------------------------------------
describe('RPC: create_group', () => {
	const createdGroupIds: string[] = [];

	afterAll(async () => {
		if (createdGroupIds.length > 0) {
			await admin.from('groups').delete().in('id', createdGroupIds);
		}
	});

	it('creates a group and adds the caller as admin atomically', async () => {
		const { data: newGroupId, error } = await alice.client.rpc('create_group', {
			p_name: 'Alice Second Group'
		});
		expect(error).toBeNull();
		expect(newGroupId).toBeTruthy();
		createdGroupIds.push(newGroupId!);

		// Verify the group row exists with correct ownership
		const { data: groups } = await admin.from('groups').select().eq('id', newGroupId!);
		expect(groups).toHaveLength(1);
		expect(groups![0].name).toBe('Alice Second Group');
		expect(groups![0].created_by).toBe(alice.id);

		// Verify exactly one membership row exists -- the creator as admin
		const { data: members } = await admin
			.from('group_members')
			.select()
			.eq('group_id', newGroupId!);
		expect(members).toHaveLength(1);
		expect(members![0].user_id).toBe(alice.id);
		expect(members![0].role).toBe('admin');
	});

	it('trims whitespace from group name', async () => {
		const { data: newGroupId, error } = await alice.client.rpc('create_group', {
			p_name: '   Spaced Out   '
		});
		expect(error).toBeNull();
		createdGroupIds.push(newGroupId!);

		const { data: groups } = await admin.from('groups').select().eq('id', newGroupId!);
		expect(groups![0].name).toBe('Spaced Out');
	});

	it('rejects empty group names', async () => {
		const { error } = await alice.client.rpc('create_group', { p_name: '' });
		expect(error).not.toBeNull();
		expect(error!.message).toMatch(/empty/i);
	});

	it('rejects whitespace-only group names', async () => {
		const { error } = await alice.client.rpc('create_group', { p_name: '   ' });
		expect(error).not.toBeNull();
		expect(error!.message).toMatch(/empty/i);
	});

	it('rejects group names longer than 100 characters', async () => {
		const { error } = await alice.client.rpc('create_group', { p_name: 'x'.repeat(101) });
		expect(error).not.toBeNull();
		expect(error!.message).toMatch(/too long/i);
	});

	it('rejects unauthenticated callers', async () => {
		const anon = createClient<Database>(SUPABASE_URL, ANON_KEY);
		const { error } = await anon.rpc('create_group', { p_name: 'Anonymous Group' });
		expect(error).not.toBeNull();
		expect(error!.message).toMatch(/not authenticated/i);
	});
});

// ---------------------------------------------------------------------------
// RLS: direct inserts into groups/group_members are blocked
//
// This is the security-critical invariant: the only path to create a group
// or join a group is via the `create_group` / `join_group_by_invite_code`
// RPCs. A client cannot bypass the invite mechanism by guessing or leaking
// a group UUID and inserting into `group_members` directly.
// ---------------------------------------------------------------------------
describe('RLS: direct inserts are blocked for groups and group_members', () => {
	let orphanGroupId: string;

	beforeAll(async () => {
		// Create a group that nobody in the test is a member of, so we can try
		// to sneak alice/bob/charlie into it via a direct insert.
		const { data: group } = await admin
			.from('groups')
			.insert({ name: 'Orphan Group', created_by: alice.id })
			.select()
			.single();
		orphanGroupId = group!.id;
	});

	afterAll(async () => {
		await admin.from('groups').delete().eq('id', orphanGroupId);
	});

	it('an authenticated user cannot insert directly into groups', async () => {
		const { error } = await alice.client
			.from('groups')
			.insert({ name: 'Direct Insert', created_by: alice.id });
		expect(error).not.toBeNull();
	});

	it('an authenticated user cannot add themselves directly to a group they know the ID of', async () => {
		// Charlie knows orphanGroupId but has no invite to it.
		// Before the fix this would have succeeded because the old RLS policy
		// only checked `user_id = auth.uid()`.
		const { error } = await charlie.client
			.from('group_members')
			.insert({ group_id: orphanGroupId, user_id: charlie.id });
		expect(error).not.toBeNull();

		const { data: members } = await admin
			.from('group_members')
			.select()
			.eq('group_id', orphanGroupId)
			.eq('user_id', charlie.id);
		expect(members).toHaveLength(0);
	});

	it('a user cannot insert someone else into a group either', async () => {
		const { error } = await alice.client
			.from('group_members')
			.insert({ group_id: orphanGroupId, user_id: bob.id });
		expect(error).not.toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Auth guards: RPCs that touch user data reject anonymous callers
// ---------------------------------------------------------------------------
describe('Anonymous RPC access', () => {
	const anon = createClient<Database>(SUPABASE_URL, ANON_KEY);

	it('search_cafes rejects anonymous callers', async () => {
		const { error } = await anon.rpc('search_cafes', { query: 'Test' });
		expect(error).not.toBeNull();
		expect(error!.message).toMatch(/not authenticated/i);
	});

	it('get_personalised_cafe_list rejects anonymous callers', async () => {
		const { error } = await anon.rpc('get_personalised_cafe_list');
		expect(error).not.toBeNull();
		expect(error!.message).toMatch(/not authenticated/i);
	});

	it('get_activity_feed rejects anonymous callers', async () => {
		const { error } = await anon.rpc('get_activity_feed');
		expect(error).not.toBeNull();
		expect(error!.message).toMatch(/not authenticated/i);
	});

	it('get_cafe_personalised_average rejects anonymous callers', async () => {
		const { error } = await anon.rpc('get_cafe_personalised_average', { p_cafe_id: cafeId });
		expect(error).not.toBeNull();
		expect(error!.message).toMatch(/not authenticated/i);
	});

	it('join_group_by_invite_code rejects anonymous callers', async () => {
		const { error } = await anon.rpc('join_group_by_invite_code', { code: groupABInviteCode });
		expect(error).not.toBeNull();
		expect(error!.message).toMatch(/not authenticated/i);
	});

	it('get_group_preview_by_invite_code REMAINS accessible to anonymous callers', async () => {
		// This one is deliberately public -- it powers the pre-signup invite
		// landing page. Regression-test that we don't accidentally lock it.
		const { data, error } = await anon.rpc('get_group_preview_by_invite_code', {
			code: groupABInviteCode
		});
		expect(error).toBeNull();
		expect(data).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// Limit clamping: RPCs that accept a limit cap it server-side so a client
// cannot request an unbounded response
// ---------------------------------------------------------------------------
describe('RPC limit clamping', () => {
	it('get_personalised_cafe_list caps p_limit at 100', async () => {
		const { data, error } = await alice.client.rpc('get_personalised_cafe_list', {
			p_limit: 999999
		});
		expect(error).toBeNull();
		expect(data!.length).toBeLessThanOrEqual(100);
	});

	it('get_activity_feed caps p_limit at 100', async () => {
		const { data, error } = await alice.client.rpc('get_activity_feed', { p_limit: 999999 });
		expect(error).toBeNull();
		expect(data!.length).toBeLessThanOrEqual(100);
	});

	it('search_cafes caps result_limit at 50', async () => {
		const { data, error } = await alice.client.rpc('search_cafes', {
			query: 'a',
			result_limit: 999999
		});
		expect(error).toBeNull();
		expect(data!.length).toBeLessThanOrEqual(50);
	});
});

// ---------------------------------------------------------------------------
// Schema constraints: display_name length + cafes.created_by nullability
// ---------------------------------------------------------------------------
describe('Schema constraints', () => {
	it('profiles.display_name is capped at 50 characters', async () => {
		const longName = 'a'.repeat(51);
		// admin client bypasses RLS but check constraints still apply
		const { error } = await admin
			.from('profiles')
			.update({ display_name: longName })
			.eq('id', alice.id);
		expect(error).not.toBeNull();
	});

	it('profiles.display_name cannot be empty', async () => {
		const { error } = await admin.from('profiles').update({ display_name: '' }).eq('id', alice.id);
		expect(error).not.toBeNull();
	});

	it('a user with created cafes can still be deleted (created_by goes null)', async () => {
		// Regression test for the bug where `created_by uuid not null ... on delete set null`
		// caused user deletion to fail with a NOT NULL violation.
		const { data: tempUser } = await admin.auth.admin.createUser({
			email: 'temp-cafe-creator@test.local',
			email_confirm: true,
			password: 'TempPassword123Xyz'
		});
		expect(tempUser.user).toBeTruthy();
		const tempUserId = tempUser.user!.id;

		const { data: tempCafe, error: insertError } = await admin
			.from('cafes')
			.insert({
				name: 'Temp Cafe',
				area: 'Nowhere',
				lat: 0,
				lng: 0,
				created_by: tempUserId
			})
			.select()
			.single();
		expect(insertError).toBeNull();
		const tempCafeId = tempCafe!.id;

		// Deleting the user should succeed and null out the cafe's created_by.
		const { error: deleteError } = await admin.auth.admin.deleteUser(tempUserId);
		expect(deleteError).toBeNull();

		const { data: orphanedCafe } = await admin.from('cafes').select().eq('id', tempCafeId).single();
		expect(orphanedCafe).toBeTruthy();
		expect(orphanedCafe!.created_by).toBeNull();

		// Cleanup
		await admin.from('cafes').delete().eq('id', tempCafeId);
	});
});
