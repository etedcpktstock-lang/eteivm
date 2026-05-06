import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: Server;

export const initSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*', // Allow all origins for local development
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`📡 [Socket.io] Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`📡 [Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    console.warn('⚠️ Socket.io is not initialized yet!');
    return null; // Return null instead of throwing error during build/startup
  }
  return io;
};

/**
 * 🚀 GLOBAL EVENT BROADCASTER
 * ฟังก์ชั่นรวมศูนย์สำหรับส่งคลื่นสัญญาณไปให้ทุกหน้าจอ
 * ถูกออกแบบเผื่ออนาคตให้ใช้งานง่าย โยน payload เข้ามาได้เลย
 */
export const broadcastUpdate = (eventType: 'DATA_UPDATED' | 'STOCK_ALERT' | 'USER_ONLINE', payload: any) => {
  if (!io) return;
  io.emit(eventType, {
    timestamp: Date.now(),
    ...payload
  });
};
