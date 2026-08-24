import { asyncHandler } from "../lib/asyncHandler";
import { authenticateTerminal } from "../services/terminalAuth";

/**
 * Exige une authentification de terminal valide (en-tête X-Terminal-Key) pour toute route
 * qui écrit des transactions — un simple scan ne doit jamais suffire à créditer des points.
 */
export const requireTerminalAuth = asyncHandler(async (req, res, next) => {
  const key = req.header("X-Terminal-Key");
  if (!key) {
    res.status(401).json({ error: "TERMINAL_KEY_MISSING" });
    return;
  }

  const terminal = await authenticateTerminal(key);
  if (!terminal) {
    res.status(401).json({ error: "TERMINAL_KEY_INVALID" });
    return;
  }

  req.terminal = { id: terminal.id, companyId: terminal.companyId, label: terminal.label };
  next();
});
