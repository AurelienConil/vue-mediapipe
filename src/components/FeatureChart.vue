<template>
  <div class="feature-chart">
    <canvas ref="canvasRef" :width="width" :height="height"></canvas>
    <span>
      {{ formattedValue }} :: {{ props.feature.minMax[0] }} -
      {{ props.feature.minMax[1] }}
    </span>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  onMounted,
  watch,
  nextTick,
  onBeforeUnmount,
  computed,
} from "vue";
import {
  Chart,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  LineController,
  Filler,
  Legend,
  Tooltip,
} from "chart.js";
import type { ChartConfiguration, ChartData } from "chart.js";
import type { Feature } from "../mediapipe/types";

// Enregistrer les composants Chart.js nécessaires
Chart.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  LineController,
  Filler,
  Legend,
  Tooltip
);

interface Props {
  feature: Feature;
  featureKey: string;
  width?: number;
  height?: number;
  maxHistoryLength?: number;
}

const props = withDefaults(defineProps<Props>(), {
  width: 250,
  height: 50,
  maxHistoryLength: 50,
});

const canvasRef = ref<HTMLCanvasElement>();
let chart: Chart | null = null;
const chartData = ref<ChartData<"line">>({
  labels: [],
  datasets: [
    {
      label: props.feature.name,
      data: [],
      borderColor: getFeatureColor(props.feature),
      backgroundColor: getFeatureColor(props.feature) + "20", // 20% opacity
      borderWidth: 1,
      pointRadius: 0,
      pointHoverRadius: 3,
      tension: 0.1,
      fill: true,
    },
  ],
});

// Historique des valeurs pour le graphique
const history = ref<Array<{ timestamp: number; value: number }>>([]);

function getFeatureColor(feature: Feature): string {
  // Couleurs basées sur la catégorie ou le type
  const colors = {
    DistanceFinger: "#2196F3",
    AccelBaseFinger: "#4CAF50",
    HandOrientationInSpace: "#FF9800",
    HandSizeNormalise: "#9C27B0",
    default: "#607D8B",
  };

  return colors[feature.parents as keyof typeof colors] || colors.default;
}

//computed function that format properly a number to 3 decimal places and fixe position with adding zéro and space.
// The goal is to have always the xxx.xxx format à the same position
const formattedValue = computed(() => {
  if (typeof props.feature.value !== "number") return "N/A";
  const value = props.feature.value;
  const absValue = Math.abs(value);
  // Always pad integer part to 3 digits, sign is always in first position
  const [intPart, decPart] = absValue.toFixed(3).split(".");
  // If negative, sign is '-', else space
  const sign = value < 0 ? "-" : "+";
  // Always 3 digits for int part
  const paddedInt = intPart.padStart(3, "0");
  // Compose and pad to 8 chars (sign + 3 int + dot + 3 decimals)
  return `${sign}${paddedInt}.${decPart}`;
});

function updateHistory() {
  if (typeof props.feature.value !== "number") return;

  // Ajouter la nouvelle valeur
  history.value.push({
    timestamp: Date.now(),
    value: props.feature.value,
  });

  // Limiter l'historique
  if (history.value.length > props.maxHistoryLength) {
    history.value = history.value.slice(-props.maxHistoryLength);
  }

  // Mettre à jour les données du graphique
  const labels = history.value.map((_, index) => index.toString());
  const data = history.value.map((item) => item.value);

  chartData.value = {
    labels,
    datasets: [
      {
        ...chartData.value.datasets[0],
        data,
      },
    ],
  };

  // Mettre à jour le graphique s'il existe
  if (chart) {
    chart.data = chartData.value;
    chart.update("none"); // Animation désactivée pour les performances
  }
}

function initChart() {
  if (!canvasRef.value) {
    return;
  }

  const config: ChartConfiguration<"line"> = {
    type: "line",
    data: chartData.value,
    options: {
      responsive: false,
      maintainAspectRatio: false,
      animation: false, // Désactiver les animations pour les performances
      interaction: {
        intersect: false,
        mode: "index",
      },
      scales: {
        x: {
          display: false, // Cacher l'axe X pour un look plus propre
        },
        y: {
          display: false, // Cacher l'axe Y pour économiser l'espace
          min: props.feature.minMax[0],
          max: props.feature.minMax[1],
        },
      },
      plugins: {
        legend: {
          display: false, // Cacher la légende pour économiser l'espace
        },
        tooltip: {
          enabled: true,
          displayColors: false,
          callbacks: {
            title: () => props.feature.name,
            label: (context) =>
              context.parsed.y != null ? `${context.parsed.y.toFixed(3)}` : "",
          },
        },
      },
      elements: {
        line: {
          borderWidth: 1,
        },
        point: {
          radius: 0,
        },
      },
    },
  };

  chart = new Chart(canvasRef.value, config);
}

// Surveiller les changements de feature
watch(
  () => props.feature.value,
  () => {
    updateHistory();
  },
  { deep: true }
);

onMounted(async () => {
  await nextTick();
  initChart();
  // Initialiser avec la valeur actuelle
  updateHistory();
});

onBeforeUnmount(() => {
  if (chart) {
    chart.destroy();
    chart = null;
  }
});
</script>

<style scoped>
.feature-chart {
  position: relative;
}

canvas {
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.02);
}
</style>