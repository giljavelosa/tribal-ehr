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
  Forward,
  Star,
  StarOff,
  Calendar,
  AlertTriangle,
  Loader2,
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useDebounce } from '@/hooks/use-debounce';
import {
  useMessagesInbox,
  useMessagesSent,
  useMessagesFlagged,
  useMessagesUnreadCount,
  useSendMessage,
  useReplyToMessage,
  useMarkMessageRead,
  useFlagMessage,
  useForwardMessage,
  useSetMessageFollowUp,
  useEscalateMessage,
  type ApiMessage,
} from '@/hooks/use-api';

// Unified display type that normalizes inbox/sent messages for the list view
interface DisplayMessage extends ApiMessage {
  direction: 'incoming' | 'outgoing';
}

export function MessagesPage() {
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
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
    priority: 'normal' as ApiMessage['priority'],
  }));

  // API hooks
  const inboxQuery = useMessagesInbox();
  const sentQuery = useMessagesSent();
  const flaggedQuery = useMessagesFlagged();
  const unreadCountQuery = useMessagesUnreadCount();
  const sendMessageMutation = useSendMessage();
  const replyMutation = useReplyToMessage();
  const markReadMutation = useMarkMessageRead();
  const flagMutation = useFlagMessage();
  const forwardMutation = useForwardMessage();
  const followUpMutation = useSetMessageFollowUp();
  const escalateMutation = useEscalateMessage();

  // Transform API messages into display messages
  const inboxMessages: DisplayMessage[] = useMemo(() => {
    const data = inboxQuery.data?.data ?? [];
    return data.map((m) => ({ ...m, direction: 'incoming' as const }));
  }, [inboxQuery.data]);

  const sentMessages: DisplayMessage[] = useMemo(() => {
    const data = sentQuery.data?.data ?? [];
    return data.map((m) => ({ ...m, direction: 'outgoing' as const }));
  }, [sentQuery.data]);

  const flaggedMessages: DisplayMessage[] = useMemo(() => {
    const data = flaggedQuery.data ?? [];
    return data.map((m) => ({ ...m, direction: 'incoming' as const }));
  }, [flaggedQuery.data]);

  const allMessages: DisplayMessage[] = useMemo(() => {
    const combined = [...inboxMessages, ...sentMessages];
    // Sort by date descending
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return combined;
  }, [inboxMessages, sentMessages]);

  // Debounce search to avoid excessive filtering on large message lists
  const debouncedSearchQuery = useDebounce(searchQuery, 200);

  // Apply local search filter
  const filterBySearch = useCallback(
    (list: DisplayMessage[]) => {
      if (!debouncedSearchQuery) return list;
      const q = debouncedSearchQuery.toLowerCase();
      return list.filter(
        (m) =>
          (m.senderName || '').toLowerCase().includes(q) ||
          (m.recipientName || '').toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q) ||
          m.body.toLowerCase().includes(q) ||
          (m.patientName && m.patientName.toLowerCase().includes(q)),
      );
    },
    [debouncedSearchQuery],
  );

  const filteredInbox = useMemo(() => filterBySearch(inboxMessages), [filterBySearch, inboxMessages]);
  const filteredSent = useMemo(() => filterBySearch(sentMessages), [filterBySearch, sentMessages]);
  const filteredFlagged = useMemo(() => filterBySearch(flaggedMessages), [filterBySearch, flaggedMessages]);
  const filteredAll = useMemo(() => filterBySearch(allMessages), [filterBySearch, allMessages]);

  const unreadCount = unreadCountQuery.data ?? 0;

  const selectedMessage = useMemo(() => {
    if (!selectedMessageId) return null;
    return allMessages.find((m) => m.id === selectedMessageId) ||
      flaggedMessages.find((m) => m.id === selectedMessageId) ||
      null;
  }, [allMessages, flaggedMessages, selectedMessageId]);

  const selectMessage = useCallback(
    (msg: DisplayMessage) => {
      setSelectedMessageId(msg.id);
      setReplyText('');
      // Mark as read if unread and incoming
      if (!msg.readAt && msg.direction === 'incoming') {
        markReadMutation.mutate(msg.id);
      }
    },
    [markReadMutation],
  );

  const handleReply = useCallback(() => {
    if (!replyText.trim() || !selectedMessage) return;
    replyMutation.mutate(
      { id: selectedMessage.id, body: replyText },
      { onSuccess: () => setReplyText('') },
    );
  }, [replyText, selectedMessage, replyMutation]);

  const handleCompose = useCallback(() => {
    if (!composeForm.to || !composeForm.subject || !composeForm.body) return;
    sendMessageMutation.mutate(
      {
        recipientId: composeForm.to,
        subject: composeForm.subject,
        body: composeForm.body,
        priority: composeForm.priority,
      },
      {
        onSuccess: () => {
          setComposeDialogOpen(false);
          setComposeForm({
            to: '',
            subject: '',
            body: '',
            patient: '',
            priority: 'normal',
          });
        },
      },
    );
  }, [composeForm, sendMessageMutation]);

  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [forwardTo, setForwardTo] = useState('');
  const [forwardNote, setForwardNote] = useState('');
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');

  const handleToggleFlag = useCallback(
    (messageId: string, currentlyFlagged: boolean) => {
      flagMutation.mutate({ id: messageId, flagged: !currentlyFlagged });
    },
    [flagMutation],
  );

  const handleForward = useCallback(() => {
    if (!forwardTo.trim() || !selectedMessage) return;
    forwardMutation.mutate(
      { id: selectedMessage.id, recipientId: forwardTo, note: forwardNote || undefined },
      {
        onSuccess: () => {
          setForwardDialogOpen(false);
          setForwardTo('');
          setForwardNote('');
        },
      },
    );
  }, [forwardTo, forwardNote, selectedMessage, forwardMutation]);

  const handleSetFollowUp = useCallback(() => {
    if (!followUpDate || !selectedMessage) return;
    followUpMutation.mutate(
      { id: selectedMessage.id, followUpDate },
      {
        onSuccess: () => {
          setFollowUpDialogOpen(false);
          setFollowUpDate('');
        },
      },
    );
  }, [followUpDate, selectedMessage, followUpMutation]);

  const handleEscalate = useCallback(() => {
    if (!selectedMessage) return;
    // Escalate to the sender (or a supervisor). For now, we pass senderId as the escalation target.
    escalateMutation.mutate({ id: selectedMessage.id, escalateTo: selectedMessage.senderId });
  }, [selectedMessage, escalateMutation]);

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  const isLoading = inboxQuery.isLoading || sentQuery.isLoading;

  const renderMessageList = (list: DisplayMessage[], loading: boolean) => (
    <ScrollArea className="h-[600px]">
      {loading ? (
        <div className="flex h-[200px] items-center justify-center text-muted-foreground" role="status" aria-label="Loading messages">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
          Loading messages...
        </div>
      ) : list.length === 0 ? (
        <div className="flex h-[200px] items-center justify-center text-muted-foreground">
          No messages found.
        </div>
      ) : (
        list.map((message) => (
          <div
            key={message.id}
            className={`cursor-pointer border-b px-4 py-3 transition-colors hover:bg-accent ${
              selectedMessageId === message.id ? 'bg-accent' : ''
            } ${!message.readAt ? 'bg-primary/5' : ''}`}
            onClick={() => selectMessage(message)}
            role="button"
            tabIndex={0}
            aria-label={`${!message.readAt ? 'Unread: ' : ''}${message.subject} from ${message.senderName || 'Unknown'}`}
            aria-selected={selectedMessageId === message.id}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectMessage(message);
              }
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <Avatar className="mt-0.5 h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {getInitials(
                      message.direction === 'incoming'
                        ? message.senderName || 'Unknown'
                        : message.recipientName || 'Unknown',
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p
                    className={`text-sm ${!message.readAt ? 'font-semibold' : 'font-medium'}`}
                  >
                    {message.direction === 'incoming'
                      ? message.senderName || 'Unknown'
                      : `To: ${message.recipientName || 'Unknown'}`}
                  </p>
                  <p className="truncate text-sm">{message.subject}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {message.body.slice(0, 80)}...
                  </p>
                  {message.patientName && (
                    <Badge
                      variant="outline"
                      className="mt-1 text-[10px]"
                    >
                      {message.patientName}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {new Date(message.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                {message.flagged && (
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                )}
                {message.escalated && (
                  <Badge variant="destructive" className="text-[10px]">
                    Escalated
                  </Badge>
                )}
                {(message.priority === 'high' || message.priority === 'urgent') && !message.escalated && (
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
                {!message.readAt && (
                  <div className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
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
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  aria-label="Search messages by name, subject, or content"
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
            {activeTab === 'inbox' && renderMessageList(filteredInbox, inboxQuery.isLoading)}
            {activeTab === 'sent' && renderMessageList(filteredSent, sentQuery.isLoading)}
            {activeTab === 'flagged' && renderMessageList(filteredFlagged, flaggedQuery.isLoading)}
            {activeTab === 'all' && renderMessageList(filteredAll, isLoading)}
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
                        From: {selectedMessage.senderName || 'Unknown'} | To:{' '}
                        {selectedMessage.recipientName || 'Unknown'}
                      </div>
                      <div>
                        {new Date(selectedMessage.createdAt).toLocaleString(
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
                      {selectedMessage.patientName && (
                        <div>
                          Patient:{' '}
                          <Badge variant="outline" className="text-xs">
                            {selectedMessage.patientName}
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
                      onClick={() => handleToggleFlag(selectedMessage.id, !!selectedMessage.flagged)}
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
                    {(selectedMessage.priority === 'high' || selectedMessage.priority === 'urgent') && (
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
                    aria-label="Reply message text"
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
                      disabled={!replyText.trim() || replyMutation.isPending}
                    >
                      {replyMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
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
              <Label htmlFor="forwardTo">Forward to (User ID)</Label>
              <Input
                id="forwardTo"
                placeholder="Recipient user ID..."
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
            <Button
              className="gap-1"
              onClick={handleForward}
              disabled={!forwardTo.trim() || forwardMutation.isPending}
            >
              {forwardMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Forward className="h-4 w-4" />
              )}
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
            <Button
              onClick={handleSetFollowUp}
              disabled={!followUpDate || followUpMutation.isPending}
            >
              {followUpMutation.isPending ? 'Saving...' : 'Set Follow-up'}
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
              <Label htmlFor="composeTo">To (User ID)</Label>
              <Input
                id="composeTo"
                placeholder="Recipient user ID..."
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
                      priority: v as ApiMessage['priority'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
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
                !composeForm.body ||
                sendMessageMutation.isPending
              }
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
