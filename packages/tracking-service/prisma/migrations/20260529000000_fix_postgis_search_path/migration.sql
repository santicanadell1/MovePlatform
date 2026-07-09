-- Corrige el trigger de gps_points para usar nombres de función completamente calificados.
-- El trigger original usaba ST_SetSRID/ST_MakePoint sin prefijo de schema, lo que fallaba
-- cuando la sesión de Prisma no tenía 'public' en el search_path.

CREATE OR REPLACE FUNCTION tracking.set_gps_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location = public.ST_SetSRID(public.ST_MakePoint(NEW.lng, NEW.lat), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
