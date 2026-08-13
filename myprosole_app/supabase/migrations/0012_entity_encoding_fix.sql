-- ============================================================
-- Migration 0012: HTML-Entity-Encoding Defence-in-Depth
-- ============================================================
-- Pentest-Agent V-05: Entity-kodierte Payloads wie &lt;script&gt;
-- passieren den bestehenden [<>]-Check. Zwar nicht ausnutzbar
-- (App rendert mit textContent), aber als Tiefenverteidigung
-- werden auch Entity-Formen blockiert.
-- ============================================================

-- ── display_name: bestehenden Constraint ersetzen ──────────
do $$ begin
  alter table public.profiles
    drop constraint if exists profiles_display_name_no_html;
  alter table public.profiles
    add constraint profiles_display_name_no_html
    check (
      display_name !~ '[<>]'
      and display_name !~* '&(lt|gt|amp|quot|#x?[0-9a-f]+);'
    );
exception when duplicate_object then null;
end $$;

-- ── pain_description: bestehenden Constraint ersetzen ──────
do $$ begin
  alter table public.training_diary_entries
    drop constraint if exists diary_pain_desc_no_html;
  alter table public.training_diary_entries
    add constraint diary_pain_desc_no_html
    check (
      pain_description is null
      or (
        pain_description !~ '[<>]'
        and pain_description !~* '&(lt|gt|amp|quot|#x?[0-9a-f]+);'
      )
    );
exception when duplicate_object then null;
end $$;
