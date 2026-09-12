-- Extensie folosita de cautare pentru a ignora diacriticele romanesti
-- ("ciorba" trebuie sa gaseasca "ciorbă"). Nu e modelata in schema.prisma
-- (fara previewFeatures postgresqlExtensions), deci nu produce drift la
-- viitoare `prisma migrate dev` - Prisma nu stie despre extensii fara acel flag.
CREATE EXTENSION IF NOT EXISTS unaccent;
