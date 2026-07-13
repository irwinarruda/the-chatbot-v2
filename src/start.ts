import { createStart } from "@tanstack/react-start";
import { authMiddleware } from "~/shared/http/middleware/auth";
import { bootstrapMiddleware } from "~/shared/http/middleware/bootstrap";
import { errorMiddleware } from "~/shared/http/middleware/error";
import { prefsMiddleware } from "~/shared/http/middleware/prefs";
import { securityMiddleware } from "~/shared/http/middleware/security";

export const startInstance = createStart(() => ({
  requestMiddleware: [
    prefsMiddleware,
    securityMiddleware,
    errorMiddleware,
    authMiddleware,
  ],
  functionMiddleware: [bootstrapMiddleware],
}));
