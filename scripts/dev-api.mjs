#!/usr/bin/env node
import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import handler from "../api/generate-examples.js";

dotenv.config();

const app = express();
app.use(bodyParser.json());

app.post("/api/generate-examples", (req, res) => handler(req, res));
app.options("/api/generate-examples", (req, res) => handler(req, res));
app.get("/api/generate-examples", (req, res) =>
  res.status(405).json({ error: "Use POST /api/generate-examples" })
);
app.get("/", (req, res) => res.status(200).json({ status: "ok" }));

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`Dev API listening on http://localhost:${port}`);
});
