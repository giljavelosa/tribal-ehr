import React, { useState, useMemo, useCallback } from 'react';
import { Plus, Search, Edit, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  useConditions,
  useCreateCondition,
  useUpdateCondition,
  type Condition,
} from '@/hooks/use-api';

interface ProblemsTabProps {
  patientId: string;
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  resolved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  recurrence: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  remission: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  relapse: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const categoryLabels: Record<string, string> = {
  'problem-list-item': 'Problem',
  'encounter-diagnosis': 'Diagnosis',
  'health-concern': 'Health Concern',
};

const emptyFormState = {
  code: '',
  display: '',
  clinicalStatus: 'active' as Condition['clinicalStatus'],
  verificationStatus: 'confirmed' as Condition['verificationStatus'],
  category: 'problem-list-item' as Condition['category'],
  severity: '' as string,
  onsetDate: '',
  note: '',
};

export function ProblemsTab({ patientId }: ProblemsTabProps) {
  const { data: conditions, isLoading, error } = useConditions(patientId);
  const createCondition = useCreateCondition();
  const updateCondition = useUpdateCondition();

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCondition, setEditingCondition] = useState<Condition | null>(null);
  const [formData, setFormData] = useState(emptyFormState);

  const filteredConditions = useMemo(() => {
    if (!conditions) return [];
    return conditions.filter((c) => {
      if (filterStatus !== 'all' && c.clinicalStatus !== filterStatus) return false;
      if (filterCategory !== 'all' && c.category !== filterCategory) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          c.display.toLowerCase().includes(query) ||
          c.code.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [conditions, filterStatus, filterCategory, searchQuery]);

  const openAddDialog = useCallback(() => {
    setEditingCondition(null);
    setFormData(emptyFormState);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((condition: Condition) => {
    setEditingCondition(condition);
    setFormData({
      code: condition.code,
      display: condition.display,
      clinicalStatus: condition.clinicalStatus,
      verificationStatus: condition.verificationStatus,
      category: condition.category,
      severity: condition.severity || '',
      onsetDate: condition.onsetDate || '',
      note: condition.note || '',
    });
    setDialogOpen(true);
  }, []);

  const handleResolve = useCallback(
    async (condition: Condition) => {
      await updateCondition.mutateAsync({
        patientId,
        conditionId: condition.id,
        data: { clinicalStatus: 'resolved' },
      });
    },
    [patientId, updateCondition],
  );

  const handleSubmit = useCallback(async () => {
    const data: Partial<Condition> = {
      code: formData.code,
      display: formData.display,
      clinicalStatus: formData.clinicalStatus,
      verificationStatus: formData.verificationStatus,
      category: formData.category,
      severity: formData.severity as Condition['severity'] || undefined,
      onsetDate: formData.onsetDate || undefined,
      note: formData.note || undefined,
    };

    if (editingCondition) {
      await updateCondition.mutateAsync({
        patientId,
        conditionId: editingCondition.id,
        data,
      });
    } else {
      await createCondition.mutateAsync({ patientId, data });
    }
    setDialogOpen(false);
  }, [formData, editingCondition, patientId, createCondition, updateCondition]);

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive">
            Failed to load conditions. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Problem List</CardTitle>
            <CardDescription>
              Active and resolved conditions, diagnoses, and health concerns
            </CardDescription>
          </div>
          <Button onClick={openAddDialog} className="gap-1">
            <Plus className="h-4 w-4" />
            Add Problem
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by condition or ICD-10 code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="recurrence">Recurrence</SelectItem>
              <SelectItem value="remission">Remission</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="problem-list-item">Problem</SelectItem>
              <SelectItem value="encounter-diagnosis">Diagnosis</SelectItem>
              <SelectItem value="health-concern">Health Concern</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>ICD-10</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Onset Date</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredConditions.map((condition) => (
                <TableRow key={condition.id}>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusColors[condition.clinicalStatus] || ''}
                    >
                      {condition.clinicalStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {condition.code}
                  </TableCell>
                  <TableCell className="font-medium">
                    {condition.display}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {categoryLabels[condition.category] || condition.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {condition.onsetDate
                      ? new Date(condition.onsetDate).toLocaleDateString('en-US')
                      : '--'}
                  </TableCell>
                  <TableCell>
                    {condition.severity ? (
                      <Badge
                        variant={
                          condition.severity === 'severe'
                            ? 'destructive'
                            : condition.severity === 'moderate'
                              ? 'secondary'
                              : 'outline'
                        }
                        className="text-xs"
                      >
                        {condition.severity}
                      </Badge>
                    ) : (
                      '--'
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(condition)}
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {condition.clinicalStatus === 'active' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-600"
                          onClick={() => handleResolve(condition)}
                          title="Resolve"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredConditions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    No conditions found matching the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCondition ? 'Edit Problem' : 'Add Problem'}
            </DialogTitle>
            <DialogDescription>
              {editingCondition
                ? 'Update the details of this condition.'
                : 'Search for a condition and add it to the problem list.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="icd10Code">ICD-10 Code</Label>
                <Input
                  id="icd10Code"
                  placeholder="e.g., E11.9"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, code: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onsetDate">Onset Date</Label>
                <Input
                  id="onsetDate"
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="e.g., Type 2 Diabetes Mellitus"
                value={formData.display}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, display: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Clinical Status</Label>
                <Select
                  value={formData.clinicalStatus}
                  onValueChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      clinicalStatus: v as Condition['clinicalStatus'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="recurrence">Recurrence</SelectItem>
                    <SelectItem value="relapse">Relapse</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="remission">Remission</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Verification Status</Label>
                <Select
                  value={formData.verificationStatus}
                  onValueChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      verificationStatus: v as Condition['verificationStatus'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unconfirmed">Unconfirmed</SelectItem>
                    <SelectItem value="provisional">Provisional</SelectItem>
                    <SelectItem value="differential">Differential</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      category: v as Condition['category'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="problem-list-item">Problem</SelectItem>
                    <SelectItem value="encounter-diagnosis">
                      Encounter Diagnosis
                    </SelectItem>
                    <SelectItem value="health-concern">
                      Health Concern
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select
                  value={formData.severity}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, severity: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mild">Mild</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Clinical Note</Label>
              <Textarea
                id="note"
                placeholder="Additional clinical context..."
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
                !formData.code ||
                !formData.display ||
                createCondition.isPending ||
                updateCondition.isPending
              }
            >
              {createCondition.isPending || updateCondition.isPending
                ? 'Saving...'
                : editingCondition
                  ? 'Update Problem'
                  : 'Add Problem'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
