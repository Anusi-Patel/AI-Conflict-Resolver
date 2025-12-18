import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import app from "./app.js";

dotenv.config();

console.log("Loaded MONGO_URI:", process.env.MONGO_URI);

const PORT = process.env.PORT || 5000;

// 3. CREATE DUAL SERVER (HTTP + SOCKET)
// We wrap the Express 'app' in a standard HTTP server
// This allows them to share the same port (5000).
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all connections (Change this to your frontend URL later)
    methods: ["GET", "POST"]
  }
});

// 4. ATTACH IO TO EXPRESS
// Since app.js is already loaded, we use 'app.set' to make 'io' accessible globally.
// In your controllers, you will call: req.app.get("io")
app.set("io", io);

// 5. SOCKET CONNECTION LOGIC
io.on("connection", (socket) => {
  console.log(`New Client Connected: ${socket.id}`);

  // Join a specific room (based on Report ID)
  socket.on("join_room", (report_id) => {
    socket.join(report_id);
    console.log(`User ${socket.id} joined room: ${report_id}`);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// 6. START SERVER
server.listen(PORT, () => {
  console.log(`Server (HTTP + Socket) running on port ${PORT}`);
});
























// import dotenv from "dotenv";
// import express from "express";
// import path from "path";
// import { fileURLToPath } from "url";
// import app from "./app.js";

// dotenv.config();

// // 4. Define __dirname (Required for ES Modules)
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// console.log("Loaded MONGO_URI:", process.env.MONGO_URI);

// // 5. Serve Static Files from the "public" folder
// // This makes http://localhost:5000/ show your index.html
// app.use(express.static(path.join(__dirname, "../public")));

// const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
//   console.log(`Frontend accessible at http://localhost:${PORT}`);
// });