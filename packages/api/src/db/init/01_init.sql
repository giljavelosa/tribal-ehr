-- This file runs when PostgreSQL container starts for the first time
-- Extensions and initial setup
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Create schemas for organization
-- All tables use the public schema for simplicity with Knex
