#!/bin/sh
set -eu

psql -v ON_ERROR_STOP=1 --username postgres --dbname "$POSTGRES_DB" <<-EOSQL
    -- CREATEDB: pytest-django creates and drops its own throwaway test
    -- database on each run, so the app role needs that privilege too.
    -- TODO before production: split this into a separate, non-CREATEDB
    -- app role plus a dedicated test role. Not done now because the
    -- current single-.env docker-compose setup can't cleanly keep a
    -- dev/.env.local and a .env.test apart from what provisions Postgres
    -- at container startup (compose only auto-loads one .env file for
    -- that), and this project doesn't target production deployment.
    CREATE USER "$APP_DB_USER" WITH PASSWORD '$APP_DB_PASSWORD' CREATEDB;
    GRANT CONNECT ON DATABASE "$POSTGRES_DB" TO "$APP_DB_USER";
    GRANT CREATE, USAGE ON SCHEMA public TO "$APP_DB_USER";

    -- Installing an extension needs database-level CREATE, which the grant
    -- above doesn't cover (that's schema-level). $APP_DB_USER's own
    -- migrations run "CREATE EXTENSION IF NOT EXISTS pg_trgm" (for the
    -- recipe-name search index) as a no-op once it's already here, so this
    -- is done as postgres rather than widening the app role's privileges.
    -- pytest-django's throwaway test database needs no equivalent: it's
    -- created BY $APP_DB_USER (via its CREATEDB grant), which makes that
    -- role the owner and an owner's implicit CREATE covers this already.
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
EOSQL
