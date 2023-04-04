/*
  Warnings:

  - A unique constraint covering the columns `[variation_id,value]` on the table `variation_option` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "variation_option_variation_id_value_key" ON "variation_option"("variation_id", "value");
