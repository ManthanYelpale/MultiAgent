"""
Runner script to provision the ai_readonly PostgreSQL role and apply security grants/RLS.
"""

import sys
from pathlib import Path

# Ensure app can be imported
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from app.db.session import engine


def run_readonly_role_setup():
    print("Connecting to PostgreSQL to configure 'ai_readonly' role...")
    
    with engine.connect() as conn:
        # 1. Create role or alter password
        result = conn.execute(text("SELECT 1 FROM pg_roles WHERE rolname = 'ai_readonly'")).scalar()
        if not result:
            print("Creating role 'ai_readonly'...")
            conn.execute(text("CREATE ROLE ai_readonly WITH LOGIN PASSWORD '123';"))
        else:
            print("Role 'ai_readonly' exists, updating password...")
            conn.execute(text("ALTER ROLE ai_readonly WITH LOGIN PASSWORD '123';"))

        # 2. Configure safety limits on the role
        print("Setting read-only transaction defaults and timeouts...")
        conn.execute(text("ALTER ROLE ai_readonly NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;"))
        conn.execute(text("ALTER ROLE ai_readonly SET default_transaction_read_only = on;"))
        conn.execute(text("ALTER ROLE ai_readonly SET statement_timeout = '5s';"))
        conn.execute(text("ALTER ROLE ai_readonly SET idle_in_transaction_session_timeout = '10s';"))
        conn.execute(text("ALTER ROLE ai_readonly SET lock_timeout = '2s';"))

        # 3. Apply schema and table grants
        print("Applying schema usage and table SELECT permissions...")
        conn.execute(text("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ai_readonly;"))
        conn.execute(text("REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ai_readonly;"))
        conn.execute(text("REVOKE ALL ON SCHEMA public FROM ai_readonly;"))
        conn.execute(text("GRANT CONNECT ON DATABASE multiagent TO ai_readonly;"))
        conn.execute(text("GRANT USAGE ON SCHEMA public TO ai_readonly;"))
        
        # Enable SELECT only on safe tables
        safe_tables = [
            "uploaded_files",
            "dashboards",
            "charts",
            "chat_history",
            "cleaning_templates",
            "cleaning_configs",
            "datasets_cleaned",
        ]
        for table in safe_tables:
            conn.execute(text(f"GRANT SELECT ON TABLE public.{table} TO ai_readonly;"))

        # Explicitly revoke access from users
        conn.execute(text("REVOKE ALL ON TABLE public.users FROM ai_readonly;"))
        conn.execute(text("ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM ai_readonly;"))

        # 4. Configure Row-Level Security (RLS) function and policies
        print("Setting up Row-Level Security (RLS) policies...")
        conn.execute(text("""
            CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS integer
            LANGUAGE sql STABLE
            AS $$ SELECT NULLIF(current_setting('app.current_user_id', true), '')::integer $$;
        """))

        # Enable RLS on tables
        rls_tables = [
            "uploaded_files",
            "dashboards",
            "chat_history",
            "cleaning_templates",
            "charts",
            "cleaning_configs",
            "datasets_cleaned",
        ]
        for t in rls_tables:
            conn.execute(text(f"ALTER TABLE public.{t} ENABLE ROW LEVEL SECURITY;"))

        # Create policies
        policies = [
            ("uploaded_files", "owner_id = app_current_user_id()"),
            ("dashboards", "user_id = app_current_user_id()"),
            ("chat_history", "user_id = app_current_user_id()"),
            ("cleaning_templates", "user_id = app_current_user_id()"),
            ("charts", "EXISTS (SELECT 1 FROM dashboards d WHERE d.id = charts.dashboard_id AND d.user_id = app_current_user_id())"),
            ("cleaning_configs", "EXISTS (SELECT 1 FROM uploaded_files f WHERE f.id = cleaning_configs.file_id AND f.owner_id = app_current_user_id())"),
            ("datasets_cleaned", "EXISTS (SELECT 1 FROM uploaded_files f WHERE f.id = datasets_cleaned.file_id AND f.owner_id = app_current_user_id())"),
        ]
        for table, cond in policies:
            conn.execute(text(f"DROP POLICY IF EXISTS ai_readonly_owner ON public.{table};"))
            conn.execute(text(f"CREATE POLICY ai_readonly_owner ON public.{table} FOR SELECT TO ai_readonly USING ({cond});"))

        conn.commit()
    print("SUCCESS: 'ai_readonly' role is fully provisioned and secured!")


if __name__ == "__main__":
    run_readonly_role_setup()
