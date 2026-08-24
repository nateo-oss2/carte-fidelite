import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/httpError";
import { requireTerminalAuth } from "../middleware/terminalAuth";
import { recordPurchase, redeemReward, refundTransaction } from "../services/transactions";

const router = Router();

// Toute route de ce routeur exige un terminal authentifié (voir section 8/9 du brief :
// un simple scan ne doit jamais suffire à créer une transaction).
router.use(requireTerminalAuth);

const createTransactionSchema = z.object({
  customerId: z.string().uuid(),
  // Montant en euros sous forme de chaîne décimale ("37.00") — jamais un nombre flottant.
  amount: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/),
  idempotencyKey: z.string().min(8).max(100),
  employeeId: z.string().uuid().optional(),
});

/** POST /transactions — enregistre un achat et calcule les points côté serveur. */
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createTransactionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const transaction = await recordPurchase({
      companyId: req.terminal!.companyId,
      customerId: parsed.data.customerId,
      amount: parsed.data.amount,
      terminalId: req.terminal!.id,
      employeeId: parsed.data.employeeId ?? null,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    res.status(201).json({
      transactionId: transaction.id,
      status: transaction.status,
      pointsDelta: transaction.pointsDelta,
      balanceAfter: transaction.balanceAfter,
    });
  }),
);

const refundSchema = z.object({
  idempotencyKey: z.string().min(8).max(100),
  employeeId: z.string().uuid().optional(),
});

/** POST /transactions/:id/refund — annule un achat via une transaction de remboursement. */
router.post(
  "/:id/refund",
  asyncHandler(async (req, res) => {
    const parsed = refundSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const refund = await refundTransaction({
      companyId: req.terminal!.companyId,
      transactionId: req.params.id,
      terminalId: req.terminal!.id,
      employeeId: parsed.data.employeeId ?? null,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    res.status(201).json({
      transactionId: refund.id,
      status: refund.status,
      pointsDelta: refund.pointsDelta,
      balanceAfter: refund.balanceAfter,
    });
  }),
);

const redeemSchema = z.object({
  customerId: z.string().uuid(),
  rewardId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(100),
  employeeId: z.string().uuid().optional(),
});

/** POST /transactions/redeem — échange une récompense du catalogue contre des points (mode POINTS). */
router.post(
  "/redeem",
  asyncHandler(async (req, res) => {
    const parsed = redeemSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const transaction = await redeemReward({
      companyId: req.terminal!.companyId,
      customerId: parsed.data.customerId,
      rewardId: parsed.data.rewardId,
      terminalId: req.terminal!.id,
      employeeId: parsed.data.employeeId ?? null,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    res.status(201).json({
      transactionId: transaction.id,
      status: transaction.status,
      pointsDelta: transaction.pointsDelta,
      balanceAfter: transaction.balanceAfter,
    });
  }),
);

export default router;
