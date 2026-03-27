-- Realtime для fridge_states (синхрон готовых блюд и прочего JSON между членами семьи).
-- В Dashboard: Replication → проверьте, что fridge_states в publication (или выполните блок ниже).

do $$
begin
  alter publication supabase_realtime add table public.fridge_states;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- Полные строки в WAL для Realtime (в payload UPDATE приходят все поля, в т.ч. state JSON)
alter table public.fridge_states replica identity full;
