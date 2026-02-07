import React, { useState, useMemo, useCallback } from 'react';
import {
  Plus,
  Search,
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
  useOrders,
  useCreateOrder,
  type Order,
} from '@/hooks/use-api';

interface OrdersTabProps {
  patientId: string;
}

const typeIcons: Record<string, React.ElementType> = {
  medication: Pill,
  laboratory: FlaskConical,
  imaging: FileImage,
  referral: Stethoscope,
  procedure: ClipboardList,
};

const typeColors: Record<string, string> = {
  medication:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  laboratory:
    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  imaging:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  referral:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  procedure:
    'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  active:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'on-hold':
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  completed:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled:
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  'entered-in-error':
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const typeLabels: Record<string, string> = {
  medication: 'Medication',
  laboratory: 'Lab',
  imaging: 'Imaging',
  referral: 'Referral',
  procedure: 'Procedure',
};

const emptyFormState = {
  type: 'laboratory' as Order['type'],
  description: '',
  priority: 'routine' as Order['priority'],
  note: '',
};

export function OrdersTab({ patientId }: OrdersTabProps) {
  const { data: orders, isLoading, error } = useOrders(patientId);
  const createOrder = useCreateOrder();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [formData, setFormData] = useState(emptyFormState);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter((o) => {
      if (filterType !== 'all' && o.type !== filterType) return false;
      if (filterStatus !== 'all' && o.status !== filterStatus) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          o.description.toLowerCase().includes(query) ||
          o.type.toLowerCase().includes(query) ||
          o.orderingProvider.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [orders, filterType, filterStatus, searchQuery]);

  const openNewOrder = useCallback(() => {
    setFormData(emptyFormState);
    setDialogOpen(true);
  }, []);

  const openDetail = (order: Order) => {
    setSelectedOrder(order);
    setDetailDialogOpen(true);
  };

  const handleSubmit = useCallback(async () => {
    const data: Partial<Order> = {
      type: formData.type,
      description: formData.description,
      priority: formData.priority,
      status: 'active',
      note: formData.note || undefined,
      orderDate: new Date().toISOString(),
    };

    await createOrder.mutateAsync({ patientId, data });
    setDialogOpen(false);
    setFormData(emptyFormState);
  }, [formData, patientId, createOrder]);

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive">
            Failed to load orders. Please try again later.
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
              <CardTitle>Orders</CardTitle>
              <CardDescription>
                Medication, lab, imaging, referral, and procedure orders
              </CardDescription>
            </div>
            <Button className="gap-1" onClick={openNewOrder}>
              <Plus className="h-4 w-4" />
              New Order
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="medication">Medication</SelectItem>
                <SelectItem value="laboratory">Lab</SelectItem>
                <SelectItem value="imaging">Imaging</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="procedure">Procedure</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on-hold">On Hold</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Provider</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => {
                  const TypeIcon = typeIcons[order.type] || ClipboardList;
                  return (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer"
                      onClick={() => openDetail(order)}
                    >
                      <TableCell className="whitespace-nowrap">
                        {new Date(order.orderDate).toLocaleDateString(
                          'en-US',
                          {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          },
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`gap-1 ${typeColors[order.type] || ''}`}
                        >
                          <TypeIcon className="h-3 w-3" />
                          {typeLabels[order.type] || order.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {order.description}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            order.priority === 'stat'
                              ? 'destructive'
                              : order.priority === 'urgent' ||
                                  order.priority === 'asap'
                                ? 'secondary'
                                : 'outline'
                          }
                          className="text-xs"
                        >
                          {order.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusColors[order.status] || ''}
                        >
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{order.orderingProvider}</TableCell>
                    </TableRow>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      {orders && orders.length > 0
                        ? 'No orders match the current filters.'
                        : 'No orders on file for this patient.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Order Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Order</DialogTitle>
            <DialogDescription>
              Place a new order for this patient.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Order Type</Label>
              <Select
                value={formData.type}
                onValueChange={(v) =>
                  setFormData((prev) => ({
                    ...prev,
                    type: v as Order['type'],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="medication">Medication</SelectItem>
                  <SelectItem value="laboratory">Laboratory</SelectItem>
                  <SelectItem value="imaging">Imaging</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="procedure">Procedure</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orderDescription">Description</Label>
              <Input
                id="orderDescription"
                placeholder={
                  formData.type === 'laboratory'
                    ? 'e.g., CBC with Differential'
                    : formData.type === 'imaging'
                      ? 'e.g., Chest X-Ray PA/Lateral'
                      : formData.type === 'referral'
                        ? 'e.g., Cardiology Consultation'
                        : 'Order description...'
                }
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(v) =>
                  setFormData((prev) => ({
                    ...prev,
                    priority: v as Order['priority'],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="asap">ASAP</SelectItem>
                  <SelectItem value="stat">STAT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orderNote">Clinical Notes</Label>
              <Textarea
                id="orderNote"
                placeholder="Additional instructions or clinical context..."
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
                !formData.description || createOrder.isPending
              }
            >
              {createOrder.isPending ? 'Submitting...' : 'Place Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Order Detail</DialogTitle>
            <DialogDescription>
              {selectedOrder?.description}
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <Badge
                  variant="outline"
                  className={typeColors[selectedOrder.type] || ''}
                >
                  {typeLabels[selectedOrder.type] || selectedOrder.type}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge
                  variant="outline"
                  className={statusColors[selectedOrder.status] || ''}
                >
                  {selectedOrder.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Priority</span>
                <Badge
                  variant={
                    selectedOrder.priority === 'stat'
                      ? 'destructive'
                      : 'outline'
                  }
                >
                  {selectedOrder.priority}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order Date</span>
                <span>
                  {new Date(selectedOrder.orderDate).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Ordering Provider
                </span>
                <span>{selectedOrder.orderingProvider}</span>
              </div>
              {selectedOrder.note && (
                <div className="rounded-lg border p-3">
                  <span className="font-medium">Notes: </span>
                  <span className="text-muted-foreground">
                    {selectedOrder.note}
                  </span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
