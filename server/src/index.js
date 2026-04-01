import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import * as Sentry from "@sentry/node";
import { router as authRouter } from "./routes/auth.js";
import { router as clientsRouter } from "./routes/clients.js";
import { router as operationsRouter } from "./routes/operations.js";
import { router as healthRouter } from "./routes/health.js";

const app = express();

const PORT = process.env.PORT || 4000;

function splitOrigins(rawValue) {
  return String(rawValue || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const allowedOrigins = Array.from(
  new Set([
    "https://cima-frontend.onrender.com",
    "https://cima-frontend-o7sn.onrender.com",
    "https://cima-investimentos-sistema.onrender.com",
    "http://localhost:3000",
    "http://localhost:4000",
    "http://localhost:8095",
    "http://127.0.0.1:8095",
    ...splitOrigins(process.env.CLIENT_ORIGIN),
  ])
);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin nao permitido: ${origin}`));
  },
  credentials: true,
};

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
  });
  app.use(Sentry.Handlers.requestHandler());
}

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("tiny"));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX || 500),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", globalLimiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_LOGIN_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de login. Tente novamente mais tarde." },
});
app.use("/api/v1/auth/login", loginLimiter);

app.use("/api/v1/health", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/clients", clientsRouter);
app.use("/api/v1/operations", operationsRouter);

app.use((err, req, res, next) => {
  console.error("[API_ERROR]", err);
  res
    .status(err.status || 500)
    .json({ error: err.message || "Internal Server Error" });
});

if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

app.listen(PORT, () => {
  console.log(`CIMA API listening on http://localhost:${PORT}`);
});
