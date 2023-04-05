-- CreateTable
CREATE TABLE "currencies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "currency_name" TEXT NOT NULL,
    "subunit_name" TEXT NOT NULL,
    "base" INTEGER[],
    "exponent" INTEGER NOT NULL,
    "countries" TEXT[],

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies"("code");
