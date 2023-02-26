-- CreateTable
CREATE TABLE "product_category" (
    "id" TEXT NOT NULL,
    "parent_category_id" TEXT NOT NULL,
    "category_name" TEXT NOT NULL,
    "category_image" TEXT,
    "category_description" TEXT,

    CONSTRAINT "product_category_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "product_category" ADD CONSTRAINT "product_category_parent_category_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "product_category"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
