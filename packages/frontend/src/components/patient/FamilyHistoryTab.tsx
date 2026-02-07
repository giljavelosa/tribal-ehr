import React, { useState, useCallback } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
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
import {
  useFamilyHistory,
  useCreateFamilyHistory,
  useUpdateFamilyHistory,
  useDeleteFamilyHistory,
  type FamilyHistory,
} from '@/hooks/use-api';

interface FamilyHistoryTabProps {
  patientId: string;
}

const RELATIONSHIPS = [
  { value: 'mother', label: 'Mother' },
  { value: 'father', label: 'Father' },
  { value: 'sister', label: 'Sister' },
  { value: 'brother', label: 'Brother' },
  { value: 'maternal_grandmother', label: 'Maternal Grandmother' },
  { value: 'maternal_grandfather', label: 'Maternal Grandfather' },
  { value: 'paternal_grandmother', label: 'Paternal Grandmother' },
  { value: 'paternal_grandfather', label: 'Paternal Grandfather' },
  { value: 'daughter', label: 'Daughter' },
  { value: 'son', label: 'Son' },
  { value: 'aunt', label: 'Aunt' },
  { value: 'uncle', label: 'Uncle' },
];

const RELATIONSHIP_LABELS: Record<string, string> = Object.fromEntries(
  RELATIONSHIPS.map((r) => [r.value, r.label]),
);

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  'entered-in-error': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const defaultFormData = {
  relationship: '',
  relativeName: '',
  conditionDisplay: '',
  conditionCode: '',
  conditionSystem: '',
  onsetAge: '',
  deceased: false,
  deceasedAge: '',
  causeOfDeath: '',
  note: '',
};

