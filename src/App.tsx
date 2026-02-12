import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import UploadImage from "./pages/UploadImage";
import PatientInfo from "./pages/PatientInfo";
import QueueOrder from "./pages/QueueOrder";
import Results from "./pages/Results";
import ContactUs from "./pages/ContactUs";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/dashboard/upload" replace />} />
            <Route path="/dashboard/upload" element={<ProtectedRoute><UploadImage /></ProtectedRoute>} />
            <Route path="/dashboard/patients" element={<ProtectedRoute><PatientInfo /></ProtectedRoute>} />
            <Route path="/dashboard/queue" element={<ProtectedRoute><QueueOrder /></ProtectedRoute>} />
            <Route path="/dashboard/results" element={<ProtectedRoute><Results /></ProtectedRoute>} />
            <Route path="/dashboard/contact" element={<ProtectedRoute><ContactUs /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
