import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Plus,
  Search,
  CheckCircle2,
  FlaskConical,
  Pill,
  FileImage,
  Stethoscope,
  ClipboardList,
  Loader2,
  AlertCircle,
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
import { usePatientContext } from '@/stores/patient-context-store';
import { usePatientContextFromUrl } from '@/hooks/use-patient-context-url';
import { useDebounce } from '@/hooks/use-debounce';
import { toast } from '@/components/ui/toast';
import {
  useProviderOrders,
  useSignOrder,
  useCreateMedicationOrder,
  useCreateLabOrder,
  useCreateImagingOrder,
  type ProviderOrder,
} from '@/hooks/use-api';

type OrderTypeLabel = 'Lab' | 'Imaging' | 'Medication' | 'Referral' | 'Procedure';
type StatusLabel = 'Pending Signature' | 'Active' | 'Completed' | 'Cancelled';
type PriorityLabel = 'Routine' | 'Urgent' | 'STAT';

function mapOrderType(apiType: string): OrderTypeLabel {
  const mapping: Record<string, OrderTypeLabel> = {
    laboratory: 'Lab',
    imaging: 'Imaging',
    medication: 'Medication',
    referral: 'Referral',
    procedure: 'Procedure',
  };
  return mapping[apiType] || 'Procedure';
}

function mapStatus(apiStatus: string): StatusLabel {
  const mapping: Record<string, StatusLabel> = {
    draft: 'Pending Signature',
    active: 'Active',
    completed: 'Completed',
    cancelled: 'Cancelled',
    'on-hold': 'Active',
    'entered-in-error': 'Cancelled',
  };
  return mapping[apiStatus] || 'Active';
}

function mapPriority(apiPriority: string): PriorityLabel {
  const mapping: Record<string, PriorityLabel> = {
    routine: 'Routine',
    urgent: 'Urgent',
    stat: 'STAT',
    asap: 'Urgent',
  };
  return mapping[apiPriority] || 'Routine';
}

function mapApiOrderTypeBack(label: string): 'medication' | 'laboratory' | 'imaging' {
  const mapping: Record<string, 'medication' | 'laboratory' | 'imaging'> = {
    Lab: 'laboratory',
    Imaging: 'imaging',
    Medication: 'medication',
  };
  return mapping[label] || 'laboratory';
}

function mapPriorityBack(label: string): 'routine' | 'urgent' | 'stat' {
  const mapping: Record<string, 'routine' | 'urgent' | 'stat'> = {
    Routine: 'routine',
    Urgent: 'urgent',
    STAT: 'stat',
  };
  return mapping[label] || 'routine';
}

interface DisplayOrder {
  id: string;
  patient: string;
  patientId: string;
  type: OrderTypeLabel;
  description: string;
  status: StatusLabel;
  ordered: string;
  provider: string;
  priority: PriorityLabel;
  note?: string;
}

function toDisplayOrder(order: ProviderOrder): DisplayOrder {
  const details = order.orderDetails || {};
  const displayName =
    order.codeDisplay ||
    (details as Record<string, unknown>).displayName as string ||
    'Order';
  return {
    id: order.id,
    patient: order.patientId,
    patientId: order.patientId,
    type: mapOrderType(order.orderType),
    description: displayName,
    status: mapStatus(order.status),
    ordered: order.orderedAt ? order.orderedAt.slice(0, 10) : '',
    provider: order.orderedBy || '',
    priority: mapPriority(order.priority),
    note: order.notes,
  };
}

const typeIcons: Record<string, React.ElementType> = {
  Lab: FlaskConical,
  Imaging: FileImage,
  Medication: Pill,
  Referral: Stethoscope,
  Procedure: ClipboardList,
};

const typeColors: Record<string, string> = {
  Lab: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  Imaging:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  Medication:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  Referral:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  Procedure:
    'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
};

