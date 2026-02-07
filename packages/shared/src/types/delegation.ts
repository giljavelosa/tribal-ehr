// =============================================================================
// Clinician Delegation Types
// SAFER Guide: Clinician Communication
// =============================================================================

export type DelegationType = 'messages' | 'results' | 'orders' | 'all';

export interface ClinicianDelegation {
  id: string;
  delegatorId: string;
  delegateId: string;
  delegationType: DelegationType;
  startDate: string;
  endDate?: string;
  reason?: string;
  active: boolean;
  createdAt: string;
}

export interface OutOfOfficeStatus {
  outOfOffice: boolean;
  message?: string;
  start?: string;
  end?: string;
  autoForwardTo?: string;
}

export interface CreateDelegationDTO {
  delegateId: string;
  delegationType: DelegationType;
  startDate?: string;
  endDate?: string;
  reason?: string;
}

export interface SetOutOfOfficeDTO {
  message?: string;
  start?: string;
  end?: string;
  autoForwardTo?: string;
}
