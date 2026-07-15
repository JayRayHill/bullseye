-- Bullseye Offense — Supabase schema for shared sent-history + customer notes.
--
-- Paste this whole file into the Supabase SQL Editor (https://app.supabase.com
-- → your project → SQL Editor → "New query") and click Run. Safe to re-run;
-- everything uses CREATE IF NOT EXISTS / CREATE OR REPLACE so reapplying after
-- edits won't blow away existing data.
--
-- Security model: the app uses the shared anon key (it's in the JS bundle,
-- gated behind the VITE_APP_PASSWORD shared-password sign-in). We enable RLS
-- but use permissive policies — anyone with the anon key (i.e., anyone who's
-- passed the sign-in gate) can read and write these tables. This matches the
-- threat model: keep arms-length attackers out, trust everyone inside the team.

-- ============================================================
-- Table: sent_history
-- ============================================================
-- One row per (lead, rep) contact event. lead_identity is the same string the
-- app builds via leadIdentity() — email-first, falling back to zip+name. Keying
-- on it (not on customer.id) means CSV re-uploads don't lose history.

create table if not exists sent_history (
  id uuid primary key default gen_random_uuid(),
  lead_identity text not null,
  lead_business_name text not null,
  anchor_customer_name text,
  template_id text,
  send_method text not null check (send_method in ('gmail', 'mailto', 'phone', 'text', 'in_person', 'other')),
  recorded_by text not null,
  -- The rep's typed name from Settings → "Your name". Lightweight identity,
  -- not Supabase Auth.
  emailed_at timestamptz not null default now()
);

-- Index for the most common read pattern: "is this lead in cooldown?"
create index if not exists sent_history_lead_identity_idx on sent_history(lead_identity);
create index if not exists sent_history_emailed_at_idx on sent_history(emailed_at desc);

-- ============================================================
-- Table: customer_notes
-- ============================================================
-- One row per lead identity. Unique constraint on lead_identity so upserts
-- replace the latest note instead of appending. Last-edited-by stamps each
-- update so the Settings → notes view can show "edited by Sarah, 2d ago".

create table if not exists customer_notes (
  id uuid primary key default gen_random_uuid(),
  lead_identity text not null unique,
  body text not null,
  customer_name text not null,
  last_edited_by text not null,
  updated_at timestamptz not null default now()
);

create index if not exists customer_notes_updated_at_idx on customer_notes(updated_at desc);

-- ============================================================
-- Row Level Security
-- ============================================================
-- Enable RLS so the tables aren't open-by-default if a policy ever gets
-- dropped. Then create permissive policies for the anon role (which is what
-- the JS client uses with VITE_SUPABASE_ANON_KEY).

alter table sent_history enable row level security;
alter table customer_notes enable row level security;

-- Drop-then-create pattern so re-running the script doesn't error on
-- duplicate policy names.

drop policy if exists "anon can select sent_history" on sent_history;
create policy "anon can select sent_history" on sent_history
  for select to anon, authenticated using (true);

drop policy if exists "anon can insert sent_history" on sent_history;
create policy "anon can insert sent_history" on sent_history
  for insert to anon, authenticated with check (true);

drop policy if exists "anon can update sent_history" on sent_history;
create policy "anon can update sent_history" on sent_history
  for update to anon, authenticated using (true) with check (true);

drop policy if exists "anon can delete sent_history" on sent_history;
create policy "anon can delete sent_history" on sent_history
  for delete to anon, authenticated using (true);

drop policy if exists "anon can select customer_notes" on customer_notes;
create policy "anon can select customer_notes" on customer_notes
  for select to anon, authenticated using (true);

drop policy if exists "anon can insert customer_notes" on customer_notes;
create policy "anon can insert customer_notes" on customer_notes
  for insert to anon, authenticated with check (true);

drop policy if exists "anon can update customer_notes" on customer_notes;
create policy "anon can update customer_notes" on customer_notes
  for update to anon, authenticated using (true) with check (true);

drop policy if exists "anon can delete customer_notes" on customer_notes;
create policy "anon can delete customer_notes" on customer_notes
  for delete to anon, authenticated using (true);

-- ============================================================
-- Realtime
-- ============================================================
-- Enable realtime for both tables so the app receives INSERT/UPDATE/DELETE
-- events over websocket. Each rep's browser subscribes via supabase.channel(...)
-- and merges updates into the local cache without polling.
--
-- Wrapped in DO blocks because ALTER PUBLICATION ... ADD TABLE errors
-- with 42710 (already member) on re-run. Idempotent: skip the ADD if the
-- table is already in the publication.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'sent_history'
  ) then
    alter publication supabase_realtime add table sent_history;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'customer_notes'
  ) then
    alter publication supabase_realtime add table customer_notes;
  end if;
end $$;
