import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GraduationCap,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  BookOpen,
  Users,
  BarChart3,
  ClipboardCheck,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

interface TrainingCourse {
  id: string;
  title: string;
  description?: string;
  category: string;
  required: boolean;
  recurrenceMonths?: number;
  passingScore: number;
  active: boolean;
}

interface TrainingRecord {
  id: string;
  userId: string;
  courseId: string;
  courseTitle?: string;
  status: string;
  score?: number;
  passed?: boolean;
  assignedAt: string;
  completedAt?: string;
  expiresAt?: string;
}

interface ComplianceReport {
  totalCourses: number;
  requiredCourses: number;
  totalAssignments: number;
  completedCount: number;
  overdueCount: number;
  completionRate: number;
  byCategory: { category: string; total: number; completed: number }[];
}

const statusColors: Record<string, string> = {
  assigned: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  expired: 'bg-red-100 text-red-800',
};

export function TrainingPage() {
  const queryClient = useQueryClient();
  const [showCourseDialog, setShowCourseDialog] = useState(false);
  const [newCourse, setNewCourse] = useState({
    title: '',
    description: '',
    category: 'EHR',
    required: false,
    recurrenceMonths: '',
    passingScore: '80',
  });

  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ['training', 'courses'],
    queryFn: async () => {
      const res = await api.get('/api/v1/training/courses');
      return (res.data as { data: TrainingCourse[] }).data;
    },
  });

  const { data: records = [] } = useQuery({
    queryKey: ['training', 'records'],
    queryFn: async () => {
      const res = await api.get('/api/v1/training/records');
      return (res.data as { data: TrainingRecord[] }).data;
    },
  });

  const { data: compliance } = useQuery({
    queryKey: ['training', 'compliance'],
    queryFn: async () => {
      const res = await api.get('/api/v1/training/compliance');
      return (res.data as { data: ComplianceReport }).data;
    },
  });

  const createCourseMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post('/api/v1/training/courses', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training'] });
      setShowCourseDialog(false);
      setNewCourse({ title: '', description: '', category: 'EHR', required: false, recurrenceMonths: '', passingScore: '80' });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Training & Competency</h1>
          <p className="text-muted-foreground">
            SAFER Guide 5 - Track training courses, records, and compliance
          </p>
        </div>
        <Button onClick={() => setShowCourseDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Course
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Courses</CardDescription>
            <CardTitle className="text-2xl">{compliance?.totalCourses ?? '--'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {compliance?.requiredCourses ?? 0} required
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completion Rate</CardDescription>
            <CardTitle className="text-2xl">{compliance?.completionRate ?? 0}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {compliance?.completedCount ?? 0} of {compliance?.totalAssignments ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Overdue</CardDescription>
            <CardTitle className="text-2xl text-destructive">{compliance?.overdueCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Categories</CardDescription>
            <CardTitle className="text-2xl">{compliance?.byCategory?.length ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="courses">
        <TabsList>
          <TabsTrigger value="courses">
            <BookOpen className="mr-2 h-4 w-4" />
            Courses
          </TabsTrigger>
          <TabsTrigger value="records">
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Records
          </TabsTrigger>
          <TabsTrigger value="compliance">
            <BarChart3 className="mr-2 h-4 w-4" />
            Compliance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="courses">
          <Card>
            <CardHeader>
              <CardTitle>Training Courses</CardTitle>
              <CardDescription>Manage available training courses</CardDescription>
            </CardHeader>
            <CardContent>
              {coursesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Required</TableHead>
                      <TableHead>Passing Score</TableHead>
                      <TableHead>Recurrence</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courses.map((course) => (
                      <TableRow key={course.id}>
                        <TableCell className="font-medium">{course.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{course.category}</Badge>
                        </TableCell>
                        <TableCell>
                          {course.required ? (
                            <Badge className="bg-red-100 text-red-800">Required</Badge>
                          ) : (
                            <Badge variant="outline">Optional</Badge>
                          )}
                        </TableCell>
                        <TableCell>{course.passingScore}%</TableCell>
                        <TableCell>
                          {course.recurrenceMonths
                            ? `Every ${course.recurrenceMonths} months`
                            : 'One-time'}
                        </TableCell>
                        <TableCell>
                          <Badge className={course.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                            {course.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {courses.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                          No courses found. Create one to get started.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="records">
          <Card>
            <CardHeader>
              <CardTitle>Training Records</CardTitle>
              <CardDescription>View training assignments and completions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Expires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.courseTitle || record.courseId}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[record.status] || ''}>
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {record.score !== undefined ? (
                          <span className={record.passed ? 'text-green-700' : 'text-red-700'}>
                            {record.score}%
                          </span>
                        ) : '--'}
                      </TableCell>
                      <TableCell>{new Date(record.assignedAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {record.completedAt ? new Date(record.completedAt).toLocaleDateString() : '--'}
                      </TableCell>
                      <TableCell>
                        {record.expiresAt ? new Date(record.expiresAt).toLocaleDateString() : '--'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {records.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        No training records found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Dashboard</CardTitle>
              <CardDescription>Training compliance by category</CardDescription>
            </CardHeader>
            <CardContent>
              {compliance?.byCategory && compliance.byCategory.length > 0 ? (
                <div className="space-y-4">
                  {compliance.byCategory.map((cat) => {
                    const rate = cat.total > 0 ? Math.round((cat.completed / cat.total) * 100) : 0;
                    return (
                      <div key={cat.category} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{cat.category}</span>
                          <span className="text-muted-foreground">
                            {cat.completed}/{cat.total} ({rate}%)
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted">
                          <div
                            className={`h-2 rounded-full ${rate >= 80 ? 'bg-green-500' : rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-8 text-center text-muted-foreground">
                  No compliance data available yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Course Dialog */}
      <Dialog open={showCourseDialog} onOpenChange={setShowCourseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Training Course</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={newCourse.title}
                onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newCourse.description}
                onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={newCourse.category}
                  onValueChange={(v) => setNewCourse({ ...newCourse, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EHR">EHR</SelectItem>
                    <SelectItem value="Clinical">Clinical</SelectItem>
                    <SelectItem value="Safety">Safety</SelectItem>
                    <SelectItem value="Compliance">Compliance</SelectItem>
                    <SelectItem value="Security">Security</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Passing Score (%)</Label>
                <Input
                  type="number"
                  value={newCourse.passingScore}
                  onChange={(e) => setNewCourse({ ...newCourse, passingScore: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Recurrence (months)</Label>
                <Input
                  type="number"
                  placeholder="Leave empty for one-time"
                  value={newCourse.recurrenceMonths}
                  onChange={(e) => setNewCourse({ ...newCourse, recurrenceMonths: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  checked={newCourse.required}
                  onCheckedChange={(checked) =>
                    setNewCourse({ ...newCourse, required: checked === true })
                  }
                />
                <Label>Required for all users</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCourseDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={!newCourse.title}
              onClick={() =>
                createCourseMutation.mutate({
                  title: newCourse.title,
                  description: newCourse.description || undefined,
                  category: newCourse.category,
                  required: newCourse.required,
                  recurrenceMonths: newCourse.recurrenceMonths ? Number(newCourse.recurrenceMonths) : undefined,
                  passingScore: Number(newCourse.passingScore) || 80,
                })
              }
            >
              Create Course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
