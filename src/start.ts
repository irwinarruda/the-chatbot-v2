import { createStart } from "@tanstack/react-start";
import { authMiddleware } from "~/server/tanstack/middleware/auth";
import { bootstrapMiddleware } from "~/server/tanstack/middleware/bootstrap";
import { errorMiddleware } from "~/server/tanstack/middleware/error";
import { securityMiddleware } from "~/server/tanstack/middleware/security";

export const startInstance = createStart(() => ({
  requestMiddleware: [securityMiddleware, errorMiddleware, authMiddleware],
  functionMiddleware: [bootstrapMiddleware],
}));
