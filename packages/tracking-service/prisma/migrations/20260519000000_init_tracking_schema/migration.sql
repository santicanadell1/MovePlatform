-- Ensure PostGIS geometry type is accessible from the tracking schema
SET search_path TO tracking, public;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "tracking";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA public;

-- CreateEnum
CREATE TYPE "tracking"."TransferStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "tracking"."AlertType" AS ENUM ('ZONE_RED_ENTRY', 'ZONE_PREFERRED_ENTRY', 'STOP_DETECTED', 'EXCESSIVE_SPEED', 'ROUTE_DEVIATION');

-- CreateTable
CREATE TABLE "tracking"."transfers" (
    "id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "conductor_id" TEXT NOT NULL,
    "status" "tracking"."TransferStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking"."gps_points" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "transfer_id" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "location" geometry(Point, 4326),
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gps_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking"."alerts" (
    "id" TEXT NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "type" "tracking"."AlertType" NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking"."incidents" (
    "id" TEXT NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "conductor_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transfers_reservation_id_key" ON "tracking"."transfers"("reservation_id");

-- CreateIndex (BRIN — eficiente para series temporales de alta frecuencia)
CREATE INDEX "gps_points_transfer_timestamp_brin" ON "tracking"."gps_points" USING BRIN ("transfer_id", "timestamp");
CREATE INDEX "gps_points_device_timestamp_brin" ON "tracking"."gps_points" USING BRIN ("device_id", "timestamp");

-- CreateIndex (GiST — para queries PostGIS en P4 geofencing)
CREATE INDEX "gps_points_location_gist" ON "tracking"."gps_points" USING GIST ("location");

-- CreateIndex (UNIQUE en alerts para idempotencia en P6 — ON CONFLICT DO NOTHING)
CREATE UNIQUE INDEX "alerts_transfer_type_lat_lng_created_unique" ON "tracking"."alerts"("transfer_id", "type", "lat", "lng", "created_at");

-- AddForeignKey
ALTER TABLE "tracking"."gps_points" ADD CONSTRAINT "gps_points_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "tracking"."transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking"."alerts" ADD CONSTRAINT "alerts_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "tracking"."transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking"."incidents" ADD CONSTRAINT "incidents_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "tracking"."transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Trigger: poblar columna location automáticamente desde lat/lng al insertar un punto GPS
CREATE OR REPLACE FUNCTION tracking.set_gps_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_gps_location
    BEFORE INSERT ON "tracking"."gps_points"
    FOR EACH ROW EXECUTE FUNCTION tracking.set_gps_location();
