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

// ---- OMB Race/Ethnicity Mappings (CDC Race & Ethnicity Code Set) ----

const RACE_CODE_MAP: Record<string, { code: string; display: string; system: string }> = {
  'american-indian': { code: '1002-5', display: 'American Indian or Alaska Native', system: 'urn:oid:2.16.840.1.113883.6.238' },
  'asian': { code: '2028-9', display: 'Asian', system: 'urn:oid:2.16.840.1.113883.6.238' },
  'black': { code: '2054-5', display: 'Black or African American', system: 'urn:oid:2.16.840.1.113883.6.238' },
  'pacific-islander': { code: '2076-8', display: 'Native Hawaiian or Other Pacific Islander', system: 'urn:oid:2.16.840.1.113883.6.238' },
  'white': { code: '2106-3', display: 'White', system: 'urn:oid:2.16.840.1.113883.6.238' },
  'two-or-more': { code: '2131-1', display: 'Other Race', system: 'urn:oid:2.16.840.1.113883.6.238' },
  'other': { code: '2131-1', display: 'Other Race', system: 'urn:oid:2.16.840.1.113883.6.238' },
  'declined': { code: 'ASKU', display: 'Asked but no answer', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor' },
};

// USCDI v3 Gender Identity (SNOMED CT)
const GENDER_IDENTITY_MAP: Record<string, { code: string; display: string; system: string }> = {
  'male': { code: '446151000124109', display: 'Identifies as male gender', system: 'http://snomed.info/sct' },
  'female': { code: '446141000124107', display: 'Identifies as female gender', system: 'http://snomed.info/sct' },
  'non-binary': { code: '33791000087105', display: 'Identifies as nonbinary gender', system: 'http://snomed.info/sct' },
  'transgender-male': { code: '407377005', display: 'Female-to-male transsexual', system: 'http://snomed.info/sct' },
  'transgender-female': { code: '407376001', display: 'Male-to-female transsexual', system: 'http://snomed.info/sct' },
  'other': { code: 'OTH', display: 'Other', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor' },
  'declined': { code: 'ASKU', display: 'Asked but no answer', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor' },
};

// USCDI v3 Sexual Orientation (SNOMED CT)
const SEXUAL_ORIENTATION_MAP: Record<string, { code: string; display: string; system: string }> = {
  'straight': { code: '20430005', display: 'Heterosexual', system: 'http://snomed.info/sct' },
  'gay-lesbian': { code: '38628009', display: 'Homosexual', system: 'http://snomed.info/sct' },
  'bisexual': { code: '42035005', display: 'Bisexual', system: 'http://snomed.info/sct' },
  'other': { code: 'OTH', display: 'Other', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor' },
  'declined': { code: 'ASKU', display: 'Asked but no answer', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor' },
  'unknown': { code: 'UNK', display: 'Unknown', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor' },
};

const ETHNICITY_CODE_MAP: Record<string, { code: string; display: string; system: string }> = {
  'hispanic': { code: '2135-2', display: 'Hispanic or Latino', system: 'urn:oid:2.16.840.1.113883.6.238' },
  'not-hispanic': { code: '2186-5', display: 'Not Hispanic or Latino', system: 'urn:oid:2.16.840.1.113883.6.238' },
};

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
          genderIdentity: data.genderIdentity && GENDER_IDENTITY_MAP[data.genderIdentity]
            ? { coding: [GENDER_IDENTITY_MAP[data.genderIdentity]], text: GENDER_IDENTITY_MAP[data.genderIdentity].display }
            : undefined,
          sexualOrientation: data.sexualOrientation && SEXUAL_ORIENTATION_MAP[data.sexualOrientation]
            ? { coding: [SEXUAL_ORIENTATION_MAP[data.sexualOrientation]], text: SEXUAL_ORIENTATION_MAP[data.sexualOrientation].display }
            : undefined,
          race: data.race && RACE_CODE_MAP[data.race]
            ? [RACE_CODE_MAP[data.race]]
            : undefined,
          ethnicity: data.ethnicity && ETHNICITY_CODE_MAP[data.ethnicity]
            ? { coding: [ETHNICITY_CODE_MAP[data.ethnicity]], text: ETHNICITY_CODE_MAP[data.ethnicity].display }
            : undefined,
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
          genderIdentity: data.genderIdentity && GENDER_IDENTITY_MAP[data.genderIdentity]
            ? { coding: [GENDER_IDENTITY_MAP[data.genderIdentity]], text: GENDER_IDENTITY_MAP[data.genderIdentity].display }
            : undefined,
          sexualOrientation: data.sexualOrientation && SEXUAL_ORIENTATION_MAP[data.sexualOrientation]
            ? { coding: [SEXUAL_ORIENTATION_MAP[data.sexualOrientation]], text: SEXUAL_ORIENTATION_MAP[data.sexualOrientation].display }
            : undefined,
          race: data.race && RACE_CODE_MAP[data.race]
            ? [RACE_CODE_MAP[data.race]]
            : undefined,
          ethnicity: data.ethnicity && ETHNICITY_CODE_MAP[data.ethnicity]
            ? { coding: [ETHNICITY_CODE_MAP[data.ethnicity]], text: ETHNICITY_CODE_MAP[data.ethnicity].display }
            : undefined,
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
      <p className="text-xs text-destructive">{fieldError.message as string}</p>
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
        >
          <ArrowLeft className="h-5 w-5" />
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
      <div className="flex items-center justify-center gap-1 sm:gap-2">
        {steps.map((step, i) => {
          const StepIcon = step.icon;
          return (
            <React.Fragment key={step.id}>
              <div className="flex items-center gap-1 sm:gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    currentStep > step.id
                      ? 'bg-primary text-primary-foreground'
                      : currentStep === step.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                  }`}
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
      </div>

      {submitError && (
        <Alert variant="destructive">
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
                      aria-invalid={!!errors.firstName}
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
                      aria-invalid={!!errors.lastName}
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
                      aria-invalid={!!errors.dob}
                    />
                    {renderFieldError('dob')}
                  </div>
                  <div className="space-y-2">
                    <Label>Gender *</Label>
                    <Controller
                      name="gender"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger aria-invalid={!!errors.gender}>
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
                    <Label>Sex at Birth *</Label>
                    <Controller
                      name="sex"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger aria-invalid={!!errors.sex}>
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
                            <SelectItem value="male">Identifies as Male</SelectItem>
                            <SelectItem value="female">Identifies as Female</SelectItem>
                            <SelectItem value="non-binary">Non-binary</SelectItem>
                            <SelectItem value="transgender-male">Transgender Male (FTM)</SelectItem>
                            <SelectItem value="transgender-female">Transgender Female (MTF)</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                            <SelectItem value="declined">Declined to specify</SelectItem>
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
                            <SelectItem value="straight">Straight (Heterosexual)</SelectItem>
                            <SelectItem value="gay-lesbian">Gay or Lesbian (Homosexual)</SelectItem>
                            <SelectItem value="bisexual">Bisexual</SelectItem>
                            <SelectItem value="other">Something else</SelectItem>
                            <SelectItem value="declined">Declined to specify</SelectItem>
                            <SelectItem value="unknown">Don't know</SelectItem>
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
                            <SelectItem value="american-indian">
                              American Indian or Alaska Native
                            </SelectItem>
                            <SelectItem value="asian">Asian</SelectItem>
                            <SelectItem value="black">
                              Black or African American
                            </SelectItem>
                            <SelectItem value="pacific-islander">
                              Native Hawaiian or Pacific Islander
                            </SelectItem>
                            <SelectItem value="white">White</SelectItem>
                            <SelectItem value="two-or-more">
                              Two or More Races
                            </SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                            <SelectItem value="declined">
                              Declined to specify
                            </SelectItem>
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
                            <SelectItem value="hispanic">
                              Hispanic or Latino
                            </SelectItem>
                            <SelectItem value="not-hispanic">
                              Not Hispanic or Latino
                            </SelectItem>
                            <SelectItem value="declined">
                              Declined to specify
                            </SelectItem>
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
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="es">Spanish</SelectItem>
                            <SelectItem value="zh">Chinese</SelectItem>
                            <SelectItem value="tl">Tagalog</SelectItem>
                            <SelectItem value="vi">Vietnamese</SelectItem>
                            <SelectItem value="ar">Arabic</SelectItem>
                            <SelectItem value="fr">French</SelectItem>
                            <SelectItem value="ko">Korean</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
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
                    aria-invalid={!!errors.addressLine1}
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
                      aria-invalid={!!errors.city}
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
                      aria-invalid={!!errors.state}
                    />
                    {renderFieldError('state')}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">ZIP Code *</Label>
                    <Input
                      id="postalCode"
                      placeholder="12345"
                      {...register('postalCode')}
                      aria-invalid={!!errors.postalCode}
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
                      aria-invalid={!!errors.phone}
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
                        aria-invalid={!!errors.emergencyContact1Name}
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
                        aria-invalid={!!errors.emergencyContact1Phone}
                      />
                      {renderFieldError('emergencyContact1Phone')}
                    </div>
                    <div className="space-y-2">
                      <Label>Relationship *</Label>
                      <Controller
                        name="emergencyContact1Relationship"
                        control={control}
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger
                              aria-invalid={
                                !!errors.emergencyContact1Relationship
                              }
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
                          {formValues.race}
                        </div>
                      )}
                      {formValues.preferredLanguage && (
                        <div>
                          <span className="text-muted-foreground">
                            Language:{' '}
                          </span>
                          {formValues.preferredLanguage}
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
                          aria-invalid={!!errors.consentToTreat}
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
                        <p className="mt-1 text-xs text-destructive">
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
              <ArrowLeft className="mr-2 h-4 w-4" />
              {currentStep > 1 ? 'Previous' : 'Cancel'}
            </Button>

            {currentStep < 5 ? (
              <Button type="button" onClick={goToNextStep}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting}>
                <Check className="mr-2 h-4 w-4" />
                {isSubmitting ? 'Registering...' : 'Register Patient'}
              </Button>
            )}
          </div>
        </Card>
      </form>
    </div>
  );
}
