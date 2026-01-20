-- Step 1: Add code columns as nullable
ALTER TABLE "Province" ADD COLUMN "code" VARCHAR(2);
ALTER TABLE "City" ADD COLUMN "code" VARCHAR(2);

-- Step 2: Update Province codes based on DPA (División Político Administrativa de Cuba)
UPDATE "Province" SET "code" = '21' WHERE "name" LIKE '%Pinar del Rio%' OR "name" LIKE '%Pinar del Río%';
UPDATE "Province" SET "code" = '22' WHERE "name" LIKE '%Artemisa%';
UPDATE "Province" SET "code" = '23' WHERE "name" LIKE '%Habana%' AND "name" NOT LIKE '%Isla%';
UPDATE "Province" SET "code" = '24' WHERE "name" LIKE '%Mayabeque%';
UPDATE "Province" SET "code" = '25' WHERE "name" LIKE '%Matanzas%';
UPDATE "Province" SET "code" = '26' WHERE "name" LIKE '%Villa Clara%';
UPDATE "Province" SET "code" = '27' WHERE "name" LIKE '%Cienfuegos%';
UPDATE "Province" SET "code" = '28' WHERE "name" LIKE '%Sancti Spiritus%' OR "name" LIKE '%Sancti Spíritus%';
UPDATE "Province" SET "code" = '29' WHERE "name" LIKE '%Ciego de Avila%' OR "name" LIKE '%Ciego de Ávila%';
UPDATE "Province" SET "code" = '30' WHERE "name" LIKE '%Camaguey%' OR "name" LIKE '%Camagüey%';
UPDATE "Province" SET "code" = '31' WHERE "name" LIKE '%Las Tunas%';
UPDATE "Province" SET "code" = '32' WHERE "name" LIKE '%Holguin%' OR "name" LIKE '%Holguín%';
UPDATE "Province" SET "code" = '33' WHERE "name" LIKE '%Granma%';
UPDATE "Province" SET "code" = '34' WHERE "name" LIKE '%Santiago de Cuba%';
UPDATE "Province" SET "code" = '35' WHERE "name" LIKE '%Guantanamo%' OR "name" LIKE '%Guantánamo%';
UPDATE "Province" SET "code" = '40' WHERE "name" LIKE '%Isla de la Juventud%';

-- Step 3: Update City codes - assign sequential codes within each province
-- This uses a temporary approach; you can update with exact DPA codes later via seed
WITH numbered_cities AS (
  SELECT 
    c.id,
    LPAD(ROW_NUMBER() OVER (PARTITION BY c.province_id ORDER BY c.id)::TEXT, 2, '0') as new_code
  FROM "City" c
)
UPDATE "City" c
SET "code" = nc.new_code
FROM numbered_cities nc
WHERE c.id = nc.id;

-- Step 4: Make columns NOT NULL
ALTER TABLE "Province" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "City" ALTER COLUMN "code" SET NOT NULL;

-- Step 5: Add unique constraints
ALTER TABLE "Province" ADD CONSTRAINT "Province_code_key" UNIQUE ("code");
ALTER TABLE "City" ADD CONSTRAINT "City_province_id_code_key" UNIQUE ("province_id", "code");

-- Step 6: Create indexes
CREATE INDEX "Province_code_idx" ON "Province"("code");
CREATE INDEX "City_code_idx" ON "City"("code");
