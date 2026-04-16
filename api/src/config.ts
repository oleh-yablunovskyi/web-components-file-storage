function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[config] missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
};
