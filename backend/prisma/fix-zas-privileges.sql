-- Fix: User `zas` was denied access on the database `zas` / schema `public`
--
-- Run as a PostgreSQL superuser (often `postgres`), not as `zas`:
--   psql "postgresql://postgres:PASSWORD@HOST:5432/postgres" -v ON_ERROR_STOP=1 -f prisma/fix-zas-privileges.sql
--
-- Local Docker (official image): if this still happens, reset the data volume once:
--   docker compose down -v && docker compose up -d db
--
-- Then: npm run db:push && npm run db:seed

GRANT CONNECT ON DATABASE zas TO zas;
GRANT ALL PRIVILEGES ON DATABASE zas TO zas;

\c zas

GRANT USAGE, CREATE ON SCHEMA public TO zas;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO zas;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO zas;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO zas;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO zas;

-- If tables are owned by another role, optionally (superuser only):
-- ALTER SCHEMA public OWNER TO zas;
