-- Simplification : une seule couleur (accentColor) pour la carte, partout — plus de modèles
-- multiples ni de 2e couleur, pour correspondre à ce que la vraie carte Apple Wallet affiche
-- réellement (un fond uni, aucun dégradé/mise en page possible).
ALTER TABLE "companies" DROP COLUMN "secondaryColor";
ALTER TABLE "companies" DROP COLUMN "cardTemplate";
DROP TYPE "CardTemplate";
