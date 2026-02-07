import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserCircle,
  Phone,
  Mail,
  MapPin,
  Shield,
  Bell,
  Lock,
  Users,
  Loader2,
  AlertCircle,
  Save,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toast';
import { useAuthStore } from '@/stores/auth-store';
import api from '@/lib/api';

interface PatientProfile {
  phone: string;
  email: string;
  address: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
  };
  emergencyContacts: Array<{
    id: string;
    name: string;
    phone: string;
    relationship: string;
  }>;
}

interface CommunicationPreferences {
  emailNotifications: boolean;
  textNotifications: boolean;
  phoneNotifications: boolean;
  portalNotifications: boolean;
}

interface ProxyAccess {
  id: string;
  name: string;
  email: string;
  relationship: string;
  status: string;
}

export function PatientProfilePage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [profileForm, setProfileForm] = useState<PatientProfile>({
    phone: '',
    email: '',
    address: { line1: '', line2: '', city: '', state: '', postalCode: '' },
    emergencyContacts: [],
  });
  const [preferencesForm, setPreferencesForm] = useState<CommunicationPreferences>({
    emailNotifications: true,
    textNotifications: false,
    phoneNotifications: false,
    portalNotifications: true,
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [addProxyDialogOpen, setAddProxyDialogOpen] = useState(false);
  const [newProxy, setNewProxy] = useState({ name: '', email: '', relationship: '' });

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['portal', 'profile'],
    queryFn: async () => {
      const response = await api.get<PatientProfile>('/api/v1/portal/me/profile');
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: preferences } = useQuery({
    queryKey: ['portal', 'preferences'],
    queryFn: async () => {
      const response = await api.get<CommunicationPreferences>('/api/v1/portal/me/preferences');
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: proxies } = useQuery({
    queryKey: ['portal', 'proxies'],
    queryFn: async () => {
      const response = await api.get<ProxyAccess[]>('/api/v1/portal/me/proxies');
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (profile) {
      setProfileForm(profile);
    }
  }, [profile]);

  useEffect(() => {
    if (preferences) {
      setPreferencesForm(preferences);
    }
  }, [preferences]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: PatientProfile) => {
      const response = await api.put('/api/v1/portal/me/profile', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'profile'] });
      toast({ title: 'Profile updated', description: 'Your contact information has been saved.' });
    },
    onError: () => {
      toast({ title: 'Update failed', description: 'Unable to save your profile changes.', variant: 'destructive' });
    },
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: CommunicationPreferences) => {
      const response = await api.put('/api/v1/portal/me/preferences', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'preferences'] });
      toast({ title: 'Preferences updated' });
    },
    onError: () => {
      toast({ title: 'Update failed', variant: 'destructive' });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await api.put('/api/v1/portal/me/password', data);
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'Password changed', description: 'Your password has been updated successfully.' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: () => {
      toast({ title: 'Password change failed', description: 'Please verify your current password and try again.', variant: 'destructive' });
    },
  });

  const addProxyMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; relationship: string }) => {
      const response = await api.post('/api/v1/portal/me/proxies', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'proxies'] });
      toast({ title: 'Proxy access added' });
      setAddProxyDialogOpen(false);
      setNewProxy({ name: '', email: '', relationship: '' });
    },
    onError: () => {
      toast({ title: 'Failed to add proxy', variant: 'destructive' });
    },
  });

  const removeProxyMutation = useMutation({
    mutationFn: async (proxyId: string) => {
      await api.delete(`/api/v1/portal/me/proxies/${proxyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'proxies'] });
      toast({ title: 'Proxy access removed' });
    },
    onError: () => {
      toast({ title: 'Failed to remove proxy', variant: 'destructive' });
    },
  });

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(profileForm);
  };

  const handleSavePreferences = () => {
    updatePreferencesMutation.mutate(preferencesForm);
  };

  const handleChangePassword = () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast({ title: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }
    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  const handleAddEmergencyContact = () => {
    setProfileForm((prev) => ({
      ...prev,
      emergencyContacts: [
        ...prev.emergencyContacts,
        { id: `new-${Date.now()}`, name: '', phone: '', relationship: '' },
      ],
    }));
  };

  const handleRemoveEmergencyContact = (index: number) => {
    setProfileForm((prev) => ({
      ...prev,
      emergencyContacts: prev.emergencyContacts.filter((_, i) => i !== index),
    }));
  };

  const handleUpdateEmergencyContact = (index: number, field: string, value: string) => {
    setProfileForm((prev) => ({
      ...prev,
      emergencyContacts: prev.emergencyContacts.map((contact, i) =>
        i === index ? { ...contact, [field]: value } : contact,
      ),
    }));
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center" role="status">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-muted-foreground">Loading profile...</p>
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
              <p className="font-semibold">Unable to load profile</p>
              <p className="mt-1 text-sm text-muted-foreground">Please try again later.</p>
            </div>
            <Button onClick={() => window.location.reload()}>Refresh</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const proxyList = proxies ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">My Profile</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your contact information, preferences, and account settings
        </p>
      </div>

      <Tabs defaultValue="contact" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="contact" className="gap-2">
            <UserCircle className="h-4 w-4" aria-hidden="true" />
            Contact Info
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Bell className="h-4 w-4" aria-hidden="true" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Lock className="h-4 w-4" aria-hidden="true" />
            Security
          </TabsTrigger>
          <TabsTrigger value="proxy" className="gap-2">
            <Users className="h-4 w-4" aria-hidden="true" />
            Proxy Access
          </TabsTrigger>
        </TabsList>

        {/* Contact info tab */}
        <TabsContent value="contact">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>Update your phone, email, and address</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="profile-phone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <Input
                        id="profile-phone"
                        type="tel"
                        className="pl-9"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <Input
                        id="profile-email"
                        type="email"
                        className="pl-9"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <h3 className="font-medium">Address</h3>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="address-line1">Street Address</Label>
                      <Input
                        id="address-line1"
                        value={profileForm.address.line1}
                        onChange={(e) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            address: { ...prev.address, line1: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="address-line2">Apt / Suite / Unit</Label>
                      <Input
                        id="address-line2"
                        value={profileForm.address.line2}
                        onChange={(e) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            address: { ...prev.address, line2: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address-city">City</Label>
                      <Input
                        id="address-city"
                        value={profileForm.address.city}
                        onChange={(e) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            address: { ...prev.address, city: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="address-state">State</Label>
                        <Input
                          id="address-state"
                          value={profileForm.address.state}
                          onChange={(e) =>
                            setProfileForm((prev) => ({
                              ...prev,
                              address: { ...prev.address, state: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="address-zip">ZIP Code</Label>
                        <Input
                          id="address-zip"
                          value={profileForm.address.postalCode}
                          onChange={(e) =>
                            setProfileForm((prev) => ({
                              ...prev,
                              address: { ...prev.address, postalCode: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={updateProfileMutation.isPending}
                    className="gap-2"
                  >
                    {updateProfileMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Save className="h-4 w-4" aria-hidden="true" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Emergency contacts */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Emergency Contacts</CardTitle>
                    <CardDescription>People to contact in case of emergency</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleAddEmergencyContact} className="gap-2">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add Contact
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {profileForm.emergencyContacts.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No emergency contacts added.
                  </p>
                ) : (
                  profileForm.emergencyContacts.map((contact, idx) => (
                    <div key={contact.id} className="flex gap-4 rounded-lg border p-4">
                      <div className="grid flex-1 gap-3 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label htmlFor={`ec-name-${idx}`}>Name</Label>
                          <Input
                            id={`ec-name-${idx}`}
                            value={contact.name}
                            onChange={(e) => handleUpdateEmergencyContact(idx, 'name', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`ec-phone-${idx}`}>Phone</Label>
                          <Input
                            id={`ec-phone-${idx}`}
                            type="tel"
                            value={contact.phone}
                            onChange={(e) => handleUpdateEmergencyContact(idx, 'phone', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`ec-rel-${idx}`}>Relationship</Label>
                          <Input
                            id={`ec-rel-${idx}`}
                            value={contact.relationship}
                            onChange={(e) => handleUpdateEmergencyContact(idx, 'relationship', e.target.value)}
                          />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveEmergencyContact(idx)}
                        aria-label={`Remove emergency contact ${contact.name || idx + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
                {profileForm.emergencyContacts.length > 0 && (
                  <div className="flex justify-end">
                    <Button
                      onClick={handleSaveProfile}
                      disabled={updateProfileMutation.isPending}
                      className="gap-2"
                    >
                      {updateProfileMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Save className="h-4 w-4" aria-hidden="true" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Preferences tab */}
        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>Communication Preferences</CardTitle>
              <CardDescription>Choose how you would like to be contacted</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="pref-email" className="text-base">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive email notifications for messages, results, and appointments</p>
                </div>
                <Switch
                  id="pref-email"
                  checked={preferencesForm.emailNotifications}
                  onCheckedChange={(checked) =>
                    setPreferencesForm((prev) => ({ ...prev, emailNotifications: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="pref-text" className="text-base">Text Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive SMS reminders for appointments and important updates</p>
                </div>
                <Switch
                  id="pref-text"
                  checked={preferencesForm.textNotifications}
                  onCheckedChange={(checked) =>
                    setPreferencesForm((prev) => ({ ...prev, textNotifications: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="pref-phone" className="text-base">Phone Call Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive phone calls for urgent communications</p>
                </div>
                <Switch
                  id="pref-phone"
                  checked={preferencesForm.phoneNotifications}
                  onCheckedChange={(checked) =>
                    setPreferencesForm((prev) => ({ ...prev, phoneNotifications: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="pref-portal" className="text-base">Portal Notifications</Label>
                  <p className="text-sm text-muted-foreground">Show notifications within the patient portal</p>
                </div>
                <Switch
                  id="pref-portal"
                  checked={preferencesForm.portalNotifications}
                  onCheckedChange={(checked) =>
                    setPreferencesForm((prev) => ({ ...prev, portalNotifications: checked }))
                  }
                />
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSavePreferences}
                  disabled={updatePreferencesMutation.isPending}
                  className="gap-2"
                >
                  {updatePreferencesMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="h-4 w-4" aria-hidden="true" />
                  )}
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-md space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Must be at least 8 characters with uppercase, lowercase, number, and special character.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleChangePassword}
                  disabled={
                    changePasswordMutation.isPending ||
                    !passwordForm.currentPassword ||
                    !passwordForm.newPassword ||
                    !passwordForm.confirmPassword
                  }
                  className="gap-2"
                >
                  {changePasswordMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Lock className="h-4 w-4" aria-hidden="true" />
                  )}
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Proxy access tab */}
        <TabsContent value="proxy">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Proxy Access</CardTitle>
                  <CardDescription>
                    Manage who can access your health portal on your behalf (e.g., parent, guardian, caregiver)
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setAddProxyDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add Proxy
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {proxyList.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Users className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
                  <p className="text-muted-foreground">No proxy access has been granted.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {proxyList.map((proxy) => (
                    <div
                      key={proxy.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div>
                        <p className="font-medium">{proxy.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {proxy.email} - {proxy.relationship}
                        </p>
                        <Badge variant="outline" className="mt-1">{proxy.status}</Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeProxyMutation.mutate(proxy.id)}
                        disabled={removeProxyMutation.isPending}
                        aria-label={`Remove proxy access for ${proxy.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add proxy dialog */}
      <Dialog open={addProxyDialogOpen} onOpenChange={setAddProxyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Proxy Access</DialogTitle>
            <DialogDescription>
              Grant another person access to view your health information through the portal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="proxy-name">Full Name</Label>
              <Input
                id="proxy-name"
                value={newProxy.name}
                onChange={(e) => setNewProxy((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proxy-email">Email Address</Label>
              <Input
                id="proxy-email"
                type="email"
                value={newProxy.email}
                onChange={(e) => setNewProxy((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proxy-relationship">Relationship</Label>
              <Select
                value={newProxy.relationship}
                onValueChange={(value) => setNewProxy((prev) => ({ ...prev, relationship: value }))}
              >
                <SelectTrigger id="proxy-relationship">
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="guardian">Guardian</SelectItem>
                  <SelectItem value="spouse">Spouse / Partner</SelectItem>
                  <SelectItem value="caregiver">Caregiver</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddProxyDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => addProxyMutation.mutate(newProxy)}
              disabled={addProxyMutation.isPending || !newProxy.name || !newProxy.email || !newProxy.relationship}
              className="gap-2"
            >
              {addProxyMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Add Proxy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
