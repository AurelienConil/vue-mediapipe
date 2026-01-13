<template>
  <div class="events-container">
    <h3>Event Display</h3>
    <div v-if="events.length === 0" class="no-events">
      Aucun événement récent
    </div>
    <div v-for="event in events" :key="event.id" class="event-display">
      <div class="event-content">
        <strong>Event:</strong> {{ event.type }}<br />
        <span v-for="([key, value], index) in Object.entries(event.data)" :key="index" >
          {{ key }}: {{ value }}<br />

        </span>
        <div class="event-time">
          {{ new Date(event.timestamp).toLocaleTimeString() }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { useEventBusStore } from "../stores/eventBusStore";

const eventBusStore = useEventBusStore();
const events = ref([...eventBusStore.events]);

// Watch the store's events and sync with our local ref
watch(
  () => eventBusStore.events,
  (newEvents) => {
    events.value = [...newEvents];
  },
  { deep: true, immediate: true }
);

// Watch for new events and set up auto-removal
watch(
  events,
  (newEvents, oldEvents) => {
    // Find new events (events that weren't in the old list)
    const oldIds = oldEvents ? oldEvents.map((e) => e.id) : [];
    const newEventsList = newEvents.filter((e) => !oldIds.includes(e.id));

    // Set up auto-removal for each new event after 800ms
    newEventsList.forEach((event) => {
      setTimeout(() => {
        eventBusStore.removeEvent(event.id);
      }, 4000);
    });
  },
  { deep: true }
);

// Initial sync
onMounted(() => {
  events.value = [...eventBusStore.events];
});
</script>

<style scoped>
.events-container {
  max-width: 400px;
}

.events-container h3 {
  margin: 0 0 1em 0;
  color: #333;
}

.no-events {
  color: #666;
  font-style: italic;
  padding: 1em;
  text-align: center;
}

.event-display {
  background: #222;
  color: #fff;
  padding: 1em;
  border-radius: 8px;
  margin: 0.5em 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  animation: slideIn 0.3s ease-out;
  border-left: 4px solid #00a8ff;
}

.event-content {
  position: relative;
}

.event-time {
  font-size: 0.8em;
  color: #ccc;
  margin-top: 0.5em;
  text-align: right;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
