import React, { useState, useMemo } from 'react';
import {
  Search,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  MapPin,
  User,
  Stethoscope,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useEncounters,
  type Encounter,
} from '@/hooks/use-api';

interface HistoryTabProps {
  patientId: string;
}

const statusColors: Record<string, string> = {
  planned:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  arrived:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  triaged:
    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  'in-progress':
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  onleave:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  finished:
    'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  cancelled:
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

type ViewMode = 'table' | 'timeline';

export function HistoryTab({ patientId }: HistoryTabProps) {
  const { data: encounters, isLoading, error } = useEncounters(patientId);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [expandedEncounterId, setExpandedEncounterId] = useState<string | null>(
    null,
  );

  const filteredEncounters = useMemo(() => {
    if (!encounters) return [];
    return encounters.filter((e) => {
      if (filterStatus !== 'all' && e.status !== filterStatus) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          e.type.toLowerCase().includes(query) ||
          (e.provider && e.provider.toLowerCase().includes(query)) ||
          (e.reasonCode && e.reasonCode.toLowerCase().includes(query)) ||
          (e.location && e.location.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [encounters, filterStatus, searchQuery]);

  const toggleExpanded = (encounterId: string) => {
    setExpandedEncounterId(
      expandedEncounterId === encounterId ? null : encounterId,
    );
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive">
            Failed to load encounter history. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Encounter History
            </CardTitle>
            <CardDescription>
              Past and current clinical encounters
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('table')}
            >
              Table
            </Button>
            <Button
              variant={viewMode === 'timeline' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('timeline')}
              className="gap-1"
            >
              <Clock className="h-3.5 w-3.5" />
              Timeline
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search encounters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="planned">Planned</SelectItem>
              <SelectItem value="arrived">Arrived</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="finished">Finished</SelectItem>
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
        ) : viewMode === 'table' ? (
          /* Table View */
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEncounters.map((encounter) => (
                <React.Fragment key={encounter.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => toggleExpanded(encounter.id)}
                  >
                    <TableCell>
                      {expandedEncounterId === encounter.id ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {new Date(encounter.period.start).toLocaleDateString(
                        'en-US',
                        {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        },
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {encounter.type}
                    </TableCell>
                    <TableCell>{encounter.provider || '--'}</TableCell>
                    <TableCell>{encounter.reasonCode || '--'}</TableCell>
                    <TableCell>{encounter.location || '--'}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusColors[encounter.status] || ''}
                      >
                        {encounter.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  {expandedEncounterId === encounter.id && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/30 p-0">
                        <div className="p-4">
                          <div className="grid gap-4 text-sm sm:grid-cols-2">
                            <div>
                              <h4 className="mb-1 font-semibold">
                                Encounter Details
                              </h4>
                              <div className="space-y-1 text-muted-foreground">
                                <p>
                                  <span className="font-medium text-foreground">
                                    Class:{' '}
                                  </span>
                                  {encounter.class}
                                </p>
                                <p>
                                  <span className="font-medium text-foreground">
                                    Start:{' '}
                                  </span>
                                  {new Date(
                                    encounter.period.start,
                                  ).toLocaleString('en-US')}
                                </p>
                                {encounter.period.end && (
                                  <p>
                                    <span className="font-medium text-foreground">
                                      End:{' '}
                                    </span>
                                    {new Date(
                                      encounter.period.end,
                                    ).toLocaleString('en-US')}
                                  </p>
                                )}
                                {encounter.provider && (
                                  <p>
                                    <span className="font-medium text-foreground">
                                      Provider:{' '}
                                    </span>
                                    {encounter.provider}
                                  </p>
                                )}
                                {encounter.location && (
                                  <p>
                                    <span className="font-medium text-foreground">
                                      Location:{' '}
                                    </span>
                                    {encounter.location}
                                  </p>
                                )}
                              </div>
                            </div>
                            {encounter.diagnosis &&
                              encounter.diagnosis.length > 0 && (
                                <div>
                                  <h4 className="mb-1 font-semibold">
                                    Diagnoses
                                  </h4>
                                  <div className="space-y-1">
                                    {encounter.diagnosis.map((dx, i) => (
                                      <Badge
                                        key={i}
                                        variant="outline"
                                        className="mr-1 text-xs"
                                      >
                                        {dx}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
              {filteredEncounters.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    {encounters && encounters.length > 0
                      ? 'No encounters match the current filters.'
                      : 'No encounter history on file.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        ) : (
          /* Timeline View */
          <div className="relative ml-4 space-y-0 border-l-2 border-border pl-6">
            {filteredEncounters.map((encounter) => {
              const isExpanded = expandedEncounterId === encounter.id;
              return (
                <div key={encounter.id} className="relative pb-6">
                  {/* Timeline dot */}
                  <div
                    className={`absolute -left-[31px] h-4 w-4 rounded-full border-2 bg-background ${
                      encounter.status === 'in-progress'
                        ? 'border-green-500'
                        : encounter.status === 'finished'
                          ? 'border-gray-400'
                          : encounter.status === 'cancelled'
                            ? 'border-red-400'
                            : 'border-blue-400'
                    }`}
                  />

                  <div
                    className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-accent/50"
                    onClick={() => toggleExpanded(encounter.id)}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {new Date(
                              encounter.period.start,
                            ).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <h4 className="mt-1 font-semibold">
                          {encounter.type}
                        </h4>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          {encounter.provider && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {encounter.provider}
                            </span>
                          )}
                          {encounter.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {encounter.location}
                            </span>
                          )}
                        </div>
                        {encounter.reasonCode && (
                          <p className="mt-1 text-sm">
                            Reason: {encounter.reasonCode}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={statusColors[encounter.status] || ''}
                      >
                        {encounter.status}
                      </Badge>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 border-t pt-3">
                        <div className="grid gap-3 text-sm sm:grid-cols-2">
                          <div className="space-y-1">
                            <p>
                              <span className="font-medium">Class: </span>
                              <span className="text-muted-foreground">
                                {encounter.class}
                              </span>
                            </p>
                            <p>
                              <span className="font-medium">Start: </span>
                              <span className="text-muted-foreground">
                                {new Date(
                                  encounter.period.start,
                                ).toLocaleString('en-US')}
                              </span>
                            </p>
                            {encounter.period.end && (
                              <p>
                                <span className="font-medium">End: </span>
                                <span className="text-muted-foreground">
                                  {new Date(
                                    encounter.period.end,
                                  ).toLocaleString('en-US')}
                                </span>
                              </p>
                            )}
                          </div>
                          {encounter.diagnosis &&
                            encounter.diagnosis.length > 0 && (
                              <div>
                                <p className="mb-1 font-medium">Diagnoses:</p>
                                <div className="flex flex-wrap gap-1">
                                  {encounter.diagnosis.map((dx, i) => (
                                    <Badge
                                      key={i}
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {dx}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredEncounters.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">
                {encounters && encounters.length > 0
                  ? 'No encounters match the current filters.'
                  : 'No encounter history on file.'}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
