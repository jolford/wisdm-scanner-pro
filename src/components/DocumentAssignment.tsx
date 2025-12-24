import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  UserPlus, 
  User, 
  Search, 
  Check, 
  Clock,
  Mail
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TeamMember {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  role?: string;
  currentWorkload?: number;
  status?: 'online' | 'away' | 'offline';
}

interface DocumentAssignmentProps {
  documentId: string;
  currentAssignee?: TeamMember;
  teamMembers: TeamMember[];
  onAssign: (memberId: string) => Promise<void>;
  onUnassign?: () => Promise<void>;
  trigger?: React.ReactNode;
}

export function DocumentAssignment({
  documentId,
  currentAssignee,
  teamMembers,
  onAssign,
  onUnassign,
  trigger
}: DocumentAssignmentProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const filteredMembers = teamMembers.filter(member =>
    member.displayName?.toLowerCase().includes(search.toLowerCase()) ||
    member.email.toLowerCase().includes(search.toLowerCase())
  );

  const getInitials = (member: TeamMember) => {
    if (member.displayName) {
      return member.displayName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return member.email[0].toUpperCase();
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-amber-500';
      default: return 'bg-muted';
    }
  };

  const handleAssign = async (memberId: string) => {
    setIsAssigning(true);
    try {
      await onAssign(memberId);
      setOpen(false);
    } catch (error) {
      console.error('Failed to assign:', error);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassign = async () => {
    if (!onUnassign) return;
    setIsAssigning(true);
    try {
      await onUnassign();
      setOpen(false);
    } catch (error) {
      console.error('Failed to unassign:', error);
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            {currentAssignee ? (
              <>
                <Avatar className="h-5 w-5">
                  <AvatarImage src={currentAssignee.avatarUrl} />
                  <AvatarFallback className="text-[10px]">
                    {getInitials(currentAssignee)}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-24 truncate">
                  {currentAssignee.displayName || currentAssignee.email}
                </span>
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Assign
              </>
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Document</DialogTitle>
          <DialogDescription>
            Assign this document to a team member for review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search team members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-64">
            <div className="space-y-1">
              {currentAssignee && onUnassign && (
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-auto py-3 text-destructive hover:text-destructive"
                  onClick={handleUnassign}
                  disabled={isAssigning}
                >
                  <User className="h-4 w-4" />
                  Remove assignment
                </Button>
              )}

              {filteredMembers.map((member) => {
                const isCurrentAssignee = currentAssignee?.id === member.id;

                return (
                  <Button
                    key={member.id}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start gap-3 h-auto py-3",
                      isCurrentAssignee && "bg-primary/10"
                    )}
                    onClick={() => handleAssign(member.id)}
                    disabled={isAssigning || isCurrentAssignee}
                  >
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatarUrl} />
                        <AvatarFallback>{getInitials(member)}</AvatarFallback>
                      </Avatar>
                      <div
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
                          getStatusColor(member.status)
                        )}
                      />
                    </div>

                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {member.displayName || member.email}
                        </span>
                        {isCurrentAssignee && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {member.email}
                      </div>
                    </div>

                    <div className="text-right">
                      {member.role && (
                        <Badge variant="secondary" className="text-xs">
                          {member.role}
                        </Badge>
                      )}
                      {member.currentWorkload !== undefined && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {member.currentWorkload} active
                        </div>
                      )}
                    </div>
                  </Button>
                );
              })}

              {filteredMembers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No team members found
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
