export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpOrchestratorConfig {
  port: number;
  apiKeys: string[];
  servers: McpServerConfig[];
}

export interface ServerInstance {
  port: number;
  process: any; // ChildProcess from child_process
}

export interface HealthStatus {
  [serverName: string]: {
    port: number;
    pid: number;
    alive: boolean;
  };
}