import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = dev ? 'localhost' : '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const httpServer = createServer((req, res) => {
        const parsedUrl = parse(req.url!, true);
        handle(req, res, parsedUrl);
    });

    const io = new Server(httpServer, {
        path: '/api/socket/io',
        addTrailingSlash: false,
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
    });

    // Global instance for API routes
    (global as any).io = io;

    io.on('connection', (socket) => {
        console.log('[Socket] New connection:', socket.id);

        socket.on('join-room', (roomCode: string) => {
            socket.join(roomCode);
            console.log(`[Socket] Student ${socket.id} joined room ${roomCode}`);
        });

        socket.on('disconnect', () => {
            console.log('[Socket] Disconnected:', socket.id);
        });
    });

    httpServer.listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});
