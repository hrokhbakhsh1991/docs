-- P1-6 optimistic locking on tours
ALTER TABLE "tours" ADD COLUMN "row_version" INTEGER NOT NULL DEFAULT 1;
