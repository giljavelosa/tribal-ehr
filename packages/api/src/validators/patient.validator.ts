// =============================================================================
// Patient Validators - Zod Schemas for Patient CRUD Operations
// =============================================================================

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared sub-schemas
// ---------------------------------------------------------------------------

const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'AS', 'GU', 'MP', 'PR', 'VI',
] as const;

const phoneRegex = /^[\d()+\-.\s]{7,20}$/;

const phoneNumberSchema = z.object({
  use: z.enum(['home', 'work', 'temp', 'old', 'mobile']).optional(),
  system: z.enum(['phone', 'fax', 'sms', 'pager']).optional(),
  value: z
    .string()
    .min(7, 'Phone number too short')
    .max(20, 'Phone number too long')
    .regex(phoneRegex, 'Invalid phone number format'),
});

const addressSchema = z.object({
  use: z.enum(['home', 'work', 'temp', 'old', 'billing']).optional(),
  type: z.enum(['postal', 'physical', 'both']).optional(),
  line1: z.string().min(1, 'Address line 1 is required').max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1, 'City is required').max(100),
  state: z
    .string()
    .length(2, 'State must be a 2-letter code')
    .refine(
      (val) => (US_STATE_CODES as readonly string[]).includes(val.toUpperCase()),
      { message: 'Invalid US state code' }
    )
    .transform((val) => val.toUpperCase()),
  postalCode: z
    .string()
    .min(5, 'Postal code must be at least 5 characters')
    .max(10)
    .regex(/^\d{5}(-\d{4})?$/, 'Invalid US postal code format'),
  country: z.string().max(50).optional(),
  period: z
    .object({
      start: z.string().optional(),
      end: z.string().optional(),
    })
    .optional(),
});

const emergencyContactSchema = z.object({
  name: z.string().min(1, 'Contact name is required').max(200),
  relationship: z.string().min(1, 'Relationship is required').max(100),
  phone: z
    .string()
    .min(7)
    .max(20)
    .regex(phoneRegex, 'Invalid phone number format'),
  address: addressSchema.optional(),
});

const insuranceCoverageSchema = z.object({
  payerId: z.string().min(1, 'Payer ID is required').max(50),
  payerName: z.string().min(1, 'Payer name is required').max(200),
  memberId: z.string().min(1, 'Member ID is required').max(50),
  groupNumber: z.string().max(50).optional(),
  planName: z.string().max(200).optional(),
  planType: z
    .enum(['HMO', 'PPO', 'EPO', 'POS', 'HDHP', 'Medicaid', 'Medicare', 'TRICARE', 'Other'])
    .optional(),
  subscriberRelationship: z.enum(['self', 'spouse', 'child', 'other']).optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  terminationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
    .optional(),
  copay: z.number().min(0).optional(),
  deductible: z.number().min(0).optional(),
});

const codeableConceptSchema = z.object({
  coding: z
    .array(
      z.object({
        system: z.string().optional(),
        version: z.string().optional(),
        code: z.string().optional(),
        display: z.string().optional(),
        userSelected: z.boolean().optional(),
      })
    )
    .optional(),
  text: z.string().optional(),
});

const raceCodeSchema = z.object({
  code: z.string().min(1),
  display: z.string().min(1),
  system: z.string().min(1),
});

const communicationPreferencesSchema = z.object({
  preferredMethod: z.enum(['phone', 'email', 'sms', 'mail', 'portal']).optional(),
  consentToText: z.boolean().optional(),
  consentToEmail: z.boolean().optional(),
  consentToCall: z.boolean().optional(),
  portalEnabled: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Create Patient Schema
// ---------------------------------------------------------------------------

export const createPatientSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name must not exceed 100 characters')
    .trim(),
  middleName: z.string().max(100).trim().optional(),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must not exceed 100 characters')
    .trim(),
  suffix: z.string().max(20).trim().optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format')
    .refine(
      (val) => {
        const dob = new Date(val);
        return !isNaN(dob.getTime()) && dob < new Date();
      },
      { message: 'Date of birth must be a valid date in the past' }
    ),
  sex: z.enum(['male', 'female', 'other', 'unknown'], {
    errorMap: () => ({ message: 'Sex must be one of: male, female, other, unknown' }),
  }),
  genderIdentity: codeableConceptSchema.optional(),
  sexualOrientation: codeableConceptSchema.optional(),
  race: z.array(raceCodeSchema).optional(),
  ethnicity: codeableConceptSchema.optional(),
  preferredLanguage: z.string().max(50).optional(),
  maritalStatus: z
    .enum(['A', 'D', 'I', 'L', 'M', 'P', 'S', 'T', 'U', 'W', 'UNK'])
    .optional(),
  addresses: z.array(addressSchema).max(10).optional(),
  phoneNumbers: z.array(phoneNumberSchema).max(10).optional(),
  emails: z
    .array(z.string().email('Invalid email address').max(254))
    .max(5)
    .optional(),
  emergencyContacts: z.array(emergencyContactSchema).max(5).optional(),
  insuranceCoverage: z.array(insuranceCoverageSchema).max(10).optional(),
  photo: z.string().url().optional(),
  deceasedBoolean: z.boolean().optional(),
  deceasedDateTime: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/)
    .optional(),
  multipleBirthBoolean: z.boolean().optional(),
  multipleBirthInteger: z.number().int().min(1).max(10).optional(),
  communicationPreferences: communicationPreferencesSchema.optional(),
  active: z.boolean().optional().default(true),
});

export type CreatePatientDTO = z.infer<typeof createPatientSchema>;

// ---------------------------------------------------------------------------
// Update Patient Schema (all fields optional)
// ---------------------------------------------------------------------------

export const updatePatientSchema = createPatientSchema.partial().omit({});

export type UpdatePatientDTO = z.infer<typeof updatePatientSchema>;

// ---------------------------------------------------------------------------
// Search Patient Schema (query parameters)
// ---------------------------------------------------------------------------

export const searchPatientSchema = z.object({
  name: z.string().max(200).optional(),
  mrn: z.string().max(20).optional(),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  phone: z.string().max(20).optional(),
  email: z.string().max(254).optional(),
  active: z
    .string()
    .optional()
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    }),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1).default(1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().min(1).max(200).default(20)),
  sort: z.enum(['name', 'dob', 'mrn', 'createdAt']).optional(),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
});

export type PatientSearchParams = z.infer<typeof searchPatientSchema>;
