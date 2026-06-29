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
  get s3Endpoint() {
    return required("S3_ENDPOINT");
  },
  get s3Region() {
    return required("S3_REGION");
  },
  get s3Bucket() {
    return required("S3_BUCKET");
  },
  get s3AccessKey() {
    return required("S3_ACCESS_KEY");
  },
  get s3SecretKey() {
    return required("S3_SECRET_KEY");
  },
};
