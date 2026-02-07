import React, { useState, useMemo, useCallback } from 'react';
import { Plus, Edit, AlertCircle, X, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Separator } from '@/components/ui/separator';
import {
  useAllergies,
  useCreateAllergy,
  useUpdateAllergy,
  type AllergyIntolerance,
  type AllergyReaction,
} from '@/hooks/use-api';

interface AllergiesTabProps {
  patientId: string;
}

const criticalityColors: Record<string, string> = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'unable-to-assess':
    'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

const categoryLabels: Record<string, string> = {
  food: 'Food',
  medication: 'Medication',
  environment: 'Environment',
  biologic: 'Biologic',
};

export function AllergiesTab({ patientId }: AllergiesTabProps) {
  const { data: allergies, isLoading, error } = useAllergies(patientId);
  const createAllergy = useCreateAllergy();
  const updateAllergy = useUpdateAllergy();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAllergy, setEditingAllergy] =
    useState<AllergyIntolerance | null>(null);
  const [formData, setFormData] = useState({
    allergen: '',
    type: 'allergy' as AllergyIntolerance['type'],
    category: 'medication' as AllergyIntolerance['category'],
    criticality: 'low' as AllergyIntolerance['criticality'],
    clinicalStatus: 'active' as AllergyIntolerance['clinicalStatus'],
    reactions: [] as AllergyReaction[],
    onsetDate: '',
    note: '',
  });
  const [newReaction, setNewReaction] = useState({
    manifestation: '',
    severity: 'moderate' as AllergyReaction['severity'],
  });

  const activeAllergies = useMemo(
    () => (allergies || []).filter((a) => a.clinicalStatus === 'active'),
    [allergies],
  );
  const inactiveAllergies = useMemo(
    () => (allergies || []).filter((a) => a.clinicalStatus !== 'active'),
    [allergies],
  );
  const nkda = activeAllergies.length === 0;

  const openAddDialog = useCallback(() => {
    setEditingAllergy(null);
    setFormData({
      allergen: '',
      type: 'allergy',
      category: 'medication',
      criticality: 'low',
      clinicalStatus: 'active',
      reactions: [],
      onsetDate: '',
      note: '',
    });
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((allergy: AllergyIntolerance) => {
    setEditingAllergy(allergy);
    setFormData({
      allergen: allergy.allergen,
      type: allergy.type,
      category: allergy.category,
      criticality: allergy.criticality,
      clinicalStatus: allergy.clinicalStatus,
      reactions: [...allergy.reactions],
      onsetDate: allergy.onsetDate || '',
      note: allergy.note || '',
    });
    setDialogOpen(true);
  }, []);

  const addReaction = useCallback(() => {
    if (!newReaction.manifestation) return;
    setFormData((prev) => ({
      ...prev,
      reactions: [...prev.reactions, { ...newReaction }],
    }));
    setNewReaction({ manifestation: '', severity: 'moderate' });
  }, [newReaction]);

  const removeReaction = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      reactions: prev.reactions.filter((_, i) => i !== index),
    }));
  }, []);

  const handleInactivate = useCallback(
    async (allergy: AllergyIntolerance) => {
      await updateAllergy.mutateAsync({
        patientId,
        allergyId: allergy.id,
        data: { clinicalStatus: 'inactive' },
      });
    },
    [patientId, updateAllergy],
  );

  const handleSubmit = useCallback(async () => {
    const data: Partial<AllergyIntolerance> = {
      allergen: formData.allergen,
      type: formData.type,
      category: formData.category,
      criticality: formData.criticality,
      clinicalStatus: formData.clinicalStatus,
      reactions: formData.reactions,
      onsetDate: formData.onsetDate || undefined,
      note: formData.note || undefined,
    };

    if (editingAllergy) {
      await updateAllergy.mutateAsync({
        patientId,
        allergyId: editingAllergy.id,
        data,
      });
    } else {
      await createAllergy.mutateAsync({ patientId, data });
    }
    setDialogOpen(false);
  }, [formData, editingAllergy, patientId, createAllergy, updateAllergy]);

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive">
            Failed to load allergies. Please try again later.
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
              <CardTitle>Allergies & Intolerances</CardTitle>
              <CardDescription>
                Documented allergies, adverse reactions, and intolerances
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {nkda && !isLoading && (
                <Badge
                  variant="outline"
                  className="gap-1 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                >
                  <ShieldCheck className="h-3 w-3" />
                  NKDA
                </Badge>
              )}
              <Button className="gap-1" onClick={openAddDialog}>
                <Plus className="h-4 w-4" />
                Add Allergy
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Allergen</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Criticality</TableHead>
                    <TableHead>Reactions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...activeAllergies, ...inactiveAllergies].map((allergy) => (
                    <TableRow
                      key={allergy.id}
                      className={
                        allergy.criticality === 'high' &&
                        allergy.clinicalStatus === 'active'
                          ? 'bg-red-50/50 dark:bg-red-950/10'
                          : ''
                      }
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {allergy.criticality === 'high' &&
                            allergy.clinicalStatus === 'active' && (
                              <AlertCircle className="h-4 w-4 flex-shrink-0 text-destructive" />
                            )}
                          <span
                            className={
                              allergy.criticality === 'high' &&
                              allergy.clinicalStatus === 'active'
                                ? 'font-semibold text-destructive'
                                : 'font-medium'
                            }
                          >
                            {allergy.allergen}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">
                        {allergy.type}
                      </TableCell>
                      <TableCell>
                        {categoryLabels[allergy.category] || allergy.category}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            criticalityColors[allergy.criticality] || ''
                          }
                        >
                          {allergy.criticality}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {allergy.reactions.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {allergy.reactions.map((r, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="text-xs"
                              >
                                {r.manifestation}
                                {r.severity === 'severe' && ' (severe)'}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          '--'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            allergy.clinicalStatus === 'active'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {allergy.clinicalStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(allergy)}
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!allergies || allergies.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        No allergies or intolerances documented. If the patient
                        has no known drug allergies, this will display as NKDA.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAllergy ? 'Edit Allergy' : 'Add Allergy'}
            </DialogTitle>
            <DialogDescription>
              {editingAllergy
                ? 'Update the allergy or intolerance record.'
                : 'Document a new allergy or intolerance for this patient.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="allergen">Allergen</Label>
              <Input
                id="allergen"
                placeholder="e.g., Penicillin, Peanuts, Latex"
                value={formData.allergen}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    allergen: e.target.value,
                  }))
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      type: v as AllergyIntolerance['type'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allergy">Allergy</SelectItem>
                    <SelectItem value="intolerance">Intolerance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      category: v as AllergyIntolerance['category'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="food">Food</SelectItem>
                    <SelectItem value="medication">Medication</SelectItem>
                    <SelectItem value="environment">Environment</SelectItem>
                    <SelectItem value="biologic">Biologic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Criticality</Label>
                <Select
                  value={formData.criticality}
                  onValueChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      criticality: v as AllergyIntolerance['criticality'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="unable-to-assess">
                      Unable to Assess
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Clinical Status</Label>
                <Select
                  value={formData.clinicalStatus}
                  onValueChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      clinicalStatus: v as AllergyIntolerance['clinicalStatus'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="allergyOnset">Onset Date</Label>
              <Input
                id="allergyOnset"
                type="date"
                value={formData.onsetDate}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    onsetDate: e.target.value,
                  }))
                }
              />
            </div>

            {/* Reactions */}
            <div className="space-y-3">
              <Label>Reactions</Label>
              {formData.reactions.length > 0 && (
                <div className="space-y-2">
                  {formData.reactions.map((reaction, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border p-2 text-sm"
                    >
                      <div>
                        <span className="font-medium">
                          {reaction.manifestation}
                        </span>
                        <span className="ml-2 text-muted-foreground">
                          ({reaction.severity})
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeReaction(i)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Separator />
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Manifestation</Label>
                  <Input
                    placeholder="e.g., Hives, Anaphylaxis, Nausea"
                    value={newReaction.manifestation}
                    onChange={(e) =>
                      setNewReaction((prev) => ({
                        ...prev,
                        manifestation: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addReaction();
                      }
                    }}
                  />
                </div>
                <div className="w-[120px] space-y-1">
                  <Label className="text-xs">Severity</Label>
                  <Select
                    value={newReaction.severity}
                    onValueChange={(v) =>
                      setNewReaction((prev) => ({
                        ...prev,
                        severity: v as AllergyReaction['severity'],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mild">Mild</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="severe">Severe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={addReaction}
                  disabled={!newReaction.manifestation}
                  title="Add reaction"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="allergyNote">Note</Label>
              <Input
                id="allergyNote"
                placeholder="Additional details..."
                value={formData.note}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, note: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !formData.allergen ||
                createAllergy.isPending ||
                updateAllergy.isPending
              }
            >
              {createAllergy.isPending || updateAllergy.isPending
                ? 'Saving...'
                : editingAllergy
                  ? 'Update Allergy'
                  : 'Add Allergy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
