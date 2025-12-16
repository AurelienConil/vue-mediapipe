import type { Event } from '../types';

export class EventHistory {
    private history: Event[] = [];
    private maxHistorySize = 1000;

    addEvent(event: Event): void {
        // TODO: Add event to history
    }

    wasEmittedRecently(eventType: string, timeMs: number, hand?: 'Left' | 'Right'): boolean {
        // TODO: Check if event was emitted recently
        return false;
    }

    getRecentEvents(timeMs: number): Event[] {
        // TODO: Get all events within timeMs
        return [];
    }

    getEventsByType(eventType: string, timeMs?: number): Event[] {
        // TODO: Get events of specific type, optionally within timeMs
        return [];
    }

    getLastEvent(eventType?: string): Event | null {
        // TODO: Get the most recent event, optionally of specific type
        return null;
    }

    clear(): void {
        // TODO: Clear history
    }

    getHistorySize(): number {
        return this.history.length;
    }
}