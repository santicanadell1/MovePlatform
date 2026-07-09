-- AlterTable
ALTER TABLE "goods" ADD COLUMN "product_id" TEXT;

-- AddForeignKey
ALTER TABLE "goods" ADD CONSTRAINT "goods_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "company_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
