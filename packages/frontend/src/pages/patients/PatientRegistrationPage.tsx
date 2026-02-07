import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  User,
  Phone,
  Heart,
  Shield,
  ClipboardCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useCreatePatient } from '@/hooks/use-api';
import { SimilarPatientsAlert } from '@/components/patient/SimilarPatientsAlert';

// ---- USCDI v3 Coded Value Sets (SNOMED CT / HL7 / CDC) ----

interface DemographicsCode {
  code: string;
  system: string;
  display: string;
}

interface LanguageCode {
  code: string;
  display: string;
}

// Gender Identity - SNOMED CT + HL7 gender-identity value set
const GENDER_IDENTITY_CODES: DemographicsCode[] = [
  { code: '446151000124109', system: 'http://snomed.info/sct', display: 'Identifies as male gender' },
  { code: '446141000124107', system: 'http://snomed.info/sct', display: 'Identifies as female gender' },
  { code: '33791000087105', system: 'http://snomed.info/sct', display: 'Identifies as nonbinary gender' },
  { code: 'OTH', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor', display: 'Other' },
  { code: 'ASKU', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor', display: 'Asked but unknown' },
  { code: 'UNK', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor', display: 'Unknown' },
];

// Sexual Orientation - SNOMED CT
const SEXUAL_ORIENTATION_CODES: DemographicsCode[] = [
  { code: '38628009', system: 'http://snomed.info/sct', display: 'Lesbian, gay, or homosexual' },
  { code: '20430005', system: 'http://snomed.info/sct', display: 'Heterosexual' },
  { code: '42035005', system: 'http://snomed.info/sct', display: 'Bisexual' },
  { code: 'OTH', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor', display: 'Other' },
  { code: 'ASKU', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor', display: 'Asked but unknown' },
  { code: 'UNK', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor', display: 'Unknown' },
];

// Race - CDC Race & Ethnicity Code Set (OMB categories)
const RACE_CODES: DemographicsCode[] = [
  { code: '1002-5', system: 'urn:oid:2.16.840.1.113883.6.238', display: 'American Indian or Alaska Native' },
  { code: '2028-9', system: 'urn:oid:2.16.840.1.113883.6.238', display: 'Asian' },
  { code: '2054-5', system: 'urn:oid:2.16.840.1.113883.6.238', display: 'Black or African American' },
  { code: '2076-8', system: 'urn:oid:2.16.840.1.113883.6.238', display: 'Native Hawaiian or Other Pacific Islander' },
  { code: '2106-3', system: 'urn:oid:2.16.840.1.113883.6.238', display: 'White' },
  { code: 'ASKU', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor', display: 'Asked but unknown' },
  { code: 'UNK', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor', display: 'Unknown' },
];

// Ethnicity - CDC
const ETHNICITY_CODES: DemographicsCode[] = [
  { code: '2135-2', system: 'urn:oid:2.16.840.1.113883.6.238', display: 'Hispanic or Latino' },
  { code: '2186-5', system: 'urn:oid:2.16.840.1.113883.6.238', display: 'Not Hispanic or Latino' },
  { code: 'ASKU', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor', display: 'Asked but unknown' },
  { code: 'UNK', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor', display: 'Unknown' },
];

// Preferred Language - BCP-47 (most common US + tribal languages)
const LANGUAGE_CODES: LanguageCode[] = [
  { code: 'en', display: 'English' },
  { code: 'es', display: 'Spanish' },
  { code: 'zh', display: 'Chinese' },
  { code: 'vi', display: 'Vietnamese' },
  { code: 'ko', display: 'Korean' },
  { code: 'tl', display: 'Tagalog' },
  { code: 'ar', display: 'Arabic' },
  { code: 'fr', display: 'French' },
  { code: 'de', display: 'German' },
  { code: 'ru', display: 'Russian' },
  { code: 'ja', display: 'Japanese' },
  { code: 'nv', display: 'Navajo' },
  { code: 'chr', display: 'Cherokee' },
  { code: 'oj', display: 'Ojibwe' },
  { code: 'dak', display: 'Dakota' },
];

/** Look up a code entry by code value */
function findCode(codes: DemographicsCode[], codeValue: string): DemographicsCode | undefined {
  return codes.find((c) => c.code === codeValue);
}

// ---- Validation Schema ----

const registrationSchema = z.object({
  // Step 1: Demographics
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  middleName: z.string().optional(),
  dob: z.string().min(1, 'Date of birth is required'),
  gender: z.string().min(1, 'Gender is required'),
  sex: z.string().min(1, 'Sex at birth is required'),
  genderIdentity: z.string().optional(),
  sexualOrientation: z.string().optional(),
  ssn: z.string().optional(),
  race: z.string().optional(),
  ethnicity: z.string().optional(),
  preferredLanguage: z.string().optional(),
  maritalStatus: z.string().optional(),

  // Step 2: Contact Info
  addressLine1: z.string().min(1, 'Address is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z
    .string()
    .min(5, 'Valid ZIP code required')
    .regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format'),
  phone: z.string().min(10, 'Valid phone number required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),

  // Step 3: Emergency Contacts
  emergencyContact1Name: z.string().min(1, 'Emergency contact name is required'),
  emergencyContact1Phone: z
    .string()
    .min(10, 'Valid phone number required'),
  emergencyContact1Relationship: z
    .string()
    .min(1, 'Relationship is required'),
  emergencyContact2Name: z.string().optional(),
  emergencyContact2Phone: z.string().optional(),
  emergencyContact2Relationship: z.string().optional(),

  // Step 4: Insurance
  insurancePlan: z.string().optional(),
  memberId: z.string().optional(),
  groupNumber: z.string().optional(),
  subscriberName: z.string().optional(),
  subscriberDob: z.string().optional(),
  subscriberRelation: z.string().optional(),

  // Step 5: Consent & Review
  consentToTreat: z.boolean().refine((v) => v === true, {
    message: 'Consent to treatment is required',
  }),
  consentToShareInfo: z.boolean().optional(),
  advanceDirective: z.boolean().optional(),
  notes: z.string().optional(),
});

type RegistrationFormData = z.infer<typeof registrationSchema>;

const steps = [
  { id: 1, name: 'Demographics', icon: User },
  { id: 2, name: 'Contact Info', icon: Phone },
  { id: 3, name: 'Emergency Contacts', icon: Heart },
  { id: 4, name: 'Insurance', icon: Shield },
  { id: 5, name: 'Consent & Review', icon: ClipboardCheck },
];

// Fields validated per step for partial validation
const stepFields: Record<number, (keyof RegistrationFormData)[]> = {
  1: ['firstName', 'lastName', 'dob', 'gender', 'sex'],
  2: ['addressLine1', 'city', 'state', 'postalCode', 'phone'],
  3: [
    'emergencyContact1Name',
    'emergencyContact1Phone',
    'emergencyContact1Relationship',
  ],
  4: [],
  5: ['consentToTreat'],
};

interface SimilarPatientResult {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  mrn: string;
  confidence: number;
  matchReasons: string[];
}

export function PatientRegistrationPage() {
  const navigate = useNavigate();
  const createPatient = useCreatePatient();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [similarPatients, setSimilarPatients] = useState<SimilarPatientResult[]>([]);
  const [showSimilarAlert, setShowSimilarAlert] = useState(false);
  const [checkingSimilar, setCheckingSimilar] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      middleName: '',
      dob: '',
      gender: '',
      sex: '',
      genderIdentity: '',
      sexualOrientation: '',
      ssn: '',
      race: '',
      ethnicity: '',
      preferredLanguage: 'en',
      maritalStatus: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      phone: '',
      email: '',
      emergencyContact1Name: '',
      emergencyContact1Phone: '',
      emergencyContact1Relationship: '',
      emergencyContact2Name: '',
      emergencyContact2Phone: '',
      emergencyContact2Relationship: '',
      insurancePlan: '',
      memberId: '',
      groupNumber: '',
      subscriberName: '',
      subscriberDob: '',
      subscriberRelation: '',
      consentToTreat: false,
      consentToShareInfo: false,
      advanceDirective: false,
      notes: '',
    },
    mode: 'onTouched',
  });

  const formValues = watch();

  const checkSimilarPatients = useCallback(async () => {
    const values = getValues();
    if (!values.firstName || !values.lastName || !values.dob) return;
    setCheckingSimilar(true);
    try {
      const params = new URLSearchParams({
        firstName: values.firstName,
        lastName: values.lastName,
        dateOfBirth: values.dob,
        ...(values.sex ? { sex: values.sex } : {}),
      });
      const response = await fetch(`/api/v1/patients/similar?${params}`);
      if (response.ok) {
        const result = await response.json();
        const matches: SimilarPatientResult[] = result.data || [];
        if (matches.length > 0) {
          setSimilarPatients(matches);
          setShowSimilarAlert(true);
          return true; // found similar patients
        }
      }
    } catch {
      // If similar patient check fails, allow proceeding
    } finally {
      setCheckingSimilar(false);
    }
    return false;
  }, [getValues]);

  const goToNextStep = useCallback(async () => {
    const fieldsToValidate = stepFields[currentStep];
    if (fieldsToValidate && fieldsToValidate.length > 0) {
      const valid = await trigger(fieldsToValidate);
      if (!valid) return;
    }
    // Check for similar patients when leaving demographics step
    if (currentStep === 1 && !showSimilarAlert) {
      const hasSimilar = await checkSimilarPatients();
      if (hasSimilar) return; // Block until user dismisses or selects
    }
    setShowSimilarAlert(false);
    setSimilarPatients([]);
    setCurrentStep((s) => Math.min(s + 1, 5));
  }, [currentStep, trigger, showSimilarAlert, checkSimilarPatients]);

  const goToPrevStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
    } else {
      navigate('/patients');
    }
  }, [currentStep, navigate]);

  const onSubmit = useCallback(
    async (data: RegistrationFormData) => {
      setSubmitError(null);
      try {
        const emergencyContacts = [
          {
            name: data.emergencyContact1Name,
            phone: data.emergencyContact1Phone,
            relationship: data.emergencyContact1Relationship,
          },
        ];
        if (data.emergencyContact2Name && data.emergencyContact2Phone) {
          emergencyContacts.push({
            name: data.emergencyContact2Name,
            phone: data.emergencyContact2Phone,
            relationship: data.emergencyContact2Relationship || 'Other',
          });
        }

        const patientData = {
          firstName: data.firstName,
          lastName: data.lastName,
          middleName: data.middleName || undefined,
          dob: data.dob,
          gender: data.gender,
          sex: data.sex,
          genderIdentity: (() => {
            const gi = data.genderIdentity ? findCode(GENDER_IDENTITY_CODES, data.genderIdentity) : undefined;
            return gi ? { coding: [gi], text: gi.display } : undefined;
          })(),
          sexualOrientation: (() => {
            const so = data.sexualOrientation ? findCode(SEXUAL_ORIENTATION_CODES, data.sexualOrientation) : undefined;
            return so ? { coding: [so], text: so.display } : undefined;
          })(),
          race: (() => {
            const r = data.race ? findCode(RACE_CODES, data.race) : undefined;
            return r ? [r] : undefined;
          })(),
          ethnicity: (() => {
            const e = data.ethnicity ? findCode(ETHNICITY_CODES, data.ethnicity) : undefined;
            return e ? { coding: [e], text: e.display } : undefined;
          })(),
          preferredLanguage: data.preferredLanguage || undefined,
          maritalStatus: data.maritalStatus || undefined,
          phone: data.phone,
          email: data.email || undefined,
          address: {
            line1: data.addressLine1,
            line2: data.addressLine2 || undefined,
            city: data.city,
            state: data.state,
            postalCode: data.postalCode,
          },
          emergencyContacts,
          insurance: data.insurancePlan
            ? {
                plan: data.insurancePlan,
                memberId: data.memberId || '',
                groupNumber: data.groupNumber || undefined,
                subscriberName: data.subscriberName || undefined,
                subscriberDob: data.subscriberDob || undefined,
                subscriberRelation: data.subscriberRelation || undefined,
              }
            : undefined,
          status: 'active' as const,
        };

        const created = await createPatient.mutateAsync(patientData);
        navigate(`/patients/${created.id}`);
      } catch (error: unknown) {
        // Handle 409 duplicate patient detection from server-side check
        const axiosError = error as { response?: { status?: number; data?: { matches?: SimilarPatientResult[] } } };
        if (axiosError?.response?.status === 409 && axiosError.response.data?.matches) {
          setSimilarPatients(axiosError.response.data.matches);
          setShowSimilarAlert(true);
          setSubmitError('Potential duplicate patients detected. Review matches below or click "Create Anyway".');
          return;
        }
        setSubmitError(
          'Failed to register patient. Please try again.',
        );
      }
    },
    [createPatient, navigate],
  );

  const onSubmitWithBypass = useCallback(
    async (data: RegistrationFormData) => {
      setSubmitError(null);
      setSimilarPatients([]);
      setShowSimilarAlert(false);
      try {
        const emergencyContacts = [
          {
            name: data.emergencyContact1Name,
            phone: data.emergencyContact1Phone,
            relationship: data.emergencyContact1Relationship,
          },
        ];
        if (data.emergencyContact2Name && data.emergencyContact2Phone) {
          emergencyContacts.push({
            name: data.emergencyContact2Name,
            phone: data.emergencyContact2Phone,
            relationship: data.emergencyContact2Relationship || 'Other',
          });
        }

        const patientData = {
          firstName: data.firstName,
          lastName: data.lastName,
          middleName: data.middleName || undefined,
          dob: data.dob,
          gender: data.gender,
          sex: data.sex,
          genderIdentity: (() => {
            const gi = data.genderIdentity ? findCode(GENDER_IDENTITY_CODES, data.genderIdentity) : undefined;
            return gi ? { coding: [gi], text: gi.display } : undefined;
          })(),
          sexualOrientation: (() => {
            const so = data.sexualOrientation ? findCode(SEXUAL_ORIENTATION_CODES, data.sexualOrientation) : undefined;
            return so ? { coding: [so], text: so.display } : undefined;
          })(),
          race: (() => {
            const r = data.race ? findCode(RACE_CODES, data.race) : undefined;
            return r ? [r] : undefined;
          })(),
          ethnicity: (() => {
            const e = data.ethnicity ? findCode(ETHNICITY_CODES, data.ethnicity) : undefined;
            return e ? { coding: [e], text: e.display } : undefined;
          })(),
          preferredLanguage: data.preferredLanguage || undefined,
          maritalStatus: data.maritalStatus || undefined,
          phone: data.phone,
          email: data.email || undefined,
          address: {
            line1: data.addressLine1,
            line2: data.addressLine2 || undefined,
            city: data.city,
            state: data.state,
            postalCode: data.postalCode,
          },
          emergencyContacts,
          insurance: data.insurancePlan
            ? {
                plan: data.insurancePlan,
                memberId: data.memberId || '',
                groupNumber: data.groupNumber || undefined,
                subscriberName: data.subscriberName || undefined,
                subscriberDob: data.subscriberDob || undefined,
                subscriberRelation: data.subscriberRelation || undefined,
              }
            : undefined,
          status: 'active' as const,
          bypassDuplicateCheck: true,
        };

        const created = await createPatient.mutateAsync(patientData);
        navigate(`/patients/${created.id}`);
      } catch {
        setSubmitError('Failed to register patient. Please try again.');
      }
    },
    [createPatient, navigate],
  );

  const renderFieldError = (field: keyof RegistrationFormData) => {
    const fieldError = errors[field];
    if (!fieldError) return null;
    return (
      <p className="text-xs text-destructive" id={`${field}-error`} role="alert">{fieldError.message as string}</p>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/patients')}
          aria-label="Back to patient list"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            New Patient Registration
          </h1>
          <p className="text-muted-foreground">
            Complete all required fields to register a new patient
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <nav aria-label="Registration progress" className="flex items-center justify-center gap-1 sm:gap-2">
        {steps.map((step, i) => {
          const StepIcon = step.icon;
          return (
            <React.Fragment key={step.id}>
              <div className="flex items-center gap-1 sm:gap-2" aria-current={currentStep === step.id ? 'step' : undefined}>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    currentStep > step.id
                      ? 'bg-primary text-primary-foreground'
                      : currentStep === step.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                  }`}
                  aria-hidden="true"
                >
                  {currentStep > step.id ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <StepIcon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={`hidden text-sm md:inline ${
                    currentStep >= step.id
                      ? 'font-medium'
                      : 'text-muted-foreground'
                  }`}
                >
                  {step.name}
                </span>
                <span className="sr-only">
                  {currentStep > step.id ? '(completed)' : currentStep === step.id ? '(current step)' : '(upcoming)'}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`h-px w-6 sm:w-10 ${
                    currentStep > step.id ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {submitError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {showSimilarAlert && similarPatients.length > 0 && (
        <div className="space-y-2">
          <SimilarPatientsAlert
            patients={similarPatients}
            onSelect={(patientId) => {
              navigate(`/patients/${patientId}`);
            }}
            onDismiss={() => {
              setShowSimilarAlert(false);
              setSimilarPatients([]);
              setCurrentStep((s) => Math.min(s + 1, 5));
            }}
          />
          {currentStep === 5 && (
            <Button
              type="button"
              variant="outline"
              className="w-full border-destructive text-destructive hover:bg-destructive/10"
              onClick={handleSubmit(onSubmitWithBypass)}
              disabled={isSubmitting}
            >
              Create Anyway (Bypass Duplicate Check)
            </Button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          {/* Step 1: Demographics */}
          {currentStep === 1 && (
            <>
              <CardHeader>
                <CardTitle>Demographics</CardTitle>
                <CardDescription>
                  Basic patient demographic information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      {...register('firstName')}
                      aria-required="true"
                      aria-invalid={!!errors.firstName}
                      aria-describedby={errors.firstName ? 'firstName-error' : undefined}
                    />
                    {renderFieldError('firstName')}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="middleName">Middle Name</Label>
                    <Input id="middleName" {...register('middleName')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      {...register('lastName')}
                      aria-required="true"
                      aria-invalid={!!errors.lastName}
                      aria-describedby={errors.lastName ? 'lastName-error' : undefined}
                    />
                    {renderFieldError('lastName')}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="dob">Date of Birth *</Label>
                    <Input
                      id="dob"
                      type="date"
                      {...register('dob')}
                      aria-required="true"
                      aria-invalid={!!errors.dob}
                      aria-describedby={errors.dob ? 'dob-error' : undefined}
                    />
                    {renderFieldError('dob')}
                  </div>
                  <div className="space-y-2">
                    <Label id="gender-label">Gender *</Label>
                    <Controller
                      name="gender"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger aria-required="true" aria-invalid={!!errors.gender} aria-labelledby="gender-label" aria-describedby={errors.gender ? 'gender-error' : undefined}>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="non-binary">
                              Non-binary
                            </SelectItem>
                            <SelectItem value="transgender-male">
                              Transgender Male
                            </SelectItem>
                            <SelectItem value="transgender-female">
                              Transgender Female
                            </SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                            <SelectItem value="unknown">
                              Prefer not to say
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {renderFieldError('gender')}
                  </div>
                  <div className="space-y-2">
                    <Label id="sex-label">Sex at Birth *</Label>
                    <Controller
                      name="sex"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger aria-required="true" aria-invalid={!!errors.sex} aria-labelledby="sex-label" aria-describedby={errors.sex ? 'sex-error' : undefined}>
                            <SelectValue placeholder="Select sex" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="unknown">Unknown</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {renderFieldError('sex')}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Gender Identity</Label>
                    <Controller
                      name="genderIdentity"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender identity" />
                          </SelectTrigger>
                          <SelectContent>
                            {GENDER_IDENTITY_CODES.map((gi) => (
                              <SelectItem key={gi.code} value={gi.code}>
                                {gi.display}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sexual Orientation</Label>
                    <Controller
                      name="sexualOrientation"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select sexual orientation" />
                          </SelectTrigger>
                          <SelectContent>
                            {SEXUAL_ORIENTATION_CODES.map((so) => (
                              <SelectItem key={so.code} value={so.code}>
                                {so.display}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Race</Label>
                    <Controller
                      name="race"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select race" />
                          </SelectTrigger>
                          <SelectContent>
                            {RACE_CODES.map((r) => (
                              <SelectItem key={r.code} value={r.code}>
                                {r.display}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ethnicity</Label>
                    <Controller
                      name="ethnicity"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select ethnicity" />
                          </SelectTrigger>
                          <SelectContent>
                            {ETHNICITY_CODES.map((e) => (
                              <SelectItem key={e.code} value={e.code}>
                                {e.display}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Preferred Language</Label>
                    <Controller
                      name="preferredLanguage"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                          <SelectContent>
                            {LANGUAGE_CODES.map((lang) => (
                              <SelectItem key={lang.code} value={lang.code}>
                                {lang.display}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Marital Status</Label>
                    <Controller
                      name="maritalStatus"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="single">Single</SelectItem>
                            <SelectItem value="married">Married</SelectItem>
                            <SelectItem value="divorced">Divorced</SelectItem>
                            <SelectItem value="widowed">Widowed</SelectItem>
                            <SelectItem value="separated">Separated</SelectItem>
                            <SelectItem value="domestic-partner">
                              Domestic Partner
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ssn">SSN</Label>
                    <Input
                      id="ssn"
                      placeholder="XXX-XX-XXXX"
                      {...register('ssn')}
                    />
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 2: Contact Info */}
          {currentStep === 2 && (
            <>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>
                  Address, phone, and email
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="addressLine1">Address Line 1 *</Label>
                  <Input
                    id="addressLine1"
                    placeholder="123 Main Street"
                    {...register('addressLine1')}
                    aria-required="true"
                    aria-invalid={!!errors.addressLine1}
                    aria-describedby={errors.addressLine1 ? 'addressLine1-error' : undefined}
                  />
                  {renderFieldError('addressLine1')}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addressLine2">Address Line 2</Label>
                  <Input
                    id="addressLine2"
                    placeholder="Apt 4B"
                    {...register('addressLine2')}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      {...register('city')}
                      aria-required="true"
                      aria-invalid={!!errors.city}
                      aria-describedby={errors.city ? 'city-error' : undefined}
                    />
                    {renderFieldError('city')}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State *</Label>
                    <Input
                      id="state"
                      placeholder="e.g., CA"
                      maxLength={2}
                      {...register('state')}
                      aria-required="true"
                      aria-invalid={!!errors.state}
                      aria-describedby={errors.state ? 'state-error' : undefined}
                    />
                    {renderFieldError('state')}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">ZIP Code *</Label>
                    <Input
                      id="postalCode"
                      placeholder="12345"
                      {...register('postalCode')}
                      aria-required="true"
                      aria-invalid={!!errors.postalCode}
                      aria-describedby={errors.postalCode ? 'postalCode-error' : undefined}
                    />
                    {renderFieldError('postalCode')}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      {...register('phone')}
                      aria-required="true"
                      aria-invalid={!!errors.phone}
                      aria-describedby={errors.phone ? 'phone-error' : undefined}
                    />
                    {renderFieldError('phone')}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="patient@email.com"
                      {...register('email')}
                      aria-invalid={!!errors.email}
                    />
                    {renderFieldError('email')}
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 3: Emergency Contacts */}
          {currentStep === 3 && (
            <>
              <CardHeader>
                <CardTitle>Emergency Contacts</CardTitle>
                <CardDescription>
                  At least one emergency contact is required
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="mb-3 font-medium">
                    Primary Emergency Contact *
                  </h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="ec1Name">Full Name *</Label>
                      <Input
                        id="ec1Name"
                        {...register('emergencyContact1Name')}
                        aria-required="true"
                        aria-invalid={!!errors.emergencyContact1Name}
                        aria-describedby={errors.emergencyContact1Name ? 'emergencyContact1Name-error' : undefined}
                      />
                      {renderFieldError('emergencyContact1Name')}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ec1Phone">Phone *</Label>
                      <Input
                        id="ec1Phone"
                        type="tel"
                        placeholder="(555) 123-4567"
                        {...register('emergencyContact1Phone')}
                        aria-required="true"
                        aria-invalid={!!errors.emergencyContact1Phone}
                        aria-describedby={errors.emergencyContact1Phone ? 'emergencyContact1Phone-error' : undefined}
                      />
                      {renderFieldError('emergencyContact1Phone')}
                    </div>
                    <div className="space-y-2">
                      <Label id="ec1-relationship-label">Relationship *</Label>
                      <Controller
                        name="emergencyContact1Relationship"
                        control={control}
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger
                              aria-required="true"
                              aria-invalid={
                                !!errors.emergencyContact1Relationship
                              }
                              aria-labelledby="ec1-relationship-label"
                              aria-describedby={errors.emergencyContact1Relationship ? 'emergencyContact1Relationship-error' : undefined}
                            >
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="spouse">Spouse</SelectItem>
                              <SelectItem value="parent">Parent</SelectItem>
                              <SelectItem value="child">Child</SelectItem>
                              <SelectItem value="sibling">Sibling</SelectItem>
                              <SelectItem value="friend">Friend</SelectItem>
                              <SelectItem value="guardian">Guardian</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {renderFieldError('emergencyContact1Relationship')}
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="mb-3 font-medium">
                    Secondary Emergency Contact (Optional)
                  </h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="ec2Name">Full Name</Label>
                      <Input
                        id="ec2Name"
                        {...register('emergencyContact2Name')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ec2Phone">Phone</Label>
                      <Input
                        id="ec2Phone"
                        type="tel"
                        placeholder="(555) 123-4567"
                        {...register('emergencyContact2Phone')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Relationship</Label>
                      <Controller
                        name="emergencyContact2Relationship"
                        control={control}
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="spouse">Spouse</SelectItem>
                              <SelectItem value="parent">Parent</SelectItem>
                              <SelectItem value="child">Child</SelectItem>
                              <SelectItem value="sibling">Sibling</SelectItem>
                              <SelectItem value="friend">Friend</SelectItem>
                              <SelectItem value="guardian">Guardian</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 4: Insurance */}
          {currentStep === 4 && (
            <>
              <CardHeader>
                <CardTitle>Insurance Information</CardTitle>
                <CardDescription>
                  Primary insurance coverage details (optional)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="insurancePlan">Insurance Plan</Label>
                    <Input
                      id="insurancePlan"
                      placeholder="e.g., Blue Cross Blue Shield"
                      {...register('insurancePlan')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="memberId">Member ID</Label>
                    <Input
                      id="memberId"
                      placeholder="Member ID number"
                      {...register('memberId')}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="groupNumber">Group Number</Label>
                    <Input
                      id="groupNumber"
                      {...register('groupNumber')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Relationship to Subscriber</Label>
                    <Controller
                      name="subscriberRelation"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select relationship" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="self">Self</SelectItem>
                            <SelectItem value="spouse">Spouse</SelectItem>
                            <SelectItem value="child">Child</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="subscriberName">Subscriber Name</Label>
                    <Input
                      id="subscriberName"
                      placeholder="If different from patient"
                      {...register('subscriberName')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subscriberDob">Subscriber DOB</Label>
                    <Input
                      id="subscriberDob"
                      type="date"
                      {...register('subscriberDob')}
                    />
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 5: Consent & Review */}
          {currentStep === 5 && (
            <>
              <CardHeader>
                <CardTitle>Consent & Review</CardTitle>
                <CardDescription>
                  Review the information and provide consent
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Review sections */}
                <div className="space-y-4">
                  <div className="rounded-lg border p-4">
                    <h3 className="mb-2 font-semibold">Demographics</h3>
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <span className="text-muted-foreground">Name: </span>
                        {formValues.firstName} {formValues.middleName}{' '}
                        {formValues.lastName}
                      </div>
                      <div>
                        <span className="text-muted-foreground">DOB: </span>
                        {formValues.dob
                          ? new Date(formValues.dob).toLocaleDateString('en-US')
                          : 'Not set'}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Gender: </span>
                        {formValues.gender || 'Not set'}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Sex at Birth:{' '}
                        </span>
                        {formValues.sex || 'Not set'}
                      </div>
                      {formValues.race && (
                        <div>
                          <span className="text-muted-foreground">Race: </span>
                          {findCode(RACE_CODES, formValues.race)?.display || formValues.race}
                        </div>
                      )}
                      {formValues.preferredLanguage && (
                        <div>
                          <span className="text-muted-foreground">
                            Language:{' '}
                          </span>
                          {LANGUAGE_CODES.find((l) => l.code === formValues.preferredLanguage)?.display || formValues.preferredLanguage}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <h3 className="mb-2 font-semibold">Contact Information</h3>
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <span className="text-muted-foreground">
                          Address:{' '}
                        </span>
                        {formValues.addressLine1}
                        {formValues.addressLine2 &&
                          `, ${formValues.addressLine2}`}
                        , {formValues.city}, {formValues.state}{' '}
                        {formValues.postalCode}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Phone: </span>
                        {formValues.phone}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email: </span>
                        {formValues.email || 'Not provided'}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <h3 className="mb-2 font-semibold">Emergency Contacts</h3>
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <span className="text-muted-foreground">
                          Primary:{' '}
                        </span>
                        {formValues.emergencyContact1Name} (
                        {formValues.emergencyContact1Relationship}) -{' '}
                        {formValues.emergencyContact1Phone}
                      </div>
                      {formValues.emergencyContact2Name && (
                        <div className="sm:col-span-2">
                          <span className="text-muted-foreground">
                            Secondary:{' '}
                          </span>
                          {formValues.emergencyContact2Name} (
                          {formValues.emergencyContact2Relationship}) -{' '}
                          {formValues.emergencyContact2Phone}
                        </div>
                      )}
                    </div>
                  </div>

                  {formValues.insurancePlan && (
                    <div className="rounded-lg border p-4">
                      <h3 className="mb-2 font-semibold">Insurance</h3>
                      <div className="grid gap-2 text-sm sm:grid-cols-2">
                        <div>
                          <span className="text-muted-foreground">Plan: </span>
                          {formValues.insurancePlan}
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Member ID:{' '}
                          </span>
                          {formValues.memberId || 'Not provided'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Consent checkboxes */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Consent</h3>

                  <div className="flex items-start gap-3 rounded-lg border p-3">
                    <Controller
                      name="consentToTreat"
                      control={control}
                      render={({ field }) => (
                        <Checkbox
                          id="consentToTreat"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          aria-required="true"
                          aria-invalid={!!errors.consentToTreat}
                          aria-describedby={errors.consentToTreat ? 'consentToTreat-error' : undefined}
                        />
                      )}
                    />
                    <div>
                      <Label
                        htmlFor="consentToTreat"
                        className="cursor-pointer font-medium"
                      >
                        Consent to Treatment *
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        I consent to medical examination and treatment as
                        prescribed by authorized healthcare providers.
                      </p>
                      {errors.consentToTreat && (
                        <p className="mt-1 text-xs text-destructive" id="consentToTreat-error" role="alert">
                          {errors.consentToTreat.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border p-3">
                    <Controller
                      name="consentToShareInfo"
                      control={control}
                      render={({ field }) => (
                        <Checkbox
                          id="consentToShareInfo"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                    <div>
                      <Label
                        htmlFor="consentToShareInfo"
                        className="cursor-pointer font-medium"
                      >
                        Consent to Share Information
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        I authorize the sharing of my health information with
                        other healthcare providers involved in my care.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border p-3">
                    <Controller
                      name="advanceDirective"
                      control={control}
                      render={({ field }) => (
                        <Checkbox
                          id="advanceDirective"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                    <div>
                      <Label
                        htmlFor="advanceDirective"
                        className="cursor-pointer font-medium"
                      >
                        Advance Directive on File
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Patient has an advance directive or living will on file.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    {...register('notes')}
                    placeholder="Any additional notes about this patient..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between border-t p-6">
            <Button type="button" variant="outline" onClick={goToPrevStep}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              {currentStep > 1 ? 'Previous' : 'Cancel'}
            </Button>

            {currentStep < 5 ? (
              <Button type="button" onClick={goToNextStep}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
                <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                {isSubmitting ? 'Registering...' : 'Register Patient'}
              </Button>
            )}
          </div>
        </Card>
      </form>
    </div>
  );
}
