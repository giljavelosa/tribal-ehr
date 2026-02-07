import React, { useState, useMemo, useCallback } from 'react';
import { Plus, RefreshCw, Check, X, PenLine } from 'lucide-react';
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
  useUpdateMedication,
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
  const updateMedication = useUpdateMedication();

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

  // Reconciliation state
  const [reconStatuses, setReconStatuses] = useState<Record<string, 'continued' | 'discontinued' | 'modified' | null>>({});
  const [modifyDialogOpen, setModifyDialogOpen] = useState(false);
  const [modifyingMed, setModifyingMed] = useState<MedicationRequest | null>(null);
  const [modifyFormData, setModifyFormData] = useState({
    dose: '',
    frequency: '',
    route: '',
  });
  const [discontinueDialogOpen, setDiscontinueDialogOpen] = useState(false);
  const [discontinuingMed, setDiscontinuingMed] = useState<MedicationRequest | null>(null);
  const [stopReason, setStopReason] = useState('');

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

  // Reconciliation handlers
  const handleContinue = useCallback(
    async (med: MedicationRequest) => {
      await updateMedication.mutateAsync({
        patientId,
        medicationId: med.id,
        data: { status: 'active' },
      });
      setReconStatuses((prev) => ({ ...prev, [med.id]: 'continued' }));
    },
    [patientId, updateMedication],
  );

  const handleOpenModify = useCallback(
    (med: MedicationRequest) => {
      setModifyingMed(med);
      setModifyFormData({
        dose: med.dose,
        frequency: med.frequency,
        route: med.route,
      });
      setModifyDialogOpen(true);
    },
    [],
  );

  const handleSubmitModify = useCallback(
    async () => {
      if (!modifyingMed) return;
      await updateMedication.mutateAsync({
        patientId,
        medicationId: modifyingMed.id,
        data: {
          dose: modifyFormData.dose,
          frequency: modifyFormData.frequency,
          route: modifyFormData.route,
          status: 'active',
        },
      });
      setReconStatuses((prev) => ({ ...prev, [modifyingMed.id]: 'modified' }));
      setModifyDialogOpen(false);
      setModifyingMed(null);
    },
    [modifyingMed, modifyFormData, patientId, updateMedication],
  );

  const handleOpenDiscontinue = useCallback(
    (med: MedicationRequest) => {
      setDiscontinuingMed(med);
      setStopReason('');
      setDiscontinueDialogOpen(true);
    },
    [],
  );

  const handleSubmitDiscontinue = useCallback(
    async () => {
      if (!discontinuingMed) return;
      await updateMedication.mutateAsync({
        patientId,
        medicationId: discontinuingMed.id,
        data: {
          status: 'stopped',
          note: stopReason || 'Discontinued during medication reconciliation',
        },
      });
      setReconStatuses((prev) => ({ ...prev, [discontinuingMed.id]: 'discontinued' }));
      setDiscontinueDialogOpen(false);
      setDiscontinuingMed(null);
    },
    [discontinuingMed, stopReason, patientId, updateMedication],
  );

  const handleCloseRecon = useCallback(() => {
    setReconDialogOpen(false);
    setReconStatuses({});
  }, []);

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
      <Dialog open={reconDialogOpen} onOpenChange={handleCloseRecon}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Medication Reconciliation</DialogTitle>
            <DialogDescription>
              Review and verify the patient&apos;s current medication list. Confirm
              each medication is accurate with the patient or caregiver.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {(medications || [])
              .filter((m) => m.status === 'active')
              .map((med) => {
                const reconStatus = reconStatuses[med.id];
                return (
                  <div
                    key={med.id}
                    className={`flex items-center justify-between border-b p-3 last:border-0 ${
                      reconStatus ? 'opacity-60' : ''
                    }`}
                  >
                    <div>
                      <p className="font-medium">{med.medication}</p>
                      <p className="text-sm text-muted-foreground">
                        {med.dose} {med.route} - {med.frequency}
                      </p>
                      {reconStatus && (
                        <Badge
                          variant="outline"
                          className={
                            reconStatus === 'continued'
                              ? 'mt-1 bg-green-100 text-green-800'
                              : reconStatus === 'modified'
                                ? 'mt-1 bg-blue-100 text-blue-800'
                                : 'mt-1 bg-red-100 text-red-800'
                          }
                        >
                          {reconStatus === 'continued' && 'Continued'}
                          {reconStatus === 'modified' && 'Modified'}
                          {reconStatus === 'discontinued' && 'Discontinued'}
                        </Badge>
                      )}
                    </div>
                    {!reconStatus && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => handleContinue(med)}
                          disabled={updateMedication.isPending}
                        >
                          <Check className="h-3 w-3" />
                          Continue
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => handleOpenModify(med)}
                        >
                          <PenLine className="h-3 w-3" />
                          Modify
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="gap-1"
                          onClick={() => handleOpenDiscontinue(med)}
                        >
                          <X className="h-3 w-3" />
                          Discontinue
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            {(medications || []).filter((m) => m.status === 'active').length ===
              0 && (
              <p className="py-8 text-center text-muted-foreground">
                No active medications to reconcile.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseRecon}>
              Cancel
            </Button>
            <Button onClick={handleCloseRecon}>
              Complete Reconciliation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modify Medication Dialog */}
      <Dialog open={modifyDialogOpen} onOpenChange={setModifyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modify Medication</DialogTitle>
            <DialogDescription>
              Update the dose, frequency, or route for{' '}
              {modifyingMed?.medication}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="modifyDose">Dose</Label>
              <Input
                id="modifyDose"
                value={modifyFormData.dose}
                onChange={(e) =>
                  setModifyFormData((prev) => ({ ...prev, dose: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modifyFrequency">Frequency</Label>
              <Input
                id="modifyFrequency"
                value={modifyFormData.frequency}
                onChange={(e) =>
                  setModifyFormData((prev) => ({ ...prev, frequency: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Route</Label>
              <Select
                value={modifyFormData.route}
                onValueChange={(v) =>
                  setModifyFormData((prev) => ({ ...prev, route: v }))
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setModifyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitModify}
              disabled={
                !modifyFormData.dose ||
                !modifyFormData.frequency ||
                updateMedication.isPending
              }
            >
              {updateMedication.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discontinue Medication Dialog */}
      <Dialog open={discontinueDialogOpen} onOpenChange={setDiscontinueDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Discontinue Medication</DialogTitle>
            <DialogDescription>
              Confirm discontinuation of {discontinuingMed?.medication}. Please
              provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stopReason">Reason for Discontinuation</Label>
              <Textarea
                id="stopReason"
                placeholder="e.g., Patient no longer needs this medication, adverse reaction..."
                value={stopReason}
                onChange={(e) => setStopReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDiscontinueDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSubmitDiscontinue}
              disabled={updateMedication.isPending}
            >
              {updateMedication.isPending ? 'Discontinuing...' : 'Discontinue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
