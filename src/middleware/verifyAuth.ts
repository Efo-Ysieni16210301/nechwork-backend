import { Request, Response, NextFunction } from "express";
import { adminAuth } from "../firebaseAdmin";
import type { DecodedIdToken } from "firebase-admin/auth";

export interface AuthedRequest extends Request {
  user?: DecodedIdToken;
}

export async function verifyAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
