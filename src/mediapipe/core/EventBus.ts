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
        // TODO: Add event to history and notify listeners
    }

    on(eventType: string, callback: EventCallback): void {
        // TODO: Subscribe to event type
    }

    off(eventType: string, callback: EventCallback): void {
        // TODO: Unsubscribe from event type
    }

    once(eventType: string, callback: EventCallback): void {
        // TODO: Subscribe once to event type
    }

    removeAllListeners(eventType?: string): void {
        // TODO: Remove all listeners for event type or all
    }

    getListenerCount(eventType: string): number {
        // TODO: Get number of listeners for event type
        return 0;
    }
}