import type { Event } from '../types';
import { EventHistory } from './EventHistory';

type EventCallback = (event: Event) => void;

export class EventBus {
    private listeners = new Map<string, EventCallback[]>();
    private eventHistory: EventHistory;

    constructor(eventHistory: EventHistory) {
        this.eventHistory = eventHistory;
    }


    emit(event: Event): void {
        // Ajoute à l'historique
        this.eventHistory.add(event);
        // Notifie les listeners du type spécifique
        const listeners = this.listeners.get(event.type) || [];
        listeners.forEach(cb => cb(event));
        // Notifie les listeners wildcard '*'
        const allListeners = this.listeners.get('*') || [];
        allListeners.forEach(cb => cb(event));
    }

    on(eventType: string, callback: EventCallback): void {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }
        this.listeners.get(eventType)!.push(callback);
    }

    off(eventType: string, callback: EventCallback): void {
        const callbacks = this.listeners.get(eventType);
        if (!callbacks) return;
        const idx = callbacks.indexOf(callback);
        if (idx > -1) callbacks.splice(idx, 1);
    }

    once(eventType: string, callback: EventCallback): void {
        const wrapper: EventCallback = (event) => {
            callback(event);
            this.off(eventType, wrapper);
        };
        this.on(eventType, wrapper);
    }

    removeAllListeners(eventType?: string): void {
        if (eventType) {
            this.listeners.delete(eventType);
        } else {
            this.listeners.clear();
        }
    }

    getListenerCount(eventType: string): number {
        return (this.listeners.get(eventType) || []).length;
    }
}