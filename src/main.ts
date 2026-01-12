import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import 'vuetify/styles' // ← Import manquant !
import '@mdi/font/css/materialdesignicons.css'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

import App from './App.vue'
import socketLogger from './utils/socketLogger'

// Initialisation du socket logger
socketLogger.init({
    enabled: import.meta.env.VITE_SOCKET_LOGGER_ENABLED === 'true',
    serverUrl: import.meta.env.VITE_SOCKET_LOGGER_URL || 'http://localhost:3001',
    appName: 'VueMediaPipe',
    silentMode: false // Mettre à true pour éviter les messages dans la console
})

// Log de démarrage de l'application
console.log('Application VueMediaPipe démarrée avec succès')

// Tests de logs pour vérifier l'interception
setTimeout(() => {
    console.log('Test log après 2 secondes - ceci devrait apparaître via socket.io')
    socketLogger.getStatus()
}, 2000)

const pinia = createPinia()
const vuetify = createVuetify({
    components,
    directives,
    icons: {
        defaultSet: 'mdi',
    },
})

createApp(App)
    .use(pinia)
    .use(vuetify)
    .mount('#app')

// Rendre le logger accessible globalement pour debug
if (import.meta.env.DEV) {
    (window as any).socketLogger = socketLogger
}
