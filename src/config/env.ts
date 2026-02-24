import * as z from "zod/v4";

const envSchema = z.object({
  ROUTEMESH_API_KEY: z.string().min(1, "ROUTEMESH_API_KEY is required"),
  ROUTEMESH_BASE_URL: z.string().url().default("https://lb.routeme.sh"),
  ROUTEMESH_BACKUP_BASE_URL: z.string().url().default("https://lb2.routeme.sh"),
  ROUTEMESH_TIMEOUT_MS: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : 20_000))
    .pipe(z.number().int().min(1_000).max(120_000)),
  ROUTEMESH_RETRY_ATTEMPTS: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : 2))
    .pipe(z.number().int().min(0).max(5)),
  ROUTEMESH_LLMS_URL: z.string().url().default("https://routeme.sh/llms.txt"),
});

export type AppConfig = {
  apiKey: string;
  baseUrl: string;
  backupBaseUrl: string;
  timeoutMs: number;
  retryAttempts: number;
  llmsUrl: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  const data = parsed.data;
  return {
    apiKey: data.ROUTEMESH_API_KEY,
    baseUrl: data.ROUTEMESH_BASE_URL,
    backupBaseUrl: data.ROUTEMESH_BACKUP_BASE_URL,
    timeoutMs: data.ROUTEMESH_TIMEOUT_MS,
    retryAttempts: data.ROUTEMESH_RETRY_ATTEMPTS,
    llmsUrl: data.ROUTEMESH_LLMS_URL,
  };
}
