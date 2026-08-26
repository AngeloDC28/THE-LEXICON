-- THE LEXICON — auth schema
-- Run once against the Neon database.
-- All cascades ensure delete from users removes everything.

create table if not exists users (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  created_at timestamptz not null default now(),
  last_login timestamptz
);

create table if not exists auth_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  token_hash text not null,        -- SHA-256 of the raw token sent in the email
  expires_at timestamptz not null, -- 15 minutes from creation
  used_at    timestamptz,          -- set on first use; subsequent uses rejected
  created_at timestamptz not null default now()
);
create index if not exists idx_auth_tokens_hash on auth_tokens(token_hash);

create table if not exists sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  token_hash text not null,        -- SHA-256 of the cookie value
  expires_at timestamptz not null, -- 30 days
  created_at timestamptz not null default now()
);
create index if not exists idx_sessions_hash on sessions(token_hash);

create table if not exists folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists folder_entries (
  id         uuid primary key default gen_random_uuid(),
  folder_id  uuid not null references folders(id) on delete cascade,
  entry_slug text not null,
  note       text,
  created_at timestamptz not null default now(),
  unique (folder_id, entry_slug)
);

-- Cleanup job: call this from a Vercel Cron or manually.
-- delete from auth_tokens where expires_at < now() or used_at is not null;
-- delete from sessions where expires_at < now();
