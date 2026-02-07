import React, { useState, useMemo, useCallback } from 'react';
import { Plus, Syringe, AlertTriangle, Search } from 'lucide-react';
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
  useImmunizations,
  useCreateImmunization,
  type Immunization,
} from '@/hooks/use-api';

interface ImmunizationsTabProps {
  patientId: string;
}

const statusColors: Record<string, string> = {
  completed:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'entered-in-error':
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  'not-done':
    'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

// Common recommended vaccines with expected scheduling
const recommendedVaccines = [
  'Influenza',
  'Tdap',
  'Td',
  'COVID-19',
  'Pneumococcal (PCV20)',
  'Shingles (Zoster)',
  'Hepatitis B',
  'HPV',
  'MMR',
  'Varicella',
];

const emptyFormState = {
  vaccineCode: '',
  vaccineDisplay: '',
  status: 'completed' as Immunization['status'],
  occurrenceDateTime: new Date().toISOString().slice(0, 10),
  lotNumber: '',
  site: 'left deltoid',
  route: 'intramuscular',
  doseQuantity: '',
  performer: '',
  note: '',
  expirationDate: '',
};

export function ImmunizationsTab({ patientId }: ImmunizationsTabProps) {
  const { data: immunizations, isLoading, error } =
    useImmunizations(patientId);
  const createImmunization = useCreateImmunization();

  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState(emptyFormState);

  const completedImmunizations = useMemo(
    () =>
      (immunizations || []).filter((i) => i.status === 'completed'),
    [immunizations],
  );

  // Determine which recommended vaccines haven't been given recently
  const overdueVaccines = useMemo(() => {
    const givenVaccineNames = completedImmunizations.map((i) =>
      i.vaccineDisplay.toLowerCase(),
    );
    return recommendedVaccines.filter(
      (v) =>
        !givenVaccineNames.some((gv) =>
          gv.toLowerCase().includes(v.toLowerCase()),
        ),
    );
  }, [completedImmunizations]);

  const filteredImmunizations = useMemo(() => {
    if (!immunizations) return [];
    if (!searchQuery) return immunizations;
    const query = searchQuery.toLowerCase();
    return immunizations.filter(
      (i) =>
        i.vaccineDisplay.toLowerCase().includes(query) ||
        i.vaccineCode.toLowerCase().includes(query) ||
        (i.lotNumber && i.lotNumber.toLowerCase().includes(query)),
    );
  }, [immunizations, searchQuery]);

  const handleSubmit = useCallback(async () => {
    const data: Partial<Immunization> = {
      vaccineCode: formData.vaccineCode,
      vaccineDisplay: formData.vaccineDisplay,
      status: formData.status,
      occurrenceDateTime: new Date(formData.occurrenceDateTime).toISOString(),
      lotNumber: formData.lotNumber || undefined,
      site: formData.site || undefined,
      route: formData.route || undefined,
      doseQuantity: formData.doseQuantity || undefined,
      performer: formData.performer || undefined,
      note: formData.note || undefined,
      expirationDate: formData.expirationDate || undefined,
    };

    await createImmunization.mutateAsync({ patientId, data });
    setDialogOpen(false);
    setFormData(emptyFormState);
  }, [formData, patientId, createImmunization]);

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive">
            Failed to load immunizations. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overdue Immunizations */}
      {overdueVaccines.length > 0 && !isLoading && (
        <Card className="border-amber-300 dark:border-amber-700">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-amber-800 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Recommended Immunizations Due
            </CardTitle>
            <CardDescription>
              The following vaccinations may be due based on standard guidelines
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {overdueVaccines.map((vaccine) => (
                <Badge
                  key={vaccine}
                  variant="outline"
                  className="bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
                >
                  {vaccine}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Immunization History */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Syringe className="h-5 w-5" />
                Immunization History
              </CardTitle>
              <CardDescription>
                Vaccination records and administration history
              </CardDescription>
            </div>
            <Button
              className="gap-1"
              onClick={() => {
                setFormData(emptyFormState);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Administer Vaccine
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search vaccine name or lot..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
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
                  <TableHead>Vaccine</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Lot #</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredImmunizations.map((imm) => (
                  <TableRow key={imm.id}>
                    <TableCell className="font-medium">
                      {imm.vaccineDisplay}
                    </TableCell>
                    <TableCell>
                      {new Date(imm.occurrenceDateTime).toLocaleDateString(
                        'en-US',
                        {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        },
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {imm.lotNumber || '--'}
                    </TableCell>
                    <TableCell className="capitalize">
                      {imm.site || '--'}
                    </TableCell>
                    <TableCell className="capitalize">
                      {imm.route || '--'}
                    </TableCell>
                    <TableCell>{imm.performer || '--'}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusColors[imm.status] || ''}
                      >
                        {imm.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredImmunizations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      {immunizations && immunizations.length > 0
                        ? 'No immunizations match the search query.'
                        : 'No immunization records on file.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Administer Vaccine Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Administer Vaccine</DialogTitle>
            <DialogDescription>
              Record a new vaccine administration for this patient.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vaccineCode">CVX Code</Label>
                <Input
                  id="vaccineCode"
                  placeholder="e.g., 141"
                  value={formData.vaccineCode}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      vaccineCode: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vaccineDisplay">Vaccine Name</Label>
                <Input
                  id="vaccineDisplay"
                  placeholder="e.g., Influenza, seasonal"
                  value={formData.vaccineDisplay}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      vaccineDisplay: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="immDate">Administration Date</Label>
                <Input
                  id="immDate"
                  type="date"
                  value={formData.occurrenceDateTime}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      occurrenceDateTime: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      status: v as Immunization['status'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="not-done">Not Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lotNumber">Lot Number</Label>
                <Input
                  id="lotNumber"
                  placeholder="e.g., FK3842"
                  value={formData.lotNumber}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      lotNumber: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expirationDate">Lot Expiration Date</Label>
                <Input
                  id="expirationDate"
                  type="date"
                  value={formData.expirationDate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      expirationDate: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Site</Label>
                <Select
                  value={formData.site}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, site: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left deltoid">Left Deltoid</SelectItem>
                    <SelectItem value="right deltoid">Right Deltoid</SelectItem>
                    <SelectItem value="left thigh">Left Thigh</SelectItem>
                    <SelectItem value="right thigh">Right Thigh</SelectItem>
                    <SelectItem value="left gluteal">Left Gluteal</SelectItem>
                    <SelectItem value="right gluteal">Right Gluteal</SelectItem>
                  </SelectContent>
                </Select>
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
                    <SelectItem value="intramuscular">Intramuscular</SelectItem>
                    <SelectItem value="subcutaneous">Subcutaneous</SelectItem>
                    <SelectItem value="intradermal">Intradermal</SelectItem>
                    <SelectItem value="oral">Oral</SelectItem>
                    <SelectItem value="nasal">Nasal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="doseQuantity">Dose</Label>
                <Input
                  id="doseQuantity"
                  placeholder="e.g., 0.5 mL"
                  value={formData.doseQuantity}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      doseQuantity: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="performer">Administered By</Label>
                <Input
                  id="performer"
                  placeholder="Provider name"
                  value={formData.performer}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      performer: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="immNote">Notes</Label>
              <Textarea
                id="immNote"
                placeholder="Additional notes..."
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
                !formData.vaccineDisplay ||
                !formData.vaccineCode ||
                createImmunization.isPending
              }
            >
              {createImmunization.isPending
                ? 'Recording...'
                : 'Record Administration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
