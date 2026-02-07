/**
 * SimilarPatientsAlert — displays potential duplicate patient matches during
 * registration or search. Helps prevent duplicate records per ONC data integrity
 * requirements and supports Master Patient Index (MPI) workflows.
 */

import React from 'react';
import { AlertTriangle, UserCheck, UserPlus } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface SimilarPatient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  confidence: number;
  matchReasons: string[];
}

interface SimilarPatientsAlertProps {
  patients: SimilarPatient[];
  onSelect?: (patientId: string) => void;
  onDismiss?: () => void;
}

function getConfidenceColor(confidence: number): {
  badge: string;
  indicator: string;
} {
  if (confidence > 80) {
    return {
      badge: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700',
      indicator: 'bg-green-500',
    };
  }
  if (confidence >= 50) {
    return {
      badge: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700',
      indicator: 'bg-amber-500',
    };
  }
  return {
    badge: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
    indicator: 'bg-red-500',
  };
}

export function SimilarPatientsAlert({
  patients,
  onSelect,
  onDismiss,
}: SimilarPatientsAlertProps) {
  if (!patients || patients.length === 0) return null;

  return (
    <Card className="border-amber-400 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-600">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <CardTitle className="text-lg text-amber-900 dark:text-amber-200">
            Potential Duplicate Patients Found
          </CardTitle>
        </div>
        <CardDescription className="text-amber-800 dark:text-amber-300">
          The following existing patients have similar information. Please review
          before creating a new record.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {patients.map((patient, idx) => {
          const colors = getConfidenceColor(patient.confidence);

          return (
            <React.Fragment key={patient.id}>
              {idx > 0 && <Separator className="bg-amber-200 dark:bg-amber-700" />}
              <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-white p-4 dark:border-amber-700 dark:bg-card">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-foreground">
                      {patient.lastName}, {patient.firstName}
                    </span>
                    <Badge variant="outline" className="font-mono text-xs">
                      MRN: {patient.mrn}
                    </Badge>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${colors.indicator}`}
                      />
                      <Badge variant="outline" className={colors.badge}>
                        {patient.confidence}% match
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>
                      DOB:{' '}
                      {new Date(patient.dateOfBirth).toLocaleDateString('en-US')}
                    </span>
                    <span>Sex: {patient.sex}</span>
                  </div>
                  {patient.matchReasons.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Match reasons: {patient.matchReasons.join(', ')}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1"
                  onClick={() => onSelect?.(patient.id)}
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Select Patient
                </Button>
              </div>
            </React.Fragment>
          );
        })}

        <div className="pt-2">
          <Button
            variant="outline"
            className="gap-1 border-amber-400 text-amber-800 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-900/40"
            onClick={() => onDismiss?.()}
          >
            <UserPlus className="h-4 w-4" />
            Create New Patient Anyway
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
