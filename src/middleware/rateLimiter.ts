import rateLimit from "express-rate-limit";

export const actionLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  message: {
    error: "Too many requests. Please slow down and try again shortly.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
