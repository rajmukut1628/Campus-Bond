import { expireSuspensions } from "./suspensions.js";
import { recordActivity } from "./activity.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { routes } from "./routes.js";
import { csrf } from "./security.js";
export function createApp(config) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: config.origin, credentials: true }));
  app.use(express.json({ limit: "64kb" }));
  app.use(cookieParser());
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: config.apiRateLimit || 500,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.get("/health", (req, res) =>
    res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
      status: mongoose.connection.readyState === 1 ? "ready" : "unavailable",
    }),
  );
  app.use("/api/v1", async (req, res, next) => { await expireSuspensions(); next(); }, csrf(config), recordActivity, routes(config));
  app.use((req, res) =>
    res.status(404).json({ message: "Endpoint not found" }),
  );
  app.use((err, req, res, next) => {
    if (err.code === 11000)
      return res.status(409).json({ message: "This record already exists" });
    if (
      err.name === "ValidationError" ||
      err.name === "StrictModeError" ||
      err.name === "CastError"
    )
      return res.status(422).json({ message: "Invalid data supplied" });
    const status =
      err.status || 400 * (err.type === "entity.parse.failed") || 500;
    if (status === 500) console.error(err);
    res.status(status).json({
      message:
        status === 500 ? "An unexpected server error occurred" : err.message,
    });
  });
  return app;
}
