import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { Brain, Upload, Users, ListOrdered, BarChart3, Mail, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Upload Image", path: "/dashboard/upload", icon: Upload },
  { label: "Patient Info", path: "/dashboard/patients", icon: Users },
  { label: "Queue Order", path: "/dashboard/queue", icon: ListOrdered },
  { label: "Results", path: "/dashboard/results", icon: BarChart3 },
  { label: "Contact Us", path: "/dashboard/contact", icon: Mail },
];

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/dashboard/upload")}>
              <Brain className="h-7 w-7 text-primary" />
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                BRAIN TUMOR DETECTION
              </h1>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
                  {user?.email}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { signOut(); navigate("/login"); }}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {/* Tabs */}
        <div className="container mx-auto px-4">
          <nav className="flex gap-1 overflow-x-auto pb-2">
            {tabs.map((tab) => {
              const isActive = location.pathname === tab.path;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap",
                    isActive
                      ? "bg-primary text-primary-foreground medical-glow"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>
      {/* Content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
};
