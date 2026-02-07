/**
 * HighRiskVerification — dialog requiring independent double-check verification
 * before high-risk medication administration. Implements the ISMP "Independent
 * Double Check" workflow where a second clinician must verify key medication
 * parameters before the order proceeds.
 *
 * §170.315(a)(9) Clinical Decision Support — medication safety
 */

import React, { useState, useMemo } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface HighRiskVerificationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicationName: string;
  dose: string;
  route: string;
  frequency: string;
  onVerify: (verifiedBy: string) => void;
  onCancel: () => void;
}

interface ChecklistItem {
  id: string;
  label: string;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: 'patient', label: 'Correct patient identified' },
  { id: 'medication', label: 'Correct medication verified' },
  { id: 'dose-route', label: 'Dose and route confirmed' },
  { id: 'allergies', label: 'Allergies checked' },
];

export function HighRiskVerification({
  open,
  onOpenChange,
  medicationName,
  dose,
  route,
  frequency,
  onVerify,
  onCancel,
}: HighRiskVerificationProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [verifierName, setVerifierName] = useState('');

  const allChecked = useMemo(
    () => CHECKLIST_ITEMS.every((item) => checked[item.id] === true),
    [checked],
  );
  const canVerify = allChecked && verifierName.trim().length > 0;

  const handleCheckedChange = (id: string, value: boolean) => {
    setChecked((prev) => ({ ...prev, [id]: value }));
  };

  const handleVerify = () => {
    if (!canVerify) return;
    onVerify(verifierName.trim());
    // Reset state for next use
    setChecked({});
    setVerifierName('');
  };

  const handleCancel = () => {
    setChecked({});
    setVerifierName('');
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <DialogTitle className="text-red-700 dark:text-red-400">
              High-Risk Medication Verification Required
            </DialogTitle>
          </div>
          <DialogDescription>
            An independent double-check is required before this medication can be
            administered.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Medication Details */}
          <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
            <CardContent className="grid grid-cols-2 gap-3 py-3 px-4">
              <div>
                <span className="text-xs font-medium text-muted-foreground">
                  Medication
                </span>
                <p className="text-sm font-semibold text-foreground">
                  {medicationName}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground">
                  Dose
                </span>
                <p className="text-sm font-semibold text-foreground">{dose}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground">
                  Route
                </span>
                <p className="text-sm font-semibold text-foreground">{route}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground">
                  Frequency
                </span>
                <p className="text-sm font-semibold text-foreground">
                  {frequency}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Warning Text */}
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            This medication requires independent double-check verification before
            administration.
          </p>

          <Separator />

          {/* Verification Checklist */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Verification Checklist</Label>
            {CHECKLIST_ITEMS.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <Checkbox
                  id={`verify-${item.id}`}
                  checked={checked[item.id] === true}
                  onCheckedChange={(value) =>
                    handleCheckedChange(item.id, value === true)
                  }
                />
                <Label
                  htmlFor={`verify-${item.id}`}
                  className="cursor-pointer text-sm"
                >
                  {item.label}
                </Label>
              </div>
            ))}
          </div>

          <Separator />

          {/* Verifier Identification */}
          <div className="space-y-2">
            <Label htmlFor="verifier-name" className="text-sm font-semibold">
              Verifier Name / ID
            </Label>
            <Input
              id="verifier-name"
              placeholder="Enter verifier name or employee ID"
              value={verifierName}
              onChange={(e) => setVerifierName(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel Order
          </Button>
          <Button
            onClick={handleVerify}
            disabled={!canVerify}
            className="gap-1 bg-green-700 hover:bg-green-800 text-white"
          >
            <ShieldCheck className="h-4 w-4" />
            Verify &amp; Proceed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