const statusColors: Record<string, string> = {
  'Pending Signature':
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  Active:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  Completed:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  Cancelled:
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export function OrdersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [newOrderDialogOpen, setNewOrderDialogOpen] = useState(false);
  const activePatient = usePatientContext((s) => s.activePatient);
  usePatientContextFromUrl();

  const { data: apiOrders, isLoading, error } = useProviderOrders();
  const signOrderMutation = useSignOrder();
  const createMedicationOrder = useCreateMedicationOrder();
  const createLabOrder = useCreateLabOrder();
  const createImagingOrder = useCreateImagingOrder();

  const [newOrderForm, setNewOrderForm] = useState({
    patient: '',
    patientId: '',
    type: 'Lab' as OrderTypeLabel,
    description: '',
    priority: 'Routine' as PriorityLabel,
    note: '',
  });

  // Auto-populate patient in new order dialog when patient context is active
  useEffect(() => {
    if (newOrderDialogOpen && activePatient) {
      setNewOrderForm((prev) => ({
        ...prev,
        patient: `${activePatient.lastName}, ${activePatient.firstName}`,
        patientId: activePatient.id,
      }));
    }
  }, [newOrderDialogOpen, activePatient]);

  const orders: DisplayOrder[] = useMemo(
    () => (apiOrders || []).map(toDisplayOrder),
    [apiOrders],
  );

  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === 'Pending Signature'),
    [orders],
  );
  const activeOrders = useMemo(
    () => orders.filter((o) => o.status === 'Active'),
    [orders],
  );

  // Debounce search to avoid excessive filtering on large order lists
  const debouncedSearchQuery = useDebounce(searchQuery, 200);

  const filterOrders = useCallback(
    (list: DisplayOrder[]) => {
      if (!debouncedSearchQuery) return list;
      const q = debouncedSearchQuery.toLowerCase();
      return list.filter(
        (o) =>
          o.patient.toLowerCase().includes(q) ||
          o.description.toLowerCase().includes(q) ||
          o.type.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q),
      );
    },
    [debouncedSearchQuery],
  );

  const handleSignOrder = useCallback(
    (id: string) => {
      signOrderMutation.mutate(id, {
        onSuccess: () => {
          toast({ title: 'Order signed successfully' });
        },
        onError: (err: Error) => {
          toast({
            title: 'Failed to sign order',
            description: err.message,
            variant: 'destructive',
          });
        },
      });
    },
    [signOrderMutation],
  );

  const handleNewOrder = useCallback(() => {
    const pid = newOrderForm.patientId || (activePatient?.id ?? '');
    if (!pid || !newOrderForm.description) return;

    const apiType = mapApiOrderTypeBack(newOrderForm.type);
    const priority = mapPriorityBack(newOrderForm.priority);

    const onSuccess = () => {
      toast({ title: 'Order placed successfully' });
      setNewOrderDialogOpen(false);
      setNewOrderForm({
        patient: '',
        patientId: '',
        type: 'Lab',
        description: '',
        priority: 'Routine',
        note: '',
      });
    };

    const onError = (err: Error) => {
      toast({
        title: 'Failed to place order',
        description: err.message,
        variant: 'destructive',
      });
    };

    if (apiType === 'medication') {
      createMedicationOrder.mutate(
        {
          patientId: pid,
          priority,
          medication: {
            rxnormCode: '',
            displayName: newOrderForm.description,
            dosage: '',
            route: 'oral',
            frequency: 'daily',
            instructions: newOrderForm.note || undefined,
          },
        },
        { onSuccess, onError },
      );
    } else if (apiType === 'imaging') {
      createImagingOrder.mutate(
        {
          patientId: pid,
          priority,
          imaging: {
            procedureCode: '',
            displayName: newOrderForm.description,
            clinicalIndication: newOrderForm.note || 'See clinical notes',
          },
        },
        { onSuccess, onError },
      );
    } else {
      createLabOrder.mutate(
        {
          patientId: pid,
          priority,
          lab: {
            loincCode: '',
            displayName: newOrderForm.description,
            clinicalNotes: newOrderForm.note || undefined,
          },
        },
        { onSuccess, onError },
      );
    }
  }, [
    newOrderForm,
    activePatient,
    createMedicationOrder,
    createLabOrder,
    createImagingOrder,
  ]);

  const isSubmitting =
    createMedicationOrder.isPending ||
    createLabOrder.isPending ||
    createImagingOrder.isPending;

  const renderOrderTable = (
    list: DisplayOrder[],
    showSignButton: boolean,
    tableLabel?: string,
  ) => {
    const filtered = filterOrders(list);
    return (
      <Table aria-label={tableLabel}>
        <TableHeader>
          <TableRow>
            <TableHead>Order ID</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Ordered</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Status</TableHead>
            {showSignButton && <TableHead className="w-[80px]">Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((order) => {
            const TypeIcon = typeIcons[order.type] || ClipboardList;
            return (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-sm">
                  {order.id.slice(0, 8)}
                </TableCell>
                <TableCell className="font-medium">{order.patient}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`gap-1 ${typeColors[order.type] || ''}`}
                  >
                    <TypeIcon className="h-3 w-3" aria-hidden="true" />
                    {order.type}
                  </Badge>
                </TableCell>
                <TableCell>{order.description}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      order.priority === 'STAT'
                        ? 'destructive'
                        : order.priority === 'Urgent'
                          ? 'secondary'
                          : 'outline'
                    }
                    className="text-xs"
                  >
                    {order.priority}
                  </Badge>
                </TableCell>
                <TableCell>{order.ordered}</TableCell>
                <TableCell>{order.provider}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={statusColors[order.status] || ''}
                  >
                    {order.status}
                  </Badge>
                </TableCell>
                {showSignButton && (
                  <TableCell>
                    {order.status === 'Pending Signature' && (
                      <Button
                        size="sm"
                        className="gap-1"
                        onClick={() => handleSignOrder(order.id)}
                        disabled={signOrderMutation.isPending}
                        aria-label={`Sign order ${order.id.slice(0, 8)}`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Sign
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={showSignButton ? 9 : 8}
                className="h-24 text-center"
              >
                No orders match the current filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24" role="status" aria-label="Loading orders">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="ml-2 text-muted-foreground">Loading orders...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-destructive">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p className="font-medium">Failed to load orders</p>
        <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            Manage lab, imaging, medication, and referral orders
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingOrders.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              {pendingOrders.length} Pending Signature
            </Badge>
          )}
          <Button
            className="gap-1"
            onClick={() => setNewOrderDialogOpen(true)}
          >
            <Plus className="mr-1 h-4 w-4" />
            New Order
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search orders by patient, description, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Search orders by patient, description, or ID"
          />
        </div>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending Signature ({pendingOrders.length})
          </TabsTrigger>
          <TabsTrigger value="active">
            Active ({activeOrders.length})
          </TabsTrigger>
          <TabsTrigger value="all">All Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Signature</CardTitle>
              <CardDescription>
                Orders awaiting your electronic signature
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderOrderTable(pendingOrders, true, 'Orders pending signature')}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Active Orders</CardTitle>
              <CardDescription>
                Currently active and in-progress orders
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderOrderTable(activeOrders, false, 'Active orders')}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Orders</CardTitle>
              <CardDescription>
                Complete order history across all statuses
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderOrderTable(orders, true, 'All orders')}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Order Dialog */}
      <Dialog open={newOrderDialogOpen} onOpenChange={setNewOrderDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Order</DialogTitle>
            <DialogDescription>
              Place a new order. Select a patient first, then specify the order
              details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orderPatient">Patient</Label>
              <Input
                id="orderPatient"
                placeholder="Search patient by name or MRN..."
                value={newOrderForm.patient}
                onChange={(e) =>
                  setNewOrderForm((prev) => ({
                    ...prev,
                    patient: e.target.value,
                  }))
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Order Type</Label>
                <Select
                  value={newOrderForm.type}
                  onValueChange={(v) =>
                    setNewOrderForm((prev) => ({
                      ...prev,
                      type: v as OrderTypeLabel,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Lab">Lab</SelectItem>
                    <SelectItem value="Imaging">Imaging</SelectItem>
                    <SelectItem value="Medication">Medication</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={newOrderForm.priority}
                  onValueChange={(v) =>
                    setNewOrderForm((prev) => ({
                      ...prev,
                      priority: v as PriorityLabel,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Routine">Routine</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                    <SelectItem value="STAT">STAT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orderDesc">Description</Label>
              <Input
                id="orderDesc"
                placeholder="e.g., CBC with Differential, Chest X-Ray PA/Lateral"
                value={newOrderForm.description}
                onChange={(e) =>
                  setNewOrderForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="orderNote">Clinical Notes</Label>
              <Textarea
                id="orderNote"
                placeholder="Additional instructions or context..."
                value={newOrderForm.note}
                onChange={(e) =>
                  setNewOrderForm((prev) => ({
                    ...prev,
                    note: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewOrderDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleNewOrder}
              disabled={
                (!newOrderForm.patientId && !activePatient?.id) ||
                !newOrderForm.description ||
                isSubmitting
              }
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Place Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
