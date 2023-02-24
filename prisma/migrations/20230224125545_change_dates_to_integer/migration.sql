/*
  Warnings:

  - Changed the type of `valid_from_date` on the `fx_rates` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `valid_to_date` on the `fx_rates` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "fx_rates" DROP COLUMN "valid_from_date",
ADD COLUMN     "valid_from_date" INTEGER NOT NULL,
DROP COLUMN "valid_to_date",
ADD COLUMN     "valid_to_date" INTEGER NOT NULL;