export function FamilyHistoryTab({ patientId }: FamilyHistoryTabProps) {
  const { data: records, isLoading, error } = useFamilyHistory(patientId);
  const createFamilyHistory = useCreateFamilyHistory();
  const updateFamilyHistory = useUpdateFamilyHistory();
  const deleteFamilyHistory = useDeleteFamilyHistory();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FamilyHistory | null>(null);
  const [formData, setFormData] = useState(defaultFormData);

  const openAddDialog = useCallback(() => {
    setEditingRecord(null);
    setFormData({ ...defaultFormData });
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((record: FamilyHistory) => {
    setEditingRecord(record);
    setFormData({
      relationship: record.relationship,
      relativeName: record.relativeName || '',
      conditionDisplay: record.conditionDisplay,
      conditionCode: record.conditionCode || '',
      conditionSystem: record.conditionSystem || '',
      onsetAge: record.onsetAge != null ? String(record.onsetAge) : '',
      deceased: record.deceased,
      deceasedAge: record.deceasedAge != null ? String(record.deceasedAge) : '',
      causeOfDeath: record.causeOfDeath || '',
      note: record.note || '',
    });
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (record: FamilyHistory) => {
      await deleteFamilyHistory.mutateAsync({
        id: record.id,
        patientId,
      });
    },
    [patientId, deleteFamilyHistory],
  );

  const handleSubmit = useCallback(async () => {
    const payload: Partial<FamilyHistory> = {
      patientId,
      relationship: formData.relationship,
      relativeName: formData.relativeName || undefined,
      conditionDisplay: formData.conditionDisplay,
      conditionCode: formData.conditionCode || undefined,
      conditionSystem: formData.conditionSystem || undefined,
      onsetAge: formData.onsetAge ? Number(formData.onsetAge) : undefined,
      deceased: formData.deceased,
      deceasedAge: formData.deceasedAge ? Number(formData.deceasedAge) : undefined,
      causeOfDeath: formData.causeOfDeath || undefined,
      note: formData.note || undefined,
    };

    if (editingRecord) {
      await updateFamilyHistory.mutateAsync({
        id: editingRecord.id,
        patientId,
        data: payload,
      });
    } else {
      await createFamilyHistory.mutateAsync(payload);
    }
    setDialogOpen(false);
  }, [formData, editingRecord, patientId, createFamilyHistory, updateFamilyHistory]);

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive">
            Failed to load family health history. Please try again later.
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
              <CardTitle>Family Health History</CardTitle>
              <CardDescription>
                Documented family member health conditions (ONC &sect;170.315(a)(12))
              </CardDescription>
            </div>
            <Button className="gap-1" onClick={openAddDialog}>
              <Plus className="h-4 w-4" />
              Add Family History
            </Button>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Relationship</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Onset Age</TableHead>
                  <TableHead>Deceased</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(records || []).map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">
                          {RELATIONSHIP_LABELS[record.relationship] || record.relationship}
                        </span>
                        {record.relativeName && (
                          <span className="ml-1 text-sm text-muted-foreground">
                            ({record.relativeName})
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{record.conditionDisplay}</span>
                        {record.conditionCode && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            [{record.conditionCode}]
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {record.onsetAge != null ? `${record.onsetAge} yrs` : '--'}
                    </TableCell>
                    <TableCell>
                      {record.deceased ? (
                        <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400">
                          Yes{record.deceasedAge != null ? ` (age ${record.deceasedAge})` : ''}
                        </Badge>
                      ) : (
                        'No'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusColors[record.status] || ''}
                      >
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(record)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(record)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!records || records.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No family health history documented. Click &quot;Add Family History&quot; to begin.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? 'Edit Family History' : 'Add Family History'}
            </DialogTitle>
            <DialogDescription>
              {editingRecord
                ? 'Update the family health history record.'
                : 'Document a health condition for a family member.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Relationship</Label>
              <Select
                value={formData.relationship}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, relationship: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIPS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="relativeName">Relative Name (optional)</Label>
              <Input
                id="relativeName"
                placeholder="e.g., Jane Doe"
                value={formData.relativeName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, relativeName: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="conditionDisplay">Condition</Label>
              <Input
                id="conditionDisplay"
                placeholder="e.g., Type 2 Diabetes, Breast Cancer"
                value={formData.conditionDisplay}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, conditionDisplay: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="conditionCode">Condition Code (optional)</Label>
                <Input
                  id="conditionCode"
                  placeholder="e.g., E11.9, 73211009"
                  value={formData.conditionCode}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, conditionCode: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Code System (optional)</Label>
                <Select
                  value={formData.conditionSystem}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, conditionSystem: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select system" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http://hl7.org/fhir/sid/icd-10-cm">
                      ICD-10-CM
                    </SelectItem>
                    <SelectItem value="http://snomed.info/sct">
                      SNOMED CT
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="onsetAge">Onset Age (years, optional)</Label>
              <Input
                id="onsetAge"
                type="number"
                min="0"
                max="150"
                placeholder="e.g., 45"
                value={formData.onsetAge}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, onsetAge: e.target.value }))
                }
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="deceased"
                checked={formData.deceased}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    deceased: checked === true,
                    deceasedAge: checked === true ? prev.deceasedAge : '',
                    causeOfDeath: checked === true ? prev.causeOfDeath : '',
                  }))
                }
              />
              <Label htmlFor="deceased">Deceased</Label>
            </div>

            {formData.deceased && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="deceasedAge">Deceased Age (optional)</Label>
                  <Input
                    id="deceasedAge"
                    type="number"
                    min="0"
                    max="150"
                    placeholder="e.g., 72"
                    value={formData.deceasedAge}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, deceasedAge: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="causeOfDeath">Cause of Death (optional)</Label>
                  <Input
                    id="causeOfDeath"
                    placeholder="e.g., Lung cancer"
                    value={formData.causeOfDeath}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, causeOfDeath: e.target.value }))
                    }
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="fhNote">Note (optional)</Label>
              <Textarea
                id="fhNote"
                placeholder="Additional details about this family history entry..."
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
                !formData.relationship ||
                !formData.conditionDisplay ||
                createFamilyHistory.isPending ||
                updateFamilyHistory.isPending
              }
            >
              {createFamilyHistory.isPending || updateFamilyHistory.isPending
                ? 'Saving...'
                : editingRecord
                  ? 'Update'
                  : 'Add Family History'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
