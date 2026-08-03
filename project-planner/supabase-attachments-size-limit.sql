-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Server-side backstop for the 20 MB per-file attachment limit: the app
-- already checks this before uploading, but a bucket-level limit means
-- it's enforced even if that client-side check is ever bypassed.

update storage.buckets set file_size_limit = 20971520 where id = 'planner-attachments';
