// =============================================================================
// Patient Routes - Full CRUD + FHIR endpoints
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission, requireRole } from '../middleware/auth';
import { validate, validateQuery } from '../middleware/validation';
import { patientService } from '../services/patient.service';
import { patientMatchingService } from '../services/patient-matching.service';
import { patientListService } from '../services/patient-list.service';
import { auditService } from '../services/audit.service';
import { ccdaService } from '../services/ccda.service';
import {
  createPatientSchema,
  updatePatientSchema,
  searchPatientSchema,
} from '../validators/patient.validator';
import { NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

const router = Router();

// ---------------------------------------------------------------------------
// GET / - Search patients
// ---------------------------------------------------------------------------

router.get(
  '/',
  authenticate,
  requirePermission('patient', 'read'),
  validateQuery(searchPatientSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = req.query as Record<string, unknown>;

      const result = await patientService.search({
        name: params.name as string | undefined,
        mrn: params.mrn as string | undefined,
        dob: params.dob as string | undefined,
        phone: params.phone as string | undefined,
        email: params.email as string | undefined,
        active: params.active as boolean | undefined,
        page: (params.page as number | undefined) ?? 1,
        limit: (params.limit as number | undefined) ?? 20,
        sort: params.sort as 'name' | 'dob' | 'mrn' | 'createdAt' | undefined,
        order: (params.order as 'asc' | 'desc' | undefined) ?? 'asc',
      });

      // Fire-and-forget audit log
      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'Patient',
        resourceId: 'search',
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      // Add dob/gender aliases for frontend compatibility
      const transformedResult = {
        ...result,
        data: result.data.map((p) => ({
          ...p,
          dob: p.dateOfBirth,
          gender: p.sex,
        })),
      };

      res.json(transformedResult);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /similar - Find similar patients (duplicate detection)
// ---------------------------------------------------------------------------

router.get(
  '/similar',
  authenticate,
  requirePermission('patient', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const similar = await patientMatchingService.findSimilarPatients({
        firstName: req.query.firstName as string,
        lastName: req.query.lastName as string,
        dateOfBirth: req.query.dateOfBirth as string,
        sex: req.query.sex as string,
      });
      res.json({ data: similar });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /temporary - Create temporary patient
// ---------------------------------------------------------------------------

router.post(
  '/temporary',
  authenticate,
  requirePermission('patient', 'create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tempPatient = await patientMatchingService.createTemporaryPatient({
        reason: req.body.reason,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        dateOfBirth: req.body.dateOfBirth,
        sex: req.body.sex,
        createdBy: req.user!.id,
      });
      res.status(201).json({ data: tempPatient });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /temporary/:id/merge - Merge temporary patient to real patient
// ---------------------------------------------------------------------------

router.post(
  '/temporary/:id/merge',
  authenticate,
  requirePermission('patient', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await patientMatchingService.mergeTemporaryToReal(
        req.params.id,
        req.body.realPatientId,
        req.user!.id
      );
      res.json({ data: { success: true } });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /lists - Get patient lists for current user
// ---------------------------------------------------------------------------

router.get(
  '/lists',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lists = await patientListService.getListsForUser(req.user!.id);
      res.json({ data: lists });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /lists - Create patient list
// ---------------------------------------------------------------------------

router.post(
  '/lists',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const list = await patientListService.createList({
        userId: req.user!.id,
        name: req.body.name,
        description: req.body.description,
        listType: req.body.listType,
      });
      res.status(201).json({ data: list });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /lists/:listId - Get patient list details with members
// ---------------------------------------------------------------------------

router.get(
  '/lists/:listId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const list = await patientListService.getListById(req.params.listId);
      const members = await patientListService.getListMembers(req.params.listId);
      res.json({ data: { ...list, members } });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /lists/:listId/patients - Add patient to list
// ---------------------------------------------------------------------------

router.post(
  '/lists/:listId/patients',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const member = await patientListService.addPatient(
        req.params.listId,
        req.body.patientId,
        req.user!.id,
        req.body.notes
      );
      res.status(201).json({ data: member });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// DELETE /lists/:listId/patients/:patientId - Remove patient from list
// ---------------------------------------------------------------------------

router.delete(
  '/lists/:listId/patients/:patientId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await patientListService.removePatient(req.params.listId, req.params.patientId);
      res.json({ data: { success: true } });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /:id - Get patient by ID
// ---------------------------------------------------------------------------

router.get(
  '/:id',
  authenticate,
  requirePermission('patient', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patient = await patientService.getById(req.params.id);

      if (!patient) {
        throw new NotFoundError('Patient', req.params.id);
      }

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'Patient',
        resourceId: req.params.id,
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      // Add 'dob' alias for frontend compatibility (expects dob, API uses dateOfBirth)
      // Return patient directly (not wrapped in { data: }) for frontend compatibility
      const patientWithAlias = {
        ...patient,
        dob: patient.dateOfBirth,
        gender: patient.sex, // Frontend also uses 'gender'
      };

      res.json(patientWithAlias);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST / - Create patient
// ---------------------------------------------------------------------------

router.post(
  '/',
  authenticate,
  requirePermission('patient', 'create'),
  validate(createPatientSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agentDisplay = `${req.user!.email}`;
      const patient = await patientService.create(req.body, req.user!.id, agentDisplay);

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'Patient',
        resourceId: patient.id,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        newValue: patient as unknown as Record<string, unknown>,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ data: patient });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /:id - Update patient
// ---------------------------------------------------------------------------

router.put(
  '/:id',
  authenticate,
  requirePermission('patient', 'update'),
  validate(updatePatientSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agentDisplay = `${req.user!.email}`;
      const patient = await patientService.update(
        req.params.id,
        req.body,
        req.user!.id,
        agentDisplay
      );

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'UPDATE',
        resourceType: 'Patient',
        resourceId: req.params.id,
        endpoint: req.originalUrl,
        method: 'PUT',
        statusCode: 200,
        newValue: patient as unknown as Record<string, unknown>,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: patient });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// DELETE /:id - Soft delete patient
// ---------------------------------------------------------------------------

router.delete(
  '/:id',
  authenticate,
  requirePermission('patient', 'delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agentDisplay = `${req.user!.email}`;
      await patientService.delete(req.params.id, req.user!.id, agentDisplay);

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'DELETE',
        resourceType: 'Patient',
        resourceId: req.params.id,
        endpoint: req.originalUrl,
        method: 'DELETE',
        statusCode: 204,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /:id/fhir - Get patient as FHIR R4 resource
// ---------------------------------------------------------------------------

router.get(
  '/:id/fhir',
  authenticate,
  requirePermission('patient', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patient = await patientService.getById(req.params.id);

      if (!patient) {
        throw new NotFoundError('Patient', req.params.id);
      }

      const fhirPatient = patientService.toFHIRPatient(patient);

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'Patient',
        resourceId: req.params.id,
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        clinicalContext: 'FHIR export',
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.setHeader('Content-Type', 'application/fhir+json');
      res.json(fhirPatient);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /:id/everything - Patient $everything operation
// ---------------------------------------------------------------------------

router.get(
  '/:id/everything',
  authenticate,
  requirePermission('patient', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patient = await patientService.getById(req.params.id);

      if (!patient) {
        throw new NotFoundError('Patient', req.params.id);
      }

      // Look up the FHIR server ID
      const patientRow = await patientService['db']('patients')
        .where({ id: req.params.id })
        .select('fhir_id')
        .first();

      let bundle: Record<string, unknown>;

      if (patientRow?.fhir_id) {
        // Use the FHIR $everything operation on the server
        try {
          bundle = await patientService['fhirClient'].operation<Record<string, unknown>>(
            'Patient',
            'everything',
            undefined,
            patientRow.fhir_id
          );
        } catch {
          // Fall back to constructing the bundle locally
          bundle = buildLocalEverythingBundle(patient as unknown as Record<string, unknown>);
        }
      } else {
        // No FHIR ID; build a minimal bundle from local data
        bundle = buildLocalEverythingBundle(patient as unknown as Record<string, unknown>);
      }

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'Patient',
        resourceId: req.params.id,
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        clinicalContext: '$everything',
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.setHeader('Content-Type', 'application/fhir+json');
      res.json(bundle);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /:id/merge - Merge duplicate patients (admin only)
// ---------------------------------------------------------------------------

router.post(
  '/:id/merge',
  authenticate,
  requireRole('ADMIN', 'SYSTEM_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sourcePatientId } = req.body;

      if (!sourcePatientId || typeof sourcePatientId !== 'string') {
        throw new ValidationError('sourcePatientId is required in the request body');
      }

      const targetId = req.params.id;

      if (targetId === sourcePatientId) {
        throw new ValidationError('Cannot merge a patient with itself');
      }

      // Verify both patients exist
      const targetPatient = await patientService.getById(targetId);
      if (!targetPatient) {
        throw new NotFoundError('Target Patient', targetId);
      }

      const sourcePatient = await patientService.getById(sourcePatientId);
      if (!sourcePatient) {
        throw new NotFoundError('Source Patient', sourcePatientId);
      }

      // Merge: move related records from source to target, then deactivate source
      const db = patientService['db'];

      await db.transaction(async (trx) => {
        const relatedTables = [
          'patient_addresses',
          'patient_phone_numbers',
          'patient_emails',
          'patient_emergency_contacts',
          'patient_insurance',
        ];

        for (const table of relatedTables) {
          await trx(table)
            .where({ patient_id: sourcePatientId })
            .update({ patient_id: targetId });
        }

        // Also move clinical references if they exist
        const clinicalTables = [
          'encounters',
          'conditions',
          'observations',
          'medication_requests',
          'allergy_intolerances',
          'procedures',
          'immunizations',
          'care_plans',
          'care_teams',
          'goals',
          'documents',
        ];

        for (const table of clinicalTables) {
          try {
            await trx(table)
              .where({ patient_id: sourcePatientId })
              .update({ patient_id: targetId });
          } catch {
            // Table may not exist yet; skip silently
          }
        }

        // Deactivate the source patient
        await trx('patients')
          .where({ id: sourcePatientId })
          .update({ active: false, updated_at: new Date().toISOString() });

        // Record merge provenance on both patients
        const agentDisplay = `${req.user!.email}`;
        await patientService['provenanceService'].record({
          targetType: 'Patient',
          targetId,
          action: 'UPDATE',
          agentId: req.user!.id,
          agentDisplay,
          detail: {
            operation: 'merge',
            mergedFrom: sourcePatientId,
            mergedFromMRN: sourcePatient.mrn,
          },
        });
      });

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'UPDATE',
        resourceType: 'Patient',
        resourceId: targetId,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 200,
        clinicalContext: `Merged patient ${sourcePatientId} into ${targetId}`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      const mergedPatient = await patientService.getById(targetId);

      res.json({
        data: mergedPatient,
        meta: {
          mergedFrom: sourcePatientId,
          mergedFromMRN: sourcePatient.mrn,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Patient Sub-Resource Routes (ONC §170.315 compliant - patient-centric access)
// These routes provide patient-scoped access to clinical data
// ---------------------------------------------------------------------------

// Helper: Transform snake_case DB rows to camelCase for frontend
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function transformRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[snakeToCamel(key)] = value;
  }
  return result;
}

function transformCondition(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    code: row.code_code,
    codeSystem: row.code_system,
    display: row.code_display,
    clinicalStatus: row.clinical_status,
    verificationStatus: row.verification_status,
    category: row.category,
    severity: row.severity_code,
    onsetDate: row.onset_date_time,
    abatementDate: row.abatement_date_time,
    recordedDate: row.recorded_date,
    note: row.note,
  };
}

function transformEncounter(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    type: row.type_display || row.type_code,
    status: row.status,
    class: row.class_code,
    period: {
      start: row.period_start,
      end: row.period_end,
    },
    reasonCode: row.reason_code,
    location: row.location_id,
  };
}

function transformObservation(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    code: row.code_code,
    display: row.code_display,
    category: row.category_code,
    value: row.value_quantity_value ?? row.value_string,
    unit: row.value_quantity_unit,
    referenceRange: row.reference_range_low || row.reference_range_high ? {
      low: row.reference_range_low,
      high: row.reference_range_high,
      text: row.reference_range_text,
    } : undefined,
    interpretation: row.interpretation_display || row.interpretation_code,
    status: row.status,
    date: row.effective_date_time, // Frontend VitalSigns expects 'date'
    effectiveDateTime: row.effective_date_time,
    issued: row.issued,
    flag: row.interpretation_code === 'H' || row.interpretation_code === 'HH' ? 'H' :
          row.interpretation_code === 'L' || row.interpretation_code === 'LL' ? 'L' : 'N',
  };
}

function transformAllergy(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    allergen: row.code_display || row.code_code,
    type: row.type,
    category: row.category,
    criticality: row.criticality,
    clinicalStatus: row.clinical_status,
    verificationStatus: row.verification_status,
    reactions: row.reactions || [],
    onsetDate: row.onset_date_time,
    recordedDate: row.recorded_date,
    note: row.note,
  };
}

function transformMedication(row: Record<string, unknown>): Record<string, unknown> {
  const dosage = Array.isArray(row.dosage_instruction) ? row.dosage_instruction[0] : null;
  return {
    id: row.id,
    medication: row.medication_code_display || row.medication_code_code,
    dose: dosage?.doseAndRate?.[0]?.doseQuantity?.value || '',
    route: dosage?.route?.text || '',
    frequency: dosage?.timing?.code?.text || dosage?.text || '',
    status: row.status,
    intent: row.intent,
    startDate: row.authored_on,
    note: row.note,
  };
}

function transformImmunization(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    vaccineCode: row.vaccine_code_code,
    vaccineDisplay: row.vaccine_code_display,
    status: row.status,
    occurrenceDateTime: row.occurrence_date_time,
    lotNumber: row.lot_number,
    site: row.site_display,
    route: row.route_display,
    doseQuantity: row.dose_quantity_value ? `${row.dose_quantity_value} ${row.dose_quantity_unit || ''}` : undefined,
    expirationDate: row.expiration_date,
    note: row.note,
  };
}

// GET /:id/conditions - Get patient's conditions/problems
router.get(
  '/:id/conditions',
  authenticate,
  requirePermission('patient', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = patientService['db'];
      const rows = await db('conditions')
        .where({ patient_id: req.params.id })
        .orderBy('onset_date_time', 'desc');
      
      res.json(rows.map(transformCondition));
    } catch (error) {
      next(error);
    }
  }
);

// GET /:id/medications - Get patient's medications
router.get(
  '/:id/medications',
  authenticate,
  requirePermission('patient', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = patientService['db'];
      const rows = await db('medication_requests')
        .where({ patient_id: req.params.id })
        .orderBy('authored_on', 'desc');
      
      res.json(rows.map(transformMedication));
    } catch (error) {
      next(error);
    }
  }
);

// GET /:id/allergies - Get patient's allergies
router.get(
  '/:id/allergies',
  authenticate,
  requirePermission('patient', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = patientService['db'];
      const rows = await db('allergy_intolerances')
        .where({ patient_id: req.params.id })
        .orderBy('recorded_date', 'desc');
      
      res.json(rows.map(transformAllergy));
    } catch (error) {
      next(error);
    }
  }
);

// LOINC codes for vital signs
const VITAL_CODES = {
  SYSTOLIC_BP: '8480-6',
  DIASTOLIC_BP: '8462-4',
  BP_PANEL: '85354-9',
  HEART_RATE: '8867-4',
  TEMPERATURE: '8310-5',
  SPO2: '2708-6',
  WEIGHT: '29463-7',
  HEIGHT: '8302-2',
  BMI: '39156-5',
  RESPIRATORY_RATE: '9279-1',
};

// Aggregate observations into VitalSigns format by date
function aggregateVitals(observations: Record<string, unknown>[]): Record<string, unknown>[] {
  // Group by date (truncate to day for grouping)
  const byDate = new Map<string, Record<string, unknown>[]>();
  
  for (const obs of observations) {
    const dateStr = obs.effective_date_time 
      ? new Date(obs.effective_date_time as string).toISOString().split('T')[0]
      : 'unknown';
    if (!byDate.has(dateStr)) {
      byDate.set(dateStr, []);
    }
    byDate.get(dateStr)!.push(obs);
  }
  
  // Convert each date group to a VitalSigns object
  const results: Record<string, unknown>[] = [];
  
  for (const [dateStr, obs] of byDate) {
    const vital: Record<string, unknown> = {
      id: obs[0]?.id || dateStr,
      date: obs[0]?.effective_date_time || dateStr,
    };
    
    for (const o of obs) {
      const code = o.code_code as string;
      const value = o.value_quantity_value ?? o.value_string;
      const unit = o.value_quantity_unit as string;
      
      switch (code) {
        case VITAL_CODES.SYSTOLIC_BP:
          vital.systolicBP = value;
          break;
        case VITAL_CODES.DIASTOLIC_BP:
          vital.diastolicBP = value;
          break;
        case VITAL_CODES.HEART_RATE:
          vital.heartRate = value;
          break;
        case VITAL_CODES.TEMPERATURE:
          vital.temperature = value;
          vital.temperatureUnit = unit === '°C' || unit === 'Cel' ? 'C' : 'F';
          break;
        case VITAL_CODES.SPO2:
          vital.spO2 = value;
          break;
        case VITAL_CODES.WEIGHT:
          vital.weight = value;
          vital.weightUnit = unit === 'kg' ? 'kg' : 'lbs';
          break;
        case VITAL_CODES.HEIGHT:
          vital.height = value;
          vital.heightUnit = unit === 'cm' ? 'cm' : 'in';
          break;
        case VITAL_CODES.BMI:
          vital.bmi = value;
          break;
        case VITAL_CODES.RESPIRATORY_RATE:
          vital.respiratoryRate = value;
          break;
      }
    }
    
    results.push(vital);
  }
  
  // Sort by date descending
  results.sort((a, b) => {
    const dateA = new Date(a.date as string).getTime();
    const dateB = new Date(b.date as string).getTime();
    return dateB - dateA;
  });
  
  return results;
}

// GET /:id/vitals - Get patient's vital signs (observations with vital sign category)
router.get(
  '/:id/vitals',
  authenticate,
  requirePermission('patient', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = patientService['db'];
      const rows = await db('observations')
        .where({ patient_id: req.params.id })
        .whereIn('category_code', ['vital-signs', 'vitals'])
        .orderBy('effective_date_time', 'desc')
        .limit(100);
      
      // Aggregate observations into VitalSigns format
      res.json(aggregateVitals(rows));
    } catch (error) {
      next(error);
    }
  }
);

// GET /:id/encounters - Get patient's encounters
router.get(
  '/:id/encounters',
  authenticate,
  requirePermission('patient', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = patientService['db'];
      const rows = await db('encounters')
        .where({ patient_id: req.params.id })
        .orderBy('period_start', 'desc')
        .limit(50);
      
      res.json(rows.map(transformEncounter));
    } catch (error) {
      next(error);
    }
  }
);

// GET /:id/immunizations - Get patient's immunizations
router.get(
  '/:id/immunizations',
  authenticate,
  requirePermission('patient', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = patientService['db'];
      const rows = await db('immunizations')
        .where({ patient_id: req.params.id })
        .orderBy('occurrence_date_time', 'desc');
      
      res.json(rows.map(transformImmunization));
    } catch (error) {
      next(error);
    }
  }
);

// GET /:id/care-plans - Get patient's care plans
router.get(
  '/:id/care-plans',
  authenticate,
  requirePermission('patient', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = patientService['db'];
      const rows = await db('care_plans')
        .where({ patient_id: req.params.id })
        .orderBy('created_at', 'desc');
      
      res.json(rows.map(transformRow));
    } catch (error) {
      next(error);
    }
  }
);

// GET /:id/observations - Get patient's observations (lab results, etc.)
router.get(
  '/:id/observations',
  authenticate,
  requirePermission('patient', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = patientService['db'];
      const category = req.query.category as string | undefined;
      
      let query = db('observations')
        .where({ patient_id: req.params.id });
      
      if (category) {
        query = query.where({ category_code: category });
      }
      
      const rows = await query
        .orderBy('effective_date_time', 'desc')
        .limit(100);
      
      res.json(rows.map(transformObservation));
    } catch (error) {
      next(error);
    }
  }
);

// GET /:id/documents - Get patient's documents
router.get(
  '/:id/documents',
  authenticate,
  requirePermission('patient', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = patientService['db'];
      const rows = await db('document_references')
        .where({ patient_id: req.params.id })
        .orderBy('created_at', 'desc');
      
      res.json(rows.map(transformRow));
    } catch (error) {
      next(error);
    }
  }
);

// GET /:id/procedures - Get patient's procedures
router.get(
  '/:id/procedures',
  authenticate,
  requirePermission('patient', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = patientService['db'];
      const rows = await db('procedures')
        .where({ patient_id: req.params.id })
        .orderBy('performed_date_time', 'desc');
      
      res.json(rows.map(transformRow));
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Helper: build a local $everything bundle when FHIR server is unavailable
// ---------------------------------------------------------------------------

function buildLocalEverythingBundle(
  patient: Record<string, unknown>
): Record<string, unknown> {
  const fhirPatient = patientService.toFHIRPatient(patient as any);

  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total: 1,
    entry: [
      {
        fullUrl: `Patient/${patient.id}`,
        resource: fhirPatient,
        search: { mode: 'match' },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// GET /:id/ccda - Generate C-CDA R2.1 Document
// ONC §170.315(b)(1) - Transitions of Care
// ---------------------------------------------------------------------------
router.get(
  '/:id/ccda',
  authenticate,
  requirePermission('patient', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = req.params.id;
      
      // Generate the C-CDA document
      const ccdaXml = await ccdaService.generateCCD(patientId);
      
      // Set appropriate headers for XML download
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Content-Disposition', `attachment; filename="ccda_${patientId}.xml"`);
      
      res.send(ccdaXml);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
