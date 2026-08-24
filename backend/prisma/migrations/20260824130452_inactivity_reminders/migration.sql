-- CreateEnum
CREATE TYPE "NotificationOrigin" AS ENUM ('MANUAL', 'AUTOMATIC');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "inactivityReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inactivityReminderMessage" TEXT NOT NULL DEFAULT 'Bonjour,

Ça fait un moment que nous ne vous avons pas vu. Découvrez nos nouveautés et offres du moment !

À bientôt,',
ADD COLUMN     "inactivityReminderSubject" TEXT NOT NULL DEFAULT 'On ne vous a pas vu depuis un moment !',
ADD COLUMN     "inactivityThresholdDays" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "customer_notifications" ADD COLUMN     "origin" "NotificationOrigin" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "lastAutoReminderSentAt" TIMESTAMP(3);
