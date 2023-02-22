/*
  Warnings:

  - A unique constraint covering the columns `[category_id,name]` on the table `variation` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "variation_category_id_name_key" ON "variation"("category_id", "name");
