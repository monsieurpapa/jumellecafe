// Must be imported before any route registration — patches Express 4 to
// forward rejected promises from async handlers to error middleware
// (native only in Express 5), otherwise an uncaught async throw hangs the
// request instead of reaching the error handler below.
import "express-async-errors";
import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Catches anything routes/middlewares didn't handle themselves (e.g. an
// uncaught DB error) so the client always gets the app's JSON error shape
// instead of Express's default HTML page.
const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  logger.error({ err }, "unhandled_error");
  res.status(500).json({ error: "internal_error" });
};
app.use(errorHandler);

export default app;
