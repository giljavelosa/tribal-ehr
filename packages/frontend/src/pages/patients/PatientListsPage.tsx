import React, { useState, useCallback } from 'react';
import {
  Plus,
  Search,
  List,
  Users,
  Trash2,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Star,
  Stethoscope,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

interface PatientEntry {
  id: string;
  name: string;
  mrn: string;
}

interface PatientList {
  id: string;
  name: string;
  description: string;
  listType: 'custom' | 'provider' | 'shared';
  patientCount: number;
  isDefault: boolean;
  patients: PatientEntry[];
}

const mockLists: PatientList[] = [
  {
    id: '1',
    name: 'My Active Patients',
    description: 'Currently managing',
    listType: 'custom',
    patientCount: 12,
    isDefault: true,
    patients: [
      { id: 'p1', name: 'John Smith', mrn: 'MRN-100001' },
      { id: 'p2', name: 'Mary Johnson', mrn: 'MRN-100002' },
      { id: 'p3', name: 'Robert Williams', mrn: 'MRN-100003' },
      { id: 'p4', name: 'Sarah Davis', mrn: 'MRN-100004' },
      { id: 'p5', name: 'James Brown', mrn: 'MRN-100005' },
    ],
  },
  {
    id: '2',
    name: 'Diabetes Follow-up',
    description: 'Patients needing A1c monitoring',
    listType: 'custom',
    patientCount: 8,
    isDefault: false,
    patients: [
      { id: 'p2', name: 'Mary Johnson', mrn: 'MRN-100002' },
      { id: 'p6', name: 'Patricia Clark', mrn: 'MRN-100006' },
      { id: 'p7', name: 'Michael Wilson', mrn: 'MRN-100007' },
    ],
  },
  {
    id: '3',
    name: 'Post-Surgical Follow-up',
    description: 'Patients with recent surgical procedures',
    listType: 'custom',
    patientCount: 5,
    isDefault: false,
    patients: [
      { id: 'p3', name: 'Robert Williams', mrn: 'MRN-100003' },
      { id: 'p8', name: 'Linda Martinez', mrn: 'MRN-100008' },
    ],
  },
];

const mockProviderPatients: PatientEntry[] = [
  { id: 'p1', name: 'John Smith', mrn: 'MRN-100001' },
  { id: 'p2', name: 'Mary Johnson', mrn: 'MRN-100002' },
  { id: 'p3', name: 'Robert Williams', mrn: 'MRN-100003' },
  { id: 'p4', name: 'Sarah Davis', mrn: 'MRN-100004' },
  { id: 'p5', name: 'James Brown', mrn: 'MRN-100005' },
  { id: 'p6', name: 'Patricia Clark', mrn: 'MRN-100006' },
  { id: 'p7', name: 'Michael Wilson', mrn: 'MRN-100007' },
  { id: 'p8', name: 'Linda Martinez', mrn: 'MRN-100008' },
  { id: 'p9', name: 'David Anderson', mrn: 'MRN-100009' },
  { id: 'p10', name: 'Jennifer Taylor', mrn: 'MRN-100010' },
];

const listTypeColors: Record<string, string> = {
  custom: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  provider: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  shared: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

export function PatientListsPage() {
  const [lists, setLists] = useState<PatientList[]>(mockLists);
  const [expandedListId, setExpandedListId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [addPatientDialogOpen, setAddPatientDialogOpen] = useState(false);
  const [addPatientListId, setAddPatientListId] = useState<string | null>(null);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [newListForm, setNewListForm] = useState({
    name: '',
    description: '',
  });

  const handleToggleExpand = (id: string) => {
    setExpandedListId((prev) => (prev === id ? null : id));
  };

  const handleCreateList = useCallback(() => {
    if (!newListForm.name.trim()) return;
    const newList: PatientList = {
      id: `list-${Date.now()}`,
      name: newListForm.name,
      description: newListForm.description,
      listType: 'custom',
      patientCount: 0,
      isDefault: false,
      patients: [],
    };
    setLists((prev) => [...prev, newList]);
    setCreateDialogOpen(false);
    setNewListForm({ name: '', description: '' });
  }, [newListForm]);

  const handleOpenAddPatient = (listId: string) => {
    setAddPatientListId(listId);
    setPatientSearchQuery('');
    setAddPatientDialogOpen(true);
  };

  const handleAddPatientToList = useCallback(
    (patient: PatientEntry) => {
      if (!addPatientListId) return;
      setLists((prev) =>
        prev.map((list) => {
          if (list.id !== addPatientListId) return list;
          if (list.patients.some((p) => p.id === patient.id)) return list;
          return {
            ...list,
            patients: [...list.patients, patient],
            patientCount: list.patientCount + 1,
          };
        }),
      );
      setAddPatientDialogOpen(false);
      setAddPatientListId(null);
    },
    [addPatientListId],
  );

  const handleRemovePatient = useCallback((listId: string, patientId: string) => {
    setLists((prev) =>
      prev.map((list) => {
        if (list.id !== listId) return list;
        return {
          ...list,
          patients: list.patients.filter((p) => p.id !== patientId),
          patientCount: Math.max(0, list.patientCount - 1),
        };
      }),
    );
  }, []);

  const filteredSearchPatients = patientSearchQuery
    ? mockProviderPatients.filter(
        (p) =>
          p.name.toLowerCase().includes(patientSearchQuery.toLowerCase()) ||
          p.mrn.toLowerCase().includes(patientSearchQuery.toLowerCase()),
      )
    : mockProviderPatients;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Patient Lists</h1>
          <p className="text-muted-foreground">
            Manage personalized patient lists and quick-access groups
          </p>
        </div>
        <Button className="gap-1" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Create New List
        </Button>
      </div>

      <Tabs defaultValue="my-lists">
        <TabsList>
          <TabsTrigger value="my-lists" className="gap-1">
            <List className="h-4 w-4" />
            My Lists
          </TabsTrigger>
          <TabsTrigger value="provider-patients" className="gap-1">
            <Stethoscope className="h-4 w-4" />
            Provider Patients
          </TabsTrigger>
        </TabsList>

        {/* My Lists Tab */}
        <TabsContent value="my-lists" className="space-y-4">
          {lists.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <List className="h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">
                  You have no patient lists. Create one to get started.
                </p>
                <Button
                  className="gap-1"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Create New List
                </Button>
              </CardContent>
            </Card>
          ) : (
            lists.map((list) => {
              const isExpanded = expandedListId === list.id;

              return (
                <Card key={list.id} className="transition-shadow hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2 text-base">
                          {list.isDefault && (
                            <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />
                          )}
                          {list.name}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {list.description}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => handleOpenAddPatient(list.id)}
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Add Patient
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <Badge
                        variant="outline"
                        className={listTypeColors[list.listType] || ''}
                      >
                        {list.listType}
                      </Badge>
                      <Badge variant="secondary" className="gap-1">
                        <Users className="h-3 w-3" />
                        {list.patientCount} patient{list.patientCount !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1"
                      onClick={() => handleToggleExpand(list.id)}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" />
                          Hide Patients
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" />
                          Show Patients
                        </>
                      )}
                    </Button>

                    {isExpanded && (
                      <div className="mt-4">
                        {list.patients.length === 0 ? (
                          <div className="rounded-lg border border-dashed p-6 text-center">
                            <Users className="mx-auto h-8 w-8 text-muted-foreground" />
                            <p className="mt-2 text-sm text-muted-foreground">
                              No patients in this list yet. Add a patient to get started.
                            </p>
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Patient Name</TableHead>
                                <TableHead>MRN</TableHead>
                                <TableHead className="w-[100px]">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {list.patients.map((patient) => (
                                <TableRow key={patient.id}>
                                  <TableCell className="font-medium">{patient.name}</TableCell>
                                  <TableCell className="font-mono text-sm">{patient.mrn}</TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="gap-1 text-destructive hover:text-destructive"
                                      onClick={() => handleRemovePatient(list.id, patient.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Remove
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* Provider Patients Tab */}
        <TabsContent value="provider-patients">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5" />
                Provider Patient Panel
              </CardTitle>
              <CardDescription>
                All patients currently assigned to your care
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient Name</TableHead>
                    <TableHead>MRN</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockProviderPatients.map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell className="font-medium">{patient.name}</TableCell>
                      <TableCell className="font-mono text-sm">{patient.mrn}</TableCell>
                    </TableRow>
                  ))}
                  {mockProviderPatients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                        No patients currently assigned.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create New List Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Patient List</DialogTitle>
            <DialogDescription>
              Create a custom patient list for quick access and organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="listName">List Name</Label>
              <Input
                id="listName"
                placeholder="e.g., High-Risk Patients"
                value={newListForm.name}
                onChange={(e) =>
                  setNewListForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="listDesc">Description</Label>
              <Input
                id="listDesc"
                placeholder="Brief description of this list..."
                value={newListForm.description}
                onChange={(e) =>
                  setNewListForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateList} disabled={!newListForm.name.trim()}>
              Create List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Patient to List Dialog */}
      <Dialog open={addPatientDialogOpen} onOpenChange={setAddPatientDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Patient to List</DialogTitle>
            <DialogDescription>
              Search for a patient to add to your list.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or MRN..."
                value={patientSearchQuery}
                onChange={(e) => setPatientSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Separator />

            <div className="max-h-[300px] overflow-y-auto">
              {filteredSearchPatients.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No patients found matching your search.
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredSearchPatients.map((patient) => (
                    <button
                      key={patient.id}
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-muted"
                      onClick={() => handleAddPatientToList(patient)}
                    >
                      <div>
                        <p className="text-sm font-medium">{patient.name}</p>
                        <p className="text-xs text-muted-foreground">{patient.mrn}</p>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPatientDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
