<template>
  <div class="number-display">
    <v-progress-linear :model-value="normalizedValue" height="12" rounded>
      <template #default>
        <small class="text-white">{{ formatValue(feature.value) }}</small>
      </template>
    </v-progress-linear>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Feature } from "../mediapipe/types";

interface Props {
  feature: Feature;
}

const props = defineProps<Props>();

// Get normalized value for progress bar (0-100)
const normalizedValue = computed(() => {
  if (typeof props.feature.value !== "number") return 0;

  const [min, max] = props.feature.minMax;
  const range = max - min;
  if (range === 0) return 0;

  const normalized = ((props.feature.value - min) / range) * 100;
  return Math.max(0, Math.min(100, normalized));
});

// Format feature value
const formatValue = (value: string | boolean | number): string => {
  if (typeof value === "number") {
    return value.toFixed(3);
  }
  return String(value);
};

// Removed unused getFeatureColor function
</script>

<style scoped>
.number-display {
  height: 12px;
}
</style>