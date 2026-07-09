-- CreateIndex: índices para optimizar consulta F18 (GET /api/operaciones/traslados, R2 <500ms)
CREATE INDEX "transfers_status_idx" ON "tracking"."transfers"("status");

-- CreateIndex
CREATE INDEX "transfers_vehicle_id_idx" ON "tracking"."transfers"("vehicle_id");

-- CreateIndex
CREATE INDEX "transfers_conductor_id_idx" ON "tracking"."transfers"("conductor_id");

-- CreateIndex
CREATE INDEX "transfers_created_at_idx" ON "tracking"."transfers"("created_at");
