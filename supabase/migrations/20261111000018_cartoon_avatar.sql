-- Cartoon avatar (Bitmoji-style) as an alternative to a profile photo.
-- avatar_config holds the builder choices (small JSON object); avatar_kind says which one the profile shows.

alter table public.profiles add column avatar_config jsonb;
alter table public.profiles add column avatar_kind text;
alter table public.profiles add constraint profiles_avatar_config_small
  check (avatar_config is null or (jsonb_typeof(avatar_config) = 'object' and pg_column_size(avatar_config) < 2048));
alter table public.profiles add constraint profiles_avatar_kind_check
  check (avatar_kind is null or avatar_kind in ('photo', 'cartoon'));
-- existing photos stay the chosen picture
update public.profiles set avatar_kind = 'photo' where avatar_path is not null;
