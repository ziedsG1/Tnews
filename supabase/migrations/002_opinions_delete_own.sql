-- Allow each user to delete only their own opinions (run in Supabase SQL Editor if not applied).

drop policy if exists "opinions_delete_own" on public.public_opinions;
create policy "opinions_delete_own" on public.public_opinions
  for delete to authenticated
  using (auth.uid() = user_id);
