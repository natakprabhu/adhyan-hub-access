import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Calendar, Eye, Clock } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  approved: boolean;
  validity_from?: string;
  validity_to?: string;
  created_at: string;
}

interface UserTransaction {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  bookings?: {
    type: string;
    slot?: string;
    start_time: string;
    end_time: string;
    seats: {
      seat_number: number;
    };
  };
}

export const UsersManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userTransactions, setUserTransactions] = useState<UserTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch users.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserApproval = async (userId: string, approved: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ approved })
        .eq('id', userId);

      if (error) throw error;
      
      await fetchUsers();
      toast({
        title: "Success",
        description: `User ${approved ? 'approved' : 'rejected'} successfully.`,
      });
    } catch (error) {
      console.error('Error updating user approval:', error);
      toast({
        title: "Error",
        description: "Failed to update user approval.",
        variant: "destructive",
      });
    }
  };

  const updateUserValidity = async (userId: string, validityFrom: string, validityTo: string) => {
    try {
      const updates: any = { 
        validity_from: validityFrom,
        validity_to: validityTo
      };

      // If approving and setting validity, also approve the user
      if (validityFrom && validityTo) {
        updates.approved = true;
      }

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId);

      if (error) throw error;
      
      await fetchUsers();
      toast({
        title: "Success",
        description: "User validity period updated successfully.",
      });
    } catch (error) {
      console.error('Error updating user validity:', error);
      toast({
        title: "Error",
        description: "Failed to update user validity.",
        variant: "destructive",
      });
    }
  };

  const fetchUserTransactions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          bookings (
            type,
            slot,
            start_time,
            end_time,
            seats (seat_number)
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserTransactions(data || []);
    } catch (error) {
      console.error('Error fetching user transactions:', error);
      toast({
        title: "Error",
        description: "Failed to fetch user transactions.",
        variant: "destructive",
      });
    }
  };

  const handleViewUser = async (user: User) => {
    setSelectedUser(user);
    await fetchUserTransactions(user.id);
    setIsDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (user: User) => {
    if (!user.approved) return <Badge variant="secondary">Pending</Badge>;
    
    if (!user.validity_from || !user.validity_to) {
      return <Badge variant="default">Approved</Badge>;
    }

    const today = new Date();
    const validFrom = new Date(user.validity_from);
    const validTo = new Date(user.validity_to);

    if (today < validFrom) {
      return <Badge variant="outline">Future Valid</Badge>;
    } else if (today > validTo) {
      return <Badge variant="destructive">Expired</Badge>;
    } else {
      return <Badge variant="default">Active</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            All Users Management
          </CardTitle>
          <CardDescription>
            Manage user approvals, validity periods, and view transaction history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Validity Period</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{getStatusBadge(user)}</TableCell>
                  <TableCell>
                    {user.validity_from && user.validity_to ? (
                      <span className="text-sm">
                        {formatDate(user.validity_from)} - {formatDate(user.validity_to)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">Not set</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewUser(user)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      {!user.approved && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => updateUserApproval(user.id, true)}
                        >
                          Approve
                        </Button>
                      )}
                      {user.approved && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => updateUserApproval(user.id, false)}
                        >
                          Reject
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* User Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>User Details: {selectedUser?.name}</DialogTitle>
            <DialogDescription>
              View and manage user information and transaction history
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-6">
              {/* User Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">User Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Name</Label>
                    <p className="font-medium">{selectedUser.name}</p>
                  </div>
                  <div>
                    <Label>Email</Label>
                    <p className="font-medium">{selectedUser.email}</p>
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <p className="font-medium">{selectedUser.phone}</p>
                  </div>
                  <div>
                    <Label>Status</Label>
                    {getStatusBadge(selectedUser)}
                  </div>
                </CardContent>
              </Card>

              {/* Validity Period Management */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Validity Period</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const validityFrom = formData.get('validity_from') as string;
                    const validityTo = formData.get('validity_to') as string;
                    updateUserValidity(selectedUser.id, validityFrom, validityTo);
                  }} className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="validity_from">Valid From</Label>
                      <Input
                        id="validity_from"
                        name="validity_from"
                        type="date"
                        defaultValue={selectedUser.validity_from || ''}
                      />
                    </div>
                    <div>
                      <Label htmlFor="validity_to">Valid To</Label>
                      <Input
                        id="validity_to"
                        name="validity_to"
                        type="date"
                        defaultValue={selectedUser.validity_to || ''}
                      />
                    </div>
                    <div className="col-span-2">
                      <Button type="submit">Update Validity Period</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Transaction History */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Transaction History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {userTransactions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">
                      No transactions found
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {userTransactions.map((transaction) => (
                        <div key={transaction.id} className="border rounded-lg p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">
                                ₹{transaction.amount} - {transaction.status}
                              </p>
                              {transaction.bookings && (
                                <p className="text-sm text-muted-foreground">
                                  Seat {transaction.bookings.seats.seat_number} - {transaction.bookings.type}
                                  {transaction.bookings.slot && ` (${transaction.bookings.slot})`}
                                </p>
                              )}
                            </div>
                            <Badge variant={transaction.status === 'paid' ? 'default' : 'secondary'}>
                              {transaction.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatDate(transaction.created_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};