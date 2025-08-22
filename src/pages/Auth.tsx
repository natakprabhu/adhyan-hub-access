import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export default function Auth() {
  const { user, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/home" replace />;
  }

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const phone = formData.get('phone') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const telegram_id = formData.get('telegram_id') as string;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          name,
          phone,
          telegram_id,
        },
      },
    });

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Check Your Email',
        description: 'Please click the confirmation link sent to your email to complete registration.',
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <img 
              src="/lovable-uploads/082b41c8-f84f-44f0-9084-137a3e9cbfe2.png" 
              alt="Adhyan Library Logo" 
              className="h-16 w-auto"
            />
          </div>
          <CardTitle className="text-2xl font-bold text-primary">Adhyan Library</CardTitle>
          <CardDescription>Access your library account</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <div className="space-y-4">
                <Button 
                  onClick={handleGoogleAuth}
                  variant="outline"
                  className="w-full h-12" 
                  disabled={isLoading}
                >
                  Continue with Google
                </Button>
                
                <div className="relative">
                  <Separator className="my-4" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-background px-2 text-muted-foreground text-sm">or</span>
                  </div>
                </div>
                
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      required
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="Enter your password"
                      required
                      className="h-12"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-12" 
                    disabled={isLoading}
                  >
                    {isLoading ? 'Signing In...' : 'Sign In'}
                  </Button>
                </form>
                
                <div className="mt-6 p-4 bg-muted rounded-2xl">
                  <h4 className="font-medium text-sm mb-2">Test Credentials</h4>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Email: test@adhyanlibrary.com</div>
                    <div>Password: password123</div>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="signup">
              <div className="space-y-4">
                <Button 
                  onClick={handleGoogleAuth}
                  variant="outline"
                  className="w-full h-12" 
                  disabled={isLoading}
                >
                  Continue with Google
                </Button>
                
                <div className="relative">
                  <Separator className="my-4" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-background px-2 text-muted-foreground text-sm">or</span>
                  </div>
                </div>
                
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="Enter your full name"
                      required
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="Enter your phone number"
                      required
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      required
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="Create a password"
                      required
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telegram_id">Telegram ID (Optional)</Label>
                    <Input
                      id="telegram_id"
                      name="telegram_id"
                      type="text"
                      placeholder="@your_telegram_id"
                      className="h-12"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-12" 
                    disabled={isLoading}
                  >
                    {isLoading ? 'Creating Account...' : 'Create Account'}
                  </Button>
                </form>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}