-- Remplace la position du logo (3 options, fond toujours blanc) par un vrai choix de
-- modèle de carte où les couleurs habillent toute la carte.
CREATE TYPE "CardTemplate" AS ENUM ('BANNER', 'GRADIENT', 'FRAME', 'SPLIT');

ALTER TABLE "companies" ADD COLUMN "cardTemplate" "CardTemplate" NOT NULL DEFAULT 'BANNER';

ALTER TABLE "companies" DROP COLUMN "logoPosition";

DROP TYPE "CardLogoPosition";
