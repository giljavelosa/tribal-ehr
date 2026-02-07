import React, { useState, useMemo } from 'react';
import {
  Package,
  Search,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Plus,
  Send,
  Loader2,
  AlertCircle,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { toast } from '@/components/ui/toast';
import {
  useOrderSets,
  useCreateOrderSet,
  useApplyOrderSet,
  type OrderSetItem,
} from '@/hooks/use-api';

interface OrderItem {
  id?: string;
  name?: string;
  type?: string;
}

const categories = ['All', 'General', 'Medications', 'Laboratory', 'Imaging'];

const categoryColors: Record<string, string> = {
  General: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
  Medications: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  Laboratory: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  Imaging: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
};

export function OrderSetsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyingSetId, setApplyingSetId] = useState<string | null>(null);
  const [patientId, setPatientId] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newSetForm, setNewSetForm] = useState({
    name: '',
    category: 'General',
    description: '',
  });

  // Simulated admin role
  const isAdmin = true;

  const { data: orderSets, isLoading, error } = useOrderSets();
  const createOrderSetMutation = useCreateOrderSet();
  const applyOrderSetMutation = useApplyOrderSet();

  const filteredSets = useMemo(() => {
    let result = orderSets || [];
    if (categoryFilter !== 'All') {
      result = result.filter((s) => s.category === categoryFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.description || '').toLowerCase().includes(q) ||
          (s.category || '').toLowerCase().includes(q),
      );
    }
    return result;
  }, [orderSets, categoryFilter, searchQuery]);

  const handleToggleExpand = (id: string) => {
    setExpandedSetId((prev) => (prev === id ? null : id));
  };

  const handleApplyToPatient = (setId: string) => {
    setApplyingSetId(setId);
    setPatientId('');
    setApplyDialogOpen(true);
  };

  const handleConfirmApply = () => {
    if (!patientId.trim() || !applyingSetId) return;
    applyOrderSetMutation.mutate(
      {
        orderSetId: applyingSetId,
        patientId: patientId.trim(),
      },
      {
        onSuccess: (result) => {
          toast({
            title: 'Order set applied',
            description: `${result.ordersCreated} orders created successfully.`,
          });
          setApplyDialogOpen(false);
          setApplyingSetId(null);
          setPatientId('');
        },
        onError: (err: Error) => {
          toast({
            title: 'Failed to apply order set',
            description: err.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  const handleCreateOrderSet = () => {
    if (!newSetForm.name.trim() || !newSetForm.description.trim()) return;
    createOrderSetMutation.mutate(
      {
        name: newSetForm.name.trim(),
        category: newSetForm.category,
        description: newSetForm.description.trim(),
        orders: [],
      },
      {
        onSuccess: () => {
          toast({ title: 'Order set created successfully' });
          setCreateDialogOpen(false);
          setNewSetForm({ name: '', category: 'General', description: '' });
        },
        onError: (err: Error) => {
          toast({
            title: 'Failed to create order set',
            description: err.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  const applyingSet = (orderSets || []).find((s) => s.id === applyingSetId);

  const getOrderItems = (orderSet: OrderSetItem): OrderItem[] => {
    if (!Array.isArray(orderSet.orders)) return [];
    return orderSet.orders as OrderItem[];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading order sets...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-destructive">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p className="font-medium">Failed to load order sets</p>
        <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Order Sets</h1>
          <p className="text-muted-foreground">
            Browse and apply pre-configured order sets
          </p>
        </div>
        {isAdmin && (
          <Button className="gap-1" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Create Order Set
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[250px] flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search order sets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-48">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat === 'All' ? 'All Categories' : cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Order Sets Grid */}
      {filteredSets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Package className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No order sets match your search criteria.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredSets.map((orderSet) => {
            const isExpanded = expandedSetId === orderSet.id;
            const orderItems = getOrderItems(orderSet);

            return (
              <Card
                key={orderSet.id}
                className={`transition-shadow hover:shadow-md ${isExpanded ? 'md:col-span-2 xl:col-span-3' : ''}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <ClipboardList className="h-4 w-4 shrink-0" />
                        {orderSet.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {orderSet.description || 'No description'}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <Badge
                      variant="outline"
                      className={categoryColors[orderSet.category || ''] || ''}
                    >
                      {orderSet.category || 'General'}
                    </Badge>
                    {orderSet.approved ? (
                      <Badge className="gap-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircle2 className="h-3 w-3" />
                        Approved
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-amber-600">
                        <Clock className="h-3 w-3" />
                        Pending Approval
                      </Badge>
                    )}
                    <Badge variant="secondary">
                      {orderItems.length} order{orderItems.length !== 1 ? 's' : ''}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      v{orderSet.version}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1"
                      onClick={() => handleToggleExpand(orderSet.id)}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" />
                          Hide Orders
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" />
                          View Orders
                        </>
                      )}
                    </Button>
                    {orderSet.approved && (
                      <Button
                        size="sm"
                        className="gap-1"
                        onClick={() => handleApplyToPatient(orderSet.id)}
                      >
                        <Send className="h-3.5 w-3.5" />
                        Apply to Patient
                      </Button>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order Name</TableHead>
                            <TableHead>Type</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orderItems.map((order, index) => (
                            <TableRow key={order.id || index}>
                              <TableCell className="font-medium">
                                {order.name || `Order ${index + 1}`}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {order.type || 'General'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                          {orderItems.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={2} className="text-center text-muted-foreground">
                                No orders defined in this set.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Apply to Patient Dialog */}
      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Order Set to Patient</DialogTitle>
            <DialogDescription>
              {applyingSet
                ? `Apply "${applyingSet.name}" (${getOrderItems(applyingSet).length} orders) to a patient.`
                : 'Select a patient to apply this order set.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="patientIdInput">Patient ID</Label>
              <Input
                id="patientIdInput"
                placeholder="Enter patient ID or MRN..."
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
              />
            </div>
            {applyingSet && (
              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium">Orders to be applied:</p>
                <ul className="mt-2 space-y-1">
                  {getOrderItems(applyingSet).map((order, index) => (
                    <li key={order.id || index} className="text-sm text-muted-foreground">
                      {order.name || `Order ${index + 1}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmApply}
              disabled={!patientId.trim() || applyOrderSetMutation.isPending}
            >
              {applyOrderSetMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Apply Orders
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Order Set Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Order Set</DialogTitle>
            <DialogDescription>
              Define a new order set template for clinical use.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="newSetName">Order Set Name</Label>
              <Input
                id="newSetName"
                placeholder="e.g., Sepsis Bundle"
                value={newSetForm.name}
                onChange={(e) =>
                  setNewSetForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={newSetForm.category}
                onValueChange={(v) =>
                  setNewSetForm((prev) => ({ ...prev, category: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter((c) => c !== 'All')
                    .map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newSetDesc">Description</Label>
              <Input
                id="newSetDesc"
                placeholder="Brief description of the order set..."
                value={newSetForm.description}
                onChange={(e) =>
                  setNewSetForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateOrderSet}
              disabled={
                !newSetForm.name.trim() ||
                !newSetForm.description.trim() ||
                createOrderSetMutation.isPending
              }
            >
              {createOrderSetMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Order Set
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
