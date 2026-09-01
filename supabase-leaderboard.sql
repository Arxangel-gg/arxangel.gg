-- ============================================================================
-- ARXAIM GLOBAL LEADERBOARD — run this WHOLE script in Supabase → SQL Editor.
-- Rebuilds public.arxtrainerscores with the exact shape the game expects and
-- creates the secure submit function. Safe to re-run any time (idempotent),
-- but NOTE: the DROP wipes any rows already in the table.
--
-- Security model: the anon key may only READ the board. All writes go through
-- submit_arxtrainer_score(), which sanitizes callsigns, validates mode /
-- duration / platform, rejects impossible scores, and keeps only each
-- callsign's best score per board. Raw INSERT/UPDATE/DELETE from the client
-- are blocked by row-level security (no write policies exist).
-- ============================================================================

drop table if exists public.arxtrainerscores cascade;

create table public.arxtrainerscores (
  id         bigint generated always as identity primary key,
  name       text        not null check (char_length(name) between 2 and 14),
  mode       text        not null check (mode in ('gridshot','flick','precision','tracking','reflex')),
  dur        integer     not null check (dur in (30, 60, 120)),
  platform   text        not null default 'desktop' check (platform in ('desktop','mobile')),
  score      integer     not null check (score > 0),
  created_at timestamptz not null default now(),
  unique (mode, dur, name)          -- one slot per callsign per board
);

-- fast top-N reads per board
create index arxtrainerscores_board_idx
  on public.arxtrainerscores (mode, dur, score desc);

alter table public.arxtrainerscores enable row level security;

-- the public may READ the board…
create policy "public read" on public.arxtrainerscores
  for select using (true);
-- …but there are intentionally NO insert/update/delete policies:
-- every write must go through the function below.

create or replace function public.submit_arxtrainer_score(
  p_name text, p_mode text, p_dur integer, p_score integer, p_platform text default 'desktop'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name     text;
  v_platform text;
  v_cap      integer;
  v_existing integer;
  v_improved boolean := true;
  v_rank     integer;
  v_top      jsonb;
begin
  -- sanitize callsign: safe charset only, collapse spaces, 14 chars, uppercase
  v_name := btrim(upper(left(
    regexp_replace(regexp_replace(coalesce(p_name, ''), '[^\w \-''.]', '', 'g'), '\s+', ' ', 'g'),
  14)));
  if char_length(v_name) < 2 then
    raise exception 'callsign too short';
  end if;

  if p_mode not in ('gridshot','flick','precision','tracking','reflex') then
    raise exception 'bad mode';
  end if;
  if p_dur not in (30, 60, 120) then
    raise exception 'bad duration';
  end if;

  v_platform := case when p_platform = 'mobile' then 'mobile' else 'desktop' end;

  -- max plausible points/second per mode — anything above is rejected
  v_cap := p_dur * case p_mode
    when 'gridshot'  then 800
    when 'flick'     then 2200
    when 'precision' then 2600
    when 'tracking'  then 115
    when 'reflex'    then 950
  end;
  if p_score is null or p_score <= 0 or p_score > v_cap then
    raise exception 'score rejected';
  end if;

  -- keep-best-per-callsign upsert
  select score into v_existing
    from arxtrainerscores
   where mode = p_mode and dur = p_dur and name = v_name;

  if found and v_existing >= p_score then
    v_improved := false;   -- their old score was better; board unchanged
  else
    insert into arxtrainerscores (name, mode, dur, platform, score)
    values (v_name, p_mode, p_dur, v_platform, p_score)
    on conflict (mode, dur, name)
    do update set score = excluded.score, platform = excluded.platform, created_at = now();
  end if;

  -- rank across the whole board (all platforms)
  select count(*) + 1 into v_rank
    from arxtrainerscores
   where mode = p_mode and dur = p_dur
     and score > (select score from arxtrainerscores
                   where mode = p_mode and dur = p_dur and name = v_name);

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', t.name, 'score', t.score, 'platform', t.platform)), '[]'::jsonb)
    into v_top
    from (select name, score, platform
            from arxtrainerscores
           where mode = p_mode and dur = p_dur
           order by score desc
           limit 10) t;

  return jsonb_build_object('rank', v_rank, 'improved', v_improved, 'top', v_top);
end;
$$;

revoke all on function public.submit_arxtrainer_score(text, text, integer, integer, text) from public;
grant execute on function public.submit_arxtrainer_score(text, text, integer, integer, text) to anon, authenticated;
