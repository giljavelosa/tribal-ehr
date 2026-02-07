import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, User, X, Loader2 } from 'lucide-react';
import { Input } from './input';
import { usePatients, type Patient } from '@/hooks/use-api';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';

interface PatientSearchProps {
  value?: Patient | null;
  onSelect: (patient: Patient | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function PatientSearch({
  value,
  onSelect,
  placeholder = 'Search patient by name or MRN...',
  disabled = false,
  className,
}: PatientSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search - only search after user stops typing
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Fetch patients based on search term
  const { data: patients, isLoading } = usePatients(
    debouncedSearch.length >= 2 ? { name: debouncedSearch, limit: 10 } : undefined
  );

  const results = debouncedSearch.length >= 2 ? (patients?.data || []) : [];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => 
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && results[highlightedIndex]) {
          handleSelect(results[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  }, [isOpen, results, highlightedIndex]);

  const handleSelect = (patient: Patient) => {
    onSelect(patient);
    setSearchTerm('');
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleClear = () => {
    onSelect(null);
    setSearchTerm('');
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const formatPatientDisplay = (patient: Patient) => {
    const age = new Date().getFullYear() - new Date(patient.dob).getFullYear();
    return `${patient.lastName}, ${patient.firstName} (${patient.sex?.[0] || '?'}, ${age}y) • MRN: ${patient.mrn}`;
  };

  // If a patient is selected, show their info
  if (value) {
    return (
      <div className={cn('relative', className)} ref={containerRef}>
        <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
          <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="flex-1 text-sm truncate">
            {formatPatientDisplay(value)}
          </span>
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => searchTerm.length >= 2 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="pl-9 pr-9"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Dropdown results */}
      {isOpen && searchTerm.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No patients found for "{searchTerm}"
            </div>
          ) : (
            <ul className="max-h-64 overflow-auto py-1">
              {results.map((patient, index) => {
                const age = new Date().getFullYear() - new Date(patient.dob).getFullYear();
                return (
                  <li
                    key={patient.id}
                    onClick={() => handleSelect(patient)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                      highlightedIndex === index
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted'
                    )}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
                      <span className="text-sm font-medium">
                        {patient.firstName[0]}{patient.lastName[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {patient.lastName}, {patient.firstName}
                        {patient.middleName ? ` ${patient.middleName[0]}.` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {patient.sex || patient.gender} • {age}y • DOB: {new Date(patient.dob).toLocaleDateString()} • MRN: {patient.mrn}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Hint text */}
      {!isOpen && searchTerm.length > 0 && searchTerm.length < 2 && (
        <p className="mt-1 text-xs text-muted-foreground">
          Type at least 2 characters to search
        </p>
      )}
    </div>
  );
}
