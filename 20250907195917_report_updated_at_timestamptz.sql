ALTER TABLE public.avoidance_area_reports 
    ALTER COLUMN updated_at TYPE timestamptz;

ALTER TABLE public.avoidance_area_reports 
    ALTER COLUMN updated_at SET DEFAULT now();
