"use strict";

const { ZodError } = require("zod");

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.name = "AppError";
  }
}

const errorHandler = (err, req, res, next) => {
  if (err instanceof ZodError) {
    const messages = err.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
    return res.status(400).json({ error: messages });
  }

  if (err instanceof AppError || err.name === "AppError") {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }

  if (err.name === "SequelizeUniqueConstraintError") {
    const field = err.errors && err.errors[0] ? err.errors[0].path : "field";
    return res.status(409).json({ error: `${field} already exists` });
  }

  if (err.name === "SequelizeValidationError") {
    const messages = err.errors.map((e) => e.message).join("; ");
    return res.status(400).json({ error: messages });
  }

  if (err.name === "SequelizeForeignKeyConstraintError") {
    return res
      .status(400)
      .json({ error: "Invalid reference: related resource not found" });
  }

  console.error("Unhandled error:", err);
  return res.status(500).json({ error: "Internal server error" });
};

module.exports = { errorHandler, AppError };
