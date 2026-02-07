// Global test setup
// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.DATABASE_URL = 'postgresql://ehr_admin:ehr_secure_dev_2024@localhost:5432/tribal_ehr_test';
process.env.REDIS_URL = 'redis://:ehr_redis_dev_2024@localhost:6379';
process.env.FHIR_SERVER_URL = 'http://localhost:8080/fhir';
