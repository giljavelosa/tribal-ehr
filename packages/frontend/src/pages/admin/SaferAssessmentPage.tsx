import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  Plus,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
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
import { Checkbox } from '@/components/ui/checkbox';
import api from '@/lib/api';

interface SaferGuide {
  id: string;
  guideNumber: number;
  title: string;
}

interface SaferAssessment {
  id: string;
  assessmentYear: number;
  status: string;
  assessorId?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

interface SaferAssessmentItem {
  id: string;
  assessmentId: string;
  practiceId: string;
  implementationPercentage: number;
  status: string;
  ehrLimitation: boolean;
  notes?: string;
  evidence?: string;
  practiceNumber: string;
  description: string;
  guideId: string;
  required: boolean;
}

interface ComplianceSummary {
  overallPercentage: number;
  byGuide: {
    guideNumber: number;
    guideTitle: string;
    totalPractices: number;
    assessedCount: number;
    fullyImplemented: number;
    avgImplementation: number;
  }[];
  totalPractices: number;
  fullyImplemented: number;
  partiallyImplemented: number;
  notImplemented: number;
  ehrLimitations: number;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
};

const itemStatusColors: Record<string, string> = {
  not_assessed: 'bg-gray-100 text-gray-800',
  fully_implemented: 'bg-green-100 text-green-800',
  partially_implemented: 'bg-yellow-100 text-yellow-800',
  not_implemented: 'bg-red-100 text-red-800',
  not_applicable: 'bg-gray-100 text-gray-600',
};

export function SaferAssessmentPage() {
  const queryClient = useQueryClient();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear().toString());
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [expandedGuides, setExpandedGuides] = useState<Set<string>>(new Set());

  const { data: guides = [] } = useQuery({
    queryKey: ['safer', 'guides'],
    queryFn: async () => {
      const res = await api.get('/api/v1/safer-assessments/guides');
      return (res.data as { data: SaferGuide[] }).data;
    },
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ['safer', 'history'],
    queryFn: async () => {
      const res = await api.get('/api/v1/safer-assessments/history');
      return (res.data as { data: SaferAssessment[] }).data;
    },
  });

  const latestAssessment = assessments[0];
  const activeAssessmentId = selectedAssessmentId || latestAssessment?.id;

  const { data: items = [] } = useQuery({
    queryKey: ['safer', 'items', activeAssessmentId],
    queryFn: async () => {
      if (!activeAssessmentId) return [];
      const res = await api.get(`/api/v1/safer-assessments/${activeAssessmentId}/items`);
      return (res.data as { data: SaferAssessmentItem[] }).data;
    },
    enabled: !!activeAssessmentId,
  });

  const { data: summary } = useQuery({
    queryKey: ['safer', 'summary', activeAssessmentId],
    queryFn: async () => {
      if (!activeAssessmentId) return null;
      const res = await api.get(`/api/v1/safer-assessments/${activeAssessmentId}/summary`);
      return (res.data as { data: ComplianceSummary }).data;
    },
    enabled: !!activeAssessmentId,
  });

