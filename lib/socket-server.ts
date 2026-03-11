import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

export const getIO = (): SocketIOServer | null => {
    return (global as any).io || null;
};

export const emitToRoom = (roomCode: string, event: string, data: any) => {
    const io = getIO();
    if (io) {
        io.to(roomCode).emit(event, data);
        console.log(`[Socket] Emitted ${event} to room ${roomCode}`);
    } else {
        console.error('[Socket] IO instance not found in global');
    }
};
