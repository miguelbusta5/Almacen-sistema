console.error([
  "Migration disabled.",
  "This Sprint 8 logistics-flow migration is obsolete and conflicts with the simplified tienda flow.",
  "Use prisma/migrate-sprint8-simplified.sql and prisma/migrate-sprint8-guardado-pendiente.sql instead.",
].join("\n"));

process.exit(1);
