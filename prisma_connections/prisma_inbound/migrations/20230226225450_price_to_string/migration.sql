/*
  Warnings:

  - You are about to drop the `product` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `product_category` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `product_configuration` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `product_item` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `variation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `variation_option` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."product" DROP CONSTRAINT "product_category_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."product_category" DROP CONSTRAINT "product_category_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."product_configuration" DROP CONSTRAINT "product_configuration_product_item_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."product_configuration" DROP CONSTRAINT "product_configuration_variation_option_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."product_item" DROP CONSTRAINT "product_item_product_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."variation" DROP CONSTRAINT "variation_category_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."variation_option" DROP CONSTRAINT "variation_option_variation_id_fkey";

-- DropTable
DROP TABLE "public"."product";

-- DropTable
DROP TABLE "public"."product_category";

-- DropTable
DROP TABLE "public"."product_configuration";

-- DropTable
DROP TABLE "public"."product_item";

-- DropTable
DROP TABLE "public"."variation";

-- DropTable
DROP TABLE "public"."variation_option";

-- CreateTable
CREATE TABLE "product_category" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_item" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "SKU" TEXT NOT NULL,
    "QIS" INTEGER NOT NULL,
    "images" TEXT[],
    "price" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variation" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "variation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variation_option" (
    "id" TEXT NOT NULL,
    "variation_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "variation_option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_configuration" (
    "id" TEXT NOT NULL,
    "product_item_id" TEXT NOT NULL,
    "variation_option_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_configuration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_category_id_name_key" ON "product"("category_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "variation_category_id_name_key" ON "variation"("category_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "variation_option_variation_id_value_key" ON "variation_option"("variation_id", "value");

-- AddForeignKey
ALTER TABLE "product_category" ADD CONSTRAINT "product_category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "product_category"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_item" ADD CONSTRAINT "product_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variation" ADD CONSTRAINT "variation_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variation_option" ADD CONSTRAINT "variation_option_variation_id_fkey" FOREIGN KEY ("variation_id") REFERENCES "variation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_configuration" ADD CONSTRAINT "product_configuration_product_item_id_fkey" FOREIGN KEY ("product_item_id") REFERENCES "product_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_configuration" ADD CONSTRAINT "product_configuration_variation_option_id_fkey" FOREIGN KEY ("variation_option_id") REFERENCES "variation_option"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
