import { Response, NextFunction } from "express";
import type { AuthedRequest } from "./verifyAuth";

export function requireAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.user?.admin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
