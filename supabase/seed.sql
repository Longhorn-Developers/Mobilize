-- Seed data for avoidance areas
select insert_avoidance_area('Downtown Austin', 'POLYGON((-97.7333 30.2672, -97.7338 30.2672, -97.7338 30.268, -97.7333 30.268, -97.7333 30.2672))');

-- Seed vault with SUPABASE_URL and SUPABASE_ROLE_KEY
SELECT vault.create_secret(
    'http://host.docker.internal:54321', 
    'SUPABASE_URL', 
    'URL to be used for calling edge functions'
);

SELECT vault.create_secret(
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU', 
    'SUPABASE_ROLE_KEY', 
    'Role key to be used for calling internal edge functions'
);
