export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // S3-compatible storage (Railway bucket) - uses Railway's AWS variable names
  s3Endpoint: process.env.AWS_ENDPOINT_URL ?? "",
  s3AccessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  s3BucketName: process.env.AWS_S3_BUCKET_NAME ?? "",
  s3Region: process.env.AWS_DEFAULT_REGION ?? "auto",
};
