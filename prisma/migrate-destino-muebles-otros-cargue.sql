-- 25-09: destino de las ordenes de muebles por TIENDA (del maestro de tiendas)
-- en vez de escribir la ciudad a mano. La ciudad sale de la tienda; E-commerce
-- (sin ciudad en el maestro) la pide aparte. Nullable: las ordenes viejas solo
-- tienen ciudad_envio.
ALTER TABLE ordenes_muebles ADD COLUMN IF NOT EXISTS tienda_destino_codigo varchar(50);
ALTER TABLE ordenes_muebles ADD COLUMN IF NOT EXISTS tienda_destino_nombre varchar(255);

-- 25-09: quien carga un camion y no esta en el catalogo de operarios de cargue
-- (se escribe el nombre a mano, solo para ese camion).
ALTER TABLE cargues_camion ADD COLUMN IF NOT EXISTS otros_operarios text[] NOT NULL DEFAULT '{}';
