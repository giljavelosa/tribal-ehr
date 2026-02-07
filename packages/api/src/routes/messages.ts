// =============================================================================
// Secure Messaging Routes
// POST   /                      - Send message
// GET    /inbox                 - Get inbox
// GET    /sent                  - Get sent messages
// GET    /unread-count          - Get unread count
// GET    /flagged               - Get flagged messages
// GET    /:id                   - Get single message
// GET    /:id/thread            - Get message thread
// POST   /:id/read              - Mark message as read
// POST   /:id/reply             - Reply to message
// POST   /:id/forward           - Forward message
// POST   /:id/flag              - Flag message
// DELETE /:id/flag              - Unflag message
// PUT    /:id/follow-up         - Set follow-up date
// POST   /:id/escalate          - Escalate message
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { messageService } from '../services/message.service';
import { authenticate } from '../middleware/auth';

const router = Router();

// ---------------------------------------------------------------------------
// Send Message
// ---------------------------------------------------------------------------
router.post(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const message = await messageService.send({
        senderId: req.user!.id,
        recipientId: req.body.recipientId,
        patientId: req.body.patientId,
        subject: req.body.subject,
        body: req.body.body,
        priority: req.body.priority,
      });

      res.status(201).json({ data: message });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Get Inbox
// ---------------------------------------------------------------------------
router.get(
  '/inbox',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await messageService.getInbox(req.user!.id, {
        unreadOnly: req.query.unreadOnly === 'true',
        patientId: req.query.patientId as string,
        priority: req.query.priority as 'normal' | 'high' | 'urgent' | undefined,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Get Sent Messages
// ---------------------------------------------------------------------------
router.get(
  '/sent',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await messageService.getSent(req.user!.id, {
        patientId: req.query.patientId as string,
        priority: req.query.priority as 'normal' | 'high' | 'urgent' | undefined,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Get Unread Count
// ---------------------------------------------------------------------------
router.get(
  '/unread-count',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const count = await messageService.getUnreadCount(req.user!.id);
      res.json({ data: { count } });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Get Single Message
// ---------------------------------------------------------------------------
router.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const message = await messageService.getMessage(req.params.id);
      res.json({ data: message });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Get Message Thread
// ---------------------------------------------------------------------------
router.get(
  '/:id/thread',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const thread = await messageService.getThread(req.params.id);
      res.json({ data: thread });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Mark Message as Read
// ---------------------------------------------------------------------------
router.post(
  '/:id/read',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await messageService.markRead(req.params.id, req.user!.id);
      res.json({ data: { success: true } });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Reply to Message
// ---------------------------------------------------------------------------
router.post(
  '/:id/reply',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const message = await messageService.reply(
        req.params.id,
        req.user!.id,
        req.body.body
      );

      res.status(201).json({ data: message });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Get Flagged Messages
// ---------------------------------------------------------------------------
router.get(
  '/flagged',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const messages = await messageService.getFlaggedMessages(req.user!.id);
      res.json({ data: messages });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Forward Message
// ---------------------------------------------------------------------------
router.post(
  '/:id/forward',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const message = await messageService.forward(
        req.params.id,
        req.user!.id,
        req.body.recipientId,
        req.body.note
      );
      res.status(201).json({ data: message });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Flag Message
// ---------------------------------------------------------------------------
router.post(
  '/:id/flag',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await messageService.flag(req.params.id, req.user!.id);
      res.json({ data: { success: true } });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Unflag Message
// ---------------------------------------------------------------------------
router.delete(
  '/:id/flag',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await messageService.unflag(req.params.id, req.user!.id);
      res.json({ data: { success: true } });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Set Follow-Up Date
// ---------------------------------------------------------------------------
router.put(
  '/:id/follow-up',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await messageService.setFollowUpDate(req.params.id, req.user!.id, req.body.followUpDate);
      res.json({ data: { success: true } });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Escalate Message
// ---------------------------------------------------------------------------
router.post(
  '/:id/escalate',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await messageService.escalateMessage(req.params.id, req.user!.id, req.body.escalateTo);
      res.json({ data: { success: true } });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
