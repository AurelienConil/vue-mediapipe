import { defineStore } from 'pinia';
import { ref } from 'vue';
import { EventBus } from '../mediapipe/core/EventBus';
import { EventHistory } from '../mediapipe/core/EventHistory';
import type { Event } from '../mediapipe/types';

// Interface pour les événements avec ID pour l'affichage
interface DisplayEvent extends Event {
    id: string;
}

// Singleton EventBus instance, exportée pour tout le projet
export const eventHistory = new EventHistory();
export const eventBus = new EventBus();

export const useEventBusStore = defineStore('eventBus', () => {
    const events = ref<DisplayEvent[]>([]);
    let eventIdCounter = 0;

    // Listen to all events and add them to the list
    eventBus.on('*', (event: Event) => {
        const displayEvent: DisplayEvent = {
            ...event,
            id: `event-${++eventIdCounter}-${Date.now()}`
        };
        events.value.push(displayEvent);
    });

    function removeEvent(id: string) {
        const index = events.value.findIndex(event => event.id === id);
        if (index !== -1) {
            // Create a new array to ensure reactivity
            events.value = events.value.filter(event => event.id !== id);
        }
    }

    function clearAllEvents() {
        events.value = [];
    }

    return {
        events,
        removeEvent,
        clearAllEvents
    };
});
