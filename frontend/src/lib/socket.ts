import { io, Socket } from 'socket.io-client';
import { API_URL } from '../api';

// Derive the socket URL cleanly from the API_URL
// If API_URL is `http://localhost:3002/api`, socket URL is `http://localhost:3002`
let socketUrl = API_URL.replace(/\/api$/, '');

let socket: Socket | null = null;
export let isSocketConnected = false;

export const initClientSocket = () => {
    if (!socket) {
        // Re-read API_URL mostly to capture config updates
        socketUrl = API_URL.replace(/\/api$/, '');
        
        socket = io(socketUrl, {
            transports: ['websocket', 'polling'], // Prefer websocket
        });

        socket.on('connect', () => {
            console.log('🔗 [Socket.io] Connected to server in real-time mode:', socket?.id);
            isSocketConnected = true;
        });

        socket.on('disconnect', () => {
            console.log('🔗 [Socket.io] Disconnected from server');
            isSocketConnected = false;
        });
    }
    return socket;
};

export const getClientSocket = () => {
    if (!socket) {
        return initClientSocket();
    }
    return socket;
};
