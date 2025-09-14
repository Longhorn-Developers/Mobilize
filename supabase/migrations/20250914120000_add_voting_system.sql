
-- Migration for adding voting system to avoidance areas

-- 1. Create the votes table
create table
  public.avoidance_area_votes (
    id uuid not null default gen_random_uuid (),
    created_at timestamp with time zone not null default now(),
    user_id uuid not null,
    avoidance_area_id uuid not null,
    is_upvote boolean not null,
    constraint avoidance_area_votes_pkey primary key (id),
    constraint avoidance_area_votes_avoidance_area_id_fkey foreign key (avoidance_area_id) references avoidance_areas (id) on update cascade on delete cascade,
    constraint avoidance_area_votes_user_id_fkey foreign key (user_id) references profiles (id) on update cascade on delete cascade,
    constraint unique_user_vote unique (user_id, avoidance_area_id)
  );

-- 2. Add upvote/downvote counts to avoidance_areas table
alter table public.avoidance_areas
add column upvote_count integer not null default 0,
add column downvote_count integer not null default 0;

-- 3. Create a function to handle votes
create or replace function handle_vote(area_id uuid, user_id_in uuid, is_upvote_in boolean)
returns void as $$
declare
  existing_vote boolean;
begin
  -- Check if a vote already exists
  select is_upvote into existing_vote
  from avoidance_area_votes
  where avoidance_area_id = area_id and user_id = user_id_in;

  if existing_vote is not null then
    -- Vote exists, check if it's different
    if existing_vote != is_upvote_in then
      -- Update the vote
      update avoidance_area_votes
      set is_upvote = is_upvote_in
      where avoidance_area_id = area_id and user_id = user_id_in;
    else
      -- Same vote, so we'll treat it as a "delete" or "unvote"
      delete from avoidance_area_votes
      where avoidance_area_id = area_id and user_id = user_id_in;
    end if;
  else
    -- No vote exists, insert a new one
    insert into avoidance_area_votes (avoidance_area_id, user_id, is_upvote)
    values (area_id, user_id_in, is_upvote_in);
  end if;

  -- Recalculate counts
  update avoidance_areas
  set
    upvote_count = (select count(*) from avoidance_area_votes where avoidance_area_id = area_id and is_upvote = true),
    downvote_count = (select count(*) from avoidance_area_votes where avoidance_area_id = area_id and is_upvote = false)
  where id = area_id;

  -- Deactivate if downvote threshold is met
  if (select downvote_count from avoidance_areas where id = area_id) >= 3 then
    update avoidance_areas
    set is_active = false
    where id = area_id;
  end if;
end;
$$ language plpgsql;

-- 4. RLS policies for avoidance_area_votes
alter table public.avoidance_area_votes enable row level security;

create policy "Allow authenticated users to insert votes"
on public.avoidance_area_votes
for insert to authenticated with check (true);

create policy "Allow users to update their own votes"
on public.avoidance_area_votes
for update using (auth.uid() = user_id);

create policy "Allow users to delete their own votes"
on public.avoidance_area_votes
for delete using (auth.uid() = user_id);

create policy "Allow all users to view votes"
on public.avoidance_area_votes
for select using (true);
