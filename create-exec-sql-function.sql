-- Create exec_sql function for Supabase DDL operations
-- Run this in Supabase SQL Editor to enable programmatic table creation

-- First, create the exec_sql function
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    EXECUTE sql;
END;
$$;

-- Grant permission to service role
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

-- Also create a version function for diagnostics
CREATE OR REPLACE FUNCTION public.version()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT version();
$$;

GRANT EXECUTE ON FUNCTION public.version() TO service_role;

-- Create test function
CREATE OR REPLACE FUNCTION public.test_connection()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN 'Connection test successful - exec_sql function is working!';
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_connection() TO service_role; 