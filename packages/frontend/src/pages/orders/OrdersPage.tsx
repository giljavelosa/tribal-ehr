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

interface ProviderOrder {
  id: string;
  patient: string;
  patientId: string;
  type: 'Lab' | 'Imaging' | 'Medication' | 'Referral' | 'Procedure';
  description: string;
  status: 'Pending Signature' | 'Active' | 'Completed' | 'Cancelled';
  ordered: string;
  provider: string;
  priority: 'Routine' | 'Urgent' | 'STAT';
  note?: string;
}

const mockOrders: ProviderOrder[] = [
  {
    id: 'ORD-001',
    patient: 'John Smith',
    patientId: 'P-003',
    type: 'Lab',
    description: 'Basic Metabolic Panel',
    status: 'Pending Signature',
    ordered: '2024-01-12',
    provider: 'Dr. Wilson',
    priority: 'Routine',
  },
  {
    id: 'ORD-002',
    patient: 'Mary Johnson',
    patientId: 'P-002',
    type: 'Lab',
    description: 'CBC with Differential',
    status: 'Completed',
    ordered: '2024-01-11',
    provider: 'Dr. Wilson',
    priority: 'Routine',
  },
  {
    id: 'ORD-003',
    patient: 'Robert Williams',
    patientId: 'P-001',
    type: 'Imaging',
    description: 'Chest X-Ray PA/Lateral',
    status: 'Active',
    ordered: '2024-01-12',
    provider: 'Dr. Wilson',
    priority: 'Urgent',
  },
  {
    id: 'ORD-004',
    patient: 'Sarah Davis',
    patientId: 'P-004',
    type: 'Referral',
    description: 'Cardiology Consultation',
    status: 'Pending Signature',
    ordered: '2024-01-10',
    provider: 'Dr. Wilson',
    priority: 'Routine',
  },
  {
    id: 'ORD-005',
    patient: 'James Brown',
    patientId: 'P-005',
    type: 'Lab',
    description: 'HbA1c, Lipid Panel',
    status: 'Pending Signature',
    ordered: '2024-01-12',
    provider: 'Dr. Wilson',
    priority: 'Routine',
  },
  {
    id: 'ORD-006',
    patient: 'Patricia Clark',
    patientId: 'P-006',
    type: 'Medication',
    description: 'Levothyroxine 50mcg',
    status: 'Active',
    ordered: '2024-01-10',
    provider: 'Dr. Wilson',
    priority: 'Routine',
  },
  {
    id: 'ORD-007',
    patient: 'Robert Williams',
    patientId: 'P-001',
    type: 'Lab',
    description: 'Troponin I (STAT)',
    status: 'Active',
    ordered: '2024-01-12',
    provider: 'Dr. Wilson',
    priority: 'STAT',
  },
  {
    id: 'ORD-008',
    patient: 'Michael Wilson',
    patientId: 'P-007',
    type: 'Procedure',
    description: 'EKG 12-Lead',
    status: 'Completed',
    ordered: '2024-01-09',
    provider: 'Dr. Wilson',
    priority: 'Routine',
  },
];

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
  const [orders, setOrders] = useState<ProviderOrder[]>(mockOrders);
  const [searchQuery, setSearchQuery] = useState('');
  const [newOrderDialogOpen, setNewOrderDialogOpen] = useState(false);
  const activePatient = usePatientContext((s) => s.activePatient);
  usePatientContextFromUrl();
  const [newOrderForm, setNewOrderForm] = useState({
    patient: '',
    type: 'Lab' as ProviderOrder['type'],
    description: '',
    priority: 'Routine' as ProviderOrder['priority'],
    note: '',
  });

  // Auto-populate patient in new order dialog when patient context is active
  useEffect(() => {
    if (newOrderDialogOpen && activePatient) {
      setNewOrderForm((prev) => ({
        ...prev,
        patient: `${activePatient.lastName}, ${activePatient.firstName}`,
      }));
    }
  }, [newOrderDialogOpen, activePatient]);

  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === 'Pending Signature'),
    [orders],
  );
  const activeOrders = useMemo(
    () => orders.filter((o) => o.status === 'Active'),
    [orders],
  );

  const filterOrders = useCallback(
    (list: ProviderOrder[]) => {
      if (!searchQuery) return list;
      const q = searchQuery.toLowerCase();
      return list.filter(
        (o) =>
          o.patient.toLowerCase().includes(q) ||
          o.description.toLowerCase().includes(q) ||
          o.type.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q),
      );
    },
    [searchQuery],
  );

  const signOrder = useCallback((id: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, status: 'Active' as const } : o,
      ),
    );
  }, []);

  const handleNewOrder = useCallback(() => {
    if (!newOrderForm.patient || !newOrderForm.description) return;
    const newOrder: ProviderOrder = {
      id: `ORD-${String(orders.length + 1).padStart(3, '0')}`,
      patient: newOrderForm.patient,
      patientId: '',
      type: newOrderForm.type,
      description: newOrderForm.description,
      status: 'Pending Signature',
      ordered: new Date().toISOString().slice(0, 10),
      provider: 'Dr. Wilson',
      priority: newOrderForm.priority,
      note: newOrderForm.note || undefined,
    };
    setOrders((prev) => [newOrder, ...prev]);
    setNewOrderDialogOpen(false);
    setNewOrderForm({
      patient: '',
      type: 'Lab',
      description: '',
      priority: 'Routine',
      note: '',
    });
  }, [newOrderForm, orders.length]);

  const renderOrderTable = (
    list: ProviderOrder[],
    showSignButton: boolean,
  ) => {
    const filtered = filterOrders(list);
    return (
      <Table>
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
                  {order.id}
                </TableCell>
                <TableCell className="font-medium">{order.patient}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`gap-1 ${typeColors[order.type] || ''}`}
                  >
                    <TypeIcon className="h-3 w-3" />
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
                        onClick={() => signOrder(order.id)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
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
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search orders by patient, description, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
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
              {renderOrderTable(pendingOrders, true)}
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
              {renderOrderTable(activeOrders, false)}
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
              {renderOrderTable(orders, true)}
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
                      type: v as ProviderOrder['type'],
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
                    <SelectItem value="Referral">Referral</SelectItem>
                    <SelectItem value="Procedure">Procedure</SelectItem>
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
                      priority: v as ProviderOrder['priority'],
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
              disabled={!newOrderForm.patient || !newOrderForm.description}
            >
              Place Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
