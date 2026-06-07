-- Sprint 8 Fase 6: estructura preoperacional

DO $$ BEGIN
  CREATE TYPE "EstadoInspeccion" AS ENUM ('APROBADA', 'APROBADA_CON_OBSERVACIONES', 'BLOQUEADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ResultadoInspeccion" AS ENUM ('CONFORME', 'NO_CONFORME', 'NO_APLICA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS inspecciones_preoperacionales (
  id TEXT PRIMARY KEY,
  vehiculo_id TEXT NOT NULL REFERENCES vehiculos(id),
  conductor_id TEXT NOT NULL REFERENCES transportistas(id),
  realizado_por_id TEXT NOT NULL REFERENCES users(id),
  fecha DATE NOT NULL,
  kilometraje INTEGER,
  observaciones TEXT,
  estado "EstadoInspeccion" NOT NULL DEFAULT 'APROBADA',
  vigente BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS items_inspeccion (
  id TEXT PRIMARY KEY,
  inspeccion_id TEXT NOT NULL REFERENCES inspecciones_preoperacionales(id) ON DELETE CASCADE,
  categoria VARCHAR(30) NOT NULL,
  item VARCHAR(100) NOT NULL,
  resultado "ResultadoInspeccion" NOT NULL,
  es_critico BOOLEAN NOT NULL DEFAULT false,
  foto_url TEXT,
  observacion TEXT
);

CREATE INDEX IF NOT EXISTS inspecciones_preoperacionales_vehiculo_fecha_idx
  ON inspecciones_preoperacionales(vehiculo_id, fecha);

CREATE INDEX IF NOT EXISTS inspecciones_preoperacionales_conductor_fecha_idx
  ON inspecciones_preoperacionales(conductor_id, fecha);

CREATE INDEX IF NOT EXISTS inspecciones_preoperacionales_estado_fecha_idx
  ON inspecciones_preoperacionales(estado, fecha);

CREATE INDEX IF NOT EXISTS inspecciones_preoperacionales_vehiculo_fecha_vigente_idx
  ON inspecciones_preoperacionales(vehiculo_id, fecha, vigente);

CREATE INDEX IF NOT EXISTS items_inspeccion_inspeccion_id_idx
  ON items_inspeccion(inspeccion_id);
