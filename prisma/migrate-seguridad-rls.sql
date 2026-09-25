-- 25-09: cerrar la API publica de Supabase (PostgREST) sobre el esquema public.
--
-- La app NO usa esa API: entra con Prisma como `postgres`, que tiene BYPASSRLS,
-- asi que nada de esto la afecta. Pero con RLS apagado y el rol `anon` con
-- SELECT, cualquiera con la URL del proyecto y la llave publica (que no es
-- secreta) podia leer tablas como users (hash de contrasenas) o activity_logs.
--
-- 1) RLS encendido en TODAS las tablas de public, sin politicas: la API no ve
--    ninguna fila. 2) Sin permisos para anon/authenticated. 3) Lo mismo para las
--    tablas que se creen despues (privilegios por defecto). Idempotente.
--
-- Para deshacer (no deberia hacer falta): ALTER TABLE ... DISABLE ROW LEVEL SECURITY
-- y GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated.

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
