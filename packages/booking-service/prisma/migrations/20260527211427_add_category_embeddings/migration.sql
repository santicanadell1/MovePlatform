-- Asegurar que el tipo vector (extensión pgvector en public) sea visible
SET search_path TO booking, public;

-- CreateTable
CREATE TABLE "category_embeddings" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "embedding" vector(768) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_embeddings_category_id_key" ON "category_embeddings"("category_id");

-- CreateIndex
CREATE INDEX "category_embeddings_embedding_idx" ON "category_embeddings" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

-- AddForeignKey
ALTER TABLE "category_embeddings" ADD CONSTRAINT "category_embeddings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
