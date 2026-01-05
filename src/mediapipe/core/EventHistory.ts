import type { Event } from '../types';

export class EventHistory {
    private history: Event[] = [];

    addEvent(_event: Event): void {
        // TODO: Add event to history
    }

    wasEmittedRecently(_eventType: string, _timeMs: number, _hand?: 'Left' | 'Right'): boolean {
        // TODO: Check if event was emitted recently
        return false;
    }

    getRecentEvents(_timeMs: number): Event[] {
        // TODO: Get all events within timeMs
        return [];
    }

    getEventsByType(_eventType: string, _timeMs?: number): Event[] {
        // TODO: Get events of specific type, optionally within timeMs
        return [];
    }

    getLastEvent(_eventType?: string): Event | null {
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