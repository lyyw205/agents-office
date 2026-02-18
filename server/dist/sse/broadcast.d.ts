type Writer = (event: string, data: string) => void;
export declare function addClient(writer: Writer): void;
export declare function removeClient(writer: Writer): void;
export declare function broadcast(event: string, data: string): void;
export {};
//# sourceMappingURL=broadcast.d.ts.map