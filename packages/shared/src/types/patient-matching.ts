// =============================================================================
// Patient Matching & Identification Types
// SAFER Guide: Patient Identification
// =============================================================================

export interface SimilarPatient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  confidence: number;
  matchReasons: string[];
}

export interface PatientList {
  id: string;
  userId: string;
  name: string;
  description?: string;
  listType: string;
  isDefault: boolean;
  patientCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PatientListMember {
  id: string;
  listId: string;
  patientId: string;
  patientName?: string;
  patientMrn?: string;
  addedAt: string;
  addedBy?: string;
  notes?: string;
}

export interface TemporaryPatient {
  id: string;
  temporaryMrn: string;
  reason: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  sex?: string;
  active: boolean;
  createdAt: string;
}

export interface CreatePatientListDTO {
  name: string;
  description?: string;
  listType?: string;
}

export interface CreateTemporaryPatientDTO {
  reason: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  sex?: string;
}
