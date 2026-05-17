import { createStart } from "@tanstack/react-start";
import { authMiddleware } from "~/server/tanstack/middleware/auth";
import { bootstrapMiddleware } from "~/server/tanstack/middleware/bootstrap";
import { errorMiddleware } from "~/server/tanstack/middleware/error";
import { prefsMiddleware } from "~/server/tanstack/middleware/prefs";
import { securityMiddleware } from "~/server/tanstack/middleware/security";

export const startInstance = createStart(() => ({
  requestMiddleware: [
    prefsMiddleware,
    securityMiddleware,
    errorMiddleware,
    authMiddleware,
  ],
  functionMiddleware: [bootstrapMiddleware],
}));
