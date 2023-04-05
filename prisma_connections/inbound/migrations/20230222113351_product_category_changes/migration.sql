/*
  Warnings:

  - You are about to drop the column `category_description` on the `product_category` table. All the data in the column will be lost.
  - You are about to drop the column `category_image` on the `product_category` table. All the data in the column will be lost.
  - You are about to drop the column `category_name` on the `product_category` table. All the data in the column will be lost.
  - You are about to drop the column `parent_category_id` on the `product_category` table. All the data in the column will be lost.
  - Added the required column `name` to the `product_category` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "product_category" DROP CONSTRAINT "product_category_parent_category_id_fkey";

-- AlterTable
ALTER TABLE "product_category" DROP COLUMN "category_description",
DROP COLUMN "category_image",
DROP COLUMN "category_name",
DROP COLUMN "parent_category_id",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "parent_id" TEXT;

-- AddForeignKey
ALTER TABLE "product_category" ADD CONSTRAINT "product_category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "product_category"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
