-- Stockage générique des identifiants d'accès à l'API du logiciel de caisse d'une entreprise
-- (nom du logiciel + clé chiffrée) — prêt pour n'importe quel logiciel, en attendant qu'un
-- adaptateur spécifique soit écrit pour réellement en tirer les ventes.
CREATE TABLE "pos_api_credentials" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "apiBaseUrl" TEXT,
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_api_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pos_api_credentials_companyId_key" ON "pos_api_credentials"("companyId");

ALTER TABLE "pos_api_credentials" ADD CONSTRAINT "pos_api_credentials_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
