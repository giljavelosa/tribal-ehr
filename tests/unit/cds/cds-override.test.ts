/**
 * Unit Tests: CDS Override & Feedback Service
 *
 * Tests for /packages/api/src/services/cds-override.service.ts
 * Covers: override recording, feedback recording, patient override retrieval.
 */

// Mock the database before importing service
const mockInsert = jest.fn().mockResolvedValue([1]);
const mockWhere = jest.fn().mockReturnThis();
const mockOrderBy = jest.fn().mockReturnThis();
const mockSelect = jest.fn().mockResolvedValue([]);

const mockDb: any = jest.fn((table: string) => ({
  insert: mockInsert,
  where: mockWhere,
  orderBy: mockOrderBy,
  select: mockSelect,
}));

jest.mock('../../../packages/api/src/config/database', () => ({
  db: mockDb,
  default: mockDb,
  getDb: jest.fn().mockReturnValue(mockDb),
}));

jest.mock('../../../packages/api/src/utils/logger', () => {
  const mockLogger: any = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
  };
  return { logger: mockLogger };
});

import { CDSOverrideService, cdsOverrideService } from '../../../packages/api/src/services/cds-override.service';

describe('CDSOverrideService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInsert.mockResolvedValue([1]);
    mockSelect.mockResolvedValue([]);
  });

  // ===========================================================================
  // recordOverride
  // ===========================================================================

  describe('recordOverride', () => {
    const overrideData = {
      cardId: 'card-warfarin-nsaid-001',
      userId: 'user-physician-001',
      patientId: '550e8400-e29b-41d4-a716-446655440000',
      hookInstance: 'hook-instance-abc',
      reasonCode: 'clinical-judgment',
      reasonText: 'Patient has been on both medications for years without issue',
      cardSummary: 'Critical: Warfarin + Ibuprofen increases bleeding risk',
    };

    it('should insert override record into cds_overrides table', async () => {
      const result = await cdsOverrideService.recordOverride(overrideData);

      expect(mockDb).toHaveBeenCalledWith('cds_overrides');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          card_id: overrideData.cardId,
          user_id: overrideData.userId,
          patient_id: overrideData.patientId,
          hook_instance: overrideData.hookInstance,
          reason_code: overrideData.reasonCode,
          reason_text: overrideData.reasonText,
          card_summary: overrideData.cardSummary,
        }),
      );
    });

    it('should return a CDSOverrideRecord with generated id and timestamp', async () => {
      const result = await cdsOverrideService.recordOverride(overrideData);

      expect(result).toBeDefined();
      expect(result.id).toBeTruthy();
      expect(result.cardId).toBe(overrideData.cardId);
      expect(result.userId).toBe(overrideData.userId);
      expect(result.patientId).toBe(overrideData.patientId);
      expect(result.reasonCode).toBe(overrideData.reasonCode);
      expect(result.reasonText).toBe(overrideData.reasonText);
      expect(result.createdAt).toBeTruthy();
    });

    it('should handle override without optional reasonText', async () => {
      const { reasonText, ...dataWithoutText } = overrideData;
      const result = await cdsOverrideService.recordOverride(dataWithoutText);

      expect(result).toBeDefined();
      expect(result.reasonText).toBeUndefined();
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          reason_text: null,
        }),
      );
    });

    it('should generate unique ids for each override', async () => {
      const result1 = await cdsOverrideService.recordOverride(overrideData);
      const result2 = await cdsOverrideService.recordOverride(overrideData);

      expect(result1.id).not.toBe(result2.id);
    });
  });

  // ===========================================================================
  // recordFeedback
  // ===========================================================================

  describe('recordFeedback', () => {
    const feedbackData = {
      cardId: 'card-warfarin-nsaid-001',
      userId: 'user-physician-001',
      outcome: 'helpful',
    };

    it('should insert feedback record into cds_feedback table', async () => {
      const result = await cdsOverrideService.recordFeedback(feedbackData);

      expect(mockDb).toHaveBeenCalledWith('cds_feedback');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          card_id: feedbackData.cardId,
          user_id: feedbackData.userId,
          outcome: feedbackData.outcome,
        }),
      );
    });

    it('should return a CDSFeedbackRecord with generated id', async () => {
      const result = await cdsOverrideService.recordFeedback(feedbackData);

      expect(result).toBeDefined();
      expect(result.id).toBeTruthy();
      expect(result.cardId).toBe(feedbackData.cardId);
      expect(result.userId).toBe(feedbackData.userId);
      expect(result.outcome).toBe(feedbackData.outcome);
      expect(result.createdAt).toBeTruthy();
    });

    it('should handle feedback with outcomeTimestamp', async () => {
      const dataWithTimestamp = {
        ...feedbackData,
        outcomeTimestamp: '2026-02-06T12:00:00Z',
      };
      const result = await cdsOverrideService.recordFeedback(dataWithTimestamp);

      expect(result).toBeDefined();
      expect(result.outcomeTimestamp).toBe('2026-02-06T12:00:00Z');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome_timestamp: '2026-02-06T12:00:00Z',
        }),
      );
    });

    it('should set outcome_timestamp to null when not provided', async () => {
      await cdsOverrideService.recordFeedback(feedbackData);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome_timestamp: null,
        }),
      );
    });
  });

  // ===========================================================================
  // getOverridesForPatient
  // ===========================================================================

  describe('getOverridesForPatient', () => {
    const patientId = '550e8400-e29b-41d4-a716-446655440000';

    it('should query cds_overrides for the given patient', async () => {
      await cdsOverrideService.getOverridesForPatient(patientId);

      expect(mockDb).toHaveBeenCalledWith('cds_overrides');
      expect(mockWhere).toHaveBeenCalledWith('patient_id', patientId);
      expect(mockOrderBy).toHaveBeenCalledWith('created_at', 'desc');
    });

    it('should return empty array when no overrides exist', async () => {
      mockSelect.mockResolvedValue([]);
      const result = await cdsOverrideService.getOverridesForPatient(patientId);

      expect(result).toEqual([]);
    });

    it('should map database rows to CDSOverrideRecord format', async () => {
      const dbRows = [
        {
          id: 'override-001',
          card_id: 'card-001',
          user_id: 'user-001',
          patient_id: patientId,
          hook_instance: 'hook-abc',
          reason_code: 'clinical-judgment',
          reason_text: 'Clinically appropriate',
          card_summary: 'Drug interaction warning',
          created_at: '2026-02-06T10:00:00Z',
        },
        {
          id: 'override-002',
          card_id: 'card-002',
          user_id: 'user-001',
          patient_id: patientId,
          hook_instance: 'hook-def',
          reason_code: 'patient-decline',
          reason_text: null,
          card_summary: 'Allergy alert',
          created_at: '2026-02-05T09:00:00Z',
        },
      ];
      mockSelect.mockResolvedValue(dbRows);

      const result = await cdsOverrideService.getOverridesForPatient(patientId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'override-001',
        cardId: 'card-001',
        userId: 'user-001',
        patientId,
        hookInstance: 'hook-abc',
        reasonCode: 'clinical-judgment',
        reasonText: 'Clinically appropriate',
        cardSummary: 'Drug interaction warning',
        createdAt: '2026-02-06T10:00:00Z',
      });
      expect(result[1].reasonText).toBeNull();
    });
  });
});
