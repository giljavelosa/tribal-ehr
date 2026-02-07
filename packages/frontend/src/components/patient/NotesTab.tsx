import React, { useState, useMemo, useCallback } from 'react';
import {
  Plus,
  FileText,
  Search,
  PenLine,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  UserCheck,
  Send,
} from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import {
  useNotes,
  useCreateNote,
  useUpdateNote,
  useCosignNote,
  type ClinicalNote,
} from '@/hooks/use-api';
import { useAuthStore } from '@/stores/auth-store';

interface NotesTabProps {
  patientId: string;
}

const typeColors: Record<string, string> = {
  soap: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  hp: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  progress:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  procedure:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  discharge:
    'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

const typeLabels: Record<string, string> = {
  soap: 'SOAP',
  hp: 'H&P',
  progress: 'Progress',
  procedure: 'Procedure',
  discharge: 'Discharge',
};

const statusColors: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  signed:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  amended:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  addended:
    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

const templateContent: Record<string, string> = {
  soap: `SUBJECTIVE:
Chief Complaint:
History of Present Illness:
Review of Systems:

OBJECTIVE:
Vitals:
Physical Exam:

ASSESSMENT:

PLAN:
`,
  hp: `HISTORY:
Chief Complaint:
History of Present Illness:
Past Medical History:
Past Surgical History:
Medications:
Allergies:
Social History:
Family History:
Review of Systems:

PHYSICAL EXAMINATION:
General:
HEENT:
Cardiovascular:
Respiratory:
Abdomen:
Extremities:
Neurological:

ASSESSMENT:

PLAN:
`,
  progress: `Date:
Provider:

Interval History:

Current Medications:

Vitals:

Assessment:

Plan:
`,
  procedure: `PROCEDURE NOTE

Procedure:
Date:
Surgeon:
Assistant:
Anesthesia:

Indication:

Description:

Findings:

Complications:

Post-Procedure Plan:
`,
  discharge: `DISCHARGE SUMMARY

Admission Date:
Discharge Date:
Attending Physician:

Principal Diagnosis:

Hospital Course:

Procedures Performed:

Discharge Medications:

Discharge Instructions:

Follow-Up:
`,
};

export function NotesTab({ patientId }: NotesTabProps) {
  const { data: notes, isLoading, error } = useNotes(patientId);
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const cosignNote = useCosignNote();
  const currentUser = useAuthStore((s) => s.user);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editorDialogOpen, setEditorDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<ClinicalNote | null>(null);
  const [cosignDialogOpen, setCosignDialogOpen] = useState(false);
  const [cosignTargetNote, setCosignTargetNote] = useState<ClinicalNote | null>(null);
  const [formData, setFormData] = useState({
    type: 'soap' as ClinicalNote['type'],
    title: '',
    content: '',
  });

  const filteredNotes = useMemo(() => {
    if (!notes) return [];
    return notes.filter((n) => {
      if (filterType !== 'all' && n.type !== filterType) return false;
      if (filterStatus !== 'all' && n.status !== filterStatus) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          n.title.toLowerCase().includes(query) ||
          n.author.toLowerCase().includes(query) ||
          n.content.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [notes, filterType, filterStatus, searchQuery]);

  const openTemplateDialog = useCallback(() => {
    setEditingNote(null);
    setFormData({ type: 'soap', title: '', content: '' });
    setTemplateDialogOpen(true);
  }, []);

  const selectTemplate = useCallback(
    (type: ClinicalNote['type']) => {
      setFormData({
        type,
        title: `${typeLabels[type]} Note - ${new Date().toLocaleDateString('en-US')}`,
        content: templateContent[type] || '',
      });
      setTemplateDialogOpen(false);
      setEditorDialogOpen(true);
    },
    [],
  );

  const openEditNote = useCallback((note: ClinicalNote) => {
    setEditingNote(note);
    setFormData({
      type: note.type,
      title: note.title,
      content: note.content,
    });
    setEditorDialogOpen(true);
  }, []);

  const handleSave = useCallback(
    async (asDraft: boolean) => {
      const data: Partial<ClinicalNote> = {
        type: formData.type,
        title: formData.title,
        content: formData.content,
        status: asDraft ? 'draft' : 'signed',
      };

      if (editingNote) {
        await updateNote.mutateAsync({
          patientId,
          noteId: editingNote.id,
          data,
        });
      } else {
        await createNote.mutateAsync({ patientId, data });
      }
      setEditorDialogOpen(false);
    },
    [formData, editingNote, patientId, createNote, updateNote],
  );

  const handleSign = useCallback(
    async (note: ClinicalNote) => {
      await updateNote.mutateAsync({
        patientId,
        noteId: note.id,
        data: { status: 'signed' },
      });
    },
    [patientId, updateNote],
  );

  const handleRequestCosign = useCallback(
    (note: ClinicalNote) => {
      setCosignTargetNote(note);
      setCosignDialogOpen(true);
    },
    [],
  );

  const handleCosign = useCallback(
    async (note: ClinicalNote) => {
      await cosignNote.mutateAsync({
        noteId: note.id,
        patientId,
      });
    },
    [patientId, cosignNote],
  );

  const handleConfirmRequestCosign = useCallback(
    async () => {
      if (!cosignTargetNote) return;
      // Request co-sign by updating the note with a cosigner field
      await updateNote.mutateAsync({
        patientId,
        noteId: cosignTargetNote.id,
        data: { cosigner: 'pending' },
      });
      setCosignDialogOpen(false);
      setCosignTargetNote(null);
    },
    [cosignTargetNote, patientId, updateNote],
  );

  const toggleExpanded = (noteId: string) => {
    setExpandedNoteId(expandedNoteId === noteId ? null : noteId);
  };

  // Determine if the current user is the note author
  const isNoteAuthor = (note: ClinicalNote) => {
    if (!currentUser) return false;
    const fullName = `${currentUser.firstName} ${currentUser.lastName}`;
    return note.author === fullName || note.author === currentUser.username;
  };

  // Determine if the user can co-sign (not the author, and is a provider/supervisor)
  const canCosign = (note: ClinicalNote) => {
    if (!currentUser) return false;
    // Must not be the author
    if (isNoteAuthor(note)) return false;
    // Must be a provider or admin role
    return ['admin', 'provider'].includes(currentUser.role);
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive">
            Failed to load clinical notes. Please try again later.
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
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Clinical Notes
              </CardTitle>
              <CardDescription>
                Clinical documentation and encounter notes
              </CardDescription>
            </div>
            <Button className="gap-1" onClick={openTemplateDialog}>
              <Plus className="h-4 w-4" />
              New Note
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="soap">SOAP</SelectItem>
                <SelectItem value="hp">H&P</SelectItem>
                <SelectItem value="progress">Progress</SelectItem>
                <SelectItem value="procedure">Procedure</SelectItem>
                <SelectItem value="discharge">Discharge</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="signed">Signed</SelectItem>
                <SelectItem value="amended">Amended</SelectItem>
                <SelectItem value="addended">Addended</SelectItem>
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
                  <TableHead className="w-8" />
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNotes.map((note) => (
                  <React.Fragment key={note.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => toggleExpanded(note.id)}
                    >
                      <TableCell>
                        {expandedNoteId === note.id ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {new Date(note.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={typeColors[note.type] || ''}
                        >
                          {typeLabels[note.type] || note.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {note.title}
                      </TableCell>
                      <TableCell>{note.author}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusColors[note.status] || ''}
                        >
                          {note.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {note.status === 'draft' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditNote(note);
                                }}
                                title="Edit"
                              >
                                <PenLine className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSign(note);
                                }}
                                title="Sign"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {note.status === 'signed' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditNote(note);
                                }}
                                title="Addend"
                              >
                                <PenLine className="h-4 w-4" />
                              </Button>
                              {/* Request Co-sign: visible to note author when not yet co-signed */}
                              {isNoteAuthor(note) && !note.cosigner && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-blue-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRequestCosign(note);
                                  }}
                                  title="Request Co-sign"
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              )}
                              {/* Co-sign: visible to supervisors/providers who are not the author */}
                              {canCosign(note) && note.cosigner === 'pending' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-green-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCosign(note);
                                  }}
                                  title="Co-sign"
                                  disabled={cosignNote.isPending}
                                >
                                  <UserCheck className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {/* Expanded Note Content */}
                    {expandedNoteId === note.id && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30 p-0">
                          <div className="p-4">
                            <div className="mb-2 flex items-center gap-4 text-xs text-muted-foreground">
                              <span>
                                Created:{' '}
                                {new Date(note.date).toLocaleString('en-US')}
                              </span>
                              {note.signedDate && (
                                <span>
                                  Signed:{' '}
                                  {new Date(
                                    note.signedDate,
                                  ).toLocaleString('en-US')}
                                </span>
                              )}
                              {note.cosigner && note.cosigner !== 'pending' && (
                                <span className="flex items-center gap-1">
                                  <UserCheck className="h-3 w-3" />
                                  Co-signed by: {note.cosigner}
                                </span>
                              )}
                              {note.cosigner === 'pending' && (
                                <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                                  Co-sign pending
                                </Badge>
                              )}
                            </div>
                            <Separator className="mb-3" />
                            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                              {note.content}
                            </pre>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
                {filteredNotes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      {notes && notes.length > 0
                        ? 'No notes match the current filters.'
                        : 'No clinical notes on file.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Template Selector Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Note Template</DialogTitle>
            <DialogDescription>
              Choose a template to start your clinical note.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(
              Object.entries(typeLabels) as [ClinicalNote['type'], string][]
            ).map(([type, label]) => (
              <button
                key={type}
                className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
                onClick={() => selectTemplate(type)}
              >
                <Badge
                  variant="outline"
                  className={typeColors[type] || ''}
                >
                  {label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {type === 'soap' && 'Subjective, Objective, Assessment, Plan'}
                  {type === 'hp' && 'History and Physical Examination'}
                  {type === 'progress' && 'Interval progress documentation'}
                  {type === 'procedure' && 'Procedure documentation'}
                  {type === 'discharge' && 'Discharge summary'}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Note Editor Dialog */}
      <Dialog open={editorDialogOpen} onOpenChange={setEditorDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingNote ? 'Edit Note' : 'New Note'}
            </DialogTitle>
            <DialogDescription>
              {editingNote
                ? 'Modify the clinical note content.'
                : 'Write your clinical documentation.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="noteTitle">Title</Label>
                <Input
                  id="noteTitle"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      type: v as ClinicalNote['type'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="soap">SOAP</SelectItem>
                    <SelectItem value="hp">H&P</SelectItem>
                    <SelectItem value="progress">Progress</SelectItem>
                    <SelectItem value="procedure">Procedure</SelectItem>
                    <SelectItem value="discharge">Discharge</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="noteContent">Content</Label>
              <Textarea
                id="noteContent"
                rows={20}
                className="font-mono text-sm"
                value={formData.content}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    content: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditorDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSave(true)}
              disabled={
                !formData.title ||
                !formData.content ||
                createNote.isPending ||
                updateNote.isPending
              }
            >
              Save as Draft
            </Button>
            <Button
              onClick={() => handleSave(false)}
              disabled={
                !formData.title ||
                !formData.content ||
                createNote.isPending ||
                updateNote.isPending
              }
              className="gap-1"
            >
              <CheckCircle2 className="h-4 w-4" />
              {createNote.isPending || updateNote.isPending
                ? 'Saving...'
                : 'Sign Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Co-sign Dialog */}
      <Dialog open={cosignDialogOpen} onOpenChange={setCosignDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Request Co-signature</DialogTitle>
            <DialogDescription>
              This will flag the note for co-signing by a supervisor or another
              provider.
            </DialogDescription>
          </DialogHeader>
          {cosignTargetNote && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Note</span>
                <span className="font-medium">{cosignTargetNote.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <Badge variant="outline" className={typeColors[cosignTargetNote.type] || ''}>
                  {typeLabels[cosignTargetNote.type] || cosignTargetNote.type}
                </Badge>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCosignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRequestCosign}
              disabled={updateNote.isPending}
              className="gap-1"
            >
              <Send className="h-4 w-4" />
              {updateNote.isPending ? 'Requesting...' : 'Request Co-sign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
