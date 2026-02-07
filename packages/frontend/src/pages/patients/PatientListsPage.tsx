import React, { useState, useCallback, useMemo } from 'react';
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
  Loader2,
  AlertTriangle,
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
import {
  usePatientLists,
  usePatientListDetail,
  useCreatePatientList,
  useAddPatientToList,
  useRemovePatientFromList,
  usePatients,
  type PatientListItem,
  type PatientListMember,
} from '@/hooks/use-api';

const listTypeColors: Record<string, string> = {
  custom: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  provider: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  shared: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

export function PatientListsPage() {
  const [expandedListId, setExpandedListId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [addPatientDialogOpen, setAddPatientDialogOpen] = useState(false);
  const [addPatientListId, setAddPatientListId] = useState<string | null>(null);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [newListForm, setNewListForm] = useState({
    name: '',
    description: '',
  });

  // Fetch patient lists from API
  const { data: lists, isLoading: listsLoading, error: listsError } = usePatientLists();

  // Fetch expanded list detail (with members)
  const { data: expandedListDetail, isLoading: detailLoading } = usePatientListDetail(expandedListId || '');

  // Fetch patients for search (provider panel)
  const { data: patientsData, isLoading: patientsLoading } = usePatients({
    name: patientSearchQuery || undefined,
    limit: 20,
  });

  // Mutations
  const createListMutation = useCreatePatientList();
  const addPatientMutation = useAddPatientToList();
  const removePatientMutation = useRemovePatientFromList();

  const handleToggleExpand = (id: string) => {
    setExpandedListId((prev) => (prev === id ? null : id));
  };

  const handleCreateList = useCallback(() => {
    if (!newListForm.name.trim()) return;
    createListMutation.mutate(
      {
        name: newListForm.name,
        description: newListForm.description || undefined,
        listType: 'custom',
      },
      {
        onSuccess: () => {
          setCreateDialogOpen(false);
          setNewListForm({ name: '', description: '' });
        },
      },
    );
  }, [newListForm, createListMutation]);

  const handleOpenAddPatient = (listId: string) => {
    setAddPatientListId(listId);
    setPatientSearchQuery('');
    setAddPatientDialogOpen(true);
  };

  const handleAddPatientToList = useCallback(
    (patientId: string) => {
      if (!addPatientListId) return;
      addPatientMutation.mutate(
        { listId: addPatientListId, patientId },
        {
          onSuccess: () => {
            setAddPatientDialogOpen(false);
            setAddPatientListId(null);
          },
        },
      );
    },
    [addPatientListId, addPatientMutation],
  );

  const handleRemovePatient = useCallback(
    (listId: string, patientId: string) => {
      removePatientMutation.mutate({ listId, patientId });
    },
    [removePatientMutation],
  );

  // Provider patients from paginated response
  const providerPatients = patientsData?.data ?? [];

  // Filter search patients for the add dialog
  const searchPatients = useMemo(() => {
    if (!patientSearchQuery) return providerPatients;
    return providerPatients;
  }, [providerPatients, patientSearchQuery]);

  // Members for the expanded list
  const expandedMembers: PatientListMember[] = expandedListDetail?.members ?? [];

  if (listsLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (listsError) {
    return (
      <div className="flex min-h-[400px] items-center justify-center" role="alert">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <div className="text-center">
              <p className="font-semibold">Unable to load patient lists</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {listsError instanceof Error ? listsError.message : 'Please try again later.'}
              </p>
            </div>
            <Button onClick={() => window.location.reload()}>Refresh</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const listData = lists ?? [];

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
          {listData.length === 0 ? (
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
            listData.map((list) => {
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
                          {list.description || 'No description'}
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
                        {detailLoading ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : expandedMembers.length === 0 ? (
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
                              {expandedMembers.map((member) => (
                                <TableRow key={member.id}>
                                  <TableCell className="font-medium">
                                    {member.patientName || 'Unknown'}
                                  </TableCell>
                                  <TableCell className="font-mono text-sm">
                                    {member.patientMrn || '--'}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="gap-1 text-destructive hover:text-destructive"
                                      onClick={() => handleRemovePatient(list.id, member.patientId)}
                                      disabled={removePatientMutation.isPending}
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
              {patientsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient Name</TableHead>
                      <TableHead>MRN</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providerPatients.map((patient) => (
                      <TableRow key={patient.id}>
                        <TableCell className="font-medium">
                          {patient.firstName} {patient.lastName}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{patient.mrn}</TableCell>
                      </TableRow>
                    ))}
                    {providerPatients.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                          No patients currently assigned.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
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
            <Button
              onClick={handleCreateList}
              disabled={!newListForm.name.trim() || createListMutation.isPending}
            >
              {createListMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
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
              {patientsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : searchPatients.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No patients found matching your search.
                </p>
              ) : (
                <div className="space-y-1">
                  {searchPatients.map((patient) => (
                    <button
                      key={patient.id}
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-muted"
                      onClick={() => handleAddPatientToList(patient.id)}
                      disabled={addPatientMutation.isPending}
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {patient.firstName} {patient.lastName}
                        </p>
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
