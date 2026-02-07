import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, Eye, EyeOff, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuthStore } from '@/stores/auth-store';
import { useForgotPassword } from '@/hooks/use-api';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const forgotPassword = useForgotPassword();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showMfa, setShowMfa] = useState(false);
  const [error, setError] = useState('');

  // Forgot password state
  const [forgotDialogOpen, setForgotDialogOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const sessionTimeout = searchParams.get('reason') === 'session_timeout';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(username, password, showMfa ? mfaCode : undefined);
      navigate('/dashboard');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Login failed. Please try again.';
      if (message.toLowerCase().includes('mfa') || message.toLowerCase().includes('two-factor')) {
        setShowMfa(true);
      }
      setError(message);
    }
  };

  const handleForgotPassword = async () => {
    setForgotError('');
    setForgotSuccess(false);

    if (!forgotEmail) {
      setForgotError('Please enter your email address.');
      return;
    }

    try {
      await forgotPassword.mutateAsync({ email: forgotEmail });
      setForgotSuccess(true);
    } catch {
      // Even on error, show success message for security (don't reveal if email exists)
      setForgotSuccess(true);
    }
  };

  const handleOpenForgotDialog = () => {
    setForgotEmail('');
    setForgotSuccess(false);
    setForgotError('');
    setForgotDialogOpen(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Shield className="h-9 w-9" />
          </div>
          <h1 className="text-3xl font-bold">Tribal EHR</h1>
          <p className="mt-1 text-muted-foreground">
            Electronic Health Records System
          </p>
        </div>

        {sessionTimeout && (
          <Alert className="mb-4">
            <AlertDescription>
              Your session has expired due to inactivity. Please log in again.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access the system
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">Email or Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your email or username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-10 w-10"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {showMfa && (
                <div className="space-y-2">
                  <Label htmlFor="mfaCode">MFA Code</Label>
                  <Input
                    id="mfaCode"
                    type="text"
                    placeholder="Enter your 6-digit code"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    maxLength={6}
                    pattern="[0-9]{6}"
                    autoComplete="one-time-code"
                  />
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isLoading} aria-busy={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
              <Button
                type="button"
                variant="link"
                className="text-sm"
                onClick={handleOpenForgotDialog}
              >
                Forgot password?
              </Button>
            </CardFooter>
          </form>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Protected health information. Unauthorized access is prohibited.
          <br />
          All access is logged and monitored for HIPAA compliance.
        </p>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={forgotDialogOpen} onOpenChange={setForgotDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter your email address and we will send you a link to reset your
              password.
            </DialogDescription>
          </DialogHeader>
          {forgotSuccess ? (
            <div className="space-y-3">
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertDescription>
                  If an account exists with this email, a password reset link has
                  been sent.
                </AlertDescription>
              </Alert>
              <DialogFooter>
                <Button onClick={() => setForgotDialogOpen(false)}>
                  Back to Login
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {forgotError && (
                  <Alert variant="destructive">
                    <AlertDescription>{forgotError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="forgotEmail">Email Address</Label>
                  <Input
                    id="forgotEmail"
                    type="email"
                    placeholder="Enter your email address"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setForgotDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleForgotPassword}
                  disabled={!forgotEmail || forgotPassword.isPending}
                >
                  {forgotPassword.isPending ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