  const createMutation = useMutation({
    mutationFn: async (year: number) => {
      const res = await api.post('/api/v1/safer-assessments', { year });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['safer'] });
      setShowNewDialog(false);
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({
      itemId,
      data,
    }: {
      itemId: string;
      data: Record<string, unknown>;
    }) => {
      const res = await api.put(`/api/v1/safer-assessments/items/${itemId}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['safer'] });
    },
  });

  const toggleGuide = (guideId: string) => {
    setExpandedGuides((prev) => {
      const next = new Set(prev);
      if (next.has(guideId)) {
        next.delete(guideId);
      } else {
        next.add(guideId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SAFER Self-Assessment</h1>
          <p className="text-muted-foreground">
            Annual assessment of all 8 SAFER Guides - Required by CY 2026 IPPS rule
          </p>
        </div>
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Assessment
        </Button>
      </div>

      {/* Overall summary */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Overall Score</CardDescription>
              <CardTitle className="text-2xl">{summary.overallPercentage}%</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Fully Implemented</CardDescription>
              <CardTitle className="text-2xl text-green-700">{summary.fullyImplemented}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Partially</CardDescription>
              <CardTitle className="text-2xl text-yellow-700">{summary.partiallyImplemented}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Not Implemented</CardDescription>
              <CardTitle className="text-2xl text-red-700">{summary.notImplemented}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>EHR Limitations</CardDescription>
              <CardTitle className="text-2xl">{summary.ehrLimitations}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <Tabs defaultValue="assessment">
        <TabsList>
          <TabsTrigger value="assessment">
            <Shield className="mr-2 h-4 w-4" />
            Assessment
          </TabsTrigger>
          <TabsTrigger value="overview">
            <FileText className="mr-2 h-4 w-4" />
            Guide Overview
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assessment">
          {!activeAssessmentId ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No assessments found. Create a new assessment to begin.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {guides.map((guide) => {
                const guideItems = items.filter((i) => i.guideId === guide.id);
                const isExpanded = expandedGuides.has(guide.id);
                const guideSummary = summary?.byGuide?.find(
                  (g) => g.guideNumber === guide.guideNumber,
                );

                return (
                  <Card key={guide.id}>
                    <CardHeader
                      className="cursor-pointer"
                      onClick={() => toggleGuide(guide.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5" />
                          ) : (
                            <ChevronRight className="h-5 w-5" />
                          )}
                          <CardTitle className="text-base">
                            Guide {guide.guideNumber}: {guide.title}
                          </CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {guideSummary?.fullyImplemented ?? 0}/{guideSummary?.totalPractices ?? 0} implemented
                          </span>
                          <div className="h-2 w-24 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-green-500"
                              style={{ width: `${guideSummary?.avgImplementation ?? 0}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">
                            {guideSummary?.avgImplementation ?? 0}%
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    {isExpanded && (
                      <CardContent>
                        <div className="space-y-3">
                          {guideItems.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-lg border p-3 space-y-2"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">
                                      {item.practiceNumber}
                                    </span>
                                    {item.required && (
                                      <Badge className="bg-red-100 text-red-800 text-xs">
                                        Required
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {item.description}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Select
                                    value={item.status}
                                    onValueChange={(v) =>
                                      updateItemMutation.mutate({
                                        itemId: item.id,
                                        data: {
                                          status: v,
                                          implementationPercentage:
                                            v === 'fully_implemented' ? 100 :
                                            v === 'not_implemented' ? 0 :
                                            v === 'not_applicable' ? 100 :
                                            item.implementationPercentage,
                                        },
                                      })
                                    }
                                  >
                                    <SelectTrigger className="w-[180px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="not_assessed">Not Assessed</SelectItem>
                                      <SelectItem value="fully_implemented">Fully Implemented</SelectItem>
                                      <SelectItem value="partially_implemented">Partially Implemented</SelectItem>
                                      <SelectItem value="not_implemented">Not Implemented</SelectItem>
                                      <SelectItem value="not_applicable">Not Applicable</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 flex-1">
                                  <Label className="text-xs whitespace-nowrap">Implementation:</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    className="w-20 h-7 text-xs"
                                    value={item.implementationPercentage}
                                    onChange={(e) =>
                                      updateItemMutation.mutate({
                                        itemId: item.id,
                                        data: { implementationPercentage: Number(e.target.value) || 0 },
                                      })
                                    }
                                  />
                                  <span className="text-xs">%</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={item.ehrLimitation}
                                    onCheckedChange={(checked) =>
                                      updateItemMutation.mutate({
                                        itemId: item.id,
                                        data: { ehrLimitation: checked === true },
                                      })
                                    }
                                  />
                                  <Label className="text-xs">EHR Limitation</Label>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>SAFER Guides Overview</CardTitle>
              <CardDescription>All 8 guides required for annual self-assessment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {guides.map((guide) => {
                  const guideSummary = summary?.byGuide?.find(
                    (g) => g.guideNumber === guide.guideNumber,
                  );
                  return (
                    <div key={guide.id} className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <p className="font-medium">
                          Guide {guide.guideNumber}: {guide.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {guideSummary?.totalPractices ?? '?'} practices
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="h-2 w-32 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-green-500"
                            style={{ width: `${guideSummary?.avgImplementation ?? 0}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-sm font-medium">
                          {guideSummary?.avgImplementation ?? 0}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Assessment History</CardTitle>
              <CardDescription>Previous annual SAFER self-assessments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {assessments.map((assessment) => (
                  <div
                    key={assessment.id}
                    className={`flex items-center justify-between rounded-lg border p-4 cursor-pointer transition-colors hover:bg-accent ${
                      activeAssessmentId === assessment.id ? 'border-primary' : ''
                    }`}
                    onClick={() => setSelectedAssessmentId(assessment.id)}
                  >
                    <div>
                      <p className="font-medium">CY {assessment.assessmentYear} Assessment</p>
                      <p className="text-sm text-muted-foreground">
                        Created {new Date(assessment.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge className={statusColors[assessment.status] || ''}>
                      {assessment.status.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
                {assessments.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">
                    No assessments found. Create your first annual assessment.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Assessment Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Annual SAFER Assessment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Assessment Year</Label>
              <Input
                type="number"
                min="2024"
                max="2100"
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              This will create assessment items for all practices across all 8 SAFER Guides.
              Each practice must be assessed before the assessment can be completed and approved.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={!newYear}
              onClick={() => createMutation.mutate(Number(newYear))}
            >
              Create Assessment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
