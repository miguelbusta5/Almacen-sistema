-- Sprint 8 Fase 4: pendientes de guardado desde Tienda

CREATE TABLE IF NOT EXISTS guardados_pendientes_tienda (
  id TEXT PRIMARY KEY,
  despacho_id TEXT NOT NULL UNIQUE REFERENCES despachos_tienda(id) ON DELETE CASCADE,
  asignado_a_id TEXT NOT NULL REFERENCES users(id),
  asignado_por_id TEXT NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  guardado_client_id VARCHAR(100),
  nota TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completado_at TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS guardados_pendientes_tienda_asignado_estado_idx
  ON guardados_pendientes_tienda(asignado_a_id, estado);

CREATE INDEX IF NOT EXISTS guardados_pendientes_tienda_despacho_idx
  ON guardados_pendientes_tienda(despacho_id);
