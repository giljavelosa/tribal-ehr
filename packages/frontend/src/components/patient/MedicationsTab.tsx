import React, { useState, useMemo, useCallback } from 'react';
import { Plus, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  useMedications,
  useCreateMedication,
  type MedicationRequest,
} from '@/hooks/use-api';
import { useCdsInvoke, useCdsFeedback } from '@/hooks/use-cds';
import { CdsCardList } from '@/components/cds/CdsCardList';
import { CdsOverrideDialog } from '@/components/cds/CdsOverrideDialog';
import type { CDSCard } from '@/types/cds';

interface MedicationsTabProps {
  patientId: string;
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  stopped: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  'on-hold': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

export function MedicationsTab({ patientId }: MedicationsTabProps) {
  const { data: medications, isLoading, error } = useMedications(patientId);
  const createMedication = useCreateMedication();

  const cdsInvoke = useCdsInvoke();
  const cdsFeedback = useCdsFeedback();

  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reconDialogOpen, setReconDialogOpen] = useState(false);
  const [cdsCards, setCdsCards] = useState<CDSCard[]>([]);
  const [cdsHookInstance, setCdsHookInstance] = useState('');
  const [overrideCard, setOverrideCard] = useState<CDSCard | null>(null);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    medication: '',
    dose: '',
    route: 'oral',
    frequency: '',
    note: '',
  });

  const filteredMeds = useMemo(() => {
    if (!medications) return [];
    if (filterStatus === 'all') return medications;
    return medications.filter((m) => m.status === filterStatus);
  }, [medications, filterStatus]);

  const handleCheckCds = useCallback(async () => {
    if (!formData.medication) return;

    try {
      const result = await cdsInvoke.mutateAsync({
        hook: 'order-select',
        context: {
          userId: 'current-user',
          patientId,
          selections: [formData.medication],
          draftOrders: {
            resourceType: 'Bundle',
            entry: [
              {
                resource: {
                  resourceType: 'MedicationRequest',
                  medicationCodeableConcept: {
                    text: formData.medication,
                  },
                  subject: { reference: `Patient/${patientId}` },
                },
              },
            ],
          },
        },
      });

      if (result.cards && result.cards.length > 0) {
        setCdsCards(result.cards);
        setCdsHookInstance(result.hookInstance);
      } else {
        setCdsCards([]);
      }
    } catch {
      // CDS failure should not block prescribing
      setCdsCards([]);
    }
  }, [formData.medication, patientId, cdsInvoke]);

  const handleSubmit = async () => {
    // Check for unresolved critical CDS cards
    const hasCritical = cdsCards.some((c) => c.indicator === 'critical');
    if (hasCritical) return; // Must override or accept critical cards first

    await createMedication.mutateAsync({
      patientId,
      data: {
        medication: formData.medication,
        dose: formData.dose,
        route: formData.route,
        frequency: formData.frequency,
        status: 'active',
        intent: 'order',
        note: formData.note || undefined,
      },
    });
    setDialogOpen(false);
    setCdsCards([]);
    setFormData({ medication: '', dose: '', route: 'oral', frequency: '', note: '' });
  };

  const handleCdsAccept = useCallback((card: CDSCard) => {
    setCdsCards((prev) => prev.filter((c) => c !== card));
  }, []);

  const handleCdsOverride = useCallback((card: CDSCard) => {
    setOverrideCard(card);
    setOverrideDialogOpen(true);
  }, []);

  const handleOverrideComplete = useCallback(() => {
    if (overrideCard) {
      setCdsCards((prev) => prev.filter((c) => c !== overrideCard));
    }
    setOverrideCard(null);
  }, [overrideCard]);

  const handleCdsFeedback = useCallback(
    (cardId: string, outcome: string) => {
      cdsFeedback.mutate({ cardId, outcome });
    },
    [cdsFeedback],
  );

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive">
            Failed to load medications. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Medications</CardTitle>
              <CardDescription>
                Current and historical medication orders
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="gap-1"
                onClick={() => setReconDialogOpen(true)}
              >
                <RefreshCw className="h-4 w-4" />
                Reconciliation
              </Button>
              <Button className="gap-1" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Prescribe
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filter */}
          <div className="mb-4">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="stopped">Stopped</SelectItem>
                <SelectItem value="on-hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medication</TableHead>
                  <TableHead>Dose</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Prescriber</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMeds.map((med) => (
                  <TableRow key={med.id}>
                    <TableCell>
                      <button
                        className="text-left font-medium text-primary hover:underline"
                        onClick={() => {
                          /* Open medication detail */
                        }}
                      >
                        {med.medication}
                      </button>
                    </TableCell>
                    <TableCell>{med.dose}</TableCell>
                    <TableCell className="capitalize">{med.route}</TableCell>
                    <TableCell>{med.frequency}</TableCell>
                    <TableCell>{med.prescriber || '--'}</TableCell>
                    <TableCell>
                      {med.startDate
                        ? new Date(med.startDate).toLocaleDateString('en-US')
                        : '--'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusColors[med.status] || ''}
                      >
                        {med.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredMeds.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      No medications found for the selected filter.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Prescribe Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Prescribe Medication</DialogTitle>
            <DialogDescription>
              Enter the medication order details. This order will be sent for
              pharmacy review.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="medName">Medication Name</Label>
              <Input
                id="medName"
                placeholder="Search medication..."
                value={formData.medication}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    medication: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dose">Dose</Label>
                <Input
                  id="dose"
                  placeholder="e.g., 500mg"
                  value={formData.dose}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, dose: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Route</Label>
                <Select
                  value={formData.route}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, route: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oral">Oral</SelectItem>
                    <SelectItem value="sublingual">Sublingual</SelectItem>
                    <SelectItem value="topical">Topical</SelectItem>
                    <SelectItem value="intravenous">Intravenous</SelectItem>
                    <SelectItem value="intramuscular">Intramuscular</SelectItem>
                    <SelectItem value="subcutaneous">Subcutaneous</SelectItem>
                    <SelectItem value="inhalation">Inhalation</SelectItem>
                    <SelectItem value="rectal">Rectal</SelectItem>
                    <SelectItem value="ophthalmic">Ophthalmic</SelectItem>
                    <SelectItem value="otic">Otic</SelectItem>
                    <SelectItem value="nasal">Nasal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency / SIG</Label>
              <Input
                id="frequency"
                placeholder="e.g., Take 1 tablet twice daily with meals"
                value={formData.frequency}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    frequency: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="medNote">Notes</Label>
              <Textarea
                id="medNote"
                placeholder="Additional prescribing notes..."
                value={formData.note}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, note: e.target.value }))
                }
              />
            </div>
          </div>
          {/* CDS Cards */}
          {cdsCards.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Clinical Decision Support Alerts
              </p>
              <CdsCardList
                cards={cdsCards}
                hookInstance={cdsHookInstance}
                patientId={patientId}
                onAccept={handleCdsAccept}
                onOverride={handleCdsOverride}
                onFeedback={handleCdsFeedback}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            {formData.medication && cdsCards.length === 0 && (
              <Button
                variant="secondary"
                onClick={handleCheckCds}
                disabled={cdsInvoke.isPending}
              >
                {cdsInvoke.isPending ? 'Checking...' : 'Check Interactions'}
              </Button>
            )}
            <Button
              onClick={handleSubmit}
              disabled={
                !formData.medication ||
                !formData.dose ||
                !formData.frequency ||
                createMedication.isPending ||
                cdsCards.some((c) => c.indicator === 'critical')
              }
            >
              {createMedication.isPending ? 'Submitting...' : 'Submit Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CDS Override Dialog */}
      <CdsOverrideDialog
        open={overrideDialogOpen}
        card={overrideCard}
        patientId={patientId}
        hookInstance={cdsHookInstance}
        onClose={() => setOverrideDialogOpen(false)}
        onOverridden={handleOverrideComplete}
      />

      {/* Reconciliation Dialog */}
      <Dialog open={reconDialogOpen} onOpenChange={setReconDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Medication Reconciliation</DialogTitle>
            <DialogDescription>
              Review and verify the patient's current medication list. Confirm
              each medication is accurate with the patient or caregiver.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {(medications || [])
              .filter((m) => m.status === 'active')
              .map((med) => (
                <div
                  key={med.id}
                  className="flex items-center justify-between border-b p-3 last:border-0"
                >
                  <div>
                    <p className="font-medium">{med.medication}</p>
                    <p className="text-sm text-muted-foreground">
                      {med.dose} {med.route} - {med.frequency}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      Continue
                    </Button>
                    <Button variant="outline" size="sm">
                      Modify
                    </Button>
                    <Button variant="destructive" size="sm">
                      Discontinue
                    </Button>
                  </div>
                </div>
              ))}
            {(medications || []).filter((m) => m.status === 'active').length ===
              0 && (
              <p className="py-8 text-center text-muted-foreground">
                No active medications to reconcile.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReconDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setReconDialogOpen(false)}>
              Complete Reconciliation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
