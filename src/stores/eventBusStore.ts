import { defineStore } from 'pinia';
import { ref } from 'vue';
import { EventBus } from '../mediapipe/core/EventBus';
import { EventHistory } from '../mediapipe/core/EventHistory';
import type { Event } from '../mediapipe/types';

// Singleton EventBus instance, exportée pour tout le projet
export const eventHistory = new EventHistory();
export const eventBus = new EventBus(eventHistory);

export const useEventBusStore = defineStore('eventBus', () => {
    const lastEvent = ref<Event | null>(null);

    // Listen to all events and update lastEvent
    eventBus.on('*', (event: Event) => {
        lastEvent.value = event;
    });

    function clearEvent() {
        lastEvent.value = null;
    }

    return {
        lastEvent,
        clearEvent
    };
});
