-- Seed data: Dublin cafes
-- The handle_new_user trigger auto-creates the profile

-- A synthetic "system" user that owns the pre-seeded cafes.
-- Uses example.invalid (RFC 2606 reserved TLD) so the address is guaranteed
-- to be undeliverable even if the seed is ever run against a real instance.
insert into auth.users (id, email, email_confirmed_at, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000001',
  'seed@example.invalid',
  now(), now(), now()
) on conflict do nothing;

-- Insert cafes (coordinates are approximate Dublin locations)
insert into public.cafes (name, area, lat, lng, created_by) values
  ('3fe',                       'Grand Canal',          53.3393, -6.2480, '00000000-0000-0000-0000-000000000001'),
  ('Kaph',                      'Creative Quarter',     53.3427, -6.2633, '00000000-0000-0000-0000-000000000001'),
  ('Clement & Pekoe',           'South William St',     53.3419, -6.2636, '00000000-0000-0000-0000-000000000001'),
  ('Two Boys Brew',             'Phibsborough',         53.3600, -6.2733, '00000000-0000-0000-0000-000000000001'),
  ('Network',                   'Aungier St',           53.3392, -6.2661, '00000000-0000-0000-0000-000000000001'),
  ('Shoe Lane Coffee',          'Tara St',              53.3467, -6.2530, '00000000-0000-0000-0000-000000000001'),
  ('Bear Market',               'Blackrock',            53.3015, -6.1781, '00000000-0000-0000-0000-000000000001'),
  ('Cloud Picker',              'Pearse St',            53.3437, -6.2477, '00000000-0000-0000-0000-000000000001'),
  ('Coffeeangel',               'Trinity St',           53.3435, -6.2600, '00000000-0000-0000-0000-000000000001');
