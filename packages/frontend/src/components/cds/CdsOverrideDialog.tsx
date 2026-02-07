/**
 * CDS Override Dialog — captures override reason when a clinician dismisses
 * a CDS card. Required for §170.315(a)(9) and §170.315(b)(11) audit trails.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { CDSCard, OverrideReason } from '@/types/cds';
import { useCdsOverride } from '@/hooks/use-cds';

const DEFAULT_OVERRIDE_REASONS: OverrideReason[] = [
  {
    code: 'patient-decline',
    system: 'http://tribal-ehr.org/cds-override-reasons',
    display: 'Patient declined recommendation',
  },
  {
    code: 'already-addressed',
    system: 'http://tribal-ehr.org/cds-override-reasons',
    display: 'Already addressed / previously evaluated',
  },
  {
    code: 'clinical-judgment',
    system: 'http://tribal-ehr.org/cds-override-reasons',
    display: 'Clinical judgment — benefits outweigh risks',
  },
  {
    code: 'contraindication',
    system: 'http://tribal-ehr.org/cds-override-reasons',
    display: 'Alternative contraindication exists',
  },
  {
    code: 'other',
    system: 'http://tribal-ehr.org/cds-override-reasons',
    display: 'Other (specify in text)',
  },
];

interface CdsOverrideDialogProps {
  open: boolean;
  card: CDSCard | null;
  patientId: string;
  hookInstance: string;
  onClose: () => void;
  onOverridden?: () => void;
}

export function CdsOverrideDialog({
  open,
  card,
  patientId,
  hookInstance,
  onClose,
  onOverridden,
}: CdsOverrideDialogProps) {
  const [reasonCode, setReasonCode] = useState('');
  const [reasonText, setReasonText] = useState('');
  const overrideMutation = useCdsOverride();

  const reasons = card?.overrideReasons?.length
    ? card.overrideReasons
    : DEFAULT_OVERRIDE_REASONS;

  const handleSubmit = async () => {
    if (!card || !reasonCode) return;

    await overrideMutation.mutateAsync({
      cardId: card.uuid || card.summary,
      patientId,
      hookInstance,
      reasonCode,
      reasonText: reasonText || undefined,
      cardSummary: card.summary,
    });

    setReasonCode('');
    setReasonText('');
    onOverridden?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Override Clinical Decision Support</DialogTitle>
          <DialogDescription>
            {card
              ? `You are overriding: "${card.summary}". Please provide a reason.`
              : 'Provide a reason for overriding this alert.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Override Reason</Label>
            <Select value={reasonCode} onValueChange={setReasonCode}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((reason) => (
                  <SelectItem key={reason.code} value={reason.code}>
                    {reason.display}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Additional Justification (optional)</Label>
            <Textarea
              placeholder="Enter additional details..."
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reasonCode || overrideMutation.isPending}
            variant="destructive"
          >
            {overrideMutation.isPending ? 'Recording...' : 'Confirm Override'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
