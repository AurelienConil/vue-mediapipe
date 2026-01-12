import { io, Socket } from 'socket.io-client';

interface SocketLoggerConfig {
    enabled?: boolean;
    serverUrl?: string;
    appName?: string;
    reconnectionAttempts?: number;
    queueSize?: number;
    silentMode?: boolean; // Mode silencieux pour éviter les erreurs de connexion
}

class SocketLogger {
    private socket: Socket | null = null;
    private originalConsole: {
        log: typeof console.log;
        warn: typeof console.warn;
        error: typeof console.error;
        info: typeof console.info;
    };
    private isConnected = false;
    private messageQueue: Array<{ type: string; args: any[] }> = [];
    private isEnabled = false;
    private isIntercepting = false;
    private config: SocketLoggerConfig = {};
    private isProcessingLog = false; // Évite la récursion
    private connectionAttempts = 0;
    private maxConnectionAttempts = 3;

    constructor() {
        // Sauvegarder les méthodes console originales
        this.originalConsole = {
            log: console.log.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
            info: console.info.bind(console),
        };

        // Vérifier si activé via variable d'environnement
        this.isEnabled = this.checkEnvironmentEnabled();
    }

    /**
     * Vérifie si le logger est activé via les variables d'environnement
     */
    private checkEnvironmentEnabled(): boolean {
        // Dans un environnement Vite, import.meta.env est toujours disponible
        try {
            return import.meta.env.VITE_SOCKET_LOGGER_ENABLED === 'true';
        } catch (error) {
            // Fallback si import.meta.env n'est pas disponible
            return false;
        }
    }

    /**
     * Active le socket logger
     */
    public enable(): void {
        this.isEnabled = true;
        this.originalConsole.log('[SocketLogger] Activé');
    }

    /**
     * Désactive le socket logger
     */
    public disable(): void {
        this.isEnabled = false;
        this.restore();
        this.originalConsole.log('[SocketLogger] Désactivé');
    }

    /**
     * Retourne l'état d'activation
     */
    public get enabled(): boolean {
        return this.isEnabled;
    }

    /**
     * Retourne l'état de connexion
     */
    public get connected(): boolean {
        return this.isConnected;
    }

    /**
     * Initialise la connexion socket.io et intercepte les console.log
     */
    public init(config: SocketLoggerConfig = {}): void {
        // Fusionner la configuration par défaut
        this.config = {
            enabled: this.isEnabled,
            serverUrl: 'http://localhost:3001',
            appName: 'VueMediaPipe',
            reconnectionAttempts: 3,
            queueSize: 100,
            silentMode: false,
            ...config
        };

        // Mettre à jour l'état d'activation
        if (this.config.enabled !== undefined) {
            this.isEnabled = this.config.enabled;
        }

        if (!this.config.silentMode) {
            this.originalConsole.log(`[${this.config.appName}] Socket Logger - État: ${this.isEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
        }

        if (!this.isEnabled) {
            if (!this.config.silentMode) {
                this.originalConsole.log(`[${this.config.appName}] Socket Logger désactivé`);
            }
            return;
        }

        // Intercepter les méthodes console AVANT la connexion
        this.interceptConsole();

        try {
            // Connexion au serveur de logs
            this.socket = io(this.config.serverUrl!, {
                timeout: 3000,
                reconnection: true,
                reconnectionAttempts: this.config.reconnectionAttempts,
                reconnectionDelay: 2000,
                transports: ['websocket', 'polling'] // Essayer websocket en premier
            });

            // Gestion des événements de connexion
            this.socket.on('connect', () => {
                this.isConnected = true;
                this.connectionAttempts = 0;
                if (!this.config.silentMode) {
                    this.originalConsole.log(`[${this.config.appName}] ✅ Connexion au serveur de logs établie`);
                }

                // Envoyer les messages en attente
                this.flushMessageQueue();
            });

            this.socket.on('disconnect', () => {
                this.isConnected = false;
                if (!this.config.silentMode) {
                    this.originalConsole.warn(`[${this.config.appName}] ⚠️ Connexion au serveur de logs perdue`);
                }
            });

            this.socket.on('connect_error', (error) => {
                this.connectionAttempts++;

                // Après plusieurs tentatives, passer en mode silencieux automatiquement
                if (this.connectionAttempts >= this.maxConnectionAttempts) {
                    if (!this.config.silentMode) {
                        this.originalConsole.warn(`[${this.config.appName}] ⚠️ Impossible de se connecter au serveur de logs après ${this.connectionAttempts} tentatives. Mode silencieux activé.`);
                        this.config.silentMode = true;
                    }
                } else if (!this.config.silentMode) {
                    this.originalConsole.warn(`[${this.config.appName}] ⚠️ Tentative de connexion ${this.connectionAttempts}/${this.maxConnectionAttempts} échouée`);
                }
            });

        } catch (error) {
            if (!this.config.silentMode) {
                this.originalConsole.error(`[${this.config.appName}] Erreur lors de l'initialisation du socket logger:`, error);
            }
        }
    }

