import { MediaPipeChain } from "./classes/MediaPipeChain.js";

// Récupérer les éléments du DOM
const videoEl = document.getElementById("video");
const canvasEl = document.getElementById("canvas");

// Créer l'instance unique de la chaîne de traitement
const mediaPipeChain = new MediaPipeChain(videoEl, canvasEl);

// Démarrer le pipeline
mediaPipeChain.start().catch((error) => {
  console.error("Failed to start MediaPipe chain:", error);
});
