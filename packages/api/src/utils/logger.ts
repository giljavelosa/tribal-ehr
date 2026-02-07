import winston from 'winston';

const PHI_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // SSN patterns (XXX-XX-XXXX or XXXXXXXXX)
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN-REDACTED]' },
  { pattern: /\b\d{9}\b/g, replacement: '[ID-REDACTED]' },
  // Date of birth patterns (various formats)
  { pattern: /\b(DOB|dob|dateOfBirth|date_of_birth|birthDate|birth_date)\s*[:=]\s*["']?\d{4}[-/]\d{2}[-/]\d{2}["']?/gi, replacement: '$1:[DOB-REDACTED]' },
  { pattern: /\b(DOB|dob|dateOfBirth|date_of_birth|birthDate|birth_date)\s*[:=]\s*["']?\d{2}[-/]\d{2}[-/]\d{4}["']?/gi, replacement: '$1:[DOB-REDACTED]' },
  // Patient name patterns (common key-value patterns in logs)
  { pattern: /(patientName|patient_name|patientname|fullName|full_name)\s*[:=]\s*["']?[A-Za-z]+[\s,]+[A-Za-z]+["']?/gi, replacement: '$1:[NAME-REDACTED]' },
  // MRN patterns
  { pattern: /(mrn|MRN|medicalRecordNumber|medical_record_number)\s*[:=]\s*["']?[\w-]+["']?/gi, replacement: '$1:[MRN-REDACTED]' },
  // Phone numbers
  { pattern: /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: '[PHONE-REDACTED]' },
  // Email addresses
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL-REDACTED]' },
];

function sanitize(message: string): string {
  let sanitized = message;
  for (const { pattern, replacement } of PHI_PATTERNS) {
    // Reset lastIndex for global regex patterns
    pattern.lastIndex = 0;
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

const sanitizeFormat = winston.format((info) => {
  if (typeof info.message === 'string') {
    info.message = sanitize(info.message);
  }
  return info;
});

const isProduction = process.env.NODE_ENV === 'production';

const consoleFormat = isProduction
  ? winston.format.combine(
      winston.format.timestamp(),
      sanitizeFormat(),
      winston.format.json()
    )
  : winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      sanitizeFormat(),
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level}]: ${message}${metaStr}`;
      })
    );

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: consoleFormat,
  }),
];

if (isProduction) {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        sanitizeFormat(),
        winston.format.json()
      ),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        sanitizeFormat(),
        winston.format.json()
      ),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 20,
    })
  );
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  },
  defaultMeta: { service: 'tribal-ehr-api' },
  transports,
  exitOnError: false,
});

// Add colors for custom levels
winston.addColors({
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
});

export default logger;
