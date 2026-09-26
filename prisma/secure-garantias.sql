-- Prisma db push creates the tables; this script closes Supabase Data API access.
-- The application connects as the database owner through Prisma.
ALTER TABLE public.tareas_garantias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tramos_garantias ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tareas_garantias, public.tramos_garantias FROM anon, authenticated;
