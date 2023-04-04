/*
  Warnings:

  - Made the column `image` on table `product` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "product" ALTER COLUMN "image" SET NOT NULL;

-- CreateTable
CREATE TABLE "fx_rates" (
    "id" TEXT NOT NULL,
    "source_currency" TEXT NOT NULL,
    "target_currency" TEXT NOT NULL,
    "exchange_rate" DECIMAL(65,30) NOT NULL,
    "valid_from_date" TIMESTAMP(3) NOT NULL,
    "valid_to_date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id")
);
