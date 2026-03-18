'use client';

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
    if (!socket) {
        // By passing no URL, socket.io automatically uses the current window's URL
        socket = io({
            path: '/api/socket/io',
            addTrailingSlash: false,
            transports: ['websocket', 'polling'], // Prefer websocket
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
        });

        socket.on('connect', () => {
            console.log('[Socket] Connected:', socket?.id);
        });

        socket.on('disconnect', (reason) => {
            console.log('[Socket] Disconnected:', reason);
        });

        socket.on('connect_error', (err) => {
            console.error('[Socket] Connection error:', err.message);
        });
    }
    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};

export default getSocket;
