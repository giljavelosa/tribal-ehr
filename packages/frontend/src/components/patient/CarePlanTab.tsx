import React, { useState, useCallback } from 'react';
import {
  Plus,
  Target,
  Activity,
  Users,
  CheckCircle2,
  Circle,
  Clock,
  PenLine,
  Trash2,
  XCircle,
} from 'lucide-react';
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
  useCarePlans,
  useCreateCarePlan,
  useUpdateCarePlan,
  type CarePlan,
  type CarePlanGoal,
  type CarePlanActivity,
} from '@/hooks/use-api';

interface CarePlanTabProps {
  patientId: string;
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'on-hold': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const goalStatusIcons: Record<string, React.ElementType> = {
  completed: CheckCircle2,
  active: Activity,
  accepted: Circle,
  proposed: Clock,
  planned: Clock,
  cancelled: XCircle,
};

interface EditFormData {
  title: string;
  category: string;
  status: CarePlan['status'];
  goals: CarePlanGoal[];
  activities: CarePlanActivity[];
  newGoalDescription: string;
  newGoalTarget: string;
  newGoalDueDate: string;
  newActivityDescription: string;
}

export function CarePlanTab({ patientId }: CarePlanTabProps) {
  const { data: carePlans, isLoading, error } = useCarePlans(patientId);
  const createCarePlan = useCreateCarePlan();
  const updateCarePlan = useUpdateCarePlan();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<CarePlan | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    category: 'longitudinal',
    status: 'active' as CarePlan['status'],
    goalDescription: '',
    goalTarget: '',
    goalDueDate: '',
    activityDescription: '',
    careTeamName: '',
    careTeamRole: '',
  });

  const [editFormData, setEditFormData] = useState<EditFormData>({
    title: '',
    category: 'longitudinal',
    status: 'active',
    goals: [],
    activities: [],
    newGoalDescription: '',
    newGoalTarget: '',
    newGoalDueDate: '',
    newActivityDescription: '',
  });

  const handleSubmit = useCallback(async () => {
    const goals: CarePlanGoal[] = [];
    if (formData.goalDescription) {
      goals.push({
        id: `temp-${Date.now()}`,
        description: formData.goalDescription,
        status: 'active',
        target: formData.goalTarget || undefined,
        dueDate: formData.goalDueDate || undefined,
      });
    }

    const activities: CarePlanActivity[] = [];
    if (formData.activityDescription) {
      activities.push({
        id: `temp-${Date.now()}-a`,
        description: formData.activityDescription,
        status: 'not-started',
      });
    }

    const data: Partial<CarePlan> = {
      title: formData.title,
      status: formData.status,
      intent: 'plan',
      category: formData.category,
      goals,
      activities,
      careTeam: formData.careTeamName
        ? [
            {
              id: `temp-${Date.now()}-ct`,
              name: formData.careTeamName,
              role: formData.careTeamRole || 'Provider',
            },
          ]
        : [],
    };

    await createCarePlan.mutateAsync({ patientId, data });
    setDialogOpen(false);
    setFormData({
      title: '',
      category: 'longitudinal',
      status: 'active',
      goalDescription: '',
      goalTarget: '',
      goalDueDate: '',
      activityDescription: '',
      careTeamName: '',
      careTeamRole: '',
    });
  }, [formData, patientId, createCarePlan]);

  const openEditDialog = useCallback((plan: CarePlan) => {
    setEditingPlan(plan);
    setEditFormData({
      title: plan.title,
      category: plan.category,
      status: plan.status,
      goals: [...plan.goals],
      activities: [...plan.activities],
      newGoalDescription: '',
      newGoalTarget: '',
      newGoalDueDate: '',
      newActivityDescription: '',
    });
    setEditDialogOpen(true);
  }, []);

  const handleAddGoal = useCallback(() => {
    if (!editFormData.newGoalDescription) return;
    const newGoal: CarePlanGoal = {
      id: `temp-${Date.now()}`,
      description: editFormData.newGoalDescription,
      status: 'active',
      target: editFormData.newGoalTarget || undefined,
      dueDate: editFormData.newGoalDueDate || undefined,
    };
    setEditFormData((prev) => ({
      ...prev,
      goals: [...prev.goals, newGoal],
      newGoalDescription: '',
      newGoalTarget: '',
      newGoalDueDate: '',
    }));
  }, [editFormData.newGoalDescription, editFormData.newGoalTarget, editFormData.newGoalDueDate]);

  const handleRemoveGoal = useCallback((goalId: string) => {
    setEditFormData((prev) => ({
      ...prev,
      goals: prev.goals.filter((g) => g.id !== goalId),
    }));
  }, []);

  const handleGoalStatusChange = useCallback((goalId: string, newStatus: CarePlanGoal['status']) => {
    setEditFormData((prev) => ({
      ...prev,
      goals: prev.goals.map((g) =>
        g.id === goalId ? { ...g, status: newStatus } : g,
      ),
    }));
  }, []);

  const handleAddActivity = useCallback(() => {
    if (!editFormData.newActivityDescription) return;
    const newActivity: CarePlanActivity = {
      id: `temp-${Date.now()}-a`,
      description: editFormData.newActivityDescription,
      status: 'not-started',
    };
    setEditFormData((prev) => ({
      ...prev,
      activities: [...prev.activities, newActivity],
      newActivityDescription: '',
    }));
  }, [editFormData.newActivityDescription]);

  const handleRemoveActivity = useCallback((activityId: string) => {
    setEditFormData((prev) => ({
      ...prev,
      activities: prev.activities.filter((a) => a.id !== activityId),
    }));
  }, []);

  const handleEditSubmit = useCallback(async () => {
    if (!editingPlan) return;

    const data: Partial<CarePlan> = {
      title: editFormData.title,
      status: editFormData.status,
      category: editFormData.category,
      goals: editFormData.goals,
      activities: editFormData.activities,
    };

    await updateCarePlan.mutateAsync({
      patientId,
      carePlanId: editingPlan.id,
      data,
    });
    setEditDialogOpen(false);
    setEditingPlan(null);
  }, [editingPlan, editFormData, patientId, updateCarePlan]);

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive">
            Failed to load care plans. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  const activePlans = (carePlans || []).filter((cp) => cp.status === 'active');
  const otherPlans = (carePlans || []).filter((cp) => cp.status !== 'active');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Care Plans</h2>
          <p className="text-sm text-muted-foreground">
            Patient care plans, goals, and activities
          </p>
        </div>
        <Button className="gap-1" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Care Plan
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : activePlans.length === 0 && otherPlans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No care plans on file</p>
            <p className="text-sm text-muted-foreground">
              Create a care plan to track goals and activities for this patient.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Active Plans */}
          {activePlans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{plan.title}</CardTitle>
                    <CardDescription>
                      {plan.category}
                      {plan.period?.start &&
                        ` | Started: ${new Date(plan.period.start).toLocaleDateString('en-US')}`}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(plan)}
                      title="Edit Care Plan"
                    >
                      <PenLine className="h-4 w-4" />
                    </Button>
                    <Badge
                      variant="outline"
                      className={statusColors[plan.status] || ''}
                    >
                      {plan.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Goals */}
                {plan.goals.length > 0 && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Target className="h-4 w-4" />
                      Goals ({plan.goals.length})
                    </h4>
                    <div className="space-y-2">
                      {plan.goals.map((goal) => {
                        const StatusIcon =
                          goalStatusIcons[goal.status] || Circle;
                        return (
                          <div
                            key={goal.id}
                            className="flex items-start gap-3 rounded-lg border p-3"
                          >
                            <StatusIcon
                              className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                                goal.status === 'completed'
                                  ? 'text-green-600'
                                  : goal.status === 'active'
                                    ? 'text-blue-600'
                                    : goal.status === 'cancelled'
                                      ? 'text-red-600'
                                      : 'text-muted-foreground'
                              }`}
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                {goal.description}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                {goal.target && (
                                  <span>Target: {goal.target}</span>
                                )}
                                {goal.dueDate && (
                                  <span>
                                    Due:{' '}
                                    {new Date(
                                      goal.dueDate,
                                    ).toLocaleDateString('en-US')}
                                  </span>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  {goal.status}
                                </Badge>
                              </div>
                              {goal.progress != null && (
                                <div className="mt-2">
                                  <div className="flex items-center gap-2 text-xs">
                                    <div className="h-2 flex-1 rounded-full bg-muted">
                                      <div
                                        className="h-2 rounded-full bg-primary"
                                        style={{
                                          width: `${Math.min(goal.progress, 100)}%`,
                                        }}
                                      />
                                    </div>
                                    <span>{goal.progress}%</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Activities */}
                {plan.activities.length > 0 && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Activity className="h-4 w-4" />
                      Activities ({plan.activities.length})
                    </h4>
                    <div className="space-y-2">
                      {plan.activities.map((activity) => (
                        <div
                          key={activity.id}
                          className="flex items-center justify-between rounded-lg border p-3 text-sm"
                        >
                          <span>{activity.description}</span>
                          <Badge variant="outline" className="text-xs">
                            {activity.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Care Team */}
                {plan.careTeam.length > 0 && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Users className="h-4 w-4" />
                      Care Team ({plan.careTeam.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {plan.careTeam.map((member) => (
                        <div
                          key={member.id}
                          className="rounded-lg border px-3 py-2 text-sm"
                        >
                          <p className="font-medium">{member.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.role}
                            {member.specialty && ` - ${member.specialty}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Non-active Plans */}
          {otherPlans.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                Previous Care Plans
              </h3>
              {otherPlans.map((plan) => (
                <Card key={plan.id} className="mb-2 opacity-75">
                  <CardHeader className="py-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{plan.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEditDialog(plan)}
                          title="Edit Care Plan"
                        >
                          <PenLine className="h-3 w-3" />
                        </Button>
                        <Badge
                          variant="outline"
                          className={statusColors[plan.status] || ''}
                        >
                          {plan.status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add Care Plan Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Care Plan</DialogTitle>
            <DialogDescription>
              Create a new care plan with goals and activities.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cpTitle">Plan Title</Label>
              <Input
                id="cpTitle"
                placeholder="e.g., Diabetes Management Plan"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, category: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="longitudinal">Longitudinal</SelectItem>
                    <SelectItem value="encounter">Encounter-based</SelectItem>
                    <SelectItem value="disease-management">
                      Disease Management
                    </SelectItem>
                    <SelectItem value="preventive">Preventive Care</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      status: v as CarePlan['status'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Initial Goal</Label>
              <Input
                placeholder="Goal description..."
                value={formData.goalDescription}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    goalDescription: e.target.value,
                  }))
                }
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Target (e.g., HbA1c < 7%)"
                  value={formData.goalTarget}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      goalTarget: e.target.value,
                    }))
                  }
                />
                <Input
                  type="date"
                  value={formData.goalDueDate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      goalDueDate: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Initial Activity</Label>
              <Input
                placeholder="Activity description..."
                value={formData.activityDescription}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    activityDescription: e.target.value,
                  }))
                }
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Care Team Member</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Name"
                  value={formData.careTeamName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      careTeamName: e.target.value,
                    }))
                  }
                />
                <Input
                  placeholder="Role"
                  value={formData.careTeamRole}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      careTeamRole: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.title || createCarePlan.isPending}
            >
              {createCarePlan.isPending ? 'Creating...' : 'Create Care Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Care Plan Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Care Plan</DialogTitle>
            <DialogDescription>
              Update the care plan details, goals, and activities.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editCpTitle">Plan Title</Label>
              <Input
                id="editCpTitle"
                value={editFormData.title}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={editFormData.category}
                  onValueChange={(v) =>
                    setEditFormData((prev) => ({ ...prev, category: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="longitudinal">Longitudinal</SelectItem>
                    <SelectItem value="encounter">Encounter-based</SelectItem>
                    <SelectItem value="disease-management">
                      Disease Management
                    </SelectItem>
                    <SelectItem value="preventive">Preventive Care</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editFormData.status}
                  onValueChange={(v) =>
                    setEditFormData((prev) => ({
                      ...prev,
                      status: v as CarePlan['status'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on-hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Goals Section */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Goals</Label>
              {editFormData.goals.length > 0 && (
                <div className="space-y-2">
                  {editFormData.goals.map((goal) => (
                    <div
                      key={goal.id}
                      className="flex items-center gap-2 rounded-lg border p-2"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{goal.description}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {goal.target && <span>Target: {goal.target}</span>}
                          {goal.dueDate && (
                            <span>
                              Due: {new Date(goal.dueDate).toLocaleDateString('en-US')}
                            </span>
                          )}
                        </div>
                      </div>
                      <Select
                        value={goal.status}
                        onValueChange={(v) =>
                          handleGoalStatusChange(goal.id, v as CarePlanGoal['status'])
                        }
                      >
                        <SelectTrigger className="w-[130px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="proposed">Proposed</SelectItem>
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="accepted">Accepted</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="on-hold">On Hold</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemoveGoal(goal.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2 rounded-lg border border-dashed p-3">
                <Input
                  placeholder="New goal description..."
                  value={editFormData.newGoalDescription}
                  onChange={(e) =>
                    setEditFormData((prev) => ({
                      ...prev,
                      newGoalDescription: e.target.value,
                    }))
                  }
                />
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input
                    placeholder="Target"
                    value={editFormData.newGoalTarget}
                    onChange={(e) =>
                      setEditFormData((prev) => ({
                        ...prev,
                        newGoalTarget: e.target.value,
                      }))
                    }
                  />
                  <Input
                    type="date"
                    value={editFormData.newGoalDueDate}
                    onChange={(e) =>
                      setEditFormData((prev) => ({
                        ...prev,
                        newGoalDueDate: e.target.value,
                      }))
                    }
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddGoal}
                    disabled={!editFormData.newGoalDescription}
                    className="gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Add Goal
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            {/* Activities Section */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Activities</Label>
              {editFormData.activities.length > 0 && (
                <div className="space-y-2">
                  {editFormData.activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center gap-2 rounded-lg border p-2"
                    >
                      <span className="flex-1 text-sm">
                        {activity.description}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {activity.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemoveActivity(activity.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 rounded-lg border border-dashed p-3">
                <Input
                  placeholder="New activity description..."
                  value={editFormData.newActivityDescription}
                  onChange={(e) =>
                    setEditFormData((prev) => ({
                      ...prev,
                      newActivityDescription: e.target.value,
                    }))
                  }
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddActivity}
                  disabled={!editFormData.newActivityDescription}
                  className="gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditSubmit}
              disabled={!editFormData.title || updateCarePlan.isPending}
            >
              {updateCarePlan.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
