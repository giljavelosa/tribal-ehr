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

interface OrderItem {
  id?: string;
  name?: string;
  type?: string;
}

interface OrderSet {
  id: string;
  name: string;
  category: string;
  description: string;
  orders: OrderItem[];
  approved: boolean;
  version: number;
}

const mockOrderSets: OrderSet[] = [
  {
    id: '1',
    name: 'Admission Orders - General',
    category: 'General',
    description: 'Standard admission order set including vitals, diet, activity level, and nursing assessments',
    orders: [
      { id: 'o1', name: 'Vital Signs q4h', type: 'Nursing' },
      { id: 'o2', name: 'Regular Diet', type: 'Diet' },
      { id: 'o3', name: 'Activity as Tolerated', type: 'Activity' },
    ],
    approved: true,
    version: 1,
  },
  {
    id: '2',
    name: 'Diabetic Management',
    category: 'Medications',
    description: 'Insulin and monitoring orders for diabetes management including sliding scale and A1c monitoring',
    orders: [
      { id: 'o4', name: 'Insulin Glargine 10U SC QHS', type: 'Medication' },
      { id: 'o5', name: 'Insulin Lispro Sliding Scale', type: 'Medication' },
      { id: 'o6', name: 'Blood Glucose AC & HS', type: 'Laboratory' },
      { id: 'o7', name: 'HbA1c', type: 'Laboratory' },
    ],
    approved: true,
    version: 2,
  },
  {
    id: '3',
    name: 'Pre-Op Labs',
    category: 'Laboratory',
    description: 'Standard pre-operative laboratory panel including CBC, BMP, coagulation studies',
    orders: [
      { id: 'o8', name: 'CBC with Differential', type: 'Laboratory' },
      { id: 'o9', name: 'Basic Metabolic Panel', type: 'Laboratory' },
    ],
    approved: false,
    version: 1,
  },
  {
    id: '4',
    name: 'Chest Pain Workup',
    category: 'Laboratory',
    description: 'Cardiac biomarkers and imaging for chest pain evaluation',
    orders: [
      { id: 'o10', name: 'Troponin I (serial)', type: 'Laboratory' },
      { id: 'o11', name: 'BNP', type: 'Laboratory' },
      { id: 'o12', name: 'Chest X-Ray PA/Lateral', type: 'Imaging' },
    ],
    approved: true,
    version: 3,
  },
  {
    id: '5',
    name: 'CT Abdomen/Pelvis Protocol',
    category: 'Imaging',
    description: 'Standard CT abdomen and pelvis with contrast protocol and prep orders',
    orders: [
      { id: 'o13', name: 'CT Abdomen/Pelvis with Contrast', type: 'Imaging' },
      { id: 'o14', name: 'BUN/Creatinine (pre-contrast)', type: 'Laboratory' },
    ],
    approved: true,
    version: 1,
  },
  {
    id: '6',
    name: 'Pain Management - Post-Op',
    category: 'Medications',
    description: 'Multimodal pain management for post-operative patients',
    orders: [
      { id: 'o15', name: 'Acetaminophen 1000mg PO q6h', type: 'Medication' },
      { id: 'o16', name: 'Ketorolac 15mg IV q6h x 48h', type: 'Medication' },
      { id: 'o17', name: 'Hydromorphone 0.5mg IV PRN', type: 'Medication' },
    ],
    approved: true,
    version: 2,
  },
];

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

  const filteredSets = useMemo(() => {
    let result = mockOrderSets;
    if (categoryFilter !== 'All') {
      result = result.filter((s) => s.category === categoryFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q),
      );
    }
    return result;
  }, [categoryFilter, searchQuery]);

  const handleToggleExpand = (id: string) => {
    setExpandedSetId((prev) => (prev === id ? null : id));
  };

  const handleApplyToPatient = (setId: string) => {
    setApplyingSetId(setId);
    setPatientId('');
    setApplyDialogOpen(true);
  };

  const handleConfirmApply = () => {
    if (!patientId.trim()) return;
    // In production, this would POST to the API
    setApplyDialogOpen(false);
    setApplyingSetId(null);
    setPatientId('');
  };

  const handleCreateOrderSet = () => {
    if (!newSetForm.name.trim() || !newSetForm.description.trim()) return;
    // In production, this would POST to the API
    setCreateDialogOpen(false);
    setNewSetForm({ name: '', category: 'General', description: '' });
  };

  const applyingSet = mockOrderSets.find((s) => s.id === applyingSetId);

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
                        {orderSet.description}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <Badge
                      variant="outline"
                      className={categoryColors[orderSet.category] || ''}
                    >
                      {orderSet.category}
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
                      {orderSet.orders.length} order{orderSet.orders.length !== 1 ? 's' : ''}
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
                          {orderSet.orders.map((order, index) => (
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
                          {orderSet.orders.length === 0 && (
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
                ? `Apply "${applyingSet.name}" (${applyingSet.orders.length} orders) to a patient.`
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
                  {applyingSet.orders.map((order, index) => (
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
            <Button onClick={handleConfirmApply} disabled={!patientId.trim()}>
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
              disabled={!newSetForm.name.trim() || !newSetForm.description.trim()}
            >
              Create Order Set
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
