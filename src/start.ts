import { createStart } from "@tanstack/react-start";
import { authMiddleware } from "~/server/shared/http/middleware/auth";
import { bootstrapMiddleware } from "~/server/shared/http/middleware/bootstrap";
import { errorMiddleware } from "~/server/shared/http/middleware/error";
import { prefsMiddleware } from "~/server/shared/http/middleware/prefs";
import { securityMiddleware } from "~/server/shared/http/middleware/security";
import { webRequestSecurityMiddleware } from "~/server/shared/http/middleware/web-request-security";

export const startInstance = createStart(() => ({
  requestMiddleware: [
    prefsMiddleware,
    securityMiddleware,
    errorMiddleware,
    webRequestSecurityMiddleware,
    authMiddleware,
  ],
  functionMiddleware: [bootstrapMiddleware],
}));
