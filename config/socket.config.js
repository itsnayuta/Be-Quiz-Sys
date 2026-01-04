import { Server } from "socket.io";

let io = null;

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Xử lý khi client join room để theo dõi exam cụ thể
    socket.on("join_exam_monitoring", (data) => {
      const { exam_id } = data;
      if (exam_id) {
        socket.join(`exam_${exam_id}`);
        console.log(`Client ${socket.id} joined exam_${exam_id}`);
      }
    });

    // Xử lý khi client leave room
    socket.on("leave_exam_monitoring", (data) => {
      const { exam_id } = data;
      if (exam_id) {
        socket.leave(`exam_${exam_id}`);
        console.log(`Client ${socket.id} left exam_${exam_id}`);
      }
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO not initialized. Call initializeSocket first.");
  }
  return io;
};

