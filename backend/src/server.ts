// Doit rester le tout premier import : charge .env explicitement dans process.env avant que
// quoi que ce soit d'autre ne lise une variable d'environnement. Auparavant, ça fonctionnait
// par effet de bord (Prisma Client charge .env en interne dès sa première instanciation), ce
// qui est fragile — un module lu avant que Prisma ne soit importé pouvait recevoir `undefined`.
import "dotenv/config";

import { bootstrapAppleWalletCerts } from "./lib/appleCertsBootstrap";
bootstrapAppleWalletCerts();

import { app } from "./app";
import { startInactivityReminderScheduler } from "./scheduler/inactivityReminderJob";
import { startBackupScheduler } from "./scheduler/backupJob";
import { startPointsExpiryScheduler } from "./scheduler/pointsExpiryJob";

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});

startInactivityReminderScheduler();
startBackupScheduler();
startPointsExpiryScheduler();
