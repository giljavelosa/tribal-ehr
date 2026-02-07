import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  FileText,
  ClipboardList,
  MessageSquare,
  ShieldAlert,
  X,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Patient, AllergyIntolerance } from '@/hooks/use-api';

/**
 * PatientBanner - ONC §170.315(a)(5) Compliant Patient Identification Header
 * 
 * Per ONC Health IT Certification and Joint Commission NPSG.01.01.01:
 * - MUST display at least 2 patient identifiers at ALL times
 * - Patient name + DOB/MRN must be visible across all chart views
 * - Allergies must be prominently displayed
 * - Banner remains sticky/fixed when navigating within patient chart
 */
interface PatientBannerProps {
  patient: Patient;
  allergies?: AllergyIntolerance[];
  alerts?: {
    fallRisk?: boolean;
    isolationPrecautions?: boolean;
  };
  onNewNote?: () => void;
  onNewOrder?: () => void;
  onMessage?: () => void;
  onClose?: () => void;
}

function calculateAge(dob: string): number {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
}

export const PatientBanner = React.memo(function PatientBanner({
  patient,
  allergies = [],
  alerts = {},
  onNewNote,
  onNewOrder,
  onMessage,
  onClose,
}: PatientBannerProps) {
  const navigate = useNavigate();
  const initials = `${patient.firstName?.[0] || ''}${patient.lastName?.[0] || ''}`.toUpperCase();
  const age = calculateAge(patient.dob);

  // ONC §170.315(a)(5) demographics display helpers
  // Handle both object format (FHIR CodeableConcept) and plain strings
  const raceDisplay = patient.race?.map((r: string | { display?: string }) => 
    typeof r === 'string' ? r : r.display
  ).filter(Boolean).join(', ');
  const ethnicityDisplay =
    typeof patient.ethnicity === 'string' 
      ? patient.ethnicity 
      : (patient.ethnicity?.text || patient.ethnicity?.coding?.[0]?.display);
  const genderIdentityDisplay =
    typeof patient.genderIdentity === 'string'
      ? patient.genderIdentity
      : (patient.genderIdentity?.text || patient.genderIdentity?.coding?.[0]?.display);
  const sexualOrientationDisplay =
    typeof patient.sexualOrientation === 'string'
      ? patient.sexualOrientation
      : (patient.sexualOrientation?.text || patient.sexualOrientation?.coding?.[0]?.display);

  const activeAllergies = allergies.filter(
    (a) => a.clinicalStatus === 'active',
  );
  const criticalAllergies = activeAllergies.filter(
    (a) => a.criticality === 'high',
  );
  const hasAllergies = activeAllergies.length > 0;
  const nkda =
    activeAllergies.length === 0 && allergies.length >= 0;

  return (
    <div className="patient-banner sticky top-0 z-40 border-b border-border/60 bg-card/98 backdrop-blur-sm shadow-clinical">
      {/* Primary Identification Bar - ONC/Joint Commission Required */}
      <div className="flex flex-wrap items-center gap-5 p-5">
        {/* Avatar with Photo ID verification */}
        <Avatar className="h-16 w-16 ring-2 ring-primary/20 flex-shrink-0">
          {patient.photo && <AvatarImage src={patient.photo} alt={patient.firstName} />}
          <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          {/* REQUIRED: Patient Name - Primary Identifier */}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {patient.lastName}, {patient.firstName}
              {patient.middleName ? ` ${patient.middleName[0]}.` : ''}
            </h1>
            {/* REQUIRED: MRN - Secondary Identifier */}
            <Badge 
              variant="default" 
              className="font-mono text-sm px-3 py-1.5 whitespace-nowrap flex-shrink-0 overflow-visible"
            >
              MRN: {patient.mrn}
            </Badge>
            {patient.status === 'inactive' && (
              <Badge variant="secondary">Inactive</Badge>
            )}
            {patient.status === 'deceased' && (
              <Badge variant="destructive">Deceased</Badge>
            )}
          </div>
          {/* REQUIRED: DOB - Additional Identifier per Joint Commission */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold text-foreground">
              DOB: {new Date(patient.dob).toLocaleDateString('en-US')} 
              <span className="ml-1 text-muted-foreground">(Age {age})</span>
            </span>
            <Separator orientation="vertical" className="h-4" />
            <span className="font-medium">{patient.sex || patient.gender}</span>
            {patient.preferredLanguage && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <span>Language: {patient.preferredLanguage}</span>
              </>
            )}
            {patient.insurance?.plan && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <span className="text-muted-foreground">{patient.insurance.plan}</span>
              </>
            )}
            {patient.pcp && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <span className="text-muted-foreground">PCP: {patient.pcp}</span>
              </>
            )}
          </div>
          {/* ONC §170.315(a)(5) Required Demographics */}
          {(raceDisplay || ethnicityDisplay || genderIdentityDisplay || sexualOrientationDisplay) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {raceDisplay && (
                <span>Race: {raceDisplay}</span>
              )}
              {ethnicityDisplay && (
                <>
                  {raceDisplay && <Separator orientation="vertical" className="h-4" />}
                  <span>Ethnicity: {ethnicityDisplay}</span>
                </>
              )}
              {genderIdentityDisplay && (
                <>
                  {(raceDisplay || ethnicityDisplay) && <Separator orientation="vertical" className="h-4" />}
                  <span>Gender Identity: {genderIdentityDisplay}</span>
                </>
              )}
              {sexualOrientationDisplay && (
                <>
                  {(raceDisplay || ethnicityDisplay || genderIdentityDisplay) && <Separator orientation="vertical" className="h-4" />}
                  <span>Sexual Orientation: {sexualOrientationDisplay}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Alert Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {alerts.fallRisk && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="destructive"
                    className="gap-1 bg-amber-600 hover:bg-amber-700"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    Fall Risk
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  Patient is identified as a fall risk
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {alerts.isolationPrecautions && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="destructive"
                    className="gap-1 bg-purple-600 hover:bg-purple-700"
                  >
                    <ShieldAlert className="h-3 w-3" />
                    Isolation
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  Isolation precautions are in effect
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onNewNote}
                  className="gap-1"
                >
                  <FileText className="h-4 w-4" />
                  <span className="hidden md:inline">New Note</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Create a new clinical note</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onNewOrder}
                  className="gap-1"
                >
                  <ClipboardList className="h-4 w-4" />
                  <span className="hidden md:inline">New Order</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Place a new order</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onMessage}
                  className="gap-1"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden md:inline">Message</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Send a message about this patient</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {onClose && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="ml-1 text-muted-foreground hover:text-destructive"
                    aria-label="Close patient chart"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Close patient chart</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Allergies Banner */}
      {hasAllergies ? (
        <div
          className={`flex items-center gap-2 px-4 py-2 text-sm ${
            criticalAllergies.length > 0
              ? 'border-t border-destructive/30 bg-destructive/10 text-destructive'
              : 'border-t border-amber-500/30 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
          }`}
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="font-medium">Allergies:</span>
          <span>
            {activeAllergies
              .map(
                (a) =>
                  `${a.allergen}${a.criticality === 'high' ? ' (HIGH)' : ''}`,
              )
              .join(', ')}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 border-t px-4 py-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="font-medium">NKDA</span>
          <span>(No Known Drug Allergies)</span>
        </div>
      )}
    </div>
  );
});
