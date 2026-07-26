-- ============================================================================
--  Restricted role for the natural-language SQL agent.
--
--  Run once as a superuser against the application database:
--      psql -U postgres -d multiagent -v ai_password="'<strong-password>'" \
--           -f scripts/create_readonly_role.sql
--
--  Threat model
--  ------------
--  The SQL agent executes text produced by an LLM, which is attacker-influenced
--  (the user writes the question). The database — not the application — is the
--  security boundary. Three independent controls:
--
--    1. NOSUPERUSER          -> blocks pg_read_file() and friends reading the disk
--    2. Table grants         -> `users` is unreachable, so password hashes cannot
--                               be selected even by a perfectly valid query
--    3. Row-Level Security   -> a user can only see their OWN rows in the tables
--                               that are readable. Read-only + an allowlist alone
--                               would still expose every other tenant's data.
--
--  RLS is keyed on the `app.current_user_id` session GUC, which the application
--  sets per transaction. It uses the two-argument form of current_setting() so an
--  unset variable yields NULL rather than an error, and the comparison then fails
--  closed (NULL = anything is NULL, so no rows match).
-- ============================================================================

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- 1. Role
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_readonly') THEN
        EXECUTE format('CREATE ROLE ai_readonly LOGIN PASSWORD %L', :ai_password);
    ELSE
        EXECUTE format('ALTER ROLE ai_readonly PASSWORD %L', :ai_password);
    END IF;
END
$$;

ALTER ROLE ai_readonly NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;

-- Every transaction is read-only regardless of what the application forgets to set.
ALTER ROLE ai_readonly SET default_transaction_read_only = on;

-- Hard cap on runtime. Enforced by the server, so `SELECT pg_sleep(30)` and
-- accidental cartesian joins cannot pin a connection.
ALTER ROLE ai_readonly SET statement_timeout = '5s';
ALTER ROLE ai_readonly SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE ai_readonly SET lock_timeout = '2s';

-- ---------------------------------------------------------------------------
-- 2. Grants: deny by default, then allow a named list
-- ---------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ai_readonly;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ai_readonly;
REVOKE ALL ON SCHEMA public FROM ai_readonly;
REVOKE ALL ON DATABASE :"db_name" FROM ai_readonly;

GRANT CONNECT ON DATABASE :"db_name" TO ai_readonly;
GRANT USAGE ON SCHEMA public TO ai_readonly;

-- Tables the agent may read. `users` is deliberately absent — that is the control
-- that actually protects the password hashes.
GRANT SELECT ON
    uploaded_files,
    dashboards,
    charts,
    chat_history,
    cleaning_templates,
    cleaning_configs,
    datasets_cleaned
TO ai_readonly;

-- Explicit and redundant, so the intent survives future refactors.
REVOKE ALL ON users FROM ai_readonly;

-- Tables added later must not become readable by accident.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM ai_readonly;

-- ---------------------------------------------------------------------------
-- 3. Row-Level Security: tenant isolation
-- ---------------------------------------------------------------------------
-- Helper: the current request's user id, or NULL when unset (fails closed).
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS integer
    LANGUAGE sql STABLE
    AS $$ SELECT NULLIF(current_setting('app.current_user_id', true), '')::integer $$;

-- Directly owned tables ----------------------------------------------------
ALTER TABLE uploaded_files      ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboards          ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_templates  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_readonly_owner ON uploaded_files;
CREATE POLICY ai_readonly_owner ON uploaded_files
    FOR SELECT TO ai_readonly
    USING (owner_id = app_current_user_id());

DROP POLICY IF EXISTS ai_readonly_owner ON dashboards;
CREATE POLICY ai_readonly_owner ON dashboards
    FOR SELECT TO ai_readonly
    USING (user_id = app_current_user_id());

DROP POLICY IF EXISTS ai_readonly_owner ON chat_history;
CREATE POLICY ai_readonly_owner ON chat_history
    FOR SELECT TO ai_readonly
    USING (user_id = app_current_user_id());

DROP POLICY IF EXISTS ai_readonly_owner ON cleaning_templates;
CREATE POLICY ai_readonly_owner ON cleaning_templates
    FOR SELECT TO ai_readonly
    USING (user_id = app_current_user_id());

-- Indirectly owned tables (ownership reached through a parent row) ----------
ALTER TABLE charts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_configs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE datasets_cleaned  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_readonly_owner ON charts;
CREATE POLICY ai_readonly_owner ON charts
    FOR SELECT TO ai_readonly
    USING (EXISTS (
        SELECT 1 FROM dashboards d
        WHERE d.id = charts.dashboard_id AND d.user_id = app_current_user_id()
    ));

DROP POLICY IF EXISTS ai_readonly_owner ON cleaning_configs;
CREATE POLICY ai_readonly_owner ON cleaning_configs
    FOR SELECT TO ai_readonly
    USING (EXISTS (
        SELECT 1 FROM uploaded_files f
        WHERE f.id = cleaning_configs.file_id AND f.owner_id = app_current_user_id()
    ));

DROP POLICY IF EXISTS ai_readonly_owner ON datasets_cleaned;
CREATE POLICY ai_readonly_owner ON datasets_cleaned
    FOR SELECT TO ai_readonly
    USING (EXISTS (
        SELECT 1 FROM uploaded_files f
        WHERE f.id = datasets_cleaned.file_id AND f.owner_id = app_current_user_id()
    ));

-- The RLS subqueries above read dashboards/uploaded_files, which are themselves
-- protected. Policy expressions run as the policy owner, so this is consistent —
-- but grant nothing extra here.

-- ---------------------------------------------------------------------------
-- 4. Verification — review this output before trusting the setup
-- ---------------------------------------------------------------------------
\echo ''
\echo '=== Role attributes (expect rolsuper=f, rolcreatedb=f, rolcreaterole=f) ==='
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
FROM pg_roles WHERE rolname = 'ai_readonly';

\echo ''
\echo '=== Readable tables (users MUST NOT appear) ==='
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'ai_readonly'
ORDER BY table_name;

\echo ''
\echo '=== RLS status (rowsecurity MUST be true for every listed table) ==='
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
