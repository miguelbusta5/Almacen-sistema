-- Catalogo maestro de productos por PLU

CREATE TABLE IF NOT EXISTS productos_maestro (
  id TEXT PRIMARY KEY,
  plu VARCHAR(100) NOT NULL UNIQUE,
  descripcion TEXT,
  fabricante VARCHAR(255),
  precio DECIMAL(12, 2),
  marca VARCHAR(255),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS productos_maestro_plu_idx
  ON productos_maestro(plu);
