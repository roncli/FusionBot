import "ws";

declare module "ws" {
    /**
     * Add broadcast to server definition.
     */
    interface Server {
        broadcast(message: object): void;
    }
}
