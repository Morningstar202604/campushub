export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-secret',
    expiresIn: '15m',
  },
  refreshTtlDays: 30,
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
});
