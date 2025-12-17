<template>
    Event Display
  <div v-if="event" class="event-display">
    <div class="event-content">
      <strong>Event:</strong> {{ event.type }}<br />
      <span v-if="event.data">Data: {{ event.data }}</span>
      <span v-else>No data</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import { useEventBusStore } from "../stores/eventBusStore";

const eventBusStore = useEventBusStore();
const event = computed(() => eventBusStore.lastEvent);

watch(event, (val) => {
  if (val) {
    // Remove event after display (e.g., after 2s)
    setTimeout(() => {
      eventBusStore.clearEvent();
    }, 1000);
  }
});
</script>

<style scoped>
.event-display {
  background: #222;
  color: #fff;
  padding: 1em;
  border-radius: 8px;
  margin: 1em 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  max-width: 400px;
}
</style>