    /**
     * Intercepte les méthodes console pour les rediriger vers socket.io
     */
    private interceptConsole(): void {
        if (this.isIntercepting) {
            return;
        }

        this.isIntercepting = true;
        if (!this.config.silentMode) {
            this.originalConsole.log(`[${this.config.appName}] 🔀 Interception des console.log activée`);
        }

        // Intercept console.log
        console.log = (...args: any[]) => {
            this.originalConsole.log(...args);
            if (this.isEnabled && !this.isProcessingLog) {
                this.isProcessingLog = true;
                this.sendLogMessage('log', args);
                this.isProcessingLog = false;
            }
        };

        // Intercept console.warn
        console.warn = (...args: any[]) => {
            this.originalConsole.warn(...args);
            if (this.isEnabled && !this.isProcessingLog) {
                this.isProcessingLog = true;
                this.sendLogMessage('warn', args);
                this.isProcessingLog = false;
            }
        };

        // Intercept console.error
        console.error = (...args: any[]) => {
            this.originalConsole.error(...args);
            if (this.isEnabled && !this.isProcessingLog) {
                this.isProcessingLog = true;
                this.sendLogMessage('error', args);
                this.isProcessingLog = false;
            }
        };

        // Intercept console.info
        console.info = (...args: any[]) => {
            this.originalConsole.info(...args);
            if (this.isEnabled && !this.isProcessingLog) {
                this.isProcessingLog = true;
                this.sendLogMessage('info', args);
                this.isProcessingLog = false;
            }
        };
    }

    /**
     * Envoie un message de log via socket.io
     */
    private sendLogMessage(level: string, args: any[]): void {
        if (!this.isEnabled) return;

        const message = this.formatMessage(args);
        

        if (this.socket && this.isConnected) {
            try {
                this.socket.emit('log-message', message);
            } catch (error) {
                // Utiliser originalConsole pour éviter la récursion
                this.originalConsole.error(`[${this.config.appName}] Erreur lors de l'envoi du message:`, error);
            }
        } else {
            // Stocker le message en attente si pas encore connecté
            this.messageQueue.push({ type: level, args });

            // Limiter la taille de la queue
            const maxQueueSize = this.config.queueSize || 100;
            if (this.messageQueue.length > maxQueueSize) {
                this.messageQueue.shift();
            }
        }
    }

    /**
     * Formate les arguments de console en string
     */
    private formatMessage(args: any[]): string {
        return args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
    }

    /**
     * Envoie tous les messages en attente
     */
    private flushMessageQueue(): void {
        while (this.messageQueue.length > 0) {
            const queuedMessage = this.messageQueue.shift();
            if (queuedMessage) {
                this.sendLogMessage(queuedMessage.type, queuedMessage.args);
            }
        }
    }

    /**
     * Restaure les méthodes console originales
     */
    public restore(): void {
        if (this.isIntercepting) {
            console.log = this.originalConsole.log;
            console.warn = this.originalConsole.warn;
            console.error = this.originalConsole.error;
            console.info = this.originalConsole.info;
            this.isIntercepting = false;
        }

        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }
    }

    /**
     * Envoie un message de log personnalisé
     */
    public sendCustomLog(message: string, level: string = 'info'): void {
        if (!this.isEnabled) return;
        this.sendLogMessage(level, [message]);
    }

    /**
     * Toggle l'état d'activation
     */
    public toggle(): boolean {
        if (this.isEnabled) {
            this.disable();
        } else {
            this.enable();
        }
        return this.isEnabled;
    }

    /**
     * Reconfigure le logger
     */
    public configure(config: SocketLoggerConfig): void {
        const wasEnabled = this.isEnabled;

        // Si on désactive, restaurer d'abord
        if (wasEnabled && config.enabled === false) {
            this.restore();
        }

        // Mettre à jour la configuration
        this.config = { ...this.config, ...config };
        this.isEnabled = this.config.enabled ?? this.isEnabled;

        // Si on réactive, réinitialiser
        if (!wasEnabled && this.isEnabled) {
            this.init(this.config);
        }
    }

    /**
     * Affiche l'état du logger
     */
    public getStatus(): void {
        this.originalConsole.log(`[${this.config.appName}] Status:
        - Enabled: ${this.isEnabled}
        - Intercepting: ${this.isIntercepting}
        - Connected: ${this.isConnected}
        - Queue size: ${this.messageQueue.length}
        - Server URL: ${this.config.serverUrl}
        - Silent mode: ${this.config.silentMode}
        - Connection attempts: ${this.connectionAttempts}`);
    }

    /**
     * Active le mode silencieux
     */
    public setSilentMode(silent: boolean): void {
        this.config.silentMode = silent;
        if (!silent) {
            this.originalConsole.log(`[${this.config.appName}] Mode silencieux désactivé`);
        }
    }
}

// Instance singleton
const socketLogger = new SocketLogger();

export default socketLogger;
export { SocketLogger, type SocketLoggerConfig };