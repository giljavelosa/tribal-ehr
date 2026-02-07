import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  usePatients,
  type PatientSearchParams,
} from '@/hooks/use-api';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export function PatientListPage() {
  const navigate = useNavigate();

  const [nameSearch, setNameSearch] = useState('');
  const [mrnSearch, setMrnSearch] = useState('');
  const [dobSearch, setDobSearch] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);

  const searchParams: PatientSearchParams = useMemo(() => {
    const params: PatientSearchParams = {
      page,
      limit: pageSize,
    };
    if (nameSearch.trim()) params.name = nameSearch.trim();
    if (mrnSearch.trim()) params.mrn = mrnSearch.trim();
    if (dobSearch) params.dob = dobSearch;
    if (phoneSearch.trim()) params.phone = phoneSearch.trim();
    return params;
  }, [nameSearch, mrnSearch, dobSearch, phoneSearch, page, pageSize]);

  const { data, isLoading, error } = usePatients(searchParams);

  const patients = data?.data || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;

  const handleSearch = useCallback(() => {
    setPage(1);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSearch();
      }
    },
    [handleSearch],
  );

  const handleClearFilters = useCallback(() => {
    setNameSearch('');
    setMrnSearch('');
    setDobSearch('');
    setPhoneSearch('');
    setPage(1);
  }, []);

  const hasActiveFilters =
    nameSearch || mrnSearch || dobSearch || phoneSearch;

  const statusColors: Record<string, string> = {
    active:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    inactive:
      'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    deceased:
      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Patients</h1>
          <p className="text-muted-foreground">
            Search and manage patient records
          </p>
        </div>
        <Button onClick={() => navigate('/patients/new')} className="gap-1">
          <Plus className="h-4 w-4" />
          New Patient
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Patient Directory
          </CardTitle>
          <CardDescription>
            Search by name, MRN, date of birth, or phone number
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Primary search */}
          <div className="mb-4 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="relative min-w-[250px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by patient name..."
                  value={nameSearch}
                  onChange={(e) => {
                    setNameSearch(e.target.value);
                    setPage(1);
                  }}
                  onKeyDown={handleKeyDown}
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
              >
                {showAdvancedSearch ? 'Simple Search' : 'Advanced Search'}
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" onClick={handleClearFilters}>
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Advanced search fields */}
            {showAdvancedSearch && (
              <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="mrnSearch" className="text-xs">
                    MRN
                  </Label>
                  <Input
                    id="mrnSearch"
                    placeholder="MRN-XXXXXX"
                    value={mrnSearch}
                    onChange={(e) => {
                      setMrnSearch(e.target.value);
                      setPage(1);
                    }}
                    onKeyDown={handleKeyDown}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dobSearch" className="text-xs">
                    Date of Birth
                  </Label>
                  <Input
                    id="dobSearch"
                    type="date"
                    value={dobSearch}
                    onChange={(e) => {
                      setDobSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phoneSearch" className="text-xs">
                    Phone Number
                  </Label>
                  <Input
                    id="phoneSearch"
                    placeholder="(555) 123-4567"
                    value={phoneSearch}
                    onChange={(e) => {
                      setPhoneSearch(e.target.value);
                      setPage(1);
                    }}
                    onKeyDown={handleKeyDown}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Error State */}
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
              Failed to load patients. Please try again.
            </div>
          )}

          {/* Loading State */}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded bg-muted"
                />
              ))}
            </div>
          ) : (
            <>
              {/* Results Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>MRN</TableHead>
                    <TableHead>Date of Birth</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Last Visit</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patients.map((patient) => (
                    <TableRow
                      key={patient.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/patients/${patient.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {patient.firstName?.[0]}
                              {patient.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {patient.lastName}, {patient.firstName}
                            {patient.middleName
                              ? ` ${patient.middleName[0]}.`
                              : ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {patient.mrn}
                      </TableCell>
                      <TableCell>
                        {new Date(patient.dob).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="capitalize">
                        {patient.gender}
                      </TableCell>
                      <TableCell>{patient.phone || '--'}</TableCell>
                      <TableCell>
                        {patient.lastVisit
                          ? new Date(patient.lastVisit).toLocaleDateString(
                              'en-US',
                              {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              },
                            )
                          : '--'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusColors[patient.status] || ''}
                        >
                          {patient.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {patients.length === 0 && !isLoading && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        <div className="space-y-1">
                          <p className="font-medium">No patients found</p>
                          <p className="text-sm text-muted-foreground">
                            {hasActiveFilters
                              ? 'Try adjusting your search criteria.'
                              : 'Register a new patient to get started.'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {total > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      Showing {(page - 1) * pageSize + 1}
                      {' - '}
                      {Math.min(page * pageSize, total)} of {total} patients
                    </span>
                    <span className="text-muted-foreground">|</span>
                    <div className="flex items-center gap-1">
                      <span>Rows:</span>
                      <Select
                        value={pageSize.toString()}
                        onValueChange={(v) => {
                          setPageSize(Number(v));
                          setPage(1);
                        }}
                      >
                        <SelectTrigger className="h-8 w-[70px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAGE_SIZE_OPTIONS.map((size) => (
                            <SelectItem key={size} value={size.toString()}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={page <= 1}
                      onClick={() => setPage(1)}
                      title="First page"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      title="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-3 text-sm">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={page >= totalPages}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      title="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={page >= totalPages}
                      onClick={() => setPage(totalPages)}
                      title="Last page"
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
