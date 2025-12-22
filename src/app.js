import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import dotenv from "dotenv";
dotenv.config();

import authRoutes from "./routes/authRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";

const app = express();
app.use(cors());
app.use(express.json());

connectDB();

app.use("/auth", authRoutes);
app.use("/report", reportRoutes);
app.use("/chat", chatRoutes);

app.get("/", (req, res) => {
  res.send("API is working");
});

export default app;
