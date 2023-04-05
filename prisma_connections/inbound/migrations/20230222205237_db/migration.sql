/*
  Warnings:

  - A unique constraint covering the columns `[category_id,name]` on the table `product` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "product_category_id_name_key" ON "product"("category_id", "name");
