-- Runs once on first container start (empty data volume only).
-- Ensures role zas can use schema public (helps on some PostgreSQL defaults).

GRANT ALL PRIVILEGES ON SCHEMA public TO zas;
ALTER DEFAULT PRIVILEGES FOR ROLE zas IN SCHEMA public GRANT ALL ON TABLES TO zas;
ALTER DEFAULT PRIVILEGES FOR ROLE zas IN SCHEMA public GRANT ALL ON SEQUENCES TO zas;
