import path from "path";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import multer from "multer";
import helmet from "helmet";
import joinRouter from "./routes/join";
import transactionsRouter from "./routes/transactions";
import scanRouter from "./routes/scan";
import appleWalletRouter from "./routes/appleWallet";
import googleWalletRouter from "./routes/googleWallet";
import adminAuthRouter from "./routes/adminAuth";
import adminCompaniesRouter from "./routes/adminCompanies";
import companyAuthRouter from "./routes/companyAuth";
import companyDashboardRouter from "./routes/companyDashboard";
import companyEmployeesRouter from "./routes/companyEmployees";
import companyTerminalsRouter from "./routes/companyTerminals";
import companyCustomersRouter from "./routes/companyCustomers";
import adminAuditLogsRouter from "./routes/adminAuditLogs";
import companyProgramRouter from "./routes/companyProgram";
import companyEmailConfigRouter from "./routes/companyEmailConfig";
import adminSecurityAlertsRouter from "./routes/adminSecurityAlerts";
import adminBackupsRouter from "./routes/adminBackups";
import { HttpError } from "./lib/httpError";

export const app = express();

// En-têtes de sécurité standards (anti-sniffing, anti-clickjacking, etc.). CSP désactivée :
// cette API ne sert pas de HTML, la CSP n'a de sens que pour le frontend qui la sert lui-même.
// Cross-Origin-Resource-Policy explicitement ouverte : le frontend (autre origine) doit
// pouvoir charger les images servies ici (QR codes, logos, codes-barres) — le réglage par
// défaut de helmet ("same-origin") les bloquait silencieusement, exactement le bug qui a fait
// disparaître tous les QR codes du dashboard.
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));

// Les routes admin utilisent un cookie de session : CORS doit donc être restreint à l'origine
// exacte du frontend (un cookie ne peut pas être envoyé cross-origin avec une origine "*").
app.use(cors({ origin: process.env.FRONTEND_BASE_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/join", joinRouter);
app.use("/transactions", transactionsRouter);
app.use("/scan", scanRouter);
app.use("/wallet/apple", appleWalletRouter);
app.use("/wallet/google", googleWalletRouter);
app.use("/admin/auth", adminAuthRouter);
app.use("/admin/companies", adminCompaniesRouter);
app.use("/admin/audit-logs", adminAuditLogsRouter);
app.use("/company/:slug/auth", companyAuthRouter);
app.use("/company/:slug/dashboard", companyDashboardRouter);
app.use("/company/:slug/employees", companyEmployeesRouter);
app.use("/company/:slug/terminals", companyTerminalsRouter);
app.use("/company/:slug/customers", companyCustomersRouter);
app.use("/company/:slug/program", companyProgramRouter);
app.use("/company/:slug/email-config", companyEmailConfigRouter);
app.use("/admin/security-alerts", adminSecurityAlertsRouter);
app.use("/admin/backups", adminBackupsRouter);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: err.code });
    return;
  }
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: `UPLOAD_ERROR_${err.code}` });
    return;
  }
  if (err instanceof Error && err.message === "UNSUPPORTED_FILE_TYPE") {
    res.status(400).json({ error: "UNSUPPORTED_FILE_TYPE" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "INTERNAL_ERROR" });
};

app.use(errorHandler);
