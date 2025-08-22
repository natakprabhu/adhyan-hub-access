import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import SeatPlan from "./pages/SeatPlan";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/home" element={<ProtectedRoute><MobileLayout><Home /></MobileLayout></ProtectedRoute>} />
            <Route path="/seat-plan" element={<ProtectedRoute><MobileLayout><SeatPlan /></MobileLayout></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><MobileLayout><Profile /></MobileLayout></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
