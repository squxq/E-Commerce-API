/*
  Warnings:

  - You are about to drop the column `image` on the `product_item` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "product" ALTER COLUMN "image" DROP NOT NULL;

-- AlterTable
ALTER TABLE "product_item" DROP COLUMN "image",
ADD COLUMN     "images" TEXT[];
