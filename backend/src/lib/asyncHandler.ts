import type { NextFunction, Request, RequestHandler, Response } from "express";

/** Express 4 ne capture pas automatiquement les rejets de promesses : ce wrapper les transmet à next(). */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
