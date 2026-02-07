import React, { useState, useMemo, useCallback } from 'react';
import {
  Plus,
  Activity,
  Heart,
  Wind,
  Thermometer,
  Droplets,
  Ruler,
  Weight,
  TrendingUp,
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
import { Switch } from '@/components/ui/switch';
import { useVitals, useCreateVitals, type VitalSigns } from '@/hooks/use-api';

interface VitalsTabProps {
  patientId: string;
}

interface VitalRange {
  low?: number;
  high?: number;
  critLow?: number;
  critHigh?: number;
}

const ranges: Record<string, VitalRange> = {
  systolicBP: { low: 90, high: 140, critLow: 80, critHigh: 180 },
  diastolicBP: { low: 60, high: 90, critLow: 50, critHigh: 120 },
  heartRate: { low: 60, high: 100, critLow: 40, critHigh: 150 },
  respiratoryRate: { low: 12, high: 20, critLow: 8, critHigh: 30 },
  temperatureF: { low: 97.0, high: 99.5, critLow: 95.0, critHigh: 103.0 },
  spO2: { low: 95, high: 100, critLow: 90, critHigh: 100 },
};

function getVitalStatus(
  value: number | undefined | null,
  rangeKey: string,
): 'normal' | 'warning' | 'critical' | 'unknown' {
  if (value == null) return 'unknown';
  const range = ranges[rangeKey];
  if (!range) return 'unknown';
  if (
    (range.critLow != null && value < range.critLow) ||
    (range.critHigh != null && value > range.critHigh)
  )
    return 'critical';
  if (
    (range.low != null && value < range.low) ||
    (range.high != null && value > range.high)
  )
    return 'warning';
  return 'normal';
}

function statusColorClass(status: string): string {
  if (status === 'critical') return 'border-destructive bg-destructive/10 text-destructive';
  if (status === 'warning') return 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200';
  return '';
}

function VitalCard({
  icon: Icon,
  label,
  value,
  unit,
  status,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  unit: string;
  status: string;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${statusColorClass(status)}`}
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-bold">{value}</span>
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
      {status !== 'normal' && status !== 'unknown' && (
        <Badge
          variant={status === 'critical' ? 'destructive' : 'outline'}
          className="mt-1 text-xs"
        >
          {status === 'critical' ? 'Critical' : 'Abnormal'}
        </Badge>
      )}
    </div>
  );
}

export function VitalsTab({ patientId }: VitalsTabProps) {
  const { data: vitals, isLoading, error } = useVitals(patientId);
  const createVitals = useCreateVitals();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [showTrending, setShowTrending] = useState(false);
  const [tempUnit, setTempUnit] = useState<'F' | 'C'>('F');
  const [heightUnit, setHeightUnit] = useState<'in' | 'cm'>('in');
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs');

  const [formData, setFormData] = useState({
    systolicBP: '',
    diastolicBP: '',
    heartRate: '',
    respiratoryRate: '',
    temperature: '',
    spO2: '',
    heightFt: '',
    heightIn: '',
    heightCm: '',
    weight: '',
    position: 'sitting',
  });

  const latest = vitals && vitals.length > 0 ? vitals[0] : null;

  const bmiCalc = useCallback(
    (heightVal: number, weightVal: number, hUnit: string, wUnit: string) => {
      let heightInMeters: number;
      let weightInKg: number;

      if (hUnit === 'in') {
        heightInMeters = heightVal * 0.0254;
      } else {
        heightInMeters = heightVal / 100;
      }

      if (wUnit === 'lbs') {
        weightInKg = weightVal * 0.453592;
      } else {
        weightInKg = weightVal;
      }

      if (heightInMeters <= 0) return 0;
      return Math.round((weightInKg / (heightInMeters * heightInMeters)) * 10) / 10;
    },
    [],
  );

  const calculatedBMI = useMemo(() => {
    const w = parseFloat(formData.weight);
    let h: number;
    if (heightUnit === 'in') {
      const ft = parseFloat(formData.heightFt) || 0;
      const inches = parseFloat(formData.heightIn) || 0;
      h = ft * 12 + inches;
    } else {
      h = parseFloat(formData.heightCm) || 0;
    }
    if (!w || !h) return null;
    return bmiCalc(h, w, heightUnit, weightUnit);
  }, [formData, heightUnit, weightUnit, bmiCalc]);

  const handleSubmit = async () => {
    let heightValue: number | undefined;
    if (heightUnit === 'in') {
      const ft = parseFloat(formData.heightFt) || 0;
      const inches = parseFloat(formData.heightIn) || 0;
      const total = ft * 12 + inches;
      if (total > 0) heightValue = total;
    } else {
      const cm = parseFloat(formData.heightCm);
      if (cm > 0) heightValue = cm;
    }

    const data: Partial<VitalSigns> = {
      date: new Date().toISOString(),
      systolicBP: formData.systolicBP ? parseInt(formData.systolicBP) : undefined,
      diastolicBP: formData.diastolicBP ? parseInt(formData.diastolicBP) : undefined,
      heartRate: formData.heartRate ? parseInt(formData.heartRate) : undefined,
      respiratoryRate: formData.respiratoryRate
        ? parseInt(formData.respiratoryRate)
        : undefined,
      temperature: formData.temperature
        ? parseFloat(formData.temperature)
        : undefined,
      temperatureUnit: tempUnit,
      spO2: formData.spO2 ? parseFloat(formData.spO2) : undefined,
      height: heightValue,
      heightUnit,
      weight: formData.weight ? parseFloat(formData.weight) : undefined,
      weightUnit,
      bmi: calculatedBMI || undefined,
      position: formData.position,
    };

    await createVitals.mutateAsync({ patientId, data });
    setDialogOpen(false);
    setFormData({
      systolicBP: '',
      diastolicBP: '',
      heartRate: '',
      respiratoryRate: '',
      temperature: '',
      spO2: '',
      heightFt: '',
      heightIn: '',
      heightCm: '',
      weight: '',
      position: 'sitting',
    });
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive">
            Failed to load vitals. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current Vitals Cards */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Vital Signs</CardTitle>
              <CardDescription>
                {latest
                  ? `Last recorded: ${new Date(latest.date).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}`
                  : 'No vitals recorded'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="gap-1"
                onClick={() => setShowTrending(!showTrending)}
              >
                <TrendingUp className="h-4 w-4" />
                {showTrending ? 'Hide Trend' : 'Show Trend'}
              </Button>
              <Button className="gap-1" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Record Vitals
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-lg bg-muted"
                />
              ))}
            </div>
          ) : !latest ? (
            <div className="py-8 text-center text-muted-foreground">
              <Activity className="mx-auto mb-3 h-10 w-10" />
              <p className="font-medium">No vital signs recorded</p>
              <p className="text-sm">
                Click "Record Vitals" to add the first set of vital signs.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              {latest.systolicBP != null && latest.diastolicBP != null && (
                <VitalCard
                  icon={Activity}
                  label="Blood Pressure"
                  value={`${latest.systolicBP}/${latest.diastolicBP}`}
                  unit="mmHg"
                  status={
                    getVitalStatus(latest.systolicBP, 'systolicBP') === 'critical' ||
                    getVitalStatus(latest.diastolicBP, 'diastolicBP') === 'critical'
                      ? 'critical'
                      : getVitalStatus(latest.systolicBP, 'systolicBP') === 'warning' ||
                          getVitalStatus(latest.diastolicBP, 'diastolicBP') === 'warning'
                        ? 'warning'
                        : 'normal'
                  }
                />
              )}
              {latest.heartRate != null && (
                <VitalCard
                  icon={Heart}
                  label="Heart Rate"
                  value={String(latest.heartRate)}
                  unit="bpm"
                  status={getVitalStatus(latest.heartRate, 'heartRate')}
                />
              )}
              {latest.respiratoryRate != null && (
                <VitalCard
                  icon={Wind}
                  label="Respiratory Rate"
                  value={String(latest.respiratoryRate)}
                  unit="/min"
                  status={getVitalStatus(
                    latest.respiratoryRate,
                    'respiratoryRate',
                  )}
                />
              )}
              {latest.temperature != null && (
                <VitalCard
                  icon={Thermometer}
                  label="Temperature"
                  value={String(latest.temperature)}
                  unit={`\u00B0${latest.temperatureUnit || 'F'}`}
                  status={getVitalStatus(latest.temperature, 'temperatureF')}
                />
              )}
              {latest.spO2 != null && (
                <VitalCard
                  icon={Droplets}
                  label="SpO2"
                  value={String(latest.spO2)}
                  unit="%"
                  status={getVitalStatus(latest.spO2, 'spO2')}
                />
              )}
              {latest.height != null && (
                <VitalCard
                  icon={Ruler}
                  label="Height"
                  value={
                    latest.heightUnit === 'cm'
                      ? String(latest.height)
                      : `${Math.floor(latest.height / 12)}'${latest.height % 12}"`
                  }
                  unit={latest.heightUnit === 'cm' ? 'cm' : ''}
                  status="normal"
                />
              )}
              {latest.weight != null && (
                <VitalCard
                  icon={Weight}
                  label="Weight"
                  value={String(latest.weight)}
                  unit={latest.weightUnit || 'lbs'}
                  status="normal"
                />
              )}
              {latest.bmi != null && (
                <VitalCard
                  icon={TrendingUp}
                  label="BMI"
                  value={String(latest.bmi)}
                  unit="kg/m2"
                  status={
                    latest.bmi >= 30
                      ? 'warning'
                      : latest.bmi >= 40
                        ? 'critical'
                        : 'normal'
                  }
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trending / History Table */}
      {showTrending && vitals && vitals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vitals Trend</CardTitle>
            <CardDescription>
              Historical vital sign recordings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>BP</TableHead>
                    <TableHead>HR</TableHead>
                    <TableHead>RR</TableHead>
                    <TableHead>Temp</TableHead>
                    <TableHead>SpO2</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>BMI</TableHead>
                    <TableHead>Recorder</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vitals.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(v.date).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        {v.systolicBP != null && v.diastolicBP != null ? (
                          <span
                            className={
                              getVitalStatus(v.systolicBP, 'systolicBP') ===
                                'critical' ||
                              getVitalStatus(v.diastolicBP, 'diastolicBP') ===
                                'critical'
                                ? 'font-bold text-destructive'
                                : getVitalStatus(v.systolicBP, 'systolicBP') ===
                                      'warning' ||
                                    getVitalStatus(
                                      v.diastolicBP,
                                      'diastolicBP',
                                    ) === 'warning'
                                  ? 'font-medium text-amber-700 dark:text-amber-400'
                                  : ''
                            }
                          >
                            {v.systolicBP}/{v.diastolicBP}
                          </span>
                        ) : (
                          '--'
                        )}
                      </TableCell>
                      <TableCell>
                        {v.heartRate != null ? (
                          <span
                            className={
                              getVitalStatus(v.heartRate, 'heartRate') ===
                              'critical'
                                ? 'font-bold text-destructive'
                                : getVitalStatus(v.heartRate, 'heartRate') ===
                                    'warning'
                                  ? 'font-medium text-amber-700 dark:text-amber-400'
                                  : ''
                            }
                          >
                            {v.heartRate}
                          </span>
                        ) : (
                          '--'
                        )}
                      </TableCell>
                      <TableCell>
                        {v.respiratoryRate != null ? v.respiratoryRate : '--'}
                      </TableCell>
                      <TableCell>
                        {v.temperature != null
                          ? `${v.temperature} ${v.temperatureUnit || 'F'}`
                          : '--'}
                      </TableCell>
                      <TableCell>
                        {v.spO2 != null ? (
                          <span
                            className={
                              getVitalStatus(v.spO2, 'spO2') === 'critical'
                                ? 'font-bold text-destructive'
                                : getVitalStatus(v.spO2, 'spO2') === 'warning'
                                  ? 'font-medium text-amber-700 dark:text-amber-400'
                                  : ''
                            }
                          >
                            {v.spO2}%
                          </span>
                        ) : (
                          '--'
                        )}
                      </TableCell>
                      <TableCell>
                        {v.weight != null
                          ? `${v.weight} ${v.weightUnit || 'lbs'}`
                          : '--'}
                      </TableCell>
                      <TableCell>{v.bmi ?? '--'}</TableCell>
                      <TableCell>{v.recorder || '--'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historical vitals table when trending is off */}
      {!showTrending && vitals && vitals.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">History</CardTitle>
            <CardDescription>
              Previous {Math.min(vitals.length - 1, 10)} recordings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>BP</TableHead>
                  <TableHead>HR</TableHead>
                  <TableHead>Temp</TableHead>
                  <TableHead>SpO2</TableHead>
                  <TableHead>Weight</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vitals.slice(1, 11).map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(v.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      {v.systolicBP != null && v.diastolicBP != null
                        ? `${v.systolicBP}/${v.diastolicBP}`
                        : '--'}
                    </TableCell>
                    <TableCell>{v.heartRate ?? '--'}</TableCell>
                    <TableCell>
                      {v.temperature != null
                        ? `${v.temperature}${v.temperatureUnit || 'F'}`
                        : '--'}
                    </TableCell>
                    <TableCell>
                      {v.spO2 != null ? `${v.spO2}%` : '--'}
                    </TableCell>
                    <TableCell>
                      {v.weight != null
                        ? `${v.weight} ${v.weightUnit || 'lbs'}`
                        : '--'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Record Vitals Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Vital Signs</DialogTitle>
            <DialogDescription>
              Enter the patient's current vital sign measurements.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Blood Pressure */}
            <div className="space-y-2">
              <Label>Blood Pressure</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Systolic"
                  value={formData.systolicBP}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      systolicBP: e.target.value,
                    }))
                  }
                />
                <span className="text-muted-foreground">/</span>
                <Input
                  type="number"
                  placeholder="Diastolic"
                  value={formData.diastolicBP}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      diastolicBP: e.target.value,
                    }))
                  }
                />
                <span className="text-sm text-muted-foreground">mmHg</span>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Position</Label>
                <Select
                  value={formData.position}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, position: v }))
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sitting">Sitting</SelectItem>
                    <SelectItem value="standing">Standing</SelectItem>
                    <SelectItem value="supine">Supine</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hr">Heart Rate</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="hr"
                    type="number"
                    placeholder="e.g., 76"
                    value={formData.heartRate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        heartRate: e.target.value,
                      }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">bpm</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rr">Respiratory Rate</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="rr"
                    type="number"
                    placeholder="e.g., 16"
                    value={formData.respiratoryRate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        respiratoryRate: e.target.value,
                      }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">/min</span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="temp">Temperature</Label>
                  <div className="flex items-center gap-1 text-xs">
                    <span className={tempUnit === 'F' ? 'font-bold' : 'text-muted-foreground'}>F</span>
                    <Switch
                      checked={tempUnit === 'C'}
                      onCheckedChange={(checked) =>
                        setTempUnit(checked ? 'C' : 'F')
                      }
                      className="h-4 w-7"
                    />
                    <span className={tempUnit === 'C' ? 'font-bold' : 'text-muted-foreground'}>C</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id="temp"
                    type="number"
                    step="0.1"
                    placeholder={tempUnit === 'F' ? '98.6' : '37.0'}
                    value={formData.temperature}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        temperature: e.target.value,
                      }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {'\u00B0'}{tempUnit}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="spo2">SpO2</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="spo2"
                    type="number"
                    placeholder="e.g., 98"
                    value={formData.spO2}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        spO2: e.target.value,
                      }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            </div>

            {/* Height */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Height</Label>
                <div className="flex items-center gap-1 text-xs">
                  <span className={heightUnit === 'in' ? 'font-bold' : 'text-muted-foreground'}>ft/in</span>
                  <Switch
                    checked={heightUnit === 'cm'}
                    onCheckedChange={(checked) =>
                      setHeightUnit(checked ? 'cm' : 'in')
                    }
                    className="h-4 w-7"
                  />
                  <span className={heightUnit === 'cm' ? 'font-bold' : 'text-muted-foreground'}>cm</span>
                </div>
              </div>
              {heightUnit === 'in' ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Feet"
                    value={formData.heightFt}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        heightFt: e.target.value,
                      }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">ft</span>
                  <Input
                    type="number"
                    placeholder="Inches"
                    value={formData.heightIn}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        heightIn: e.target.value,
                      }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">in</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="e.g., 175"
                    value={formData.heightCm}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        heightCm: e.target.value,
                      }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">cm</span>
                </div>
              )}
            </div>

            {/* Weight + BMI */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Weight</Label>
                  <div className="flex items-center gap-1 text-xs">
                    <span className={weightUnit === 'lbs' ? 'font-bold' : 'text-muted-foreground'}>lbs</span>
                    <Switch
                      checked={weightUnit === 'kg'}
                      onCheckedChange={(checked) =>
                        setWeightUnit(checked ? 'kg' : 'lbs')
                      }
                      className="h-4 w-7"
                    />
                    <span className={weightUnit === 'kg' ? 'font-bold' : 'text-muted-foreground'}>kg</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder={weightUnit === 'lbs' ? 'e.g., 185' : 'e.g., 84'}
                    value={formData.weight}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        weight: e.target.value,
                      }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {weightUnit}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>BMI (auto-calculated)</Label>
                <div className="flex h-10 items-center rounded-md border px-3 text-sm">
                  {calculatedBMI ? (
                    <span className="font-medium">{calculatedBMI} kg/m2</span>
                  ) : (
                    <span className="text-muted-foreground">
                      Enter height & weight
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createVitals.isPending}
            >
              {createVitals.isPending ? 'Recording...' : 'Record Vitals'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
