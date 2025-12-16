<template>
  <div class="number-display">
    <v-progress-linear
      :model-value="normalizedValue"
      :color="getFeatureColor(feature)"
      height="12"
      rounded
    >
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

// Get feature color based on type and value
const getFeatureColor = (feature: Feature): string => {
  switch (feature.type) {
    case "number":
      if (typeof feature.value === "number") {
        const normalized = normalizedValue.value;
        if (normalized > 80) return "red";
        if (normalized > 60) return "orange";
        if (normalized > 40) return "yellow";
        return "green";
      }
      return "blue";
    case "bool":
      return feature.value ? "green" : "red";
    default:
      return "grey";
  }
};
</script>

<style scoped>
.number-display {
  height: 12px;
}
</style>