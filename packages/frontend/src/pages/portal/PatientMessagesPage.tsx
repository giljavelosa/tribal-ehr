import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Send,
  Inbox,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Mail,
  MailOpen,
  Plus,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/toast';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface SecureMessage {
  id: string;
  threadId: string;
  from: string;
  fromName: string;
  to: string;
  toName: string;
  subject: string;
  body: string;
  date: string;
  read: boolean;
  replies?: SecureMessage[];
}

interface CareTeamProvider {
  id: string;
  name: string;
  role: string;
}

type ViewMode = 'inbox' | 'thread' | 'compose';

export function PatientMessagesPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('inbox');
  const [selectedMessage, setSelectedMessage] = useState<SecureMessage | null>(null);
  const [composeData, setComposeData] = useState({
    providerId: '',
    subject: '',
    body: '',
  });
  const [replyBody, setReplyBody] = useState('');

  const { data: messages, isLoading, error } = useQuery({
    queryKey: ['portal', 'messages'],
    queryFn: async () => {
      const response = await api.get<SecureMessage[]>('/api/v1/portal/me/messages');
      return response.data;
    },
    staleTime: 1 * 60 * 1000,
  });

  const { data: careTeam } = useQuery({
    queryKey: ['portal', 'care-team'],
    queryFn: async () => {
      const response = await api.get<CareTeamProvider[]>('/api/v1/portal/me/care-team');
      return response.data;
    },
    staleTime: 10 * 60 * 1000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { providerId: string; subject: string; body: string }) => {
      const response = await api.post('/api/v1/portal/me/messages', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'messages'] });
      toast({ title: 'Message sent', description: 'Your message has been sent to your provider.' });
      setComposeData({ providerId: '', subject: '', body: '' });
      setViewMode('inbox');
    },
    onError: () => {
      toast({
        title: 'Failed to send message',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async (data: { threadId: string; body: string }) => {
      const response = await api.post(`/api/v1/portal/me/messages/${data.threadId}/reply`, {
        body: data.body,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'messages'] });
      toast({ title: 'Reply sent' });
      setReplyBody('');
    },
    onError: () => {
      toast({
        title: 'Failed to send reply',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    },
  });

  const handleSendMessage = () => {
    if (!composeData.providerId || !composeData.subject.trim() || !composeData.body.trim()) {
      return;
    }
    sendMessageMutation.mutate(composeData);
  };

  const handleReply = () => {
    if (!selectedMessage || !replyBody.trim()) return;
    replyMutation.mutate({
      threadId: selectedMessage.threadId,
      body: replyBody,
    });
  };

  const handleOpenThread = (message: SecureMessage) => {
    setSelectedMessage(message);
    setViewMode('thread');
    setReplyBody('');
  };

  const unreadCount = messages?.filter((m) => !m.read).length ?? 0;
  const providers = careTeam ?? [];

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center" role="status">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center" role="alert">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <AlertCircle className="h-10 w-10 text-destructive" aria-hidden="true" />
            <div className="text-center">
              <p className="font-semibold">Unable to load messages</p>
              <p className="mt-1 text-sm text-muted-foreground">Please try again later.</p>
            </div>
            <Button onClick={() => window.location.reload()}>Refresh</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Compose view
  if (viewMode === 'compose') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setViewMode('inbox')} aria-label="Back to inbox">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">New Message</h1>
            <p className="text-muted-foreground">Send a secure message to your care team</p>
          </div>
        </div>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="provider-select">To (Provider)</Label>
              <Select
                value={composeData.providerId}
                onValueChange={(value) =>
                  setComposeData((prev) => ({ ...prev, providerId: value }))
                }
              >
                <SelectTrigger id="provider-select">
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name} - {provider.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message-subject">Subject</Label>
              <Input
                id="message-subject"
                placeholder="Enter message subject"
                value={composeData.subject}
                onChange={(e) =>
                  setComposeData((prev) => ({ ...prev, subject: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message-body">Message</Label>
              <Textarea
                id="message-body"
                placeholder="Type your message here..."
                rows={8}
                value={composeData.body}
                onChange={(e) =>
                  setComposeData((prev) => ({ ...prev, body: e.target.value }))
                }
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setViewMode('inbox')}>
                Cancel
              </Button>
              <Button
                onClick={handleSendMessage}
                disabled={
                  sendMessageMutation.isPending ||
                  !composeData.providerId ||
                  !composeData.subject.trim() ||
                  !composeData.body.trim()
                }
                className="gap-2"
              >
                {sendMessageMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
                Send Message
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Thread view
  if (viewMode === 'thread' && selectedMessage) {
    const threadMessages = [selectedMessage, ...(selectedMessage.replies ?? [])];

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setViewMode('inbox')} aria-label="Back to inbox">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{selectedMessage.subject}</h1>
            <p className="text-muted-foreground">
              Conversation with {selectedMessage.fromName}
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="space-y-4 p-6">
            {threadMessages.map((msg, idx) => (
              <div key={msg.id}>
                {idx > 0 && <Separator className="my-4" />}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{msg.fromName}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(msg.date).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {msg.body}
                  </p>
                </div>
              </div>
            ))}

            <Separator className="my-4" />

            {/* Reply form */}
            <div className="space-y-3">
              <Label htmlFor="reply-body">Reply</Label>
              <Textarea
                id="reply-body"
                placeholder="Type your reply..."
                rows={4}
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleReply}
                  disabled={replyMutation.isPending || !replyBody.trim()}
                  className="gap-2"
                >
                  {replyMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden="true" />
                  )}
                  Send Reply
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Inbox view
  const messageList = messages ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Messages</h1>
          <p className="mt-1 text-muted-foreground">
            Secure messages with your care team
            {unreadCount > 0 && (
              <span className="ml-2">
                <Badge>{unreadCount} unread</Badge>
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => setViewMode('compose')} className="gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Message
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {messageList.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Inbox className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
              <p className="text-muted-foreground">Your inbox is empty.</p>
              <Button variant="outline" onClick={() => setViewMode('compose')}>
                Send your first message
              </Button>
            </div>
          ) : (
            <ul role="list" aria-label="Message inbox">
              {messageList.map((message, idx) => (
                <li key={message.id}>
                  {idx > 0 && <Separator />}
                  <button
                    onClick={() => handleOpenThread(message)}
                    className={cn(
                      'flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-accent',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
                      !message.read && 'bg-primary/5',
                    )}
                    aria-label={`${message.read ? '' : 'Unread: '}${message.subject} from ${message.fromName}`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {message.read ? (
                        <MailOpen className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      ) : (
                        <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn('truncate font-medium', !message.read && 'font-bold')}>
                          {message.fromName}
                        </p>
                        <p className="flex-shrink-0 text-xs text-muted-foreground">
                          {new Date(message.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                      <p className={cn('truncate text-sm', !message.read ? 'font-semibold' : 'text-muted-foreground')}>
                        {message.subject}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {message.body}
                      </p>
                    </div>
                    {!message.read && (
                      <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
