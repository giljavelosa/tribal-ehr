/**
 * DevicesTab - Implantable Device List (§170.315(a)(14))
 *
 * Displays UDI-compliant device records with parsed UDI components.
 * Supports adding new devices with UDI, manufacturer, model, serial, expiration.
 */

import React, { useState, useMemo } from 'react';
import { Plus, Cpu, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useDevices, useCreateDevice, type ImplantableDevice } from '@/hooks/use-api';

interface DevicesTabProps {
  patientId: string;
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  'entered-in-error': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const emptyForm: {
  udi: string;
  deviceType: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  lotNumber: string;
  expirationDate: string;
  status: 'active' | 'inactive';
} = {
  udi: '',
  deviceType: '',
  manufacturer: '',
  model: '',
  serialNumber: '',
  lotNumber: '',
  expirationDate: '',
  status: 'active',
};

export function DevicesTab({ patientId }: DevicesTabProps) {
  const { data: devices, isLoading, error } = useDevices(patientId);
  const createDevice = useCreateDevice();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const selectedDevice = useMemo(() => {
    if (!detailId || !devices) return null;
    return devices.find((d) => d.id === detailId) || null;
  }, [detailId, devices]);

  const handleSubmit = async () => {
    await createDevice.mutateAsync({
      patientId,
      data: {
        udi: formData.udi || undefined,
        deviceType: formData.deviceType,
        manufacturer: formData.manufacturer,
        model: formData.model || undefined,
        serialNumber: formData.serialNumber || undefined,
        lotNumber: formData.lotNumber || undefined,
        expirationDate: formData.expirationDate || undefined,
        status: formData.status,
      },
    });
    setDialogOpen(false);
    setFormData(emptyForm);
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive">
            Failed to load devices. Please try again later.
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
                <Cpu className="h-5 w-5" />
                Implantable Devices
              </CardTitle>
              <CardDescription>
                UDI-compliant implantable device list per §170.315(a)(14)
              </CardDescription>
            </div>
            <Button className="gap-1" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Device
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device Type</TableHead>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>UDI</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(devices || []).map((device) => {
                  const isExpired = device.expirationDate && new Date(device.expirationDate) < new Date();
                  return (
                    <TableRow
                      key={device.id}
                      className="cursor-pointer"
                      onClick={() => setDetailId(device.id)}
                    >
                      <TableCell className="font-medium">{device.deviceType}</TableCell>
                      <TableCell>{device.manufacturer}</TableCell>
                      <TableCell>{device.model || '--'}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {device.udi ? device.udi.substring(0, 20) + (device.udi.length > 20 ? '...' : '') : '--'}
                      </TableCell>
                      <TableCell>
                        <span className={isExpired ? 'flex items-center gap-1 text-destructive' : ''}>
                          {isExpired && <AlertTriangle className="h-3 w-3" />}
                          {device.expirationDate
                            ? new Date(device.expirationDate).toLocaleDateString('en-US')
                            : '--'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[device.status] || ''}>
                          {device.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!devices || devices.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No implantable devices on file.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Device Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Implantable Device</DialogTitle>
            <DialogDescription>
              Enter device information. UDI (Unique Device Identifier) can be
              scanned from the device barcode or entered manually.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="udi">UDI (Barcode / HRF)</Label>
              <Input
                id="udi"
                placeholder="Scan or enter UDI..."
                value={formData.udi}
                onChange={(e) => setFormData((p) => ({ ...p, udi: e.target.value }))}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deviceType">Device Type *</Label>
              <Input
                id="deviceType"
                placeholder="e.g., Cardiac Pacemaker"
                value={formData.deviceType}
                onChange={(e) => setFormData((p) => ({ ...p, deviceType: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="manufacturer">Manufacturer *</Label>
                <Input
                  id="manufacturer"
                  placeholder="e.g., Medtronic"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData((p) => ({ ...p, manufacturer: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  placeholder="Model number"
                  value={formData.model}
                  onChange={(e) => setFormData((p) => ({ ...p, model: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="serialNumber">Serial Number</Label>
                <Input
                  id="serialNumber"
                  placeholder="Serial number"
                  value={formData.serialNumber}
                  onChange={(e) => setFormData((p) => ({ ...p, serialNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lotNumber">Lot Number</Label>
                <Input
                  id="lotNumber"
                  placeholder="Lot number"
                  value={formData.lotNumber}
                  onChange={(e) => setFormData((p) => ({ ...p, lotNumber: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="expirationDate">Expiration Date</Label>
                <Input
                  id="expirationDate"
                  type="date"
                  value={formData.expirationDate}
                  onChange={(e) => setFormData((p) => ({ ...p, expirationDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData((p) => ({ ...p, status: v as 'active' | 'inactive' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.deviceType || !formData.manufacturer || createDevice.isPending}
            >
              {createDevice.isPending ? 'Adding...' : 'Add Device'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Device Detail Dialog */}
      <Dialog open={!!detailId} onOpenChange={(v) => !v && setDetailId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Device Detail</DialogTitle>
            <DialogDescription>{selectedDevice?.deviceType}</DialogDescription>
          </DialogHeader>
          {selectedDevice && (
            <div className="space-y-3 text-sm">
              {selectedDevice.udi && (
                <div>
                  <span className="font-medium">UDI: </span>
                  <span className="font-mono text-xs break-all">{selectedDevice.udi}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Device Type</span>
                <span>{selectedDevice.deviceType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Manufacturer</span>
                <span>{selectedDevice.manufacturer}</span>
              </div>
              {selectedDevice.model && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Model</span>
                  <span>{selectedDevice.model}</span>
                </div>
              )}
              {selectedDevice.serialNumber && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Serial Number</span>
                  <span>{selectedDevice.serialNumber}</span>
                </div>
              )}
              {selectedDevice.lotNumber && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lot Number</span>
                  <span>{selectedDevice.lotNumber}</span>
                </div>
              )}
              {selectedDevice.expirationDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expiration</span>
                  <span>{new Date(selectedDevice.expirationDate).toLocaleDateString('en-US')}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline" className={statusColors[selectedDevice.status] || ''}>
                  {selectedDevice.status}
                </Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
