import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({ resource: 'fhir-proxy', status: 'operational' });
});

export default router;
