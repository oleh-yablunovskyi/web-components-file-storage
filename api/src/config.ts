function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[config] missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

export const config = {
  get port() {
    return Number(process.env.PORT ?? 3000);
  },
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get jwtSecret() {
    return required("JWT_SECRET");
  },
};
