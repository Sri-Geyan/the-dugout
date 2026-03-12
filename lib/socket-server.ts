import { Server as SocketIOServer } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

export const setIO = (io: SocketIOServer) => {
    ioInstance = io;
    (global as any).io = io; // Still keep global for compatibility
    console.log('[Socket] IO instance set successfully');
};

export const getIO = (): SocketIOServer | null => {
    return ioInstance || (global as any).io || null;
};

export const emitToRoom = (roomCode: string, event: string, data: any) => {
    const io = getIO();
    if (io) {
        io.to(roomCode).emit(event, data);
        console.log(`[Socket] Emitted ${event} to room ${roomCode}`);
    } else {
        console.error('[Socket] IO instance not found for emission');
    }
};
