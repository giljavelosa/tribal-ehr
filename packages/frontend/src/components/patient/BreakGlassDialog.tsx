import React, { useState, useCallback } from 'react';
import { ShieldAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';

const REASON_CATEGORIES = [
  { value: 'emergency-treatment', label: 'Emergency Treatment' },
  { value: 'danger-to-self-others', label: 'Danger to Self or Others' },
  { value: 'public-health-emergency', label: 'Public Health Emergency' },
] as const;

interface BreakGlassDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the dialog is dismissed without completing break-glass */
  onClose: () => void;
  /** The patient ID for which break-glass access is requested */
  patientId: string;
  /** Called after a successful break-glass request so the caller can retry the data fetch */
  onBreakGlassGranted: () => void;
}

/**
 * BreakGlassDialog -- Emergency Access Override
 *
 * Shown when a 403 response with requiresBreakGlass is received.
 * The clinician must provide a reason and category before emergency
 * access is granted per HIPAA §164.308(a)(4) break-glass policy.
 */
export function BreakGlassDialog({
  open,
  onClose,
  patientId,
  onBreakGlassGranted,
}: BreakGlassDialogProps) {
  const [reason, setReason] = useState('');
  const [reasonCategory, setReasonCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (reason.trim().length < 10) {
      setError('Reason must be at least 10 characters.');
      return;
    }

    if (!reasonCategory) {
      setError('Please select a reason category.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await api.post('/consents/break-glass', {
        patientId,
        reason: reason.trim(),
        reasonCategory,
      });

      // Reset form state
      setReason('');
      setReasonCategory('');
      onBreakGlassGranted();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to request break-glass access';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [reason, reasonCategory, patientId, onBreakGlassGranted]);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            <DialogTitle>Emergency Access Override</DialogTitle>
          </div>
          <DialogDescription>
            This patient has restricted data protected by consent directives.
            Break-glass access requires documentation and will be audited.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="break-glass-category">Reason Category</Label>
            <Select value={reasonCategory} onValueChange={setReasonCategory}>
              <SelectTrigger id="break-glass-category">
                <SelectValue placeholder="Select a category..." />
              </SelectTrigger>
              <SelectContent>
                {REASON_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="break-glass-reason">
              Reason for Emergency Access
            </Label>
            <Textarea
              id="break-glass-reason"
              placeholder="Describe the clinical situation requiring emergency access (min 10 characters)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <p className="text-xs text-muted-foreground">
            Break-glass access is time-limited (4 hours) and will be logged
            for compliance review. All accessed resources will be recorded.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting || reason.trim().length < 10 || !reasonCategory}
          >
            {isSubmitting ? 'Requesting...' : 'Request Emergency Access'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
