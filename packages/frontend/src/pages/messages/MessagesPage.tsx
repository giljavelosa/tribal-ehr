import React, { useState, useMemo, useCallback } from 'react';
import {
  Plus,
  Search,
  Send,
  Paperclip,
  Reply,
  Inbox,
  SendHorizontal,
  Mail,
  MailOpen,
  Forward,
  Star,
  StarOff,
  Calendar,
  AlertTriangle,
  Flag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { usePatientContext } from '@/stores/patient-context-store';
import { usePatientContextFromUrl } from '@/hooks/use-patient-context-url';

interface Message {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  patient?: string;
  patientId?: string;
  date: string;
  read: boolean;
  priority: 'low' | 'normal' | 'high';
  direction: 'incoming' | 'outgoing';
  replies?: Message[];
  flagged?: boolean;
  followUpDate?: string;
  escalated?: boolean;
}

const mockMessages: Message[] = [
  {
    id: '1',
    from: 'Nurse Sarah',
    to: 'Dr. Wilson',
    subject: 'Patient Robert Williams - Vitals Concern',
    body: 'Blood pressure reading of 180/110 during afternoon check. Patient reported headache and dizziness. I administered PRN antihypertensive per standing order. Please advise on further management.\n\nCurrent vitals:\nBP: 180/110 mmHg\nHR: 92 bpm\nRR: 20/min\nSpO2: 96%',
    patient: 'Robert Williams',
    patientId: 'P-001',
    date: '2024-01-12T10:30:00',
    read: false,
    priority: 'high',
    direction: 'incoming',
    replies: [],
  },
  {
    id: '2',
    from: 'Dr. Anderson',
    to: 'Dr. Wilson',
    subject: 'Referral Follow-up: James Brown',
    body: 'Cardiology has reviewed the referral and scheduled the patient for a stress test on Jan 25. The report from the initial consult is available in the patient chart. Please ensure the patient is on appropriate beta-blocker therapy prior to the test.',
    patient: 'James Brown',
    patientId: 'P-005',
    date: '2024-01-12T09:15:00',
    read: false,
    priority: 'normal',
    direction: 'incoming',
    replies: [],
  },
  {
    id: '3',
    from: 'Lab Department',
    to: 'Dr. Wilson',
    subject: 'STAT Lab Results Available',
    body: 'STAT troponin results are now available for review for patient Robert Williams. The results have been posted to the Results Inbox. Please review at your earliest convenience.',
    patient: 'Robert Williams',
    patientId: 'P-001',
    date: '2024-01-12T08:00:00',
    read: false,
    priority: 'high',
    direction: 'incoming',
    replies: [],
  },
  {
    id: '4',
    from: 'Mary Johnson (Patient)',
    to: 'Dr. Wilson',
    subject: 'Prescription Renewal Request',
    body: "I need to renew my Lisinopril prescription. My pharmacy is CVS on Main Street. I've been taking 10mg daily and haven't had any issues. I also wanted to ask about getting my annual labs done.",
    patient: 'Mary Johnson',
    patientId: 'P-002',
    date: '2024-01-11T14:30:00',
    read: true,
    priority: 'normal',
    direction: 'incoming',
    replies: [],
  },
  {
    id: '5',
    from: 'Front Desk',
    to: 'Dr. Wilson',
    subject: 'Schedule Change Request',
    body: "Patient Sarah Davis has requested to reschedule her appointment from January 18 to January 22. She mentioned she has a conflict with her work schedule. Would you like me to accommodate this request?",
    patient: 'Sarah Davis',
    patientId: 'P-004',
    date: '2024-01-11T11:00:00',
    read: true,
    priority: 'low',
    direction: 'incoming',
    replies: [],
  },
  {
    id: '6',
    from: 'Dr. Wilson',
    to: 'Nurse Sarah',
    subject: 'Re: Patient Robert Williams - BP Management',
    body: 'Thank you for the update. Please continue monitoring vitals q2h. If systolic remains > 160, start Labetalol 20mg IV push. I will be in to evaluate the patient within the hour.',
    patient: 'Robert Williams',
    patientId: 'P-001',
    date: '2024-01-12T10:45:00',
    read: true,
    priority: 'high',
    direction: 'outgoing',
    replies: [],
  },
  {
    id: '7',
    from: 'Dr. Wilson',
    to: 'Pharmacy',
    subject: 'Rx Renewal: Lisinopril for Mary Johnson',
    body: 'Please renew Lisinopril 10mg PO daily, 90-day supply, 3 refills for Mary Johnson (MRN: P-002). Patient reports tolerance without adverse effects.',
    patient: 'Mary Johnson',
    patientId: 'P-002',
    date: '2024-01-11T15:00:00',
    read: true,
    priority: 'normal',
    direction: 'outgoing',
    replies: [],
  },
];

export function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const [composeDialogOpen, setComposeDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('inbox');
  const activePatient = usePatientContext((s) => s.activePatient);
  usePatientContextFromUrl();
  const [composeForm, setComposeForm] = useState(() => ({
    to: '',
    subject: '',
    body: '',
    patient: activePatient
      ? `${activePatient.lastName}, ${activePatient.firstName}`
      : '',
    priority: 'normal' as Message['priority'],
  }));

  const inboxMessages = useMemo(
    () =>
      messages.filter((m) => m.direction === 'incoming').filter((m) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          m.from.toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q) ||
          m.body.toLowerCase().includes(q) ||
          (m.patient && m.patient.toLowerCase().includes(q))
        );
      }),
    [messages, searchQuery],
  );

  const sentMessages = useMemo(
    () =>
      messages.filter((m) => m.direction === 'outgoing').filter((m) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          m.to.toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q) ||
          m.body.toLowerCase().includes(q) ||
          (m.patient && m.patient.toLowerCase().includes(q))
        );
      }),
    [messages, searchQuery],
  );

  const allMessages = useMemo(
    () =>
      messages.filter((m) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          m.from.toLowerCase().includes(q) ||
          m.to.toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q) ||
          m.body.toLowerCase().includes(q) ||
          (m.patient && m.patient.toLowerCase().includes(q))
        );
      }),
    [messages, searchQuery],
  );

  const unreadCount = useMemo(
    () => inboxMessages.filter((m) => !m.read).length,
    [inboxMessages],
  );

  const selectedMessage = useMemo(
    () => messages.find((m) => m.id === selectedMessageId) || null,
    [messages, selectedMessageId],
  );

  const selectMessage = useCallback(
    (id: string) => {
      setSelectedMessageId(id);
      setReplyText('');
      // Mark as read
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, read: true } : m)),
      );
    },
    [],
  );

  const handleReply = useCallback(() => {
    if (!replyText.trim() || !selectedMessage) return;
    const reply: Message = {
      id: `reply-${Date.now()}`,
      from: 'Dr. Wilson',
      to: selectedMessage.from,
      subject: `Re: ${selectedMessage.subject}`,
      body: replyText,
      patient: selectedMessage.patient,
      patientId: selectedMessage.patientId,
      date: new Date().toISOString(),
      read: true,
      priority: selectedMessage.priority,
      direction: 'outgoing',
      replies: [],
    };
    setMessages((prev) => [reply, ...prev]);
    setReplyText('');
  }, [replyText, selectedMessage]);

  const handleCompose = useCallback(() => {
    if (!composeForm.to || !composeForm.subject || !composeForm.body) return;
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      from: 'Dr. Wilson',
      to: composeForm.to,
      subject: composeForm.subject,
      body: composeForm.body,
      patient: composeForm.patient || undefined,
      date: new Date().toISOString(),
      read: true,
      priority: composeForm.priority,
      direction: 'outgoing',
      replies: [],
    };
    setMessages((prev) => [newMessage, ...prev]);
    setComposeDialogOpen(false);
    setComposeForm({
      to: '',
      subject: '',
      body: '',
      patient: '',
      priority: 'normal',
    });
  }, [composeForm]);

  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [forwardTo, setForwardTo] = useState('');
  const [forwardNote, setForwardNote] = useState('');
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');

  const flaggedMessages = useMemo(
    () => messages.filter((m) => m.flagged),
    [messages],
  );

  const handleToggleFlag = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, flagged: !m.flagged } : m,
      ),
    );
  }, []);

  const handleForward = useCallback(() => {
    if (!forwardTo.trim() || !selectedMessage) return;
    const forwarded: Message = {
      id: `fwd-${Date.now()}`,
      from: 'Dr. Wilson',
      to: forwardTo,
      subject: `Fwd: ${selectedMessage.subject}`,
      body: forwardNote
        ? `${forwardNote}\n\n--- Forwarded Message ---\nFrom: ${selectedMessage.from}\n\n${selectedMessage.body}`
        : `--- Forwarded Message ---\nFrom: ${selectedMessage.from}\n\n${selectedMessage.body}`,
      patient: selectedMessage.patient,
      patientId: selectedMessage.patientId,
      date: new Date().toISOString(),
      read: true,
      priority: selectedMessage.priority,
      direction: 'outgoing',
    };
    setMessages((prev) => [forwarded, ...prev]);
    setForwardDialogOpen(false);
    setForwardTo('');
    setForwardNote('');
  }, [forwardTo, forwardNote, selectedMessage]);

  const handleSetFollowUp = useCallback(() => {
    if (!followUpDate || !selectedMessage) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === selectedMessage.id ? { ...m, followUpDate } : m,
      ),
    );
    setFollowUpDialogOpen(false);
    setFollowUpDate('');
  }, [followUpDate, selectedMessage]);

  const handleEscalate = useCallback(() => {
    if (!selectedMessage) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === selectedMessage.id
          ? { ...m, escalated: true, priority: 'high' }
          : m,
      ),
    );
  }, [selectedMessage]);

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  const renderMessageList = (list: Message[]) => (
    <ScrollArea className="h-[600px]">
      {list.length === 0 ? (
        <div className="flex h-[200px] items-center justify-center text-muted-foreground">
          No messages found.
        </div>
      ) : (
        list.map((message) => (
          <div
            key={message.id}
            className={`cursor-pointer border-b px-4 py-3 transition-colors hover:bg-accent ${
              selectedMessageId === message.id ? 'bg-accent' : ''
            } ${!message.read ? 'bg-primary/5' : ''}`}
            onClick={() => selectMessage(message.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <Avatar className="mt-0.5 h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {getInitials(
                      message.direction === 'incoming'
                        ? message.from
                        : message.to,
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p
                    className={`text-sm ${!message.read ? 'font-semibold' : 'font-medium'}`}
                  >
                    {message.direction === 'incoming'
                      ? message.from
                      : `To: ${message.to}`}
                  </p>
                  <p className="truncate text-sm">{message.subject}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {message.body.slice(0, 80)}...
                  </p>
                  {message.patient && (
                    <Badge
                      variant="outline"
                      className="mt-1 text-[10px]"
                    >
                      {message.patient}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {new Date(message.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                {message.flagged && (
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                )}
                {message.escalated && (
                  <Badge variant="destructive" className="text-[10px]">
                    Escalated
                  </Badge>
                )}
                {message.priority === 'high' && !message.escalated && (
                  <Badge variant="destructive" className="text-[10px]">
                    Urgent
                  </Badge>
                )}
                {message.followUpDate && (
                  <Badge variant="outline" className="text-[10px] gap-0.5">
                    <Calendar className="h-2.5 w-2.5" />
                    {new Date(message.followUpDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Badge>
                )}
                {!message.read && (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </ScrollArea>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
          <p className="text-muted-foreground">Secure clinical messaging</p>
        </div>
        <Button
          className="gap-1"
          onClick={() => setComposeDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
          New Message
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Message List Panel */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full">
                  <TabsTrigger value="inbox" className="flex-1 gap-1">
                    <Inbox className="h-3.5 w-3.5" />
                    Inbox
                    {unreadCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="ml-1 h-5 w-5 rounded-full p-0 text-[10px]"
                      >
                        {unreadCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="sent" className="flex-1 gap-1">
                    <SendHorizontal className="h-3.5 w-3.5" />
                    Sent
                  </TabsTrigger>
                  <TabsTrigger value="flagged" className="flex-1 gap-1">
                    <Star className="h-3.5 w-3.5" />
                    Flagged
                  </TabsTrigger>
                  <TabsTrigger value="all" className="flex-1 gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    All
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {activeTab === 'inbox' && renderMessageList(inboxMessages)}
            {activeTab === 'sent' && renderMessageList(sentMessages)}
            {activeTab === 'flagged' && renderMessageList(flaggedMessages)}
            {activeTab === 'all' && renderMessageList(allMessages)}
          </CardContent>
        </Card>

        {/* Message Detail Panel */}
        <Card className="lg:col-span-2">
          {selectedMessage ? (
            <>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{selectedMessage.subject}</CardTitle>
                    <CardDescription className="mt-1 space-y-1">
                      <div>
                        From: {selectedMessage.from} | To:{' '}
                        {selectedMessage.to}
                      </div>
                      <div>
                        {new Date(selectedMessage.date).toLocaleString(
                          'en-US',
                          {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          },
                        )}
                      </div>
                      {selectedMessage.patient && (
                        <div>
                          Patient:{' '}
                          <Badge variant="outline" className="text-xs">
                            {selectedMessage.patient}
                          </Badge>
                        </div>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1"
                      onClick={() => handleToggleFlag(selectedMessage.id)}
                      title={selectedMessage.flagged ? 'Remove flag' : 'Flag message'}
                    >
                      {selectedMessage.flagged ? (
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      ) : (
                        <StarOff className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1"
                      onClick={() => setForwardDialogOpen(true)}
                      title="Forward message"
                    >
                      <Forward className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1"
                      onClick={() => setFollowUpDialogOpen(true)}
                      title="Set follow-up date"
                    >
                      <Calendar className="h-4 w-4" />
                    </Button>
                    {!selectedMessage.escalated && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-destructive hover:text-destructive"
                        onClick={handleEscalate}
                        title="Escalate message"
                      >
                        <AlertTriangle className="h-4 w-4" />
                      </Button>
                    )}
                    {selectedMessage.priority === 'high' && (
                      <Badge variant="destructive">Urgent</Badge>
                    )}
                    {selectedMessage.escalated && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Escalated
                      </Badge>
                    )}
                    {selectedMessage.followUpDate && (
                      <Badge variant="outline" className="gap-1">
                        <Calendar className="h-3 w-3" />
                        Follow-up: {new Date(selectedMessage.followUpDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-6 rounded-lg bg-muted/50 p-4">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {selectedMessage.body}
                  </pre>
                </div>

                <Separator className="my-4" />

                {/* Reply Area */}
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <Reply className="h-4 w-4" />
                    Reply
                  </h3>
                  <Textarea
                    placeholder="Type your reply..."
                    rows={4}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                  />
                  <div className="flex items-center justify-between">
                    <Button variant="outline" size="sm">
                      <Paperclip className="mr-2 h-4 w-4" />
                      Attach
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1"
                      onClick={handleReply}
                      disabled={!replyText.trim()}
                    >
                      <Send className="h-4 w-4" />
                      Send Reply
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex h-[600px] items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Mail className="mx-auto mb-3 h-10 w-10" />
                <p className="font-medium">Select a message to view</p>
                <p className="text-sm">
                  Choose a message from the list to read its contents
                </p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Forward Message Dialog */}
      <Dialog open={forwardDialogOpen} onOpenChange={setForwardDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Forward className="h-4 w-4" />
              Forward Message
            </DialogTitle>
            <DialogDescription>
              Forward this message to another provider.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forwardTo">Forward to</Label>
              <Input
                id="forwardTo"
                placeholder="Recipient name or role..."
                value={forwardTo}
                onChange={(e) => setForwardTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="forwardNote">Add a note (optional)</Label>
              <Textarea
                id="forwardNote"
                rows={3}
                placeholder="Add a note to the forwarded message..."
                value={forwardNote}
                onChange={(e) => setForwardNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForwardDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="gap-1" onClick={handleForward} disabled={!forwardTo.trim()}>
              <Forward className="h-4 w-4" />
              Forward
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Follow-up Date Dialog */}
      <Dialog open={followUpDialogOpen} onOpenChange={setFollowUpDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Set Follow-up Date
            </DialogTitle>
            <DialogDescription>
              Schedule a follow-up reminder for this message.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="followUpDate">Follow-up date</Label>
            <Input
              id="followUpDate"
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFollowUpDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetFollowUp} disabled={!followUpDate}>
              Set Follow-up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compose Message Dialog */}
      <Dialog open={composeDialogOpen} onOpenChange={setComposeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Compose Message</DialogTitle>
            <DialogDescription>
              Send a secure clinical message.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="composeTo">To</Label>
              <Input
                id="composeTo"
                placeholder="Recipient name or role..."
                value={composeForm.to}
                onChange={(e) =>
                  setComposeForm((prev) => ({
                    ...prev,
                    to: e.target.value,
                  }))
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="composePatient">
                  Associated Patient (optional)
                </Label>
                <Input
                  id="composePatient"
                  placeholder="Patient name..."
                  value={composeForm.patient}
                  onChange={(e) =>
                    setComposeForm((prev) => ({
                      ...prev,
                      patient: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={composeForm.priority}
                  onValueChange={(v) =>
                    setComposeForm((prev) => ({
                      ...prev,
                      priority: v as Message['priority'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High / Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="composeSubject">Subject</Label>
              <Input
                id="composeSubject"
                placeholder="Message subject..."
                value={composeForm.subject}
                onChange={(e) =>
                  setComposeForm((prev) => ({
                    ...prev,
                    subject: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="composeBody">Message</Label>
              <Textarea
                id="composeBody"
                rows={8}
                placeholder="Type your message..."
                value={composeForm.body}
                onChange={(e) =>
                  setComposeForm((prev) => ({
                    ...prev,
                    body: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setComposeDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="gap-1"
              onClick={handleCompose}
              disabled={
                !composeForm.to ||
                !composeForm.subject ||
                !composeForm.body
              }
            >
              <Send className="h-4 w-4" />
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
